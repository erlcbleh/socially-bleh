import { prisma } from "../db/prisma.js";
import { deleteCloudinaryAsset } from "./cloudinary.js";

export const PURGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PURGE_WINDOW_HOURS = Object.freeze({
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "3d": 72,
  "7d": 168,
});

export const PURGE_WINDOW_IDS = Object.freeze([...Object.keys(PURGE_WINDOW_HOURS), "all"]);

function tally(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function purgePosts(userId, cutoff) {
  const posts = await prisma.post.findMany({
    where: {
      authorId: userId,
      deleted: false,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    },
    select: { id: true, communityId: true, parentPostId: true, mediaUrl: true, repostOfId: true, quotedPostId: true },
  });

  if (!posts.length) return { posts: 0, replies: 0, reposts: 0, quotes: 0 };

  const postIds = posts.map((p) => p.id);
  await prisma.post.updateMany({ where: { id: { in: postIds } }, data: { deleted: true } });

  const parentCounts = tally(posts, (p) => p.parentPostId);
  for (const [parentId, count] of parentCounts) {
    await prisma.post.update({
      where: { id: parentId },
      data: { commentsCount: { decrement: count } },
    });
  }

  const communityCounts = tally(posts, (p) => p.communityId);
  for (const [communityId, count] of communityCounts) {
    await prisma.communityMembership.update({
      where: { communityId_userId: { communityId, userId } },
      data: { postsCount: { decrement: count } },
    });
    await prisma.community.update({
      where: { id: communityId },
      data: { postCount: { decrement: count } },
    });
  }

  await prisma.communityMembership.updateMany({
    where: { userId, pinnedPostId: { in: postIds } },
    data: { pinnedPostId: null },
  });

  for (const post of posts) {
    if (post.mediaUrl) await deleteCloudinaryAsset(post.mediaUrl).catch(() => {});
  }

  return {
    posts: posts.filter((p) => !p.parentPostId && !p.repostOfId).length,
    replies: posts.filter((p) => p.parentPostId).length,
    reposts: posts.filter((p) => p.repostOfId).length,
    quotes: posts.filter((p) => p.quotedPostId && !p.parentPostId).length,
  };
}

async function purgeMessages(userId, cutoff) {
  const messages = await prisma.message.findMany({
    where: {
      senderId: userId,
      deletedAt: null,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    },
    select: { id: true, conversationId: true, mediaUrl: true },
  });

  if (!messages.length) return 0;

  const messageIds = messages.map((m) => m.id);
  await prisma.messageReaction.deleteMany({ where: { messageId: { in: messageIds } } });
  await prisma.message.updateMany({
    where: { id: { in: messageIds } },
    data: {
      deletedAt: new Date(),
      content: "",
      mediaUrl: null,
      gifUrl: null,
      sharedPostId: null,
      sharedStoryId: null,
    },
  });

  for (const message of messages) {
    if (message.mediaUrl) await deleteCloudinaryAsset(message.mediaUrl).catch(() => {});
  }

  const conversationIds = [...new Set(messages.map((m) => m.conversationId).filter(Boolean))];

  for (const conversationId of conversationIds) {
    const last = await prisma.message.findFirst({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { content: true, sharedPostId: true, mediaUrl: true, gifUrl: true, createdAt: true },
    });

    const preview = last
      ? last.content || (last.sharedPostId ? "Shared a post" : last.mediaUrl ? "Photo" : last.gifUrl ? "GIF" : "")
      : "";

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageText: preview, lastMessageAt: last ? last.createdAt : null },
    });
  }

  return messages.length;
}

export async function purgeRecentContent(userId, windowMs = PURGE_WINDOW_MS) {
  const cutoff = new Date(Date.now() - windowMs);

  const { posts, replies, reposts, quotes } = await purgePosts(userId, cutoff);
  const messages = await purgeMessages(userId, cutoff);

  return { posts, replies, reposts, quotes, messages, windowHours: Math.round(windowMs / (60 * 60 * 1000)) };
}

export async function purgeAllContent(userId) {
  const { posts, replies, reposts, quotes } = await purgePosts(userId, null);
  const messages = await purgeMessages(userId, null);

  return { posts, replies, reposts, quotes, messages };
}
