import { prisma } from "../db/prisma.js";

export const DEFAULT_CONVERSATION_PAGE_SIZE = 50;
export const MAX_CONVERSATION_PAGE_SIZE = 100;

const MAX_CURSOR_LENGTH = 512;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function encodeConversationCursor(conversation) {
  const lastMessageAt =
    conversation.lastMessageAt === null || conversation.lastMessageAt === undefined
      ? null
      : new Date(conversation.lastMessageAt);
  const createdAt = new Date(conversation.createdAt);
  const id = String(conversation._id ?? conversation.id ?? "");

  if (
    (lastMessageAt && Number.isNaN(lastMessageAt.getTime())) ||
    Number.isNaN(createdAt.getTime()) ||
    !OBJECT_ID_PATTERN.test(id)
  ) {
    throw new TypeError("Invalid conversation cursor source");
  }

  return Buffer.from(
    JSON.stringify({
      m: lastMessageAt?.toISOString() ?? null,
      c: createdAt.toISOString(),
      i: id,
    })
  ).toString("base64url");
}

export function decodeConversationCursor(value) {
  if (typeof value !== "string" || !value || value.length > MAX_CURSOR_LENGTH) {
    throw new TypeError("Invalid conversation cursor");
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      (parsed?.m !== null && typeof parsed?.m !== "string") ||
      typeof parsed?.c !== "string" ||
      !OBJECT_ID_PATTERN.test(parsed?.i || "")
    ) {
      throw new TypeError("Invalid conversation cursor");
    }

    const lastMessageAt = parsed.m === null ? null : new Date(parsed.m);
    const createdAt = new Date(parsed.c);
    if (
      (lastMessageAt && Number.isNaN(lastMessageAt.getTime())) ||
      Number.isNaN(createdAt.getTime())
    ) {
      throw new TypeError("Invalid conversation cursor");
    }

    return { lastMessageAt, createdAt, id: parsed.i };
  } catch {
    throw new TypeError("Invalid conversation cursor");
  }
}

export function parseConversationPageParams(query = {}) {
  if (Array.isArray(query.limit)) throw new TypeError("Invalid conversation page limit");
  const requestedLimit =
    query.limit === undefined || query.limit === ""
      ? DEFAULT_CONVERSATION_PAGE_SIZE
      : Number(query.limit);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new TypeError("Invalid conversation page limit");
  }

  if (Array.isArray(query.cursor)) throw new TypeError("Invalid conversation cursor");
  return {
    limit: Math.min(requestedLimit, MAX_CONVERSATION_PAGE_SIZE),
    cursor: query.cursor ? decodeConversationCursor(query.cursor) : null,
  };
}

export function conversationCursorFilter(cursor) {
  if (!cursor) return {};

  const createdAtBoundary = [
    { lastMessageAt: cursor.lastMessageAt, createdAt: { lt: cursor.createdAt } },
    {
      lastMessageAt: cursor.lastMessageAt,
      createdAt: cursor.createdAt,
      id: { lt: cursor.id },
    },
  ];

  if (cursor.lastMessageAt === null) return { OR: createdAtBoundary };

  return {
    OR: [
      { lastMessageAt: { lt: cursor.lastMessageAt } },
      { lastMessageAt: null },
      ...createdAtBoundary,
    ],
  };
}

export function paginateConversationRows(rows, limit) {
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    page,
    hasMore,
    nextCursor: hasMore ? encodeConversationCursor(page.at(-1)) : null,
  };
}

export async function getConversationUnreadStats(conversationIds, viewerId) {
  if (!conversationIds.length) {
    return { unreadMap: new Map(), hasUndelivered: false };
  }

  const unreadGroups = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversationIds },
      deletedAt: null,
      reads: { none: { userId: viewerId } },
    },
    _count: { id: true },
  });

  const undeliveredGroups = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversationIds },
      deletedAt: null,
      senderId: { not: viewerId },
      reads: { none: { userId: viewerId } },
      deliveries: { none: { userId: viewerId } },
    },
    _count: { id: true },
  });

  const unreadMap = new Map(unreadGroups.map((row) => [row.conversationId, row._count.id]));
  const hasUndelivered = undeliveredGroups.some((row) => row._count.id > 0);

  return { unreadMap, hasUndelivered };
}

export async function getUnreadSummary(userId) {
  const participantRows = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  const conversationIds = participantRows.map((row) => row.conversationId);
  if (!conversationIds.length) return { count: 0, undeliveredCount: 0 };

  const [count, undeliveredCount] = await Promise.all([
    prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        moderationState: { notIn: ["pending", "blocked"] },
        reads: { none: { userId } },
        senderId: { not: userId },
      },
    }),
    prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        moderationState: { notIn: ["pending", "blocked"] },
        reads: { none: { userId } },
        senderId: { not: userId },
        deliveries: { none: { userId } },
      },
    }),
  ]);

  return { count, undeliveredCount };
}
