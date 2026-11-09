import { useEffect, useState } from "react";
import { LuMessageCircle, LuRepeat2, LuHeart, LuBookmark, LuShare, LuCheck } from "react-icons/lu";
import { useCompose } from "./ComposeContext";
import { ShareModal } from "./ShareModal";
import { useToggleLike, useToggleRepost, useToggleBookmark } from "../../hooks/usePosts";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { useGuestGate } from "../../lib/guestGate";
import { SHARE_BASE_URL } from "../../lib/links";
import type { Post } from "../../types";

export function PostActionBar({ post, wrapperId }: { post: Post; wrapperId: string }) {
  const { openCompose } = useCompose();
  const { requireAccount } = useGuestGate();
  const slug = useCommunitySlug();
  const likeMutation = useToggleLike();
  const repostMutation = useToggleRepost();
  const bookmarkMutation = useToggleBookmark();
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);
  const [repostBurst, setRepostBurst] = useState(0);
  const [bookmarkBurst, setBookmarkBurst] = useState(0);

  const [likeOverride, setLikeOverride] = useState<{ isLiked: boolean; count: number } | null>(null);
  const [repostOverride, setRepostOverride] = useState<{ isReposted: boolean; count: number } | null>(null);
  const [bookmarkOverride, setBookmarkOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (likeOverride && !!post.isLikedByMe === likeOverride.isLiked) setLikeOverride(null);
  }, [post.isLikedByMe, likeOverride]);

  useEffect(() => {
    if (repostOverride && !!post.isRepostedByMe === repostOverride.isReposted) setRepostOverride(null);
  }, [post.isRepostedByMe, repostOverride]);

  useEffect(() => {
    if (bookmarkOverride !== null && !!post.isBookmarkedByMe === bookmarkOverride) setBookmarkOverride(null);
  }, [post.isBookmarkedByMe, bookmarkOverride]);

  const isLiked = likeOverride ? likeOverride.isLiked : !!post.isLikedByMe;
  const likesCount = likeOverride ? likeOverride.count : post.likesCount;
  const isReposted = repostOverride ? repostOverride.isReposted : !!post.isRepostedByMe;
  const repostsCount = repostOverride ? repostOverride.count : post.repostsCount;
  const isBookmarked = bookmarkOverride !== null ? bookmarkOverride : !!post.isBookmarkedByMe;

  const [isLikePending, setIsLikePending] = useState(false);
  const [isRepostPending, setIsRepostPending] = useState(false);
  const [isBookmarkPending, setIsBookmarkPending] = useState(false);

  const toggleLike = async () => {
    if (requireAccount()) return;
    if (isLikePending) return;
    setIsLikePending(true);
    const wasLiked = !!post.isLikedByMe;
    const nextLiked = !wasLiked;
    setLikeOverride({ isLiked: nextLiked, count: Math.max(0, post.likesCount + (nextLiked ? 1 : -1)) });
    if (nextLiked) setLikeBurst((n) => n + 1);
    try {
      await likeMutation.mutateAsync({ id: wrapperId, liked: wasLiked });
    } catch {
      setLikeOverride(null);
    } finally {
      setTimeout(() => setIsLikePending(false), 200);
    }
  };

  const toggleRepost = async () => {
    if (requireAccount()) return;
    if (isRepostPending) return;
    setIsRepostPending(true);
    const wasReposted = !!post.isRepostedByMe;
    const nextReposted = !wasReposted;
    setRepostOverride({ isReposted: nextReposted, count: Math.max(0, post.repostsCount + (nextReposted ? 1 : -1)) });
    if (nextReposted) setRepostBurst((n) => n + 1);
    setRepostMenuOpen(false);
    try {
      await repostMutation.mutateAsync({ id: wrapperId, reposted: wasReposted });
    } catch {
      setRepostOverride(null);
    } finally {
      setTimeout(() => setIsRepostPending(false), 200);
    }
  };

  const toggleBookmark = async () => {
    if (requireAccount()) return;
    if (isBookmarkPending) return;
    setIsBookmarkPending(true);
    const wasBookmarked = !!post.isBookmarkedByMe;
    const nextBookmarked = !wasBookmarked;
    setBookmarkOverride(nextBookmarked);
    if (nextBookmarked) setBookmarkBurst((n) => n + 1);
    try {
      await bookmarkMutation.mutateAsync({ id: wrapperId, bookmarked: wasBookmarked });
    } catch {
      setBookmarkOverride(null);
    } finally {
      setTimeout(() => setIsBookmarkPending(false), 200);
    }
  };

  const linkId = post.shortId || post.id;
  const link = `${SHARE_BASE_URL}/c/${post.communitySlug ?? slug}/@${post.author.username}/post/${linkId}`;

  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-3">
      <div className="grid max-w-lg grid-cols-5 items-center text-neutral-500">
        <button
          onClick={() => {
            if (requireAccount()) return;
            openCompose({ parentPostId: post.id });
          }}
          className="flex h-8 w-fit items-center gap-1.5 rounded-full px-1.5 hover:bg-brand/10 hover:text-brand"
        >
          <LuMessageCircle className="h-[18px] w-[18px] shrink-0" />
          {post.commentsCount > 0 && (
            <span className="text-sm leading-none tabular-nums">{post.commentsCount}</span>
          )}
        </button>

        <div className="relative w-fit">
          <button
            onClick={() => {
              if (requireAccount()) return;
              setRepostMenuOpen((v) => !v);
            }}
            className={`flex h-8 w-fit items-center gap-1.5 rounded-full px-1.5 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950 ${
              isReposted ? "text-green-600" : ""
            }`}
          >
            <span key={repostBurst} className={repostBurst > 0 ? "inline-flex motion-safe:animate-repost-spin" : "inline-flex"}>
              <LuRepeat2 className="h-[18px] w-[18px] shrink-0" />
            </span>
            {repostsCount > 0 && <span className="text-sm leading-none tabular-nums">{repostsCount}</span>}
          </button>
          {repostMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setRepostMenuOpen(false)} />
              <div className="absolute z-40 mt-1 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <button
                  onClick={toggleRepost}
                  className="block w-full px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  {isReposted ? "Undo repost" : "Repost"}
                </button>
                <button
                  onClick={() => {
                    openCompose({ quotedPost: post });
                    setRepostMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Quote
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={toggleLike}
          className={`flex h-8 w-fit items-center gap-1.5 rounded-full px-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 ${
            isLiked ? "text-red-600" : ""
          }`}
        >
          <span key={likeBurst} className={likeBurst > 0 ? "inline-flex motion-safe:animate-like-pop" : "inline-flex"}>
            <LuHeart className="h-[18px] w-[18px] shrink-0" fill={isLiked ? "currentColor" : "none"} />
          </span>
          {likesCount > 0 && <span className="text-sm leading-none tabular-nums">{likesCount}</span>}
        </button>

        <button
          onClick={toggleBookmark}
          className={`flex h-8 w-fit items-center rounded-full px-1.5 hover:bg-brand/10 hover:text-brand ${
            isBookmarked ? "text-brand" : ""
          }`}
        >
          <span key={bookmarkBurst} className={bookmarkBurst > 0 ? "inline-flex motion-safe:animate-like-pop" : "inline-flex"}>
            <LuBookmark className="h-[18px] w-[18px] shrink-0" fill={isBookmarked ? "currentColor" : "none"} />
          </span>
        </button>

        <button
          onClick={() => setShareOpen(true)}
          className="flex h-8 w-fit items-center rounded-full px-1.5 hover:bg-brand/10 hover:text-brand"
          aria-label="Share"
        >
          {copied ? (
            <LuCheck className="h-[18px] w-[18px] shrink-0 text-green-600" />
          ) : (
            <LuShare className="h-[18px] w-[18px] shrink-0" />
          )}
        </button>
      </div>

      <ShareModal
        post={post}
        link={link}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onCopied={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      />
    </div>
  );
}
