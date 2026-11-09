export const DEFAULT_MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const MAX_CURSOR_LENGTH = 512;

export function encodeMessageCursor(message) {
  const createdAt = new Date(message.createdAt);
  const id = String(message._id ?? message.id ?? "");
  if (Number.isNaN(createdAt.getTime()) || !OBJECT_ID_PATTERN.test(id)) {
    throw new TypeError("Invalid message cursor source");
  }

  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64url");
}

export function decodeMessageCursor(value) {
  if (typeof value !== "string" || !value || value.length > MAX_CURSOR_LENGTH) {
    throw new TypeError("Invalid message cursor");
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !OBJECT_ID_PATTERN.test(parsed.id)) {
      throw new TypeError("Invalid message cursor");
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new TypeError("Invalid message cursor");
  }
}

export function parseMessagePageParams(query = {}) {
  let limit = DEFAULT_MESSAGE_PAGE_SIZE;
  if (query.limit !== undefined && query.limit !== "") {
    if (Array.isArray(query.limit)) throw new TypeError("Invalid message page limit");
    const requestedLimit = Number(query.limit);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new TypeError("Invalid message page limit");
    }
    limit = Math.min(requestedLimit, MAX_MESSAGE_PAGE_SIZE);
  }

  if (Array.isArray(query.cursor)) throw new TypeError("Invalid message cursor");
  const cursor = query.cursor ? decodeMessageCursor(query.cursor) : null;
  return { cursor, limit };
}

export function messageCursorFilter(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function paginateMessageRows(rows, limit) {
  const newestFirst = rows.slice(0, limit);
  return {
    messages: newestFirst.reverse(),
    nextCursor: rows.length > limit ? encodeMessageCursor(newestFirst[0]) : null,
  };
}
