import { useCallback, useMemo, useSyncExternalStore } from "react";
import { fetchLayouts, type SavedLayout } from "./layouts";

export const DEFAULT_LAYOUT_NAME = "Default";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface LayoutState {
  layouts: SavedLayout[];
  presets: SavedLayout[];
  activeName: string;
  status: SaveStatus;
  error: string | null;
  savedAt: number | null;
  prune: { name: string; removed: string[] } | null;
  loaded: boolean;
}

let state: LayoutState = {
  layouts: [],
  presets: [],
  activeName: DEFAULT_LAYOUT_NAME,
  status: "idle",
  error: null,
  savedAt: null,
  prune: null,
  loaded: false,
};

const listeners = new Set<() => void>();

function set(patch: Partial<LayoutState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function pickDefault(layouts: SavedLayout[]): SavedLayout | null {
  if (layouts.length === 0) return null;
  return layouts.find((layout) => layout.isDefault) ?? layouts[0];
}

async function load(): Promise<SavedLayout | null> {
  const data = await fetchLayouts();
  const chosen = pickDefault(data.layouts);
  set({
    layouts: data.layouts,
    presets: data.presets,
    loaded: true,
    activeName: chosen?.name ?? DEFAULT_LAYOUT_NAME,
  });
  return chosen;
}

async function refresh() {
  const data = await fetchLayouts();
  set({ layouts: data.layouts, presets: data.presets });
}

const actions = {
  load,
  refresh,
  setActiveName: (activeName: string) => set({ activeName }),
  noteSaving: () => set({ status: "saving" }),
  noteSaved: () => set({ status: "saved", error: null, savedAt: Date.now() }),
  noteError: (error: string) => set({ status: "error", error }),
  notePrune: (name: string, removed: string[]) => set({ prune: { name, removed } }),
  dismissPrune: () => set({ prune: null }),
};

export const layoutStoreActions = actions;

export type LayoutActions = typeof actions;

export function useLayoutStore(): LayoutState & LayoutActions {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );

  return useMemo(() => ({ ...snapshot, ...actions }), [snapshot]);
}
