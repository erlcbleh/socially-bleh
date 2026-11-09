import { prisma } from "../db/prisma.js";

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;
const TRENDING_WINDOW_MS = 72 * 60 * 60 * 1000;
const SAMPLE_LIMIT = 2000;
const MAX_TAGS_PER_POST = 5;
const MIN_DISTINCT_AUTHORS = 1;
const MIN_ACCOUNT_AGE_MS = 6 * 60 * 60 * 1000;
const HASHTAG_RE = /#[A-Za-z0-9_]+/g;

const cache = new Map();

function cached(key, load) {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    cache.delete(key);
    cache.set(key, existing);
    return existing.value;
  }

  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);

  let entry;
  const value = load().catch((error) => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  entry = { expiresAt: now + CACHE_TTL_MS, value };
  cache.set(key, entry);
  return value;
}

export async function trendingHashtags(req, res) {
  const limit = Math.min(Number(req.query.limit) || 6, 30);
  const now = Date.now();
  const since = new Date(now - TRENDING_WINDOW_MS);
  const newestAllowedAuthor = new Date(now - MIN_ACCOUNT_AGE_MS);

  const results = await cached(`${req.community.id}:${limit}`, async () => {
    const posts = await prisma.post.findMany({
      where: {
        communityId: req.community.id,
        deleted: false,
        parentPostId: null,
        moderationStatus: { not: "flagged" },
        createdAt: { gte: since },
        content: { contains: "#" },
        author: {
          status: "active",
          createdAt: { lte: newestAllowedAuthor },
        },
      },
      select: { content: true },
      orderBy: { createdAt: "desc" },
      take: SAMPLE_LIMIT,
    });

    const postsByTag = new Map();
    for (const post of posts) {
      const matches = post.content.match(HASHTAG_RE) || [];
      const uniqueTags = [...new Set(matches.map((m) => m.toLowerCase()))].slice(0, MAX_TAGS_PER_POST);
      for (const tag of uniqueTags) {
        postsByTag.set(tag, (postsByTag.get(tag) || 0) + 1);
      }
    }

    return [...postsByTag.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .filter((row) => row.count >= MIN_DISTINCT_AUTHORS)
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, limit);
  });

  res.json({ tags: results.map((r) => ({ tag: r.tag, count: r.count })) });
}
