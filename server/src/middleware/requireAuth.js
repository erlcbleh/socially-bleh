import { verifyToken } from "../services/jwt.js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { cacheGet, cacheSet } from "../db/redis.js";
import { recordUserIp } from "../services/userIpTracking.js";

const ACTIVITY_THROTTLE_MS = 60 * 1000;
const SESSION_CACHE_TTL = 300;

function touchActivity(user) {
  if (user.lastActiveAt && Date.now() - new Date(user.lastActiveAt).getTime() < ACTIVITY_THROTTLE_MS) return;
  prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
}

async function getCachedUser(userId) {
  const cacheKey = `user:session:${userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    if (cached.suspendedUntil && typeof cached.suspendedUntil === "string") {
      cached.suspendedUntil = new Date(cached.suspendedUntil);
    }
    if (cached.lastActiveAt && typeof cached.lastActiveAt === "string") {
      cached.lastActiveAt = new Date(cached.lastActiveAt);
    }
    return cached;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    cacheSet(cacheKey, user, SESSION_CACHE_TTL).catch(() => {});
  }
  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.cookieName];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const payload = verifyToken(token);
    const user = await getCachedUser(payload.sub);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if ((payload.v ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Session expired, please sign in again." });
    }

    req.user = user;
    req.actorId = typeof payload.actor === "string" ? payload.actor : user.id;
    touchActivity(user);
    recordUserIp(user.id, req.ip).catch(() => {});
    next();
  } catch {
    res.status(401).json({ message: "Not authenticated" });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.cookieName];
    if (!token) return next();

    const payload = verifyToken(token);
    const user = await getCachedUser(payload.sub);
    if (user && (payload.v ?? 0) === (user.tokenVersion ?? 0)) {
      req.user = user;
      req.actorId = typeof payload.actor === "string" ? payload.actor : user.id;
    }
    next();
  } catch {
    next();
  }
}
