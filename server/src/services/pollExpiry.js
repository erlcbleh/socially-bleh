import { prisma } from "../db/prisma.js";
import { notify } from "./notify.js";

export async function notifyExpiredPolls() {
  const posts = await prisma.post.findMany({
    where: {
      deleted: false,
      poll: { not: null },
    },
    take: 200,
  });

  const now = Date.now();
  for (const post of posts) {
    const poll = post.poll;
    if (!poll?.expiresAt || poll.expiryNotified) continue;
    if (new Date(poll.expiresAt).getTime() > now) continue;

    await notify({
      recipient: post.authorId,
      actor: post.authorId,
      type: "poll_ended",
      post: post.id,
      community: post.communityId,
      allowSelf: true,
    });
    await prisma.post.update({
      where: { id: post.id },
      data: { poll: { ...poll, expiryNotified: true } },
    });
  }
}
