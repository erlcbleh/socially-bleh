import webpush from "web-push";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

const configured = Boolean(env.webPush.publicKey && env.webPush.privateKey);

if (configured) {
  webpush.setVapidDetails(env.webPush.subject, env.webPush.publicKey, env.webPush.privateKey);
} else {
  console.warn("Web push disabled: VAPID keys not set");
}

export function pushConfigured() {
  return configured;
}

export async function sendPushToUser(userId, payload) {
  if (!configured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId: String(userId) } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(sub.id);
        } else {
          console.error("Web push send failed", err?.statusCode || err?.message);
        }
      }
    })
  );

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }
}
