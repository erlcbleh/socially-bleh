import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { hashIp } from "../lib/ipHash.js";
import { cacheGet, cacheSet } from "../db/redis.js";

const TOUCH_TTL_SECONDS = 60 * 60;

export async function recordUserIp(userId, ip) {
  const ipHash = hashIp(ip);
  if (!userId || !ipHash) return;

  const throttleKey = `userip:${userId}:${ipHash}`;
  if (await cacheGet(throttleKey)) return;
  cacheSet(throttleKey, 1, TOUCH_TTL_SECONDS).catch(() => {});

  try {
    await prisma.userIpAddress.upsert({
      where: { userId_ipHash: { userId, ipHash } },
      create: { id: newId(), userId, ipHash },
      update: { lastSeenAt: new Date() },
    });
  } catch {}
}
