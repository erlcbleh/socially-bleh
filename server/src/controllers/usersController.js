import { prisma } from "../db/prisma.js";
import { hydrateUser } from "../services/hydrate.js";
import { env } from "../config/env.js";
import { deleteCloudinaryAsset } from "../services/cloudinary.js";
import { isOwnMediaUrl } from "../services/r2.js";
import { deleteUserAccount } from "../services/deleteAccount.js";
import { guardText } from "../services/textGuard.js";
import { disconnectUser } from "../services/realtime.js";
import {
  USERNAME_RE,
  MAX_PREVIOUS_USERNAMES,
  isReserved,
  normalizeUsername,
  usernameChangeAvailableAt,
  isUsernameTaken,
  isBlockedUsername,
  USERNAME_BLOCKED_MESSAGE,
} from "../services/username.js";

export async function updateAccount(req, res) {
  const { displayName, bio, avatarUrl, bannerUrl, equippedBadges } = req.body;
  const user = req.user;

  const previousAvatarUrl = user.avatarUrl;
  const previousBannerUrl = user.bannerUrl;

  const nextDisplayName = displayName !== undefined ? String(displayName).slice(0, 50) : null;
  const nextBio = bio !== undefined ? String(bio).slice(0, 200) : null;
  const changed = [
    nextDisplayName !== null && nextDisplayName !== user.displayName ? { text: nextDisplayName, label: "display name" } : null,
    nextBio !== null && nextBio !== user.bio ? { text: nextBio, label: "bio" } : null,
  ].filter(Boolean);

  for (const field of changed) {
    const guard = await guardText(field.text, {
      authorId: user.id,
      snapshotLabel: field.label,
      failClosed: false,
    });
    if (guard.blocked) {
      return res.status(400).json({ code: "content_blocked", message: guard.message });
    }
  }

  const data = {};
  if (nextDisplayName !== null) data.displayName = nextDisplayName;
  if (nextBio !== null) data.bio = nextBio;

  if (bannerUrl !== undefined) {
    const value = String(bannerUrl).slice(0, 500);
    if (value !== user.bannerUrl) {
      if (value && !isOwnMediaUrl(value)) {
        return res.status(400).json({ message: "Invalid banner URL" });
      }
      data.bannerUrl = value;
    }
  }

  if (avatarUrl !== undefined) {
    const value = String(avatarUrl).slice(0, 500);
    if (value !== user.avatarUrl) {
      if (user.accountKind !== "business") {
        return res.status(403).json({ message: "Only business accounts can change their profile picture." });
      }
      if (value && !isOwnMediaUrl(value)) {
        return res.status(400).json({ message: "Invalid avatar URL" });
      }
      data.avatarUrl = value;
    }
  }

  if (Array.isArray(equippedBadges)) {
    data.equippedBadges = equippedBadges
      .slice(0, 3)
      .map((b) => String(b));
  }

  const updated = Object.keys(data).length
    ? await prisma.user.update({ where: { id: user.id }, data })
    : user;

  if (previousBannerUrl && previousBannerUrl !== updated.bannerUrl) {
    await deleteCloudinaryAsset(previousBannerUrl);
  }
  if (previousAvatarUrl && previousAvatarUrl !== updated.avatarUrl) {
    await deleteCloudinaryAsset(previousAvatarUrl);
  }

  res.json({ user: await hydrateUser(updated, user.id) });
}

export async function changeUsername(req, res) {
  const user = req.user;
  const next = normalizeUsername(req.body.username);

  if (!USERNAME_RE.test(next)) {
    return res.status(400).json({
      message: "Usernames are 3-20 characters, letters, numbers and underscores, and can't start or end with an underscore.",
    });
  }
  if (isReserved(next)) {
    return res.status(400).json({ message: "That username is reserved." });
  }
  if (isBlockedUsername(next)) {
    return res.status(400).json({ message: USERNAME_BLOCKED_MESSAGE });
  }
  if (next === user.username) {
    return res.status(400).json({ message: "That's already your username." });
  }

  const availableAt = usernameChangeAvailableAt(user);
  if (availableAt) {
    return res.status(429).json({
      code: "username_cooldown",
      message: `You can change your username again on ${availableAt.toLocaleDateString("en-US", { dateStyle: "long" })}.`,
      availableAt,
    });
  }

  const guard = await guardText(next, { authorId: user.id, snapshotLabel: "username", failClosed: false });
  if (guard.blocked) {
    return res.status(400).json({ code: "content_blocked", message: guard.message });
  }

  if (await isUsernameTaken(next, user.id)) {
    return res.status(409).json({ message: "That username is taken." });
  }

  const previous = user.username;
  const now = new Date();
  const previousUsernames = previous
    ? [{ username: previous, changedAt: now }, ...(Array.isArray(user.previousUsernames) ? user.previousUsernames : [])].slice(
        0,
        MAX_PREVIOUS_USERNAMES
      )
    : user.previousUsernames;

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { username: next, usernameChangedAt: now, previousUsernames },
    });
    res.json({ user: await hydrateUser(updated, user.id) });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "That username was just taken. Try another." });
    }
    throw err;
  }
}

export async function updatePrivacy(req, res) {
  const { isPrivate, hideFollowing, hideProfileMedia, restrictMessages } = req.body;
  const data = {};

  if (isPrivate !== undefined) data.isPrivate = !!isPrivate;
  if (hideFollowing !== undefined) data.hideFollowing = !!hideFollowing;
  if (hideProfileMedia !== undefined) data.hideProfileMedia = !!hideProfileMedia;
  if (restrictMessages !== undefined) data.restrictMessages = !!restrictMessages;

  const updated = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: await hydrateUser(updated, req.user.id) });
}

export async function deactivateAccount(req, res) {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { status: "deactivated", tokenVersion: { increment: 1 } },
  });
  disconnectUser(req.user.id);
  res.clearCookie(env.cookieName, { path: "/" });
  res.json({ ok: true });
}

import { fetchDiscordUserAvatar } from "../services/discordOAuth.js";

function withCacheBuster(url) {
  if (!url) return url;
  const baseUrl = url.split("?")[0];
  return `${baseUrl}?v=${Date.now()}`;
}

export async function syncDiscordAvatar(req, res) {
  const user = req.user;
  if (!user.discordId) {
    return res.status(400).json({ message: "No Discord account linked to this user." });
  }

  const newAvatarUrl = await fetchDiscordUserAvatar(user.discordId);
  if (!newAvatarUrl) {
    return res.status(400).json({
      code: "oauth_required",
      message: "Discord Bot Token not set or fetch failed. Redirecting to Discord...",
    });
  }

  const bustedAvatarUrl = withCacheBuster(newAvatarUrl);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: bustedAvatarUrl },
  });

  const hydrated = await hydrateUser(updatedUser, user.id);
  res.json({
    user: hydrated,
    avatarUrl: bustedAvatarUrl,
    updated: true,
    message: "Profile picture synced with Discord!",
  });
}

export async function deleteAccount(req, res) {
  const { username } = req.body;
  if (username !== req.user.username) {
    return res.status(400).json({ message: "Username confirmation did not match." });
  }

  disconnectUser(req.user.id);
  await deleteUserAccount(req.user);
  res.clearCookie(env.cookieName, { path: "/" });
  res.json({ ok: true });
}
