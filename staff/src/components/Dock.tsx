import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
  type IDockviewPanelProps,
} from "dockview";
import { PANELS, PANEL_MAP, visiblePanels, type PanelDefinition } from "../panels/registry";
import { registerPanelHost, setOpenPanelIds, openPanel, type PanelRequest } from "../lib/panelBus";
import { BUILT_IN_PRESETS, DEFAULT_PRESET_ID, presetById } from "../lib/presets";
import { pruneLayout, saveLayout, type SavedLayout, type SerializedLayout } from "../lib/layouts";
import { useLayoutStore } from "../lib/layoutStore";
import { useUiMode } from "../lib/uiMode";
import type { StaffContext } from "../types";

const DESKTOP_QUERY = "(min-width: 1024px)";
const SOCIALLY_THEME: DockviewTheme = {
  name: "socially",
  className: "dockview-theme-socially",
  gap: 8,
  dndOverlayMounting: "absolute",
  dndPanelOverlay: "group",
};

const PERSIST_DEBOUNCE_MS = 800;
const PERSIST_MAX_RETRIES = 4;
const PERSIST_RETRY_BASE_MS = 1500;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

const components = Object.fromEntries(
  PANELS.map((panel) => [
    panel.id,
    (props: IDockviewPanelProps) => {
      const Component = panel.component;
      return <Component {...(props.params as Record<string, unknown>)} />;
    },
  ])
);

function compactLayoutOf(openIds: string[], activeId: string | undefined): SerializedLayout {
  return {
    grid: {
      root: {
        type: "branch",
        data: [{ type: "leaf", data: { id: "compact", views: openIds, activeView: activeId } }],
      },
      width: 0,
      height: 0,
      orientation: "HORIZONTAL",
    },
    panels: Object.fromEntries(
      openIds.map((id) => [id, { id, contentComponent: id, title: PANEL_MAP.get(id)?.title ?? id }])
    ),
    activeGroup: "compact",
  } as SerializedLayout;
}

function readCompactLayout(layout: SerializedLayout): { openIds: string[]; activeId?: string } {
  const openIds = Object.keys(layout.panels ?? {});
  const root = layout.grid?.root as { type?: string; data?: unknown } | undefined;

  let activeId: string | undefined;
  const walk = (node: unknown): void => {
    const candidate = node as { type?: string; data?: { activeView?: string; views?: string[] } | unknown[] };
    if (candidate?.type === "leaf") {
      const data = candidate.data as { activeView?: string };
      activeId ??= data?.activeView;
      return;
    }
    if (candidate?.type === "branch" && Array.isArray(candidate.data)) candidate.data.forEach(walk);
  };
  walk(root);

  return { openIds, activeId };
}

function CompactShell({ panels }: { panels: PanelDefinition[] }) {
  const store = useLayoutStore();
  const [openIds, setOpenIds] = useState<string[]>(() => (panels[0] ? [panels[0].id] : []));
  const [activeId, setActiveId] = useState(panels[0]?.id);

  const known = useMemo(() => new Set(panels.map((panel) => panel.id)), [panels]);
  const visibleOpen = useMemo(() => openIds.filter((id) => known.has(id)), [openIds, known]);
  const active =
    panels.find((panel) => panel.id === activeId && visibleOpen.includes(panel.id)) ||
    panels.find((panel) => panel.id === visibleOpen[0]) ||
    panels[0];

  const openIdsRef = useRef(visibleOpen);
  openIdsRef.current = visibleOpen;
  const activeIdRef = useRef(active?.id);
  activeIdRef.current = active?.id;

  const openPanelCompact = useCallback((panelId: string) => {
    setOpenIds((current) => (current.includes(panelId) ? current : [...current, panelId]));
    setActiveId(panelId);
  }, []);

  useEffect(() => {
    return registerPanelHost({
      open: (request) => openPanelCompact(request.panelId),
      focus: (panelId) => openPanelCompact(panelId),
      close: (panelId) =>
        setOpenIds((current) => {
          const next = current.filter((id) => id !== panelId);
          return next.length > 0 ? next : current;
        }),
      serialize: () => compactLayoutOf(openIdsRef.current, activeIdRef.current),
      applyLayout: (layout) => {
        const { openIds: restored, activeId: restoredActive } = readCompactLayout(layout);
        const usable = restored.filter((id) => known.has(id));
        if (usable.length === 0) return false;
        setOpenIds(usable);
        setActiveId(restoredActive && usable.includes(restoredActive) ? restoredActive : usable[0]);
        return true;
      },
      applyPreset: (presetId) => {
        const spec = presetById(presetId)?.build(panels) ?? [];
        const ids = spec.map((entry) => entry.panelId).filter((id) => known.has(id));
        if (ids.length === 0) return;
        setOpenIds(ids);
        setActiveId(ids[0]);
      },
    });
  }, [panels, known, openPanelCompact]);

  useEffect(() => {
    setOpenPanelIds(visibleOpen);
  }, [visibleOpen]);

  useEffect(() => {
    store.load().catch(() => {});
    
  }, []);

  const Component = active?.component;
  if (!active || !Component) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 overflow-x-auto border-b border-panel-border bg-panel-bg">
        {panels
          .filter((panel) => visibleOpen.includes(panel.id))
          .map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActiveId(panel.id)}
              className={`whitespace-nowrap px-3.5 py-2.5 text-sm transition-colors ${
                panel.id === active.id
                  ? "border-b-2 border-white/40 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {panel.title}
            </button>
          ))}
      </div>
      <div className="min-h-0 flex-1">
        <Component />
      </div>
    </div>
  );
}

export function Dock({ staff }: { staff: StaffContext }) {
  const mode = useUiMode();
  const isDesktop = useIsDesktop();
  const apiRef = useRef<DockviewApi | null>(null);
  const panels = useMemo(() => visiblePanels(staff), [staff]);
  const store = useLayoutStore();

  const activeNameRef = useRef(store.activeName);
  activeNameRef.current = store.activeName;

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressPersist = useRef(false);

  const buildPreset = useCallback(
    (presetId: string) => {
      const api = apiRef.current;
      if (!api) return;

      const preset = presetById(presetId) ?? BUILT_IN_PRESETS[0];
      const spec = preset.build(panels);
      if (spec.length === 0) return;

      suppressPersist.current = true;
      api.clear();

      for (const entry of spec) {
        const definition = PANEL_MAP.get(entry.panelId);
        if (!definition) continue;

        const panel = api.addPanel({
          id: entry.panelId,
          component: entry.panelId,
          title: definition.title,
          position: entry.position?.referencePanel
            ? { referencePanel: entry.position.referencePanel, direction: entry.position.direction }
            : undefined,
        });

        if (entry.width && panel.group) panel.group.api.setSize({ width: entry.width });
      }

      suppressPersist.current = false;
    },
    [panels]
  );

  const applySavedLayout = useCallback((layout: SerializedLayout) => {
    const api = apiRef.current;
    if (!api) return false;

    suppressPersist.current = true;
    try {
      api.fromJSON(layout as never);
      return true;
    } catch {
      return false;
    } finally {
      suppressPersist.current = false;
    }
  }, []);

  const restore = useCallback(
    (saved: SavedLayout | null) => {
      if (!saved) {
        buildPreset(DEFAULT_PRESET_ID);
        return;
      }

      const { layout, removedPanels } = pruneLayout(saved.layout, saved.schemaVersion);
      if (removedPanels.length > 0) {
        store.notePrune(saved.name, removedPanels);
      }

      if (!layout || !applySavedLayout(layout)) {
        buildPreset(DEFAULT_PRESET_ID);
        return;
      }

      store.setActiveName(saved.name);
    },
    [applySavedLayout, buildPreset, store]
  );

  const openPanelInDock = useCallback((request: PanelRequest) => {
    const api = apiRef.current;
    if (!api) return;
    const definition = PANEL_MAP.get(request.panelId);
    if (!definition) return;

    const existing = api.getPanel(request.panelId);
    if (existing) {
      existing.api.setActive();
      return;
    }

    api.addPanel({
      id: request.panelId,
      component: request.panelId,
      title: request.title || definition.title,
      params: request.params,
      position: request.position?.referencePanel
        ? { referencePanel: request.position.referencePanel, direction: request.position.direction }
        : undefined,
    });
  }, []);

  const persist = useCallback(
    (attempt = 0) => {
      const api = apiRef.current;
      if (!api) return;

      const name = activeNameRef.current;
      if (!name) return;

      let layout: SerializedLayout;
      try {
        layout = api.toJSON() as unknown as SerializedLayout;
      } catch {
        return;
      }

      if (!layout?.panels || Object.keys(layout.panels).length === 0) return;

      store.noteSaving();
      saveLayout(name, layout)
        .then(() => {
          retryTimer.current = null;
          store.noteSaved();
        })
        .catch((err: Error) => {
          store.noteError(err.message);

          if (attempt >= PERSIST_MAX_RETRIES) return;

          const delay = PERSIST_RETRY_BASE_MS * 2 ** attempt;
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            persist(attempt + 1);
          }, delay);
        });
    },
    [store]
  );

  const schedulePersist = useCallback(() => {
    if (suppressPersist.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      persist();
    }, PERSIST_DEBOUNCE_MS);
  }, [persist]);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api;

      event.api.onDidLayoutChange(() => {
        setOpenPanelIds(event.api.panels.map((panel) => panel.id));
        schedulePersist();
      });

      store
        .load()
        .then((defaultLayout) => restore(defaultLayout))
        .catch(() => buildPreset(DEFAULT_PRESET_ID));
    },
    [buildPreset, restore, schedulePersist, store]
  );

  useEffect(() => {
    if (!isDesktop) return;

    return registerPanelHost({
      open: openPanelInDock,
      focus: (panelId) => apiRef.current?.getPanel(panelId)?.api.setActive(),
      close: (panelId) => {
        const panel = apiRef.current?.getPanel(panelId);
        if (panel) apiRef.current?.removePanel(panel);
      },
      serialize: () => (apiRef.current?.toJSON() ?? null) as SerializedLayout | null,
      applyLayout: applySavedLayout,
      applyPreset: buildPreset,
    });
  }, [isDesktop, openPanelInDock, applySavedLayout, buildPreset]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  if (!isDesktop) return <CompactShell panels={panels} />;

  return (
    <DockviewReact
      className="h-full"
      theme={SOCIALLY_THEME}
      components={components}
      onReady={onReady}
      locked={mode === "simple"}
      disableDnd={mode === "simple"}
      disableFloatingGroups={mode === "simple"}
    />
  );
}

export { openPanel };
