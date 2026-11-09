import { communityPath, profilePath } from "../../lib/communityPath";
import { Link, useNavigate } from "react-router-dom";
import { Fragment, useEffect, useRef, useState } from "react";
import { LuRepeat2, LuExpand, LuX } from "react-icons/lu";
import { Avatar } from "../shared/Avatar";
import { UserBadges } from "../shared/UserBadges";
import { AccountLabel } from "../shared/AccountLabel";
import { PostMenu } from "./PostMenu";
import { PostActionBar } from "./PostActionBar";
import { PostEmbedPreview } from "./PostEmbedPreview";
import { usePollVoters, useVotePoll, useRemovePollVote } from "../../hooks/usePosts";
import { useImpressionTracking } from "../../hooks/useImpressionTracking";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { useGuestGate } from "../../lib/guestGate";
import { logClick } from "../../lib/analytics";
import { RICH_TEXT_PATTERN, classifyToken } from "../../lib/richText";
import { renderWithEmoji } from "../../lib/emoji";
import { ExternalLink } from "../shared/ExternalLink";
import type { Post } from "../../types";

export function renderContent(content: string, slug: string) {
  return content.split(RICH_TEXT_PATTERN).map((part, i) => {
    const token = classifyToken(part);
    switch (token.kind) {
      case "mention":
        return (
          <Link
            key={i}
            to={profilePath(token.raw.slice(1))}
            onClick={(e) => e.stopPropagation()}
            className="text-brand hover:underline"
          >
            {token.raw}
          </Link>
        );
      case "hashtag":
        return (
          <Link
            key={i}
            to={communityPath(slug, `explore?q=${encodeURIComponent(token.raw)}`)}
            onClick={(e) => e.stopPropagation()}
            className="text-brand hover:underline"
          >
            {token.raw}
          </Link>
        );
      case "link":
        return <ExternalLink key={i} href={token.raw} />;
      case "bold":
        return <strong key={i}>{renderWithEmoji(token.inner)}</strong>;
      case "italic":
        return <em key={i}>{renderWithEmoji(token.inner)}</em>;
      case "underline":
        return <u key={i}>{renderWithEmoji(token.inner)}</u>;
      case "code":
        return (
          <code key={i} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-neutral-800">
            {token.inner}
          </code>
        );
      default:
        return <Fragment key={i}>{renderWithEmoji(token.raw)}</Fragment>;
    }
  });
}

function pollTimeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Final results";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

function MediaAttachment({ post }: { post: Post }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!post.mediaUrl) return null;

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative mt-2 inline-block max-w-full">
      {post.mediaType === "video" ? (
        <>
          <video
            src={post.mediaUrl}
            controls
            className="max-h-72 max-w-full rounded-lg border border-neutral-100 dark:border-neutral-800"
          />
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            aria-label="Expand video"
          >
            <LuExpand className="h-4 w-4" />
          </button>
        </>
      ) : (
        <img
          src={post.mediaUrl}
          alt="Attached media"
          onClick={() => setLightboxOpen(true)}
          className="max-h-72 max-w-full cursor-pointer rounded-lg border border-neutral-100 dark:border-neutral-800"
        />
      )}

      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full p-2 text-white hover:bg-white/10"
            aria-label="Close"
          >
            <LuX className="h-6 w-6" />
          </button>
          {post.mediaType === "video" ? (
            <video
              src={post.mediaUrl}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt="Attached media"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}

function PollImage({ imageUrl }: { imageUrl: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <img
        src={imageUrl}
        alt="Poll image"
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
        className="h-28 w-28 shrink-0 cursor-pointer self-start rounded-xl border border-neutral-100 object-cover sm:h-36 sm:w-36 dark:border-neutral-800"
      />
      {lightboxOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            className="absolute right-4 top-4 rounded-full p-2 text-white hover:bg-white/10"
            aria-label="Close"
          >
            <LuX className="h-6 w-6" />
          </button>
          <img
            src={imageUrl}
            alt="Poll image"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

function Poll({ post }: { post: Post }) {
  const votePoll = useVotePoll();
  const removePollVote = useRemovePollVote();
  const { requireAccount } = useGuestGate();
  const [showVoters, setShowVoters] = useState(false);
  const { data: voterData } = usePollVoters(post.id, showVoters);
  if (!post.poll) return null;

  const castVote = (optionIndex: number) => {
    if (requireAccount()) return;
    votePoll.mutate({ id: post.id, optionIndex });
  };
  const { options, totalVotes, isExpired, myVote } = post.poll;
  const showResults = myVote !== null || isExpired;
  const canChangeVote = !isExpired && myVote !== null;
  const isBusy = votePoll.isPending || removePollVote.isPending;
  const votersByOption = new Map((voterData?.options ?? []).map((o) => [o.index, o.voters]));

  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-1.5">
      {options.map((option, i) => {
        const pct = totalVotes > 0 ? Math.round((option.votesCount / totalVotes) * 100) : 0;
        const isMine = myVote === i;

        if (!showResults) {
          return (
            <button
              key={i}
              onClick={() => castVote(i)}
              disabled={votePoll.isPending}
              className="block w-full break-words rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm font-medium hover:border-brand hover:bg-brand/10 disabled:opacity-60 dark:border-neutral-600"
            >
              {option.text}
            </button>
          );
        }

        const Row = canChangeVote && !isMine ? "button" : "div";

        return (
          <div key={i} className="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div
              className={`absolute inset-y-0 left-0 ${isMine ? "bg-brand/30" : "bg-neutral-100 dark:bg-neutral-800"}`}
              style={{ width: `${pct}%` }}
            />
            <Row
              {...(Row === "button"
                ? {
                    onClick: () => castVote(i),
                    disabled: isBusy,
                    title: `Change your vote to "${option.text}"`,
                  }
                : {})}
              className={`relative flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                Row === "button" ? "hover:bg-brand/10 disabled:opacity-60" : ""
              }`}
            >
              <span className={`min-w-0 break-words ${isMine ? "font-semibold" : ""}`}>{option.text}</span>
              <span className="shrink-0 text-neutral-500">
                {option.votesCount} · {pct}%
              </span>
            </Row>
            {showVoters && (
              <div className="relative flex flex-wrap gap-1.5 px-3 pb-2">
                {(votersByOption.get(i) ?? []).map((voter) => (
                  <span
                    key={voter.id}
                    title={`@${voter.username}`}
                    className="flex items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 text-xs dark:bg-black/40"
                  >
                    <Avatar user={voter} size={4} />
                    <span className="max-w-[9rem] truncate">{voter.displayName}</span>
                  </span>
                ))}
                {(votersByOption.get(i) ?? []).length === 0 && (
                  <span className="text-xs text-neutral-400">No votes yet</span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span>
          {totalVotes} vote{totalVotes === 1 ? "" : "s"} · {pollTimeLeft(post.poll.expiresAt)}
        </span>
        {showResults && totalVotes > 0 && (
          <button onClick={() => setShowVoters((v) => !v)} className="font-medium text-brand hover:underline">
            {showVoters ? "Hide votes" : "See who voted"}
          </button>
        )}
        {canChangeVote && (
          <button
            onClick={() => {
              if (requireAccount()) return;
              removePollVote.mutate(post.id);
            }}
            disabled={isBusy}
            className="font-medium text-brand hover:underline disabled:opacity-60"
          >
            Remove my vote
          </button>
        )}
        {showVoters && voterData?.truncated && <span>Showing the first 500 voters.</span>}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function PostText({ content, slug, expanded }: { content: string; slug: string; expanded: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (expanded || isExpanded) {
      setTruncated(false);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const measure = () => setTruncated(el.scrollHeight - el.clientHeight > 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [content, expanded, isExpanded]);

  const showFull = expanded || isExpanded;

  return (
    <div>
      <p
        ref={ref}
        className={`mt-1 whitespace-pre-wrap break-words text-[15px] ${showFull ? "" : "line-clamp-6"}`}
      >
        {renderContent(content, slug)}
      </p>
      {truncated && !showFull && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="mt-1 text-sm font-medium text-brand hover:underline"
        >
          Show more
        </button>
      )}
    </div>
  );
}

function PostBody({
  post,
  wrapperId,
  expanded,
  onDeleted,
}: {
  post: Post;
  wrapperId: string;
  expanded: boolean;
  onDeleted?: () => void;
}) {
  const currentSlug = useCommunitySlug();
  const navigate = useNavigate();
  const slug = post.communitySlug ?? currentSlug;

  const linkId = post.shortId || post.id;
  const goToPost = () => {
    logClick(slug, post.author.username, post.id);
    navigate(communityPath(slug, `@${post.author.username}/post/${linkId}`));
  };

  return (
    <div onClick={goToPost} className="cursor-pointer">
      <div className="flex items-start justify-between pt-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            to={profilePath(post.author.username)}
            onClick={(e) => {
              e.stopPropagation();
              logClick(slug, post.author.username);
            }}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span className="truncate font-medium hover:underline">{post.author.displayName}</span>
            <UserBadges user={post.author} />
            <span className="truncate text-neutral-500">@{post.author.username}</span>
          </Link>
          <AccountLabel label={post.author.accountLabel} />
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-500">{timeAgo(post.createdAt)}</span>
          {post.editedAt && (
            <>
              <span className="text-neutral-500">·</span>
              <span className="text-neutral-500" title={`Edited ${new Date(post.editedAt).toLocaleString()}`}>
                Edited {timeAgo(post.editedAt)}
              </span>
            </>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <PostMenu post={post} onDeleted={onDeleted} />
        </div>
      </div>

      {post.gifUrl && (
        <div className="mt-2">
          <img
            src={post.gifUrl}
            alt="GIF"
            className="max-h-72 max-w-full rounded-lg border border-neutral-100 dark:border-neutral-800"
          />
        </div>
      )}

      <MediaAttachment post={post} />

      {post.poll?.imageUrl ? (
        <div className="mt-2 flex items-start gap-3">
          <PollImage imageUrl={post.poll.imageUrl} />
          <div className="min-w-0 flex-1">
            {post.content && <PostText content={post.content} slug={slug} expanded={expanded} />}
            <Poll post={post} />
          </div>
        </div>
      ) : (
        <>
          {post.content && <PostText content={post.content} slug={slug} expanded={expanded} />}
          {post.poll && <Poll post={post} />}
        </>
      )}

      {post.quotedPost && <PostEmbedPreview post={post.quotedPost} />}

      <PostActionBar post={post} wrapperId={wrapperId} />
    </div>
  );
}

export function PostCard({
  post,
  expanded = false,
  onDeleted,
}: {
  post: Post;
  expanded?: boolean;
  onDeleted?: () => void;
}) {
  const slug = useCommunitySlug();
  const displayPost = post.repostOf || post;
  const impressionRef = useImpressionTracking(displayPost.id);

  return (
    <div ref={impressionRef} className="rounded-lg p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
      {post.repostOf && (
        <Link
          to={profilePath(post.author.username)}
          className="mb-1 flex items-center gap-2 pl-8 text-sm font-medium text-neutral-500 hover:underline"
        >
          <LuRepeat2 className="h-4 w-4" /> {post.author.displayName} reposted
        </Link>
      )}
      <div className="flex gap-3">
        <Link to={profilePath(displayPost.author.username)} onClick={() => logClick(slug, displayPost.author.username)} className="self-start">
          <Avatar user={displayPost.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <PostBody post={displayPost} wrapperId={post.id} expanded={expanded} onDeleted={onDeleted} />
        </div>
      </div>
    </div>
  );
}
