import { prisma } from "../db/prisma.js";
import { POST_INCLUDE, hydratePosts, hydrateUsers } from "../services/hydrate.js";
import { moderationFilter, isStaffRole } from "../services/moderationVisibility.js";

async function searchCommunityUsers(communityId, query, limit) {
  const q = String(query || "").trim().slice(0, 50);
  if (!q) return [];

  const memberships = await prisma.communityMembership.findMany({
    where: {
      communityId,
      status: "active",
      user: {
        status: "active",
        username: { not: null },
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    include: { user: true },
    take: Math.min(Math.max(Number(limit) || 20, 1), 50),
  });

  return memberships.map((m) => m.user);
}

export async function search(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [], posts: [] });

  const viewerId = req.user.id;
  const communityId = req.community.id;
  const isStaff = isStaffRole(req.user.role) || ["owner", "staff"].includes(req.membership.role);

  const [users, posts] = await Promise.all([
    searchCommunityUsers(communityId, q, 10),
    prisma.post.findMany({
      where: {
        communityId,
        deleted: false,
        parentPostId: null,
        content: { contains: q, mode: "insensitive" },
        ...moderationFilter(viewerId, isStaff),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: POST_INCLUDE,
    }),
  ]);

  res.json({
    users: await hydrateUsers(users, viewerId, communityId),
    posts: await hydratePosts(posts, viewerId, communityId),
  });
}
