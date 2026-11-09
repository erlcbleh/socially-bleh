import { prisma } from "../db/prisma.js";

async function eligibleFriendIds(viewerId, targetId = null) {
  viewerId = String(viewerId);

  const myFollowing = await prisma.follow.findMany({
    where: { followerId: viewerId, status: "accepted" },
    select: { followingId: true },
  });
  let candidateIds = myFollowing.map((f) => f.followingId);
  if (!candidateIds.length) return [];

  if (targetId) {
    const followsTarget = await prisma.follow.findMany({
      where: {
        followerId: { in: candidateIds },
        followingId: String(targetId),
        status: "accepted",
      },
      select: { followerId: true },
    });
    candidateIds = followsTarget.map((f) => f.followerId);
    if (!candidateIds.length) return [];
  }

  const reciprocal = await prisma.follow.findMany({
    where: {
      followerId: { in: candidateIds },
      followingId: viewerId,
      status: "accepted",
    },
    select: { followerId: true },
  });
  candidateIds = reciprocal.map((f) => f.followerId);
  if (!candidateIds.length) return [];

  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: { in: candidateIds } },
        { blockerId: { in: candidateIds }, blockedId: viewerId },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set();
  for (const block of blocks) {
    blockedIds.add(block.blockerId);
    blockedIds.add(block.blockedId);
  }
  blockedIds.delete(viewerId);

  return candidateIds.filter((id) => !blockedIds.has(id));
}

export async function findMutualFriendUsers(viewerId, query) {
  const candidateIds = await eligibleFriendIds(viewerId);
  if (!candidateIds.length) return [];

  const trimmedQuery = String(query || "").trim();
  const where = { id: { in: candidateIds }, status: "active" };
  if (trimmedQuery) {
    where.OR = [
      { username: { contains: trimmedQuery, mode: "insensitive" } },
      { displayName: { contains: trimmedQuery, mode: "insensitive" } },
    ];
  }

  return prisma.user.findMany({ where, take: 50 });
}

export async function findMutualsWith(viewerId, targetId) {
  const candidateIds = await eligibleFriendIds(viewerId, targetId);
  if (!candidateIds.length) return { count: 0, users: [] };

  const [count, users] = await Promise.all([
    prisma.user.count({ where: { id: { in: candidateIds }, status: "active" } }),
    prisma.user.findMany({ where: { id: { in: candidateIds }, status: "active" }, take: 4 }),
  ]);

  return { count, users };
}
