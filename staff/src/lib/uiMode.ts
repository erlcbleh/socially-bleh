import { useCallback, useSyncExternalStore } from "react";

export type UiMode = "simple" | "advanced";

const KEY = "socially-staff:ui-mode";

function read(): UiMode {
  try {
    return localStorage.getItem(KEY) === "advanced" ? "advanced" : "simple";
  } catch {
    return "simple";
  }
}

let mode: UiMode = read();
const listeners = new Set<() => void>();

export function setUiMode(next: UiMode) {
  if (mode === next) return;
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    void 0;
  }
  listeners.forEach((listener) => listener());
}

export function getUiMode(): UiMode {
  return mode;
}

export function useUiMode(): UiMode {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => mode,
    () => "simple" as UiMode
  );
}
