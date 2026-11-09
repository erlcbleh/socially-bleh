import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { ipHandle, isIpHash } from "../lib/ipHash.js";
import { refreshBannedIps } from "../middleware/ipBan.js";
import { POST_INCLUDE, hydratePosts, serializeUser } from "../services/hydrate.js";
import { notify } from "../services/notify.js";
import { logStaffAction } from "../services/auditLog.js";
import { cacheDel } from "../db/redis.js";
import {
  reverseAuditEntry,
  findLatestReversibleEntry,
  GRANTABLE_BADGES,
} from "../services/staffReversal.js";
import { deleteCloudinaryAsset } from "../services/cloudinary.js";
import { sendApplicationDecisionWebhook } from "../services/applicationWebhook.js";
import { disconnectUser, disconnectStaffUser } from "../services/realtime.js";
import {
  reportUpdated,
  emitQueueChanged,
  staffResourceChanged,
  STAFF_RESOURCES,
} from "../services/staffEvents.js";
import {
  purgeRecentContent,
  purgeAllContent,
  PURGE_WINDOW_HOURS,
  PURGE_WINDOW_IDS,
} from "../services/purgeRecentContent.js";
import { banAndDeleteAccount } from "../services/banAndDeleteAccount.js";
import { applyBanBlocklist, liftBanBlocklist } from "../services/banBlocklist.js";
import { autoResolveReportsForDeactivatedUser } from "../services/autoResolveReports.js";
import { invalidateStaffContext, revokeAllStaffSessionsForUser } from "../services/staffSession.js";
import { parseLimit, parseCursor, withCursor, takePage } from "../utils/staffPagination.js";
import {
  ASSIGNABLE_ROLES,
  OWNER_DISCORD_ID,
  canAssignRole,
  effectiveRole,
  hasPermission,
  isOwnerDiscordId,
  roleLevel,
} from "../config/roles.js";

const REPORT_STATUSES = ["pending", "actioned", "dismissed"];
const VERIFICATION_STATUSES = ["pending", "approved", "rejected", "cancelled"];
const COPYRIGHT_STATUSES = ["pending", "resolved", "dismissed"];
const STAFF_APPLICATION_STATUSES = ["pending", "accepted", "rejected"];
const REVIEW_QUEUE_LIMIT = 200;
const STAFF_NOTE_MAX = 2000;
const BULK_ACTION_MAX = 100;
const LOOKUP_LIMIT = 20;
const LOOKUP_SCAN = 60;

function sanitizeStatus(value, allowed, fallback = "pending") {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

const parseListLimit = (raw) =>
  parseLimit(raw, { fallback: REVIEW_QUEUE_LIMIT, max: REVIEW_QUEUE_LIMIT });

function parsePurgeWindow(raw) {
  const id = raw ? String(raw) : "24h";
  if (id === "all") return { id, all: true, ms: null };

  const hours = PURGE_WINDOW_HOURS[id];
  return hours ? { id, all: false, ms: hours * 60 * 60 * 1000 } : null;
}

function runPurge(userId, window) {
  return window.all ? purgeAllContent(userId) : purgeRecentContent(userId, window.ms);
}

const purgeWindowError = () => ({
  message: `Purge window must be one of ${PURGE_WINDOW_IDS.join(", ")}.`,
});

const isElevatedStaff = (req) => roleLevel(req.staff?.role) >= roleLevel("admin");

const purgeAllForbidden = () => ({
  message: "Only admins and above can delete an account's entire history.",
});

const deleteAccountForbidden = () => ({
  message: "Only admins and above can delete an account.",
});

function canModerate(actor, target) {
  return roleLevel(effectiveRole(actor)) > roleLevel(effectiveRole(target));
}

function resolveModerationOptions({ action, until, body, elevated }) {
  const isSuspension = action === "suspend";
  const isDeactivation = action === "deactivate";
  const isPermanentBan = isSuspension && !until;

  const wantsDelete = !!body.deleteAccount;
  const wantsPurge = !!body.purgeRecent;
  const shouldDelete = wantsDelete && (isPermanentBan || isDeactivation);
  const purge = wantsPurge && !shouldDelete ? parsePurgeWindow(body.purgeWindow) : null;

  if (wantsPurge && !isSuspension && !isDeactivation) {
    return {
      error: {
        status: 400,
        body: { message: "Content can only be purged alongside a suspension or a deactivation." },
      },
    };
  }
  if (wantsPurge && !shouldDelete && !purge) {
    return { error: { status: 400, body: purgeWindowError() } };
  }
  if (purge?.all && !elevated) {
    return { error: { status: 403, body: purgeAllForbidden() } };
  }
  if (wantsDelete && !isPermanentBan && !isDeactivation) {
    return {
      error: {
        status: 400,
        body: { message: "The account can only be deleted on a permanent ban or a deactivation." },
      },
    };
  }
  if (wantsDelete && !elevated) {
    return { error: { status: 403, body: deleteAccountForbidden() } };
  }

  return { purge, shouldDelete, banDiscord: shouldDelete && isSuspension };
}

async function applyPurgeOrDelete(user, { purge, shouldDelete, banDiscord }, staffId) {
  if (shouldDelete) {
    return banAndDeleteAccount(user, { bannedBy: staffId, reason: user.suspendReason, banDiscord });
  }
  return purge ? runPurge(user.id, purge) : null;
}

function purgeAuditAction({ shouldDelete, banDiscord }) {
  if (!shouldDelete) return "purge_recent_content";
  return banDiscord ? "ban_and_delete_account" : "delete_account";
}

async function applyModeration(userId, action, until, reason, staffId) {
  const data = {};

  if (action === "deactivate") {
    data.tokenVersion = { increment: 1 };
  }

  if (action === "suspend") {
    await prisma.suspension.updateMany({
      where: { userId, active: true },
      data: { active: false, liftedAt: new Date(), liftedById: staffId },
    });

    if (until) {
      data.status = "suspended";
      data.suspendedUntil = new Date(until);
    } else {
      data.status = "banned";
      data.suspendedUntil = null;
    }
    data.suspendReason = reason;

    await prisma.suspension.create({
      data: {
        id: newId(),
        userId,
        issuedById: staffId,
        kind: until ? "suspend" : "ban",
        reason,
        until: until ? new Date(until) : null,
      },
    });
  } else if (action === "deactivate") {
    data.status = "deactivated";
    data.suspendReason = null;

    await prisma.suspension.create({
      data: {
        id: newId(),
        userId,
        issuedById: staffId,
        kind: "deactivate",
        reason: reason || "",
        until: null,
      },
    });
  } else if (action === "reinstate") {
    data.status = "active";
    data.suspendedUntil = null;
    data.suspendReason = null;
    await prisma.suspension.updateMany({
      where: { userId, active: true },
      data: { active: false, liftedAt: new Date(), liftedById: staffId },
    });
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  await cacheDel(`user:session:${userId}`);

  if (updated.status === "banned" || updated.status === "deactivated" || updated.status === "suspended") {
    const summary = await applyBanBlocklist(updated, {
      staffId,
      reason: reason || `Automatic: account ${updated.status}`,
      expiresAt: updated.status === "suspended" ? updated.suspendedUntil : null,
    });
    if (summary.ipsBanned || summary.discordBanned) {
      await logStaffAction({
        staffId,
        action: "auto_block_ban_evasion",
        targetType: "user",
        targetId: updated.id,
        targetUser: updated.id,
        targetLabel: `@${updated.username}`,
        meta: {
          trigger: updated.status,
          ipsBanned: summary.ipsBanned,
          ipsSkippedShared: summary.ipsSkipped || undefined,
          discordBanned: summary.discordBanned || undefined,
        },
      });
    }
  } else if (action === "reinstate") {
    const summary = await liftBanBlocklist(updated);
    if (summary.ipsLifted || summary.discordLifted) {
      await logStaffAction({
        staffId,
        action: "auto_unblock_ban_evasion",
        targetType: "user",
        targetId: updated.id,
        targetUser: updated.id,
        targetLabel: `@${updated.username}`,
        meta: {
          ipsLifted: summary.ipsLifted,
          discordLifted: summary.discordLifted || undefined,
        },
      });
    }
  }

  return updated;
}

function describeUserAction(action, user) {
  if (action === "suspend") return user.status === "banned" ? "ban_user" : "suspend_user";
  return `${action}_user`;
}

function snapshotAuthorLabel(report, fallback) {
  const username = report.snapshot?.authorUsername;
  return username ? `@${username}` : fallback;
}

function reportedUserId(report, reportedPost, reportedMessage) {
  if (report.targetType === "user") return report.targetId;
  return reportedPost?.authorId || reportedMessage?.senderId || report.snapshot?.authorId || null;
}

async function describeReportTarget(report, reportedPost, reportedMessage) {
  if (report.targetType === "post") {
    if (reportedPost) return `@${reportedPost.author?.username || "unknown"}`;
    return snapshotAuthorLabel(report, "post (deleted)");
  }
  if (report.targetType === "message") {
    if (reportedMessage) return `@${reportedMessage.sender?.username || "unknown"}`;
    return snapshotAuthorLabel(report, "message (deleted)");
  }
  const user = await prisma.user.findUnique({ where: { id: report.targetId } });
  return user ? `@${user.username}` : "user (deleted)";
}

export async function listReports(req, res) {
  const statusFilter = sanitizeStatus(req.query.status, REPORT_STATUSES);
  const reports = await prisma.report.findMany({
    where: { status: statusFilter },
    orderBy: { createdAt: "desc" },
    take: REVIEW_QUEUE_LIMIT,
    include: { reporter: true, community: true },
  });

  const postTargetIds = reports.filter((r) => r.targetType === "post").map((r) => r.targetId);
  const userTargetIds = reports.filter((r) => r.targetType === "user").map((r) => r.targetId);
  const messageTargetIds = reports.filter((r) => r.targetType === "message").map((r) => r.targetId);

  const [posts, users, messages] = await Promise.all([
    postTargetIds.length
      ? prisma.post.findMany({ where: { id: { in: postTargetIds } }, include: POST_INCLUDE })
      : [],
    userTargetIds.length ? prisma.user.findMany({ where: { id: { in: userTargetIds } } }) : [],
    messageTargetIds.length
      ? prisma.message.findMany({
          where: { id: { in: messageTargetIds } },
          include: { sender: true },
        })
      : [],
  ]);

  const hydratedPosts = await hydratePosts(posts, req.user.id);
  const postMap = new Map(hydratedPosts.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, serializeUser(u, {})]));
  const messageMap = new Map(
    messages.map((m) => [
      m.id,
      {
        id: m.id,
        sender: m.sender ? serializeUser(m.sender, {}) : null,
        content: m.content,
        createdAt: m.createdAt,
      },
    ])
  );

  res.json({
    reports: reports.map((r) => ({
      id: r.id,
      reporter: r.reporter ? serializeUser(r.reporter, {}) : null,
      communitySlug: r.community?.slug || null,
      targetType: r.targetType,
      targetId: r.targetId,
      targetPost: r.targetType === "post" ? postMap.get(r.targetId) || null : null,
      targetUser: r.targetType === "user" ? userMap.get(r.targetId) || null : null,
      targetMessage: r.targetType === "message" ? messageMap.get(r.targetId) || null : null,
      contentSnapshot: r.contentSnapshot,
      snapshot: r.snapshot || null,
      reason: r.reason,
      details: r.details,
      status: r.status,
      actionTaken: r.actionTaken,
      createdAt: r.createdAt,
    })),
  });
}

export async function actionReport(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Report not found" });
  }

  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ message: "Report not found" });

  const { action, until, reason, staffNote } = req.body;
  const isAutoFlagged = !report.reporterId;
  const hasStaffNote = typeof staffNote === "string";
  const nextStaffNote = hasStaffNote ? String(staffNote).trim().slice(0, STAFF_NOTE_MAX) : null;

  const reportedPost =
    report.targetType === "post"
      ? await prisma.post.findUnique({ where: { id: report.targetId }, include: { author: true } })
      : null;
  const reportedMessage =
    report.targetType === "message"
      ? await prisma.message.findUnique({ where: { id: report.targetId }, include: { sender: true } })
      : null;

  let reportStatus = report.status;
  let reportActionTaken = report.actionTaken;
  let user = null;
  let accountDeleted = false;

  if (action === "dismiss") {
    reportStatus = "dismissed";
    await logStaffAction({
      staffId: req.user.id,
      action: "dismiss_report",
      targetType: "report",
      targetId: report.id,
      targetUser:
        report.targetType === "user"
          ? report.targetId
          : reportedPost?.authorId || reportedMessage?.senderId,
      targetLabel: await describeReportTarget(report, reportedPost, reportedMessage),
      meta: {
        reportType: report.targetType,
        reportReason: report.reason,
        content: reportedPost?.content || reportedMessage?.content,
      },
    });
  } else if (action === "delete_post" && report.targetType === "post") {
    if (!reportedPost) return res.status(404).json({ message: "Post not found" });

    await prisma.post.update({ where: { id: reportedPost.id }, data: { deleted: true } });
    if (reportedPost.mediaUrl) await deleteCloudinaryAsset(reportedPost.mediaUrl);
    reportStatus = "actioned";
    reportActionTaken = "deleted_post";

    await logStaffAction({
      staffId: req.user.id,
      action: "delete_post",
      targetType: "post",
      targetId: reportedPost.id,
      targetUser: reportedPost.authorId,
      targetLabel: `@${reportedPost.author?.username || "unknown"}`,
      meta: { reportId: report.id, content: reportedPost.content },
    });
  } else if (["suspend", "deactivate"].includes(action)) {
    if (action === "suspend" && !String(reason || "").trim()) {
      return res.status(400).json({ message: "A reason is required to suspend a user." });
    }
    if (until && Number.isNaN(new Date(until).getTime())) {
      return res.status(400).json({ message: "Invalid suspension end date." });
    }
    if (until && new Date(until) <= new Date()) {
      return res.status(400).json({ message: "The suspension end date must be in the future." });
    }

    const options = resolveModerationOptions({
      action,
      until,
      body: req.body,
      elevated: isElevatedStaff(req),
    });
    if (options.error) return res.status(options.error.status).json(options.error.body);

    const { purge, shouldDelete } = options;

    const targetUserId = reportedUserId(report, reportedPost, reportedMessage);
    if (!targetUserId) return res.status(404).json({ message: "Target user not found" });

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) return res.status(404).json({ message: "Target user not found" });

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "You can't moderate your own account." });
    }
    if (!canModerate(req.user, targetUser)) {
      return res.status(403).json({ message: "You don't have permission to moderate this account." });
    }

    user = await applyModeration(
      targetUser.id,
      action,
      until,
      reason ? String(reason).trim().slice(0, 500) : undefined,
      req.user.id
    );
    disconnectUser(user.id);
    disconnectStaffUser(user.id);

    if (action === "deactivate") {
      await autoResolveReportsForDeactivatedUser(user.id, {
        staffId: req.user.id,
        excludeReportId: report.id,
      });
    }

    const purged = await applyPurgeOrDelete(user, options, req.user.id);
    accountDeleted = shouldDelete;

    reportStatus = "actioned";
    reportActionTaken = action === "suspend" ? user.status : action;

    await logStaffAction({
      staffId: req.user.id,
      action: describeUserAction(action, user),
      targetType: "user",
      targetId: user.id,
      targetUser: user.id,
      targetLabel: `@${user.username}`,
      meta: {
        reportId: report.id,
        until: user.suspendedUntil,
        reason: user.suspendReason || undefined,
        content: reportedPost?.content || reportedMessage?.content,
        purged: purged || undefined,
        purgeWindow: purge?.id,
        accountDeleted: shouldDelete || undefined,
        discordBanned: options.banDiscord ? Boolean(user.discordId) : undefined,
      },
    });

    if (purged) {
      await logStaffAction({
        staffId: req.user.id,
        action: purgeAuditAction(options),
        targetType: "user",
        targetId: user.id,
        targetUser: user.id,
        targetLabel: `@${user.username}`,
        meta: purged,
      });
    }
  } else {
    return res.status(400).json({ message: "Invalid action" });
  }

  await prisma.report.update({
    where: { id: report.id },
    data: {
      status: reportStatus,
      actionTaken: reportActionTaken,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
      ...(hasStaffNote ? { staffNote: nextStaffNote } : {}),
    },
  });

  reportUpdated(report);

  if (!accountDeleted && reportedPost && !reportedPost.deleted && reportedPost.moderationStatus !== "clear") {
    await prisma.post.update({
      where: { id: reportedPost.id },
      data: { moderationStatus: "clear" },
    });
  }

  if (report.reporterId) {
    await notify({
      recipient: report.reporterId,
      actor: req.user.id,
      type: reportStatus === "dismissed" ? "report_dismissed" : "report_actioned",
      post: report.targetType === "post" ? report.targetId : null,
      community: report.communityId,
    });
  }

  if (isAutoFlagged && reportedPost && !accountDeleted) {
    await notify({
      recipient: reportedPost.authorId,
      actor: reportedPost.authorId,
      type: reportStatus === "dismissed" ? "content_flag_dismissed" : "content_flag_actioned",
      post: reportedPost.id,
      community: report.communityId,
      allowSelf: true,
    });
  }

  res.json({ ok: true });
}

export async function updateReportNote(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Report not found" });
  }

  if (typeof req.body?.staffNote !== "string") {
    return res.status(400).json({ message: "A staff note is required." });
  }

  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ message: "Report not found" });

  const staffNote = String(req.body.staffNote).trim().slice(0, STAFF_NOTE_MAX);

  await prisma.report.update({ where: { id: report.id }, data: { staffNote } });

  await logStaffAction({
    staffId: req.user.id,
    action: staffNote ? "update_report_note" : "clear_report_note",
    targetType: "report",
    targetId: report.id,
    targetLabel: `report ${report.id.slice(-8)}`,
    meta: { reportType: report.targetType, length: staffNote.length },
  });

  reportUpdated(report);

  res.json({ staffNote });
}

export async function bulkActionReports(req, res) {
  const action = String(req.body?.action || "");
  if (action !== "dismiss") {
    return res.status(400).json({ message: "Only dismiss can be applied in bulk." });
  }

  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(rawIds.filter((id) => isValidObjectId(id)).map(String))];

  if (ids.length === 0) {
    return res.status(400).json({ message: "Select at least one report." });
  }
  if (ids.length > BULK_ACTION_MAX) {
    return res.status(400).json({ message: `Select ${BULK_ACTION_MAX} reports or fewer.` });
  }

  const reports = await prisma.report.findMany({ where: { id: { in: ids }, status: "pending" } });
  if (reports.length === 0) {
    return res.status(409).json({ message: "None of those reports are still pending." });
  }

  const staffNote =
    typeof req.body?.staffNote === "string"
      ? String(req.body.staffNote).trim().slice(0, STAFF_NOTE_MAX)
      : null;

  await prisma.report.updateMany({
    where: { id: { in: reports.map((report) => report.id) } },
    data: {
      status: "dismissed",
      reviewedById: req.user.id,
      reviewedAt: new Date(),
      ...(staffNote ? { staffNote } : {}),
    },
  });

  for (const report of reports) {
    await logStaffAction({
      staffId: req.user.id,
      action: "dismiss_report",
      targetType: "report",
      targetId: report.id,
      targetLabel: `report ${report.id.slice(-8)}`,
      meta: { bulk: true, reportType: report.targetType, reportReason: report.reason },
    });
    reportUpdated(report);
  }

  res.json({ dismissed: reports.length, skipped: ids.length - reports.length });
}

export async function listVerificationApplications(req, res) {
  const statusFilter = sanitizeStatus(req.query.status, VERIFICATION_STATUSES);
  const limit = parseListLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await prisma.verificationApplication.findMany({
    where: withCursor({ status: statusFilter }, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { user: true },
  });

  const { page, nextCursor } = takePage(rows, limit);

  res.json({
    applications: page.map((a) => ({
      id: a.id,
      user: serializeUser(a.user, {}),
      reason: a.reason,
      status: a.status,
      createdAt: a.createdAt,
    })),
    nextCursor,
  });
}

export async function decideVerification(req, res) {
  const { action } = req.body;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Invalid action" });
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Application not found" });
  }

  const updated = await prisma.verificationApplication.updateMany({
    where: { id: req.params.id, status: "pending" },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      reviewedById: req.user.id,
      reviewedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    const exists = await prisma.verificationApplication.findUnique({ where: { id: req.params.id } });
    return res
      .status(exists ? 409 : 404)
      .json({ message: exists ? "Application already decided" : "Application not found" });
  }

  const application = await prisma.verificationApplication.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  emitQueueChanged();

  const user = await prisma.user.update({
    where: { id: application.userId },
    data: {
      verificationStatus: application.status,
      isVerified: action === "approve",
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: action === "approve" ? "approve_verification" : "reject_verification",
    targetType: "verification_application",
    targetId: application.id,
    targetUser: user.id,
    targetLabel: `@${user.username}`,
    meta: { reason: application.reason },
    snapshot: {
      id: application.id,
      username: user.username,
      applicantReason: application.reason,
      submittedAt: application.createdAt,
    },
  });

  await notify({
    recipient: user.id,
    actor: req.user.id,
    type: action === "approve" ? "verification_approved" : "verification_rejected",
  });

  staffResourceChanged(STAFF_RESOURCES.verification, { id: req.params.id, action });

  res.json({ ok: true });
}

export async function revertVerification(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Application not found" });
  }

  const entry = await findLatestReversibleEntry({
    targetId: req.params.id,
    actions: ["approve_verification", "reject_verification"],
  });
  if (!entry) return res.status(404).json({ message: "There is no verification decision to undo." });

  try {
    const result = await reverseAuditEntry({ entry, staffId: req.user.id });
    res.json({ ok: true, message: result.message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to undo." });
  }
}

export async function listAuditLog(req, res) {
  const entries = await prisma.staffAuditLog.findMany({
    where: { communityId: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { staff: true, targetUser: true, community: true },
  });

  res.json({
    entries: entries.map((e) => ({
      id: e.id,
      staff: e.staff ? serializeUser(e.staff, {}) : null,
      action: e.action,
      targetType: e.targetType,
      targetUser: e.targetUser ? serializeUser(e.targetUser, {}) : null,
      targetLabel: e.targetLabel,
      communitySlug: e.community?.slug || null,
      meta: e.meta,
      createdAt: e.createdAt,
    })),
  });
}

export async function listCopyrightRequests(req, res) {
  const statusFilter = sanitizeStatus(req.query.status, COPYRIGHT_STATUSES);
  const limit = parseListLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await prisma.copyrightRequest.findMany({
    where: withCursor({ status: statusFilter }, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const { page, nextCursor } = takePage(rows, limit);

  res.json({
    requests: page.map((r) => ({
      id: r.id,
      requesterName: r.requesterName,
      requesterEmail: r.requesterEmail,
      copyrightedWork: r.copyrightedWork,
      infringingUrls: r.infringingUrls,
      details: r.details,
      signature: r.signature,
      status: r.status,
      staffNote: r.staffNote,
      createdAt: r.createdAt,
    })),
    nextCursor,
  });
}

export async function decideCopyrightRequest(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Request not found" });
  }

  const request = await prisma.copyrightRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ message: "Request not found" });

  const { action, note } = req.body;
  if (!["resolve", "dismiss"].includes(action)) return res.status(400).json({ message: "Invalid action" });

  const status = action === "resolve" ? "resolved" : "dismissed";
  const staffNote = String(note || "").trim().slice(0, 500);

  await prisma.copyrightRequest.update({
    where: { id: request.id },
    data: {
      status,
      staffNote,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: action === "resolve" ? "resolve_copyright_request" : "dismiss_copyright_request",
    targetType: "copyright_request",
    targetId: request.id,
    targetLabel: request.copyrightedWork.slice(0, 80),
    meta: { requesterEmail: request.requesterEmail, reason: staffNote || undefined },
    snapshot: {
      id: request.id,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      copyrightedWork: request.copyrightedWork,
      infringingUrls: request.infringingUrls,
      details: request.details,
      submittedAt: request.createdAt,
    },
  });

  staffResourceChanged(STAFF_RESOURCES.copyright, { id: request.id, status });
  emitQueueChanged();

  res.json({ ok: true });
}

export async function revertCopyrightRequest(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Request not found" });
  }

  const entry = await findLatestReversibleEntry({
    targetId: req.params.id,
    actions: ["resolve_copyright_request", "dismiss_copyright_request"],
  });
  if (!entry) return res.status(404).json({ message: "There is no copyright decision to undo." });

  try {
    const result = await reverseAuditEntry({ entry, staffId: req.user.id });
    res.json({ ok: true, message: result.message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to undo." });
  }
}

export async function listStaffApplications(req, res) {
  const statusFilter = sanitizeStatus(req.query.status, STAFF_APPLICATION_STATUSES);
  const limit = parseListLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await prisma.staffApplication.findMany({
    where: withCursor({ status: statusFilter }, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const { page, nextCursor } = takePage(rows, limit);

  res.json({
    applications: page.map((a) => ({
      id: a.id,
      discordUsername: a.discordUsername,
      position: a.position,
      department: a.department || null,
      motivation: a.motivation,
      experience: a.experience,
      scenarioResponses: a.scenarioResponses,
      status: a.status,
      staffNote: a.staffNote,
      createdAt: a.createdAt,
    })),
    nextCursor,
  });
}

export async function decideStaffApplication(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Application not found" });
  }

  const application = await prisma.staffApplication.findUnique({ where: { id: req.params.id } });
  if (!application) return res.status(404).json({ message: "Application not found" });

  const { action, note } = req.body;
  if (!["accept", "reject"].includes(action)) return res.status(400).json({ message: "Invalid action" });

  const status = action === "accept" ? "accepted" : "rejected";
  const staffNote = String(note || "").trim().slice(0, 500);

  const updatedApplication = await prisma.staffApplication.update({
    where: { id: application.id },
    data: {
      status,
      staffNote,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
    },
  });

  await logStaffAction({
    staffId: req.user.id,
    action: action === "accept" ? "accept_staff_application" : "reject_staff_application",
    targetType: "staff_application",
    targetId: application.id,
    targetLabel: application.discordUsername,
    meta: { position: application.position, reason: staffNote || undefined },
    snapshot: {
      id: application.id,
      discordUsername: application.discordUsername,
      position: application.position,
      department: application.department || null,
      motivation: application.motivation,
      experience: application.experience,
      scenarioResponses: application.scenarioResponses,
      appliedAt: application.createdAt,
    },
  });

  await sendApplicationDecisionWebhook(updatedApplication, req.user);

  staffResourceChanged(STAFF_RESOURCES.staffApplications, { id: application.id, status });

  res.json({ ok: true });
}

export async function revertStaffApplication(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Application not found" });
  }

  const entry = await findLatestReversibleEntry({
    targetId: req.params.id,
    actions: ["accept_staff_application", "reject_staff_application"],
  });
  if (!entry) return res.status(404).json({ message: "There is no staff application decision to undo." });

  try {
    const result = await reverseAuditEntry({ entry, staffId: req.user.id });
    res.json({ ok: true, message: result.message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to undo." });
  }
}

const STAFF_ROLES = ["staff", "admin", "developer"];

function serializeStaffMember(user) {
  return { ...serializeUser(user, {}), role: effectiveRole(user) };
}

export async function listStaffMembers(req, res) {
  const limit = parseListLimit(req.query.limit);
  const after = typeof req.query.cursor === "string" ? req.query.cursor : null;

  const rows = await prisma.user.findMany({
    where: {
      OR: [{ role: { in: STAFF_ROLES } }, { discordId: OWNER_DISCORD_ID }],
      ...(after ? { username: { gt: after } } : {}),
    },
    orderBy: { username: "asc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    users: page.map(serializeStaffMember),
    actorRole: req.staff.role,
    assignableRoles: req.staff.assignableRoles,
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1].username : null,
  });
}

export async function updateStaffRole(req, res) {
  const user = await prisma.user.findFirst({ where: { username: req.params.username.toLowerCase() } });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.id === req.user.id) {
    return res.status(400).json({ message: "You can't change your own role." });
  }

  const currentRole = effectiveRole(user);
  if (currentRole === "owner") {
    return res.status(403).json({ message: "The owner role is fixed and can't be changed." });
  }

  const nextRole = String(req.body?.role || "");
  if (!ASSIGNABLE_ROLES.includes(nextRole)) {
    return res.status(400).json({ message: `Role must be one of ${ASSIGNABLE_ROLES.join(", ")}.` });
  }
  if (nextRole === currentRole) {
    return res.status(400).json({ message: `@${user.username} is already ${currentRole}.` });
  }
  if (!canAssignRole(req.staff.role, currentRole, nextRole)) {
    return res.status(403).json({ message: "You can only change roles ranked below your own." });
  }

  const losesPanel = !hasPermission(nextRole, "access_staff_panel");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: nextRole,
      ...(losesPanel ? { staffSessionVersion: { increment: 1 } } : {}),
    },
  });

  invalidateStaffContext(user.id);
  if (losesPanel) {
    await revokeAllStaffSessionsForUser(user.id, req.user.id);
    disconnectStaffUser(user.id);
  }

  await logStaffAction({
    staffId: req.user.id,
    action: roleLevel(nextRole) > roleLevel(currentRole) ? "promote_staff_role" : "demote_staff_role",
    targetType: "user",
    targetId: user.id,
    targetUser: user.id,
    targetLabel: `@${user.username}`,
    meta: { from: currentRole, to: nextRole },
  });

  staffResourceChanged(STAFF_RESOURCES.staffRoles, { userId: user.id, from: currentRole, to: nextRole });
  if (losesPanel) staffResourceChanged(STAFF_RESOURCES.staffSessions, { userId: user.id });

  res.json({ user: serializeStaffMember(updated) });
}

export async function listBannedIps(req, res) {
  const limit = parseListLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const found = await prisma.bannedIp.findMany({
    where: withCursor({}, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { bannedBy: true },
  });

  const { page: rows, nextCursor } = takePage(found, limit);

  res.json({
    bans: rows.map((r) => ({
      id: r.id,
      ipHash: r.ipHash,
      handle: ipHandle(r.ipHash),
      reason: r.reason,
      bannedBy: r.bannedBy ? serializeUser(r.bannedBy, {}) : null,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
    nextCursor,
  });
}

export async function banIp(req, res) {
  const ipHash = String(req.body.ipHash || "").trim().toLowerCase();
  if (!isIpHash(ipHash)) return res.status(400).json({ message: "That isn't a known network." });

  const reason = String(req.body.reason || "").trim().slice(0, 500);
  const until = req.body.until ? new Date(req.body.until) : null;
  if (until && Number.isNaN(until.getTime())) return res.status(400).json({ message: "Invalid expiry date." });

  await prisma.bannedIp.upsert({
    where: { ipHash },
    create: { id: newId(), ipHash, reason, bannedById: req.user.id, expiresAt: until },
    update: { reason, bannedById: req.user.id, expiresAt: until },
  });
  await refreshBannedIps();

  await logStaffAction({
    staffId: req.user.id,
    action: "ban_ip",
    targetType: "ip",
    targetLabel: ipHandle(ipHash),
    meta: { ipHash, reason: reason || undefined, until: until || undefined },
  });

  staffResourceChanged(STAFF_RESOURCES.ipBans, { ipHash, action: "ban" });

  res.status(201).json({ ok: true });
}

export async function unbanIp(req, res) {
  const ipHash = String(req.params.ipHash || "").trim().toLowerCase();

  const existing = await prisma.bannedIp.findUnique({ where: { ipHash } });
  if (!existing) return res.status(404).json({ message: "That network isn't banned." });

  await prisma.bannedIp.delete({ where: { ipHash } });

  await refreshBannedIps();

  await logStaffAction({
    staffId: req.user.id,
    action: "unban_ip",
    targetType: "ip",
    targetLabel: ipHandle(ipHash),
    meta: { ipHash, reason: existing.reason || undefined, until: existing.expiresAt || undefined },
  });

  staffResourceChanged(STAFF_RESOURCES.ipBans, { ipHash, action: "unban" });

  res.json({ ok: true });
}

function matchRank(user, needle) {
  const username = (user.username || "").toLowerCase();
  const displayName = (user.displayName || "").toLowerCase();
  const discord = (user.discordUsername || "").toLowerCase();

  if (username === needle) return 0;
  if (displayName === needle) return 1;
  if (discord === needle) return 2;
  if (username.startsWith(needle)) return 3;
  if (displayName.startsWith(needle)) return 4;
  if (discord.startsWith(needle)) return 5;
  return 6;
}

export async function lookupUsers(req, res) {
  const needle = String(req.query.q || "").trim().replace(/^@/, "").toLowerCase();
  if (!needle) return res.json({ users: [] });

  const [exact, matches] = await Promise.all([
    prisma.user.findFirst({ where: { username: needle } }),
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: needle, mode: "insensitive" } },
          { displayName: { contains: needle, mode: "insensitive" } },
          { discordUsername: { contains: needle, mode: "insensitive" } },
        ],
      },
      take: LOOKUP_SCAN,
    }),
  ]);

  const found = new Map();
  if (exact) found.set(exact.id, exact);
  for (const user of matches) if (!found.has(user.id)) found.set(user.id, user);

  const ranked = [...found.values()]
    .sort((a, b) => {
      const byRank = matchRank(a, needle) - matchRank(b, needle);
      if (byRank !== 0) return byRank;

      const byLength = (a.username || "").length - (b.username || "").length;
      if (byLength !== 0) return byLength;

      return (a.username || "").localeCompare(b.username || "");
    })
    .slice(0, LOOKUP_LIMIT);

  res.json({ users: ranked.map((u) => serializeUser(u, {})) });
}

const DISCORD_EPOCH_MS = 1420070400000n;

function discordAccountCreatedAt(discordId) {
  if (!discordId || !/^\d+$/.test(String(discordId))) return null;
  try {
    return new Date(Number((BigInt(discordId) >> 22n) + DISCORD_EPOCH_MS));
  } catch {
    return null;
  }
}

async function buildDiscordIdentity(user) {
  const discordId = user.discordId || "";
  if (!discordId) return null;

  const [banRecord, linkedAccounts] = await Promise.all([
    prisma.bannedDiscordId.findUnique({
      where: { discordId },
      include: { bannedBy: { select: { username: true, displayName: true } } },
    }),
    prisma.user.findMany({
      where: { discordId, id: { not: user.id } },
      select: { id: true, username: true, displayName: true, status: true, accountKind: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 25,
    }),
  ]);

  return {
    id: discordId,
    username: user.discordUsername || "",
    profileUrl: `https://discord.com/users/${discordId}`,
    accountCreatedAt: discordAccountCreatedAt(discordId),
    isOwner: isOwnerDiscordId(discordId),
    ban: banRecord
      ? {
          reason: banRecord.reason || "",
          createdAt: banRecord.createdAt,
          bannedBy: banRecord.bannedBy
            ? banRecord.bannedBy.username || banRecord.bannedBy.displayName || null
            : null,
        }
      : null,
    linkedAccounts: linkedAccounts.map((account) => ({
      id: account.id,
      username: account.username || "",
      displayName: account.displayName || "",
      status: account.status,
      accountKind: account.accountKind,
      createdAt: account.createdAt,
    })),
  };
}

export async function getUserDetails(req, res) {
  const user = await prisma.user.findFirst({
    where: { username: req.params.username.toLowerCase() },
    include: { professionalCommunity: true },
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  const id = user.id;

  const [
    postsTotal,
    postsDeleted,
    replies,
    reposts,
    likesGiven,
    stories,
    messagesSent,
    conversations,
    followers,
    following,
    followRequestsPending,
    blocksMade,
    reportsFiled,
    reportsAgainst,
    memberships,
    suspensions,
    firstPost,
    latestPost,
    latestMessage,
    postIdRows,
    engagement,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: id, deleted: false } }),
    prisma.post.count({ where: { authorId: id, deleted: true } }),
    prisma.post.count({ where: { authorId: id, deleted: false, parentPostId: { not: null } } }),
    prisma.post.count({ where: { authorId: id, deleted: false, repostOfId: { not: null } } }),
    prisma.like.count({ where: { userId: id } }),
    prisma.story.count({ where: { authorId: id } }),
    prisma.message.count({ where: { senderId: id } }),
    prisma.conversationParticipant.count({ where: { userId: id } }),
    prisma.follow.count({ where: { followingId: id, status: "accepted" } }),
    prisma.follow.count({ where: { followerId: id, status: "accepted" } }),
    prisma.follow.count({ where: { followerId: id, status: "pending" } }),
    prisma.block.count({ where: { blockerId: id } }),
    prisma.report.count({ where: { reporterId: id } }),
    prisma.report.count({ where: { targetType: "user", targetId: id } }),
    prisma.communityMembership.findMany({
      where: { userId: id },
      include: { community: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.suspension.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { issuedBy: true, liftedBy: true },
    }),
    prisma.post.findFirst({ where: { authorId: id }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.post.findFirst({ where: { authorId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.message.findFirst({ where: { senderId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.post.findMany({ where: { authorId: id }, select: { id: true }, take: 2000 }),
    prisma.post.aggregate({
      where: { authorId: id, deleted: false },
      _sum: { likesCount: true, repostsCount: true, commentsCount: true, impressionsCount: true },
    }),
  ]);

  const reportsAgainstPosts = postIdRows.length
    ? await prisma.report.count({
        where: { targetType: "post", targetId: { in: postIdRows.map((p) => p.id) } },
      })
    : 0;

  const discord = req.staff.canViewDiscordIdentity ? await buildDiscordIdentity(user) : null;

  res.json({
    user: serializeUser(user, {}),
    discord,
    account: {
      id,
      ...(req.staff.canViewDiscordIdentity
        ? { discordId: user.discordId, discordUsername: user.discordUsername }
        : {}),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActiveAt: user.lastActiveAt,
      onboardingComplete: user.onboardingComplete,
      accountKind: user.accountKind,
      professionalCommunity: user.professionalCommunity
        ? {
            id: user.professionalCommunity.id,
            name: user.professionalCommunity.name,
            slug: user.professionalCommunity.slug,
          }
        : null,
      isPrivate: user.isPrivate,
      restrictMessages: user.restrictMessages,
      hideFollowing: user.hideFollowing,
      hideProfileMedia: user.hideProfileMedia,
      isVerified: user.isVerified,
      verificationStatus: user.verificationStatus,
      interests: user.interests,
      tokenVersion: user.tokenVersion,
      suspendedUntil: user.suspendedUntil,
      suspendReason: user.suspendReason,
    },
    stats: {
      postsTotal,
      postsDeleted,
      originalPosts: Math.max(postsTotal - replies - reposts, 0),
      replies,
      reposts,
      likesGiven,
      stories,
      messagesSent,
      conversations,
      followers,
      following,
      followRequestsPending,
      blocksMade,
      likesReceived: engagement._sum.likesCount || 0,
      repostsReceived: engagement._sum.repostsCount || 0,
      commentsReceived: engagement._sum.commentsCount || 0,
      impressions: engagement._sum.impressionsCount || 0,
      firstPostAt: firstPost?.createdAt || null,
      lastPostAt: latestPost?.createdAt || null,
      lastMessageAt: latestMessage?.createdAt || null,
    },
    moderation: {
      reportsFiled,
      reportsAgainst,
      reportsAgainstPosts,
      suspensions: suspensions.map((s) => ({
        id: s.id,
        kind: s.kind,
        reason: s.reason,
        until: s.until,
        active: s.active,
        issuedBy: s.issuedBy ? `@${s.issuedBy.username}` : null,
        liftedAt: s.liftedAt,
        liftedBy: s.liftedBy ? `@${s.liftedBy.username}` : null,
        createdAt: s.createdAt,
      })),
    },
    communities: memberships
      .filter((m) => m.community)
      .map((m) => ({
        id: m.community.id,
        name: m.community.name,
        slug: m.community.slug,
        role: m.role,
        status: m.status,
        postsCount: m.postsCount,
        professionalCategory: m.professionalCategory,
        professionalStatus: m.professionalStatus,
        verificationStatus: m.verificationStatus,
        joinedAt: m.createdAt,
      })),
  });
}

export async function listUserPosts(req, res) {
  const user = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  const limit = parseListLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);
  const includeDeleted = req.query.includeDeleted === "true";

  const rows = await prisma.post.findMany({
    where: withCursor(
      { authorId: user.id, ...(includeDeleted ? {} : { deleted: false }) },
      cursor
    ),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { community: { select: { slug: true, isGlobal: true } } },
  });

  const { page, nextCursor } = takePage(rows, limit);

  res.json({
    items: page.map((post) => ({
      id: post.id,
      content: (post.content || "").slice(0, 500),
      communitySlug: post.community?.isGlobal ? null : post.community?.slug || null,
      deleted: post.deleted,
      moderationStatus: post.moderationStatus,
      hasMedia: Boolean(post.mediaUrl),
      isReply: Boolean(post.parentPostId),
      isRepost: Boolean(post.repostOfId),
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
    })),
    nextCursor,
  });
}

export async function listUserReports(req, res) {
  const user = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  const limit = parseListLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);
  const direction = req.query.direction === "filed" ? "filed" : "against";

  let base;
  if (direction === "filed") {
    base = { reporterId: user.id };
  } else {
    const postIds = await prisma.post.findMany({
      where: { authorId: user.id },
      select: { id: true },
      take: 2000,
    });
    base = {
      OR: [
        { targetType: "user", targetId: user.id },
        ...(postIds.length
          ? [{ targetType: "post", targetId: { in: postIds.map((post) => post.id) } }]
          : []),
      ],
    };
  }

  const rows = await prisma.report.findMany({
    where: withCursor(base, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { reporter: true, reviewedBy: true },
  });

  const { page, nextCursor } = takePage(rows, limit);

  const targetPostIds = page.filter((row) => row.targetType === "post").map((row) => row.targetId);
  const targetPosts = targetPostIds.length
    ? await prisma.post.findMany({
        where: { id: { in: targetPostIds } },
        select: {
          id: true,
          deleted: true,
          author: { select: { username: true } },
          community: { select: { slug: true, isGlobal: true } },
        },
      })
    : [];
  const targetPostMap = new Map(targetPosts.map((post) => [post.id, post]));

  res.json({
    direction,
    items: page.map((report) => {
      const post = targetPostMap.get(report.targetId);
      return {
        id: report.id,
        source: report.source,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        actionTaken: report.actionTaken,
        content: report.contentSnapshot || "",
        targetAuthor: post?.author?.username || null,
        targetCommunitySlug: post?.community?.isGlobal ? null : post?.community?.slug || null,
        targetDeleted: report.targetType === "post" ? Boolean(post?.deleted) : false,
        reporter: report.reporter ? serializeUser(report.reporter, {}) : null,
        reviewedBy: report.reviewedBy ? serializeUser(report.reviewedBy, {}) : null,
        createdAt: report.createdAt,
      };
    }),
    nextCursor,
  });
}

export async function moderateUser(req, res) {
  const user = await prisma.user.findFirst({ where: { username: req.params.username.toLowerCase() } });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.id === req.user.id) {
    return res.status(400).json({ message: "You can't moderate your own account." });
  }
  if (!canModerate(req.user, user)) {
    return res.status(403).json({ message: "You don't have permission to moderate this account." });
  }

  const { action, until, reason } = req.body;

  if (!["suspend", "deactivate", "reinstate"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  if (action === "suspend" && !String(reason || "").trim()) {
    return res.status(400).json({ message: "A reason is required to suspend a user." });
  }
  if (until && Number.isNaN(new Date(until).getTime())) {
    return res.status(400).json({ message: "Invalid suspension end date." });
  }
  if (until && new Date(until) <= new Date()) {
    return res.status(400).json({ message: "The suspension end date must be in the future." });
  }

  const options = resolveModerationOptions({
    action,
    until,
    body: req.body,
    elevated: isElevatedStaff(req),
  });
  if (options.error) return res.status(options.error.status).json(options.error.body);

  const { purge, shouldDelete } = options;

  const updated = await applyModeration(
    user.id,
    action,
    until,
    reason ? String(reason).trim().slice(0, 500) : undefined,
    req.user.id
  );
  if (action !== "reinstate") disconnectUser(updated.id);

  if (action === "deactivate") {
    await autoResolveReportsForDeactivatedUser(updated.id, { staffId: req.user.id });
  }

  const purged = await applyPurgeOrDelete(updated, options, req.user.id);

  await logStaffAction({
    staffId: req.user.id,
    action: describeUserAction(action, updated),
    targetType: "user",
    targetId: updated.id,
    targetUser: updated.id,
    targetLabel: `@${updated.username}`,
    meta: {
      until: updated.suspendedUntil,
      reason: updated.suspendReason || undefined,
      purged: purged || undefined,
      purgeWindow: purge?.id,
      accountDeleted: shouldDelete || undefined,
      discordBanned: options.banDiscord ? Boolean(updated.discordId) : undefined,
    },
  });

  if (purged) {
    await logStaffAction({
      staffId: req.user.id,
      action: purgeAuditAction(options),
      targetType: "user",
      targetId: updated.id,
      targetUser: updated.id,
      targetLabel: `@${updated.username}`,
      meta: purged,
    });
  }

  res.json({ user: serializeUser(updated, {}), purged, accountDeleted: shouldDelete });
}

export async function resetUsername(req, res) {
  if (!isElevatedStaff(req)) {
    return res.status(403).json({ message: "Only admins and above can reset usernames." });
  }

  const user = await prisma.user.findFirst({ where: { username: req.params.username.toLowerCase() } });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.id === req.user.id) {
    return res.status(400).json({ message: "You can't reset your own username." });
  }
  if (!canModerate(req.user, user)) {
    return res.status(403).json({ message: "You don't have permission to moderate this account." });
  }

  let next = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const digits = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    const candidate = `user${digits}`;
    const owner = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!owner) {
      next = candidate;
      break;
    }
  }
  if (!next) {
    return res.status(500).json({ message: "Could not generate a unique username. Try again." });
  }

  const previous = user.username;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { username: next, usernameChangedAt: null },
  });
  await cacheDel(`user:session:${user.id}`);

  await logStaffAction({
    staffId: req.user.id,
    action: "reset_username",
    targetType: "user",
    targetId: updated.id,
    targetUser: updated.id,
    targetLabel: `@${updated.username}`,
    meta: { previous, next },
  });

  res.json({ user: serializeUser(updated, {}) });
}

export async function updateUserBadges(req, res) {
  const user = await prisma.user.findFirst({ where: { username: req.params.username.toLowerCase() } });
  if (!user) return res.status(404).json({ message: "User not found" });

  const action = req.body?.action;
  const badge = String(req.body?.badge || "");

  if (!["add", "remove"].includes(action)) {
    return res.status(400).json({ message: "Action must be add or remove." });
  }
  if (!GRANTABLE_BADGES[badge]) {
    return res.status(400).json({ message: "That badge can't be assigned." });
  }

  const current = Array.isArray(user.badges) ? user.badges : [];
  const has = current.includes(badge);

  if ((action === "add" && has) || (action === "remove" && !has)) {
    return res.json({ badges: current });
  }

  const badges = action === "add" ? [...current, badge] : current.filter((id) => id !== badge);

  await prisma.user.update({ where: { id: user.id }, data: { badges } });
  await cacheDel(`user:session:${user.id}`);

  await logStaffAction({
    staffId: req.user.id,
    action: action === "add" ? "grant_badge" : "revoke_badge",
    targetType: "user",
    targetId: user.id,
    targetUser: user.id,
    targetLabel: `@${user.username}`,
    meta: { badge },
  });

  res.json({ badges });
}

const HASHTAG_FORMAT = /^#[A-Za-z0-9_]{1,100}$/;
const HASHTAG_PREVIEW_LIMIT = 1000;
const HASHTAG_UPDATE_CHUNK = 500;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

const SUSPEND_DURATIONS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  indefinite: null,
};

const HASHTAG_AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  badges: true,
};

function normalizeHashtag(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const tag = raw.startsWith("#") ? raw : `#${raw}`;
  return HASHTAG_FORMAT.test(tag) ? tag.toLowerCase() : null;
}

function hashtagMatcher(tag) {
  const escaped = tag.slice(1).replace(REGEX_SPECIALS, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_])#${escaped}(?![A-Za-z0-9_])`, "i");
}

async function chunkedUpdate(model, ids, data) {
  let total = 0;
  for (let i = 0; i < ids.length; i += HASHTAG_UPDATE_CHUNK) {
    const result = await model.updateMany({
      where: { id: { in: ids.slice(i, i + HASHTAG_UPDATE_CHUNK) } },
      data,
    });
    total += result.count;
  }
  return total;
}

async function collectHashtagMatches(tag, { limit } = {}) {
  const matcher = hashtagMatcher(tag);
  const prefilter = { contains: tag, mode: "insensitive" };

  const [posts, messages] = await Promise.all([
    prisma.post.findMany({
      where: { deleted: false, content: prefilter },
      select: { id: true, content: true, authorId: true, author: { select: HASHTAG_AUTHOR_SELECT } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.message.findMany({
      where: { deletedAt: null, content: prefilter },
      select: { id: true, content: true, senderId: true, sender: { select: HASHTAG_AUTHOR_SELECT } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  return {
    posts: posts.filter((post) => matcher.test(post.content)),
    messages: messages.filter((message) => matcher.test(message.content)),
  };
}

function tallyHashtagUsers(posts, messages) {
  const usersMap = new Map();

  for (const post of posts) {
    if (!post.author) continue;
    const entry = usersMap.get(post.author.id) || { user: post.author, postCount: 0, messageCount: 0 };
    entry.postCount += 1;
    usersMap.set(post.author.id, entry);
  }

  for (const message of messages) {
    if (!message.sender) continue;
    const entry = usersMap.get(message.sender.id) || { user: message.sender, postCount: 0, messageCount: 0 };
    entry.messageCount += 1;
    usersMap.set(message.sender.id, entry);
  }

  return [...usersMap.values()].sort(
    (a, b) => b.postCount + b.messageCount - (a.postCount + a.messageCount)
  );
}

export async function getHashtagDetails(req, res) {
  const tag = normalizeHashtag(req.query.hashtag);
  if (!tag) {
    return res.status(400).json({ message: "Provide a hashtag using letters, numbers or underscores." });
  }

  const { posts, messages } = await collectHashtagMatches(tag, { limit: HASHTAG_PREVIEW_LIMIT });
  const users = tallyHashtagUsers(posts, messages);

  res.json({
    hashtag: tag,
    postsCount: posts.length,
    messagesCount: messages.length,
    usersCount: users.length,
    truncated: posts.length >= HASHTAG_PREVIEW_LIMIT || messages.length >= HASHTAG_PREVIEW_LIMIT,
    users,
  });
}

export async function deleteHashtag(req, res) {
  const { moderateUsers = false, userAction = "suspend", suspendDuration = "24h", reason = "" } = req.body;

  const tag = normalizeHashtag(req.body.hashtag);
  if (!tag) {
    return res.status(400).json({ message: "Provide a hashtag using letters, numbers or underscores." });
  }
  if (moderateUsers && !["suspend", "deactivate"].includes(userAction)) {
    return res.status(400).json({ message: "Invalid moderation action." });
  }
  if (moderateUsers && userAction === "suspend" && !(suspendDuration in SUSPEND_DURATIONS)) {
    return res.status(400).json({ message: "Invalid suspension duration." });
  }

  const { posts, messages } = await collectHashtagMatches(tag);
  const uniqueUsers = [
    ...new Map(
      [
        ...posts.map((post) => [post.authorId, post.author]),
        ...messages.map((message) => [message.senderId, message.sender]),
      ].filter(([id, user]) => id && user)
    ).values(),
  ];

  const postsDeleted = await chunkedUpdate(prisma.post, posts.map((post) => post.id), { deleted: true });
  const messagesDeleted = await chunkedUpdate(prisma.message, messages.map((message) => message.id), {
    deletedAt: new Date(),
  });

  let moderatedUsersCount = 0;
  const skippedUsernames = [];

  if (moderateUsers) {
    const modReason = (String(reason || "").trim() || `Posted prohibited hashtag ${tag}`).slice(0, 500);
    const durationMs = userAction === "suspend" ? SUSPEND_DURATIONS[suspendDuration] : null;
    const until = durationMs ? new Date(Date.now() + durationMs).toISOString() : null;

    for (const targetUser of uniqueUsers) {
      if (targetUser.id === req.user.id || !canModerate(req.user, targetUser)) {
        skippedUsernames.push(targetUser.username);
        continue;
      }
      try {
        await applyModeration(targetUser.id, userAction, until, modReason, req.user.id);
        disconnectUser(targetUser.id);
        moderatedUsersCount += 1;
      } catch (err) {
        skippedUsernames.push(targetUser.username);
        console.error(`Failed to moderate ${targetUser.username} for ${tag}`, err);
      }
    }
  }

  const affectedUsernames = uniqueUsers.map((user) => user.username);

  await logStaffAction({
    staffId: req.user.id,
    action: "delete_hashtag",
    targetType: "hashtag",
    targetId: tag,
    targetLabel: tag,
    meta: {
      postsDeleted,
      messagesDeleted,
      affectedUsersCount: affectedUsernames.length,
      moderatedUsersCount,
      skippedUsersCount: skippedUsernames.length,
      userAction: moderateUsers ? userAction : "none",
      suspendDuration: moderateUsers && userAction === "suspend" ? suspendDuration : null,
      reason: String(reason || "").trim().slice(0, 500),
      affectedUsernames: affectedUsernames.slice(0, 50),
    },
  });

  const actionMsg = moderatedUsersCount > 0 ? ` and moderated ${moderatedUsersCount} user(s)` : "";
  res.json({
    success: true,
    postsDeleted,
    messagesDeleted,
    affectedUsersCount: affectedUsernames.length,
    moderatedUsersCount,
    skippedUsersCount: skippedUsernames.length,
    affectedUsernames,
    message: `Removed ${tag} (${postsDeleted} post(s), ${messagesDeleted} message(s)${actionMsg}).`,
  });
}

const USER_LABEL_MAX = 280;

export async function setUserLabel(req, res) {
  const username = String(req.params.username || "").toLowerCase();
  if (!username) return res.status(404).json({ message: "User not found." });

  const label = String(req.body?.label ?? "").replace(/\s+/g, " ").trim().slice(0, USER_LABEL_MAX);

  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) return res.status(404).json({ message: "User not found." });

  const previous = user.accountLabel || "";
  if (previous === label) {
    return res.json({ ok: true, accountLabel: label });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { accountLabel: label },
  });

  await cacheDel(`user:session:${user.id}`);

  await logStaffAction({
    staffId: req.user.id,
    action: label ? "set_user_label" : "clear_user_label",
    targetType: "user",
    targetId: user.id,
    targetUser: user.id,
    targetLabel: `@${user.username}`,
    meta: {
      label: label || undefined,
      previousLabel: previous || undefined,
    },
  });

  res.json({ ok: true, accountLabel: label });
}

