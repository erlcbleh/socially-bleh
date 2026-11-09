import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";

export async function requireCommunity(req, res, next) {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const community = await prisma.community.findFirst({
      where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
    });
    if (!community) return res.status(404).json({ message: "Community not found" });

    let membership = await prisma.communityMembership.findUnique({
      where: {
        communityId_userId: { communityId: community.id, userId: req.user.id },
      },
    });

    if (community.isGlobal && membership?.status === "kicked") {
      membership = await prisma.communityMembership.update({
        where: { id: membership.id },
        data: { status: "active", role: "member" },
      });
      await prisma.community.update({
        where: { id: community.id },
        data: { memberCount: { increment: 1 } },
      });
    } else if (!membership && community.isGlobal) {
      membership = await prisma.communityMembership.create({
        data: {
          id: newId(),
          communityId: community.id,
          userId: req.user.id,
          role: "member",
          status: "active",
        },
      });
      await prisma.community.update({
        where: { id: community.id },
        data: { memberCount: { increment: 1 } },
      });
    }

    if (membership?.status === "banned" && membership.bannedUntil && membership.bannedUntil <= new Date()) {
      membership = await prisma.communityMembership.update({
        where: { id: membership.id },
        data: {
          status: "kicked",
          bannedReason: null,
          bannedById: null,
          bannedUntil: null,
        },
      });
    }
    if (!membership || (membership.status !== "active" && membership.status !== "banned")) {
      return res.status(404).json({ message: "Community not found" });
    }

    req.community = community;
    req.membership = membership;
    next();
  } catch {
    res.status(404).json({ message: "Community not found" });
  }
}

export async function guestCommunity(req, res, next) {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const community = await prisma.community.findFirst({
      where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
    });
    if (!community || !community.isGlobal) {
      return res.status(404).json({ message: "Community not found" });
    }
    req.community = community;
    next();
  } catch {
    res.status(404).json({ message: "Community not found" });
  }
}

export function blockBannedMember(req, res, next) {
  if (req.membership?.status === "banned") {
    return res.status(403).json({
      message: "You are banned from this community.",
      bannedReason: req.membership.bannedReason,
      bannedUntil: req.membership.bannedUntil,
    });
  }
  next();
}

export function requireCommunityStaff(req, res, next) {
  const isCommunityStaff = req.membership && ["owner", "staff"].includes(req.membership.role);
  if (!isCommunityStaff) return res.status(403).json({ message: "Forbidden" });
  next();
}

export function requireCommunityOwner(req, res, next) {
  const isOwner = req.membership && req.membership.role === "owner";
  if (!isOwner) return res.status(403).json({ message: "Forbidden" });
  next();
}

export function rejectGlobalCommunity(req, res, next) {
  if (req.community?.isGlobal) {
    return res.status(403).json({ code: "global_community", message: "The global feed isn't a community and can't be configured." });
  }
  next();
}
