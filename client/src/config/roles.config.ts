export type Permission =
  | "access_staff_panel"
  | "manage_roles"
  | "view_private_data"
  | "view_audit_log"
  | "manage_copyright"
  | "manage_applications"
  | "delete_posts"
  | "moderate_users";

export interface RoleDef {
  name: string;
  permissions: Permission[];
}

export const ROLE_LEVEL: Record<string, number> = {
  user: 0,
  official: 0,
  staff: 1,
  admin: 2,
  developer: 3,
  owner: 4,
};

const MODERATION: Permission[] = ["access_staff_panel", "moderate_users", "delete_posts"];

const ELEVATED: Permission[] = [
  ...MODERATION,
  "view_private_data",
  "view_audit_log",
  "manage_copyright",
  "manage_applications",
  "manage_roles",
];

export const ROLES: Record<string, RoleDef> = {
  owner: { name: "Owner", permissions: ELEVATED },
  developer: { name: "Developer", permissions: ELEVATED },
  admin: { name: "Admin", permissions: ELEVATED },
  staff: { name: "Staff", permissions: MODERATION },
  official: { name: "Official", permissions: [] },
  user: { name: "User", permissions: [] },
};

export function roleLevel(role: string | undefined | null): number {
  return ROLE_LEVEL[role ?? ""] ?? 0;
}

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  return Boolean(ROLES[role ?? ""]?.permissions.includes(permission));
}
