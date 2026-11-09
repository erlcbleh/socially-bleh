import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { emitToUsers, REALTIME_EVENTS } from "./realtime.js";
import { sendPushToUser } from "./webpush.js";

const PUSH_COPY = {
  mention: (name) => `${name} mentioned you`,
  comment: (name) => `${name} replied to your post`,
  like: (name) => `${name} liked your post`,
  follow: (name) => `${name} followed you`,
  follow_request: (name) => `${name} requested to follow you`,
  follow_accept: (name) => `${name} accepted your follow request`,
  repost: (name) => `${name} reposted your post`,
  quote: (name) => `${name} quoted your post`,
  poll_ended: () => `Your poll has ended`,
};

const PUSH_TYPES = new Set(Object.keys(PUSH_COPY));

async function pushForNotification({ recipient, actor, type }) {
  try {
    const actorUser = await prisma.user.findUnique({
      where: { id: String(actor) },
      select: { username: true, displayName: true },
    });
    const name = actorUser?.displayName || (actorUser?.username ? `@${actorUser.username}` : "Someone");
    await sendPushToUser(recipient, {
      title: "Socially",
      body: PUSH_COPY[type](name),
      url: "/notifications",
      tag: `notif-${type}`,
    });
  } catch (err) {
    console.error("Push dispatch failed", err?.message);
  }
}

export async function notify({ recipient, actor, type, post = null, community = null, allowSelf = false }) {
  if (!allowSelf && String(recipient) === String(actor)) return null;
  const notification = await prisma.notification.create({
    data: {
      id: newId(),
      recipientId: String(recipient),
      actorId: String(actor),
      type,
      postId: post ? String(post) : null,
      communityId: community ? String(community) : null,
    },
  });
  emitToUsers([recipient], REALTIME_EVENTS.notificationsChanged, {
    communityId: community ? String(community) : null,
  });
  if (PUSH_TYPES.has(type)) {
    pushForNotification({ recipient, actor, type });
  }
  return notification;
}
