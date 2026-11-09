import { prisma } from "../db/prisma.js";
import { isValidObjectId } from "../lib/ids.js";
import { ipHandle } from "../lib/ipHash.js";
import { serializeUser } from "../services/hydrate.js";
import { revokeStaffSession } from "../services/staffSession.js";
import { disconnectStaffUser } from "../services/realtime.js";
import { logStaffAction } from "../services/auditLog.js";
import { staffResourceChanged, STAFF_RESOURCES } from "../services/staffEvents.js";
import { hasPermission } from "../config/roles.js";
import {
  reverseAuditEntry,
  reversalInfo,
  reversiblePermission,
  collectUndoneIds,
} from "../services/staffReversal.js";
import {
  parseLimit,
  parseWindow,
  parseCursor,
  makeCursor,
  withCursor,
  takePage,
} from "../utils/staffPagination.js";

const CSV_MAX_ROWS = 50000;
const CSV_BATCH_SIZE = 500;
const FLAG_GROUP_LIMIT = 100;

function auditWhere(query) {
  const where = { communityId: null };

  if (query.action) where.action = { contains: String(query.action), mode: "insensitive" };
  if (query.targetType) where.targetType = String(query.targetType);
  if (query.staffId && isValidObjectId(query.staffId)) where.staffId = String(query.staffId);
  if (query.important === "true") where.important = true;

  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    where.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) where.createdAt.gte = from;
    if (to && !Number.isNaN(to.getTime())) where.createdAt.lte = to;
  }

  const q = String(query.q || "").trim();
  if (q) {
    where.OR = [
      { targetLabel: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

function serializeAuditEntry(entry, opts = {}) {
  const reversal = reversalInfo(entry, opts.undoneIds);
  return {
    id: entry.id,
    staff: entry.staff ? serializeUser(entry.staff, {}) : null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetUser: entry.targetUser ? serializeUser(entry.targetUser, {}) : null,
    targetLabel: entry.targetLabel,
    meta: entry.meta,
    important: entry.important,
    undoable: reversal.undoable,
    undone: Boolean(reversal.undone),
    createdAt: entry.createdAt,
  };
}

export async function listPanelAuditLog(req, res) {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await prisma.staffAuditLog.findMany({
    where: withCursor(auditWhere(req.query), cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { staff: true, targetUser: true },
  });

  const { page, nextCursor } = takePage(rows, limit);
  const undoneIds = await collectUndoneIds(page);

  res.json({ items: page.map((entry) => serializeAuditEntry(entry, { undoneIds })), nextCursor });
}

export async function listUserAuditLog(req, res) {
  const username = String(req.params.username || "").toLowerCase();
  if (!username) return res.status(404).json({ message: "User not found" });

  const user = await prisma.user.findFirst({ where: { username }, select: { id: true } });
  if (!user) return res.status(404).json({ message: "User not found" });

  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const where = { communityId: null, targetUserId: user.id };

  const rows = await prisma.staffAuditLog.findMany({
    where: withCursor(where, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { staff: true, targetUser: true },
  });

  const { page, nextCursor } = takePage(rows, limit);
  const undoneIds = await collectUndoneIds(page);

  res.json({ items: page.map((entry) => serializeAuditEntry(entry, { undoneIds })), nextCursor });
}

export async function undoAuditAction(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Audit entry not found" });
  }

  const entry = await prisma.staffAuditLog.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ message: "Audit entry not found" });

  const info = reversalInfo(entry);
  if (!info.undoable) {
    return res.status(400).json({ message: info.reason || "This action can't be undone." });
  }

  const perm = reversiblePermission(entry.action);
  if (perm && !hasPermission(req.staff.role, perm)) {
    return res.status(403).json({ message: "You don't have permission to undo this action." });
  }

  try {
    const result = await reverseAuditEntry({ entry, staffId: req.staffUser.id });
    res.json({ ok: true, message: result.message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Failed to undo." });
  }
}

const SPREADSHEET_TRIGGER = /^[=+\-@\t\r]/;

function csvCell(value) {
  if (value === null || value === undefined) return "";

  const raw = value instanceof Date ? value.toISOString() : String(value);
  const text = SPREADSHEET_TRIGGER.test(raw) ? `'${raw}` : raw;

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportAuditLogCsv(req, res) {
  const where = auditWhere(req.query);
  const header = ["timestamp", "staff", "action", "targetType", "targetId", "targetLabel", "targetUser", "important", "meta"];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-log-${Date.now()}.csv"`);

  res.write(`﻿${header.join(",")}\r\n`);

  let written = 0;
  let cursor = null;
  let truncated = false;

  for (;;) {
    const batch = await prisma.staffAuditLog.findMany({
      where: withCursor(where, cursor),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(CSV_BATCH_SIZE, CSV_MAX_ROWS - written),
      include: { staff: true, targetUser: true },
    });

    if (batch.length === 0) break;

    for (const row of batch) {
      const line = [
        csvCell(row.createdAt),
        csvCell(row.staff?.username),
        csvCell(row.action),
        csvCell(row.targetType),
        csvCell(row.targetId),
        csvCell(row.targetLabel),
        csvCell(row.targetUser?.username),
        csvCell(row.important ? "kept" : ""),
        csvCell(row.meta ? JSON.stringify(row.meta) : ""),
      ].join(",");

      if (!res.write(`${line}\r\n`)) {
        await new Promise((resolve) => res.once("drain", resolve));
      }
    }

    written += batch.length;
    cursor = { createdAt: batch[batch.length - 1].createdAt, id: batch[batch.length - 1].id };

    if (written >= CSV_MAX_ROWS) {
      truncated = (await prisma.staffAuditLog.count({ where: withCursor(where, cursor) })) > 0;
      break;
    }
  }

  if (truncated) {
    const notice = `TRUNCATED at ${CSV_MAX_ROWS} rows. Narrow the date range to get the rest.`;
    res.write(`${["", "", csvCell(notice), "", "", "", "", ""].join(",")}\r\n`);
  }

  await logStaffAction({
    staffId: req.staffUser.id,
    action: "export_audit_log",
    targetType: "audit_log",
    targetLabel: `${written} rows`,
    meta: { filters: req.query, rows: written, truncated },
  });

  res.end();
}

export async function listSecurityFlags(req, res) {
  const groupBy = ["network", "user", "type"].includes(req.query.groupBy) ? req.query.groupBy : "network";
  const hours = parseWindow(req.query.hours, { fallback: 24, max: 720 });
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const where = { createdAt: { gte: since } };
  if (req.query.type) where.type = String(req.query.type);

  if (groupBy === "type") {
    const grouped = await prisma.securityFlag.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { type: "desc" } },
      take: FLAG_GROUP_LIMIT,
    });

    res.json({
      groupBy,
      hours,
      groups: grouped.map((row) => ({
        key: row.type,
        label: row.type,
        count: row._count._all,
        lastSeenAt: row._max.createdAt,
      })),
    });
    return;
  }

  const field = groupBy === "user" ? "userId" : "ipHash";
  const grouped = await prisma.securityFlag.groupBy({
    by: [field],
    where: groupBy === "user" ? { ...where, userId: { not: null } } : where,
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { [field]: "desc" } },
    take: FLAG_GROUP_LIMIT,
  });

  const keys = grouped.map((row) => row[field]).filter(Boolean);

  const [users, bans] = await Promise.all([
    groupBy === "user" && keys.length
      ? prisma.user.findMany({ where: { id: { in: keys } } })
      : Promise.resolve([]),
    groupBy === "network" && keys.length
      ? prisma.bannedIp.findMany({ where: { ipHash: { in: keys } }, select: { ipHash: true } })
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map((user) => [user.id, serializeUser(user, {})]));
  const bannedIps = new Set(bans.map((ban) => ban.ipHash));

  res.json({
    groupBy,
    hours,
    groups: grouped.map((row) => {
      const key = row[field];
      return {
        key,
        label: groupBy === "user" ? userMap.get(key)?.username || key : groupBy === "network" ? ipHandle(key) : key,
        user: groupBy === "user" ? userMap.get(key) || null : null,
        isBanned: groupBy === "network" ? bannedIps.has(key) : false,
        count: row._count._all,
        lastSeenAt: row._max.createdAt,
      };
    }),
  });
}

export async function listSecurityFlagDetail(req, res) {
  const groupBy = ["network", "user", "type"].includes(req.query.groupBy) ? req.query.groupBy : "network";
  const key = String(req.query.key || "");
  if (!key) return res.status(400).json({ message: "A group key is required" });

  const hours = parseWindow(req.query.hours, { fallback: 24, max: 720 });
  const where = { createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) } };

  if (groupBy === "network") where.ipHash = key;
  else if (groupBy === "user") where.userId = key;
  else where.type = key;

  const flags = await prisma.securityFlag.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });

  res.json({
    items: flags.map((flag) => ({
      id: flag.id,
      type: flag.type,
      network: ipHandle(flag.ipHash),
      path: flag.path,
      method: flag.method,
      userAgent: flag.userAgent,
      user: flag.user ? serializeUser(flag.user, {}) : null,
      meta: flag.meta,
      createdAt: flag.createdAt,
    })),
  });
}

const MODERATION_ACTIONS = [
  "suspend_user",
  "ban_user",
  "deactivate_user",
  "reinstate_user",
  "delete_post",
  "dismiss_report",
  "purge_recent_content",
  "ban_and_delete_account",
  "ban_ip",
  "unban_ip",
];

export async function listModerationHistory(req, res) {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);
  const kind = String(req.query.kind || "").trim();

  const canSeeIps = Boolean(req.staff.canViewPrivateData);
  const targetTypes = canSeeIps ? ["user", "post", "ip"] : ["user", "post"];
  const actions = canSeeIps
    ? MODERATION_ACTIONS
    : MODERATION_ACTIONS.filter((action) => !action.endsWith("_ip"));

  const where = { communityId: null };

  if (kind === "users") where.targetType = "user";
  else if (kind === "posts") where.targetType = "post";
  else if (kind === "ips") {
    if (!canSeeIps) return res.status(403).json({ message: "Forbidden" });
    where.targetType = "ip";
  } else where.OR = [{ targetType: { in: targetTypes } }, { action: { in: actions } }];

  if (!canSeeIps) {
    where.AND = [...(where.AND || []), { NOT: { targetType: "ip" } }];
  }

  const username = String(req.query.username || "").trim();
  if (username) {
    const target = await prisma.user.findFirst({ where: { username }, select: { id: true } });
    if (!target) return res.json({ items: [], nextCursor: null });
    where.targetUserId = target.id;
  }

  const rows = await prisma.staffAuditLog.findMany({
    where: withCursor(where, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { staff: true, targetUser: true },
  });

  const { page, nextCursor } = takePage(rows, limit);
  const undoneIds = await collectUndoneIds(page);

  res.json({ items: page.map((entry) => serializeAuditEntry(entry, { undoneIds })), nextCursor });
}

export async function getStaffActivity(req, res) {
  const days = parseWindow(req.query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { communityId: null, createdAt: { gte: since } };

  const [byStaff, byAction, total] = await Promise.all([
    prisma.staffAuditLog.groupBy({
      by: ["staffId"],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { staffId: "desc" } },
      take: 50,
    }),
    prisma.staffAuditLog.groupBy({
      by: ["action"],
      where,
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 25,
    }),
    prisma.staffAuditLog.count({ where }),
  ]);

  const staffIds = byStaff.map((row) => row.staffId).filter(Boolean);
  const users = staffIds.length
    ? await prisma.user.findMany({ where: { id: { in: staffIds } } })
    : [];
  const userMap = new Map(users.map((user) => [user.id, serializeUser(user, {})]));

  const perStaffActions = staffIds.length
    ? await prisma.staffAuditLog.groupBy({
        by: ["staffId", "action"],
        where: { ...where, staffId: { in: staffIds } },
        _count: { _all: true },
      })
    : [];

  const breakdown = new Map();
  for (const row of perStaffActions) {
    const list = breakdown.get(row.staffId) ?? [];
    list.push({ action: row.action, count: row._count._all });
    breakdown.set(row.staffId, list);
  }

  res.json({
    days,
    total,
    staff: byStaff.map((row) => ({
      staff: userMap.get(row.staffId) || null,
      staffId: row.staffId,
      count: row._count._all,
      lastActionAt: row._max.createdAt,
      actions: (breakdown.get(row.staffId) ?? []).sort((a, b) => b.count - a.count).slice(0, 6),
    })),
    actions: byAction.map((row) => ({ action: row.action, count: row._count._all })),
  });
}

export async function listPanelStaffSessions(req, res) {
  const includeInactive = req.query.all === "true";
  const now = new Date();

  const limit = parseLimit(req.query.limit);
  const base = includeInactive ? {} : { revokedAt: null, absoluteExpiresAt: { gt: now } };

  const cursor = parseCursor(req.query.cursor);
  const where = cursor
    ? {
        ...base,
        AND: [
          {
            OR: [
              { lastSeenAt: { lt: cursor.createdAt } },
              { lastSeenAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          },
        ],
      }
    : base;

  const rows = await prisma.staffSession.findMany({
    where,
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { user: true, revokedBy: true },
  });

  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;
  const last = sessions[sessions.length - 1];

  res.json({
    nextCursor: hasMore && last ? `${last.lastSeenAt.getTime()}_${last.id}` : null,
    items: sessions.map((session) => ({
      id: session.id,
      jti: session.jti,
      user: session.user ? serializeUser(session.user, {}) : null,
      network: ipHandle(session.ipHash),
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      revokedAt: session.revokedAt,
      revokedBy: session.revokedBy ? serializeUser(session.revokedBy, {}) : null,
      isActive: !session.revokedAt && session.absoluteExpiresAt > now,
      isCurrent: session.jti === req.staffSessionId,
      createdAt: session.createdAt,
    })),
  });
}

export async function revokePanelStaffSession(req, res) {
  const jti = String(req.params.jti || "");
  if (!jti) return res.status(404).json({ message: "Session not found" });

  const session = await prisma.staffSession.findFirst({ where: { jti }, include: { user: true } });
  if (!session) return res.status(404).json({ message: "Session not found" });
  if (session.revokedAt) return res.status(409).json({ message: "That session is already revoked." });

  await revokeStaffSession(jti, req.staffUser.id);
  disconnectStaffUser(session.userId);

  await logStaffAction({
    staffId: req.staffUser.id,
    action: "revoke_staff_session",
    targetType: "staff_session",
    targetId: session.id,
    targetUser: session.userId,
    targetLabel: session.user ? `@${session.user.username}` : "",
    meta: { network: ipHandle(session.ipHash) },
  });

  staffResourceChanged(STAFF_RESOURCES.staffSessions, { jti, userId: session.userId });

  res.json({ ok: true });
}
