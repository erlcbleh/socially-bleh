import { prisma } from "../db/prisma.js";
import { POST_INCLUDE, hydratePosts, serializeUser } from "../services/hydrate.js";

const ANONYMOUS_ACTOR_TYPES = new Set([
  "verification_approved",
  "verification_rejected",
  "professional_approved",
  "professional_rejected",
  "community_verification_approved",
  "community_verification_rejected",
  "community_verification_invited",
  "report_actioned",
  "report_dismissed",
  "content_flagged",
  "content_flag_dismissed",
  "content_flag_actioned",
]);

function communityScope(communityId) {
  return {
    OR: [{ communityId }, { communityId: null }],
  };
}

export async function listNotifications(req, res) {
  const limit = Math.min(Number(req.query.limit) || 30, 50);
  const before = req.query.before ? new Date(req.query.before) : null;

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: req.user.id,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: true,
      community: true,
      post: { include: POST_INCLUDE },
    },
  });

  const postsToHydrate = notifications.filter((n) => n.post).map((n) => n.post);
  const hydratedPosts = await hydratePosts(postsToHydrate, req.user.id, req.community?.id || null);
  const postMap = new Map(hydratedPosts.map((p) => [p.id, p]));

  res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      actor: ANONYMOUS_ACTOR_TYPES.has(n.type) ? null : serializeUser(n.actor, {}),
      type: n.type,
      post: n.post ? postMap.get(n.post.id) || null : null,
      community: n.community
        ? {
            id: n.community.id,
            name: n.community.name,
            slug: n.community.slug,
            isGlobal: n.community.isGlobal,
          }
        : null,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
}

export async function unreadCount(req, res) {
  const count = await prisma.notification.count({
    where: {
      recipientId: req.user.id,
      read: false,
    },
  });
  res.json({ count });
}

export async function markAllRead(req, res) {
  await prisma.notification.updateMany({
    where: {
      recipientId: req.user.id,
      read: false,
    },
    data: { read: true },
  });
  res.json({ ok: true });
}
