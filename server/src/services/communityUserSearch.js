import { prisma } from "../db/prisma.js";

export async function searchCommunityUsers(communityId, rawQuery, rawLimit) {
  const query = String(rawQuery || "").trim().slice(0, 50);
  if (!query) return [];

  const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 50);

  const memberships = await prisma.communityMembership.findMany({
    where: {
      communityId: String(communityId),
      status: "active",
      user: {
        status: "active",
        username: { not: null },
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
    },
    include: { user: true },
    take: limit,
  });

  return memberships.map((m) => m.user).filter(Boolean);
}
