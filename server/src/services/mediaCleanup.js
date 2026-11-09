import { prisma } from "../db/prisma.js";
import { deleteCloudinaryAsset } from "./cloudinary.js";

const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;

export async function sweepOrphanedUploads() {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);
  const pending = await prisma.pendingUpload.findMany({
    where: { createdAt: { lte: cutoff } },
    take: 100,
  });

  for (const upload of pending) {
    await deleteCloudinaryAsset(upload.url);
    await prisma.pendingUpload.delete({ where: { id: upload.id } });
  }
}
