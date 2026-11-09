export const DEFAULT_RELATIONSHIP_PAGE_SIZE = 50;
export const MAX_RELATIONSHIP_PAGE_SIZE = 100;

const MAX_CURSOR_LENGTH = 512;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function encodeRelationshipCursor(relationship) {
  const createdAt = new Date(relationship.createdAt);
  const id = String(relationship._id ?? relationship.id ?? "");
  if (Number.isNaN(createdAt.getTime()) || !OBJECT_ID_PATTERN.test(id)) {
    throw new TypeError("Invalid relationship cursor source");
  }

  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString("base64url");
}

export function decodeRelationshipCursor(value) {
  if (typeof value !== "string" || !value || value.length > MAX_CURSOR_LENGTH) {
    throw new TypeError("Invalid relationship cursor");
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed?.c !== "string" || !OBJECT_ID_PATTERN.test(parsed?.i || "")) {
      throw new TypeError("Invalid relationship cursor");
    }

    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime())) throw new TypeError("Invalid relationship cursor");
    return { createdAt, id: parsed.i };
  } catch {
    throw new TypeError("Invalid relationship cursor");
  }
}

export function parseRelationshipPageQuery(query = {}) {
  if (Array.isArray(query.limit)) throw new TypeError("Invalid relationship page limit");
  const requestedLimit = query.limit === undefined || query.limit === "" ? DEFAULT_RELATIONSHIP_PAGE_SIZE : Number(query.limit);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new TypeError("Invalid relationship page limit");
  }

  if (Array.isArray(query.cursor)) throw new TypeError("Invalid relationship cursor");
  return {
    limit: Math.min(requestedLimit, MAX_RELATIONSHIP_PAGE_SIZE),
    cursor: query.cursor ? decodeRelationshipCursor(query.cursor) : null,
  };
}

export function relationshipCursorFilter(cursor) {
  if (!cursor) return {};
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}

export function paginateRelationshipRows(rows, limit) {
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    page,
    hasMore,
    nextCursor: hasMore ? encodeRelationshipCursor(page.at(-1)) : null,
  };
}
