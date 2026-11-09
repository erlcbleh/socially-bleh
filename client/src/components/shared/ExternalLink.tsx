import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "./Modal";

function isInternal(href: string): { isInternal: boolean; internalPath?: string } {
  try {
    if (href.startsWith("/")) {
      return { isInternal: true, internalPath: href };
    }
    const url = new URL(href, window.location.origin);
    const host = url.hostname.toLowerCase();
    const currentHost = window.location.hostname.toLowerCase();

    if (host === "socially.lol" || host.endsWith(".socially.lol") || host === currentHost) {
      return { isInternal: true, internalPath: url.pathname + url.search + url.hash };
    }
  } catch {
  }
  return { isInternal: false };
}

export function ExternalLink({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const { isInternal: internal, internalPath } = isInternal(href);

  if (internal) {
    return (
      <Link
        to={internalPath || "/"}
        onClick={(e) => e.stopPropagation()}
        className="text-brand break-all hover:underline"
      >
        {href}
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-left text-brand break-all hover:underline"
      >
        {href}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Leaving this site" size="sm">
        <p className="break-all text-sm text-neutral-600 dark:text-neutral-400">
          You're about to visit an external link:
        </p>
        <p className="mt-1 break-all text-sm font-medium">{href}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              window.open(href, "_blank", "noopener,noreferrer");
              setOpen(false);
            }}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Continue
          </button>
        </div>
      </Modal>
    </>
  );
}
