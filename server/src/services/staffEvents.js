import { ipHandle } from "../lib/ipHash.js";

export const STAFF_EVENTS = Object.freeze({
  reportsChanged: "staff:reports:changed",
  queueChanged: "staff:queue:changed",
  auditAppended: "staff:audit:appended",
  presence: "staff:presence",
  securityFlagged: "staff:security:flagged",
  resourceChanged: "staff:resource:changed",
});

export const STAFF_RESOURCES = Object.freeze({
  ipBans: "ipBans",
  verification: "verification",
  copyright: "copyright",
  staffApplications: "staffApplications",
  staffRoles: "staffRoles",
  staffSessions: "staffSessions",
  layoutPresets: "layoutPresets",
  emailSupport: "emailSupport",
});

const ADMIN_ONLY_RESOURCES = new Set([
  STAFF_RESOURCES.copyright,
  STAFF_RESOURCES.staffApplications,
  STAFF_RESOURCES.staffRoles,
  STAFF_RESOURCES.staffSessions,
  STAFF_RESOURCES.emailSupport,
]);

export const STAFF_ROOM = "staff";
export const STAFF_ADMIN_ROOM = "staff:admin";

const REPORT_COALESCE_MS = 250;
const SECURITY_COALESCE_MS = 1000;
const SECURITY_SAMPLE_LIMIT = 20;

let io = null;

export function staffCommunityRoom(communityId) {
  return `staff:community:${String(communityId)}`;
}

export function staffUserRoom(userId) {
  return `staff:user:${String(userId)}`;
}

export function registerStaffIo(instance) {
  io = instance;
}

function emit(room, event, payload) {
  if (!io || !room) return;
  io.to(room).emit(event, payload);
}

export function emitToStaff(event, payload) {
  emit(STAFF_ROOM, event, payload);
}

export function emitToStaffAdmins(event, payload) {
  emit(STAFF_ADMIN_ROOM, event, payload);
}

export function emitToStaffCommunity(communityId, event, payload) {
  if (!communityId) return;
  emit(staffCommunityRoom(communityId), event, payload);
}

let reportBatch = null;
let reportTimer = null;

function emptyBucket() {
  return { created: new Set(), updated: new Set() };
}

function ensureReportBatch() {
  if (!reportBatch) {
    reportBatch = { global: emptyBucket(), communities: new Map() };
    reportTimer = setTimeout(flushReportBatch, REPORT_COALESCE_MS);
    if (typeof reportTimer.unref === "function") reportTimer.unref();
  }
  return reportBatch;
}

function communityBucket(batch, communityId) {
  const key = String(communityId);
  let bucket = batch.communities.get(key);
  if (!bucket) {
    bucket = emptyBucket();
    batch.communities.set(key, bucket);
  }
  return bucket;
}

function serializeBucket(bucket) {
  return { created: [...bucket.created], updated: [...bucket.updated], at: Date.now() };
}

function flushReportBatch() {
  const batch = reportBatch;
  reportBatch = null;
  reportTimer = null;
  if (!batch) return;

  const global = serializeBucket(batch.global);
  if (global.created.length || global.updated.length) {
    emitToStaff(STAFF_EVENTS.reportsChanged, global);
  }

  for (const [communityId, bucket] of batch.communities) {
    emitToStaffCommunity(communityId, STAFF_EVENTS.reportsChanged, serializeBucket(bucket));
  }

  emitQueueChanged();
}

function recordReport(kind, report) {
  if (!io || !report?.id) return;
  const batch = ensureReportBatch();
  batch.global[kind].add(String(report.id));
  if (report.communityId) communityBucket(batch, report.communityId)[kind].add(String(report.id));
}

export function reportCreated(report) {
  recordReport("created", report);
}

export function reportUpdated(report) {
  recordReport("updated", report);
}

export function emitQueueChanged() {
  emitToStaff(STAFF_EVENTS.queueChanged, { at: Date.now() });
}

export function auditAppended(entry) {
  if (!io || !entry) return;

  const payload = {
    id: entry.id,
    staffId: entry.staffId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetUserId: entry.targetUserId || null,
    targetLabel: entry.targetLabel || "",
    communityId: entry.communityId || null,
    createdAt: entry.createdAt,
  };

  emitToStaff(STAFF_EVENTS.auditAppended, payload);
  if (payload.communityId) emitToStaffCommunity(payload.communityId, STAFF_EVENTS.auditAppended, payload);
}

let securityBatch = null;
let securityTimer = null;

function flushSecurityBatch() {
  const batch = securityBatch;
  securityBatch = null;
  securityTimer = null;
  if (!batch) return;

  emitToStaffAdmins(STAFF_EVENTS.securityFlagged, {
    count: batch.count,
    types: Object.fromEntries(batch.types),
    networks: [...batch.networks],
    sample: batch.sample,
    at: Date.now(),
  });
}

export function securityFlagged(flag) {
  if (!io || !flag) return;

  if (!securityBatch) {
    securityBatch = { count: 0, types: new Map(), networks: new Set(), sample: null };
    securityTimer = setTimeout(flushSecurityBatch, SECURITY_COALESCE_MS);
    if (typeof securityTimer.unref === "function") securityTimer.unref();
  }

  securityBatch.count += 1;
  securityBatch.types.set(flag.type, (securityBatch.types.get(flag.type) || 0) + 1);
  if (flag.ipHash && securityBatch.networks.size < SECURITY_SAMPLE_LIMIT) {
    securityBatch.networks.add(ipHandle(flag.ipHash));
  }
  securityBatch.sample ??= {
    id: flag.id,
    type: flag.type,
    network: flag.ipHash ? ipHandle(flag.ipHash) : null,
    path: flag.path || "",
    userId: flag.userId || null,
    createdAt: flag.createdAt,
  };
}

export function staffResourceChanged(resource, meta = {}) {
  if (!io || !resource) return;

  const payload = { resource, at: Date.now(), ...meta };

  if (ADMIN_ONLY_RESOURCES.has(resource)) emitToStaffAdmins(STAFF_EVENTS.resourceChanged, payload);
  else emitToStaff(STAFF_EVENTS.resourceChanged, payload);
}

export function emitStaffPresence(payload) {
  emitToStaff(STAFF_EVENTS.presence, payload);
}
