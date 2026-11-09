import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  tone = "default",
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  tone?: "default" | "danger";
  size?: "default" | "sm";
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      const first = focusableWithin(panel)[0];
      (first ?? panel).focus();
    }

    return () => {
      const restore = restoreRef.current;
      if (restore && document.contains(restore)) restore.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = focusableWithin(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const stop = useCallback((event: { stopPropagation: () => void }) => event.stopPropagation(), []);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[var(--modal-backdrop-blur,4px)] ${
        tone === "danger"
          ? "bg-gradient-to-t from-red-600/70 via-red-800/30 to-transparent dark:from-red-900 dark:via-red-950/70 dark:to-black/60"
          : "bg-[var(--modal-backdrop,rgba(0,0,0,0.6))]"
      }`}
      onMouseDown={() => onCloseRef.current()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : "Dialog"}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`max-h-[85vh] w-full overflow-y-auto rounded-[var(--modal-radius,0.5rem)] border border-[var(--modal-border,transparent)] bg-[var(--modal-surface,#fff)] p-4 shadow-2xl outline-none backdrop-blur-[var(--modal-blur,0px)] ${size === "sm" ? "max-w-sm" : "max-w-xl"}`}
        style={{ boxShadow: "var(--modal-shadow, 0 25px 50px -12px rgb(0 0 0 / 0.25))" }}
        onMouseDown={stop}
        onClick={stop}
      >
        <div className="mb-2 flex items-center justify-between">
          {title ? (
            <h2 id={titleId} className="text-lg font-medium">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
