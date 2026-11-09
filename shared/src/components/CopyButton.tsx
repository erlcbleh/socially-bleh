import { useCallback, useEffect, useRef, useState } from "react";
import { LuCheck, LuCopy, LuX } from "react-icons/lu";

type CopyState = "idle" | "copied" | "failed";

async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return legacyCopy(value);
  }

  return legacyCopy(value);
}

function legacyCopy(value: string): boolean {
  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label,
  className = "",
  withLabel = false,
}: {
  value: string;
  label: string;
  className?: string;
  withLabel?: boolean;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(() => {
    writeToClipboard(value).then((ok) => {
      setState(ok ? "copied" : "failed");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState("idle"), ok ? 1600 : 2600);
    });
  }, [value]);

  const copied = state === "copied";
  const failed = state === "failed";

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : failed ? "Press Ctrl+C to copy" : `Copy ${label}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-100 ${className}`}
    >
      {copied ? (
        <LuCheck className="h-4 w-4 text-[var(--copy-ok,#16a34a)]" aria-hidden="true" />
      ) : failed ? (
        <LuX className="h-4 w-4 text-[var(--copy-fail,#dc2626)]" aria-hidden="true" />
      ) : (
        <LuCopy className="h-4 w-4" aria-hidden="true" />
      )}

      {withLabel ? (
        <span
          className={`text-[12px] ${
            copied ? "text-[var(--copy-ok,#16a34a)]" : failed ? "text-[var(--copy-fail,#dc2626)]" : ""
          }`}
        >
          {copied ? "Copied" : failed ? "Copy failed" : "Copy"}
        </span>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `${label} copied to clipboard` : failed ? `Could not copy ${label}` : ""}
      </span>
    </button>
  );
}
