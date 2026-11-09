import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { GLOBAL_SLUG } from "../lib/communityPath";

const LAST_COMMUNITY_KEY = "socially-last-community";

function readLastCommunity(): string {
  try {
    return localStorage.getItem(LAST_COMMUNITY_KEY) || GLOBAL_SLUG;
  } catch {
    return GLOBAL_SLUG;
  }
}

export function useCommunitySlug(): string {
  const { communitySlug } = useParams<{ communitySlug: string }>();
  return communitySlug ?? GLOBAL_SLUG;
}

export function useOptionalCommunitySlug(): string | undefined {
  const { communitySlug } = useParams<{ communitySlug: string }>();
  return communitySlug;
}

const PROFILE_PATH = /^\/@[^/]+\/?$/;

export function useNavCommunitySlug(): string {
  const { communitySlug } = useParams<{ communitySlug: string }>();
  const { pathname } = useLocation();
  const isCommunityScoped = pathname.startsWith("/c/");
  const isGlobalTree =
    !isCommunityScoped &&
    !PROFILE_PATH.test(pathname) &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/staff");
  const resolved = communitySlug ?? (isGlobalTree ? GLOBAL_SLUG : undefined);

  useEffect(() => {
    if (!resolved) return;
    try {
      localStorage.setItem(LAST_COMMUNITY_KEY, resolved);
    } catch {
      return;
    }
  }, [resolved]);

  return resolved ?? readLastCommunity();
}
