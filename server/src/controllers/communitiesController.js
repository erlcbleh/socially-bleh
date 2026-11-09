import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { serializeUser } from "../services/hydrate.js";
import { logStaffAction } from "../services/auditLog.js";
import { notify } from "../services/notify.js";
import { isOwnMediaUrl } from "../services/r2.js";
import { guardText } from "../services/textGuard.js";
import { deleteCloudinaryAsset } from "../services/cloudinary.js";
import { encodeMemberCursor, parseMemberListQuery } from "../utils/memberPagination.js";
import { fetchDiscordWebhookInfo, parseDiscordWebhookUrl } from "../services/communityDiscordWebhook.js";

const PROFESSIONAL_CATEGORIES = ["Law Enforcement", "Fire Department", "DOT", "Business"];
const REVIEW_QUEUE_LIMIT = 200;

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "community"
  );
}

const MAX_PREVIOUS_SLUGS = 10;

async function slugTaken(slug, excludeId = null) {
  const where = { OR: [{ slug }, { previousSlugs: { has: slug } }] };
  if (excludeId) where.NOT = { id: excludeId };
  return !!(await prisma.community.findFirst({ where, select: { id: true } }));
}

async function generateUniqueSlug(name, excludeId = null) {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;

  for (;;) {
    if (!(await slugTaken(slug, excludeId))) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

const INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const INVITE_CODE_LENGTH = 10;

async function generateInviteCode() {
  let code;
  do {
    code = Array.from({ length: INVITE_CODE_LENGTH }, () => INVITE_CODE_CHARS[crypto.randomInt(INVITE_CODE_CHARS.length)]).join(
      ""
    );
  } while (await prisma.community.findFirst({ where: { inviteCode: code }, select: { id: true } }));
  return code;
}

function serializeCommunity(community, membership, followersCount = 0) {
  const canSeeCode = membership && ["owner", "staff"].includes(membership.role);
  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    logoUrl: community.logoUrl,
    inviteCode: canSeeCode ? community.inviteCode : undefined,
    joinPolicy: community.joinPolicy,
    isGlobal: !!community.isGlobal,
    memberCount: community.memberCount,
    postCount: community.postCount,
    ownerId: community.ownerId || null,
    myRole: membership?.role,
    myStatus: membership?.status,
    myProfessionalCategory: membership?.professionalCategory || null,
    myProfessionalReason: membership?.professionalReason || null,
    myProfessionalStatus: membership?.professionalStatus || "none",
    myProfessionalProfileId: membership?.professionalProfileUserId || null,
    myBannedReason: membership?.status === "banned" ? membership.bannedReason : null,
    myBannedUntil: membership?.status === "banned" ? membership.bannedUntil : null,
    verificationFollowerThreshold: community.verificationFollowerThreshold,
    verificationApplicationsOnly: community.verificationApplicationsOnly,
    myVerificationStatus: membership?.verificationStatus || "none",
    myVerificationReason: membership?.verificationReason || null,
    myFollowersCount: followersCount || 0,
    hasDiscordWebhook: !!community.discordWebhookUrl,
    discordWebhookChannelId: community.discordWebhookChannelId || null,
    discordWebhookChannelName: community.discordWebhookChannelName || null,
    createdAt: community.createdAt,
  };
}

function canApplyForCommunityVerification(community, followersCount) {
  if (community.verificationApplicationsOnly) return true;
  return (followersCount || 0) < community.verificationFollowerThreshold;
}

export async function createCommunity(req, res) {
  if (req.user.accountKind === "professional" || req.user.accountKind === "business") {
    return res.status(403).json({ message: "Only personal accounts can create communities." });
  }

  const name = String(req.body.name || "").trim();
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ message: "Community name must be 2-50 characters." });
  }
  const description = String(req.body.description || "").trim().slice(0, 300);
  const logoUrl = String(req.body.logoUrl || "").trim().slice(0, 500);
  if (logoUrl && !isOwnMediaUrl(logoUrl)) {
    return res.status(400).json({ message: "Invalid logo URL" });
  }

  const guard = await guardText([name, description].filter(Boolean).join("\n"), {
    authorId: req.user.id,
    snapshotLabel: "community details",
    failClosed: false,
  });
  if (guard.blocked) {
    return res.status(400).json({ code: "content_blocked", message: guard.message });
  }

  const slug = await generateUniqueSlug(name);
  const inviteCode = await generateInviteCode();

  const community = await prisma.community.create({
    data: { id: newId(), name, slug, description, logoUrl, inviteCode, ownerId: req.user.id },
  });
  const membership = await prisma.communityMembership.create({
    data: {
      id: newId(),
      communityId: community.id,
      userId: req.user.id,
      role: "owner",
      status: "active",
    },
  });

  res.status(201).json({ community: serializeCommunity(community, membership, req.user.followersCount) });
}

export async function listMyCommunities(req, res) {
  const memberships = await prisma.communityMembership.findMany({
    where: { userId: req.user.id, status: { in: ["active", "banned"] } },
    orderBy: { updatedAt: "desc" },
    include: { community: true },
  });

  res.json({
    communities: memberships.filter((m) => m.community).map((m) => serializeCommunity(m.community, m, req.user.followersCount)),
  });
}

async function joinAsMember(req, res, community) {
  let membership = await prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });

  if (membership?.status === "banned") {
    return res.status(403).json({ message: "You've been banned from this community." });
  }

  if (membership) {
    if (membership.status !== "active") {
      membership = await prisma.communityMembership.update({
        where: { id: membership.id },
        data: { status: "active", role: "member" },
      });
      community = await prisma.community.update({
        where: { id: community.id },
        data: { memberCount: { increment: 1 } },
      });
    }
  } else {
    membership = await prisma.communityMembership.create({
      data: {
        id: newId(),
        communityId: community.id,
        userId: req.user.id,
        role: "member",
        status: "active",
      },
    });
    community = await prisma.community.update({
      where: { id: community.id },
      data: { memberCount: { increment: 1 } },
    });
  }

  res.json({ community: serializeCommunity(community, membership, req.user.followersCount) });
}

export async function joinCommunity(req, res) {
  if (req.user.accountKind === "professional" || req.user.accountKind === "business") {
    return res.status(403).json({ message: "Only personal accounts can join communities." });
  }

  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ message: "An invite code is required." });

  const community = await prisma.community.findFirst({ where: { inviteCode: code } });
  if (!community) return res.status(404).json({ message: "Invalid invite code." });

  return joinAsMember(req, res, community);
}

export async function joinOpenCommunity(req, res) {
  if (req.user.accountKind === "professional" || req.user.accountKind === "business") {
    return res.status(403).json({ message: "Only personal accounts can join communities." });
  }

  const slug = String(req.params.slug || "").toLowerCase();
  const community = await prisma.community.findFirst({
    where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
  });
  if (!community) return res.status(404).json({ message: "Community not found" });
  if (community.joinPolicy !== "open") {
    return res.status(403).json({ message: "This community can only be joined with an invite code." });
  }

  return joinAsMember(req, res, community);
}

export async function discoverCommunities(req, res) {
  const q = String(req.query.q || "").trim();
  const where = { joinPolicy: "open", isGlobal: false };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const communities = await prisma.community.findMany({
    where,
    orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const memberships = await prisma.communityMembership.findMany({
    where: { userId: req.user.id, communityId: { in: communities.map((c) => c.id) } },
  });
  const statusFor = new Map(memberships.map((m) => [m.communityId, m.status]));

  res.json({
    communities: communities.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      logoUrl: c.logoUrl,
      memberCount: c.memberCount,
      myStatus: statusFor.get(c.id) || null,
    })),
  });
}

export async function previewInvite(req, res) {
  const code = String(req.params.code || "").trim().toUpperCase();
  const community = await prisma.community.findFirst({ where: { inviteCode: code } });
  if (!community) return res.status(404).json({ message: "This invite link is invalid or has expired." });

  res.json({
    community: {
      id: community.id,
      name: community.name,
      slug: community.slug,
      description: community.description,
      logoUrl: community.logoUrl,
      memberCount: community.memberCount,
    },
  });
}

export async function getCommunity(req, res) {
  res.json({ community: serializeCommunity(req.community, req.membership) });
}

export async function updateCommunity(req, res) {
  const { name, description, logoUrl, verificationFollowerThreshold, verificationApplicationsOnly, joinPolicy } = req.body;
  const community = req.community;

  const proposed = [
    name !== undefined && String(name).trim() !== community.name ? String(name).trim() : null,
    description !== undefined && String(description).trim() !== community.description ? String(description).trim() : null,
  ].filter(Boolean);

  if (proposed.length) {
    const guard = await guardText(proposed.join("\n"), {
      authorId: req.user.id,
      community: community.id,
      snapshotLabel: "community details",
      failClosed: false,
    });
    if (guard.blocked) {
      return res.status(400).json({ code: "content_blocked", message: guard.message });
    }
  }

  const data = {};

  if (name !== undefined) {
    const value = String(name).trim();
    if (value.length < 2 || value.length > 50) {
      return res.status(400).json({ message: "Community name must be 2-50 characters." });
    }

    if (value !== community.name) {
      data.name = value;

      if (!community.isGlobal) {
        const nextSlug = await generateUniqueSlug(value, community.id);
        if (nextSlug !== community.slug) {
          data.previousSlugs = [community.slug, ...community.previousSlugs.filter((s) => s !== nextSlug)].slice(
            0,
            MAX_PREVIOUS_SLUGS
          );
          data.slug = nextSlug;
        }
      }
    }
  }
  if (description !== undefined) data.description = String(description).trim().slice(0, 300);

  let previousLogoUrl = null;
  if (logoUrl !== undefined) {
    if (community.isGlobal) {
      return res.status(400).json({ message: "The global community logo can't be changed." });
    }
    const value = String(logoUrl).trim().slice(0, 500);
    if (value && !isOwnMediaUrl(value)) {
      return res.status(400).json({ message: "Invalid logo URL" });
    }
    if (value !== community.logoUrl) {
      previousLogoUrl = community.logoUrl;
      data.logoUrl = value;
    }
  }
  if (verificationFollowerThreshold !== undefined) {
    const value = Number(verificationFollowerThreshold);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ message: "Follower threshold must be a non-negative number." });
    }
    data.verificationFollowerThreshold = Math.round(value);
  }
  if (verificationApplicationsOnly !== undefined) {
    data.verificationApplicationsOnly = !!verificationApplicationsOnly;
  }
  if (joinPolicy !== undefined) {
    if (!["open", "invite"].includes(joinPolicy)) {
      return res.status(400).json({ message: "Join policy must be 'open' or 'invite'." });
    }
    data.joinPolicy = joinPolicy;
  }

  const updated = await prisma.community.update({ where: { id: community.id }, data });
  if (previousLogoUrl) await deleteCloudinaryAsset(previousLogoUrl);

  res.json({ community: serializeCommunity(updated, req.membership) });
}

export async function setCommunityDiscordWebhook(req, res) {
  const community = req.community;
  const webhookUrl = parseDiscordWebhookUrl(req.body?.webhookUrl);
  if (!webhookUrl) {
    return res.status(400).json({ message: "Enter a valid Discord webhook URL." });
  }

  const info = await fetchDiscordWebhookInfo(webhookUrl);
  if (!info) {
    return res.status(400).json({ message: "That webhook doesn't exist. Check the URL and try again." });
  }

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: {
      discordWebhookUrl: webhookUrl,
      discordWebhookChannelId: info.channelId || null,
      discordWebhookChannelName: info.channelName || null,
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "set_discord_webhook",
    targetType: "community",
    targetId: community.id,
    targetLabel: community.name,
    community: community.id,
  });

  res.json({ community: serializeCommunity(updated, req.membership) });
}

export async function removeCommunityDiscordWebhook(req, res) {
  const community = req.community;

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: {
      discordWebhookUrl: null,
      discordWebhookChannelId: null,
      discordWebhookChannelName: null,
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "remove_discord_webhook",
    targetType: "community",
    targetId: community.id,
    targetLabel: community.name,
    community: community.id,
  });

  res.json({ community: serializeCommunity(updated, req.membership) });
}

export async function regenerateInviteCode(req, res) {
  const inviteCode = await generateInviteCode();
  const updated = await prisma.community.update({
    where: { id: req.community.id },
    data: { inviteCode },
  });
  res.json({ community: serializeCommunity(updated, req.membership) });
}

const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

export async function setInviteCode(req, res) {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!INVITE_CODE_PATTERN.test(code)) {
    return res.status(400).json({ message: "Invite codes must be 6-12 letters and numbers." });
  }

  const taken = await prisma.community.findFirst({
    where: { inviteCode: code, NOT: { id: req.community.id } },
    select: { id: true },
  });
  if (taken) return res.status(409).json({ message: "That invite code is already in use." });

  const updated = await prisma.community.update({
    where: { id: req.community.id },
    data: { inviteCode: code },
  });
  res.json({ community: serializeCommunity(updated, req.membership) });
}

export async function leaveCommunity(req, res) {
  if (req.community.isGlobal) {
    return res.status(400).json({ message: "You can't leave the global feed." });
  }
  if (req.membership.role === "owner") {
    return res.status(400).json({ message: "The owner can't leave a community." });
  }

  await prisma.communityMembership.update({
    where: { id: req.membership.id },
    data: { status: "kicked" },
  });
  await prisma.community.update({
    where: { id: req.community.id },
    data: { memberCount: { decrement: 1 } },
  });

  res.json({ ok: true });
}

export async function deleteCommunity(req, res) {
  if (req.community.isGlobal) {
    return res.status(400).json({ message: "You cannot delete the global feed." });
  }
  if (req.membership.role !== "owner") {
    return res.status(403).json({ message: "Only the community owner can delete this community." });
  }

  await prisma.community.delete({
    where: { id: req.community.id },
  });

  res.json({ ok: true });
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function isMemberOnline(user) {
  return !!user.lastActiveAt && Date.now() - user.lastActiveAt.getTime() <= ONLINE_THRESHOLD_MS;
}

function memberCursorWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { role: { gt: cursor.role } },
      { role: cursor.role, createdAt: { gt: cursor.createdAt } },
      { role: cursor.role, createdAt: cursor.createdAt, id: { gt: cursor.id } },
    ],
  };
}

export async function listMembers(req, res) {
  let options;
  try {
    options = parseMemberListQuery(req.query);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const statusFilter = options.status ? { status: options.status } : { status: { in: ["active", "banned"] } };
  const where = {
    communityId: req.community.id,
    ...statusFilter,
    ...memberCursorWhere(options.cursor),
  };

  if (options.q) {
    where.user = {
      OR: [
        { username: { contains: options.q, mode: "insensitive" } },
        { displayName: { contains: options.q, mode: "insensitive" } },
      ],
    };
  }

  const onlineSince = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const [memberships, totalMembers, onlineCount] = await Promise.all([
    prisma.communityMembership.findMany({
      where,
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: options.limit + 1,
    }),
    prisma.communityMembership.count({
      where: { communityId: req.community.id, status: "active" },
    }),
    prisma.communityMembership.count({
      where: {
        communityId: req.community.id,
        status: "active",
        user: { lastActiveAt: { gte: onlineSince } },
      },
    }),
  ]);

  const hasMore = memberships.length > options.limit;
  const page = memberships.slice(0, options.limit);
  const lastMember = page.at(-1);

  res.json({
    totalMembers,
    onlineMembers: onlineCount,
    members: page
      .filter((m) => m.user?.id)
      .map((m) => ({
        ...serializeUser(m.user, {}, m),
        membershipStatus: m.status,
        isOnline: isMemberOnline(m.user),
      })),
    hasMore,
    nextCursor: hasMore ? encodeMemberCursor(lastMember) : null,
  });
}

async function loadTargetMembership(req) {
  const target = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
  });
  if (!target) return null;
  const membership = await prisma.communityMembership.findFirst({
    where: { communityId: req.community.id, userId: target.id },
  });
  return membership ? { target, membership } : null;
}

export async function kickMember(req, res) {
  const found = await loadTargetMembership(req);
  if (!found) return res.status(404).json({ message: "Member not found" });
  const { target, membership } = found;
  if (membership.role === "owner") return res.status(400).json({ message: "Can't kick the owner." });
  if (target.id === req.user.id) return res.status(400).json({ message: "You can't kick yourself." });

  const wasActive = membership.status === "active";
  await prisma.communityMembership.update({
    where: { id: membership.id },
    data: { status: "kicked" },
  });
  if (wasActive) {
    await prisma.community.update({
      where: { id: req.community.id },
      data: { memberCount: { decrement: 1 } },
    });
  }

  const isCommunityStaff = ["owner", "staff"].includes(req.membership.role);
  await logStaffAction({
    staffId: req.user.id,
    action: "kick_member",
    targetType: "user",
    targetId: target.id,
    targetUser: target.id,
    targetLabel: `@${target.username}`,
    community: isCommunityStaff ? req.community.id : null,
  });

  res.json({ ok: true });
}

export async function banMember(req, res) {
  const found = await loadTargetMembership(req);
  if (!found) return res.status(404).json({ message: "Member not found" });
  const { target, membership } = found;
  if (membership.role === "owner") return res.status(400).json({ message: "Can't ban the owner." });
  if (target.id === req.user.id) return res.status(400).json({ message: "You can't ban yourself." });

  const reason = String(req.body.reason || "").trim();
  const until = req.body.until ? new Date(req.body.until) : null;
  if (until && Number.isNaN(until.getTime())) return res.status(400).json({ message: "Invalid ban duration" });

  const wasActive = membership.status === "active";
  await prisma.communityMembership.update({
    where: { id: membership.id },
    data: {
      status: "banned",
      bannedReason: reason || null,
      bannedById: req.user.id,
      bannedUntil: until,
    },
  });
  if (wasActive) {
    await prisma.community.update({
      where: { id: req.community.id },
      data: { memberCount: { decrement: 1 } },
    });
  }

  await logStaffAction({
    staffId: req.user.id,
    action: "ban_member",
    targetType: "user",
    targetId: target.id,
    targetUser: target.id,
    targetLabel: `@${target.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
    meta: { reason: reason || undefined, until: until || undefined },
  });

  res.json({ ok: true });
}

export async function unbanMember(req, res) {
  const found = await loadTargetMembership(req);
  if (!found) return res.status(404).json({ message: "Member not found" });
  const { target, membership } = found;

  const wasBanned = membership.status === "banned";
  await prisma.communityMembership.update({
    where: { id: membership.id },
    data: {
      status: "active",
      bannedReason: null,
      bannedById: null,
      bannedUntil: null,
    },
  });
  if (wasBanned) {
    await prisma.community.update({
      where: { id: req.community.id },
      data: { memberCount: { increment: 1 } },
    });
  }

  await logStaffAction({
    staffId: req.user.id,
    action: "unban_member",
    targetType: "user",
    targetId: target.id,
    targetUser: target.id,
    targetLabel: `@${target.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
  });

  res.json({ ok: true });
}

export async function promoteStaff(req, res) {
  const found = await loadTargetMembership(req);
  if (!found) return res.status(404).json({ message: "Member not found" });
  const { target, membership } = found;
  if (membership.status !== "active") return res.status(400).json({ message: "That user isn't an active member." });
  if (membership.role === "owner") return res.status(400).json({ message: "That user is already the owner." });

  await prisma.communityMembership.update({
    where: { id: membership.id },
    data: { role: "staff" },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "promote_staff",
    targetType: "user",
    targetId: target.id,
    targetUser: target.id,
    targetLabel: `@${target.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
  });

  res.json({ ok: true });
}

export async function demoteStaff(req, res) {
  const found = await loadTargetMembership(req);
  if (!found) return res.status(404).json({ message: "Member not found" });
  const { target, membership } = found;
  if (membership.role !== "staff") return res.status(400).json({ message: "That user isn't staff." });

  await prisma.communityMembership.update({
    where: { id: membership.id },
    data: { role: "member" },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "demote_staff",
    targetType: "user",
    targetId: target.id,
    targetUser: target.id,
    targetLabel: `@${target.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
  });

  res.json({ ok: true });
}

export async function applyProfessional(req, res) {
  const { category, reason } = req.body;
  if (!PROFESSIONAL_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Invalid professional category." });
  }
  const trimmedReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";

  const membership = await prisma.communityMembership.update({
    where: { id: req.membership.id },
    data: {
      professionalCategory: category,
      professionalReason: trimmedReason || null,
      professionalStatus: "pending",
      professionalReviewedById: null,
      professionalReviewedAt: null,
    },
  });

  res.json({ community: serializeCommunity(req.community, membership) });
}

export async function listProfessionalApplications(req, res) {
  const memberships = await prisma.communityMembership.findMany({
    where: { communityId: req.community.id, professionalStatus: "pending" },
    orderBy: { updatedAt: "asc" },
    take: REVIEW_QUEUE_LIMIT,
    include: { user: true },
  });

  res.json({
    applications: memberships
      .filter((m) => m.user)
      .map((m) => ({
        membershipId: m.id,
        user: serializeUser(m.user, {}, m),
        category: m.professionalCategory,
        reason: m.professionalReason || null,
        createdAt: m.updatedAt,
      })),
  });
}

export async function decideProfessionalApplication(req, res) {
  const { action } = req.body;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Invalid action" });

  const membership = await prisma.communityMembership.findFirst({
    where: {
      id: req.params.membershipId,
      communityId: req.community.id,
      professionalStatus: "pending",
    },
    include: { user: true },
  });
  if (!membership) return res.status(404).json({ message: "Application not found" });

  if (action === "approve") {
    const applicant = membership.user;
    const professionalUser = await prisma.user.create({
      data: {
        id: newId(),
        discordId: applicant.discordId,
        discordUsername: applicant.discordUsername,
        accountKind: "professional",
        professionalCommunityId: req.community.id,
      },
    });

    await prisma.communityMembership.create({
      data: {
        id: newId(),
        communityId: req.community.id,
        userId: professionalUser.id,
        role: "member",
        status: "active",
        professionalCategory: membership.professionalCategory,
        professionalReason: membership.professionalReason,
        professionalStatus: "approved",
        professionalReviewedById: req.user.id,
        professionalReviewedAt: new Date(),
      },
    });

    await prisma.communityMembership.update({
      where: { id: membership.id },
      data: {
        professionalStatus: "spun_off",
        professionalProfileUserId: professionalUser.id,
        professionalReviewedById: req.user.id,
        professionalReviewedAt: new Date(),
      },
    });
  } else {
    await prisma.communityMembership.update({
      where: { id: membership.id },
      data: {
        professionalStatus: "rejected",
        professionalReviewedById: req.user.id,
        professionalReviewedAt: new Date(),
      },
    });
  }

  await logStaffAction({
    staffId: req.user.id,
    action: action === "approve" ? "approve_professional" : "reject_professional",
    targetType: "user",
    targetId: membership.user.id,
    targetUser: membership.user.id,
    targetLabel: `@${membership.user.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
    meta: { category: membership.professionalCategory },
  });

  await notify({
    recipient: membership.user.id,
    actor: req.user.id,
    type: action === "approve" ? "professional_approved" : "professional_rejected",
    community: req.community.id,
  });

  res.json({ ok: true });
}

export async function applyCommunityVerification(req, res) {
  const membership = req.membership;
  if (membership.verificationStatus === "approved") {
    return res.status(409).json({ message: "You're already verified in this community." });
  }
  if (membership.verificationStatus === "pending") {
    return res.status(409).json({ message: "You already have a pending application." });
  }
  if (membership.verificationStatus === "invited") {
    return res.status(400).json({ message: "You have a pending invitation, accept or decline it instead." });
  }
  if (!canApplyForCommunityVerification(req.community, req.user.followersCount)) {
    return res.status(403).json({ message: "You meet this community's follower threshold, staff must invite you instead." });
  }

  const reason = String(req.body.reason || "").trim().slice(0, 500);
  if (!reason) return res.status(400).json({ message: "Reason is required" });

  const updated = await prisma.communityMembership.update({
    where: { id: membership.id },
    data: {
      verificationReason: reason,
      verificationStatus: "pending",
      verificationReviewedById: null,
      verificationReviewedAt: null,
    },
  });

  res.json({ community: serializeCommunity(req.community, updated) });
}

export async function respondCommunityVerificationInvite(req, res) {
  const membership = req.membership;
  if (membership.verificationStatus !== "invited") {
    return res.status(400).json({ message: "You don't have a pending invitation." });
  }

  const updated = await prisma.communityMembership.update({
    where: { id: membership.id },
    data:
      req.body.action === "accept"
        ? {
            verificationStatus: "approved",
            verificationReviewedById: membership.verificationInvitedById,
            verificationReviewedAt: new Date(),
          }
        : {
            verificationStatus: "none",
            verificationInvitedById: null,
          },
  });

  res.json({ community: serializeCommunity(req.community, updated) });
}

export async function listCommunityVerificationApplications(req, res) {
  const memberships = await prisma.communityMembership.findMany({
    where: { communityId: req.community.id, verificationStatus: "pending" },
    orderBy: { updatedAt: "asc" },
    take: REVIEW_QUEUE_LIMIT,
    include: { user: true },
  });

  res.json({
    applications: memberships
      .filter((m) => m.user)
      .map((m) => ({
        membershipId: m.id,
        user: serializeUser(m.user, {}, m),
        reason: m.verificationReason || null,
        createdAt: m.updatedAt,
      })),
  });
}

export async function decideCommunityVerificationApplication(req, res) {
  const { action } = req.body;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Invalid action" });

  const membership = await prisma.communityMembership.findFirst({
    where: {
      id: req.params.membershipId,
      communityId: req.community.id,
      verificationStatus: "pending",
    },
    include: { user: true },
  });
  if (!membership) return res.status(404).json({ message: "Application not found" });
  if (membership.user.id === req.user.id) {
    return res.status(403).json({ message: "You can't review your own application." });
  }

  const updated = await prisma.communityMembership.update({
    where: { id: membership.id },
    data: {
      verificationStatus: action === "approve" ? "approved" : "rejected",
      verificationReviewedById: req.user.id,
      verificationReviewedAt: new Date(),
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: action === "approve" ? "approve_community_verification" : "reject_community_verification",
    targetType: "user",
    targetId: membership.user.id,
    targetUser: membership.user.id,
    targetLabel: `@${membership.user.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
    meta: { reason: updated.verificationReason || undefined },
  });

  await notify({
    recipient: membership.user.id,
    actor: req.user.id,
    type: action === "approve" ? "community_verification_approved" : "community_verification_rejected",
    community: req.community.id,
  });

  res.json({ ok: true });
}

export async function inviteCommunityVerification(req, res) {
  const found = await loadTargetMembership(req);
  if (!found) return res.status(404).json({ message: "Member not found" });
  const { target, membership } = found;

  if (target.id === req.user.id) {
    return res.status(400).json({ message: "You can't invite yourself." });
  }
  if (req.community.verificationApplicationsOnly) {
    return res.status(400).json({ message: "This community only accepts verification applications." });
  }
  if ((target.followersCount || 0) < req.community.verificationFollowerThreshold) {
    return res.status(400).json({ message: "This member doesn't meet the follower threshold." });
  }
  if (membership.verificationStatus === "approved") {
    return res.status(409).json({ message: "This member is already verified." });
  }

  await prisma.communityMembership.update({
    where: { id: membership.id },
    data: {
      verificationStatus: "invited",
      verificationInvitedById: req.user.id,
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "invite_community_verification",
    targetType: "user",
    targetId: target.id,
    targetUser: target.id,
    targetLabel: `@${target.username}`,
    community: ["owner", "staff"].includes(req.membership.role) ? req.community.id : null,
  });

  await notify({
    recipient: target.id,
    actor: req.user.id,
    type: "community_verification_invited",
    community: req.community.id,
  });

  res.json({ ok: true });
}

export async function listCommunityAuditLog(req, res) {
  const entries = await prisma.staffAuditLog.findMany({
    where: { communityId: req.community.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { staff: true, targetUser: true },
  });

  res.json({
    entries: entries.map((e) => ({
      id: e.id,
      staff: e.staff ? serializeUser(e.staff, {}) : null,
      action: e.action,
      targetType: e.targetType,
      targetUser: e.targetUser ? serializeUser(e.targetUser, {}) : null,
      targetLabel: e.targetLabel,
      meta: e.meta,
      createdAt: e.createdAt,
    })),
  });
}
