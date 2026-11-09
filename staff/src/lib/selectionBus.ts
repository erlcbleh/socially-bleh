import { useCallback, useSyncExternalStore } from "react";

export type SelectionChannel = "report" | "user" | "post" | "community" | "network" | "securityFlag";

type Selections = Record<SelectionChannel, string | null>;

const CHANNELS: SelectionChannel[] = ["report", "user", "post", "community", "network", "securityFlag"];

const state: Selections = {
  report: null,
  user: null,
  post: null,
  community: null,
  network: null,
  securityFlag: null,
};

const listeners: Record<SelectionChannel, Set<() => void>> = {
  report: new Set(),
  user: new Set(),
  post: new Set(),
  community: new Set(),
  network: new Set(),
  securityFlag: new Set(),
};

let urlTimer: ReturnType<typeof setTimeout> | null = null;

function syncUrl() {
  if (urlTimer) clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    urlTimer = null;
    const params = new URLSearchParams(window.location.search);
    const active = CHANNELS.filter((channel) => state[channel]).map((channel) => `${channel}:${state[channel]}`);
    if (active.length > 0) params.set("sel", active.join(","));
    else params.delete("sel");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, 250);
}

export function setSelection(channel: SelectionChannel, id: string | null) {
  if (state[channel] === id) return;
  state[channel] = id;
  listeners[channel].forEach((listener) => listener());
  syncUrl();
}

export function getSelection(channel: SelectionChannel): string | null {
  return state[channel];
}

export function clearSelections() {
  for (const channel of CHANNELS) setSelection(channel, null);
}

export function hydrateSelectionsFromUrl() {
  const raw = new URLSearchParams(window.location.search).get("sel");
  if (!raw) return;
  for (const pair of raw.split(",")) {
    const separator = pair.indexOf(":");
    if (separator < 0) continue;
    const channel = pair.slice(0, separator) as SelectionChannel;
    const id = pair.slice(separator + 1);
    if (CHANNELS.includes(channel) && id) setSelection(channel, id);
  }
}

export function useSelection(channel: SelectionChannel): string | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      listeners[channel].add(onStoreChange);
      return () => {
        listeners[channel].delete(onStoreChange);
      };
    },
    [channel]
  );

  const getSnapshot = useCallback(() => state[channel], [channel]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePinnedSelection(channel: SelectionChannel, pinnedId?: string | null): string | null {
  const live = useSelection(channel);
  return pinnedId ?? live;
}
