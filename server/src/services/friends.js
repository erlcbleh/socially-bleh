import { prisma } from "../db/prisma.js";

export async function areFriends(a, b, communityId = null) {
  const scope = communityId ? { communityId: String(communityId) } : {};
  const [aFollowsB, bFollowsA] = await Promise.all([
    prisma.follow.findFirst({
      where: { followerId: String(a), followingId: String(b), status: "accepted", ...scope },
      select: { id: true },
    }),
    prisma.follow.findFirst({
      where: { followerId: String(b), followingId: String(a), status: "accepted", ...scope },
      select: { id: true },
    }),
  ]);
  return !!aFollowsB && !!bFollowsA;
}
