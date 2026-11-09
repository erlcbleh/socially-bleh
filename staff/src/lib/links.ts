export const CLIENT_URL = (
  import.meta.env.VITE_CLIENT_URL || "https://socially.lol"
).replace(/\/+$/, "");

export function profileUrl(username?: string | null, communitySlug?: string | null): string | null {
  if (!username) return null;
  const handle = `@${String(username).replace(/^@/, "")}`;
  return communitySlug
    ? `${CLIENT_URL}/c/${communitySlug}/${handle}`
    : `${CLIENT_URL}/${handle}`;
}

export function postUrl(
  username?: string | null,
  postId?: string | null,
  communitySlug?: string | null
): string | null {
  if (!username || !postId) return null;
  const handle = `@${String(username).replace(/^@/, "")}`;
  return communitySlug
    ? `${CLIENT_URL}/c/${communitySlug}/${handle}/post/${postId}`
    : `${CLIENT_URL}/${handle}/post/${postId}`;
}
