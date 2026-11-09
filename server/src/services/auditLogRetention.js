import { prisma } from "../db/prisma.js";

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export async function sweepOldAuditLogs() {
  await prisma.staffAuditLog.deleteMany({
    where: {
      communityId: null,
      important: false,
      createdAt: { lt: new Date(Date.now() - RETENTION_MS) },
    },
  });
}
