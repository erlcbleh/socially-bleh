import { prisma } from "../db/prisma.js";
import { deleteCloudinaryAsset } from "./cloudinary.js";

export async function deleteUserAccount(user) {
  const userId = user.id;

  const [posts, stories, participations, followingAccepted, followerAccepted, memberships] = await Promise.all([
    prisma.post.findMany({ where: { authorId: userId }, select: { mediaUrl: true } }),
    prisma.story.findMany({ where: { authorId: userId }, select: { mediaUrl: true } }),
    prisma.conversationParticipant.findMany({ where: { userId }, select: { conversationId: true } }),
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

  const conversationIds = [...new Set(participations.map((p) => p.conversationId))];

  const participantCounts = await prisma.conversationParticipant.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: conversationIds } },
    _count: { userId: true },
  });
  const soloConversationIds = participantCounts
    .filter((c) => c._count.userId <= 1)
    .map((c) => c.conversationId);

  await prisma.$transaction([
    ...followingAccepted.map((f) =>
      prisma.user.update({
        where: { id: f.followingId },
        data: { followersCount: { decrement: 1 } },
      })
    ),
    ...followerAccepted.map((f) =>
      prisma.user.update({
        where: { id: f.followerId },
        data: { followingCount: { decrement: 1 } },
      })
    ),
    ...memberships.map((m) =>
      prisma.community.update({
        where: { id: m.communityId },
        data: { memberCount: { decrement: 1 } },
      })
    ),
    prisma.conversation.deleteMany({ where: { id: { in: soloConversationIds } } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await Promise.all([
    ...posts.map((p) => deleteCloudinaryAsset(p.mediaUrl)),
    ...stories.map((s) => deleteCloudinaryAsset(s.mediaUrl)),
    deleteCloudinaryAsset(user.avatarUrl),
    deleteCloudinaryAsset(user.bannerUrl),
  ]);
}
