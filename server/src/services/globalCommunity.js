import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";

export const GLOBAL_SLUG = "global";

export async function ensureGlobalCommunity() {
  const existing = await prisma.community.findUnique({ where: { slug: GLOBAL_SLUG } });
  if (existing) {
    if (!existing.isGlobal) {
      return prisma.community.update({ where: { id: existing.id }, data: { isGlobal: true } });
    }
    return existing;
  }

  return prisma.community.create({
    data: {
      id: newId(),
      name: "Global",
      slug: GLOBAL_SLUG,
      description: "The main feed. Everyone on Socially is here.",
      inviteCode: "GLOBAL",
      joinPolicy: "open",
      isGlobal: true,
      ownerId: null,
      memberCount: 0,
    },
  });
}

let globalCommunityId = null;

export async function getGlobalCommunityId() {
  if (globalCommunityId) return globalCommunityId;
  const community = await prisma.community.findUnique({
    where: { slug: GLOBAL_SLUG },
    select: { id: true },
  });
  globalCommunityId = community?.id || null;
  return globalCommunityId;
}

export async function ensureGlobalMembership(userId) {
  const community = await prisma.community.findUnique({ where: { slug: GLOBAL_SLUG } });
  if (!community) return null;

  const existing = await prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: String(userId) } },
  });
  if (existing) return existing;

  const membership = await prisma.communityMembership.create({
    data: {
      id: newId(),
      communityId: community.id,
      userId: String(userId),
      role: "member",
      status: "active",
    },
  });
  await prisma.community.update({
    where: { id: community.id },
    data: { memberCount: { increment: 1 } },
  });

  return membership;
}
