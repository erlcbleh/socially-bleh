import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { serializeUser } from "../services/hydrate.js";
import { deleteCloudinaryAsset } from "../services/cloudinary.js";
import { isOwnMediaUrl } from "../services/r2.js";
import { emitToCommunity, REALTIME_EVENTS } from "../services/realtime.js";
import {
  MAX_ACTIVE_STORIES_PER_AUTHOR,
  boundNewestStories,
  parseStoryFeedPageQuery,
} from "../services/storyBounds.js";
import { canAttachVideo, VIDEO_REQUIRES_VERIFICATION } from "../services/permissions.js";
import { paginateRelationshipRows } from "../utils/relationshipPagination.js";
import { guardText } from "../services/textGuard.js";

const MIN_HOURS = 1;
const MAX_HOURS = 168;
const DEFAULT_HOURS = 24;
const MAX_CAPTION_LEN = 200;

const RELATIONSHIP_ORDER = [{ createdAt: "desc" }, { id: "desc" }];

function relationshipCursorWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function serializeStoryRef(story) {
  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption || "",
  };
}

function serializeStory(story, viewedStoryIds) {
  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption || "",
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    isViewedByMe: viewedStoryIds.has(story.id),
  };
}

export async function createStory(req, res) {
  const { mediaType, durationHours } = req.body;
  const mediaUrl = String(req.body.mediaUrl || "");
  const caption = String(req.body.caption || "");
  if (!mediaUrl || !["image", "video"].includes(mediaType)) {
    return res.status(400).json({ message: "Invalid media" });
  }
  if (mediaType === "video" && !canAttachVideo(req.user, req.membership)) {
    return res.status(403).json({ code: "video_requires_verification", message: VIDEO_REQUIRES_VERIFICATION });
  }
  if (mediaUrl.length > 500 || !isOwnMediaUrl(mediaUrl)) {
    return res.status(400).json({ message: "Invalid media URL" });
  }
  if (caption.length > MAX_CAPTION_LEN) {
    return res.status(400).json({ message: "Caption too long" });
  }

  if (caption) {
    const guardResult = guardText(caption);
    if (!guardResult.ok) {
      return res.status(400).json({ message: guardResult.message });
    }
  }

  const hours = Math.min(Math.max(Number(durationHours) || DEFAULT_HOURS, MIN_HOURS), MAX_HOURS);
  const atActiveStoryLimit = await prisma.story.findMany({
    where: {
      authorId: req.user.id,
      communityId: req.community.id,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
    skip: MAX_ACTIVE_STORIES_PER_AUTHOR - 1,
    take: 1,
  });
  if (atActiveStoryLimit.length) {
    return res.status(409).json({
      message: `You can have at most ${MAX_ACTIVE_STORIES_PER_AUTHOR} active stories. Delete one or wait for one to expire.`,
    });
  }

  const story = await prisma.story.create({
    data: {
      id: newId(),
      authorId: req.user.id,
      communityId: req.community.id,
      mediaUrl,
      mediaType,
      caption: caption.trim(),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });

  emitToCommunity(req.community.slug, REALTIME_EVENTS.storiesChanged, {
    communitySlug: req.community.slug,
    kind: "created",
    storyId: story.id,
  });
  res.status(201).json({ story: serializeStory(story, new Set()) });
}

export async function getStoryFeed(req, res) {
  const viewerId = req.user.id;
  const communityId = req.community.id;
  let pagination;
  try {
    pagination = parseStoryFeedPageQuery(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const followRows = await prisma.follow.findMany({
    where: {
      followerId: viewerId,
      status: "accepted",
      ...relationshipCursorWhere(pagination.cursor),
    },
    orderBy: RELATIONSHIP_ORDER,
    take: pagination.limit + 1,
    select: { followingId: true, createdAt: true, id: true },
  });
  const { page: followPage, hasMore, nextCursor } = paginateRelationshipRows(followRows, pagination.limit);
  const candidateAuthorIds = followPage.map((follow) => follow.followingId);
  if (!pagination.cursor) candidateAuthorIds.unshift(viewerId);

  const blocks = candidateAuthorIds.length
    ? await prisma.block.findMany({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: { in: candidateAuthorIds } },
            { blockerId: { in: candidateAuthorIds }, blockedId: viewerId },
          ],
        },
        select: { blockerId: true, blockedId: true },
      })
    : [];
  const excludeAuthors = new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]));
  excludeAuthors.delete(viewerId);
  const authorIds = candidateAuthorIds.filter((id) => !excludeAuthors.has(id));

  if (!authorIds.length) {
    return res.json({ groups: [], hasMore, nextCursor, truncated: false });
  }

  const storyLimit = authorIds.length * MAX_ACTIVE_STORIES_PER_AUTHOR;
  const newestStories = await prisma.story.findMany({
    where: {
      authorId: { in: authorIds },
      communityId,
      expiresAt: { gt: new Date() },
    },
    orderBy: RELATIONSHIP_ORDER,
    take: storyLimit + 1,
    include: { author: true },
  });
  const { stories, truncated } = boundNewestStories(newestStories, storyLimit);

  if (!stories.length) return res.json({ groups: [], hasMore, nextCursor, truncated });

  const viewedRows = await prisma.storyView.findMany({
    where: { viewerId, storyId: { in: stories.map((s) => s.id) } },
    select: { storyId: true },
  });
  const viewedStoryIds = new Set(viewedRows.map((row) => row.storyId));

  const groupMap = new Map();
  for (const story of stories) {
    const authorId = story.author.id;
    if (!groupMap.has(authorId)) groupMap.set(authorId, { author: story.author, stories: [] });
    groupMap.get(authorId).stories.push(story);
  }

  const groups = [...groupMap.values()].map(({ author, stories: authorStories }) => ({
    author: serializeUser(author, { isSelf: author.id === viewerId }),
    hasUnviewed: authorStories.some((s) => !viewedStoryIds.has(s.id)),
    stories: authorStories.map((s) => serializeStory(s, viewedStoryIds)),
  }));

  groups.sort((a, b) => {
    if (a.author.id === viewerId) return -1;
    if (b.author.id === viewerId) return 1;
    if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
    return 0;
  });

  res.json({ groups, hasMore, nextCursor, truncated });
}

export async function getUserStories(req, res) {
  const { username } = req.params;
  const viewerId = req.user.id;
  const communityId = req.community.id;
  const author = await prisma.user.findFirst({
    where: { username: String(username || "").toLowerCase() },
  });
  if (!author) return res.status(404).json({ message: "User not found" });

  const authorMembership = await prisma.communityMembership.findFirst({
    where: { communityId, userId: author.id, status: "active" },
  });
  if (!authorMembership) return res.status(404).json({ message: "User not found" });

  if (author.id !== viewerId) {
    const [blocked, blockedMe] = await Promise.all([
      prisma.block.findFirst({
        where: { blockerId: viewerId, blockedId: author.id },
        select: { id: true },
      }),
      prisma.block.findFirst({
        where: { blockerId: author.id, blockedId: viewerId },
        select: { id: true },
      }),
    ]);
    if (blocked || blockedMe) return res.status(404).json({ message: "User not found" });

    if (author.isPrivate) {
      const follow = await prisma.follow.findFirst({
        where: { followerId: viewerId, followingId: author.id, status: "accepted" },
        select: { id: true },
      });
      if (!follow) return res.status(403).json({ message: "This account is private" });
    }
  }

  const newestStories = await prisma.story.findMany({
    where: {
      authorId: author.id,
      communityId,
      expiresAt: { gt: new Date() },
    },
    orderBy: RELATIONSHIP_ORDER,
    take: MAX_ACTIVE_STORIES_PER_AUTHOR + 1,
  });
  const { stories, truncated } = boundNewestStories(newestStories);
  const viewedRows = await prisma.storyView.findMany({
    where: { viewerId, storyId: { in: stories.map((s) => s.id) } },
    select: { storyId: true },
  });
  const viewedStoryIds = new Set(viewedRows.map((row) => row.storyId));

  res.json({
    author: serializeUser(author, { isSelf: author.id === viewerId }, authorMembership),
    stories: stories.map((s) => serializeStory(s, viewedStoryIds)),
    truncated,
  });
}

export async function viewStory(req, res) {
  const communityId = req.community.id;
  const story = await prisma.story.findFirst({
    where: { id: req.params.id, communityId },
    include: { author: true },
  });
  if (!story) return res.status(404).json({ message: "Story not found" });

  const viewerId = req.user.id;
  const authorId = story.author.id;
  if (authorId !== viewerId) {
    const [blocked, blockedMe] = await Promise.all([
      prisma.block.findFirst({
        where: { blockerId: viewerId, blockedId: authorId },
        select: { id: true },
      }),
      prisma.block.findFirst({
        where: { blockerId: authorId, blockedId: viewerId },
        select: { id: true },
      }),
    ]);
    if (blocked || blockedMe) return res.status(404).json({ message: "Story not found" });

    if (story.author.isPrivate) {
      const follow = await prisma.follow.findFirst({
        where: { followerId: viewerId, followingId: authorId, status: "accepted" },
        select: { id: true },
      });
      if (!follow) return res.status(403).json({ message: "This account is private" });
    }
  }

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId: story.id, viewerId } },
    create: { id: newId(), storyId: story.id, viewerId, expiresAt: story.expiresAt },
    update: { expiresAt: story.expiresAt },
  });

  res.json({ ok: true });
}

export async function deleteStory(req, res) {
  const story = await prisma.story.findFirst({
    where: { id: req.params.id, communityId: req.community.id },
  });
  if (!story) return res.status(404).json({ message: "Story not found" });
  if (story.authorId !== req.user.id) return res.status(403).json({ message: "Forbidden" });

  await prisma.story.delete({ where: { id: story.id } });
  await deleteCloudinaryAsset(story.mediaUrl);

  emitToCommunity(req.community.slug, REALTIME_EVENTS.storiesChanged, {
    communitySlug: req.community.slug,
    kind: "deleted",
    storyId: story.id,
  });
  res.json({ ok: true });
}
