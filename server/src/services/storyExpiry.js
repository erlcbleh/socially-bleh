import { prisma } from "../db/prisma.js";
import { deleteCloudinaryAsset } from "./cloudinary.js";

export async function sweepExpiredStories() {
  const stories = await prisma.story.findMany({
    where: { expiresAt: { lte: new Date() } },
    take: 100,
  });

  for (const story of stories) {
    await prisma.story.delete({ where: { id: story.id } });
    await deleteCloudinaryAsset(story.mediaUrl);
  }
}
