import type { ComponentType } from "react";
import { ReportsFeed } from "./ReportsFeed";
import { ReportWorkspace } from "./ReportWorkspace";
import { IpBans } from "./IpBans";
import { SecurityFlags } from "./SecurityFlags";
import { AuditLog } from "./AuditLog";
import { StaffSessions } from "./StaffSessions";
import { UserSearch } from "./UserSearch";
import { UserDossier } from "./UserDossier";
import { VerificationQueue } from "./VerificationQueue";
import { StaffApplications } from "./StaffApplications";
import { BusinessApplications } from "./BusinessApplications";
import { BusinessAccounts } from "./BusinessAccounts";
import { CopyrightQueue } from "./CopyrightQueue";
import { StaffRoles } from "./StaffRoles";
import { Overview } from "./Overview";
import { StaffActivity } from "./StaffActivity";
import { AiCategories, AiFalsePositives, AiStuckQueue } from "./AiModeration";
import { Notes } from "./Notes";
import { SavedSearches } from "./SavedSearches";
import { ModerationHistory } from "./ModerationHistory";
import { EmailSupport } from "./EmailSupport";
import { Communities } from "./Communities";

export type PanelScope = "global" | "community";
export type PanelGroup =
  | "Moderation"
  | "Applications"
  | "Governance"
  | "Security"
  | "People"
  | "Overview"
  | "AI"
  | "Support"
  | "Workspace";

export type PanelRequirement = "privateData" | "auditLog" | "manageRoles" | "manageApplications";

export interface PanelDefinition {
  id: string;
  title: string;
  group: PanelGroup;
  scope: PanelScope;
  requires?: PanelRequirement;
  component: ComponentType<Record<string, unknown>>;
}

const as = (component: ComponentType<never>) => component as unknown as ComponentType<Record<string, unknown>>;

export const PANELS: PanelDefinition[] = [
  { id: "overview", title: "Overview", group: "Overview", scope: "global", component: as(Overview) },

  { id: "reports.feed", title: "Live Reports", group: "Moderation", scope: "global", component: as(ReportsFeed) },
  { id: "reports.workspace", title: "Report Workspace", group: "Moderation", scope: "global", component: as(ReportWorkspace) },
  { id: "users.search", title: "User Search", group: "People", scope: "global", component: as(UserSearch) },
  { id: "users.dossier", title: "User Dossier", group: "People", scope: "global", component: as(UserDossier) },
  { id: "verification.queue", title: "Verification Queue", group: "Applications", scope: "global", component: as(VerificationQueue) },
  { id: "governance.staffApplications", title: "Staff Applications", group: "Applications", scope: "global", requires: "manageApplications", component: as(StaffApplications) },
  { id: "applications.business", title: "Business Applications", group: "Applications", scope: "global", requires: "manageApplications", component: as(BusinessApplications) },
  { id: "applications.businessAccounts", title: "Business Accounts", group: "Applications", scope: "global", requires: "manageApplications", component: as(BusinessAccounts) },
  { id: "people.communities", title: "Communities", group: "People", scope: "global", requires: "manageApplications", component: as(Communities) },
  { id: "moderation.history", title: "Moderation History", group: "Moderation", scope: "global", component: as(ModerationHistory) },

  { id: "security.ipBans", title: "Network Bans", group: "Security", scope: "global", requires: "privateData", component: as(IpBans) },
  { id: "security.flags", title: "Security Flags", group: "Security", scope: "global", requires: "privateData", component: as(SecurityFlags) },

  { id: "governance.auditLog", title: "Audit Log", group: "Governance", scope: "global", requires: "auditLog", component: as(AuditLog) },
  { id: "governance.staffSessions", title: "Staff Sessions", group: "Governance", scope: "global", requires: "privateData", component: as(StaffSessions) },
  { id: "governance.copyright", title: "Copyright Queue", group: "Governance", scope: "global", requires: "auditLog", component: as(CopyrightQueue) },
  { id: "governance.staffRoles", title: "Staff Roles", group: "Governance", scope: "global", requires: "manageRoles", component: as(StaffRoles) },
  { id: "governance.staffActivity", title: "Staff Activity", group: "Governance", scope: "global", requires: "auditLog", component: as(StaffActivity) },

  { id: "ai.categories", title: "AI Categories", group: "AI", scope: "global", component: as(AiCategories) },
  { id: "ai.falsePositives", title: "AI False Positives", group: "AI", scope: "global", component: as(AiFalsePositives) },
  { id: "ai.stuck", title: "AI Retry Backlog", group: "AI", scope: "global", component: as(AiStuckQueue) },

  { id: "support.email", title: "Email Support", group: "Support", scope: "global", requires: "manageRoles", component: as(EmailSupport) },

  { id: "workspace.notes", title: "Notes", group: "Workspace", scope: "global", component: as(Notes) },
  { id: "workspace.savedSearches", title: "Saved Searches", group: "Workspace", scope: "global", component: as(SavedSearches) },
];

export const PANEL_MAP = new Map(PANELS.map((panel) => [panel.id, panel]));

export function isKnownPanel(id: string): boolean {
  return PANEL_MAP.has(id);
}

type PanelViewer = { isGlobalStaff: boolean; isAdmin: boolean; canViewPrivateData: boolean };

export function visiblePanels(staff: PanelViewer): PanelDefinition[] {
  const granted: Record<PanelRequirement, boolean> = {
    privateData: staff.canViewPrivateData,
    auditLog: staff.isAdmin,
    manageRoles: staff.isAdmin,
    manageApplications: staff.isAdmin,
  };

  return PANELS.filter((panel) => {
    if (panel.scope === "global" && !staff.isGlobalStaff) return false;
    return panel.requires ? granted[panel.requires] : true;
  });
}
