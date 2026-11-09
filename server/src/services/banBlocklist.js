import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { refreshBannedIps } from "../middleware/ipBan.js";

const RECENT_IP_WINDOW_DAYS = 30;
const MAX_IPS_PER_ACCOUNT = 10;
const AUTO_PREFIX = "Automatic (ban evasion)";

const autoReason = (reason) =>
  reason ? `${AUTO_PREFIX}: ${String(reason).slice(0, 400)}` : AUTO_PREFIX;

const recentCutoff = () => new Date(Date.now() - RECENT_IP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

async function bannableIpHashes(userId) {
  const rows = await prisma.userIpAddress.findMany({
    where: { userId, lastSeenAt: { gte: recentCutoff() } },
    orderBy: { lastSeenAt: "desc" },
    take: MAX_IPS_PER_ACCOUNT,
    select: { ipHash: true },
  });

  const hashes = rows.map((row) => row.ipHash);
  if (!hashes.length) return { banned: [], shared: [] };

  const others = await prisma.userIpAddress.findMany({
    where: {
      ipHash: { in: hashes },
      userId: { not: userId },
      lastSeenAt: { gte: recentCutoff() },
      user: { status: { notIn: ["banned", "deactivated"] } },
    },
    select: { ipHash: true },
  });

  const shared = new Set(others.map((row) => row.ipHash));
  return {
    banned: hashes.filter((hash) => !shared.has(hash)),
    shared: [...shared],
  };
}

export async function applyBanBlocklist(user, { staffId, reason, expiresAt = null } = {}) {
  if (!user?.id) return { ipsBanned: 0, ipsSkipped: 0, discordBanned: false };

  const { banned, shared } = await bannableIpHashes(user.id);

  const text = autoReason(reason);
  const until = expiresAt ? new Date(expiresAt) : null;
  const temporary = !!until;

  for (const ipHash of banned) {
    const existing = await prisma.bannedIp.findUnique({
      where: { ipHash },
      select: { expiresAt: true },
    });

    if (!existing) {
      await prisma.bannedIp.create({
        data: { id: newId(), ipHash, reason: text, bannedById: staffId || null, expiresAt: until },
      });
      continue;
    }

    if (!temporary) {
      if (existing.expiresAt) await prisma.bannedIp.update({ where: { ipHash }, data: { expiresAt: null } });
    } else if (existing.expiresAt && existing.expiresAt < until) {
      await prisma.bannedIp.update({ where: { ipHash }, data: { expiresAt: until } });
    }
  }

  let discordBanned = false;
  if (user.discordId && !temporary) {
    await prisma.bannedDiscordId.upsert({
      where: { discordId: user.discordId },
      create: {
        id: newId(),
        discordId: user.discordId,
        reason: text,
        bannedById: staffId || null,
      },
      update: {},
    });
    discordBanned = true;
  }

  if (banned.length) {
    await refreshBannedIps().catch(() => {});
  }

  return { ipsBanned: banned.length, ipsSkipped: shared.length, discordBanned };
}

export async function liftBanBlocklist(user) {
  if (!user?.id) return { ipsLifted: 0, discordLifted: false };

  const rows = await prisma.userIpAddress.findMany({
    where: { userId: user.id },
    select: { ipHash: true },
  });
  const hashes = rows.map((row) => row.ipHash);

  const [{ count }, discord] = await Promise.all([
    hashes.length
      ? prisma.bannedIp.deleteMany({
          where: { ipHash: { in: hashes }, reason: { startsWith: AUTO_PREFIX } },
        })
      : Promise.resolve({ count: 0 }),
    user.discordId
      ? prisma.bannedDiscordId.deleteMany({
          where: { discordId: user.discordId, reason: { startsWith: AUTO_PREFIX } },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  if (count) await refreshBannedIps().catch(() => {});

  return { ipsLifted: count, discordLifted: discord.count > 0 };
}
