import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { isOwnMediaUrl } from "../services/r2.js";
import { guardText } from "../services/textGuard.js";
import { serializeUser } from "../services/hydrate.js";
import { notify } from "../services/notify.js";
import { logStaffAction } from "../services/auditLog.js";
import { reverseAuditEntry, findLatestReversibleEntry } from "../services/staffReversal.js";
import { ensureGlobalMembership } from "../services/globalCommunity.js";
import {
  BUSINESS_MIN_MEMBERS,
  meetsMemberRequirement,
  resolveDiscordInvite,
} from "../services/discordInvite.js";
import {
  USERNAME_RE,
  normalizeUsername,
  isReserved,
  isBlockedUsername,
  isUsernameTaken,
} from "../services/username.js";

function isPersonalAccount(user) {
  return !user.accountKind || user.accountKind === "personal";
}

async function allocateBusinessUsername(name) {
  let base = normalizeUsername(String(name || "").replace(/[^a-zA-Z0-9_]+/g, ""));
  if (base.length < 3) base = `biz${base}00`.slice(0, 20);
  if (!/^[a-zA-Z0-9]/.test(base)) base = `b${base}`.slice(0, 20);
  if (!/[a-zA-Z0-9]$/.test(base)) base = `${base.slice(0, 19)}0`;
  base = base.slice(0, 20);
  if (!USERNAME_RE.test(base)) {
    base = `biz${Date.now().toString(36)}`.slice(0, 20);
  }

  let candidate = base;
  let n = 0;
  while (
    !USERNAME_RE.test(candidate) ||
    isReserved(candidate) ||
    isBlockedUsername(candidate) ||
    (await isUsernameTaken(candidate))
  ) {
    n += 1;
    const suffix = String(n);
    candidate = `${base.slice(0, Math.max(3, 20 - suffix.length))}${suffix}`.slice(0, 20);
    if (n > 9999) {
      candidate = `biz${newId().slice(0, 16)}`;
      break;
    }
  }
  return candidate;
}

function serializeApplication(app) {
  return {
    id: app.id,
    name: app.name,
    bio: app.bio,
    logoUrl: app.logoUrl,
    bannerUrl: app.bannerUrl,
    status: app.status,
    staffNote: app.staffNote || "",
    businessUserId: app.businessUserId || null,
    createdAt: app.createdAt,
    reviewedAt: app.reviewedAt || null,
    discord: {
      inviteUrl: app.discordInviteUrl || "",
      guildId: app.discordGuildId || null,
      guildName: app.discordGuildName || "",
      guildIconUrl: app.discordGuildIconUrl || "",
      memberCount: app.discordMemberCount || 0,
      presenceCount: app.discordPresenceCount || 0,
      checkedAt: app.discordCheckedAt || null,
    },
    guidelinesAcceptedAt: app.guidelinesAcceptedAt || null,
  };
}

const ATTESTATIONS = [
  { id: "erlcRelated", label: "The server is about ERLC content." },
  { id: "activity", label: "The server has consistent, genuine activity." },
  { id: "staffing", label: "The server has a professional, active staff team." },
  { id: "guidelines", label: "The server follows the Business Guidelines and Discord's Terms of Service." },
];

function missingAttestations(raw) {
  const provided = raw && typeof raw === "object" ? raw : {};
  return ATTESTATIONS.filter((item) => provided[item.id] !== true).map((item) => item.label);
}

async function verifyInviteForApplicant(rawInvite, applicantId) {
  const result = await resolveDiscordInvite(rawInvite);
  if (!result.ok) {
    return { error: { status: 400, body: { code: result.reason, message: result.message } } };
  }

  if (!meetsMemberRequirement(result.memberCount)) {
    return {
      error: {
        status: 400,
        body: {
          code: "not_enough_members",
          message: `Your server needs at least ${BUSINESS_MIN_MEMBERS} members. ${result.guildName || "That server"} has ${result.memberCount}.`,
          discord: result,
        },
      },
    };
  }

  const claimed = await prisma.businessApplication.findFirst({
    where: {
      discordGuildId: result.guildId,
      status: { in: ["pending", "approved"] },
      ...(applicantId ? { applicantId: { not: applicantId } } : {}),
    },
    select: { id: true },
  });
  if (claimed) {
    return {
      error: {
        status: 409,
        body: {
          code: "server_already_applied",
          message: "That Discord server is already tied to another business application.",
        },
      },
    };
  }

  return { discord: result };
}

export async function checkBusinessInvite(req, res) {
  const outcome = await verifyInviteForApplicant(req.body.discordInvite, req.actorId || req.user.id);
  if (outcome.error) return res.status(outcome.error.status).json(outcome.error.body);

  const { discord } = outcome;
  res.json({
    ok: true,
    minMembers: BUSINESS_MIN_MEMBERS,
    requirements: ATTESTATIONS,
    discord: {
      inviteUrl: discord.inviteUrl,
      guildId: discord.guildId,
      guildName: discord.guildName,
      guildIconUrl: discord.guildIconUrl,
      memberCount: discord.memberCount,
      presenceCount: discord.presenceCount,
    },
  });
}

export async function applyBusiness(req, res) {
  if (!isPersonalAccount(req.user)) {
    return res.status(403).json({ message: "Apply from your personal account." });
  }

  const pending = await prisma.businessApplication.findFirst({
    where: { applicantId: req.user.id, status: "pending" },
  });
  if (pending) {
    return res.status(409).json({ message: "You already have a pending business application." });
  }

  const outcome = await verifyInviteForApplicant(req.body.discordInvite, req.user.id);
  if (outcome.error) return res.status(outcome.error.status).json(outcome.error.body);
  const { discord } = outcome;

  const unmet = missingAttestations(req.body.requirements);
  if (unmet.length) {
    return res.status(400).json({
      code: "requirements_not_met",
      message: "Confirm every requirement before applying.",
      unmet,
    });
  }

  const name = String(req.body.name || "").trim();
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ message: "Business name must be 2-50 characters." });
  }
  const bio = String(req.body.bio || "").trim().slice(0, 160);
  const logoUrl = String(req.body.logoUrl || "").trim().slice(0, 500);
  const bannerUrl = String(req.body.bannerUrl || "").trim().slice(0, 500);

  if (logoUrl && !isOwnMediaUrl(logoUrl)) {
    return res.status(400).json({ message: "Invalid logo URL" });
  }
  if (bannerUrl && !isOwnMediaUrl(bannerUrl)) {
    return res.status(400).json({ message: "Invalid banner URL" });
  }

  try {
    const guard = await guardText([name, bio].filter(Boolean).join("\n"), {
      authorId: req.user.id,
      snapshotLabel: "business application",
    });
    if (guard?.blocked) {
      return res.status(400).json({ code: "content_blocked", message: guard.message });
    }
  } catch (err) {
    console.error("Error in business application:", err);
  }

  const application = await prisma.businessApplication.create({
    data: {
      id: newId(),
      applicantId: req.user.id,
      name,
      bio,
      logoUrl,
      bannerUrl,
      status: "pending",
      discordInviteUrl: discord.inviteUrl,
      discordGuildId: discord.guildId,
      discordGuildName: discord.guildName,
      discordGuildIconUrl: discord.guildIconUrl,
      discordMemberCount: discord.memberCount,
      discordPresenceCount: discord.presenceCount,
      discordCheckedAt: new Date(),
      guidelinesAcceptedAt: new Date(),
    },
  });

  res.status(201).json({ application: serializeApplication(application) });
}

export async function getBusinessStatus(req, res) {
  const actorId = req.actorId || req.user.id;

  const latest = await prisma.businessApplication.findFirst({
    where: { applicantId: actorId, status: { in: ["pending", "rejected"] } },
    orderBy: { createdAt: "desc" },
  });

  const owned = await prisma.user.findMany({
    where: { accountKind: "business", businessOwnerId: actorId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
    },
  });

  res.json({
    application: latest ? serializeApplication(latest) : null,
    businesses: owned,
    minMembers: BUSINESS_MIN_MEMBERS,
    requirements: ATTESTATIONS,
  });
}

export async function deleteBusiness(req, res) {
  const { businessId } = req.params;
  const actorId = req.actorId || req.user.id;

  const business = await prisma.user.findFirst({
    where: { id: businessId, accountKind: "business", businessOwnerId: actorId },
  });

  if (!business) {
    return res.status(404).json({ message: "Business account not found or you are not the owner." });
  }
  await prisma.businessCollaborator.deleteMany({ where: { businessUserId: business.id } });
  await prisma.businessApplication.deleteMany({ where: { businessUserId: business.id } });
  await prisma.user.delete({ where: { id: business.id } });

  res.json({ ok: true, message: "Business account deleted." });
}

export async function cancelApplication(req, res) {
  const { applicationId } = req.params;
  const actorId = req.actorId || req.user.id;

  const app = await prisma.businessApplication.findFirst({
    where: { id: applicationId, applicantId: actorId },
  });

  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  await prisma.businessApplication.delete({ where: { id: app.id } });

  res.json({ ok: true });
}

async function requireBusinessOwner(req, res) {
  if (req.user.accountKind !== "business") {
    res.status(403).json({ message: "Switch into the business account to manage collaborators." });
    return null;
  }
  const actorId = req.actorId || req.user.id;
  if (req.user.businessOwnerId !== actorId) {
    res.status(403).json({ message: "Only the business owner can manage collaborators." });
    return null;
  }
  return req.user;
}

export async function listCollaborators(req, res) {
  const business = await requireBusinessOwner(req, res);
  if (!business) return;

  const rows = await prisma.businessCollaborator.findMany({
    where: { businessUserId: business.id },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  res.json({
    collaborators: rows.map((r) => ({
      id: r.id,
      role: r.role,
      createdAt: r.createdAt,
      user: serializeUser(r.user, {}),
    })),
  });
}

export async function addCollaborator(req, res) {
  const business = await requireBusinessOwner(req, res);
  if (!business) return;

  const username = normalizeUsername(req.body.username);
  if (!username) return res.status(400).json({ message: "Username is required." });

  const target = await prisma.user.findFirst({
    where: {
      username,
      accountKind: { notIn: ["professional", "business"] },
    },
  });
  if (!target) return res.status(404).json({ message: "User not found." });
  if (target.id === business.businessOwnerId) {
    return res.status(400).json({ message: "The owner is already on this business account." });
  }

  const existing = await prisma.businessCollaborator.findUnique({
    where: {
      businessUserId_userId: { businessUserId: business.id, userId: target.id },
    },
  });
  if (existing) return res.status(409).json({ message: "Already a collaborator." });

  const row = await prisma.businessCollaborator.create({
    data: {
      id: newId(),
      businessUserId: business.id,
      userId: target.id,
      role: "collaborator",
    },
    include: { user: true },
  });

  res.status(201).json({
    collaborator: {
      id: row.id,
      role: row.role,
      createdAt: row.createdAt,
      user: serializeUser(row.user, {}),
    },
  });
}

export async function removeCollaborator(req, res) {
  const business = await requireBusinessOwner(req, res);
  if (!business) return;

  if (!isValidObjectId(req.params.userId)) {
    return res.status(404).json({ message: "Collaborator not found." });
  }

  const deleted = await prisma.businessCollaborator.deleteMany({
    where: { businessUserId: business.id, userId: req.params.userId },
  });
  if (deleted.count === 0) {
    return res.status(404).json({ message: "Collaborator not found." });
  }

  res.json({ ok: true });
}

export async function searchCollaboratorCandidates(req, res) {
  const business = await requireBusinessOwner(req, res);
  if (!business) return;

  const q = normalizeUsername(req.query.q);
  if (!q || q.length < 1) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      accountKind: { notIn: ["professional", "business"] },
      username: { contains: q, mode: "insensitive" },
      id: { not: business.businessOwnerId },
    },
    take: 10,
    orderBy: { username: "asc" },
  });

  res.json({ users: users.map((u) => serializeUser(u, {})) });
}

export async function listBusinessApplications(req, res) {
  const status = ["pending", "approved", "rejected"].includes(req.query.status)
    ? req.query.status
    : "pending";

  const applications = await prisma.businessApplication.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { applicant: true },
  });

  res.json({
    applications: applications.map((a) => ({
      ...serializeApplication(a),
      applicant: serializeUser(a.applicant, {}),
    })),
  });
}

export async function decideBusinessApplication(req, res) {
  const { action } = req.body;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Application not found" });
  }

  const application = await prisma.businessApplication.findUnique({
    where: { id: req.params.id },
    include: { applicant: true },
  });
  if (!application) return res.status(404).json({ message: "Application not found" });
  if (application.status !== "pending") {
    return res.status(409).json({ message: "Application already decided" });
  }

  const note = String(req.body.note || "").trim().slice(0, 500);

  const applicationSnapshot = {
    id: application.id,
    name: application.name,
    bio: application.bio,
    applicant: {
      id: application.applicantId,
      username: application.applicant?.username || null,
      discordUsername: application.applicant?.discordUsername || null,
    },
    discordGuildId: application.discordGuildId || null,
    discordGuildName: application.discordGuildName || null,
    discordMemberCount: application.discordMemberCount || 0,
    appliedAt: application.createdAt,
  };

  if (action === "reject") {
    await prisma.businessApplication.update({
      where: { id: application.id },
      data: {
        status: "rejected",
        staffNote: note,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
    });

    await logStaffAction({
      staffId: req.user.id,
      action: "reject_business_application",
      targetType: "business_application",
      targetId: application.id,
      targetUser: application.applicantId,
      targetLabel: application.name,
      meta: { reason: note || undefined },
      snapshot: applicationSnapshot,
    });

    await notify({
      recipient: application.applicantId,
      actor: req.user.id,
      type: "business_rejected",
    });

    return res.json({ ok: true });
  }

  const username = await allocateBusinessUsername(application.name);
  const businessUser = await prisma.user.create({
    data: {
      id: newId(),
      discordId: application.applicant.discordId,
      discordUsername: application.applicant.discordUsername,
      username,
      displayName: application.name,
      bio: application.bio,
      avatarUrl: application.logoUrl,
      bannerUrl: application.bannerUrl,
      accountKind: "business",
      businessOwnerId: application.applicantId,
      onboardingComplete: true,
      hasSeenPromoVideo: true,
      badges: [],
    },
  });

  await ensureGlobalMembership(businessUser.id);

  await prisma.businessApplication.update({
    where: { id: application.id },
    data: {
      status: "approved",
      staffNote: note,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
      businessUserId: businessUser.id,
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "approve_business_application",
    targetType: "business_application",
    targetId: application.id,
    targetUser: application.applicantId,
    targetLabel: application.name,
    meta: {
      reason: note || undefined,
      businessUserId: businessUser.id,
      businessUsername: username,
    },
    snapshot: applicationSnapshot,
  });

  await notify({
    recipient: application.applicantId,
    actor: req.user.id,
    type: "business_approved",
  });

  res.json({ ok: true, businessUserId: businessUser.id });
}

export async function revertBusinessApplication(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Application not found" });
  }

  const entry = await findLatestReversibleEntry({
    targetId: req.params.id,
    actions: ["approve_business_application", "reject_business_application"],
  });
  if (!entry) return res.status(404).json({ message: "There is no business decision to undo." });

  try {
    const result = await reverseAuditEntry({ entry, staffId: req.user.id });
    res.json({ ok: true, message: result.message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to undo." });
  }
}
