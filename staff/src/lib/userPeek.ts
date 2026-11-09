import { useCallback, useSyncExternalStore } from "react";

let peeked: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openUserPeek(username: string) {
  const next = String(username || "").replace(/^@/, "").trim();
  if (!next || next === peeked) {
    if (next) return;
  }
  peeked = next || null;
  emit();
}

export function closeUserPeek() {
  if (peeked === null) return;
  peeked = null;
  emit();
}

export function useUserPeek(): string | null {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => peeked,
    () => null
  );
}
