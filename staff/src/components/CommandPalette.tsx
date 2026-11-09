import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { visiblePanels } from "../panels/registry";
import { applyLayout, applyPreset, openPanel, serializeLayout } from "../lib/panelBus";
import { BUILT_IN_PRESETS } from "../lib/presets";
import { pruneLayout, saveLayout } from "../lib/layouts";
import { useLayoutStore } from "../lib/layoutStore";
import {
  formatHotkey,
  listHotkeys,
  registerHotkey,
  subscribeHotkeys,
  useHotkey,
  type Hotkey,
} from "../lib/hotkeys";
import type { StaffContext } from "../types";

interface Command {
  id: string;
  label: string;
  hint: string;
  shortcut?: Hotkey;
  run: () => void;
}

const PALETTE_HOTKEY = { key: "k", mod: true };

const QUICK_PANELS: { hotkey: Hotkey; panelId: string; description: string }[] = [
  { hotkey: { key: "f", mod: true, shift: true }, panelId: "reports.feed", description: "Open Live Reports" },
  {
    hotkey: { key: "w", mod: true, shift: true },
    panelId: "reports.workspace",
    description: "Open Report Workspace",
  },
  { hotkey: { key: "u", mod: true, shift: true }, panelId: "users.search", description: "Open User Search" },
  { hotkey: { key: "d", mod: true, shift: true }, panelId: "users.dossier", description: "Open User Dossier" },
  {
    hotkey: { key: "a", mod: true, shift: true },
    panelId: "governance.auditLog",
    description: "Open Audit Log",
  },
  {
    hotkey: { key: "s", mod: true, shift: true },
    panelId: "security.flags",
    description: "Open Security Flags",
  },
];

function useQuickPanelHotkeys(staff: StaffContext) {
  const availableIds = visiblePanels(staff)
    .map((panel) => panel.id)
    .join(",");

  useEffect(() => {
    const allowed = new Set(availableIds.split(","));
    const unbind = QUICK_PANELS.filter((entry) => allowed.has(entry.panelId)).map((entry) =>
      registerHotkey(entry.hotkey, () => openPanel({ panelId: entry.panelId }), entry.description)
    );

    return () => unbind.forEach((off) => off());
  }, [availableIds]);
}

export function CommandPalette({ staff }: { staff: StaffContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useLayoutStore();

  useHotkey(PALETTE_HOTKEY, () => setIsOpen((open) => !open), [], "Open the command palette");
  useQuickPanelHotkeys(staff);

  const commands = useMemo<Command[]>(() => {
    const panelCommands = visiblePanels(staff).map((panel) => ({
      id: `panel:${panel.id}`,
      label: panel.title,
      hint: "Open panel",
      shortcut: QUICK_PANELS.find((entry) => entry.panelId === panel.id)?.hotkey,
      run: () => openPanel({ panelId: panel.id }),
    }));

    const presetCommands = BUILT_IN_PRESETS.map((preset) => ({
      id: `preset:${preset.id}`,
      label: preset.name,
      hint: preset.description,
      run: () => applyPreset(preset.id),
    }));

    const layoutCommands = store.layouts.map((layout) => ({
      id: `layout:${layout.id}`,
      label: layout.name,
      hint: layout.isDefault ? "Default layout" : "Your layout",
      run: () => {
        const { layout: pruned } = pruneLayout(layout.layout, layout.schemaVersion);
        if (pruned && applyLayout(pruned)) store.setActiveName(layout.name);
      },
    }));

    const sharedCommands = store.presets.map((preset) => ({
      id: `shared:${preset.id}`,
      label: preset.name,
      hint: preset.createdBy ? `Shared by @${preset.createdBy.username}` : "Shared preset",
      run: () => {
        const { layout: pruned } = pruneLayout(preset.layout, preset.schemaVersion);
        if (pruned) applyLayout(pruned);
      },
    }));

    const actionCommands: Command[] = [
      {
        id: "action:save",
        label: `Save layout "${store.activeName}"`,
        hint: "Persist the current arrangement now",
        run: () => {
          const layout = serializeLayout();
          if (!layout) return;
          saveLayout(store.activeName, layout)
            .then(() => {
              store.noteSaved();
              store.refresh();
            })
            .catch((err: Error) => store.noteError(err.message));
        },
      },
    ];

    return [...panelCommands, ...presetCommands, ...layoutCommands, ...sharedCommands, ...actionCommands];
  }, [staff, store]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(needle) || command.hint.toLowerCase().includes(needle)
    );
  }, [commands, query]);

  useEffect(() => {
    setCursor(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    else setQuery("");
  }, [isOpen]);

  const shortcuts = useSyncExternalStore(subscribeHotkeys, listHotkeys, listHotkeys);

  if (!isOpen) return null;

  const run = (command: Command | undefined) => {
    if (!command) return;
    command.run();
    setIsOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh]"
      onClick={() => setIsOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-panel-border bg-panel-raised shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((current) => Math.min(filtered.length - 1, current + 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((current) => Math.max(0, current - 1));
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              run(filtered[cursor]);
            }
          }}
          placeholder="Search panels, layouts and presets…"
          aria-label="Search panels, layouts and presets"
          className="w-full border-b border-panel-border bg-transparent px-4 py-3 text-base text-neutral-100 outline-none placeholder:text-neutral-500"
        />

        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">Nothing matches “{query}”.</div>
          ) : null}

          {filtered.map((command, index) => (
            <button
              key={command.id}
              onMouseEnter={() => setCursor(index)}
              onClick={() => run(command)}
              className={`flex w-full items-baseline gap-2 px-4 py-2.5 text-left transition-colors ${
                index === cursor ? "bg-white/[0.14]" : "hover:bg-panel-hover"
              }`}
            >
              <span className="text-sm text-neutral-100">{command.label}</span>
              <span className="ml-auto shrink-0 text-[12px] text-neutral-500">{command.hint}</span>
              {command.shortcut ? (
                <kbd className="shrink-0 rounded bg-panel-bg px-2 py-1 font-mono text-[12px] text-neutral-400">
                  {formatHotkey(command.shortcut)}
                </kbd>
              ) : null}
            </button>
          ))}

          {shortcuts.length > 0 && !query.trim() ? (
            <div className="mt-1 border-t border-panel-border pt-1">
              <div className="px-4 py-1.5 text-[12px] font-semibold text-neutral-500">
                Keyboard shortcuts
              </div>
              {shortcuts.map((binding) => (
                <div
                  key={`${binding.description}-${formatHotkey(binding.hotkey)}`}
                  className="flex items-baseline gap-2 px-4 py-1.5"
                >
                  <span className="text-[13px] text-neutral-400">{binding.description}</span>
                  <kbd className="ml-auto shrink-0 rounded bg-panel-bg px-2 py-1 font-mono text-[12px] text-neutral-400">
                    {formatHotkey(binding.hotkey)}
                  </kbd>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-panel-border px-4 py-2.5 text-[12px] text-neutral-500">
          <span>↑↓ navigate</span>
          <span>⏎ run</span>
          <span>esc close</span>
          <span className="ml-auto">{formatHotkey(PALETTE_HOTKEY)}</span>
        </div>
      </div>
    </div>
  );
}
