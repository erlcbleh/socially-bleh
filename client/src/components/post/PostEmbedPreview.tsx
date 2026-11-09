import { communityPath } from "../../lib/communityPath";
import { Link } from "react-router-dom";
import { UserBadges } from "../shared/UserBadges";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { renderContent } from "./PostCard";
import type { Post } from "../../types";

export function PostEmbedPreview({
  post,
  unavailable,
  tone = "default",
  className = "mt-2",
}: {
  post: Post | null | undefined;
  unavailable?: boolean;
  tone?: "default" | "onBrand";
  className?: string;
}) {
  const slug = useCommunitySlug();
  const borderClass = tone === "onBrand" ? "border-white/30" : "border-neutral-200 dark:border-neutral-700";

  if (unavailable || !post) {
    return (
      <div className={`${className} rounded-xl border p-3 text-sm ${borderClass} ${tone === "onBrand" ? "text-white/70" : "text-neutral-400"}`}>
        This post is no longer available.
      </div>
    );
  }

  const linkId = post.shortId || post.id;

  return (
    <Link
      to={communityPath(post.communitySlug ?? slug, `@${post.author.username}/post/${linkId}`)}
      onClick={(e) => e.stopPropagation()}
      className={`${className} block rounded-xl border p-3 hover:bg-black/5 dark:hover:bg-white/5 ${borderClass}`}
    >
      <div className="flex items-center gap-1.5 text-sm">
        <span className="font-medium">{post.author.displayName}</span>
        <UserBadges user={post.author} className="h-3.5 w-3.5" />
        <span className={tone === "onBrand" ? "text-white/70" : "text-neutral-500"}>@{post.author.username}</span>
      </div>
      {post.content && <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-sm">{renderContent(post.content, slug)}</p>}
      {post.gifUrl && <img src={post.gifUrl} alt="GIF" className="mt-1 max-h-36 max-w-full rounded-lg" />}
      {post.mediaUrl && post.mediaType !== "video" && (
        <img src={post.mediaUrl} alt="Attached media" className="mt-1 max-h-36 max-w-full rounded-lg" />
      )}
    </Link>
  );
}
