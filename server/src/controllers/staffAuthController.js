import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { getDiscordAuthorizeUrl, exchangeDiscordCode } from "../services/discordOAuth.js";
import {
  createStaffSession,
  staffCookieOptions,
  revokeStaffSession,
  getStaffContext,
  serializeStaffContext,
} from "../services/staffSession.js";
import { env } from "../config/env.js";
import { ipHandle } from "../lib/ipHash.js";
import { effectiveRole, hasPermission } from "../config/roles.js";

const STAFF_STATE_COOKIE = "staff_oauth_state";

const stateCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.cookieSecure,
  maxAge: 5 * 60 * 1000,
  path: "/",
};

const staffDisabled = (res) => res.status(503).json({ message: "The staff panel is not configured on this deployment." });

const loginError = (res, reason) =>
  env.staffUrl ? res.redirect(`${env.staffUrl}/login?error=${reason}`) : staffDisabled(res);

export function staffDiscordRedirect(req, res) {
  if (!env.staffEnabled) return staffDisabled(res);

  const state = `staff:${crypto.randomBytes(16).toString("hex")}`;
  res.cookie(STAFF_STATE_COOKIE, state, stateCookieOptions);
  res.redirect(getDiscordAuthorizeUrl(state, env.discord.staffRedirectUri));
}

async function resolveStaffAccount(discordId) {
  const accounts = await prisma.user.findMany({
    where: { discordId },
    orderBy: { createdAt: "asc" },
  });
  if (accounts.length === 0) return null;

  for (const account of accounts) {
    if (hasPermission(effectiveRole(account), "access_staff_panel")) return account;
  }

  for (const account of accounts) {
    const membership = await prisma.communityMembership.findFirst({
      where: { userId: account.id, status: "active", role: { in: ["owner", "staff"] } },
      select: { id: true },
    });
    if (membership) return account;
  }

  return null;
}

export async function staffDiscordCallback(req, res) {
  const { code, state } = req.query;

  if (!env.staffEnabled) return staffDisabled(res);

  if (
    !code ||
    typeof state !== "string" ||
    !state.startsWith("staff:") ||
    state !== req.cookies?.[STAFF_STATE_COOKIE]
  ) {
    return loginError(res, "oauth");
  }

  res.clearCookie(STAFF_STATE_COOKIE, { path: "/" });

  const discordProfile = await exchangeDiscordCode(code, env.discord.staffRedirectUri);
  const user = await resolveStaffAccount(discordProfile.discordId);

  if (!user) return loginError(res, "not_staff");
  if (user.status !== "active") return loginError(res, "account_inactive");

  const { token } = await createStaffSession(user, { ip: req.ip, userAgent: req.get("user-agent") });
  res.cookie(env.staffCookieName, token, staffCookieOptions());
  res.redirect(env.staffUrl);
}

export async function staffMe(req, res) {
  const user = req.staffUser;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: effectiveRole(user),
    },
    staff: serializeStaffContext(req.staff),
  });
}

export async function staffLogout(req, res) {
  if (req.staffSessionId) await revokeStaffSession(req.staffSessionId, req.staffUser?.id || null);
  res.clearCookie(env.staffCookieName, { path: "/" });
  res.json({ ok: true });
}

export async function listOwnStaffSessions(req, res) {
  const sessions = await prisma.staffSession.findMany({
    where: { userId: req.staffUser.id, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });

  res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      current: session.jti === req.staffSessionId,
      network: ipHandle(session.ipHash),
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    })),
  });
}

export async function refreshStaffContext(req, res) {
  const staff = await getStaffContext(req.staffUser);
  res.json({ staff: serializeStaffContext(staff) });
}
