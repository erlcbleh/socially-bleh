import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import type { MutualsSummary, Post, User } from "../types";
import { useNavCommunitySlug } from "./useCommunitySlug";

interface RelationshipPage {
  users: User[];
  hidden?: boolean;
  hasMore: boolean;
  nextCursor: string | null;
}

export function useProfile(username: string | undefined) {
  return useQuery({
    queryKey: ["profile", username],
    queryFn: () => api.get<{ user: User }>(`/users/${username}`),
    enabled: !!username,
  });
}

export function useMutuals(username: string | undefined, limit?: number) {
  return useQuery({
    queryKey: ["profileMutuals", username, limit ?? null],
    queryFn: () =>
      api.get<MutualsSummary>(`/users/${username}/mutuals${limit ? `?limit=${limit}` : ""}`),
    enabled: !!username,
  });
}

export function useProfilePosts(username: string | undefined) {
  const slug = useNavCommunitySlug();
  return useQuery({
    queryKey: ["profilePosts", username, slug],
    queryFn: () => api.get<{ posts: Post[] }>(`/users/${username}/posts${slug ? `?community=${slug}` : ""}`),
    enabled: !!username,
  });
}

export function useProfileReplies(username: string | undefined) {
  const slug = useNavCommunitySlug();
  return useQuery({
    queryKey: ["profileReplies", username, slug],
    queryFn: () => api.get<{ posts: Post[] }>(`/users/${username}/replies${slug ? `?community=${slug}` : ""}`),
    enabled: !!username,
  });
}

export function useProfileMentions(username: string | undefined) {
  const slug = useNavCommunitySlug();
  return useQuery({
    queryKey: ["profileMentions", username, slug],
    queryFn: () => api.get<{ posts: Post[] }>(`/users/${username}/mentions${slug ? `?community=${slug}` : ""}`),
    enabled: !!username,
  });
}

function useInvalidateProfile(username: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["profile", username] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  };
}

export function useFollowMutation(username: string) {
  const invalidate = useInvalidateProfile(username);
  return useMutation({
    mutationFn: (following: boolean) =>
      api.post<{ user: User }>(`/users/${username}/${following ? "unfollow" : "follow"}`),
    onSuccess: invalidate,
  });
}

export function useBlockMutation(username: string) {
  const invalidate = useInvalidateProfile(username);
  return useMutation({
    mutationFn: (blocked: boolean) =>
      api.post<{ user: User }>(`/users/${username}/${blocked ? "unblock" : "block"}`),
    onSuccess: invalidate,
  });
}

export function useMuteMutation(username: string) {
  const invalidate = useInvalidateProfile(username);
  return useMutation({
    mutationFn: (muted: boolean) =>
      api.post<{ user: User }>(`/users/${username}/${muted ? "unmute" : "mute"}`),
    onSuccess: invalidate,
  });
}

export function useReportUser() {
  return useMutation({
    mutationFn: ({ username, reason, details }: { username: string; reason: string; details?: string }) =>
      api.post(`/users/${username}/report`, { reason, details }),
  });
}

function useRelationshipList(username: string | undefined, kind: "followers" | "following") {
  const scope = `${kind}\n${username || ""}`;
  const path = `/users/${username}/${kind}`;
  const [extraPageState, setExtraPageState] = useState<{ scope: string; pages: RelationshipPage[] }>({
    scope: "",
    pages: [],
  });
  const firstPage = useQuery({
    queryKey: [kind, username],
    queryFn: () => api.get<RelationshipPage>(path),
    enabled: !!username,
  });
  const loadMoreMutation = useMutation({
    mutationFn: ({ cursor }: { cursor: string; scope: string }) =>
      api.get<RelationshipPage>(`${path}?cursor=${encodeURIComponent(cursor)}`),
    onSuccess: (page, request) => {
      if (request.scope !== scope) return;
      setExtraPageState((current) => ({
        scope: request.scope,
        pages: current.scope === request.scope ? [...current.pages, page] : [page],
      }));
    },
  });

  const extraPages =
    extraPageState.scope === scope && !firstPage.data?.hidden ? extraPageState.pages : [];
  const tailPage = extraPages.at(-1) ?? firstPage.data;
  const seenUserIds = new Set<string>();
  const users = [...(firstPage.data?.users ?? []), ...extraPages.flatMap((page) => page.users)].filter((user) => {
    if (seenUserIds.has(user.id)) return false;
    seenUserIds.add(user.id);
    return true;
  });
  const data = firstPage.data
    ? {
        ...firstPage.data,
        users,
        hasMore: tailPage?.hasMore ?? false,
        nextCursor: tailPage?.nextCursor ?? null,
      }
    : undefined;

  return {
    ...firstPage,
    data,
    loadMore: () => {
      if (tailPage?.hasMore && tailPage.nextCursor && !loadMoreMutation.isPending) {
        loadMoreMutation.mutate({ cursor: tailPage.nextCursor, scope });
      }
    },
    isLoadingMore: loadMoreMutation.isPending,
    loadMoreError: loadMoreMutation.error,
  };
}

export function useFollowers(username: string | undefined) {
  return useRelationshipList(username, "followers");
}

export function useFollowing(username: string | undefined) {
  return useRelationshipList(username, "following");
}
