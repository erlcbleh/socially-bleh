import type { PanelDefinition } from "../panels/registry";

export interface SimpleTabPanel {
  panelId: string;
  sizeClass?: string;
  ownHeader?: boolean;
}

export interface SimpleTab {
  id: string;
  label: string;
  panels: SimpleTabPanel[];
}

const TABS: SimpleTab[] = [
  {
    id: "reports",
    label: "Reports",
    panels: [
      { panelId: "reports.feed", sizeClass: "lg:w-[440px] lg:flex-none" },
      { panelId: "reports.workspace", ownHeader: true },
    ],
  },
  { id: "verification", label: "Verification", panels: [{ panelId: "verification.queue" }] },
  {
    id: "users",
    label: "Users",
    panels: [
      { panelId: "users.search", sizeClass: "lg:w-[400px] lg:flex-none" },
      { panelId: "users.dossier" },
    ],
  },
  { id: "email", label: "Email", panels: [{ panelId: "support.email", ownHeader: true }] },
  { id: "copyright", label: "Copyright", panels: [{ panelId: "governance.copyright" }] },
  { id: "applications", label: "Applications", panels: [{ panelId: "governance.staffApplications" }] },
  { id: "business", label: "Business", panels: [{ panelId: "applications.business" }] },
  { id: "communities", label: "Communities", panels: [{ panelId: "people.communities" }] },
  { id: "staff", label: "Staff", panels: [{ panelId: "governance.staffRoles" }] },
  { id: "audit", label: "Audit log", panels: [{ panelId: "governance.auditLog" }] },
];

export function availableTabs(available: PanelDefinition[]): SimpleTab[] {
  const ids = new Set(available.map((panel) => panel.id));

  return TABS.map((tab) => ({
    ...tab,
    panels: tab.panels.filter((panel) => ids.has(panel.panelId)),
  })).filter((tab) => tab.panels.length > 0);
}

export function tabForPanel(tabs: SimpleTab[], panelId: string): SimpleTab | null {
  return tabs.find((tab) => tab.panels.some((panel) => panel.panelId === panelId)) ?? null;
}
