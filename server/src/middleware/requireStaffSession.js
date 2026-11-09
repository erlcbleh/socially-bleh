import { env } from "../config/env.js";
import { hasPermission } from "../config/roles.js";
import { prisma } from "../db/prisma.js";
import { cacheGet, cacheSet } from "../db/redis.js";
import {
  verifyStaffToken,
  isStaffSessionRevoked,
  getStaffContext,
  shouldRenewStaffToken,
  renewStaffToken,
  staffCookieOptions,
  touchStaffSession,
  staffSessionTtlMs,
} from "../services/staffSession.js";

const unauthenticated = (res) => res.status(401).json({ message: "Staff authentication required" });
const STAFF_CACHE_TTL = 300;

async function getCachedStaffUser(userId) {
  const cacheKey = `staff:user:${userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    cacheSet(cacheKey, user, STAFF_CACHE_TTL).catch(() => {});
  }
  return user;
}

export async function requireStaffSession(req, res, next) {
  try {
    const token = req.cookies?.[env.staffCookieName];
    if (!token) return unauthenticated(res);

    let payload;
    try {
      payload = verifyStaffToken(token);
    } catch {
      res.clearCookie(env.staffCookieName, { path: "/" });
      return unauthenticated(res);
    }

    if (isStaffSessionRevoked(payload.jti)) {
      res.clearCookie(env.staffCookieName, { path: "/" });
      return unauthenticated(res);
    }

    const user = await getCachedStaffUser(payload.sub);
    if (!user) return unauthenticated(res);

    if ((payload.v ?? 0) !== (user.staffSessionVersion ?? 0)) {
      res.clearCookie(env.staffCookieName, { path: "/" });
      return unauthenticated(res);
    }

    if (user.status !== "active") {
      return res.status(403).json({ code: "account_inactive", message: "This account cannot access the staff panel." });
    }

    const staff = await getStaffContext(user);
    if (!staff.isGlobalStaff && staff.communityRoles.size === 0) {
      return res.status(403).json({ message: "You do not hold any moderation authority." });
    }

    if (shouldRenewStaffToken(payload)) {
      const renewed = renewStaffToken(payload, user);
      if (renewed) {
        res.cookie(env.staffCookieName, renewed, staffCookieOptions(Math.min(staffSessionTtlMs, payload.abs - Date.now())));
      }
    }

    req.staffUser = user;
    req.staffSessionId = payload.jti;
    req.staff = staff;
    touchStaffSession(payload.jti, req.ip);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireGlobalStaff(req, res, next) {
  if (!req.staff?.isGlobalStaff) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export function requireStaffAdmin(req, res, next) {
  if (!req.staff?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export function requireStaffPermission(permission) {
  return function staffPermissionGuard(req, res, next) {
    if (!req.staff?.isGlobalStaff || !hasPermission(req.staff.role, permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

const COMMUNITY_ROLE_LEVEL = { staff: 1, owner: 2 };

export function requireStaffCommunity(minRole = "staff") {
  const required = COMMUNITY_ROLE_LEVEL[minRole] ?? 1;

  return async function staffCommunityGuard(req, res, next) {
    try {
      const slug = String(req.params.slug || "").toLowerCase();
      if (!slug) return res.status(404).json({ message: "Community not found" });

      const community = await prisma.community.findFirst({ where: { slug } });
      if (!community) return res.status(404).json({ message: "Community not found" });

      const membershipRole = req.staff?.communityRoles?.get(String(community.id)) || null;
      const isGlobalStaff = Boolean(req.staff?.isGlobalStaff);

      if (!membershipRole && !isGlobalStaff) {
        return res.status(403).json({ message: "You do not moderate this community." });
      }

      if (membershipRole && !isGlobalStaff) {
        if ((COMMUNITY_ROLE_LEVEL[membershipRole] ?? 0) < required) {
          return res.status(403).json({ message: "This action requires community owner." });
        }
      }

      req.community = community;
      req.communityRole = membershipRole;
      req.isCommunityGlobalActor = isGlobalStaff && !membershipRole;
      next();
    } catch (err) {
      next(err);
    }
  };
}
