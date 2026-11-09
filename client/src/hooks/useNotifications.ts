import { useQuery, useMutation, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import { useCommunitySlug, useNavCommunitySlug } from "./useCommunitySlug";
import type { Notification } from "../types";

export function useUnreadCount() {
  const slug = useNavCommunitySlug();
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<{ count: number }>(`/communities/${slug}/notifications/unread-count`),
    refetchInterval: 60_000,
    enabled: !!slug,
  });
}

export function useNotificationsList() {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api.get<{ notifications: Notification[] }>(`/communities/${slug}/notifications`),
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/communities/${slug}/notifications/read-all`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    suppressErrorReport: true,
  });
}
