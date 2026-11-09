import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { serializeUser, hydratePost, hydratePosts, POST_INCLUDE } from "../services/hydrate.js";
import { effectiveRole } from "../config/roles.js";
import { canViewPost, isStaffRole } from "../services/moderationVisibility.js";
import { parseCloudinaryUrl } from "../services/cloudinary.js";
import { isOwnMediaUrl } from "../services/r2.js";
import { isGiphyUrl } from "../services/giphy.js";
import { guardText } from "../services/textGuard.js";
import { moderateMessageInBackground } from "../services/messageModeration.js";
import { fileAutoReport } from "../services/autoReport.js";
import { buildMessageSnapshot, describeSnapshot } from "../services/reportSnapshot.js";
import { reportCreated } from "../services/staffEvents.js";
import { areFriends } from "../services/friends.js";
import {
  messageCursorFilter,
  paginateMessageRows,
  parseMessagePageParams,
} from "../services/messagePagination.js";
import {
  conversationCursorFilter,
  getConversationUnreadStats,
  getUnreadSummary,
  paginateConversationRows,
  parseConversationPageParams,
} from "../services/conversationPagination.js";
import { emitToUsers, REALTIME_EVENTS } from "../services/realtime.js";
import { sendPushToUser } from "../services/webpush.js";

const MAX_GROUP_PARTICIPANTS = 50;
const DELIVERY_CONVERSATION_BATCH_SIZE = 100;

const PARTICIPANT_INCLUDE = {
  participants: { include: { user: true } },
};

const MESSAGE_INCLUDE = {
  reactions: true,
  reads: { select: { userId: true } },
  deliveries: { select: { userId: true } },
};

function serializeStoryRef(story) {
  return {
    id: story.id,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption || "",
  };
}

function participantIds(conversation) {
  return conversation.participants.map((participant) =>
    String(participant.userId ?? participant.user?.id ?? participant)
  );
}

function emitConversationChange(req, conversation, kind, recipients = participantIds(conversation)) {
  emitToUsers(recipients, REALTIME_EVENTS.messagesChanged, {
    communitySlug: req.community.slug,
    conversationId: conversation.id,
    kind,
    threadType: conversation.isGroup ? "group" : "dm",
  });
}

async function findActiveMember(username) {
  const target = await prisma.user.findFirst({
    where: { username: String(username || "").toLowerCase() },
  });
  if (!target) return null;
  return target;
}

async function findExistingConversation(userId, targetId) {
  const candidates = await prisma.conversation.findMany({
    where: {
      isGroup: false,
      participants: {
        every: { userId: { in: [userId, targetId] } },
        some: { userId },
      },
      AND: [{ participants: { some: { userId: targetId } } }],
    },
    include: PARTICIPANT_INCLUDE,
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });

  return candidates.find((conversation) => conversation.participants.length === 2) || null;
}

async function loadGroupConversation(req) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, isGroup: true },
    include: PARTICIPANT_INCLUDE,
  });
  if (!conversation) return null;
  const isParticipant = conversation.participants.some((p) => p.userId === req.user.id);
  return isParticipant ? conversation : null;
}

async function serializeGroup(conversation, communityId, viewerId) {
  const participants = conversation.participants.map((p) => p.user);
  const participantUserIds = participants.map((p) => p.id);
  const memberships = await prisma.communityMembership.findMany({
    where: { communityId, userId: { in: participantUserIds } },
  });
  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));

  return {
    id: conversation.id,
    isGroup: true,
    name: conversation.name || "",
    iconUrl: conversation.iconUrl || "",
    createdBy: conversation.createdById || null,
    isCreator: !!conversation.createdById && conversation.createdById === viewerId,
    participants: participants.map((p) => serializeUser(p, {}, membershipMap.get(p.id))),
    lastMessageText: conversation.lastMessageText,
    lastMessageAt: conversation.lastMessageAt,
  };
}

async function markDelivered(conversationIds, userId) {
  if (!conversationIds.length) return;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: userId },
      deliveries: { none: { userId } },
    },
    select: { id: true },
  });
  if (!messages.length) return;

  await prisma.messageDelivery.createMany({
    data: messages.map((message) => ({ messageId: message.id, userId })),
    skipDuplicates: true,
  });
}

async function markCommunityDelivered(userId) {
  let skip = 0;

  while (true) {
    const batch = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
      skip,
      take: DELIVERY_CONVERSATION_BATCH_SIZE,
    });
    if (!batch.length) break;

    await markDelivered(
      batch.map((row) => row.conversationId),
      userId
    );
    if (batch.length < DELIVERY_CONVERSATION_BATCH_SIZE) break;
    skip += DELIVERY_CONVERSATION_BATCH_SIZE;
  }
}

async function markReadAndDelivered(conversationId, userId) {
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      senderId: { not: userId },
      reads: { none: { userId } },
    },
    select: { id: true },
  });
  if (!messages.length) return;

  const rows = messages.map((message) => ({ messageId: message.id, userId }));
  await prisma.messageRead.createMany({ data: rows, skipDuplicates: true });
  await prisma.messageDelivery.createMany({ data: rows, skipDuplicates: true });
}

export function hasUnreadIncoming(messages, userId) {
  const viewerId = String(userId);
  return messages.some(
    (message) =>
      !message.deletedAt &&
      message.senderId !== viewerId &&
      message.moderationState !== "pending" &&
      message.moderationState !== "blocked" &&
      !(message.reads || []).some((reader) => String(reader.userId ?? reader) === viewerId)
  );
}

async function findMessagePage(conversationId, pagination, viewerId) {
  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      OR: [{ senderId: viewerId }, { moderationState: { notIn: ["pending", "blocked"] } }],
      ...messageCursorFilter(pagination.cursor),
    },
    include: MESSAGE_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
  });

  return paginateMessageRows(rows, pagination.limit);
}

function messageStatus(message, otherParticipantIds) {
  if (!otherParticipantIds.length) return "sent";

  const readBy = new Set((message.reads || []).map((row) => String(row.userId ?? row)));
  if (otherParticipantIds.every((id) => readBy.has(id))) return "read";

  const deliveredTo = new Set((message.deliveries || []).map((row) => String(row.userId ?? row)));
  if (otherParticipantIds.every((id) => deliveredTo.has(id))) return "delivered";

  return "sent";
}

async function hasBlocked(blockerId, blockedId) {
  return !!(await prisma.block.findFirst({
    where: { blockerId: String(blockerId), blockedId: String(blockedId) },
    select: { id: true },
  }));
}

async function serializeOther(otherUser, viewerId, communityId) {
  if (!otherUser) return { dto: null, blockedByOther: false };
  const blockedByOther = await hasBlocked(otherUser.id, viewerId);
  const membership = await prisma.communityMembership.findUnique({
    where: {
      communityId_userId: { communityId, userId: otherUser.id },
    },
  });
  const dto = serializeUser(otherUser, {}, membership);
  if (blockedByOther) {
    dto.avatarUrl = "";
    dto.bannerUrl = "";
    dto.bio = "";
  }
  return { dto, blockedByOther };
}

function previewText(content, sharedPostDoc, mediaUrl, gifUrl) {
  return content || (sharedPostDoc ? "Shared a post" : mediaUrl ? "Photo" : gifUrl ? "GIF" : content);
}

function deletedUserStub(conversationId) {
  const tail = String(conversationId || "").slice(-6);
  const suffix = /^[0-9a-f]+$/i.test(tail) ? parseInt(tail, 16) : Math.abs(hashCode(tail));
  const numeric = String(suffix || Date.now()).padStart(6, "0");
  return {
    id: `deleted:${conversationId}`,
    username: `user${numeric}`,
    displayName: "Deleted user",
    avatarUrl: "",
    bannerUrl: "",
    bio: "",
    isDeleted: true,
    isVerified: false,
    status: "deleted",
    accountKind: "user",
    role: "user",
    badges: [],
    equippedBadges: [],
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    createdAt: null,
  };
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

export async function listConversations(req, res) {
  const communityId = req.community.id;
  const viewerId = req.user.id;

  let pagination;
  try {
    pagination = parseConversationPageParams(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const rows = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: viewerId } },
      ...conversationCursorFilter(pagination.cursor),
    },
    include: PARTICIPANT_INCLUDE,
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
  });
  const { page: conversations, hasMore, nextCursor } = paginateConversationRows(rows, pagination.limit);

  if (!conversations.length) {
    return res.json({ conversations: [], hasMore: false, nextCursor: null });
  }

  const conversationIds = conversations.map((c) => c.id);
  const allParticipantIds = [
    ...new Set(conversations.flatMap((c) => c.participants.map((p) => p.userId))),
  ];

  const [{ unreadMap, hasUndelivered }, memberships, blockers] = await Promise.all([
    getConversationUnreadStats(conversationIds, viewerId),
    prisma.communityMembership.findMany({
      where: { communityId, userId: { in: allParticipantIds } },
    }),
    prisma.block.findMany({
      where: { blockedId: viewerId, blockerId: { in: allParticipantIds } },
      select: { blockerId: true },
    }),
  ]);

  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));
  const blockedBySet = new Set(blockers.map((b) => b.blockerId));

  if (hasUndelivered) {
    await markDelivered(conversationIds, viewerId);
  }

  const results = conversations.map((c) => {
    const unreadCount = unreadMap.get(c.id) || 0;
    const otherParticipants = c.participants.filter((p) => p.userId !== viewerId).map((p) => p.user);

    if (c.isGroup) {
      return {
        id: c.id,
        isGroup: true,
        otherUser: null,
        groupName: c.name || otherParticipants.map((p) => p.displayName || p.username).join(", "),
        groupParticipants: otherParticipants.map((p) => serializeUser(p, {}, membershipMap.get(p.id))),
        blockedByOther: false,
        lastMessageText: c.lastMessageText,
        lastMessageAt: c.lastMessageAt,
        unreadCount,
      };
    }

    const other = otherParticipants[0] || null;
    let dto = null;
    let blockedByOther = false;

    if (other) {
      blockedByOther = blockedBySet.has(other.id);
      dto = serializeUser(other, {}, membershipMap.get(other.id));
      if (blockedByOther) {
        dto.avatarUrl = "";
        dto.bannerUrl = "";
        dto.bio = "";
      }
    } else {
      dto = deletedUserStub(c.id);
    }

    return {
      id: c.id,
      isGroup: false,
      otherUser: dto,
      groupName: null,
      groupParticipants: null,
      blockedByOther,
      lastMessageText: c.lastMessageText,
      lastMessageAt: c.lastMessageAt,
      unreadCount,
    };
  });

  res.json({ conversations: results, hasMore, nextCursor });
}

export async function getConversation(req, res) {
  const communityId = req.community.id;
  const target = await findActiveMember(req.params.username);
  if (!target) return res.status(404).json({ message: "User not found" });

  const conversation = await findExistingConversation(req.user.id, target.id);
  const { dto, blockedByOther } = await serializeOther(target, req.user.id, communityId);

  res.json({ id: conversation ? conversation.id : null, otherUser: dto, blockedByOther });
}

export async function getMessages(req, res) {
  const communityId = req.community.id;
  const target = await findActiveMember(req.params.username);
  if (!target) return res.status(404).json({ message: "User not found" });

  let pagination;
  try {
    pagination = parseMessagePageParams(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const conversation = await findExistingConversation(req.user.id, target.id);
  if (!conversation) return res.json({ messages: [], nextCursor: null });

  const { messages, nextCursor } = await findMessagePage(conversation.id, pagination, req.user.id);

  if (hasUnreadIncoming(messages, req.user.id)) {
    await markReadAndDelivered(conversation.id, req.user.id);
  }

  const viewerId = req.user.id;
  const sharedPostIds = messages.filter((m) => m.sharedPostId).map((m) => m.sharedPostId);
  const sharedPostDocs = sharedPostIds.length
    ? await prisma.post.findMany({
        where: { id: { in: sharedPostIds }, deleted: false },
        include: POST_INCLUDE,
      })
    : [];
  const hydratedSharedPosts = await hydratePosts(sharedPostDocs, viewerId, communityId);
  const sharedPostMap = new Map(hydratedSharedPosts.map((p) => [p.id, p]));

  const sharedStoryIds = messages.filter((m) => m.sharedStoryId).map((m) => m.sharedStoryId);
  const sharedStoryDocs = sharedStoryIds.length
    ? await prisma.story.findMany({ where: { id: { in: sharedStoryIds } } })
    : [];
  const sharedStoryMap = new Map(sharedStoryDocs.map((s) => [s.id, serializeStoryRef(s)]));

  const otherParticipantIds = [target.id];

  res.json({
    messages: messages.map((m) => {
      const hasSharedPostRef = !!m.sharedPostId;
      const sharedPost = hasSharedPostRef ? sharedPostMap.get(m.sharedPostId) ?? null : null;
      const hasSharedStoryRef = !!m.sharedStoryId;
      const sharedStory = hasSharedStoryRef ? sharedStoryMap.get(m.sharedStoryId) ?? null : null;
      const isMine = m.senderId === viewerId;
      return {
        id: m.id,
        sender: m.senderId,
        content: m.content,
        sharedPost,
        sharedPostUnavailable: hasSharedPostRef && !sharedPost,
        sharedStory,
        sharedStoryUnavailable: hasSharedStoryRef && !sharedStory,
        mediaUrl: m.mediaUrl || null,
        gifUrl: m.gifUrl || null,
        status: isMine && !m.deletedAt ? messageStatus(m, otherParticipantIds) : undefined,
        reactions: serializeReactions(m, viewerId),
        editedAt: m.editedAt || null,
        deleted: !!m.deletedAt,
        moderation: isMine ? m.moderationState || "clear" : undefined,
        moderationReason: isMine && m.moderationState === "blocked" ? m.moderationReason : undefined,
        createdAt: m.createdAt,
      };
    }),
    nextCursor,
  });
}

export async function sendMessage(req, res) {
  const communityId = req.community.id;
  const target = await findActiveMember(req.params.username);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ message: "Cannot message yourself" });

  if (target.status !== "active") {
    return res.status(400).json({ message: "Cannot send messages to an inactive account." });
  }

  if (await hasBlocked(target.id, req.user.id)) {
    return res.status(403).json({ message: "You can't send messages to this account." });
  }
  if (await hasBlocked(req.user.id, target.id)) {
    return res.status(403).json({ message: "You can't send messages to this account - you've blocked them." });
  }

  const postId = req.body.postId ? String(req.body.postId) : null;
  const storyId = req.body.storyId ? String(req.body.storyId) : null;
  const mediaUrl = req.body.mediaUrl ? String(req.body.mediaUrl) : null;
  const gifUrl = req.body.gifUrl ? String(req.body.gifUrl) : null;
  const content = String(req.body.content || "").trim();
  if (content.length > 1000) return res.status(400).json({ message: "Message too long" });

  if (mediaUrl) {
    if (mediaUrl.length > 500 || !isOwnMediaUrl(mediaUrl)) {
      return res.status(400).json({ message: "Invalid media URL" });
    }
  }
  if (gifUrl && !isGiphyUrl(gifUrl)) {
    return res.status(400).json({ message: "Invalid GIF URL" });
  }

  let sharedPostDoc = null;
  let sharedStoryDoc = null;
  if (postId) {
    const isStaff = isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role);
    sharedPostDoc = await prisma.post.findFirst({
      where: isValidObjectId(postId)
        ? { id: postId, communityId }
        : { shortId: postId, communityId },
      include: POST_INCLUDE,
    });
    if (!sharedPostDoc || sharedPostDoc.deleted || !canViewPost(sharedPostDoc, req.user.id, isStaff)) {
      return res.status(404).json({ message: "Post not found" });
    }
  } else if (storyId) {
    if (target.isPrivate) {
      const follow = await prisma.follow.findFirst({
        where: {
          followerId: req.user.id,
          followingId: target.id,
          status: "accepted",
        },
      });
      if (!follow) return res.status(403).json({ message: "This account is private" });
    }
    sharedStoryDoc = await prisma.story.findFirst({
      where: {
        id: storyId,
        communityId,
        authorId: target.id,
        expiresAt: { gt: new Date() },
      },
    });
    if (!sharedStoryDoc) return res.status(404).json({ message: "Story not found or expired" });
    if (!content) return res.status(400).json({ message: "A reaction or comment is required" });
  } else if (!content && !mediaUrl && !gifUrl) {
    return res.status(400).json({ message: "Message cannot be empty" });
  }

  let conversation = await findExistingConversation(req.user.id, target.id);

  if (!conversation) {
    if (target.restrictMessages) {
      const targetFollowsSender = await prisma.follow.findFirst({
        where: {
          followerId: target.id,
          followingId: req.user.id,
          status: "accepted",
        },
      });
      if (!targetFollowsSender) {
        return res.status(403).json({ message: "This account only accepts messages from people they follow." });
      }
    }
    conversation = await prisma.conversation.create({
      data: {
        id: newId(),
        communityId,
        participants: {
          create: [{ userId: req.user.id }, { userId: target.id }],
        },
      },
      include: PARTICIPANT_INCLUDE,
    });
  }

  const message = await prisma.message.create({
    data: {
      id: newId(),
      conversationId: conversation.id,
      senderId: req.user.id,
      content,
      sharedPostId: sharedPostDoc?.id ?? null,
      sharedStoryId: sharedStoryDoc?.id ?? null,
      mediaUrl,
      gifUrl,
      moderationState: content.trim() ? "pending" : "clear",
      deliveries: { create: { userId: req.user.id } },
      reads: { create: { userId: req.user.id } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageText: previewText(content, sharedPostDoc, mediaUrl, gifUrl),
      lastMessageAt: message.createdAt,
    },
  });

  if (message.moderationState === "pending") {
    moderateMessageInBackground(message.id, {
      communityId,
      communitySlug: req.community.slug,
      senderId: req.user.id,
      participants: participantIds(conversation),
    });
  }

  emitConversationChange(req, conversation, "message");

  const dmRecipients = participantIds(conversation).filter((id) => id !== req.user.id);
  for (const recipientId of dmRecipients) {
    sendPushToUser(recipientId, {
      title: req.user.displayName || `@${req.user.username}`,
      body: content || (mediaUrl ? "Sent a photo" : gifUrl ? "Sent a GIF" : "Sent a message"),
      url: `/${req.community.slug}/messages/${req.user.username}`,
      tag: `dm-${conversation.id}`,
    }).catch(() => {});
  }

  res.status(201).json({
    message: {
      id: message.id,
      sender: message.senderId,
      content: message.content,
      sharedPost: sharedPostDoc ? await hydratePost(sharedPostDoc, req.user.id, communityId) : null,
      sharedPostUnavailable: false,
      sharedStory: sharedStoryDoc ? serializeStoryRef(sharedStoryDoc) : null,
      sharedStoryUnavailable: false,
      mediaUrl: message.mediaUrl,
      gifUrl: message.gifUrl,
      status: "sent",
      reactions: [],
      editedAt: null,
      deleted: false,
      moderation: message.moderationState || "clear",
      moderationReason: null,
      createdAt: message.createdAt,
    },
  });
}

export async function reportMessage(req, res) {
  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { conversation: { include: { participants: true } }, sender: true },
  });
  if (!message || !message.conversation) return res.status(404).json({ message: "Message not found" });

  const conversation = message.conversation;
  const isParticipant = conversation.participants.some((p) => p.userId === req.user.id);
  if (!isParticipant || conversation.communityId !== req.community.id) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (message.senderId === req.user.id) {
    return res.status(400).json({ message: "Cannot report your own message" });
  }

  const snapshot = buildMessageSnapshot(message, message.sender);

  const report = await prisma.report.create({
    data: {
      id: newId(),
      reporterId: req.user.id,
      communityId: req.community.id,
      targetType: "message",
      targetId: message.id,
      contentSnapshot: describeSnapshot(snapshot),
      snapshot,
      reason: String(req.body.reason || "unspecified").trim().slice(0, 100),
      details: String(req.body.details || "").trim().slice(0, 500),
    },
  });

  reportCreated(report);

  res.status(201).json({ report: { id: report.id } });
}

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const REACTION_SET = new Set(REACTION_EMOJIS);
const MAX_REACTION_KINDS = 6;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const TYPING_TTL_MS = 6000;

async function loadOwnMessage(req) {
  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      conversation: { include: { participants: true } },
      reactions: true,
    },
  });
  if (!message || !message.conversation) return { error: 404 };

  const conversation = message.conversation;
  const isParticipant = conversation.participants.some((p) => p.userId === req.user.id);
  if (!isParticipant || conversation.communityId !== req.community.id) return { error: 404 };

  return { message, conversation };
}

function serializeReactions(message, viewerId) {
  const grouped = new Map();
  for (const r of message.reactions || []) {
    if (!grouped.has(r.emoji)) grouped.set(r.emoji, { emoji: r.emoji, count: 0, mine: false });
    const entry = grouped.get(r.emoji);
    entry.count += 1;
    if (r.userId === viewerId) entry.mine = true;
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count);
}

async function refreshConversationPreview(conversationId) {
  const last = await prisma.message.findFirst({
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageText: last
        ? last.content ||
          (last.sharedPostId ? "Shared a post" : last.mediaUrl ? "Photo" : last.gifUrl ? "GIF" : "")
        : "",
      lastMessageAt: last ? last.createdAt : null,
    },
  });
}

export async function editMessage(req, res) {
  const { message, conversation, error } = await loadOwnMessage(req);
  if (error) return res.status(404).json({ message: "Message not found" });

  if (message.senderId !== req.user.id) {
    return res.status(403).json({ message: "You can only edit your own messages." });
  }
  if (message.deletedAt) {
    return res.status(400).json({ message: "This message was deleted." });
  }
  if (!message.content) {
    return res.status(400).json({ message: "This message has no text to edit." });
  }
  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
    return res.status(400).json({ message: "Messages can only be edited within 15 minutes of sending." });
  }

  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ message: "Message cannot be empty" });
  if (content.length > 1000) return res.status(400).json({ message: "Message too long" });

  const guard = await guardText(content, {
    authorId: req.user.id,
    community: req.community.id,
    snapshotLabel: "edited message",
  });
  if (guard.blocked) return res.status(400).json({ code: "content_blocked", message: guard.message });

  const editedAt = new Date();
  await prisma.message.update({
    where: { id: message.id },
    data: { content, editedAt },
  });

  if (guard.flagged) {
    await fileAutoReport({
      community: req.community.id,
      targetType: "message",
      targetId: message.id,
      snapshot: content,
      category: guard.category,
      rationale: guard.rationale,
    });
  }

  await refreshConversationPreview(conversation.id);
  emitConversationChange(req, conversation, "message");

  res.json({
    message: {
      id: message.id,
      content,
      editedAt,
    },
  });
}

export async function deleteMessage(req, res) {
  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      conversation: { include: { participants: true } },
    },
  });
  if (!message || !message.conversation) return res.status(404).json({ message: "Message not found" });

  const conversation = message.conversation;
  const isParticipant = conversation.participants.some((p) => p.userId === req.user.id);
  const isStaff = ["staff", "admin", "developer", "owner"].includes(effectiveRole(req.user)) || ["owner", "staff"].includes(req.membership?.role);

  if (!isParticipant && !isStaff) {
    return res.status(404).json({ message: "Message not found" });
  }

  if (message.senderId !== req.user.id && !isStaff) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (message.deletedAt) return res.json({ ok: true });

  await prisma.$transaction([
    prisma.message.update({
      where: { id: message.id },
      data: {
        deletedAt: new Date(),
        content: "",
        mediaUrl: null,
        gifUrl: null,
        sharedPostId: null,
        sharedStoryId: null,
      },
    }),
    prisma.messageReaction.deleteMany({ where: { messageId: message.id } }),
  ]);

  await refreshConversationPreview(conversation.id);
  emitConversationChange(req, conversation, "message");

  res.json({ ok: true });
}

export async function reactToMessage(req, res) {
  const { message, conversation, error } = await loadOwnMessage(req);
  if (error) return res.status(404).json({ message: "Message not found" });

  if (message.deletedAt) return res.status(400).json({ message: "This message was deleted." });

  const emoji = String(req.body.emoji || "");
  if (!REACTION_SET.has(emoji)) return res.status(400).json({ message: "Unsupported reaction." });

  const viewerId = req.user.id;
  const existing = (message.reactions || []).find((r) => r.userId === viewerId && r.emoji === emoji);

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    message.reactions = message.reactions.filter((r) => r.id !== existing.id);
  } else {
    const kinds = new Set((message.reactions || []).map((r) => r.emoji));
    if (!kinds.has(emoji) && kinds.size >= MAX_REACTION_KINDS) {
      return res.status(400).json({ message: "This message already has the maximum number of reactions." });
    }
    const reaction = await prisma.messageReaction.create({
      data: { messageId: message.id, userId: viewerId, emoji },
    });
    message.reactions = [...(message.reactions || []), reaction];
  }

  emitConversationChange(req, conversation, "message");
  res.json({ reactions: serializeReactions(message, viewerId) });
}

async function activeTypers(conversationId, viewerId) {
  const rows = await prisma.typingStatus.findMany({
    where: {
      conversationId,
      userId: { not: viewerId },
      at: { gt: new Date(Date.now() - TYPING_TTL_MS) },
    },
    select: { userId: true },
  });

  return rows.map((r) => r.userId);
}

async function touchTyping(conversationId, userId) {
  await prisma.typingStatus.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, at: new Date() },
    update: { at: new Date() },
  });
}

async function typingPayload(conversationId, viewerId) {
  const ids = await activeTypers(conversationId, viewerId);
  if (!ids.length) return { typing: [] };

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, displayName: true },
  });
  return {
    typing: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
    })),
  };
}

export async function setTyping(req, res) {
  const target = await findActiveMember(req.params.username);
  if (!target) return res.status(404).json({ message: "User not found" });

  const conversation = await findExistingConversation(req.user.id, target.id);
  if (!conversation) return res.json({ ok: true });

  await touchTyping(conversation.id, req.user.id);
  emitToUsers([target.id], REALTIME_EVENTS.typing, {
    communitySlug: req.community.slug,
    threadType: "dm",
    threadId: req.user.username,
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
    },
    ttlMs: TYPING_TTL_MS,
  });
  res.json({ ok: true });
}

export async function getTyping(req, res) {
  const target = await findActiveMember(req.params.username);
  if (!target) return res.json({ typing: [] });

  const conversation = await findExistingConversation(req.user.id, target.id);
  if (!conversation) return res.json({ typing: [] });

  res.json(await typingPayload(conversation.id, req.user.id));
}

export async function setGroupTyping(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  await touchTyping(conversation.id, req.user.id);
  emitToUsers(
    participantIds(conversation).filter((participantId) => participantId !== req.user.id),
    REALTIME_EVENTS.typing,
    {
      communitySlug: req.community.slug,
      threadType: "group",
      threadId: conversation.id,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
      },
      ttlMs: TYPING_TTL_MS,
    }
  );
  res.json({ ok: true });
}

export async function getGroupTyping(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.json({ typing: [] });

  res.json(await typingPayload(conversation.id, req.user.id));
}

async function assertCanMessage(target, actorId, communityId) {
  if ((await hasBlocked(target.id, actorId)) || (await hasBlocked(actorId, target.id))) {
    return `Can't add @${target.username} to this group`;
  }
  if (!(await areFriends(actorId, target.id))) {
    return `You can only add friends to a group. You and @${target.username} both need to follow each other.`;
  }
  if (target.restrictMessages) {
    const targetFollowsActor = await prisma.follow.findFirst({
      where: {
        followerId: target.id,
        followingId: actorId,
        status: "accepted",
      },
    });
    if (!targetFollowsActor) return `@${target.username} only accepts messages from people they follow.`;
  }
  return null;
}

export async function createGroup(req, res) {
  const communityId = req.community.id;
  const usernames = Array.isArray(req.body.usernames) ? req.body.usernames : [];
  if (usernames.length > MAX_GROUP_PARTICIPANTS - 1) {
    return res.status(400).json({ message: `Group chats can have at most ${MAX_GROUP_PARTICIPANTS} members.` });
  }
  const uniqueUsernames = [...new Set(usernames.map((u) => String(u).toLowerCase()))];

  const targets = [];
  for (const username of uniqueUsernames) {
    const target = await findActiveMember(username);
    if (!target) return res.status(404).json({ message: `User @${username} not found` });
    if (target.id === req.user.id) continue;

    const error = await assertCanMessage(target, req.user.id, communityId);
    if (error) return res.status(403).json({ message: error });

    if (!targets.some((t) => t.id === target.id)) targets.push(target);
  }

  if (targets.length < 2) {
    return res.status(400).json({ message: "Group chats need at least 2 other members." });
  }

  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const [a, b] = [targets[i], targets[j]];
      if ((await hasBlocked(a.id, b.id)) || (await hasBlocked(b.id, a.id))) {
        return res.status(403).json({ message: `Can't add @${a.username} and @${b.username} to the same group` });
      }
    }
  }

  const name = String(req.body.name || "").trim().slice(0, 50);
  const conversation = await prisma.conversation.create({
    data: {
      id: newId(),
      communityId,
      isGroup: true,
      name,
      createdById: req.user.id,
      participants: {
        create: [{ userId: req.user.id }, ...targets.map((t) => ({ userId: t.id }))],
      },
    },
    include: PARTICIPANT_INCLUDE,
  });

  emitConversationChange(req, conversation, "conversation");
  res.status(201).json({ group: await serializeGroup(conversation, communityId, req.user.id) });
}

export async function getGroup(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  res.json({ group: await serializeGroup(conversation, req.community.id, req.user.id) });
}

export async function getGroupMessages(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  let pagination;
  try {
    pagination = parseMessagePageParams(req.query);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const communityId = req.community.id;
  const { messages, nextCursor } = await findMessagePage(conversation.id, pagination, req.user.id);

  if (hasUnreadIncoming(messages, req.user.id)) {
    await markReadAndDelivered(conversation.id, req.user.id);
  }

  const viewerId = req.user.id;
  const sharedPostIds = messages.filter((m) => m.sharedPostId).map((m) => m.sharedPostId);
  const sharedPostDocs = sharedPostIds.length
    ? await prisma.post.findMany({
        where: { id: { in: sharedPostIds }, deleted: false },
        include: POST_INCLUDE,
      })
    : [];
  const hydratedSharedPosts = await hydratePosts(sharedPostDocs, viewerId, communityId);
  const sharedPostMap = new Map(hydratedSharedPosts.map((p) => [p.id, p]));

  const otherParticipantIds = conversation.participants
    .map((p) => p.userId)
    .filter((id) => id !== viewerId);

  res.json({
    messages: messages.map((m) => {
      const hasSharedPostRef = !!m.sharedPostId;
      const sharedPost = hasSharedPostRef ? sharedPostMap.get(m.sharedPostId) ?? null : null;
      const isMine = m.senderId === viewerId;
      return {
        id: m.id,
        sender: m.senderId,
        content: m.content,
        sharedPost,
        sharedPostUnavailable: hasSharedPostRef && !sharedPost,
        sharedStory: null,
        sharedStoryUnavailable: false,
        mediaUrl: m.mediaUrl || null,
        gifUrl: m.gifUrl || null,
        status: isMine && !m.deletedAt ? messageStatus(m, otherParticipantIds) : undefined,
        reactions: serializeReactions(m, viewerId),
        editedAt: m.editedAt || null,
        deleted: !!m.deletedAt,
        moderation: isMine ? m.moderationState || "clear" : undefined,
        moderationReason: isMine && m.moderationState === "blocked" ? m.moderationReason : undefined,
        createdAt: m.createdAt,
      };
    }),
    nextCursor,
  });
}

export async function sendGroupMessage(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  const communityId = req.community.id;
  const postId = req.body.postId ? String(req.body.postId) : null;
  const mediaUrl = req.body.mediaUrl ? String(req.body.mediaUrl) : null;
  const gifUrl = req.body.gifUrl ? String(req.body.gifUrl) : null;
  const content = String(req.body.content || "").trim();
  if (content.length > 1000) return res.status(400).json({ message: "Message too long" });

  if (mediaUrl) {
    if (mediaUrl.length > 500 || !isOwnMediaUrl(mediaUrl)) {
      return res.status(400).json({ message: "Invalid media URL" });
    }
  }
  if (gifUrl && !isGiphyUrl(gifUrl)) {
    return res.status(400).json({ message: "Invalid GIF URL" });
  }

  let sharedPostDoc = null;
  if (postId) {
    const isStaff = isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role);
    sharedPostDoc = await prisma.post.findFirst({
      where: isValidObjectId(postId)
        ? { id: postId, communityId }
        : { shortId: postId, communityId },
      include: POST_INCLUDE,
    });
    if (!sharedPostDoc || sharedPostDoc.deleted || !canViewPost(sharedPostDoc, req.user.id, isStaff)) {
      return res.status(404).json({ message: "Post not found" });
    }
  } else if (!content && !mediaUrl && !gifUrl) {
    return res.status(400).json({ message: "Message cannot be empty" });
  }

  const message = await prisma.message.create({
    data: {
      id: newId(),
      conversationId: conversation.id,
      senderId: req.user.id,
      content,
      sharedPostId: sharedPostDoc?.id ?? null,
      mediaUrl,
      gifUrl,
      moderationState: content.trim() ? "pending" : "clear",
      deliveries: { create: { userId: req.user.id } },
      reads: { create: { userId: req.user.id } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageText: previewText(content, sharedPostDoc, mediaUrl, gifUrl),
      lastMessageAt: message.createdAt,
    },
  });

  if (message.moderationState === "pending") {
    moderateMessageInBackground(message.id, {
      communityId,
      communitySlug: req.community.slug,
      senderId: req.user.id,
      participants: participantIds(conversation),
    });
  }

  emitConversationChange(req, conversation, "message");

  const groupRecipients = participantIds(conversation).filter((id) => id !== req.user.id);
  const groupName = conversation.name || "Group chat";
  for (const recipientId of groupRecipients) {
    sendPushToUser(recipientId, {
      title: groupName,
      body: `${req.user.displayName || `@${req.user.username}`}: ${content || (mediaUrl ? "Sent a photo" : gifUrl ? "Sent a GIF" : "Sent a message")}`,
      url: `/${req.community.slug}/messages/group/${conversation.id}`,
      tag: `dm-${conversation.id}`,
    }).catch(() => {});
  }

  res.status(201).json({
    message: {
      id: message.id,
      sender: message.senderId,
      content: message.content,
      sharedPost: sharedPostDoc ? await hydratePost(sharedPostDoc, req.user.id, communityId) : null,
      sharedPostUnavailable: false,
      sharedStory: null,
      sharedStoryUnavailable: false,
      mediaUrl: message.mediaUrl,
      gifUrl: message.gifUrl,
      status: "sent",
      reactions: [],
      editedAt: null,
      deleted: false,
      moderation: message.moderationState || "clear",
      moderationReason: null,
      createdAt: message.createdAt,
    },
  });
}

export async function addGroupMember(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  const communityId = req.community.id;
  const target = await findActiveMember(req.params.username);
  if (!target) return res.status(404).json({ message: "User not found" });

  if (conversation.participants.some((p) => p.userId === target.id)) {
    return res.status(409).json({ message: "Already in this group" });
  }
  if (conversation.participants.length >= MAX_GROUP_PARTICIPANTS) {
    return res.status(400).json({ message: `Group chats can have at most ${MAX_GROUP_PARTICIPANTS} members.` });
  }

  const error = await assertCanMessage(target, req.user.id, communityId);
  if (error) return res.status(403).json({ message: error });

  const otherParticipantIds = conversation.participants
    .map((p) => p.userId)
    .filter((id) => id !== req.user.id);
  for (const participantId of otherParticipantIds) {
    if ((await hasBlocked(target.id, participantId)) || (await hasBlocked(participantId, target.id))) {
      return res.status(403).json({ message: "Can't add this member" });
    }
  }

  await prisma.conversationParticipant.create({
    data: { conversationId: conversation.id, userId: target.id },
  });

  const BATCH_SIZE = 1000;
  let skip = 0;
  while (true) {
    const messageRows = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      select: { id: true },
      skip,
      take: BATCH_SIZE,
    });
    if (!messageRows.length) break;
    const deliveryRows = messageRows.map((row) => ({ messageId: row.id, userId: target.id }));
    await prisma.messageDelivery.createMany({ data: deliveryRows, skipDuplicates: true });
    await prisma.messageRead.createMany({ data: deliveryRows, skipDuplicates: true });
    skip += BATCH_SIZE;
  }

  const updated = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: PARTICIPANT_INCLUDE,
  });

  emitConversationChange(req, updated, "conversation");
  res.json({ group: await serializeGroup(updated, communityId, req.user.id) });
}

export async function removeGroupMember(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  const communityId = req.community.id;
  const target = await findActiveMember(req.params.username);
  if (!target) return res.status(404).json({ message: "User not found" });

  const isSelf = target.id === req.user.id;
  const isCreator = conversation.createdById && conversation.createdById === req.user.id;
  if (!isSelf && !isCreator) {
    return res.status(403).json({ message: "Only the group creator can remove other members." });
  }

  const previousParticipantIds = participantIds(conversation);
  const remainingCount = conversation.participants.filter((p) => p.userId !== target.id).length;

  if (remainingCount < 1) {
    await prisma.conversation.delete({ where: { id: conversation.id } });
    emitConversationChange(req, conversation, "conversation", previousParticipantIds);
    return res.json({ ok: true, deleted: true });
  }

  await prisma.conversationParticipant.delete({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId: target.id },
    },
  });

  const updated = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    include: PARTICIPANT_INCLUDE,
  });

  emitConversationChange(req, updated, "conversation", previousParticipantIds);
  res.json({ group: await serializeGroup(updated, communityId, req.user.id) });
}

export async function updateGroup(req, res) {
  const conversation = await loadGroupConversation(req);
  if (!conversation) return res.status(404).json({ message: "Group not found" });

  const isCreator = conversation.createdById && conversation.createdById === req.user.id;
  if (!isCreator) return res.status(403).json({ message: "Only the group creator can update the group." });

  const data = {};
  if (req.body.name !== undefined) {
    data.name = String(req.body.name).trim().slice(0, 50);
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data,
    include: PARTICIPANT_INCLUDE,
  });

  emitConversationChange(req, updated, "conversation");
  res.json({ group: await serializeGroup(updated, req.community.id, req.user.id) });
}

export async function unreadCount(req, res) {
  const summary = await getUnreadSummary(req.user.id);

  if (summary.undeliveredCount > 0) {
    await markCommunityDelivered(req.user.id);
  }
  res.json({ count: summary.count || 0 });
}
