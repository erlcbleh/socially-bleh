export const USERNAME_ALIASES: Record<string, string> = {
  noahtarp: "noah",
};

export function resolveUsernameAlias(username: string): string | null {
  const key = String(username || "").trim().toLowerCase();
  const target = USERNAME_ALIASES[key];
  return target && target !== key ? target : null;
}
