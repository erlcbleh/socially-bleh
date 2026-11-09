export const DEFAULT_COMMENT_PAGE_SIZE = 50;
export const MAX_COMMENT_PAGE_SIZE = 100;

const MAX_CURSOR_LENGTH = 512;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function encodeCommentCursor(comment) {
  const createdAt = new Date(comment.createdAt);
  const id = String(comment._id ?? comment.id ?? "");
  if (Number.isNaN(createdAt.getTime()) || !OBJECT_ID_PATTERN.test(id)) {
    throw new TypeError("Invalid comment cursor source");
  }

  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString("base64url");
}

export function decodeCommentCursor(value) {
  if (typeof value !== "string" || !value || value.length > MAX_CURSOR_LENGTH) {
    throw new TypeError("Invalid comment cursor");
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed?.c !== "string" || !OBJECT_ID_PATTERN.test(parsed?.i || "")) {
      throw new TypeError("Invalid comment cursor");
    }

    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime())) throw new TypeError("Invalid comment cursor");
    return { createdAt, id: parsed.i };
  } catch {
    throw new TypeError("Invalid comment cursor");
  }
}

export function parseCommentPageQuery(query = {}) {
  if (Array.isArray(query.limit)) throw new TypeError("Invalid comment page limit");
  const requestedLimit = query.limit === undefined || query.limit === "" ? DEFAULT_COMMENT_PAGE_SIZE : Number(query.limit);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new TypeError("Invalid comment page limit");
  }

  if (Array.isArray(query.cursor)) throw new TypeError("Invalid comment cursor");
  return {
    limit: Math.min(requestedLimit, MAX_COMMENT_PAGE_SIZE),
    cursor: query.cursor ? decodeCommentCursor(query.cursor) : null,
  };
}

export function commentCursorFilter(cursor) {
  if (!cursor) return {};
  return {
    $or: [
      { createdAt: { $gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $gt: cursor.id } },
    ],
  };
}

export function paginateCommentRows(rows, limit) {
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    page,
    hasMore,
    nextCursor: hasMore ? encodeCommentCursor(page.at(-1)) : null,
  };
}
