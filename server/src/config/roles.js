export const OWNER_DISCORD_ID = "1269088910768734334";

export const ROLE_LEVEL = {
  user: 0,
  official: 0,
  staff: 1,
  admin: 2,
  developer: 3,
  owner: 4,
};

const MODERATION = ["access_staff_panel", "moderate_users", "delete_posts", "delete_messages", "view_discord_identity"];

const ELEVATED = [
  ...MODERATION,
  "view_private_data",
  "view_audit_log",
  "manage_copyright",
  "manage_applications",
  "manage_roles",
];

export const ROLES = {
  owner: { name: "Owner", permissions: ELEVATED },
  developer: { name: "Developer", permissions: ELEVATED },
  admin: { name: "Admin", permissions: ELEVATED },
  staff: { name: "Staff", permissions: MODERATION },
  official: { name: "Official", permissions: [] },
  user: { name: "User", permissions: [] },
};

export const ASSIGNABLE_ROLES = ["user", "staff", "admin", "developer"];

export function isOwnerDiscordId(discordId) {
  return Boolean(discordId) && String(discordId) === OWNER_DISCORD_ID;
}

export function effectiveRole(user) {
  if (isOwnerDiscordId(user?.discordId)) return "owner";
  return ROLES[user?.role] ? user.role : "user";
}

export function roleLevel(role) {
  return ROLE_LEVEL[role] ?? 0;
}

export function hasPermission(role, permission) {
  return Boolean(ROLES[role]?.permissions.includes(permission));
}

export function assignableRolesFor(actorRole) {
  if (!hasPermission(actorRole, "manage_roles")) return [];
  return ASSIGNABLE_ROLES.filter((role) => roleLevel(role) < roleLevel(actorRole));
}

export function canAssignRole(actorRole, currentRole, nextRole) {
  if (!ASSIGNABLE_ROLES.includes(nextRole)) return false;

  const actor = roleLevel(actorRole);
  return (
    hasPermission(actorRole, "manage_roles") && roleLevel(currentRole) < actor && roleLevel(nextRole) < actor
  );
}
