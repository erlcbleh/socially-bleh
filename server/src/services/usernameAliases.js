export const USERNAME_ALIASES = {
  noahtarp: "noah",
};

export function resolveUsernameAlias(username) {
  const key = String(username || "").trim().toLowerCase();
  const target = USERNAME_ALIASES[key];
  return target && target !== key ? target : null;
}

export function hasUsernameAlias(username) {
  return resolveUsernameAlias(username) !== null;
}
