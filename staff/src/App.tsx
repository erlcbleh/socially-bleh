import { useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./lib/authContext";
import { Dock } from "./components/Dock";
import { LoginPage } from "./pages/LoginPage";
import { hydrateSelectionsFromUrl } from "./lib/selectionBus";
import {
  connectStaffRealtime,
  disconnectStaffRealtime,
  onLayoutPresetsChanged,
} from "./lib/realtime";
import { layoutStoreActions } from "./lib/layoutStore";
import { PruneNotice } from "./components/LayoutBar";
import { CommandPalette } from "./components/CommandPalette";
import { UserPeek } from "./components/UserPeek";
import { SettingsDialog } from "./components/SettingsDialog";
import { IconRail, RAIL_GROUPS } from "./components/IconRail";
import { PanelLauncher } from "./components/PanelLauncher";
import { SimpleShell } from "./components/SimpleShell";
import { TopBar } from "./components/TopBar";
import { ReportsFeed } from "./panels/ReportsFeed";
import { visiblePanels, type PanelGroup } from "./panels/registry";
import { useUiMode } from "./lib/uiMode";

const DIM_KEY = "socially-staff:dimmed";

function Workspace({ staff }: { staff: ReturnType<typeof useAuth>["staff"] }) {
  const mode = useUiMode();
  const [activeGroup, setActiveGroup] = useState<PanelGroup | null>(null);
  const [dimmed, setDimmed] = useState(() => localStorage.getItem(DIM_KEY) === "1");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(DIM_KEY, dimmed ? "1" : "0");
    document.documentElement.classList.toggle("dimmed", dimmed);
  }, [dimmed]);

  const availableGroups = useMemo(() => {
    if (!staff) return new Set<PanelGroup>();
    return new Set(visiblePanels(staff).map((panel) => panel.group));
  }, [staff]);

  if (!staff) return null;

  if (mode === "simple") {
    return (
      <div data-density="comfortable" className="flex h-full min-h-0 flex-col gap-3 p-4">
        <TopBar
          staff={staff}
          onOpenSettings={() => setSettingsOpen(true)}
          dimmed={dimmed}
          onToggleDimmed={() => setDimmed((value) => !value)}
        />
        <SimpleShell staff={staff} />

        <UserPeek />
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} staff={staff} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <IconRail
        available={availableGroups}
        active={activeGroup}
        onSelect={(group) => setActiveGroup((current) => (current === group ? null : group))}
        dimmed={dimmed}
        onToggleDimmed={() => setDimmed((value) => !value)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <TopBar staff={staff} onOpenSettings={() => setSettingsOpen(true)} />
        <PruneNotice />

        <div className="flex min-h-0 flex-1 gap-2">
          <aside className="flex w-[300px] shrink-0 flex-col gap-2 xl:w-[340px]">
            <PanelLauncher
              staff={staff}
              activeGroup={activeGroup}
              onClearGroup={() => setActiveGroup(null)}
            />

            <section
              aria-label="Live reports"
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-squircle border border-panel-border bg-panel-raised"
            >
              <ReportsFeed compact />
            </section>
          </aside>

          <main className="min-h-0 min-w-0 flex-1">
            <Dock staff={staff} />
          </main>
        </div>
      </div>

      <CommandPalette staff={staff} />
      <UserPeek />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} staff={staff} />
    </div>
  );
}

function Shell() {
  const { user, staff, isLoading } = useAuth();

  useEffect(() => {
    if (user) hydrateSelectionsFromUrl();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    connectStaffRealtime();
    return () => disconnectStaffRealtime();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onLayoutPresetsChanged(() => {
      layoutStoreActions.refresh().catch(() => {});
    });
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-panel-bg">
        <span className="text-sm text-neutral-500">Checking staff session…</span>
      </div>
    );
  }

  if (!user || !staff) return <LoginPage />;

  return <Workspace staff={staff} />;
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

export { RAIL_GROUPS };
