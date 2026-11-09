import { useCallback, useEffect, useSyncExternalStore } from "react";
import { LuTriangleAlert, LuX } from "react-icons/lu";
import { setMutationErrorHandler } from "./queryStore";
import { ApiError } from "./api";

const TOAST_TTL_MS = 6000;
const MAX_TOASTS = 3;

export interface Toast {
  id: number;
  message: string;
  tone: "error";
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot() {
  return toasts;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showErrorToast(message: string) {
  const text = message.trim() || "Something went wrong";
  if (toasts.some((t) => t.message === text)) return;

  const toast: Toast = { id: nextId++, message: text, tone: "error" };
  toasts = [...toasts, toast].slice(-MAX_TOASTS);
  emit();
  setTimeout(() => dismissToast(toast.id), TOAST_TTL_MS);
}

function messageFor(error: Error) {
  if (error instanceof ApiError) {
    if (error.status === 429) return error.message || "You're doing that too fast, slow down a moment.";
    if (error.status === 401) return "Your session expired, please sign in again.";
    if (error.status >= 500) return "Something went wrong on our end, please try again.";
    return error.message || "That didn't work, please try again.";
  }
  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return "That request timed out, please try again.";
  }
  return "Couldn't reach the server, check your connection.";
}

export function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function Toaster() {
  const items = useToasts();

  useEffect(() => {
    setMutationErrorHandler((error) => showErrorToast(messageFor(error)));
    return () => setMutationErrorHandler(null);
  }, []);

  const onDismiss = useCallback((id: number) => dismissToast(id), []);

  if (!items.length) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
    >
      {items.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-red-200 bg-white px-3.5 py-2.5 shadow-lg dark:border-red-900 dark:bg-neutral-900"
        >
          <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="min-w-0 flex-1 break-words text-sm text-neutral-800 dark:text-neutral-100">{toast.message}</p>
          <button
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
