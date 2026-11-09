import { useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { visiblePanels, type PanelDefinition, type PanelGroup } from "../panels/registry";
import { openPanel, useOpenPanelIds } from "../lib/panelBus";
import type { StaffContext } from "../types";

export function PanelLauncher({
  staff,
  activeGroup,
  onClearGroup,
}: {
  staff: StaffContext;
  activeGroup: PanelGroup | null;
  onClearGroup: () => void;
}) {
  const [query, setQuery] = useState("");
  const openIds = useOpenPanelIds();

  const panels = useMemo(() => visiblePanels(staff), [staff]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return panels.filter((panel) => {
      if (activeGroup && panel.group !== activeGroup) return false;
      if (!needle) return true;
      return panel.title.toLowerCase().includes(needle) || panel.group.toLowerCase().includes(needle);
    });
  }, [panels, activeGroup, query]);

  const grouped = useMemo(() => {
    const map = new Map<PanelGroup, PanelDefinition[]>();
    for (const panel of filtered) {
      const list = map.get(panel.group) ?? [];
      list.push(panel);
      map.set(panel.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <section
      aria-label="Panels"
      className="flex min-h-0 flex-[0_0_38%] flex-col overflow-hidden rounded-squircle border border-panel-border bg-panel-raised"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-panel-border px-3 py-2.5">
        <span className="text-[12px] font-bold text-white">Panels</span>
        {activeGroup ? (
          <button
            type="button"
            onClick={onClearGroup}
            className="rounded-full border border-panel-border px-2.5 py-[1px] text-[11px] font-semibold text-neutral-400 transition-colors hover:border-white/40 hover:text-white"
          >
            {activeGroup} ✕
          </button>
        ) : null}
        <span className="ml-auto font-mono text-[12px] text-neutral-500">{filtered.length}</span>
      </div>

      <div className="shrink-0 px-3 pt-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-panel-border px-2.5 py-1.5">
          <LuSearch className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter panels"
            aria-label="Filter panels"
            className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5">
        {grouped.length === 0 ? (
          <p className="px-2.5 py-3 text-[13px] text-neutral-500">No panels match “{query}”.</p>
        ) : null}

        {grouped.map(([group, list]) => (
          <div key={group} className="mb-2 last:mb-0">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-neutral-500">
              {group}
            </div>
            {list.map((panel) => {
              const isOpen = openIds.includes(panel.id);
              return (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => openPanel({ panelId: panel.id })}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                    isOpen ? "bg-white/[0.07] text-white" : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span
                    className={`h-1 w-1 shrink-0 rounded-full ${isOpen ? "bg-white" : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{panel.title}</span>
                  {isOpen ? (
                    <span className="ml-auto shrink-0 text-[11px] text-neutral-500">
                      open
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
