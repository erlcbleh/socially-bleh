import { prisma } from "../db/prisma.js";
import { isValidObjectId } from "../lib/ids.js";
import { env } from "../config/env.js";
import { GLOBAL_SLUG } from "./globalCommunity.js";

const ROUTE = /^(?:\/c\/([^/]+))?\/@([A-Za-z0-9_]{1,32})(?:\/post\/([A-Za-z0-9]+))?\/?$/;

const STRIP = [
  /<title>[\s\S]*?<\/title>\s*/i,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<meta\s+property="og:[^"]*"[^>]*>\s*/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi,
];

const DEFAULT_IMAGE = `${env.clientUrl}/og-image.png`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function count(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function tags({ title, description, url, image, imageAlt, type = "website" }) {
  const card = image && image !== DEFAULT_IMAGE ? "summary_large_image" : "summary";
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    `<meta property="og:site_name" content="Socially" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt || title)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="${card}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt || title)}" />`,
  ];
  return lines.map((line) => `    ${line}`).join("\n");
}

function previewableCommunity(community) {
  return !!community && (community.isGlobal || community.joinPolicy === "open");
}

function postImage(post, author) {
  if (post.mediaUrl && post.mediaType === "image") return post.mediaUrl;
  if (post.gifUrl) return post.gifUrl;
  if (author.avatarUrl) return author.avatarUrl;
  return DEFAULT_IMAGE;
}

async function resolveProfile(author, community, url) {
  const name = `${author.displayName} (@${author.username})`;

  if (author.isPrivate) {
    return {
      title: name,
      description: "This account is private. Log in to Socially to request access.",
      url,
      image: DEFAULT_IMAGE,
      type: "profile",
    };
  }

  const membership = await prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: author.id } },
  });

  const stats = [
    `${count(author.followersCount)} followers`,
    `${count(author.followingCount)} following`,
    `${count(membership?.postsCount)} posts`,
  ].join(" · ");

  const bio = clamp(author.bio, 140);

  return {
    title: name,
    description: bio ? `${stats} - ${bio}` : stats,
    url,
    image: author.avatarUrl || DEFAULT_IMAGE,
    imageAlt: author.displayName,
    type: "profile",
  };
}

async function resolvePost(postId, author, community, url) {
  const query = isValidObjectId(postId)
    ? { id: postId, communityId: community.id }
    : { shortId: postId, communityId: community.id };

  const post = await prisma.post.findFirst({ where: query });
  if (!post || post.deleted) return null;
  if (post.moderationStatus !== "clear") return null;
  if (post.authorId !== author.id) return null;

  const body = clamp(post.content, 200);
  const stats = `${count(post.likesCount)} likes · ${count(post.commentsCount)} replies`;

  return {
    title: `${author.displayName} (@${author.username}) on Socially`,
    description: body || stats,
    url,
    image: postImage(post, author),
    imageAlt: body || `Post by @${author.username}`,
    type: "article",
  };
}

export async function buildMeta(pathname) {
  const match = ROUTE.exec(pathname);
  if (!match) return null;

  const [, slugRaw, username, postId] = match;
  const slug = (slugRaw || GLOBAL_SLUG).toLowerCase();

  const community = await prisma.community.findFirst({
    where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
  });
  if (!previewableCommunity(community)) return null;

  const author = await prisma.user.findFirst({ where: { username: username.toLowerCase() } });
  if (!author || author.status !== "active") return null;

  const memberOf = await prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: author.id } },
  });
  if (!memberOf || memberOf.status !== "active") return null;

  const url = `${env.clientUrl}${pathname}`;

  if (postId) {
    if (author.isPrivate) return null;
    return resolvePost(postId, author, community, url);
  }
  return resolveProfile(author, community, url);
}

export function injectMeta(html, meta) {
  let head = html;
  for (const pattern of STRIP) head = head.replace(pattern, "");
  return head.replace("</head>", `${tags(meta)}\n  </head>`);
}
