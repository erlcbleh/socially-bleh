import { prisma } from "../db/prisma.js";

function lift(user) {
  prisma.user
    .update({
      where: { id: user.id },
      data: { status: "active", suspendedUntil: null, suspendReason: null },
    })
    .catch(() => {});
  prisma.suspension
    .updateMany({
      where: { userId: user.id, active: true },
      data: { active: false, liftedAt: new Date() },
    })
    .catch(() => {});
  user.status = "active";
  user.suspendedUntil = null;
  user.suspendReason = null;
}

export function requireActiveAccount(req, res, next) {
  const user = req.user;

  const blocked = (code, message) =>
    res.status(403).json({
      code,
      message,
      suspendReason: user.suspendReason || null,
      suspendedUntil: user.suspendedUntil || null,
    });

  if (user.status === "banned") {
    if (!user.suspendedUntil) {
      return blocked("account_banned", "This account has been permanently banned.");
    }
    if (user.suspendedUntil > new Date()) {
      return blocked("account_banned", `This account is banned until ${user.suspendedUntil.toISOString()}.`);
    }
    lift(user);
  }

  if (user.status === "suspended") {
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      return blocked("account_suspended", `This account is suspended until ${user.suspendedUntil.toISOString()}.`);
    }
    if (user.suspendedUntil && user.suspendedUntil <= new Date()) lift(user);
  }

  if (user.status === "deactivated") {
    return blocked("account_deactivated", "This account has been deactivated.");
  }

  next();
}
