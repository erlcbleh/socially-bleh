import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { getDiscordAuthorizeUrl, exchangeDiscordCode } from "../services/discordOAuth.js";
import { signToken } from "../services/jwt.js";
import { hydrateUser } from "../services/hydrate.js";
import { env } from "../config/env.js";
import { APPLICATION_IDENTITY_COOKIE, signApplicationIdentityToken } from "../services/applicationIdentity.js";
import { ensureGlobalMembership } from "../services/globalCommunity.js";
import { recordUserIp } from "../services/userIpTracking.js";
import { screenIp } from "../services/proxyCheck.js";

async function staffDeactivated(userId) {
  const row = await prisma.suspension.findFirst({
    where: { userId, kind: "deactivate", active: true },
    select: { id: true },
  });
  return !!row;
}

async function syncOAuthAvatar(user, avatarUrl) {
  if (!avatarUrl || avatarUrl === user.avatarUrl) return false;
  if (user.accountKind === "business" || user.accountKind === "professional") return false;
  const isProfessional = await prisma.communityMembership.findFirst({
    where: { userId: user.id, professionalStatus: "approved" },
    select: { id: true },
  });
  if (isProfessional) return false;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  user.avatarUrl = avatarUrl;
  return true;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: env.cookieSecure,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

const oauthCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.cookieSecure,
  maxAge: 5 * 60 * 1000,
  path: "/",
};

function accountLabelKind(kind) {
  if (kind === "professional") return "professional";
  if (kind === "business") return "business";
  return "personal";
}

async function loadSessionActor(req) {
  const actorId = req.actorId || req.user.id;
  if (actorId === req.user.id) return req.user;
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  return actor || req.user;
}

function serializeLinkedAccount(a) {
  return {
    id: a.id,
    username: a.username,
    displayName: a.displayName || a.username || a.discordUsername,
    avatarUrl: a.avatarUrl,
    accountKind: accountLabelKind(a.accountKind),
    onboardingComplete: a.onboardingComplete,
    professionalCommunity: a.professionalCommunity
      ? { name: a.professionalCommunity.name, slug: a.professionalCommunity.slug }
      : null,
  };
}

export function discordRedirect(req, res) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = req.query.resync === "1" ? `resync:${nonce}` : nonce;
  res.cookie("oauth_state", state, oauthCookieOptions);
  res.redirect(getDiscordAuthorizeUrl(state));
}

export async function verifyNetwork(req, res) {
  const proxy = await screenIp(req.ip);
  res.json({ allowed: !proxy.flagged });
}

export async function discordCallback(req, res) {
  try {
    const { code, state } = req.query;

    if (typeof state === "string" && state.startsWith("staff:")) {
      return res.redirect(env.staffUrl ? `${env.staffUrl}/login?error=wrong_host` : `${env.clientUrl}/login?error=oauth`);
    }

    const isApplicationFlow = typeof state === "string" && state.startsWith("app:");
    const isResyncFlow = typeof state === "string" && state.startsWith("resync:");
    const stateCookieName = isApplicationFlow ? "app_oauth_state" : "oauth_state";

    if (!code || !state) {
      console.warn("Discord OAuth missing code or state", { hasCode: !!code, hasState: !!state });
      return res.redirect(isApplicationFlow ? `${env.clientUrl}/applications?discord_error=1` : `${env.clientUrl}/login?error=oauth`);
    }

    const expectedState = req.cookies?.[stateCookieName];
    if (!expectedState || state !== expectedState) {
      console.warn("Discord OAuth state mismatch", {
        state,
        expectedState,
        cookieNames: Object.keys(req.cookies || {}),
      });
      return res.redirect(isApplicationFlow ? `${env.clientUrl}/applications?discord_error=1` : `${env.clientUrl}/login?error=oauth`);
    }

    let discordProfile;
    try {
      discordProfile = await exchangeDiscordCode(code);
    } catch (err) {
      console.error("Discord OAuth token exchange failed:", err?.response?.data || err);
      return res.redirect(`${env.clientUrl}/login?error=oauth`);
    }
    res.clearCookie(stateCookieName, { path: "/" });

    if (isResyncFlow) {
      const current = req.user;
      if (!current) return res.redirect(`${env.clientUrl}/login`);
      if (current.discordId !== discordProfile.discordId) {
        return res.redirect(`${env.clientUrl}/settings?avatar=mismatch`);
      }

      const changed = await syncOAuthAvatar(current, discordProfile.avatarUrl);
      return res.redirect(`${env.clientUrl}/settings?avatar=${changed ? "updated" : "unchanged"}`);
    }

    if (isApplicationFlow) {
      const position = req.cookies?.app_oauth_position || "";
      res.clearCookie("app_oauth_position", { path: "/" });
      res.cookie(
        APPLICATION_IDENTITY_COOKIE,
        signApplicationIdentityToken(discordProfile.discordId, discordProfile.discordUsername),
        { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, maxAge: 30 * 60 * 1000, path: "/" }
      );
      const query = position ? `?discord_connected=1&position=${encodeURIComponent(position)}` : "?discord_connected=1";
      return res.redirect(`${env.clientUrl}/applications${query}`);
    }

    const proxy = await screenIp(req.ip);
    if (proxy.flagged) {
      return res.redirect(`${env.clientUrl}/login?error=anti_abuse`);
    }

    const existingAccounts = await prisma.user.findMany({
      where: { discordId: discordProfile.discordId },
      orderBy: { createdAt: "asc" },
    });
    let user =
      existingAccounts.find((a) => a.accountKind === "personal" || !a.accountKind) ||
      existingAccounts.find((a) => a.accountKind !== "professional" && a.accountKind !== "business") ||
      existingAccounts[0];

    const bannedDiscord = await prisma.bannedDiscordId.findUnique({
      where: { discordId: discordProfile.discordId },
      select: { id: true },
    });
    if (bannedDiscord) {
      return res.redirect(`${env.clientUrl}/login?error=account_banned`);
    }

    if (!user) {
      const totalUsers = await prisma.user.count({
        where: { accountKind: { notIn: ["professional", "business"] } },
      });
      const badges = totalUsers < 300 ? ["early_supporter"] : [];
      user = await prisma.user.create({
        data: {
          id: newId(),
          discordId: discordProfile.discordId,
          discordUsername: discordProfile.discordUsername,
          avatarUrl: discordProfile.avatarUrl,
          displayName: discordProfile.discordDisplayName,
          badges,
        },
      });
    } else {
      const data = {};
      if (user.status === "deactivated" && !(await staffDeactivated(user.id))) {
        data.status = "active";
      }
      await syncOAuthAvatar(user, discordProfile.avatarUrl);
      if (Object.keys(data).length) {
        user = await prisma.user.update({ where: { id: user.id }, data });
      }
    }

    await ensureGlobalMembership(user.id).catch((err) =>
      console.error("Failed to ensure global membership for user", user.id, err)
    );

    await recordUserIp(user.id, req.ip).catch(() => {});

    const token = signToken(user.id, user.tokenVersion);
    res.cookie(env.cookieName, token, cookieOptions);
    return res.redirect(user.onboardingComplete ? env.clientUrl : `${env.clientUrl}/onboarding`);
  } catch (outerErr) {
    console.error("Unhandled exception during discordCallback:", outerErr);
    return res.redirect(`${env.clientUrl}/login?error=oauth`);
  }
}

export async function me(req, res) {
  if (!req.user) return res.json({ user: null });
  const dto = await hydrateUser(req.user, req.user.id);
  if (dto && req.user.status === "deactivated") {
    dto.deactivatedByStaff = await staffDeactivated(req.user.id);
  }
  if (dto && req.user.accountKind === "business") {
    dto.isBusinessOwner = (req.actorId || req.user.id) === req.user.businessOwnerId;
  }
  res.json({ user: dto });
}

export function logout(req, res) {
  res.clearCookie(env.cookieName, { path: "/" });
  res.json({ ok: true });
}

async function isBannedProfessional(account) {
  if (account.accountKind !== "professional" || !account.professionalCommunityId) return false;
  const membership = await prisma.communityMembership.findUnique({
    where: {
      communityId_userId: {
        communityId: account.professionalCommunityId,
        userId: account.id,
      },
    },
  });
  return membership?.status === "banned";
}

export async function listAccounts(req, res) {
  const actor = await loadSessionActor(req);

  const sameDiscord = await prisma.user.findMany({
    where: {
      discordId: actor.discordId,
      accountKind: { not: "business" },
    },
    orderBy: { createdAt: "asc" },
    include: { professionalCommunity: true },
  });

  const ownedBusinesses = await prisma.user.findMany({
    where: { accountKind: "business", businessOwnerId: actor.id },
    orderBy: { createdAt: "asc" },
    include: { professionalCommunity: true },
  });

  const collabRows = await prisma.businessCollaborator.findMany({
    where: { userId: actor.id },
    include: { businessUser: { include: { professionalCommunity: true } } },
  });

  const byId = new Map();
  for (const a of sameDiscord) byId.set(a.id, a);
  for (const a of ownedBusinesses) byId.set(a.id, a);
  for (const row of collabRows) {
    if (row.businessUser) byId.set(row.businessUser.id, row.businessUser);
  }

  const accounts = [...byId.values()];
  const bannedFlags = await Promise.all(accounts.map(isBannedProfessional));

  res.json({
    accounts: accounts.filter((_, i) => !bannedFlags[i]).map(serializeLinkedAccount),
  });
}

export async function switchAccount(req, res) {
  const actor = await loadSessionActor(req);
  const target = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { professionalCommunity: true },
  });
  if (!target) return res.status(403).json({ message: "Forbidden" });

  let allowed = false;
  if (target.accountKind === "business") {
    if (target.businessOwnerId === actor.id) {
      allowed = true;
    } else {
      const collab = await prisma.businessCollaborator.findUnique({
        where: {
          businessUserId_userId: { businessUserId: target.id, userId: actor.id },
        },
        select: { id: true },
      });
      allowed = !!collab;
    }
  } else {
    allowed = target.discordId === actor.discordId;
  }

  if (!allowed) return res.status(403).json({ message: "Forbidden" });

  if (await isBannedProfessional(target)) {
    return res.status(403).json({ message: "This professional account has been banned from its community." });
  }

  const token = signToken(target.id, target.tokenVersion, { actorId: actor.id });
  res.cookie(env.cookieName, token, cookieOptions);
  const dto = await hydrateUser(target, target.id);
  if (dto && target.accountKind === "business") {
    dto.isBusinessOwner = actor.id === target.businessOwnerId;
  }
  res.json({ user: dto });
}

export async function switchToPersonal(req, res) {
  const actor = await loadSessionActor(req);
  let personal =
    actor.accountKind === "personal" || !actor.accountKind
      ? actor
      : await prisma.user.findFirst({
          where: { discordId: actor.discordId, accountKind: "personal" },
          orderBy: { createdAt: "asc" },
        });

  if (!personal) {
    personal = await prisma.user.findFirst({
      where: {
        discordId: actor.discordId,
        accountKind: { notIn: ["professional", "business"] },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!personal) return res.status(404).json({ message: "No personal account found" });

  const token = signToken(personal.id, personal.tokenVersion);
  res.cookie(env.cookieName, token, cookieOptions);
  res.json({ user: await hydrateUser(personal, personal.id) });
}
