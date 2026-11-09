export const GLOBAL_SLUG = "global";

export function isGlobalSlug(slug: string | undefined): boolean {
  return !slug || slug === GLOBAL_SLUG;
}

export function communityPath(slug: string | undefined, sub = ""): string {
  const base = isGlobalSlug(slug) ? "" : `/c/${slug}`;
  const tail = sub ? `/${sub}` : "";
  return `${base}${tail}` || "/";
}

export function profilePath(username: string): string {
  return `/@${username}`;
}

export function communitySettingsPath(slug: string | undefined, sub = ""): string {
  const tail = sub ? `/${sub}` : "";
  return `/c/${slug || GLOBAL_SLUG}/settings${tail}`;
}
