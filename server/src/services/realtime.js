import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "../db/redis.js";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { verifyToken } from "./jwt.js";
import { cookieValue } from "./cookies.js";
import { verifyGateCookie, GATE_COOKIE_NAME } from "./siteGate.js";
import { verifyStaffToken, isStaffSessionRevoked, getStaffContext } from "./staffSession.js";
import {
  registerStaffIo,
  staffCommunityRoom,
  staffUserRoom,
  STAFF_ROOM,
  STAFF_ADMIN_ROOM,
} from "./staffEvents.js";
import {
  addPresence,
  removePresence,
  setFocus,
  claimResource,
  releaseResource,
  presenceSnapshot,
} from "./staffPresence.js";

export const REALTIME_EVENTS = Object.freeze({
  messagesChanged: "messages:changed",
  notificationsChanged: "notifications:changed",
  typing: "messages:typing",
  postsChanged: "posts:changed",
  storiesChanged: "stories:changed",
  socialChanged: "social:changed",
});

let io = null;

function userRoom(userId) {
  return `user:${String(userId)}`;
}

function communityRoom(slug) {
  return `community:${String(slug).toLowerCase()}`;
}

function hostOf(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

function isStaffHost(socket) {
  if (!env.staffEnabled) return false;

  const staffHost = hostOf(env.staffUrl);
  if (!staffHost) return false;

  const origin = socket.handshake.headers.origin;
  const candidate = origin ? hostOf(origin) : String(socket.handshake.headers.host || "").toLowerCase();
  return candidate === staffHost;
}

async function authenticateSocket(socket) {
  const token = cookieValue(socket.request.headers.cookie, env.cookieName);
  if (!token) throw new Error("Not authenticated");

  const payload = verifyToken(token);
  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
    throw new Error("Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, tokenVersion: true, status: true },
  });
  if (
    !user ||
    (user.status && user.status !== "active") ||
    (payload.v ?? 0) !== (user.tokenVersion ?? 0)
  ) {
    throw new Error("Not authenticated");
  }

  return user.id;
}

async function authenticateStaffSocket(socket) {
  const token = cookieValue(socket.request.headers.cookie, env.staffCookieName);
  if (!token) throw new Error("Not authenticated");

  const payload = verifyStaffToken(token);
  if (isStaffSessionRevoked(payload.jti)) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      status: true,
      staffSessionVersion: true,
    },
  });
  if (!user || user.status !== "active" || (payload.v ?? 0) !== (user.staffSessionVersion ?? 0)) {
    throw new Error("Not authenticated");
  }

  const staff = await getStaffContext(user);
  if (!staff.isGlobalStaff && staff.communityRoles.size === 0) throw new Error("Not authenticated");

  return { user, staff, jti: payload.jti };
}

function attachStaffSocket(socket) {
  const { user, staff } = socket.data;

  socket.join(staffUserRoom(user.id));
  if (staff.isGlobalStaff) socket.join(STAFF_ROOM);
  if (staff.isAdmin) socket.join(STAFF_ADMIN_ROOM);
  for (const communityId of staff.communityRoles.keys()) socket.join(staffCommunityRoom(communityId));

  if (staff.isGlobalStaff) {
    addPresence(socket.id, user);
    socket.emit("staff:presence", presenceSnapshot());
  }

  socket.on("staff:focus", (payload) => setFocus(socket.id, payload));

  socket.on("staff:claim", (payload, ack) => {
    const result = claimResource(socket.id, payload?.resource);
    if (typeof ack === "function") ack(result || { ok: false });
  });

  socket.on("staff:release", (payload, ack) => {
    const released = releaseResource(socket.id, payload?.resource);
    if (typeof ack === "function") ack({ ok: released });
  });

  socket.on("staff:presence:sync", (_payload, ack) => {
    if (typeof ack === "function") ack(presenceSnapshot());
  });

  socket.on("disconnect", () => removePresence(socket.id));
}

async function resolveCommunityMembership(userId, slug) {
  const normalized = String(slug || "").toLowerCase();
  if (!normalized) return null;

  const community = await prisma.community.findFirst({
    where: { OR: [{ slug: normalized }, { previousSlugs: { has: normalized } }] },
    select: { id: true, slug: true },
  });
  if (!community) return null;

  const membership = await prisma.communityMembership.findFirst({
    where: {
      communityId: community.id,
      userId,
      status: { in: ["active", "banned"] },
    },
    select: { id: true },
  });
  if (!membership) return null;

  return community.slug;
}

export function attachRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.allowedOrigins, credentials: true },
  });

  if (redis) {
    try {
      const pubClient = redis;
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("Socket.io-Redis success");
    } catch (err) {
      console.warn("Socket.io-Redis err:", err?.message || err);
    }
  }

  registerStaffIo(io);

  io.use(async (socket, next) => {
    try {
      if (
        env.siteGate.enabled &&
        !verifyGateCookie(cookieValue(socket.request.headers.cookie, GATE_COOKIE_NAME))
      ) {
        next(new Error("Site locked"));
        return;
      }

      if (isStaffHost(socket)) {
        const { user, staff } = await authenticateStaffSocket(socket);
        socket.data.scope = "staff";
        socket.data.userId = user.id;
        socket.data.user = user;
        socket.data.staff = staff;
        next();
        return;
      }

      socket.data.scope = "user";
      socket.data.userId = await authenticateSocket(socket);
      socket.data.communitySlug = null;
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.scope === "staff") {
      attachStaffSocket(socket);
      return;
    }

    socket.join(userRoom(socket.data.userId));

    socket.on("community:subscribe", async (payload, ack) => {
      try {
        const slug = await resolveCommunityMembership(socket.data.userId, payload?.slug);
        if (!slug) {
          if (typeof ack === "function") ack({ ok: false });
          return;
        }

        if (socket.data.communitySlug && socket.data.communitySlug !== slug) {
          socket.leave(communityRoom(socket.data.communitySlug));
        }
        socket.data.communitySlug = slug;
        socket.join(communityRoom(slug));
        if (typeof ack === "function") ack({ ok: true, slug });
      } catch {
        if (typeof ack === "function") ack({ ok: false });
      }
    });

    socket.on("community:unsubscribe", () => {
      if (!socket.data.communitySlug) return;
      socket.leave(communityRoom(socket.data.communitySlug));
      socket.data.communitySlug = null;
    });
  });

  return io;
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;

  const recipients = userIds
    .map((userId) => userId?.id || userId?._id || userId)
    .filter(Boolean)
    .map(String);
  const rooms = [...new Set(recipients)].map(userRoom);
  if (rooms.length) io.to(rooms).emit(event, payload);
}

export function emitToCommunity(slug, event, payload) {
  if (!io || !slug) return;
  io.to(communityRoom(slug)).emit(event, payload);
}

export function disconnectUser(userId) {
  if (io && userId) io.in(userRoom(userId)).disconnectSockets(true);
}

export function disconnectStaffUser(userId) {
  if (io && userId) io.in(staffUserRoom(userId)).disconnectSockets(true);
}
