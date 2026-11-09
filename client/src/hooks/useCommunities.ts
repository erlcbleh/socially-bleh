import { useMutation, useQuery, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import type { Community, DiscoverableCommunity, InvitePreview } from "../types";

export function useMyCommunities(enabled = true) {
  return useQuery({
    queryKey: ["communities", "mine"],
    queryFn: () => api.get<{ communities: Community[] }>("/communities/mine"),
    enabled,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; logoUrl?: string }) =>
      api.post<{ community: Community }>("/communities", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<{ community: Community }>("/communities/join", { code }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useDiscoverCommunities(q: string) {
  return useQuery({
    queryKey: ["communities", "discover", q],
    queryFn: () =>
      api.get<{ communities: DiscoverableCommunity[] }>(`/communities/discover${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
}

export function useJoinOpenCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.post<{ community: Community }>(`/communities/${slug}/join`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: ["invite", code],
    queryFn: () => api.get<{ community: InvitePreview }>(`/communities/invite/${encodeURIComponent(code)}`),
    enabled: !!code,
  });
}
