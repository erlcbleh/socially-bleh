import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { deleteCloudinaryAsset } from "./cloudinary.js";
import { purgeAllContent } from "./purgeRecentContent.js";

export async function banAndDeleteAccount(
  user,
  { bannedBy, reason, banDiscord = true, keepProfileMedia = false } = {}
) {
  const userId = user.id;

  const purged = await purgeAllContent(userId);

  const [stories, followingAccepted, followerAccepted, memberships] = await Promise.all([
    prisma.story.findMany({ where: { authorId: userId }, select: { id: true, mediaUrl: true } }),
    prisma.follow.findMany({
      where: { followerId: userId, status: "accepted" },
      select: { followingId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId, status: "accepted" },
      select: { followerId: true },
    }),
    prisma.communityMembership.findMany({
      where: { userId, status: "active" },
      select: { communityId: true },
    }),
  ]);
  const storyIds = stories.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    await tx.story.deleteMany({ where: { authorId: userId } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.bookmark.deleteMany({ where: { userId } });
    await tx.pollVote.deleteMany({ where: { userId } });
    await tx.notInterested.deleteMany({ where: { userId } });
    await tx.storyView.deleteMany({
      where: { OR: [{ viewerId: userId }, { storyId: { in: storyIds } }] },
    });
    await tx.notification.deleteMany({
      where: { OR: [{ recipientId: userId }, { actorId: userId }] },
    });
    await tx.pendingUpload.deleteMany({ where: { userId } });
    await tx.verificationApplication.deleteMany({ where: { userId } });
    await tx.analyticsEvent.deleteMany({
      where: { OR: [{ targetUserId: userId }, { viewerId: userId }] },
    });
    await tx.mute.deleteMany({ where: { OR: [{ muterId: userId }, { mutedId: userId }] } });
    await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });

    for (const f of followingAccepted) {
      await tx.user.updateMany({
        where: { id: f.followingId },
        data: { followersCount: { decrement: 1 } },
      });
    }
    for (const f of followerAccepted) {
      await tx.user.updateMany({
        where: { id: f.followerId },
        data: { followingCount: { decrement: 1 } },
      });
    }
    for (const m of memberships) {
      await tx.community.update({
        where: { id: m.communityId },
        data: { memberCount: { decrement: 1 } },
      });
    }

    await tx.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    });
    await tx.communityMembership.deleteMany({ where: { userId } });

    if (banDiscord && user.discordId) {
      await tx.bannedDiscordId.upsert({
        where: { discordId: user.discordId },
        create: {
          id: newId(),
          discordId: user.discordId,
          reason: reason || "",
          bannedById: bannedBy ? String(bannedBy) : null,
        },
        update: {
          reason: reason || "",
          bannedById: bannedBy ? String(bannedBy) : null,
        },
      });
    }

    await tx.user.delete({ where: { id: userId } });
  });

  await Promise.all([
    ...stories.map((s) => deleteCloudinaryAsset(s.mediaUrl)),
    ...(keepProfileMedia
      ? []
      : [deleteCloudinaryAsset(user.avatarUrl), deleteCloudinaryAsset(user.bannerUrl)]),
  ]);

  return purged;
}
