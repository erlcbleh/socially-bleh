import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { assignableRolesFor, effectiveRole, hasPermission } from "../config/roles.js";
import { hashIp } from "../lib/ipHash.js";

const STAFF_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const STAFF_RENEW_BELOW_MS = 6 * 60 * 60 * 1000;
const STAFF_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONTEXT_TTL_MS = 30 * 1000;
const LAST_SEEN_THROTTLE_MS = 60 * 1000;

const staffSecret = crypto.createHash("sha256").update(`${env.jwtSecret}:staff:v1`).digest("hex");

const revokedJtis = new Set();
const contextCache = new Map();

export const staffSessionTtlMs = STAFF_TOKEN_TTL_MS;

export function signStaffToken({ userId, jti, staffSessionVersion, absoluteExpiresAt }) {
  const absMs = absoluteExpiresAt.getTime();
  const lifetimeMs = Math.min(STAFF_TOKEN_TTL_MS, absMs - Date.now());
  if (lifetimeMs <= 0) return null;

  return jwt.sign({ sub: userId, jti, typ: "staff", v: staffSessionVersion ?? 0, abs: absMs }, staffSecret, {
    expiresIn: Math.floor(lifetimeMs / 1000),
  });
}

export function verifyStaffToken(token) {
  const payload = jwt.verify(token, staffSecret);
  if (payload?.typ !== "staff") throw new Error("Not a staff token");
  if (!payload.jti || !payload.sub) throw new Error("Malformed staff token");
  if (!payload.abs || payload.abs <= Date.now()) throw new Error("Staff session past its hard cap");
  return payload;
}

export async function createStaffSession(user, { ip, userAgent } = {}) {
  const jti = crypto.randomBytes(24).toString("hex");
  const absoluteExpiresAt = new Date(Date.now() + STAFF_ABSOLUTE_TTL_MS);

  await prisma.staffSession.create({
    data: {
      id: newId(),
      jti,
      userId: user.id,
      ipHash: hashIp(ip),
      userAgent: String(userAgent || "").slice(0, 500),
      lastSeenAt: new Date(),
      absoluteExpiresAt,
    },
  });

  return {
    jti,
    token: signStaffToken({
      userId: user.id,
      jti,
      staffSessionVersion: user.staffSessionVersion,
      absoluteExpiresAt,
    }),
  };
}

export function staffCookieOptions(maxAge = STAFF_TOKEN_TTL_MS) {
  return { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, maxAge, path: "/" };
}

export function isStaffSessionRevoked(jti) {
  return revokedJtis.has(jti);
}

export async function revokeStaffSession(jti, revokedById = null) {
  revokedJtis.add(jti);
  await prisma.staffSession.updateMany({
    where: { jti, revokedAt: null },
    data: { revokedAt: new Date(), revokedById },
  });
}

export async function revokeAllStaffSessionsForUser(userId, revokedById = null) {
  const sessions = await prisma.staffSession.findMany({
    where: { userId, revokedAt: null },
    select: { jti: true },
  });
  for (const session of sessions) revokedJtis.add(session.jti);
  await prisma.staffSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedById },
  });
  contextCache.delete(String(userId));
  return sessions.length;
}

export async function refreshRevokedStaffSessions() {
  const sessions = await prisma.staffSession.findMany({
    where: { revokedAt: { not: null }, absoluteExpiresAt: { gt: new Date() } },
    select: { jti: true },
  });

  revokedJtis.clear();
  for (const session of sessions) revokedJtis.add(session.jti);
  return revokedJtis.size;
}

export function invalidateStaffContext(userId) {
  contextCache.delete(String(userId));
}

async function loadStaffContext(user) {
  const memberships = await prisma.communityMembership.findMany({
    where: { userId: user.id, status: "active", role: { in: ["owner", "staff"] } },
    select: { communityId: true, role: true },
  });

  const communityRoles = new Map();
  for (const membership of memberships) {
    communityRoles.set(String(membership.communityId), membership.role);
  }

  const role = effectiveRole(user);

  return {
    role,
    isGlobalStaff: hasPermission(role, "access_staff_panel"),
    isAdmin: hasPermission(role, "manage_roles"),
    canViewPrivateData: hasPermission(role, "view_private_data"),
    canViewDiscordIdentity: hasPermission(role, "view_discord_identity"),
    assignableRoles: assignableRolesFor(role),
    communityRoles,
  };
}

export async function getStaffContext(user) {
  const key = String(user.id);
  const cached = contextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await loadStaffContext(user);
  contextCache.set(key, { value, expiresAt: Date.now() + CONTEXT_TTL_MS });
  return value;
}

export function shouldRenewStaffToken(payload) {
  if (!payload?.exp) return false;
  return payload.exp * 1000 - Date.now() < STAFF_RENEW_BELOW_MS;
}

export function renewStaffToken(payload, user) {
  return signStaffToken({
    userId: user.id,
    jti: payload.jti,
    staffSessionVersion: user.staffSessionVersion,
    absoluteExpiresAt: new Date(payload.abs),
  });
}

export function touchStaffSession(jti, ip) {
  const now = Date.now();
  prisma.staffSession
    .updateMany({
      where: { jti, lastSeenAt: { lt: new Date(now - LAST_SEEN_THROTTLE_MS) } },
      data: { lastSeenAt: new Date(now), ipHash: hashIp(ip) },
    })
    .catch(() => {});
}

export function serializeStaffContext(staff) {
  return {
    role: staff.role,
    isGlobalStaff: staff.isGlobalStaff,
    isAdmin: staff.isAdmin,
    canViewPrivateData: staff.canViewPrivateData,
    canViewDiscordIdentity: staff.canViewDiscordIdentity,
    assignableRoles: staff.assignableRoles,
    communityRoles: Object.fromEntries(staff.communityRoles),
  };
}
