import { prisma } from "../db/prisma.js";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function sweepOldSecurityFlags() {
  const cutoff = new Date(Date.now() - RETENTION_MS);

  await prisma.securityFlag.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  await prisma.userIpAddress.deleteMany({
    where: { lastSeenAt: { lt: cutoff } },
  });
}

