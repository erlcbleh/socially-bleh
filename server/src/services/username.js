import { prisma } from "../db/prisma.js";
import { hasUsernameAlias } from "./usernameAliases.js";

export const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_]{1,18}[a-zA-Z0-9]$/;

export const USERNAME_COOLDOWN_DAYS = 30;
export const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export const MAX_PREVIOUS_USERNAMES = 10;

export const RESERVED_USERNAMES = new Set([
  "c",
  "global",
  "explore",
  "notifications",
  "bookmarks",
  "messages",
  "analytics",
  "settings",
  "staff",
  "communities",
  "onboarding",
  "welcome",
  "login",
  "logout",
  "invite",
  "applications",
  "privacy",
  "terms",
  "copyright",
  "api",
  "admin",
  "about",
  "support",
  "help",
]);

export function isReserved(username) {
  return RESERVED_USERNAMES.has(username) || hasUsernameAlias(username);
}

export { USERNAME_ALIASES, resolveUsernameAlias, hasUsernameAlias } from "./usernameAliases.js";

export const USERNAME_BLOCKED_MESSAGE = "That username isn't allowed. Please choose something else.";

export { isBlockedUsername, findBlockedTerm } from "./usernameBlocklist.js";

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function usernameChangeAvailableAt(user) {
  if (!user.usernameChangedAt) return null;
  const readyAt = new Date(user.usernameChangedAt).getTime() + USERNAME_COOLDOWN_MS;
  return readyAt > Date.now() ? new Date(readyAt) : null;
}

export async function isUsernameTaken(username, selfId) {
  const owner = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (owner && !(selfId && owner.id === String(selfId))) return true;

  const cutoff = new Date(Date.now() - USERNAME_COOLDOWN_MS);
  const holders = await prisma.user.findMany({
    where: { previousUsernames: { not: [] } },
    select: { id: true, previousUsernames: true },
  });
  const recentHolder = holders.find((user) => {
    const history = Array.isArray(user.previousUsernames) ? user.previousUsernames : [];
    return history.some(
      (entry) => entry?.username === username && entry?.changedAt && new Date(entry.changedAt) > cutoff
    );
  });

  return !!recentHolder && !(selfId && recentHolder.id === String(selfId));
}
