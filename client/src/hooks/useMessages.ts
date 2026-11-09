import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import { useRealtimeTyping } from "../lib/realtime";
import { useCommunitySlug, useNavCommunitySlug } from "./useCommunitySlug";
import { useMessagePages } from "./useMessagePages";
import type { ConversationSummary, GroupConversation, Message, User } from "../types";

interface ConversationPage {
  conversations: ConversationSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}

export function useConversations() {
  const slug = useCommunitySlug();
  const [extraPageState, setExtraPageState] = useState<{
    community: string;
    firstPageSignature: string | null;
    pages: ConversationPage[];
  }>({ community: "", firstPageSignature: null, pages: [] });
  useEffect(() => {
    setExtraPageState({
      community: slug,
      firstPageSignature: null,
      pages: [],
    });
  }, [slug]);

  const path = `/communities/${slug}/messages/conversations`;
  const firstPage = useQuery({
    queryKey: ["messages", "conversations", slug],
    queryFn: () => api.get<ConversationPage>(path),
    refetchInterval: 60_000,
  });
  const firstPageSignature = firstPage.data
    ? JSON.stringify([
        firstPage.data.nextCursor,
        firstPage.data.conversations.map((conversation) => conversation.id),
      ])
    : null;
  useEffect(() => {
    if (firstPageSignature === null) return;

    setExtraPageState((current) => {
      if (
        current.community === slug &&
        current.firstPageSignature === firstPageSignature
      ) {
        return current;
      }
      return {
        community: slug,
        firstPageSignature,
        pages: [],
      };
    });
  }, [firstPageSignature, slug]);

  const loadMoreMutation = useMutation({
    mutationFn: ({
      cursor,
    }: {
      cursor: string;
      community: string;
      firstPageSignature: string | null;
    }) =>
      api.get<ConversationPage>(`${path}?cursor=${encodeURIComponent(cursor)}`),
    onSuccess: (page, request) => {
      if (
        request.community !== slug ||
        request.firstPageSignature !== firstPageSignature
      ) {
        return;
      }
      setExtraPageState((current) => ({
        community: request.community,
        firstPageSignature: request.firstPageSignature,
        pages:
          current.community === request.community &&
          current.firstPageSignature === request.firstPageSignature
            ? [...current.pages, page]
            : [page],
      }));
    },
  });

  const extraPages =
    extraPageState.community === slug &&
    extraPageState.firstPageSignature === firstPageSignature
      ? extraPageState.pages
      : [];
  const tailPage = extraPages.at(-1) ?? firstPage.data;
  const seenConversationIds = new Set<string>();
  const conversations = [
    ...(firstPage.data?.conversations ?? []),
    ...extraPages.flatMap((page) => page.conversations),
  ].filter((conversation) => {
    if (seenConversationIds.has(conversation.id)) return false;
    seenConversationIds.add(conversation.id);
    return true;
  });
  const data = firstPage.data
    ? {
        ...firstPage.data,
        conversations,
        hasMore: tailPage?.hasMore ?? false,
        nextCursor: tailPage?.nextCursor ?? null,
      }
    : undefined;

  return {
    ...firstPage,
    data,
    loadMore: () => {
      if (
        tailPage?.hasMore &&
        tailPage.nextCursor &&
        !loadMoreMutation.isPending
      ) {
        loadMoreMutation.mutate({
          cursor: tailPage.nextCursor,
          community: slug,
          firstPageSignature,
        });
      }
    },
    isLoadingMore: loadMoreMutation.isPending,
    loadMoreError: loadMoreMutation.error,
  };
}

export function useMessagesUnreadCount() {
  const slug = useNavCommunitySlug();
  return useQuery({
    queryKey: ["messages", "unread-count", slug],
    queryFn: () => api.get<{ count: number }>(`/communities/${slug}/messages/unread-count`),
    refetchInterval: 60_000,
    enabled: !!slug,
  });
}

export function useConversation(username: string | undefined) {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["messages", "conversation", username, slug],
    queryFn: () =>
      api.get<{ id: string | null; otherUser: ConversationSummary["otherUser"]; blockedByOther?: boolean }>(
        `/communities/${slug}/messages/conversations/${username}`
      ),
    enabled: !!username,
  });
}

export function useConversationMessages(username: string | undefined) {
  const slug = useCommunitySlug();
  return useMessagePages({
    queryKey: ["messages", "thread", username, slug],
    identity: `${slug}:dm:${username || ""}`,
    path: `/communities/${slug}/messages/conversations/${username}/messages`,
    enabled: !!username,
  });
}

export function useReportMessage() {
  const slug = useCommunitySlug();
  return useMutation({
    mutationFn: ({ id, reason, details }: { id: string; reason: string; details?: string }) =>
      api.post(`/communities/${slug}/messages/${id}/report`, { reason, details }),
  });
}

export function useSendMessage(username: string | undefined) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; postId?: string; mediaUrl?: string; gifUrl?: string }) =>
      api.post<{ message: Message }>(`/communities/${slug}/messages/conversations/${username}/messages`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", username] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversation", username] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useMutualFriends(query: string, enabled = true) {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["users", "mutual-friends", query, slug],
    queryFn: () => api.get<{ users: User[] }>(`/users/mutual-friends?q=${encodeURIComponent(query)}`),
    enabled,
  });
}

export function useCreateGroup() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { usernames: string[]; name?: string }) =>
      api.post<{ group: GroupConversation }>(`/communities/${slug}/messages/groups`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] }),
  });
}

export function useGroup(groupId: string | undefined) {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["messages", "group", groupId, slug],
    queryFn: () => api.get<{ group: GroupConversation }>(`/communities/${slug}/messages/groups/${groupId}`),
    enabled: !!groupId,
  });
}

export function useGroupMessages(groupId: string | undefined) {
  const slug = useCommunitySlug();
  return useMessagePages({
    queryKey: ["messages", "group-thread", groupId, slug],
    identity: `${slug}:group:${groupId || ""}`,
    path: `/communities/${slug}/messages/groups/${groupId}/messages`,
    enabled: !!groupId,
  });
}

export function useSendGroupMessage(groupId: string | undefined) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; postId?: string; mediaUrl?: string; gifUrl?: string }) =>
      api.post<{ message: Message }>(`/communities/${slug}/messages/groups/${groupId}/messages`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "group-thread", groupId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useAddGroupMember(groupId: string | undefined) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => api.post<{ group: GroupConversation }>(`/communities/${slug}/messages/groups/${groupId}/members`, { username }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useRemoveGroupMember(groupId: string | undefined) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => api.post(`/communities/${slug}/messages/groups/${groupId}/members/${username}/remove`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useUpdateGroup(groupId: string | undefined) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string }) => api.patch<{ group: GroupConversation }>(`/communities/${slug}/messages/groups/${groupId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useSharePost() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, content, postId }: { username: string; content: string; postId: string }) =>
      api.post<{ message: Message }>(`/communities/${slug}/messages/conversations/${username}/messages`, { content, postId }),
    onSuccess: (_data, { username }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", username] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversation", username] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useEditMessage(
  threadKey: unknown[],
  updateMessage?: (id: string, patch: Partial<Message>) => void
) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch<{ message: Pick<Message, "id" | "content" | "editedAt"> }>(
        `/communities/${slug}/messages/${id}`,
        { content }
      ),
    onSuccess: ({ message }) => {
      updateMessage?.(message.id, message);
      queryClient.invalidateQueries({ queryKey: threadKey });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useDeleteMessage(
  threadKey: unknown[],
  updateMessage?: (id: string, patch: Partial<Message>) => void
) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/communities/${slug}/messages/${id}`),
    onSuccess: (_data, id) => {
      updateMessage?.(id, {
        content: "",
        deleted: true,
        gifUrl: null,
        mediaUrl: null,
        reactions: [],
        sharedPost: null,
        sharedStory: null,
        status: undefined,
      });
      queryClient.invalidateQueries({ queryKey: threadKey });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}

export function useReactToMessage(
  threadKey: unknown[],
  updateMessage?: (id: string, patch: Partial<Message>) => void
) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      api.post<{ reactions: NonNullable<Message["reactions"]> }>(
        `/communities/${slug}/messages/${id}/react`,
        { emoji }
      ),
    onSuccess: ({ reactions }, { id }) => {
      updateMessage?.(id, { reactions });
      queryClient.invalidateQueries({ queryKey: threadKey });
    },
  });
}

export function useTyping(username: string | undefined) {
  const slug = useCommunitySlug();
  return { data: useRealtimeTyping(slug, "dm", username) };
}

export function useGroupTyping(groupId: string | undefined) {
  const slug = useCommunitySlug();
  return { data: useRealtimeTyping(slug, "group", groupId) };
}

export function useTypingHeartbeat(path: string | null) {
  const slug = useCommunitySlug();
  const lastSentRef = useRef(0);

  return useCallback(() => {
    if (!path) return;
    const now = Date.now();
    if (now - lastSentRef.current < 3_000) return;
    lastSentRef.current = now;
    api.post(`/communities/${slug}/messages/${path}/typing`).catch(() => {});
  }, [slug, path]);
}
