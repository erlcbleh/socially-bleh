import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { verifyToken } from "./jwt.js";
import { env } from "../config/env.js";
import { securityFlagged } from "./staffEvents.js";
import { hashIp } from "../lib/ipHash.js";

function resolveUserId(req) {
  if (req.user?.id) return req.user.id;
  try {
    const token = req.cookies?.[env.cookieName];
    if (!token) return null;
    return verifyToken(token).sub || null;
  } catch {
    return null;
  }
}

export async function logSecurityFlag(req, type, meta) {
  try {
    const flag = await prisma.securityFlag.create({
      data: {
        id: newId(),
        type,
        ipHash: hashIp(req.ip) || null,
        userAgent: req.get("user-agent")?.slice(0, 500) || null,
        method: req.method,
        path: (req.originalUrl || req.url || "").slice(0, 300),
        userId: resolveUserId(req),
        meta: meta ?? undefined,
      },
    });
    securityFlagged(flag);
  } catch (err) {
    console.error("Failed to log security flag", err);
  }
}
