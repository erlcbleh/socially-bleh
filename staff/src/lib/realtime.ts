import { useCallback, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { invalidateQueries } from "@socially/shared/queryStore";
import { recordReportPulse } from "./reportPulse";
import type { PresenceSnapshot, SelectionFocus, StaffClaim } from "../types";

type ConnectionState = "offline" | "connecting" | "online";

interface ReportsChangedEvent {
  created?: string[];
  updated?: string[];
}

const EMPTY_PRESENCE: PresenceSnapshot = { staff: [], claims: [], at: 0 };

let socket: Socket | null = null;
let connection: ConnectionState = "offline";
let presence: PresenceSnapshot = EMPTY_PRESENCE;

const connectionListeners = new Set<() => void>();
const presenceListeners = new Set<() => void>();

function setConnection(next: ConnectionState) {
  if (connection === next) return;
  connection = next;
  connectionListeners.forEach((listener) => listener());
}

function setPresence(next: PresenceSnapshot) {
  presence = { staff: next?.staff ?? [], claims: next?.claims ?? [], at: next?.at ?? Date.now() };
  presenceListeners.forEach((listener) => listener());
}

function onReportsChanged(event: ReportsChangedEvent) {
  recordReportPulse({ created: event?.created ?? [], updated: event?.updated ?? [] });
  for (const id of event?.updated ?? []) {
    invalidateQueries({ queryKey: ["staff", "report", id] });
  }
}

function onQueueChanged() {
  invalidateQueries({ queryKey: ["staff", "queue-counts"] });
}

function onAuditAppended() {
  invalidateQueries({ queryKey: ["staff", "audit"] });
}

function onSecurityFlagged() {
  invalidateQueries({ queryKey: ["staff", "security"] });
}

const RESOURCE_QUERY_KEYS: Record<string, string[][]> = {
  ipBans: [["staff", "banned-ips"]],
  verification: [["staff", "verification"]],
  copyright: [["staff", "copyright"]],
  staffApplications: [["staff", "applications"]],
  staffRoles: [["staff", "members"]],
  staffSessions: [["staff", "sessions"]],
  layoutPresets: [],
};

function onResourceChanged(event: { resource?: string }) {
  const keys = RESOURCE_QUERY_KEYS[event?.resource ?? ""];
  if (!keys) return;

  for (const queryKey of keys) invalidateQueries({ queryKey });

  if (event.resource === "layoutPresets") notifyLayoutPresets();
}

const layoutPresetListeners = new Set<() => void>();

function notifyLayoutPresets() {
  layoutPresetListeners.forEach((listener) => listener());
}

export function onLayoutPresetsChanged(listener: () => void): () => void {
  layoutPresetListeners.add(listener);
  return () => {
    layoutPresetListeners.delete(listener);
  };
}

export function connectStaffRealtime() {
  if (socket) return;

  setConnection("connecting");
  socket = io({ withCredentials: true });

  socket.on("connect", () => {
    setConnection("online");
    socket?.emit("staff:presence:sync", null, (snapshot: PresenceSnapshot) => setPresence(snapshot));
  });
  socket.on("disconnect", () => setConnection("offline"));
  socket.on("connect_error", () => setConnection("offline"));

  socket.on("staff:reports:changed", onReportsChanged);
  socket.on("staff:queue:changed", onQueueChanged);
  socket.on("staff:audit:appended", onAuditAppended);
  socket.on("staff:security:flagged", onSecurityFlagged);
  socket.on("staff:resource:changed", onResourceChanged);
  socket.on("staff:presence", setPresence);
}

export function disconnectStaffRealtime() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  setConnection("offline");
  setPresence(EMPTY_PRESENCE);
}

export function publishFocus(focus: SelectionFocus | null) {
  socket?.emit("staff:focus", focus ?? { channel: null, id: null });
}

export function claimResource(resource: string): Promise<{ ok: boolean; claim?: StaffClaim }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false });
      return;
    }
    socket.emit("staff:claim", { resource }, (result: { ok: boolean; claim?: StaffClaim }) =>
      resolve(result ?? { ok: false })
    );
  });
}

export function releaseResource(resource: string) {
  socket?.emit("staff:release", { resource });
}

export function useStaffConnection(): ConnectionState {
  const subscribe = useCallback((listener: () => void) => {
    connectionListeners.add(listener);
    return () => {
      connectionListeners.delete(listener);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => connection,
    () => "offline" as ConnectionState
  );
}

export function useStaffPresence(): PresenceSnapshot {
  const subscribe = useCallback((listener: () => void) => {
    presenceListeners.add(listener);
    return () => {
      presenceListeners.delete(listener);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => presence,
    () => EMPTY_PRESENCE
  );
}

export function useResourceClaim(resource: string | null): StaffClaim | null {
  const snapshot = useStaffPresence();
  if (!resource) return null;
  return snapshot.claims.find((claim) => claim.resource === resource) ?? null;
}
