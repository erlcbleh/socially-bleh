import { useEffect, useRef, useState } from "react";
import { visiblePanels } from "../panels/registry";
import { applyLayout, applyPreset, openPanel, serializeLayout, useOpenPanelIds } from "../lib/panelBus";
import { BUILT_IN_PRESETS } from "../lib/presets";
import { usePrompt } from "@socially/shared/components/PromptDialog";
import {
  deleteLayout,
  deletePreset,
  pruneLayout,
  renameLayout,
  saveLayout,
  setDefaultLayout,
  shareLayoutAsPreset,
} from "../lib/layouts";
import { useLayoutStore } from "../lib/layoutStore";
import { ShareLayoutDialog, ImportLayoutDialog } from "./ShareLayoutDialog";
import type { SavedLayout } from "../lib/layouts";
import type { StaffContext } from "../types";

function useDismissOnOutside(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  return ref;
}

const menuButton =
  "rounded px-2.5 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-panel-hover hover:text-neutral-200";
const menuItem =
  "flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-neutral-300 transition-colors hover:bg-panel-hover hover:text-neutral-100";

function PanelPicker({ staff }: { staff: StaffContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useDismissOnOutside(() => setIsOpen(false));
  const openIds = useOpenPanelIds();
  const panels = visiblePanels(staff);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen((open) => !open)} className={menuButton} aria-expanded={isOpen}>
        + Panel
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-panel-border bg-panel-raised py-1.5 shadow-xl">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => {
                openPanel({ panelId: panel.id });
                setIsOpen(false);
              }}
              className={menuItem}
            >
              <span className={`h-1 w-1 rounded-full ${openIds.includes(panel.id) ? "bg-white text-black" : "bg-transparent"}`} />
              {panel.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LayoutBar({ staff }: { staff: StaffContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useDismissOnOutside(() => setIsOpen(false));
  const store = useLayoutStore();
  const { prompt, dialog } = usePrompt();
  const [shareTarget, setShareTarget] = useState<SavedLayout | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const activeLayout = store.layouts.find((layout) => layout.name === store.activeName) ?? null;

  const runSave = (name: string) => {
    const layout = serializeLayout();
    if (!layout) return;
    saveLayout(name, layout)
      .then(() => {
        store.setActiveName(name);
        store.noteSaved();
        return store.refresh();
      })
      .catch((err: Error) => store.noteError(err.message));
  };

  const nameTaken = (name: string) =>
    store.layouts.some((layout) => layout.name.toLowerCase() === name.toLowerCase());

  const runSaveAs = () => {
    setIsOpen(false);
    prompt({
      title: "Save layout as",
      label: "Layout name",
      initialValue: `${store.activeName} copy`,
      confirmLabel: "Save",
      maxLength: 60,
      validate: (value) => (nameTaken(value) ? "A layout with that name already exists." : null),
      onSubmit: (name) => runSave(name),
    });
  };

  const runShare = () => {
    const layout = serializeLayout();
    if (!layout) return;
    setIsOpen(false);
    prompt({
      title: "Share as preset",
      description: "All staff can load this preset.",
      label: "Preset name",
      initialValue: store.activeName,
      confirmLabel: "Share preset",
      maxLength: 60,
      validate: (value) =>
        store.presets.some((preset) => preset.name.toLowerCase() === value.toLowerCase())
          ? "A preset with that name already exists."
          : null,
      onSubmit: (name) => {
        shareLayoutAsPreset(name, layout)
          .then(() => store.refresh())
          .catch((err: Error) => store.noteError(err.message));
      },
    });
  };

  const runRename = () => {
    setIsOpen(false);
    const current = store.activeName;
    prompt({
      title: "Rename layout",
      label: "Layout name",
      initialValue: current,
      confirmLabel: "Rename",
      maxLength: 60,
      validate: (value) =>
        value.toLowerCase() !== current.toLowerCase() && nameTaken(value)
          ? "A layout with that name already exists."
          : null,
      onSubmit: (name) => {
        if (name === current) return;
        const target = store.layouts.find((layout) => layout.name === current);
        if (!target) {
          store.noteError("Save this layout before renaming it.");
          return;
        }
        renameLayout(target.id, name)
          .then(() => {
            store.setActiveName(name);
            return store.refresh();
          })
          .catch((err: Error) => store.noteError(err.message));
      },
    });
  };

  return (
    <div className="flex items-center gap-1">
      {dialog}
      <PanelPicker staff={staff} />

      <div className="relative" ref={ref}>
        <button onClick={() => setIsOpen((open) => !open)} className={menuButton} aria-expanded={isOpen}>
          {store.activeName}
          <span className="ml-1 text-neutral-500">▾</span>
        </button>

        {isOpen ? (
          <div className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-panel-border bg-panel-raised py-1.5 shadow-xl">
            <div className="px-3.5 py-1.5 text-[12px] font-semibold text-neutral-500">This layout</div>
            <button onClick={() => { runSave(store.activeName); setIsOpen(false); }} className={menuItem}>
              Save
            </button>
            <button onClick={runSaveAs} className={menuItem}>
              Save as…
            </button>
            <button onClick={runRename} className={menuItem}>
              Rename…
            </button>
            <button
              onClick={() => {
                if (!activeLayout) {
                  store.noteError("Save this layout before sharing it.");
                  return;
                }
                setShareTarget(activeLayout);
                setIsOpen(false);
              }}
              className={menuItem}
            >
              Share code…
              {activeLayout?.shareCode ? (
                <span className="ml-auto text-[12px] text-neutral-500">shared</span>
              ) : null}
            </button>
            <button
              onClick={() => {
                setImportOpen(true);
                setIsOpen(false);
              }}
              className={menuItem}
            >
              Import code…
            </button>
            {staff.isAdmin ? (
              <button onClick={runShare} className={menuItem}>
                Share as preset
              </button>
            ) : null}

            <div className="mt-1 border-t border-panel-border px-3.5 pb-1 pt-2 text-[12px] font-semibold text-neutral-500">
              Start from
            </div>
            {BUILT_IN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  applyPreset(preset.id);
                  setIsOpen(false);
                }}
                className={menuItem}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}

            {store.presets.length > 0 ? (
              <>
                <div className="mt-1 border-t border-panel-border px-3.5 pb-1 pt-2 text-[12px] font-semibold text-neutral-500">
                  Shared presets
                </div>
                {store.presets.map((preset) => (
                  <div key={preset.id} className="group flex items-center">
                    <button
                      onClick={() => {
                        const { layout } = pruneLayout(preset.layout, preset.schemaVersion);
                        if (layout) applyLayout(layout);
                        setIsOpen(false);
                      }}
                      className={`${menuItem} flex-1`}
                    >
                      {preset.name}
                      {preset.createdBy ? (
                        <span className="ml-auto text-[12px] text-neutral-500">@{preset.createdBy.username}</span>
                      ) : null}
                    </button>
                    {staff.isAdmin ? (
                      <button
                        onClick={() => deletePreset(preset.id).then(() => store.refresh())}
                        className="px-2.5 text-[13px] text-neutral-500 opacity-0 transition-opacity hover:text-severity-high group-hover:opacity-100"
                        title="Delete preset"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </>
            ) : null}

            {store.layouts.length > 0 ? (
              <>
                <div className="mt-1 border-t border-panel-border px-3.5 pb-1 pt-2 text-[12px] font-semibold text-neutral-500">
                  Your layouts
                </div>
                {store.layouts.map((layout) => (
                  <div key={layout.id} className="group flex items-center">
                    <button
                      onClick={() => {
                        const { layout: pruned } = pruneLayout(layout.layout, layout.schemaVersion);
                        if (pruned && applyLayout(pruned)) store.setActiveName(layout.name);
                        setIsOpen(false);
                      }}
                      className={`${menuItem} flex-1`}
                    >
                      {layout.name}
                      {layout.isDefault ? (
                        <span className="ml-auto text-[12px] text-white">default</span>
                      ) : null}
                    </button>
                    <button
                      onClick={() => setDefaultLayout(layout.id).then(() => store.refresh())}
                      className="px-1 text-[13px] text-neutral-500 opacity-0 transition-opacity hover:text-neutral-200 group-hover:opacity-100"
                      title="Make this the layout you land on"
                    >
                      ★
                    </button>
                    <button
                      onClick={() => deleteLayout(layout.id).then(() => store.refresh())}
                      className="px-2.5 text-[13px] text-neutral-500 opacity-0 transition-opacity hover:text-severity-high group-hover:opacity-100"
                      title="Delete layout"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {store.status === "saving" ? <span className="text-[12px] text-neutral-500">saving…</span> : null}
      {store.status === "error" ? (
        <span className="max-w-[220px] truncate text-[12px] text-severity-high">
          {store.error || "unsaved"}
        </span>
      ) : null}

      <ShareLayoutDialog
        layout={shareTarget}
        open={shareTarget !== null}
        onClose={() => setShareTarget(null)}
        onChanged={() => {
          store.refresh().catch(() => {});
        }}
      />

      <ImportLayoutDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(layout) => {
          const { layout: pruned } = pruneLayout(layout.layout, layout.schemaVersion);
          if (pruned && applyLayout(pruned)) store.setActiveName(layout.name);
          store.refresh().catch(() => {});
        }}
      />
    </div>
  );
}

export function PruneNotice() {
  const store = useLayoutStore();
  if (!store.prune) return null;

  return (
    <div className="flex items-center gap-2 border-b border-severity-medium/30 bg-severity-medium/10 px-3.5 py-2 text-[13px] text-severity-medium">
      <span>
        “{store.prune.name}” referenced {store.prune.removed.length} panel
        {store.prune.removed.length === 1 ? "" : "s"} that no longer exist. They were dropped rather than failing the
        load.
      </span>
      <button onClick={store.dismissPrune} className="ml-auto rounded px-2.5 py-1 hover:bg-severity-medium/20">
        Dismiss
      </button>
    </div>
  );
}
