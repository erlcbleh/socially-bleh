import { useEffect, useMemo, useState } from "react";
import { PANEL_MAP, visiblePanels } from "../panels/registry";
import { registerPanelHost, setOpenPanelIds } from "../lib/panelBus";
import { availableTabs, tabForPanel } from "../lib/simpleTabs";
import { PanelDensityProvider } from "./panelKit";
import type { StaffContext } from "../types";

export function SimpleShell({ staff }: { staff: StaffContext }) {
  const tabs = useMemo(() => availableTabs(visiblePanels(staff)), [staff]);
  const [activeId, setActiveId] = useState(() => tabs[0]?.id ?? "");

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null;

  useEffect(() => {
    const show = (panelId: string) => {
      const tab = tabForPanel(tabs, panelId);
      if (tab) setActiveId(tab.id);
    };

    return registerPanelHost({
      open: (request) => show(request.panelId),
      focus: show,
      close: () => {},
      serialize: () => null,
      applyLayout: () => false,
      applyPreset: () => {},
    });
  }, [tabs]);

  useEffect(() => {
    setOpenPanelIds(active ? active.panels.map((panel) => panel.panelId) : []);
  }, [active]);

  if (!active) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-base text-neutral-500">
        You do not have access to any staff tools.
      </div>
    );
  }

  return (
    <PanelDensityProvider value="comfortable">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <nav
          role="tablist"
          aria-label="Staff sections"
          className="flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === active.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(tab.id)}
                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-[15px] transition-colors ${
                  isActive
                    ? "bg-white font-semibold text-black"
                    : "text-neutral-400 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          {active.panels.map((entry) => {
            const definition = PANEL_MAP.get(entry.panelId);
            if (!definition) return null;
            const Component = definition.component;

            return (
              <section
                key={entry.panelId}
                aria-label={definition.title}
                className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-squircle border border-panel-border bg-panel-raised ${
                  entry.sizeClass ?? ""
                }`}
              >
                {entry.ownHeader ? null : (
                  <header className="flex shrink-0 items-center gap-2 border-b border-panel-border px-6 py-4">
                    <h2 className="text-base font-semibold text-white">{definition.title}</h2>
                  </header>
                )}

                <div className="min-h-0 flex-1">
                  <Component />
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </PanelDensityProvider>
  );
}
