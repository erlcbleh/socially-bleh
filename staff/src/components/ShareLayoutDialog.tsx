import { useEffect, useState } from "react";
import { Modal } from "@socially/shared/components/Modal";
import { CopyButton } from "@socially/shared/components/CopyButton";
import {
  createShareCode,
  importSharedLayout,
  previewSharedLayout,
  revokeShareCode,
  type SavedLayout,
  type SharedLayoutPreview,
} from "../lib/layouts";
import { PANEL_MAP } from "../panels/registry";

const field =
  "w-full rounded-lg border border-panel-border bg-transparent px-3.5 py-2.5 text-[15px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40";
const primaryButton =
  "rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40";
const ghostButton =
  "rounded-full border border-white/15 px-3.5 py-2 text-[13px] text-neutral-200 transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40";

function panelTitle(panelId: string) {
  return PANEL_MAP.get(panelId)?.title ?? panelId;
}

export function ShareLayoutDialog({
  layout,
  open,
  onClose,
  onChanged,
}: {
  layout: SavedLayout | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(layout?.shareCode ?? null);
    setError(null);
  }, [open, layout]);

  if (!open || !layout) return null;

  const generate = () => {
    setBusy(true);
    setError(null);
    createShareCode(layout.id)
      .then((result) => {
        setCode(result.shareCode);
        onChanged();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const revoke = () => {
    setBusy(true);
    setError(null);
    revokeShareCode(layout.id)
      .then(() => {
        setCode(null);
        onChanged();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <Modal open onClose={onClose} title={`Share “${layout.name}”`} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-neutral-400">
          Anyone on the staff panel can paste this code to copy your panel arrangement into their own
          layouts. It shares the arrangement only — never any case data, and it does not give them
          access to panels their rank cannot already open.
        </p>

        {code ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-3">
              <span className="flex-1 font-mono text-lg tracking-[0.2em] text-white">{code}</span>
              <CopyButton value={code} label="Copy share code" />
            </div>
            <button type="button" onClick={revoke} disabled={busy} className={`${ghostButton} self-start`}>
              Revoke code
            </button>
          </div>
        ) : (
          <button type="button" onClick={generate} disabled={busy} className={`${primaryButton} self-start`}>
            {busy ? "Generating…" : "Generate share code"}
          </button>
        )}

        {error ? <p className="text-[13px] text-severity-high">{error}</p> : null}

        <div className="flex justify-end border-t border-white/[0.09] pt-4">
          <button type="button" onClick={onClose} className={primaryButton}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ImportLayoutDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (layout: SavedLayout) => void;
}) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<SharedLayoutPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setPreview(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    const cleaned = value.trim();
    if (cleaned.length < 10) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    setError(null);

    previewSharedLayout(cleaned)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setPreview(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!open) return null;

  const runImport = () => {
    setBusy(true);
    setError(null);
    importSharedLayout(value.trim())
      .then((result) => {
        onImported(result.layout);
        onClose();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <Modal open onClose={onClose} title="Import a layout" size="sm">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="layout-share-code" className="mb-1.5 block text-[13px] text-neutral-400">
            Share code
          </label>
          <input
            id="layout-share-code"
            value={value}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            placeholder="ABCD234XYZ"
            autoFocus
            maxLength={20}
            className={`${field} font-mono tracking-[0.2em]`}
          />
        </div>

        {checking ? <p className="text-[13px] text-neutral-500">Checking…</p> : null}

        {preview ? (
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
            <div className="text-[13px] font-medium text-white">{preview.name}</div>
            {preview.sharedBy ? (
              <div className="text-[13px] text-neutral-400">shared by @{preview.sharedBy}</div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preview.panelIds.map((panelId) => (
                <span
                  key={panelId}
                  className="rounded-full border border-white/10 px-2.5 py-[1px] text-[11px] text-neutral-400"
                >
                  {panelTitle(panelId)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-neutral-500">
              Saved as a new layout of your own. Panels your rank cannot open are dropped on load.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-severity-high">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-white/[0.09] pt-4">
          <button type="button" onClick={onClose} className={ghostButton}>
            Cancel
          </button>
          <button type="button" onClick={runImport} disabled={busy || !preview} className={primaryButton}>
            {busy ? "Importing…" : "Import layout"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
