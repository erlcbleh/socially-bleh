import { useEffect, useRef, useState } from "react";
import { useQuery } from "../../lib/queryStore";
import { LuX, LuChartNoAxesColumn, LuImagePlus, LuAtSign, LuNewspaper, LuSmile, LuChevronDown, LuCheck } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useCreatePost } from "../../hooks/usePosts";
import { useUploadMedia } from "../../hooks/useMediaUpload";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";
import { api } from "../../lib/api";
import { Avatar } from "../shared/Avatar";
import { GifPicker } from "./GifPicker";
import { TemplateModal } from "./TemplateModal";
import { findMention, renderMentionHighlight } from "../../lib/mentions";
import type { Community, Post, User } from "../../types";
import { EmojiPicker } from "../shared/EmojiPicker";
import { canAttachVideo } from "../../lib/permissions";

const MAX_LEN = 500;
const MAX_POLL_OPTIONS = 4;
const DURATION_OPTIONS = [
  { label: "5 minutes", minutes: 5 },
  { label: "1 hour", minutes: 60 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

const LINE_HEIGHT_PX = 27;

function PollDurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = DURATION_OPTIONS.find((d) => d.minutes === value) ?? DURATION_OPTIONS[2];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1 text-sm outline-none transition-colors hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
      >
        {current.label}
        <LuChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {DURATION_OPTIONS.map((d) => {
            const selected = d.minutes === value;
            return (
              <button
                key={d.minutes}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(d.minutes);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "bg-brand/10 text-brand"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span>{d.label}</span>
                {selected && <LuCheck className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Composer({
  parentPostId,
  quotedPost,
  onDone,
  placeholder,
  bordered = true,
}: {
  parentPostId?: string;
  quotedPost?: Post;
  onDone?: () => void;
  placeholder?: string;
  bordered?: boolean;
}) {
  const { user } = useAuth();
  const videoAllowed = canAttachVideo(user);
  const slug = useNavCommunitySlug();
  const { data: communityData } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => api.get<{ community: Community }>(`/communities/${slug}`),
    enabled: !!slug,
  });
  const community = communityData?.community ?? null;
  const [content, setContent] = useState("");
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(DURATION_OPTIONS[2].minutes);
  const [pollImage, setPollImage] = useState<string | null>(null);
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const createPost = useCreatePost();
  const uploadMedia = useUploadMedia();

  const mentionQuery = mention?.query ?? "";
  const { data: mentionData } = useQuery({
    queryKey: ["mentionSearch", mentionQuery, slug],
    queryFn: () => api.get<{ users: User[] }>(`/communities/${slug}/search?q=${encodeURIComponent(mentionQuery)}`),
    enabled: !!slug && !!mention && mentionQuery.length > 0,
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  if (!user) return null;

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setMention(findMention(e.target.value, e.target.selectionStart));
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const newContent = content.slice(0, start) + text + content.slice(end);
    const pos = start + text.length;
    setContent(newContent);
    setMention(findMention(newContent, pos));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const selectMention = (username: string) => {
    if (!mention) return;
    const before = content.slice(0, mention.start);
    const after = content.slice(mention.start + 1 + mention.query.length);
    const inserted = `@${username} `;
    const newContent = before + inserted + after;
    const pos = before.length + inserted.length;
    setContent(newContent);
    setMention(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid = !pollOpen || validPollOptions.length >= 2;
  const hasAttachment = !!gifUrl || !!media || pollOpen || !!pollImage;

  const hasOnlyHashtags =
    /#[^\s#]+/.test(content) && content.replace(/#[^\s#]+/g, "").trim().length === 0;

  const canSubmit =
    (content.trim().length > 0 || hasAttachment || quotedPost) &&
    (!hasOnlyHashtags || hasAttachment || quotedPost) &&
    content.length <= MAX_LEN &&
    pollValid &&
    !uploadMedia.isPending;

  const [isDragging, setIsDragging] = useState(false);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && (!isVideo || !videoAllowed)) return;
    if (gifUrl || media || uploadMedia.isPending) return;

    if (pollOpen) {
      if (!isImage) return;
      uploadMedia.mutate(file, {
        onSuccess: (data) => setPollImage(data.url),
      });
      return;
    }

    uploadMedia.mutate(file, {
      onSuccess: (data) => setMedia(data),
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFileProcess(file);
          return;
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    handleFileProcess(file);
  };

  const submit = () => {
    if (!canSubmit || createPost.isPending) return;
    createPost.mutate(
      {
        content: content.trim(),
        gifUrl: gifUrl || undefined,
        mediaUrl: media?.url,
        mediaType: media?.type,
        parentPost: parentPostId,
        quotedPost: quotedPost?.id,
        poll: pollOpen
          ? { options: validPollOptions, durationMinutes: pollDuration, imageUrl: pollImage || undefined }
          : undefined,
      },
      {
        onSuccess: () => {
          setContent("");
          setGifUrl(null);
          setMedia(null);
          setPollOpen(false);
          setPollOptions(["", ""]);
          setPollDuration(DURATION_OPTIONS[2].minutes);
          setPollImage(null);
          onDone?.();
        },
      }
    );
  };

  const isTopLevel = !parentPostId && !quotedPost;
  const mentionLine = mention ? content.slice(0, mention.start).split("\n").length : 1;

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setContent((prev) => prev.slice(0, start) + emoji + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`relative ${
        !bordered
          ? ""
          : isTopLevel
            ? "card-surface mx-4 mt-4 rounded-xl p-4"
            : "p-4"
      }`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center gap-2.5 rounded-lg bg-brand/10 text-brand dark:bg-brand/20">
          <LuImagePlus className="h-6 w-6" />
          <span className="text-sm font-semibold">Drop to add media</span>
        </div>
      )}
      <div className="flex gap-3">
        <Avatar user={user} size={10} />
        <div className="flex-1">
          <div className="relative">
            <div
              ref={overlayRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-sans text-base sm:text-lg tracking-normal leading-normal"
            >
              {content ? renderMentionHighlight(content) : null}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onScroll={(e) => {
                if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onBlur={() => setTimeout(() => setMention(null), 150)}
              placeholder={
                placeholder ||
                (parentPostId
                  ? "Post your reply"
                  : community && !community.isGlobal
                    ? `What's happening in ${community.name}?`
                    : "What's happening?")
              }
              rows={1}
              className="relative w-full resize-none border-none bg-transparent whitespace-pre-wrap break-words font-sans text-base sm:text-lg tracking-normal leading-normal text-transparent caret-black outline-none placeholder:text-neutral-400 dark:caret-white"
            />

            {mention && mentionQuery.length > 0 && (
              <div
                style={{ top: mentionLine * LINE_HEIGHT_PX + 4 }}
                className="absolute z-40 max-h-64 max-w-[calc(100vw-4rem)] w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
              >
                {mentionData?.users.length === 0 && (
                  <p className="px-4 py-3 text-sm text-neutral-400">No matching users</p>
                )}
                {mentionData?.users.map((u) => (
                  <button
                    key={u.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectMention(u.username)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Avatar user={u} size={8} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.displayName}</p>
                      <p className="truncate text-xs text-neutral-500">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {gifUrl && (
            <div className="relative mb-2 mt-1 inline-block max-w-full">
              <img src={gifUrl} alt="Selected GIF" className="max-h-48 max-w-full rounded-lg" />
              <button
                onClick={() => setGifUrl(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white"
              >
                Remove
              </button>
            </div>
          )}

          {uploadMedia.isPending && (
            <p className="mb-2 mt-1 text-sm text-neutral-500">Uploading…</p>
          )}
          {uploadMedia.isError && (
            <p className="mb-2 mt-1 text-sm text-red-500">{(uploadMedia.error as Error).message}</p>
          )}

          {media && (
            <div className="relative mb-2 mt-1 inline-block max-w-full">
              {media.type === "video" ? (
                <video src={media.url} controls className="max-h-48 max-w-full rounded-lg" />
              ) : (
                <img src={media.url} alt="Attached media" className="max-h-48 max-w-full rounded-lg" />
              )}
              <button
                onClick={() => setMedia(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white"
              >
                Remove
              </button>
            </div>
          )}

          {quotedPost && (
            <div className="mb-2 mt-1 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{quotedPost.author.displayName}</span>
                <span className="text-neutral-500">@{quotedPost.author.username}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-700 line-clamp-3 dark:text-neutral-300">{quotedPost.content}</p>
            </div>
          )}

          {pollOpen && (
            <div className="mb-2 mt-1 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-500">Poll</span>
                <button
                  onClick={() => {
                    setPollOpen(false);
                    setPollOptions(["", ""]);
                    setPollImage(null);
                  }}
                  aria-label="Remove poll"
                  className="rounded-full p-1 text-neutral-400"
                >
                  <LuX className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={(e) =>
                        setPollOptions((opts) => opts.map((o, idx) => (idx === i ? e.target.value : o)))
                      }
                      maxLength={80}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => setPollOptions((opts) => opts.filter((_, idx) => idx !== i))}
                        className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        aria-label="Remove option"
                      >
                        <LuX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pollImage && (
                <div className="relative mt-2 inline-block">
                  <img
                    src={pollImage}
                    alt="Poll image"
                    className="h-24 w-24 rounded-lg border border-neutral-200 object-cover dark:border-neutral-700"
                  />
                  <button
                    onClick={() => setPollImage(null)}
                    aria-label="Remove poll image"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <LuX className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {pollOptions.length < MAX_POLL_OPTIONS ? (
                    <button
                      onClick={() => setPollOptions((opts) => [...opts, ""])}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Add option
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!!pollImage || uploadMedia.isPending}
                    aria-label="Add image to poll"
                    className="flex items-center gap-1 text-sm font-medium text-brand hover:underline disabled:opacity-40"
                  >
                    <LuImagePlus className="h-4 w-4" />
                    {pollImage ? "Image added" : "Add image"}
                  </button>
                </div>

                <PollDurationPicker value={pollDuration} onChange={setPollDuration} />
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <div className="flex min-w-0 flex-wrap items-center gap-0.5 py-0.5">
              <div className="relative shrink-0">
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-40"
                  aria-label="Attach GIF"
                  disabled={!!gifUrl || pollOpen || !!media}
                >
                  GIF
                </button>
                {pickerOpen && (
                  <GifPicker
                    onSelect={(url) => {
                      setGifUrl(url);
                      setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                  />
                )}
              </div>

              <button
                onClick={() => setEmojiOpen(true)}
                className="shrink-0 rounded-lg p-1.5 text-brand hover:bg-brand/10"
                aria-label="Insert emoji"
              >
                <LuSmile className="h-5 w-5" />
              </button>
              {emojiOpen && (
                <EmojiPicker
                  onSelect={(emoji) => {
                    insertEmoji(emoji);
                    setEmojiOpen(false);
                  }}
                  onClose={() => setEmojiOpen(false)}
                />
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-lg p-1.5 text-brand hover:bg-brand/10 disabled:opacity-40"
                aria-label={
                  pollOpen
                    ? "Attach photo to poll"
                    : videoAllowed
                      ? "Attach photo or video"
                      : "Attach photo"
                }
                disabled={!!gifUrl || !!media || uploadMedia.isPending || (pollOpen && !!pollImage)}
              >
                <LuImagePlus className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={pollOpen ? "image/*" : videoAllowed ? "image/*,video/*" : "image/*"}
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                onClick={() => setTemplateOpen(true)}
                className="shrink-0 rounded-lg p-1.5 text-brand hover:bg-brand/10 disabled:opacity-40"
                aria-label="Add breaking news template"
                disabled={!!gifUrl || pollOpen || !!media || uploadMedia.isPending}
              >
                <LuNewspaper className="h-5 w-5" />
              </button>

              <button
                onClick={() => insertAtCursor("@")}
                className="shrink-0 rounded-lg p-1.5 text-brand hover:bg-brand/10"
                aria-label="Mention someone"
              >
                <LuAtSign className="h-5 w-5" />
              </button>

              <button
                onClick={() => {
                  setPollOpen((v) => !v);
                  if (pollOpen) setPollImage(null);
                }}
                className={`shrink-0 rounded-lg p-1.5 text-brand hover:bg-brand/10 disabled:opacity-40 ${pollOpen ? "bg-brand/10" : ""}`}
                aria-label="Add poll"
                disabled={!!gifUrl || !!media}
              >
                <LuChartNoAxesColumn className="h-5 w-5" />
              </button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              <span className={`text-xs ${content.length > MAX_LEN ? "text-red-500" : "text-neutral-400"}`}>
                {content.length}/{MAX_LEN}
              </span>
              <button
                onClick={submit}
                disabled={!canSubmit || createPost.isPending}
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
              >
                {parentPostId ? "Reply" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onGenerated={(data) => setMedia(data)}
      />
    </div>
  );
}
