import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { POST_INCLUDE, hydratePost, hydratePosts, serializeUser } from "../services/hydrate.js";
import { notify } from "../services/notify.js";
import { emitToCommunity, REALTIME_EVENTS } from "../services/realtime.js";
import { effectiveRole } from "../config/roles.js";
import { moderationFilter, canViewPost, isStaffRole } from "../services/moderationVisibility.js";
import { deleteCloudinaryAsset } from "../services/cloudinary.js";
import { isOwnMediaUrl } from "../services/r2.js";
import { isGiphyUrl } from "../services/giphy.js";
import { logStaffAction } from "../services/auditLog.js";
import { guardText } from "../services/textGuard.js";
import { fileAutoReport } from "../services/autoReport.js";
import { buildPostSnapshot, describeSnapshot } from "../services/reportSnapshot.js";
import { reportCreated } from "../services/staffEvents.js";
import { canAttachVideo, VIDEO_REQUIRES_VERIFICATION } from "../services/permissions.js";
import { sendCommunityPostToDiscord } from "../services/communityDiscordWebhook.js";
import { paginateCommentRows, parseCommentPageQuery } from "../utils/commentPagination.js";

function extractMentions(content) {
  const matches = content.match(/@([a-zA-Z0-9_]{3,20})/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

async function notifyMentions(content, post, actorId, communityId) {
  const usernames = extractMentions(content);
  if (!usernames.length) return;

  const mentionedUsers = await prisma.user.findMany({
    where: { username: { in: usernames } },
  });
  const memberIds = await prisma.communityMembership.findMany({
    where: {
      communityId,
      status: "active",
      userId: { in: mentionedUsers.map((u) => u.id) },
    },
    select: { userId: true },
  });
  const memberIdSet = new Set(memberIds.map((m) => m.userId));

  for (const mentionedUser of mentionedUsers) {
    if (!memberIdSet.has(mentionedUser.id)) continue;
    await notify({
      recipient: mentionedUser.id,
      actor: actorId,
      type: "mention",
      post: post.id,
      community: communityId,
    });
  }
}

async function generateUniqueShortId() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortId = String(Math.floor(10000000 + Math.random() * 90000000));
    const existing = await prisma.post.findFirst({ where: { shortId }, select: { id: true } });
    if (!existing) return shortId;
  }
  return undefined;
}

async function incrementPostsCount(userId, communityId, delta) {
  await prisma.communityMembership.update({
    where: { communityId_userId: { communityId, userId } },
    data: { postsCount: { increment: delta } },
  });
}

function emitPostChange(req, { kind, postId, parentPostId = null }) {
  emitToCommunity(req.community.slug, REALTIME_EVENTS.postsChanged, {
    communitySlug: req.community.slug,
    kind,
    postId: postId ? String(postId) : null,
    parentPostId: parentPostId ? String(parentPostId) : null,
  });
}

function postAuthorId(post) {
  return String(post.authorId ?? post.author?.id);
}

function commentCursorWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }],
  };
}

async function findPostInCommunity(id, communityId, include = POST_INCLUDE) {
  const where = isValidObjectId(id)
    ? { id, communityId }
    : { shortId: id, communityId };
  return prisma.post.findFirst({ where, include });
}

async function loadPost(postId) {
  return prisma.post.findUnique({ where: { id: postId }, include: POST_INCLUDE });
}

const POLL_VOTER_CAP = 500;
const CANDIDATE_CAP = 250;
const FOLLOW_FILTER_CAP = 5_000;

async function visibilityContext(viewerId, communityId, posts) {
  const authorIds = [...new Set(posts.map((post) => postAuthorId(post)))];
  const postIds = posts.map((post) => post.id);
  if (!authorIds.length) {
    return {
      excludeAuthors: new Set(),
      excludePosts: new Set(),
      followedIds: new Set(),
      privateAuthorIds: new Set(),
    };
  }

  const [blockedByMe, blockedMe, muted, notInterested, follows, privateAuthors] = await Promise.all([
    prisma.block.findMany({
      where: { blockerId: viewerId, blockedId: { in: authorIds } },
      select: { blockedId: true },
    }),
    prisma.block.findMany({
      where: { blockerId: { in: authorIds }, blockedId: viewerId },
      select: { blockerId: true },
    }),
    prisma.mute.findMany({
      where: { muterId: viewerId, mutedId: { in: authorIds } },
      select: { mutedId: true },
    }),
    prisma.notInterested.findMany({
      where: { userId: viewerId, postId: { in: postIds }, communityId },
      select: { postId: true },
    }),
    prisma.follow.findMany({
      where: {
        followerId: viewerId,
        followingId: { in: authorIds },
        status: "accepted",
      },
      select: { followingId: true },
    }),
    prisma.user.findMany({
      where: { id: { in: authorIds }, isPrivate: true },
      select: { id: true },
    }),
  ]);

  return {
    excludeAuthors: new Set(
      [...blockedByMe.map((row) => row.blockedId), ...blockedMe.map((row) => row.blockerId), ...muted.map((row) => row.mutedId)].map(
        String
      )
    ),
    excludePosts: new Set(notInterested.map((row) => row.postId)),
    followedIds: new Set(follows.map((row) => row.followingId)),
    privateAuthorIds: new Set(privateAuthors.map((user) => user.id)),
  };
}

export function filterFeedCandidates(posts, viewerId, context, mode, limit) {
  return posts
    .filter((post) => {
      const authorId = postAuthorId(post);
      if (context.excludeAuthors.has(authorId) || context.excludePosts.has(post.id)) return false;
      if (mode === "following") return authorId === viewerId || context.followedIds.has(authorId);
      return !context.privateAuthorIds.has(authorId) || authorId === viewerId || context.followedIds.has(authorId);
    })
    .slice(0, limit);
}

function buildPoll(poll) {
  if (!poll) return undefined;

  const options = (poll.options || []).map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean);
  if (options.length < 2 || options.length > 4) {
    throw Object.assign(new Error("Poll needs 2 to 4 options"), { status: 400 });
  }
  if (options.some((o) => o.length > 80)) {
    throw Object.assign(new Error("Poll option too long"), { status: 400 });
  }

  const durationMinutes = Math.min(Math.max(Number(poll.durationMinutes) || 1440, 5), 10080);

  const imageUrl = poll.imageUrl || undefined;
  if (imageUrl && !isOwnMediaUrl(imageUrl)) {
    throw Object.assign(new Error("Invalid poll image"), { status: 400 });
  }

  return {
    options: options.map((text) => ({ text, votesCount: 0 })),
    expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export async function createPost(req, res) {
  const { content = "", gifUrl, mediaUrl, mediaType, parentPost, quotedPost, poll } = req.body;
  const communityId = req.community.id;

  if (mediaUrl && !["image", "video"].includes(mediaType)) {
    return res.status(400).json({ message: "Invalid media type" });
  }
  if (mediaUrl && mediaType === "video" && !canAttachVideo(req.user, req.membership)) {
    return res.status(403).json({ code: "video_requires_verification", message: VIDEO_REQUIRES_VERIFICATION });
  }
  if (mediaUrl && !isOwnMediaUrl(mediaUrl)) {
    return res.status(400).json({ message: "Invalid media URL" });
  }
  if (gifUrl && !isGiphyUrl(gifUrl)) {
    return res.status(400).json({ message: "Invalid GIF URL" });
  }

  let pollDoc;
  try {
    pollDoc = buildPoll(poll);
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }

  if (!content.trim() && !gifUrl && !mediaUrl && !quotedPost && !pollDoc) {
    return res.status(400).json({ message: "Post cannot be empty" });
  }
  if (content.length > 500) return res.status(400).json({ message: "Post too long" });

  let parent = null;
  if (parentPost) {
    parent = await prisma.post.findFirst({ where: { id: parentPost, communityId } });
    if (!parent || parent.deleted) return res.status(404).json({ message: "Post not found" });
  }

  let quoted = null;
  if (quotedPost) {
    quoted = await prisma.post.findFirst({ where: { id: quotedPost, communityId } });
    if (!quoted || quoted.deleted) return res.status(404).json({ message: "Post not found" });
  }

  const guard = await guardText(content, {
    authorId: req.user.id,
    community: communityId,
    snapshotLabel: parent ? "comment" : "post",
  });
  if (guard.blocked) {
    return res.status(400).json({ code: "content_blocked", message: guard.message });
  }

  const hasMedia = !!(mediaUrl || gifUrl || pollDoc?.imageUrl);
  const moderationStatus = guard.flagged ? "flagged" : !guard.failed && !hasMedia ? "clear" : "pending";

  const post = await prisma.post.create({
    data: {
      id: newId(),
      authorId: req.user.id,
      communityId,
      shortId: await generateUniqueShortId(),
      content: content.trim(),
      gifUrl: gifUrl || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? mediaType : null,
      poll: pollDoc,
      parentPostId: parent ? parent.id : null,
      quotedPostId: quoted ? quoted.id : null,
      moderationStatus,
      moderationTextClear: !guard.failed,
    },
  });

  if (guard.flagged) {
    await fileAutoReport({
      community: communityId,
      targetType: "post",
      targetId: post.id,
      snapshot: post.content,
      category: guard.category,
      rationale: guard.rationale,
    });
    await notify({
      recipient: post.authorId,
      actor: post.authorId,
      type: "content_flagged",
      post: post.id,
      community: communityId,
      allowSelf: true,
    });
  }

  await incrementPostsCount(req.user.id, communityId, 1);
  await prisma.community.update({
    where: { id: communityId },
    data: { postCount: { increment: 1 } },
  });
  req.community.postCount += 1;

  if (parent) {
    await prisma.post.update({
      where: { id: parent.id },
      data: { commentsCount: { increment: 1 } },
    });
    await notify({
      recipient: parent.authorId,
      actor: req.user.id,
      type: "comment",
      post: parent.id,
      community: communityId,
    });
  }

  if (quoted) {
    await notify({
      recipient: quoted.authorId,
      actor: req.user.id,
      type: "quote",
      post: quoted.id,
      community: communityId,
    });
  }

  await notifyMentions(post.content, post, req.user.id, communityId);

  const populated = await loadPost(post.id);
  const hydrated = await hydratePost(populated, req.user.id, communityId);
  emitPostChange(req, {
    kind: parent ? "comment" : "created",
    postId: post.id,
    parentPostId: parent?.id || null,
  });

  if (!parent) {
    sendCommunityPostToDiscord({ community: req.community, post: populated }).catch(() => {});
  }

  res.status(201).json({ post: hydrated });
}

export async function getFeed(req, res) {
  const mode = req.query.mode === "following" ? "following" : "forYou";
  const requestedLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 20;
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && Number.isNaN(before.getTime())) {
    return res.status(400).json({ message: "Invalid feed cursor" });
  }

  const viewerId = req.user?.id ?? null;
  const communityId = req.community.id;
  const isStaff = req.user && req.membership
    ? isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role)
    : false;

  const where = {
    communityId,
    parentPostId: null,
    deleted: false,
    ...moderationFilter(viewerId, isStaff),
    ...(before ? { createdAt: { lt: before } } : {}),
  };

  if (mode === "following") {
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId, status: "accepted" },
      select: { followingId: true },
      take: FOLLOW_FILTER_CAP + 1,
    });
    if (follows.length <= FOLLOW_FILTER_CAP) {
      where.authorId = { in: [...follows.map((follow) => follow.followingId), viewerId] };
    }
  }

  if (mode === "forYou") where.repostOfId = null;

  const candidates = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_CAP,
  });
  const ctx = await visibilityContext(viewerId, communityId, candidates);
  const visibleIds = filterFeedCandidates(candidates, viewerId, ctx, mode, limit).map((post) => post.id);
  const visible =
    visibleIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: visibleIds } },
          include: POST_INCLUDE,
          orderBy: { createdAt: "desc" },
        })
      : [];
  const visibleById = new Map(visible.map((post) => [post.id, post]));
  const ordered = visibleIds.map((id) => visibleById.get(id)).filter(Boolean);

  const oldest = ordered[ordered.length - 1];
  const hasMore = ordered.length >= limit && !!oldest;

  res.json({
    posts: await hydratePosts(ordered, viewerId, communityId),
    hasMore,
    nextCursor: hasMore ? new Date(oldest.createdAt).toISOString() : null,
  });
}

export async function getPost(req, res) {
  const { id } = req.params;
  const viewerId = req.user?.id ?? null;
  const communityId = req.community.id;
  const isStaff = req.user && req.membership
    ? isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role)
    : false;
  const post = await findPostInCommunity(id, communityId);
  if (!post || post.deleted || !canViewPost(post, viewerId, isStaff)) {
    return res.status(404).json({ message: "Post not found" });
  }
  res.json({ post: await hydratePost(post, viewerId, communityId) });
}

export async function getComments(req, res) {
  const { id } = req.params;
  const viewerId = req.user?.id ?? null;
  const communityId = req.community.id;
  const isStaff = req.user && req.membership
    ? isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role)
    : false;
  let pagination;
  try {
    pagination = parseCommentPageQuery(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const parent = await findPostInCommunity(id, communityId, undefined);
  if (!parent || parent.deleted || !canViewPost(parent, viewerId, isStaff)) {
    return res.json({ posts: [], hasMore: false, nextCursor: null });
  }

  const rows = await prisma.post.findMany({
    where: {
      parentPostId: parent.id,
      deleted: false,
      ...moderationFilter(viewerId, isStaff),
      ...commentCursorWhere(pagination.cursor),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: pagination.limit + 1,
    include: POST_INCLUDE,
  });
  const { page, hasMore, nextCursor } = paginateCommentRows(rows, pagination.limit);
  res.json({ posts: await hydratePosts(page, viewerId, communityId), hasMore, nextCursor });
}

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function editPost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });
  if (post.authorId !== req.user.id) return res.status(403).json({ message: "Forbidden" });

  if (Date.now() - post.createdAt.getTime() > EDIT_WINDOW_MS) {
    return res.status(400).json({ message: "This post can no longer be edited" });
  }

  const content = String(req.body.content || "");
  if (!content.trim() && !post.gifUrl && !post.mediaUrl && !post.quotedPostId && !post.poll) {
    return res.status(400).json({ message: "Post cannot be empty" });
  }
  if (content.length > 500) return res.status(400).json({ message: "Post too long" });

  await prisma.post.update({
    where: { id: post.id },
    data: {
      content: content.trim(),
      editedAt: new Date(),
      moderationStatus: "pending",
      moderationAttempts: 0,
      moderationTextClear: false,
    },
  });

  const populated = await loadPost(post.id);
  res.json({ post: await hydratePost(populated, req.user.id, req.community.id) });
  emitPostChange(req, { kind: "updated", postId: post.id, parentPostId: post.parentPostId || null });
}

export async function pinPost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });
  if (post.authorId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  if (post.parentPostId) return res.status(400).json({ message: "Replies can't be pinned" });

  await prisma.communityMembership.update({
    where: { id: req.membership.id },
    data: { pinnedPostId: post.id },
  });
  req.membership.pinnedPostId = post.id;

  emitPostChange(req, { kind: "updated", postId: post.id });
  res.json({ ok: true });
}

export async function unpinPost(req, res) {
  if (req.membership.pinnedPostId === req.params.id) {
    await prisma.communityMembership.update({
      where: { id: req.membership.id },
      data: { pinnedPostId: null },
    });
    req.membership.pinnedPostId = null;
  }

  emitPostChange(req, { kind: "updated", postId: req.params.id });
  res.json({ ok: true });
}

export async function deletePost(req, res) {
  const post = await prisma.post.findFirst({
    where: { id: req.params.id, communityId: req.community.id },
    include: { author: true },
  });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });

  const userRole = effectiveRole(req.user);
  const isOwner = post.authorId === req.user.id;
  const isCommunityStaff = ["owner", "staff"].includes(req.membership.role);
  const isGlobalStaff = ["staff", "admin", "developer", "owner"].includes(userRole);
  if (!isOwner && !isCommunityStaff && !isGlobalStaff) return res.status(403).json({ message: "Forbidden" });

  await prisma.post.update({
    where: { id: post.id },
    data: { deleted: true },
  });

  if (post.parentPostId) {
    await prisma.post.updateMany({
      where: { id: post.parentPostId, commentsCount: { gt: 0 } },
      data: { commentsCount: { decrement: 1 } },
    });
  }

  if (post.mediaUrl) await deleteCloudinaryAsset(post.mediaUrl);

  if (!isOwner && (isCommunityStaff || isGlobalStaff)) {
    await logStaffAction({
      staffId: req.user.id,
      action: "delete_post",
      targetType: "post",
      targetId: post.id,
      targetUser: post.author?.id,
      targetLabel: `@${post.author?.username || "unknown"}`,
      community: isCommunityStaff ? req.community.id : null,
      meta: { source: "direct", content: post.content },
    });
  }

  if (isOwner) {
    await incrementPostsCount(req.user.id, req.community.id, -1);
    if (req.membership.pinnedPostId === post.id) {
      await prisma.communityMembership.update({
        where: { id: req.membership.id },
        data: { pinnedPostId: null },
      });
      req.membership.pinnedPostId = null;
    }
  }

  emitPostChange(req, {
    kind: "deleted",
    postId: post.id,
    parentPostId: post.parentPostId || null,
  });
  res.json({ ok: true });
}

export async function votePoll(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted || !post.poll) return res.status(404).json({ message: "Post not found" });
  if (new Date(post.poll.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ message: "This poll has ended" });
  }

  const optionIndex = Number(req.body.optionIndex);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= post.poll.options.length) {
    return res.status(400).json({ message: "Invalid poll option" });
  }

  const existing = await prisma.pollVote.findUnique({
    where: { userId_postId: { userId: req.user.id, postId: post.id } },
  });
  if (existing) return res.status(400).json({ message: "You already voted on this poll" });

  await prisma.pollVote.create({
    data: {
      id: newId(),
      userId: req.user.id,
      postId: post.id,
      communityId: req.community.id,
      optionIndex,
    },
  });

  await syncPollCounts(post);

  const populated = await loadPost(post.id);
  const hydrated = await hydratePost(populated, req.user.id, req.community.id);
  emitPostChange(req, { kind: "engagement", postId: post.id });
  res.json({ post: hydrated });
}

async function syncPollCounts(post) {
  const grouped = await prisma.pollVote.groupBy({
    by: ["optionIndex"],
    where: { postId: post.id },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((row) => [row.optionIndex, row._count._all]));
  await prisma.post.update({
    where: { id: post.id },
    data: {
      poll: {
        ...post.poll,
        options: post.poll.options.map((option, index) => ({
          ...option,
          votesCount: counts.get(index) || 0,
        })),
      },
    },
  });
}

export async function removePollVote(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted || !post.poll) return res.status(404).json({ message: "Post not found" });
  if (new Date(post.poll.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ message: "This poll has ended" });
  }

  const existing = await prisma.pollVote.findUnique({
    where: { userId_postId: { userId: req.user.id, postId: post.id } },
  });
  if (!existing) return res.status(400).json({ message: "You haven't voted on this poll" });

  await prisma.pollVote.delete({ where: { id: existing.id } });

  await syncPollCounts(post);

  const populated = await loadPost(post.id);
  const hydrated = await hydratePost(populated, req.user.id, req.community.id);
  emitPostChange(req, { kind: "engagement", postId: post.id });
  res.json({ post: hydrated });
}

export async function getPollVoters(req, res) {
  const { id } = req.params;
  const viewerId = req.user.id;
  const communityId = req.community.id;
  const isStaff = isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role);

  const post = await findPostInCommunity(id, communityId, undefined);
  if (!post || post.deleted || !post.poll || !canViewPost(post, viewerId, isStaff)) {
    return res.status(404).json({ message: "Poll not found" });
  }

  const votes = await prisma.pollVote.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    take: POLL_VOTER_CAP,
    include: { user: true },
  });

  const voterIds = votes.map((v) => v.user?.id).filter(Boolean);
  const memberships = await prisma.communityMembership.findMany({
    where: { communityId, userId: { in: voterIds } },
  });
  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));

  const options = post.poll.options.map((option, index) => ({
    index,
    text: option.text,
    votesCount: option.votesCount,
    voters: [],
  }));

  for (const vote of votes) {
    const option = options[vote.optionIndex];
    if (!option || !vote.user?.id) continue;
    const dto = serializeUser(vote.user, {}, membershipMap.get(vote.user.id));
    if (dto) option.voters.push(dto);
  }

  res.json({ options, truncated: votes.length >= POLL_VOTER_CAP });
}

export async function likePost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });

  const target = post.repostOfId ? await prisma.post.findUnique({ where: { id: post.repostOfId } }) : post;

  try {
    await prisma.like.create({
      data: {
        id: newId(),
        userId: req.user.id,
        postId: target.id,
        communityId: req.community.id,
      },
    });
    await prisma.post.update({
      where: { id: target.id },
      data: { likesCount: { increment: 1 } },
    });
    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        recipientId: target.authorId,
        actorId: req.user.id,
        type: "like",
        postId: target.id,
      },
    });
    if (!alreadyNotified) {
      await notify({
        recipient: target.authorId,
        actor: req.user.id,
        type: "like",
        post: target.id,
        community: req.community.id,
      });
    }
  } catch {}

  const hydrated = await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id);
  emitPostChange(req, { kind: "engagement", postId: target.id });
  res.json({ post: hydrated });
}

export async function unlikePost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });

  const target = post.repostOfId ? await prisma.post.findUnique({ where: { id: post.repostOfId } }) : post;

  const removed = await prisma.like.deleteMany({
    where: { userId: req.user.id, postId: target.id },
  });
  if (removed.count > 0) {
    const current = await prisma.post.findUnique({ where: { id: target.id }, select: { likesCount: true } });
    await prisma.post.update({
      where: { id: target.id },
      data: { likesCount: Math.max(0, (current?.likesCount || 0) - 1) },
    });
  }

  const hydrated = await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id);
  emitPostChange(req, { kind: "engagement", postId: target.id });
  res.json({ post: hydrated });
}

export async function repost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });

  const originalId = post.repostOfId || post.id;
  const original = await prisma.post.findUnique({ where: { id: originalId } });

  const existing = await prisma.post.findFirst({
    where: { authorId: req.user.id, repostOfId: originalId },
  });
  if (existing) {
    return res.json({ post: await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id) });
  }

  await prisma.post.create({
    data: {
      id: newId(),
      authorId: req.user.id,
      communityId: req.community.id,
      content: "",
      repostOfId: originalId,
      moderationStatus: "clear",
    },
  });
  await prisma.post.update({
    where: { id: originalId },
    data: { repostsCount: { increment: 1 } },
  });
  await incrementPostsCount(req.user.id, req.community.id, 1);

  const alreadyNotified = await prisma.notification.findFirst({
    where: {
      recipientId: original.authorId,
      actorId: req.user.id,
      type: "repost",
      postId: original.id,
    },
  });
  if (!alreadyNotified) {
    await notify({
      recipient: original.authorId,
      actor: req.user.id,
      type: "repost",
      post: original.id,
      community: req.community.id,
    });
  }

  const hydrated = await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id);
  emitPostChange(req, { kind: "engagement", postId: originalId });
  res.status(201).json({ post: hydrated });
}

export async function unrepost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });

  const originalId = post.repostOfId || post.id;
  const removed = await prisma.post.findFirst({
    where: { authorId: req.user.id, repostOfId: originalId },
  });
  if (removed) {
    await prisma.post.delete({ where: { id: removed.id } });
    const original = await prisma.post.findUnique({ where: { id: originalId } });
    if (original) {
      await prisma.post.update({
        where: { id: originalId },
        data: { repostsCount: Math.max(0, original.repostsCount - 1) },
      });
    }
    await incrementPostsCount(req.user.id, req.community.id, -1);
  }

  const hydrated = await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id);
  emitPostChange(req, { kind: "engagement", postId: originalId });
  res.json({ post: hydrated });
}

export async function markNotInterested(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post) return res.status(404).json({ message: "Post not found" });

  await prisma.notInterested.upsert({
    where: { userId_postId: { userId: req.user.id, postId: post.id } },
    create: {
      id: newId(),
      userId: req.user.id,
      postId: post.id,
      communityId: req.community.id,
    },
    update: {},
  });

  res.json({ ok: true });
}

export async function bookmarkPost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post || post.deleted) return res.status(404).json({ message: "Post not found" });

  const target = post.repostOfId || post.id;

  await prisma.bookmark.upsert({
    where: { userId_postId: { userId: req.user.id, postId: target } },
    create: {
      id: newId(),
      userId: req.user.id,
      postId: target,
      communityId: req.community.id,
    },
    update: {},
  });

  res.json({ post: await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id) });
}

export async function unbookmarkPost(req, res) {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, communityId: req.community.id } });
  if (!post) return res.status(404).json({ message: "Post not found" });

  const target = post.repostOfId || post.id;
  await prisma.bookmark.deleteMany({
    where: { userId: req.user.id, postId: target },
  });

  res.json({ post: await hydratePost(await loadPost(req.params.id), req.user.id, req.community.id) });
}

export async function listBookmarks(req, res) {
  const viewerId = req.user.id;
  const communityId = req.community.id;
  const isStaff = isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role);
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user.id, communityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const posts = await prisma.post.findMany({
    where: {
      id: { in: bookmarks.map((b) => b.postId) },
      deleted: false,
      ...moderationFilter(viewerId, isStaff),
    },
    include: POST_INCLUDE,
  });

  const postMap = new Map(posts.map((p) => [p.id, p]));
  const ordered = bookmarks.map((b) => postMap.get(b.postId)).filter(Boolean);

  res.json({ posts: await hydratePosts(ordered, req.user.id, communityId) });
}

export async function reportPost(req, res) {
  const post = await prisma.post.findFirst({
    where: { id: req.params.id, communityId: req.community.id },
    include: { author: true },
  });
  if (!post) return res.status(404).json({ message: "Post not found" });

  const snapshot = buildPostSnapshot(post, post.author);

  const report = await prisma.report.create({
    data: {
      id: newId(),
      reporterId: req.user.id,
      communityId: req.community.id,
      targetType: "post",
      targetId: post.id,
      contentSnapshot: describeSnapshot(snapshot),
      snapshot,
      reason: String(req.body.reason || "unspecified").trim().slice(0, 100),
      details: String(req.body.details || "").trim().slice(0, 500),
    },
  });

  reportCreated(report);

  res.status(201).json({ report: { id: report.id } });
}
