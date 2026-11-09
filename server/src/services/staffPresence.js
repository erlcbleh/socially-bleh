import { emitStaffPresence } from "./staffEvents.js";

const CLAIM_TTL_MS = 5 * 60 * 1000;
const BROADCAST_COALESCE_MS = 250;
const CLAIM_RESOURCE_RE = /^(report|user|post|community|network|securityFlag):[A-Za-z0-9_-]{1,64}$/;
const FOCUS_CHANNELS = new Set(["report", "user", "post", "community", "network", "securityFlag"]);

const presence = new Map();
const claims = new Map();

let broadcastTimer = null;

function sweepClaims() {
  const now = Date.now();
  let changed = false;
  for (const [resource, claim] of claims) {
    if (claim.expiresAt > now) continue;
    claims.delete(resource);
    changed = true;
  }
  return changed;
}

function roster() {
  const byUser = new Map();
  for (const entry of presence.values()) {
    const existing = byUser.get(entry.userId);
    if (existing) {
      existing.connections += 1;
      if (entry.focus) existing.focus = entry.focus;
      continue;
    }
    byUser.set(entry.userId, {
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      role: entry.role,
      connections: 1,
      focus: entry.focus,
      since: entry.since,
    });
  }
  return [...byUser.values()].sort((a, b) => a.username.localeCompare(b.username));
}

export function presenceSnapshot() {
  sweepClaims();
  return {
    staff: roster(),
    claims: [...claims.entries()].map(([resource, claim]) => ({
      resource,
      userId: claim.userId,
      username: claim.username,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
    })),
    at: Date.now(),
  };
}

function broadcast() {
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    emitStaffPresence(presenceSnapshot());
  }, BROADCAST_COALESCE_MS);
  if (typeof broadcastTimer.unref === "function") broadcastTimer.unref();
}

export function addPresence(socketId, user) {
  presence.set(socketId, {
    userId: String(user.id),
    username: user.username || "",
    displayName: user.displayName || user.username || "",
    avatarUrl: user.avatarUrl || "",
    role: user.role || "user",
    focus: null,
    since: Date.now(),
  });
  broadcast();
}

export function removePresence(socketId) {
  const existed = presence.delete(socketId);
  let changed = existed;

  for (const [resource, claim] of claims) {
    if (claim.socketId !== socketId) continue;
    claims.delete(resource);
    changed = true;
  }

  if (changed) broadcast();
}

export function setFocus(socketId, payload) {
  const entry = presence.get(socketId);
  if (!entry) return;

  const channel = payload?.channel;
  const id = payload?.id;
  const focus = FOCUS_CHANNELS.has(channel) && typeof id === "string" && id ? { channel, id } : null;

  const unchanged = focus?.channel === entry.focus?.channel && focus?.id === entry.focus?.id;
  entry.focus = focus;
  if (!unchanged) broadcast();
}

export function claimResource(socketId, resource) {
  const entry = presence.get(socketId);
  if (!entry || typeof resource !== "string" || !CLAIM_RESOURCE_RE.test(resource)) return null;

  sweepClaims();

  const existing = claims.get(resource);
  if (existing && existing.userId !== entry.userId) {
    return { ok: false, claim: { resource, userId: existing.userId, username: existing.username, claimedAt: existing.claimedAt, expiresAt: existing.expiresAt } };
  }

  const claim = {
    socketId,
    userId: entry.userId,
    username: entry.username,
    claimedAt: existing?.claimedAt ?? Date.now(),
    expiresAt: Date.now() + CLAIM_TTL_MS,
  };
  claims.set(resource, claim);
  broadcast();

  return { ok: true, claim: { resource, userId: claim.userId, username: claim.username, claimedAt: claim.claimedAt, expiresAt: claim.expiresAt } };
}

export function releaseResource(socketId, resource) {
  const entry = presence.get(socketId);
  const claim = typeof resource === "string" ? claims.get(resource) : null;
  if (!entry || !claim || claim.userId !== entry.userId) return false;

  claims.delete(resource);
  broadcast();
  return true;
}

export function resetStaffPresence() {
  presence.clear();
  claims.clear();
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = null;
}
