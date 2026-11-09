const DEFAULT_MEMBER_PAGE_SIZE = 50;
const MAX_MEMBER_PAGE_SIZE = 100;
const MAX_MEMBER_QUERY_LENGTH = 100;
const MAX_CURSOR_LENGTH = 512;
const MEMBER_ROLES = new Set(["owner", "staff", "member"]);
const MEMBER_STATUSES = new Set(["active", "banned"]);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function escapeMemberSearch(query) {
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeCursor(value) {
  if (!value || value.length > MAX_CURSOR_LENGTH) throw new Error("Invalid member cursor");

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid member cursor");
  }

  const createdAt = new Date(decoded?.c);
  if (
    !MEMBER_ROLES.has(decoded?.r) ||
    Number.isNaN(createdAt.getTime()) ||
    !OBJECT_ID_PATTERN.test(decoded?.i || "")
  ) {
    throw new Error("Invalid member cursor");
  }

  return { role: decoded.r, createdAt, id: decoded.i };
}

export function parseMemberListQuery(query = {}) {
  const q = String(query.q ?? "").trim();
  if (q.length > MAX_MEMBER_QUERY_LENGTH) throw new Error("Member search is too long");

  const rawLimit = query.limit;
  const limit = rawLimit === undefined ? DEFAULT_MEMBER_PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMBER_PAGE_SIZE) {
    throw new Error(`Member page size must be between 1 and ${MAX_MEMBER_PAGE_SIZE}`);
  }

  const status = query.status === undefined ? null : String(query.status);
  if (status !== null && !MEMBER_STATUSES.has(status)) throw new Error("Invalid member status");

  return {
    q,
    limit,
    status,
    cursor: query.cursor === undefined ? null : decodeCursor(String(query.cursor)),
  };
}

export function encodeMemberCursor(member) {
  return Buffer.from(
    JSON.stringify({
      r: member.role,
      c: member.createdAt.toISOString(),
      i: String(member.id),
    })
  ).toString("base64url");
}
