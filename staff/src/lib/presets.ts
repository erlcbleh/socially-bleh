import type { PanelDefinition } from "../panels/registry";

export interface BuiltInPreset {
  id: string;
  name: string;
  description: string;
  build: (available: PanelDefinition[]) => PresetPanel[];
}

export interface PresetPanel {
  panelId: string;
  position?: { referencePanel: string; direction: "left" | "right" | "above" | "below" | "within" };
  width?: number;
}

function has(available: PanelDefinition[], id: string) {
  return available.some((panel) => panel.id === id);
}

function build(available: PanelDefinition[], steps: PresetPanel[]): PresetPanel[] {
  const panels: PresetPanel[] = [];
  const placed = new Set<string>();

  for (const step of steps) {
    if (!has(available, step.panelId)) continue;

    if (step.position && !placed.has(step.position.referencePanel)) {
      panels.push({ panelId: step.panelId, width: step.width });
    } else {
      panels.push(step);
    }
    placed.add(step.panelId);
  }

  return panels;
}

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    id: "default",
    name: "Default",
    description: "Report workspace and dossier.",
    build: (available) =>
      build(available, [
        { panelId: "reports.workspace" },
        {
          panelId: "users.dossier",
          position: { referencePanel: "reports.workspace", direction: "right" },
        },
      ]),
  },
  {
    id: "triage",
    name: "Triage",
    description: "Workspace and dossier side by side.",
    build: (available) =>
      build(available, [
        { panelId: "reports.workspace" },
        {
          panelId: "users.dossier",
          position: { referencePanel: "reports.workspace", direction: "right" },
        },
      ]),
  },
  {
    id: "security",
    name: "Security",
    description: "Security flags over network bans.",
    build: (available) =>
      build(available, [
        { panelId: "security.flags", width: 520 },
        {
          panelId: "security.ipBans",
          position: { referencePanel: "security.flags", direction: "below" },
        },
        {
          panelId: "users.dossier",
          position: { referencePanel: "security.flags", direction: "right" },
        },
      ]),
  },
  {
    id: "governance",
    name: "Governance",
    description: "Audit log with the review queues beside it.",
    build: (available) =>
      build(available, [
        { panelId: "governance.auditLog", width: 560 },
        {
          panelId: "governance.staffApplications",
          position: { referencePanel: "governance.auditLog", direction: "right" },
        },
        {
          panelId: "applications.business",
          position: { referencePanel: "governance.staffApplications", direction: "within" },
        },
        {
          panelId: "governance.copyright",
          position: { referencePanel: "governance.staffApplications", direction: "within" },
        },
        {
          panelId: "governance.staffSessions",
          position: { referencePanel: "governance.staffApplications", direction: "within" },
        },
        {
          panelId: "governance.staffRoles",
          position: { referencePanel: "governance.staffApplications", direction: "within" },
        },
      ]),
  },
  {
    id: "queues",
    name: "Queues",
    description: "Every application queue as tabs, with copyright and live reports.",
    build: (available) =>
      build(available, [
        { panelId: "verification.queue", width: 460 },
        {
          panelId: "governance.staffApplications",
          position: { referencePanel: "verification.queue", direction: "within" },
        },
        {
          panelId: "applications.business",
          position: { referencePanel: "verification.queue", direction: "within" },
        },
        {
          panelId: "governance.copyright",
          position: { referencePanel: "verification.queue", direction: "below" },
        },
        {
          panelId: "reports.feed",
          position: { referencePanel: "verification.queue", direction: "right" },
        },
      ]),
  },
  {
    id: "people",
    name: "People",
    description: "Search accounts with the dossier beside it.",
    build: (available) =>
      build(available, [
        { panelId: "users.search", width: 360 },
        {
          panelId: "users.dossier",
          position: { referencePanel: "users.search", direction: "right" },
        },
      ]),
  },
  {
    id: "single",
    name: "Single panel",
    description: "Report workspace only.",
    build: (available) =>
      has(available, "reports.workspace") ? [{ panelId: "reports.workspace" }] : [],
  },
];

export const DEFAULT_PRESET_ID = "default";

export function presetById(id: string): BuiltInPreset | undefined {
  return BUILT_IN_PRESETS.find((preset) => preset.id === id);
}
