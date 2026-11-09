import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import { useCommunitySlug } from "./useCommunitySlug";
import type { Message, Story, StoryGroup, User } from "../types";

interface StoryFeedPage {
  groups: StoryGroup[];
  hasMore?: boolean;
  nextCursor?: string | null;
  truncated?: boolean;
}

function mergeStoryGroups(pages: StoryFeedPage[], selfId?: string) {
  const byAuthor = new Map<string, StoryGroup>();
  for (const page of pages) {
    for (const group of page.groups) byAuthor.set(group.author.id, group);
  }
  return [...byAuthor.values()].sort((a, b) => {
    if (a.author.id === selfId) return -1;
    if (b.author.id === selfId) return 1;
    if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
    return 0;
  });
}

export function useStoryFeed(selfId?: string) {
  const slug = useCommunitySlug();
  const firstPage = useQuery({
    queryKey: ["stories", "feed", slug],
    queryFn: () => api.get<StoryFeedPage>(`/communities/${slug}/stories/feed`),
    enabled: !!selfId,
  });
  const firstPageSignature = firstPage.data
    ? JSON.stringify([
        firstPage.data.nextCursor,
        firstPage.data.groups.map((group) => group.author.id),
      ])
    : null;
  const [extraPageState, setExtraPageState] = useState<{
    community: string;
    firstPageSignature: string | null;
    pages: StoryFeedPage[];
  }>({ community: "", firstPageSignature: null, pages: [] });
  const loadMore = useMutation({
    mutationFn: ({
      cursor,
      community,
    }: {
      cursor: string;
      community: string;
      firstPageSignature: string | null;
    }) =>
      api.get<StoryFeedPage>(`/communities/${community}/stories/feed?cursor=${encodeURIComponent(cursor)}`),
    onSuccess: (page, request) => {
      if (request.community !== slug || request.firstPageSignature !== firstPageSignature) return;
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

  useEffect(() => {
    if (firstPageSignature === null) return;
    setExtraPageState((current) => {
      if (
        current.community === slug &&
        current.firstPageSignature === firstPageSignature
      ) {
        return current;
      }
      return { community: slug, firstPageSignature, pages: [] };
    });
  }, [firstPageSignature, slug]);

  const extraPages =
    extraPageState.community === slug &&
    extraPageState.firstPageSignature === firstPageSignature
      ? extraPageState.pages
      : [];
  const pages = firstPage.data ? [firstPage.data, ...extraPages] : [];
  const tail = pages.at(-1);
  const data = useMemo<StoryFeedPage | undefined>(
    () =>
      firstPage.data
        ? {
            groups: mergeStoryGroups(pages, selfId),
            hasMore: tail?.hasMore ?? false,
            nextCursor: tail?.nextCursor ?? null,
            truncated: pages.some((page) => page.truncated),
          }
        : undefined,
    [firstPage.data, extraPages, selfId]
  );

  return {
    ...firstPage,
    data,
    loadMore: () => {
      if (tail?.hasMore && tail.nextCursor && !loadMore.isPending) {
        loadMore.mutate({
          cursor: tail.nextCursor,
          community: slug,
          firstPageSignature,
        });
      }
    },
    isLoadingMore: loadMore.isPending,
    loadMoreError: loadMore.error,
  };
}

export function useUserStories(username: string | undefined) {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["stories", "user", username, slug],
    queryFn: () => api.get<{ author: User; stories: Story[] }>(`/communities/${slug}/stories/user/${username}`),
    enabled: !!username,
  });
}

function useInvalidateStories() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["stories"] });
}

export function useCreateStory() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidateStories();
  return useMutation({
    mutationFn: (body: { mediaUrl: string; mediaType: "image" | "video"; caption?: string; durationHours?: number }) =>
      api.post<{ story: Story }>(`/communities/${slug}/stories`, body),
    onSuccess: invalidate,
  });
}

export function useViewStory() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidateStories();
  return useMutation({
    mutationFn: (id: string) => api.post(`/communities/${slug}/stories/${id}/view`),
    onSuccess: invalidate,
    suppressErrorReport: true,
  });
}

export function useDeleteStory() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidateStories();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/communities/${slug}/stories/${id}`),
    onSuccess: invalidate,
  });
}

export function useReplyToStory() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, content, storyId }: { username: string; content: string; storyId: string }) =>
      api.post<{ message: Message }>(`/communities/${slug}/messages/conversations/${username}/messages`, { content, storyId }),
    onSuccess: (_data, { username }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", username] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversation", username] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });
}
