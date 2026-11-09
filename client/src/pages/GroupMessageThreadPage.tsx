import { communityPath } from "../lib/communityPath";
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LuArrowLeft, LuSend, LuImagePlus, LuUsers, LuUserPlus, LuUserMinus, LuPencil, LuSmile } from "react-icons/lu";
import { useQueryClient, useQuery } from "../lib/queryStore";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import {
  useGroup,
  useGroupMessages,
  useSendGroupMessage,
  useAddGroupMember,
  useRemoveGroupMember,
  useUpdateGroup,
  useReportMessage,
  useMutualFriends,
  useEditMessage,
  useDeleteMessage,
  useReactToMessage,
  useGroupTyping,
  useTypingHeartbeat,
} from "../hooks/useMessages";
import { useCommunitySlug } from "../hooks/useCommunitySlug";
import { useUploadMedia } from "../hooks/useMediaUpload";
import { Avatar } from "../components/shared/Avatar";
import { UserBadges } from "../components/shared/UserBadges";
import { Modal } from "../components/shared/Modal";
import { ReportDialog } from "../components/post/ReportDialog";
import { PostEmbedPreview } from "../components/post/PostEmbedPreview";
import { GifPicker } from "../components/post/GifPicker";
import { MessageMeta } from "../components/shared/MessageMeta";
import { MessageActions, ReactionRow, TypingIndicator } from "../components/shared/MessageActions";
import type { User } from "../types";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { EmojiTextarea } from "../components/shared/EmojiTextarea";
import { renderWithEmoji } from "../lib/emoji";

function GroupInfoModal({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const slug = useCommunitySlug();
  const { data } = useGroup(groupId);
  const addMember = useAddGroupMember(groupId);
  const removeMember = useRemoveGroupMember(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const group = data?.group;

  useEffect(() => {
    if (group) setName(group.name);
  }, [group?.id]);

  const { data: searchData } = useMutualFriends(query, open);

  if (!group) return null;
  const memberIds = new Set(group.participants.map((p) => p.id));
  const results = (searchData?.users ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <Modal open={open} onClose={onClose} title="Group info">
      <div className="space-y-4">
        {group.isCreator && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Group name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button
                onClick={() => updateGroup.mutate({ name })}
                disabled={updateGroup.isPending || name === group.name}
                className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Members ({group.participants.length})</p>
          <div className="space-y-1">
            {group.participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar user={p} size={8} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-sm font-medium">{p.displayName}</p>
                      <UserBadges user={p} className="h-3.5 w-3.5" />
                    </div>
                    <p className="truncate text-xs text-neutral-500">
                      @{p.username} {p.id === group.createdBy && "· Creator"}
                    </p>
                  </div>
                </div>
                {(p.id === user?.id || group.isCreator) && p.id !== group.createdBy && (
                  <button
                    onClick={() => removeMember.mutate(p.username)}
                    disabled={removeMember.isPending}
                    aria-label={p.id === user?.id ? "Leave group" : "Remove member"}
                    className="shrink-0 p-1.5 text-red-500 hover:text-red-600 disabled:opacity-40"
                  >
                    <LuUserMinus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">Add people</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your friends"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
          />
          {addMember.isError && <p className="mt-1 text-sm text-red-500">{(addMember.error as Error).message}</p>}
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => addMember.mutate(u.username, { onSuccess: () => setQuery("") })}
                disabled={addMember.isPending}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-neutral-50 disabled:opacity-40 dark:hover:bg-neutral-800"
              >
                <Avatar user={u} size={8} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.displayName}</p>
                  <p className="truncate text-xs text-neutral-500">@{u.username}</p>
                </div>
                <LuUserPlus className="ml-auto h-4 w-4 shrink-0 text-brand" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function GroupMessageThreadPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const slug = useCommunitySlug();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: groupData } = useGroup(groupId);
  const {
    data: messagesData,
    loadOlder,
    isLoadingOlder,
    olderError,
    updateMessage,
  } = useGroupMessages(groupId);
  const sendMessage = useSendGroupMessage(groupId);
  const reportMessage = useReportMessage();
  const threadKey = ["messages", "group-thread", groupId];
  const editMessage = useEditMessage(threadKey, updateMessage);
  const deleteMessage = useDeleteMessage(threadKey, updateMessage);
  const reactToMessage = useReactToMessage(threadKey, updateMessage);
  const { data: typingData } = useGroupTyping(groupId);
  const heartbeat = useTypingHeartbeat(groupId ? `groups/${groupId}` : null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const uploadMedia = useUploadMedia();
  const [content, setContent] = useState("");
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readForRef = useRef<string | undefined>(undefined);

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

  const group = groupData?.group;
  const memberMap = new Map((group?.participants ?? []).map((p) => [p.id, p]));

  useEffect(() => {
    const readKey = groupId ? `${slug}:${groupId}` : undefined;
    if (!readKey || !messagesData || readForRef.current === readKey) return;
    readForRef.current = readKey;
    queryClient.invalidateQueries({ queryKey: ["messages", "unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
  }, [slug, groupId, messagesData, queryClient]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);

  const scrollToBottom = (smooth = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const doScroll = () => {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    };
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
    setTimeout(doScroll, 150);
  };

  const lastMessageId = messagesData?.messages[messagesData.messages.length - 1]?.id;

  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [groupId]);

  useEffect(() => {
    if (!messagesData?.messages || messagesData.messages.length === 0) return;

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      scrollToBottom(false);
    } else {
      scrollToBottom(true);
    }
  }, [lastMessageId]);

  const canSubmit = !!content.trim() || !!gifUrl || !!mediaUrl;

  const submit = () => {
    if (!canSubmit || sendMessage.isPending) return;
    sendMessage.mutate(
      { content: content.trim(), gifUrl: gifUrl || undefined, mediaUrl: mediaUrl || undefined },
      {
        onSuccess: () => {
          setContent("");
          setGifUrl(null);
          setMediaUrl(null);
          scrollToBottom(true);
        },
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachError(null);
    uploadMedia.mutate(file, {
      onSuccess: (data) => {
        if (data.type === "video") {
          setAttachError("Videos aren't supported in messages");
          return;
        }
        setMediaUrl(data.url);
      },
    });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  if (!groupId) return null;

  return (
    <div className="flex h-[calc(100svh-4rem-env(safe-area-inset-bottom))] flex-col overflow-hidden sm:h-[calc(100svh-4rem)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 bg-white/80 p-3 backdrop-blur dark:border-neutral-800 dark:bg-black/80">
        <button onClick={() => navigate(communityPath(slug, `messages`))} className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900" aria-label="Back">
          <LuArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-800">
            <LuUsers className="h-4 w-4" />
          </div>
          <span className="truncate font-medium">{group?.name || group?.participants.filter((p) => p.id !== user?.id).map((p) => p.displayName).join(", ")}</span>
        </button>
        <button onClick={() => setInfoOpen(true)} aria-label="Group info" className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900">
          <LuPencil className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollContainerRef} className="custom-scrollbar flex-1 space-y-2 overflow-y-auto overscroll-y-contain p-4">
        {messagesData?.nextCursor && (
          <div className="text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={isLoadingOlder}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/10 disabled:opacity-50"
            >
              {isLoadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
        {olderError && <p className="text-center text-sm text-red-500">{olderError.message}</p>}
        {messagesData?.messages.map((m) => {
          const mine = m.sender === user?.id;
          const sender = memberMap.get(m.sender);
          return (
            <div key={m.id} className={`group flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && <Avatar user={sender ?? { displayName: "?", avatarUrl: "" }} size={6} />}
              <div className="flex flex-col">
                {!mine && sender && <span className="ml-1 mb-0.5 text-xs text-neutral-500">{sender.displayName}</span>}
                <div className="flex items-center gap-1">
                  {!mine && !m.deleted && (
                    <MessageActions
                      mine={false}
                      canEdit={false}
                      canDeleteStaff={["staff", "admin", "developer", "owner"].includes(user?.role || "")}
                      onReact={(emoji) => reactToMessage.mutate({ id: m.id, emoji })}
                      onEdit={() => {}}
                      onDelete={() => deleteMessage.mutate(m.id)}
                      onReport={() => setReportMessageId(m.id)}
                    />
                  )}
                  {m.deleted ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm italic text-neutral-400 dark:border-neutral-700">
                      This message was deleted
                    </div>
                  ) : editingId === m.id ? (
                    <div className="w-full max-w-sm">
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      {editMessage.isError && (
                        <p className="mt-1 text-xs text-red-500">{(editMessage.error as Error).message}</p>
                      )}
                      <div className="mt-1 flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium dark:border-neutral-700">
                          Cancel
                        </button>
                        <button
                          onClick={() => editMessage.mutate({ id: m.id, content: editValue.trim() }, { onSuccess: () => setEditingId(null) })}
                          disabled={!editValue.trim() || editMessage.isPending}
                          className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`w-fit whitespace-pre-wrap break-words rounded-lg px-4 py-2 text-sm ${
                      m.sharedPost || m.sharedPostUnavailable || m.mediaUrl || m.gifUrl ? "max-w-sm" : "max-w-xs"
                    } ${mine ? "bg-brand text-white" : "bg-neutral-100 dark:bg-neutral-800"}`}
                  >
                    {(m.sharedPost || m.sharedPostUnavailable) && (
                      <PostEmbedPreview post={m.sharedPost} unavailable={m.sharedPostUnavailable} tone={mine ? "onBrand" : "default"} className="" />
                    )}
                    {(m.mediaUrl || m.gifUrl) && (
                      <img src={m.mediaUrl || m.gifUrl || undefined} alt={m.gifUrl ? "GIF" : "Attached image"} className="max-h-64 max-w-full rounded-lg" />
                    )}
                    {m.content && (
                      <p className={m.sharedPost || m.sharedPostUnavailable || m.mediaUrl || m.gifUrl ? "mt-2" : undefined}>{renderWithEmoji(m.content)}</p>
                    )}
                    <MessageMeta
                      createdAt={m.createdAt}
                      status={m.status}
                      mine={mine}
                      edited={!!m.editedAt}
                      moderation={m.moderation}
                      moderationReason={m.moderationReason}
                    />
                  </div>
                  <ReactionRow
                    reactions={m.reactions || []}
                    onToggle={(emoji) => reactToMessage.mutate({ id: m.id, emoji })}
                    align={mine ? "end" : "start"}
                  />
                  </div>
                  )}
                  {mine && !m.deleted && editingId !== m.id && (
                    <MessageActions
                      mine
                      canEdit={!!m.content && Date.now() - new Date(m.createdAt).getTime() < 15 * 60 * 1000}
                      onReact={(emoji) => reactToMessage.mutate({ id: m.id, emoji })}
                      onEdit={() => {
                        setEditingId(m.id);
                        setEditValue(m.content);
                      }}
                      onDelete={() => deleteMessage.mutate(m.id)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <TypingIndicator names={(typingData?.typing || []).map((t) => t.displayName)} />

      <div className="shrink-0 border-t border-neutral-100 p-3 dark:border-neutral-800">
        {gifUrl && (
          <div className="relative mb-2 inline-block max-w-full">
            <img src={gifUrl} alt="Selected GIF" className="max-h-40 max-w-full rounded-lg" />
            <button onClick={() => setGifUrl(null)} className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
              Remove
            </button>
          </div>
        )}

        {mediaUrl && (
          <div className="relative mb-2 inline-block max-w-full">
            <img src={mediaUrl} alt="Attached image" className="max-h-40 max-w-full rounded-lg" />
            <button onClick={() => setMediaUrl(null)} className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
              Remove
            </button>
          </div>
        )}

        {uploadMedia.isPending && <p className="mb-2 text-sm text-neutral-500">Uploading…</p>}

        <div className="flex items-end gap-2">
          <div className="relative flex items-center">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-full p-2 text-brand hover:bg-brand/10"
              aria-label="Attach GIF"
              disabled={!!gifUrl || !!mediaUrl}
            >
              GIF
            </button>
            {pickerOpen && (
              <GifPicker
                direction="up"
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
            className="rounded-full p-2 text-brand hover:bg-brand/10"
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
            className="rounded-full p-2 text-brand hover:bg-brand/10"
            aria-label="Attach image"
            disabled={!!gifUrl || !!mediaUrl || uploadMedia.isPending}
          >
            <LuImagePlus className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          <EmojiTextarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              heartbeat();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Message the group"
            rows={1}
            wrapperClassName="max-h-40 flex-1 overflow-hidden rounded-lg bg-neutral-100 focus-within:ring-2 focus-within:ring-brand dark:bg-neutral-900"
            className="max-h-40 resize-none px-4 py-2 text-sm outline-none"
          />
          <button onClick={submit} disabled={!canSubmit || sendMessage.isPending} className="rounded-full bg-brand p-2.5 text-white disabled:opacity-40" aria-label="Send">
            <LuSend className="h-4 w-4" />
          </button>
        </div>
        {attachError && <p className="mt-2 text-sm text-red-500">{attachError}</p>}
        {uploadMedia.isError && !attachError && <p className="mt-2 text-sm text-red-500">{(uploadMedia.error as Error).message}</p>}
        {sendMessage.isError && <p className="mt-2 text-sm text-red-500">{(sendMessage.error as Error).message}</p>}
      </div>

      <ReportDialog
        open={!!reportMessageId}
        onClose={() => setReportMessageId(null)}
        title="Report message"
        isSubmitting={reportMessage.isPending}
        onSubmit={(reason, details) => {
          if (!reportMessageId) return;
          reportMessage.mutate({ id: reportMessageId, reason, details }, { onSuccess: () => setReportMessageId(null) });
        }}
      />

      <GroupInfoModal groupId={groupId} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}
