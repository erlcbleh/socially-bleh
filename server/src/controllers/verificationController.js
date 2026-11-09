import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { emitQueueChanged } from "../services/staffEvents.js";

const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

async function getCooldownDaysLeft(userId) {
  const lastRejected = await prisma.verificationApplication.findFirst({
    where: { userId: String(userId), status: "rejected" },
    orderBy: { reviewedAt: "desc" },
  });
  if (!lastRejected?.reviewedAt) return 0;

  const remainingMs = COOLDOWN_MS - (Date.now() - lastRejected.reviewedAt.getTime());
  return remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
}

export async function apply(req, res) {
  const reason = String(req.body.reason || "").trim().slice(0, 1000);
  if (!reason) return res.status(400).json({ message: "Reason is required" });

  const existing = await prisma.verificationApplication.findFirst({
    where: { userId: req.user.id, status: "pending" },
  });
  if (existing) return res.status(409).json({ message: "You already have a pending application" });

  const daysLeft = await getCooldownDaysLeft(req.user.id);
  if (daysLeft > 0) {
    return res.status(429).json({ message: `You can apply again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.` });
  }

  const application = await prisma.verificationApplication.create({
    data: {
      id: newId(),
      userId: req.user.id,
      reason,
    },
  });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { verificationStatus: "pending" },
  });
  req.user = user;
  emitQueueChanged();

  res.status(201).json({
    application: {
      id: application.id,
      reason: application.reason,
      status: application.status,
      createdAt: application.createdAt,
    },
  });
}

export async function status(req, res) {
  const application = await prisma.verificationApplication.findFirst({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  const cooldownDaysLeft = await getCooldownDaysLeft(req.user.id);

  if (!application) return res.json({ application: null, cooldownDaysLeft });

  res.json({
    application: {
      id: application.id,
      reason: application.reason,
      status: application.status,
      createdAt: application.createdAt,
    },
    cooldownDaysLeft,
  });
}
