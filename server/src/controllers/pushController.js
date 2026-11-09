import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { env } from "../config/env.js";
import { pushConfigured } from "../services/webpush.js";

export async function getVapidKey(req, res) {
  res.json({ publicKey: env.webPush.publicKey, enabled: pushConfigured() });
}

export async function subscribe(req, res) {
  const userId = req.user.id;
  const { endpoint, keys } = req.body;
  const userAgent = (req.get("user-agent") || "").slice(0, 255) || null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { id: newId(), userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });

  res.json({ ok: true });
}

export async function unsubscribe(req, res) {
  const userId = req.user.id;
  const { endpoint } = req.body;
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  res.json({ ok: true });
}
