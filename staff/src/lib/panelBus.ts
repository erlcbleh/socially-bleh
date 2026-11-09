import { useCallback, useSyncExternalStore } from "react";
import type { SerializedLayout } from "./layouts";

export type PanelRequest = {
  panelId: string;
  title?: string;
  params?: Record<string, unknown>;
  position?: { referencePanel?: string; direction?: "left" | "right" | "above" | "below" | "within" };
};

type Handler = (request: PanelRequest) => void;

export interface DockHost {
  open: Handler;
  focus: (panelId: string) => void;
  close: (panelId: string) => void;
  serialize: () => SerializedLayout | null;
  applyLayout: (layout: SerializedLayout) => boolean;
  applyPreset: (presetId: string) => void;
}

let host: DockHost | null = null;

const pending: PanelRequest[] = [];

let openPanelIds: string[] = [];
const openPanelListeners = new Set<() => void>();

export function setOpenPanelIds(ids: string[]) {
  const next = [...ids].sort();
  if (next.length === openPanelIds.length && next.every((id, i) => id === openPanelIds[i])) return;
  openPanelIds = next;
  openPanelListeners.forEach((listener) => listener());
}

export function registerPanelHost(handlers: DockHost) {
  host = handlers;
  while (pending.length > 0) {
    const request = pending.shift();
    if (request) host.open(request);
  }
  return () => {
    host = null;
    setOpenPanelIds([]);
  };
}

export function openPanel(request: PanelRequest) {
  if (!host) {
    pending.push(request);
    return;
  }
  host.open(request);
}

export function focusPanel(panelId: string) {
  host?.focus(panelId);
}

export function closePanel(panelId: string) {
  host?.close(panelId);
}

export function serializeLayout(): SerializedLayout | null {
  return host?.serialize() ?? null;
}

export function applyLayout(layout: SerializedLayout): boolean {
  return host?.applyLayout(layout) ?? false;
}

export function applyPreset(presetId: string) {
  host?.applyPreset(presetId);
}

export function useOpenPanelIds(): string[] {
  const subscribe = useCallback((listener: () => void) => {
    openPanelListeners.add(listener);
    return () => {
      openPanelListeners.delete(listener);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => openPanelIds,
    () => openPanelIds
  );
}
