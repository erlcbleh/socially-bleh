import { isValidObjectId } from "../lib/ids.js";

export const STAFF_PAGE_SIZE = 50;
export const STAFF_MAX_PAGE_SIZE = 200;

export function parseLimit(raw, { fallback = STAFF_PAGE_SIZE, max = STAFF_MAX_PAGE_SIZE } = {}) {
  return Math.min(max, Math.max(1, Number(raw) || fallback));
}

export function parseWindow(raw, { fallback = 7, max = 90 } = {}) {
  return Math.min(max, Math.max(1, Number(raw) || fallback));
}

export function parseCursor(raw) {
  if (typeof raw !== "string" || !raw) return null;

  const [millis, id] = raw.split("_");
  const createdAt = new Date(Number(millis));
  if (Number.isNaN(createdAt.getTime()) || !isValidObjectId(id)) return null;

  return { createdAt, id };
}

export function makeCursor(row) {
  return row ? `${row.createdAt.getTime()}_${row.id}` : null;
}

export function withCursor(where, cursor) {
  if (!cursor) return where;

  return {
    ...where,
    AND: [
      ...(where.AND || []),
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ],
  };
}

export function takePage(rows, limit) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return { page, nextCursor: hasMore ? makeCursor(page[page.length - 1]) : null };
}

export function parseName(raw, max) {
  return String(raw ?? "").trim().slice(0, max) || null;
}
