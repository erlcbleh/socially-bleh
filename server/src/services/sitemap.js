import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

const ORIGIN = env.clientUrl;
const TTL_MS = 60 * 60 * 1000;

const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/explore", priority: "0.8", changefreq: "daily" },
  { path: "/login", priority: "0.4", changefreq: "monthly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
  { path: "/copyright", priority: "0.3", changefreq: "yearly" },
  { path: "/business-guidelines", priority: "0.3", changefreq: "yearly" },
  { path: "/applications", priority: "0.3", changefreq: "monthly" },
];

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlset(builder) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${builder}\n</urlset>`;
}

function urlTag(path, lastmod, priority, changefreq) {
  const lines = [`      <loc>${escapeXml(ORIGIN + path)}</loc>`];
  if (lastmod) lines.push(`      <lastmod>${new Date(lastmod).toISOString()}</lastmod>`);
  if (changefreq) lines.push(`      <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`      <priority>${priority}</priority>`);
  return `    <url>\n${lines.join("\n")}\n    </url>`;
}

const cache = new Map();

async function cached(name, builder) {
  const hit = cache.get(name);
  if (hit && hit.expiresAt > Date.now()) return hit.xml;
  const xml = await builder();
  cache.set(name, { xml, expiresAt: Date.now() + TTL_MS });
  return xml;
}

async function buildPages() {
  const urls = STATIC_PAGES.map((p) => urlTag(p.path, undefined, p.priority, p.changefreq));
  return urlset(urls.join("\n"));
}

async function buildProfiles() {
  const communities = await prisma.community.findMany({
    where: { OR: [{ isGlobal: true }, { joinPolicy: "open" }] },
    select: { id: true },
  });
  if (communities.length === 0) return urlset("");

  const users = await prisma.user.findMany({
    where: {
      status: "active",
      isPrivate: false,
      username: { not: null },
      memberships: {
        some: { communityId: { in: communities.map((c) => c.id) }, status: "active" },
      },
    },
    select: { username: true, updatedAt: true },
    orderBy: { followersCount: "desc" },
    take: 50000,
  });

  const urls = users.map((u) => urlTag(`/@${u.username}`, u.updatedAt, "0.6", "weekly"));
  return urlset(urls.join("\n"));
}

async function buildCommunities() {
  const communities = await prisma.community.findMany({
    where: { OR: [{ isGlobal: true }, { joinPolicy: "open" }] },
    select: { slug: true, updatedAt: true },
  });

  const urls = communities.map((c) => urlTag(`/c/${c.slug}`, c.updatedAt, "0.7", "daily"));
  return urlset(urls.join("\n"));
}

async function buildPosts() {
  const posts = await prisma.post.findMany({
    where: {
      deleted: false,
      moderationStatus: "clear",
      parentPostId: null,
      community: { OR: [{ isGlobal: true }, { joinPolicy: "open" }] },
      author: { status: "active", isPrivate: false },
    },
    select: {
      id: true,
      shortId: true,
      updatedAt: true,
      author: { select: { username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50000,
  });

  const urls = posts
    .filter((p) => p.author?.username)
    .map((p) => urlTag(`/@${p.author.username}/post/${p.shortId || p.id}`, p.updatedAt, "0.8", "daily"));
  return urlset(urls.join("\n"));
}

const BUILDERS = {
  pages: buildPages,
  profiles: buildProfiles,
  communities: buildCommunities,
  posts: buildPosts,
};

export function sitemapIndex() {
  const names = ["pages", "profiles", "communities", "posts"];
  const entries = names.map(
    (name) => `  <sitemap>\n    <loc>${escapeXml(`${ORIGIN}/sitemap-${name}.xml`)}</loc>\n  </sitemap>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`;
}

export async function getSitemap(name) {
  const builder = BUILDERS[name];
  if (!builder) return null;
  return cached(`sitemap:${name}`, builder);
}

export function robotsTxt({ staffHost }) {
  if (staffHost) {
    return "User-agent: *\nDisallow: /\n";
  }
  return [
    "# robots.txt for socially.lol",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /settings",
    "Disallow: /messages",
    "Disallow: /notifications",
    "Disallow: /bookmarks",
    "Disallow: /onboarding",
    "Disallow: /welcome",
    "Disallow: /invite/",
    "Disallow: /communities/new",
    "Disallow: /c/*/staff",
    "Disallow: /c/*/settings",
    "Disallow: /error/",
    "",
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}
