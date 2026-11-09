import { communityPath } from "../../lib/communityPath";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../shared/Avatar";
import { UserBadges } from "../shared/UserBadges";
import { renderContent } from "./PostCard";
import { PostActionBar } from "./PostActionBar";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { logClick } from "../../lib/analytics";
import type { Post } from "../../types";

function PreviewRow({ post, muted, interactive }: { post: Post; muted?: boolean; interactive?: boolean }) {
  const slug = useCommunitySlug();
  return (
    <div className={`flex gap-3 px-4 pt-3 ${muted ? "opacity-60" : ""}`}>
      <Avatar user={post.author} size={9} />
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium">{post.author.displayName}</span>
          <UserBadges user={post.author} className="h-3.5 w-3.5" />
          <span className="text-neutral-500">@{post.author.username}</span>
        </div>
        {post.content && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px]">{renderContent(post.content, slug)}</p>
        )}
        {post.gifUrl && <img src={post.gifUrl} alt="GIF" className="mt-2 max-h-48 max-w-full rounded-lg" />}
        {post.mediaUrl &&
          (post.mediaType === "video" ? (
            <video src={post.mediaUrl} className="mt-2 max-h-48 max-w-full rounded-lg" />
          ) : (
            <img src={post.mediaUrl} alt="Attached media" className="mt-2 max-h-48 max-w-full rounded-lg" />
          ))}
        {interactive && <PostActionBar post={post} wrapperId={post.id} />}
      </div>
    </div>
  );
}

export function ReplyThreadPreview({ reply }: { reply: Post }) {
  const navigate = useNavigate();
  const currentSlug = useCommunitySlug();
  const parent = reply.inReplyTo;

  if (!parent) return null;

  const slug = parent.communitySlug ?? reply.communitySlug ?? currentSlug;

  const goToThread = () => {
    logClick(slug, parent.author.username, parent.id);
    navigate(communityPath(slug, `@${parent.author.username}/post/${parent.shortId || parent.id}`));
  };

  return (
    <div onClick={goToThread} className="cursor-pointer rounded-lg hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
      <PreviewRow post={parent} muted />
      <div className="ml-8 border-l-2 border-neutral-200 pb-1 dark:border-neutral-800">
        <PreviewRow post={reply} interactive />
      </div>
    </div>
  );
}
