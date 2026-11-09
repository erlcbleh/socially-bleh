import { prisma } from "../db/prisma.js";
import { serializeUser } from "../services/hydrate.js";
import { parseLimit, parseWindow, parseCursor, withCursor, takePage } from "../utils/staffPagination.js";

const MAX_MODERATION_ATTEMPTS = 3;

function splitReason(reason) {
  const text = String(reason || "");
  const separator = text.indexOf(":");
  if (separator === -1) return { verdict: text.trim() || "unspecified", categories: ["unspecified"] };

  const verdict = text.slice(0, separator).trim() || "unspecified";
  const categories = text
    .slice(separator + 1)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return { verdict, categories: categories.length ? categories : ["unspecified"] };
}

export async function getAiCategoryBreakdown(req, res) {
  const days = parseWindow(req.query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.report.groupBy({
    by: ["reason", "status"],
    where: { source: "ai", createdAt: { gte: since } },
    _count: { _all: true },
  });

  const categories = new Map();
  const verdicts = new Map();
  let total = 0;

  for (const row of grouped) {
    const count = row._count._all;
    total += count;

    const { verdict, categories: names } = splitReason(row.reason);
    verdicts.set(verdict, (verdicts.get(verdict) || 0) + count);

    for (const name of names) {
      const entry = categories.get(name) ?? { category: name, total: 0, pending: 0, actioned: 0, dismissed: 0 };
      entry.total += count;
      if (row.status === "pending") entry.pending += count;
      else if (row.status === "actioned") entry.actioned += count;
      else if (row.status === "dismissed") entry.dismissed += count;
      categories.set(name, entry);
    }
  }

  const list = [...categories.values()].sort((a, b) => b.total - a.total);

  res.json({
    days,
    total,
    categories: list.map((entry) => ({
      ...entry,
      falsePositiveRate:
        entry.actioned + entry.dismissed > 0
          ? entry.dismissed / (entry.actioned + entry.dismissed)
          : null,
    })),
    verdicts: [...verdicts.entries()]
      .map(([verdict, count]) => ({ verdict, count }))
      .sort((a, b) => b.count - a.count),
  });
}

export async function listAiFalsePositives(req, res) {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);
  const category = String(req.query.category || "").trim();

  const rows = await prisma.report.findMany({
    where: withCursor(
      {
        source: "ai",
        status: "dismissed",
        ...(category ? { reason: { contains: category, mode: "insensitive" } } : {}),
      },
      cursor
    ),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { reviewedBy: true, community: true },
  });

  const { page, nextCursor } = takePage(rows, limit);

  const postIds = page.filter((row) => row.targetType === "post").map((row) => row.targetId);
  const posts = postIds.length
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, deleted: true, moderationStatus: true, authorId: true },
      })
    : [];
  const postMap = new Map(posts.map((post) => [post.id, post]));

  res.json({
    items: page.map((row) => {
      const { verdict, categories } = splitReason(row.reason);
      const post = postMap.get(row.targetId);
      return {
        id: row.id,
        verdict,
        categories,
        reason: row.reason,
        content: row.contentSnapshot || row.snapshot?.content || "",
        targetType: row.targetType,
        targetId: row.targetId,
        communityName: row.community?.name || null,
        reviewedBy: row.reviewedBy ? serializeUser(row.reviewedBy, {}) : null,
        reviewedAt: row.reviewedAt,
        staffNote: row.staffNote,
        stillLive: post ? !post.deleted : null,
        createdAt: row.createdAt,
      };
    }),
    nextCursor,
  });
}

export async function listAiStuckPosts(req, res) {
  const limit = parseLimit(req.query.limit);
  const where = { moderationStatus: "pending", deleted: false };

  const [rows, total, byAttempt] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ moderationAttempts: "desc" }, { createdAt: "asc" }],
      take: limit,
      include: { author: true },
    }),
    prisma.post.count({ where }),
    prisma.post.groupBy({
      by: ["moderationAttempts"],
      where,
      _count: { _all: true },
      orderBy: { moderationAttempts: "asc" },
    }),
  ]);

  const oldest = await prisma.post.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  res.json({
    total,
    maxAttempts: MAX_MODERATION_ATTEMPTS,
    oldestPendingAt: oldest?.createdAt ?? null,
    byAttempt: byAttempt.map((row) => ({
      attempts: row.moderationAttempts,
      count: row._count._all,
      exhausted: row.moderationAttempts >= MAX_MODERATION_ATTEMPTS,
    })),
    items: rows.map((post) => ({
      id: post.id,
      content: (post.content || "").slice(0, 300),
      author: post.author ? serializeUser(post.author, {}) : null,
      attempts: post.moderationAttempts,
      exhausted: post.moderationAttempts >= MAX_MODERATION_ATTEMPTS,
      hasMedia: Boolean(post.mediaUrl),
      createdAt: post.createdAt,
    })),
  });
}
