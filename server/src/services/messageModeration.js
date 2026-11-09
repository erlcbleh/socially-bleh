import { prisma } from "../db/prisma.js";
import { screenText } from "./textModeration.js";
import { findHardBlockedTerm } from "./hardBlockTerms.js";
import { fileAutoReport } from "./autoReport.js";
import { buildMessageSnapshot } from "./reportSnapshot.js";
import { emitToUsers, REALTIME_EVENTS } from "./realtime.js";

export const BLOCKED_MESSAGE_REASON = "This message wasn't sent because it broke our content rules.";

function previewFor(message) {
  if (!message) return "";
  return (
    message.content ||
    (message.sharedPostId ? "Shared a post" : message.mediaUrl ? "Photo" : message.gifUrl ? "GIF" : "")
  );
}

async function refreshPreview(conversationId) {
  const newest = await prisma.message.findFirst({
    where: {
      conversationId,
      deletedAt: null,
      moderationState: { not: "blocked" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      content: true,
      sharedPostId: true,
      mediaUrl: true,
      gifUrl: true,
      createdAt: true,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageText: previewFor(newest),
      lastMessageAt: newest ? newest.createdAt : null,
    },
  });
}

export async function moderateMessage(messageId, { communityId, communitySlug, senderId, participants }) {
  const notify = (recipients, conversationId, isGroup) =>
    emitToUsers(recipients, REALTIME_EVENTS.messagesChanged, {
      communitySlug,
      conversationId: String(conversationId),
      kind: "message",
      threadType: isGroup ? "group" : "dm",
    });

  const message = await prisma.message.findUnique({
    where: { id: String(messageId) },
    include: { sender: true },
  });
  if (!message || message.deletedAt) return;

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    select: { isGroup: true },
  });
  const isGroup = !!conversation?.isGroup;

  const text = message.content || "";
  if (!text.trim()) {
    await prisma.message.update({
      where: { id: message.id },
      data: { moderationState: "clear" },
    });
    await refreshPreview(message.conversationId);
    notify(participants || [senderId], message.conversationId, isGroup);
    return;
  }

  const hardTerm = findHardBlockedTerm(text);
  const result = hardTerm
    ? { action: "block", category: "minor_sexual", rationale: `Contains "${hardTerm}"` }
    : await screenText(text);
  const blocked = result.action === "block";

  await prisma.message.update({
    where: { id: message.id },
    data: {
      moderationState: blocked ? "blocked" : "clear",
      moderationReason: blocked ? BLOCKED_MESSAGE_REASON : null,
    },
  });

  if (result.action !== "allow") {
    await fileAutoReport({
      community: communityId,
      targetType: "message",
      targetId: message.id,
      snapshot: buildMessageSnapshot(message, message.sender),
      category: result.category,
      rationale: result.rationale,
      blocked,
    });
  }

  await refreshPreview(message.conversationId);

  notify(blocked ? [senderId] : participants || [senderId], message.conversationId, isGroup);
}

export function moderateMessageInBackground(messageId, context) {
  setImmediate(() => {
    moderateMessage(messageId, context).catch((err) => {
      console.error("Deferred message moderation failed", err);
    });
  });
}
