import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LuX, LuTrash2, LuSend } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useViewStory, useDeleteStory, useReplyToStory } from "../../hooks/useStories";
import { profilePath } from "../../lib/communityPath";
import { Avatar } from "../shared/Avatar";
import { Modal } from "../shared/Modal";
import type { StoryGroup } from "../../types";
import { EmojiSprite, renderWithEmoji } from "../../lib/emoji";

const IMAGE_DURATION_MS = 10000;
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥"];

export function StoryViewer({
  groups,
  initialGroupIndex,
  onClose,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const viewStory = useViewStory();
  const deleteStory = useDeleteStory();
  const replyToStory = useReplyToStory();
  const rafRef = useRef<number>();
  const startRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const goNextStory = () => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goPrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
      setGroupIndex((i) => i - 1);
    }
  };

  useEffect(() => {
    setProgress(0);
    pauseOffsetRef.current = 0;
    pausedAtRef.current = null;
  }, [groupIndex, storyIndex]);

  useEffect(() => {
    if (story && !story.isViewedByMe) viewStory.mutate(story.id);
  }, [story?.id]);

  useEffect(() => {
    setReplyText("");
    setSentReaction(null);
  }, [story?.id]);

  useEffect(() => {
    if (isReplyFocused) {
      pausedAtRef.current = performance.now();
    } else if (pausedAtRef.current !== null) {
      pauseOffsetRef.current += performance.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      if (isReplyFocused) video.pause();
      else video.play().catch(() => {});
    }
  }, [isReplyFocused]);

  useEffect(() => {
    if (!story || story.mediaType === "video") return;

    startRef.current = performance.now();
    function tick(now: number) {
      if (pausedAtRef.current !== null) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const pct = Math.min((now - startRef.current - pauseOffsetRef.current) / IMAGE_DURATION_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        goNextStory();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [story?.id]);

  if (!group || !story) return null;
  const isOwn = group.author.id === user?.id;

  const sendReply = (content: string) => {
    if (!content.trim() || replyToStory.isPending) return;
    replyToStory.mutate(
      { username: group.author.username, content: content.trim(), storyId: story.id },
      {
        onSuccess: () => {
          setReplyText("");
          if (content !== replyText) {
            setSentReaction(content);
            setTimeout(() => setSentReaction(null), 1200);
          }
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black motion-safe:animate-backdrop-in">
      <div className="relative h-full w-full max-w-md motion-safe:animate-story-in">
        <div className="absolute left-2 right-2 top-2 z-10 flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="absolute left-2 right-2 top-6 z-10 flex items-center justify-between">
          <Link
            to={profilePath(group.author.username)}
            onClick={onClose}
            className="flex items-center gap-2 rounded-full pr-2 hover:bg-white/10"
          >
            <Avatar user={group.author} size={8} />
            <span className="text-sm font-medium text-white hover:underline">{group.author.username}</span>
          </Link>
          <div className="flex items-center gap-2">
            {isOwn && (
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="Delete story"
                className="rounded-full p-1.5 text-white hover:bg-white/20"
              >
                <LuTrash2 className="h-5 w-5" />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-white hover:bg-white/20">
              <LuX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {story.mediaType === "video" ? (
          <video
            ref={videoRef}
            src={story.mediaUrl}
            className="h-full w-full object-contain"
            autoPlay
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={goNextStory}
          />
        ) : (
          <img src={story.mediaUrl} alt="Story" className="h-full w-full object-contain" />
        )}

        {story.caption && (
          <p className="pointer-events-none absolute bottom-24 left-4 right-4 z-10 text-center text-lg font-medium text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.8)]">
            {renderWithEmoji(story.caption)}
          </p>
        )}

        <button onClick={goPrevStory} aria-label="Previous story" className="absolute inset-y-0 left-0 w-1/3" />
        <button onClick={goNextStory} aria-label="Next story" className="absolute inset-y-0 right-0 w-1/3" />

        {!isOwn && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 p-3">
            {sentReaction && (
              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 motion-safe:animate-story-in">
                <EmojiSprite emoji={sentReaction} size="2rem" />
              </span>
            )}
            <div className="flex shrink-0 gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReply(emoji)}
                  disabled={replyToStory.isPending}
                  aria-label={`React with ${emoji}`}
                  className="rounded-full p-1 hover:scale-125 disabled:opacity-40"
                >
                  <EmojiSprite emoji={emoji} size="1.4rem" />
                </button>
              ))}
            </div>
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsReplyFocused(true)}
              onBlur={() => setIsReplyFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && replyText.trim()) {
                  e.preventDefault();
                  sendReply(replyText);
                }
              }}
              placeholder={`Reply to ${group.author.username}...`}
              className="min-w-0 flex-1 rounded-full border border-white/30 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur"
            />
            {replyText.trim() && (
              <button
                onClick={() => sendReply(replyText)}
                disabled={replyToStory.isPending}
                aria-label="Send reply"
                className="shrink-0 rounded-full p-2.5 text-white hover:bg-white/20 disabled:opacity-40"
              >
                <LuSend className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Delete story?">
        <div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This can't be undone. The story will be permanently deleted.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setConfirmDeleteOpen(false)}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteStory.mutate(story.id, { onSuccess: goNextStory });
                setConfirmDeleteOpen(false);
              }}
              disabled={deleteStory.isPending}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
