import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { ipHandle } from "../lib/ipHash.js";
import { cacheDel } from "../db/redis.js";
import { logStaffAction } from "./auditLog.js";
import { liftBanBlocklist } from "./banBlocklist.js";
import { disconnectUser, disconnectStaffUser } from "./realtime.js";
import { refreshBannedIps } from "../middleware/ipBan.js";
import { emitQueueChanged, staffResourceChanged, STAFF_RESOURCES } from "./staffEvents.js";
import { invalidateStaffContext, revokeAllStaffSessionsForUser } from "./staffSession.js";
import { effectiveRole, hasPermission } from "../config/roles.js";

export const GRANTABLE_BADGES = {
  content_creator: "Content Creator",
  bug_hunter: "Bug Hunter",
  early_supporter: "Early Supporter",
  contributor: "Contributor",
};

const REVERSIBLE = {
  approve_verification: { perm: null, label: "verification approval" },
  reject_verification: { perm: null, label: "verification rejection" },
  approve_business_application: { perm: "manage_applications", label: "business approval" },
  reject_business_application: { perm: "manage_applications", label: "business rejection" },
  accept_staff_application: { perm: "manage_applications", label: "staff application acceptance" },
  reject_staff_application: { perm: "manage_applications", label: "staff application rejection" },
  resolve_copyright_request: { perm: "manage_copyright", label: "copyright resolution" },
  dismiss_copyright_request: { perm: "manage_copyright", label: "copyright dismissal" },
  promote_staff_role: { perm: "manage_roles", label: "role promotion" },
  demote_staff_role: { perm: "manage_roles", label: "role demotion" },
  ban_ip: { perm: "view_private_data", label: "network ban" },
  unban_ip: { perm: "view_private_data", label: "network unban" },
  set_business_label: { perm: "manage_applications", label: "business label" },
  clear_business_label: { perm: "manage_applications", label: "business label" },
  suspend_user: { perm: null, label: "suspension" },
  ban_user: { perm: null, label: "ban" },
  deactivate_user: { perm: null, label: "deactivation" },
  delete_post: { perm: null, label: "post deletion" },
  grant_badge: { perm: null, label: "badge grant" },
  revoke_badge: { perm: null, label: "badge revoke" },
};

const ACCOUNT_MOD_ACTIONS = new Set(["suspend_user", "ban_user", "deactivate_user"]);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

export function reversiblePermission(action) {
  return REVERSIBLE[action]?.perm ?? null;
}

export function reversalInfo(entry, undoneIds) {
  const def = REVERSIBLE[entry.action];
  if (!def) return { undoable: false };
  if (undoneIds && undoneIds.has(entry.id)) return { undoable: false, undone: true };
  if (ACCOUNT_MOD_ACTIONS.has(entry.action) && entry.meta?.accountDeleted) {
    return { undoable: false, reason: "The account was deleted with this action." };
  }
  return { undoable: true };
}

async function isEntryUndone(entryId, since) {
  const markers = await prisma.staffAuditLog.findMany({
    where: { action: { startsWith: "undo_" }, createdAt: { gte: since } },
    select: { meta: true },
  });
  return markers.some((marker) => marker.meta?.originalEntryId === entryId);
}

export async function collectUndoneIds(entries) {
  if (!entries.length) return new Set();

  const since = entries[entries.length - 1].createdAt;
  const ids = new Set(entries.map((entry) => entry.id));

  const markers = await prisma.staffAuditLog.findMany({
    where: { action: { startsWith: "undo_" }, createdAt: { gte: since } },
    select: { meta: true },
  });

  const undone = new Set();
  for (const marker of markers) {
    const originalId = marker.meta?.originalEntryId;
    if (originalId && ids.has(originalId)) undone.add(originalId);
  }
  return undone;
}

export async function findLatestReversibleEntry({ targetId, actions }) {
  if (!targetId) return null;

  const rows = await prisma.staffAuditLog.findMany({
    where: { targetId, action: { in: actions } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
  });

  for (const row of rows) {
    if (!(await isEntryUndone(row.id, row.createdAt))) return row;
  }
  return null;
}

async function undoVerification(entry) {
  const app = await prisma.verificationApplication.findUnique({
    where: { id: entry.targetId },
    include: { user: true },
  });
  if (!app) throw httpError(404, "The verification application no longer exists.");
  if (app.status === "pending") throw httpError(409, "That application is already pending review.");

  await prisma.verificationApplication.update({
    where: { id: app.id },
    data: { status: "pending", reviewedById: null, reviewedAt: null },
  });

  if (app.userId) {
    await prisma.user.update({
      where: { id: app.userId },
      data: { isVerified: false, verificationStatus: "pending" },
    });
    await cacheDel(`user:session:${app.userId}`);
  }

  emitQueueChanged();
  staffResourceChanged(STAFF_RESOURCES.verification, { id: app.id, action: "revert" });

  return {
    message: `Reopened the verification application for @${app.user?.username || "user"}.`,
    targetUser: app.userId || undefined,
    targetLabel: app.user ? `@${app.user.username}` : entry.targetLabel,
  };
}

async function undoApproveBusiness(entry) {
  const app = await prisma.businessApplication.findUnique({
    where: { id: entry.targetId },
    include: { applicant: true },
  });
  if (!app) throw httpError(404, "The business application no longer exists.");

  const businessUserId = app.businessUserId || entry.meta?.businessUserId || null;

  await prisma.businessApplication.update({
    where: { id: app.id },
    data: { status: "pending", staffNote: "", reviewedById: null, reviewedAt: null, businessUserId: null },
  });

  if (businessUserId) {
    const businessUser = await prisma.user.findFirst({
      where: { id: businessUserId, accountKind: "business" },
    });
    if (businessUser) {
      disconnectUser(businessUser.id);
      disconnectStaffUser(businessUser.id);
      await prisma.businessCollaborator.deleteMany({ where: { businessUserId: businessUser.id } });
      await prisma.user.delete({ where: { id: businessUser.id } });
      await cacheDel(`user:session:${businessUser.id}`);
    }
  }

  emitQueueChanged();

  return {
    message: `Removed the business account and reopened @${app.applicant?.username || "the applicant"}'s application.`,
    targetUser: app.applicantId || undefined,
    targetLabel: app.name,
  };
}

async function undoRejectBusiness(entry) {
  const app = await prisma.businessApplication.findUnique({
    where: { id: entry.targetId },
    include: { applicant: true },
  });
  if (!app) throw httpError(404, "The business application no longer exists.");
  if (app.status === "pending") throw httpError(409, "That application is already pending review.");

  await prisma.businessApplication.update({
    where: { id: app.id },
    data: { status: "pending", staffNote: "", reviewedById: null, reviewedAt: null },
  });

  emitQueueChanged();

  return {
    message: `Reopened @${app.applicant?.username || "the applicant"}'s business application.`,
    targetUser: app.applicantId || undefined,
    targetLabel: app.name,
  };
}

async function undoStaffApplication(entry) {
  const app = await prisma.staffApplication.findUnique({ where: { id: entry.targetId } });
  if (!app) throw httpError(404, "The staff application no longer exists.");
  if (app.status === "pending") throw httpError(409, "That application is already pending review.");

  await prisma.staffApplication.update({
    where: { id: app.id },
    data: { status: "pending", staffNote: "", reviewedById: null, reviewedAt: null },
  });

  staffResourceChanged(STAFF_RESOURCES.staffApplications, { id: app.id, status: "pending" });

  return {
    message: `Reopened the staff application from ${app.discordUsername}.`,
    targetLabel: app.discordUsername,
  };
}

async function undoCopyright(entry) {
  const request = await prisma.copyrightRequest.findUnique({ where: { id: entry.targetId } });
  if (!request) throw httpError(404, "The copyright request no longer exists.");
  if (request.status === "pending") throw httpError(409, "That request is already pending review.");

  await prisma.copyrightRequest.update({
    where: { id: request.id },
    data: { status: "pending", staffNote: "", reviewedById: null, reviewedAt: null },
  });

  staffResourceChanged(STAFF_RESOURCES.copyright, { id: request.id, status: "pending" });
  emitQueueChanged();

  return {
    message: "Reopened the copyright request.",
    targetLabel: request.copyrightedWork.slice(0, 80),
  };
}

async function undoRoleChange(entry, staffId) {
  const userId = entry.targetUserId;
  const fromRole = entry.meta?.from;
  if (!userId || !fromRole) throw httpError(400, "This role change is missing the data needed to undo it.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw httpError(404, "That account no longer exists.");

  const currentRole = effectiveRole(user);
  if (currentRole === "owner") throw httpError(400, "The owner role is fixed and can't be changed.");
  if (currentRole === fromRole) throw httpError(409, `@${user.username} is already ${fromRole}.`);

  const losesPanel = !hasPermission(fromRole, "access_staff_panel");

  await prisma.user.update({
    where: { id: userId },
    data: { role: fromRole, ...(losesPanel ? { staffSessionVersion: { increment: 1 } } : {}) },
  });

  invalidateStaffContext(userId);
  await cacheDel(`staff:user:${userId}`);
  if (losesPanel) {
    await revokeAllStaffSessionsForUser(userId, staffId);
    disconnectStaffUser(userId);
  }

  staffResourceChanged(STAFF_RESOURCES.staffRoles, { userId, to: fromRole });
  if (losesPanel) staffResourceChanged(STAFF_RESOURCES.staffSessions, { userId });

  return {
    message: `Restored @${user.username}'s role to ${fromRole}.`,
    targetUser: userId,
    targetLabel: `@${user.username}`,
    meta: { restoredRole: fromRole, from: currentRole },
  };
}

async function undoBanIp(entry) {
  const ipHash = entry.meta?.ipHash;
  if (!ipHash) throw httpError(400, "This ban is missing the network data needed to undo it.");

  const existing = await prisma.bannedIp.findUnique({ where: { ipHash } });
  if (!existing) throw httpError(409, "That network is no longer banned.");

  await prisma.bannedIp.delete({ where: { ipHash } });
  await refreshBannedIps();

  staffResourceChanged(STAFF_RESOURCES.ipBans, { ipHash, action: "unban" });

  return { message: `Lifted the ban on ${ipHandle(ipHash)}.`, targetLabel: ipHandle(ipHash), meta: { ipHash } };
}

async function undoUnbanIp(entry, staffId) {
  const ipHash = entry.meta?.ipHash;
  if (!ipHash) throw httpError(400, "This unban is missing the network data needed to undo it.");

  const existing = await prisma.bannedIp.findUnique({ where: { ipHash } });
  if (existing) throw httpError(409, "That network is already banned.");

  await prisma.bannedIp.create({
    data: {
      id: newId(),
      ipHash,
      reason: entry.meta?.reason || "",
      bannedById: staffId,
      expiresAt: entry.meta?.until ? new Date(entry.meta.until) : null,
    },
  });
  await refreshBannedIps();

  staffResourceChanged(STAFF_RESOURCES.ipBans, { ipHash, action: "ban" });

  return { message: `Re-banned ${ipHandle(ipHash)}.`, targetLabel: ipHandle(ipHash), meta: { ipHash } };
}

async function undoBusinessLabel(entry) {
  const business = await prisma.user.findFirst({
    where: { id: entry.targetId, accountKind: "business" },
  });
  if (!business) throw httpError(404, "That business account no longer exists.");

  const previousLabel = entry.meta?.previousLabel || "";

  await prisma.user.update({ where: { id: business.id }, data: { accountLabel: previousLabel } });
  await cacheDel(`user:session:${business.id}`);

  return {
    message: previousLabel
      ? `Restored @${business.username}'s previous label.`
      : `Cleared @${business.username}'s label.`,
    targetUser: business.businessOwnerId || undefined,
    targetLabel: `@${business.username}`,
  };
}

async function undoUserModeration(entry, staffId) {
  const userId = entry.targetUserId;
  if (!userId) throw httpError(400, "This action is missing the account it targeted.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw httpError(404, "That account no longer exists.");
  if (user.status === "active") throw httpError(409, `@${user.username} is already active.`);

  await prisma.suspension.updateMany({
    where: { userId, active: true },
    data: { active: false, liftedAt: new Date(), liftedById: staffId },
  });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: "active", suspendedUntil: null, suspendReason: null },
  });

  await liftBanBlocklist(updated);
  await cacheDel(`user:session:${userId}`);

  return {
    message: `Reinstated @${user.username}.`,
    targetUser: userId,
    targetLabel: `@${user.username}`,
  };
}

async function undoDeletePost(entry) {
  const post = await prisma.post.findUnique({
    where: { id: entry.targetId },
    include: { author: true },
  });
  if (!post) throw httpError(404, "That post no longer exists.");
  if (!post.deleted) throw httpError(409, "That post isn't deleted.");

  await prisma.post.update({ where: { id: post.id }, data: { deleted: false } });

  return {
    message: post.mediaUrl
      ? `Restored @${post.author?.username || "user"}'s post (attached media may be unavailable).`
      : `Restored @${post.author?.username || "user"}'s post.`,
    targetUser: post.authorId,
    targetLabel: `@${post.author?.username || "unknown"}`,
  };
}

async function undoBadge(entry) {
  const userId = entry.targetUserId;
  const badge = entry.meta?.badge;
  if (!userId || !badge) throw httpError(400, "This badge change is missing the data needed to undo it.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw httpError(404, "That account no longer exists.");

  const current = Array.isArray(user.badges) ? user.badges : [];
  const has = current.includes(badge);
  const wasGrant = entry.action === "grant_badge";

  if (wasGrant && !has) throw httpError(409, "That badge is no longer on the account.");
  if (!wasGrant && has) throw httpError(409, "That badge is already on the account.");

  const badges = wasGrant ? current.filter((id) => id !== badge) : [...current, badge];

  await prisma.user.update({ where: { id: userId }, data: { badges } });
  await cacheDel(`user:session:${userId}`);

  const label = GRANTABLE_BADGES[badge] || badge;
  return {
    message: `${wasGrant ? "Removed" : "Restored"} the ${label} badge for @${user.username}.`,
    targetUser: userId,
    targetLabel: `@${user.username}`,
    meta: { badge },
  };
}

const HANDLERS = {
  approve_verification: undoVerification,
  reject_verification: undoVerification,
  approve_business_application: undoApproveBusiness,
  reject_business_application: undoRejectBusiness,
  accept_staff_application: undoStaffApplication,
  reject_staff_application: undoStaffApplication,
  resolve_copyright_request: undoCopyright,
  dismiss_copyright_request: undoCopyright,
  promote_staff_role: undoRoleChange,
  demote_staff_role: undoRoleChange,
  ban_ip: undoBanIp,
  unban_ip: undoUnbanIp,
  set_business_label: undoBusinessLabel,
  clear_business_label: undoBusinessLabel,
  suspend_user: undoUserModeration,
  ban_user: undoUserModeration,
  deactivate_user: undoUserModeration,
  delete_post: undoDeletePost,
  grant_badge: undoBadge,
  revoke_badge: undoBadge,
};

export async function reverseAuditEntry({ entry, staffId }) {
  const info = reversalInfo(entry);
  if (!info.undoable) throw httpError(400, info.reason || "This action can't be undone.");

  if (await isEntryUndone(entry.id, entry.createdAt)) {
    throw httpError(409, "This action has already been undone.");
  }

  const handler = HANDLERS[entry.action];
  if (!handler) throw httpError(400, "This action can't be undone.");

  const result = await handler(entry, staffId);

  await logStaffAction({
    staffId,
    action: `undo_${entry.action}`,
    targetType: result.targetType || entry.targetType,
    targetId: result.targetId ?? entry.targetId ?? undefined,
    targetUser: result.targetUser ?? entry.targetUserId ?? undefined,
    targetLabel: result.targetLabel || entry.targetLabel,
    meta: { originalEntryId: entry.id, originalAction: entry.action, ...(result.meta || {}) },
  });

  return { message: result.message };
}
