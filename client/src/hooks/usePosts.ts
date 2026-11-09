import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import { useCommunitySlug, useNavCommunitySlug } from "./useCommunitySlug";
import type { Post, PollVoters } from "../types";

interface CommentPage {
  posts: Post[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface CommentHistory extends CommentPage {
  identity: string;
  initialized: boolean;
}

function emptyCommentHistory(identity: string): CommentHistory {
  return { identity, initialized: false, posts: [], hasMore: false, nextCursor: null };
}

function mergeCommentPages(current: Post[], incoming: Post[]) {
  const byId = new Map(current.map((post) => [post.id, post]));
  for (const post of incoming) byId.set(post.id, post);
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)
  );
}

interface FeedPage {
  posts: Post[];
  hasMore: boolean;
  nextCursor: string | null;
}

export function useFeed(mode: "forYou" | "following") {
  const slug = useCommunitySlug();
  const identity = `${slug}:${mode}`;
  const [older, setOlder] = useState<{ identity: string; pages: FeedPage[] }>({ identity, pages: [] });

  useEffect(() => {
    setOlder({ identity, pages: [] });
  }, [identity]);

  const firstPage = useQuery({
    queryKey: ["feed", mode, slug],
    queryFn: () => api.get<FeedPage>(`/communities/${slug}/posts?mode=${mode}`),
  });

  const loadMoreMutation = useMutation({
    mutationFn: ({ cursor }: { cursor: string; identity: string }) =>
      api.get<FeedPage>(`/communities/${slug}/posts?mode=${mode}&before=${encodeURIComponent(cursor)}`),
    onSuccess: (page, request) => {
      if (request.identity !== identity) return;
      setOlder((current) =>
        current.identity === identity ? { identity, pages: [...current.pages, page] } : { identity, pages: [page] }
      );
    },
  });

  const pages = older.identity === identity ? older.pages : [];
  const tail = pages.at(-1) ?? firstPage.data;

  const seen = new Set<string>();
  const posts = [...(firstPage.data?.posts ?? []), ...pages.flatMap((page) => page.posts)].filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });

  const cursor = tail?.hasMore ? tail.nextCursor : null;
  const pending = loadMoreMutation.isPending;
  const mutate = loadMoreMutation.mutate;

  const loadMore = useCallback(() => {
    if (!cursor || pending) return;
    mutate({ cursor, identity });
  }, [cursor, pending, mutate, identity]);

  return {
    ...firstPage,
    data: firstPage.data ? { ...firstPage.data, posts } : undefined,
    hasMore: tail?.hasMore ?? false,
    loadMore,
    isLoadingMore: loadMoreMutation.isPending,
  };
}

export function usePost(id: string | undefined) {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["post", id, slug],
    queryFn: () => api.get<{ post: Post }>(`/communities/${slug}/posts/${id}`),
    enabled: !!id,
  });
}

export function useComments(id: string | undefined) {
  const slug = useCommunitySlug();
  const enabled = !!id;
  const identity = `${slug}:${id ?? ""}`;
  const path = `/communities/${slug}/posts/${id}/comments`;
  const latest = useQuery({
    queryKey: ["post", id, "comments", slug],
    queryFn: () => api.get<CommentPage>(path),
    enabled,
  });
  const [history, setHistory] = useState<CommentHistory>(() => emptyCommentHistory(identity));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    setIsLoadingMore(false);
    setLoadMoreError(null);
    setHistory((current) => {
      if (!enabled || !latest.data) {
        return current.identity === identity ? current : emptyCommentHistory(identity);
      }
      return {
        identity,
        initialized: true,
        posts: mergeCommentPages([], latest.data.posts),
        hasMore: latest.data.hasMore,
        nextCursor: latest.data.nextCursor,
      };
    });
  }, [enabled, identity, latest.data]);

  const visibleHistory =
    history.identity === identity && history.initialized
      ? history
      : latest.data
        ? { identity, initialized: true, ...latest.data }
        : null;
  const nextCursor = visibleHistory?.nextCursor ?? null;
  const hasMore = visibleHistory?.hasMore ?? false;

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || !nextCursor || isLoadingMore) return;

    const requestId = ++requestIdRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await api.get<CommentPage>(`${path}?cursor=${encodeURIComponent(nextCursor)}`);
      if (requestIdRef.current !== requestId) return;

      setHistory((current) => {
        if (current.identity !== identity) return current;
        const currentPosts = current.initialized ? current.posts : latest.data?.posts ?? [];
        return {
          identity,
          initialized: true,
          posts: mergeCommentPages(currentPosts, page.posts),
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        };
      });
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setLoadMoreError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      if (requestIdRef.current === requestId) setIsLoadingMore(false);
    }
  }, [enabled, hasMore, identity, isLoadingMore, latest.data?.posts, nextCursor, path]);

  const data = useMemo<CommentPage | undefined>(
    () =>
      visibleHistory
        ? {
            posts: visibleHistory.posts,
            hasMore: visibleHistory.hasMore,
            nextCursor: visibleHistory.nextCursor,
          }
        : undefined,
    [visibleHistory]
  );

  return { ...latest, data, loadMore, isLoadingMore, loadMoreError };
}

function useInvalidatePosts() {
  const queryClient = useQueryClient();
  return (options?: { skipPost?: boolean }) => {
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    if (!options?.skipPost) queryClient.invalidateQueries({ queryKey: ["post"] });
    queryClient.invalidateQueries({ queryKey: ["profilePosts"] });
    queryClient.invalidateQueries({ queryKey: ["profileReplies"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
  };
}

export function useBookmarks() {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["bookmarks", slug],
    queryFn: () => api.get<{ posts: Post[] }>(`/communities/${slug}/posts/bookmarks`),
  });
}

export function useToggleBookmark() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, bookmarked }: { id: string; bookmarked: boolean }) =>
      api.post<{ post: Post }>(`/communities/${slug}/posts/${id}/${bookmarked ? "unbookmark" : "bookmark"}`),
    onSuccess: () => invalidate(),
  });
}

export function useCreatePost() {
  const slug = useNavCommunitySlug();
  const queryClient = useQueryClient();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (body: {
      content: string;
      gifUrl?: string;
      mediaUrl?: string;
      mediaType?: "image" | "video";
      parentPost?: string;
      quotedPost?: string;
      poll?: { options: string[]; durationMinutes: number; imageUrl?: string };
    }) => api.post<{ post: Post }>(`/communities/${slug}/posts`, body),
    onSuccess: (data, variables) => {
      const parentId = variables.parentPost;
      if (parentId) {
        queryClient.setQueryData<CommentPage>(["post", parentId, "comments", slug], (old) =>
          (old ? { ...old, posts: [...old.posts, data.post] } : old) as CommentPage
        );
        queryClient.setQueryData<{ post: Post }>(["post", parentId, slug], (old) =>
          (old ? { post: { ...old.post, commentsCount: old.post.commentsCount + 1 } } : old) as { post: Post }
        );
      }
      invalidate({ skipPost: !!parentId });
    },
  });
}

export function useVotePoll() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, optionIndex }: { id: string; optionIndex: number }) =>
      api.post<{ post: Post }>(`/communities/${slug}/posts/${id}/vote`, { optionIndex }),
    onSuccess: () => invalidate(),
  });
}

export function useRemovePollVote() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ post: Post }>(`/communities/${slug}/posts/${id}/vote`),
    onSuccess: () => invalidate(),
  });
}

export function useDeletePost() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/communities/${slug}/posts/${id}`),
    onSuccess: () => invalidate(),
  });
}

export function useEditPost() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch<{ post: Post }>(`/communities/${slug}/posts/${id}`, { content }),
    onSuccess: () => invalidate(),
  });
}

export function usePinPost() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api.post(`/communities/${slug}/posts/${id}/pin`),
    onSuccess: () => invalidate(),
  });
}

export function useUnpinPost() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api.post(`/communities/${slug}/posts/${id}/unpin`),
    onSuccess: () => invalidate(),
  });
}

export function useToggleLike() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      api.post<{ post: Post }>(`/communities/${slug}/posts/${id}/${liked ? "unlike" : "like"}`),
    onSuccess: () => invalidate(),
  });
}

export function useToggleRepost() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, reposted }: { id: string; reposted: boolean }) =>
      api.post<{ post: Post }>(`/communities/${slug}/posts/${id}/${reposted ? "unrepost" : "repost"}`),
    onSuccess: () => invalidate(),
  });
}

export function useMarkNotInterested() {
  const slug = useCommunitySlug();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api.post(`/communities/${slug}/posts/${id}/not-interested`),
    onSuccess: () => invalidate(),
  });
}

export function useReportPost() {
  const slug = useCommunitySlug();
  return useMutation({
    mutationFn: ({ id, reason, details }: { id: string; reason: string; details?: string }) =>
      api.post(`/communities/${slug}/posts/${id}/report`, { reason, details }),
  });
}

export function usePollVoters(postId: string | undefined, enabled: boolean) {
  const slug = useCommunitySlug();
  return useQuery({
    queryKey: ["poll", "voters", postId, slug],
    queryFn: () => api.get<PollVoters>(`/communities/${slug}/posts/${postId}/poll/voters`),
    enabled: !!postId && enabled,
  });
}
