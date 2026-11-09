import { prisma } from "../db/prisma.js";
import { hashIp } from "../lib/ipHash.js";
import { cacheGet, cacheSet } from "../db/redis.js";

const REFRESH_MS = 30 * 1000;
const REDIS_BAN_KEY = "banned_ips:set";

let cache = new Set();
let loadedAt = 0;
let loading = null;

async function load() {
  const now = new Date();
  const rows = await prisma.bannedIp.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { ipHash: true },
  });
  const hashes = rows.map((r) => r.ipHash);
  cache = new Set(hashes);
  cacheSet(REDIS_BAN_KEY, hashes, 60).catch(() => {});
  loadedAt = Date.now();
}

export async function refreshBannedIps() {
  loading = load().finally(() => {
    loading = null;
  });
  return loading;
}

export function isIpBanned(ip) {
  const hash = hashIp(ip);
  return Boolean(hash) && cache.has(hash);
}

export async function ipBanGuard(req, res, next) {
  try {
    if (Date.now() - loadedAt > REFRESH_MS && !loading) {
      const redisHashes = await cacheGet(REDIS_BAN_KEY);
      if (Array.isArray(redisHashes)) {
        cache = new Set(redisHashes);
        loadedAt = Date.now();
      } else {
        refreshBannedIps().catch((err) => console.error("Failed to refresh banned IPs", err));
      }
    }
    if (isIpBanned(req.ip)) {
      return res.status(403).json({ code: "ip_banned", message: "Access from this network has been blocked." });
    }
  } catch (err) {
    console.error("IP ban check failed", err);
  }
  next();
}
