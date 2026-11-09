import { useEffect } from "react";

export interface Hotkey {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

type Handler = (event: KeyboardEvent) => void;

export interface HotkeyBinding {
  hotkey: Hotkey;
  description: string;
}

const bindings = new Map<string, Handler>();
const descriptions = new Map<string, HotkeyBinding>();
const catalogListeners = new Set<() => void>();

let catalogSnapshot: HotkeyBinding[] = [];

function notifyCatalog() {
  catalogSnapshot = [...descriptions.values()];
  catalogListeners.forEach((listener) => listener());
}

export function subscribeHotkeys(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

export function listHotkeys(): HotkeyBinding[] {
  return catalogSnapshot;
}

function signature(hotkey: Hotkey): string {
  return [hotkey.mod ? "mod" : "", hotkey.shift ? "shift" : "", hotkey.alt ? "alt" : "", hotkey.key.toLowerCase()]
    .filter(Boolean)
    .join("+");
}

function eventSignature(event: KeyboardEvent): string {
  return [
    event.metaKey || event.ctrlKey ? "mod" : "",
    event.shiftKey ? "shift" : "",
    event.altKey ? "alt" : "",
    event.key.toLowerCase(),
  ]
    .filter(Boolean)
    .join("+");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

let attached = false;

function onKeyDown(event: KeyboardEvent) {
  const signatureKey = eventSignature(event);
  const handler = bindings.get(signatureKey);
  if (!handler) return;

  const usesModifier = event.metaKey || event.ctrlKey || event.altKey;
  if (!usesModifier && isTypingTarget(event.target)) return;

  event.preventDefault();
  handler(event);
}

function ensureAttached() {
  if (attached) return;
  window.addEventListener("keydown", onKeyDown);
  attached = true;
}

export function registerHotkey(hotkey: Hotkey, handler: Handler, description?: string): () => void {
  const signatureKey = signature(hotkey);
  bindings.set(signatureKey, handler);

  if (description) {
    descriptions.set(signatureKey, { hotkey, description });
    notifyCatalog();
  }

  ensureAttached();

  return () => {
    if (bindings.get(signatureKey) !== handler) return;
    bindings.delete(signatureKey);
    if (description && descriptions.delete(signatureKey)) notifyCatalog();
  };
}

export function useHotkey(hotkey: Hotkey, handler: Handler, deps: unknown[] = [], description?: string) {
  useEffect(() => {
    return registerHotkey(hotkey, handler, description);
    
  }, deps);
}

export function formatHotkey(hotkey: Hotkey): string {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const parts: string[] = [];
  if (hotkey.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (hotkey.shift) parts.push(isMac ? "⇧" : "Shift");
  if (hotkey.alt) parts.push(isMac ? "⌥" : "Alt");
  parts.push(hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key);
  return parts.join(isMac ? "" : "+");
}
