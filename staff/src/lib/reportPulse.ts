import { useCallback, useSyncExternalStore } from "react";

export interface ReportPulse {
  created: string[];
  updated: string[];
}

const EMPTY: ReportPulse = { created: [], updated: [] };
const MAX_TRACKED = 500;

let pulse: ReportPulse = EMPTY;
const listeners = new Set<() => void>();

function publish(next: ReportPulse) {
  pulse = next;
  listeners.forEach((listener) => listener());
}

function merge(existing: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return existing;
  const merged = [...new Set([...existing, ...incoming])];
  return merged.length > MAX_TRACKED ? merged.slice(merged.length - MAX_TRACKED) : merged;
}

export function recordReportPulse(event: { created?: string[]; updated?: string[] }) {
  const created = merge(pulse.created, event.created ?? []);
  const updated = merge(pulse.updated, event.updated ?? []);
  if (created === pulse.created && updated === pulse.updated) return;
  publish({ created, updated });
}

export function clearReportPulse() {
  if (pulse === EMPTY) return;
  publish(EMPTY);
}

export function getReportPulse(): ReportPulse {
  return pulse;
}

export function useReportPulse(): ReportPulse {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return useSyncExternalStore(subscribe, getReportPulse, getReportPulse);
}
