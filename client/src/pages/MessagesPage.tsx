import { communityPath } from "../lib/communityPath";
import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "../lib/queryStore";
import { LuPlus, LuUsers, LuTrash2 } from "react-icons/lu";
import { api } from "../lib/api";
import { useConversations, useCreateGroup, useMutualFriends } from "../hooks/useMessages";
import { useCommunitySlug } from "../hooks/useCommunitySlug";
import { useConfirm } from "../components/shared/ConfirmDialog";
import { readHiddenConversations, hideConversation, isConversationHidden } from "../lib/hiddenConversations";
import { Avatar } from "../components/shared/Avatar";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import { Modal } from "../components/shared/Modal";
import { UserBadges } from "../components/shared/UserBadges";
import type { User } from "../types";

const REVEAL_WIDTH = 84;
const DELETE_THRESHOLD = 168;

function SwipeableRow({ to, onDelete, children }: { to: string; onDelete: () => void; children: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const revealed = useRef(false);
  const engaged = useRef(false);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    engaged.current = false;
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!engaged.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        engaged.current = true;
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > 8) {
        start.current = null;
        return;
      }
    }
    if (engaged.current) {
      moved.current = true;
      const base = revealed.current ? -REVEAL_WIDTH : 0;
      const next = Math.max(-(DELETE_THRESHOLD + 48), Math.min(0, base + dx));
      setOffset(next);
    }
  };

  const settle = () => {
    if (engaged.current) {
      if (offset <= -DELETE_THRESHOLD) {
        setOffset(0);
        revealed.current = false;
        onDelete();
      } else if (offset <= -REVEAL_WIDTH / 2) {
        setOffset(-REVEAL_WIDTH);
        revealed.current = true;
      } else {
        setOffset(0);
        revealed.current = false;
      }
    }
    start.current = null;
    engaged.current = false;
    setIsDragging(false);
  };

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete conversation"
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 px-6 text-white"
        style={{ width: Math.max(REVEAL_WIDTH, -offset) }}
      >
        <LuTrash2 className="h-5 w-5" />
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        className="relative bg-white dark:bg-black"
      >
        <Link to={to} className="flex items-center gap-3 p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
          {children}
        </Link>
      </div>
    </div>
  );
}

function NewMessageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const slug = useCommunitySlug();

  const { data } = useQuery({
    queryKey: ["users", "search", query, slug],
    queryFn: () => api.get<{ users: User[] }>(`/communities/${slug}/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a person"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {data?.users.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              onClose();
              navigate(communityPath(slug, `messages/${u.username}`));
            }}
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Avatar user={u} size={9} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-sm font-medium">{u.displayName}</p>
                <UserBadges user={u} className="h-3.5 w-3.5" />
              </div>
              <p className="truncate text-sm text-neutral-500">@{u.username}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function NewGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<User[]>([]);
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const slug = useCommunitySlug();
  const createGroup = useCreateGroup();

  const { data } = useMutualFriends(query, open);

  const toggle = (u: User) => {
    setSelected((prev) => (prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]));
  };

  const close = () => {
    onClose();
    setQuery("");
    setSelected([]);
    setName("");
  };

  const submit = () => {
    createGroup.mutate(
      { usernames: selected.map((u) => u.username), name: name.trim() },
      {
        onSuccess: (res) => {
          close();
          navigate(communityPath(slug, `messages/group/${res.group.id}`));
        },
      }
    );
  };

  return (
    <Modal open={open} onClose={close} title="New group">
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/20"
            >
              @{u.username} ×
            </button>
          ))}
        </div>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name (optional)"
        maxLength={50}
        className="mb-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your friends"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
        {data?.users.map((u) => {
          const isSelected = selected.some((p) => p.id === u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className={`flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                isSelected ? "bg-brand/5 dark:bg-brand/10" : ""
              }`}
            >
              <Avatar user={u} size={9} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.displayName}</p>
                <p className="truncate text-sm text-neutral-500">@{u.username}</p>
              </div>
            </button>
          );
        })}
      </div>

      {createGroup.isError && <p className="mt-2 text-sm text-red-500">{(createGroup.error as Error).message}</p>}

      <button
        onClick={submit}
        disabled={selected.length < 2 || createGroup.isPending}
        className="mt-3 w-full rounded-full bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {createGroup.isPending ? "Creating…" : `Create group${selected.length ? ` (${selected.length + 1})` : ""}`}
      </button>
      <p className="mt-1 text-center text-xs text-neutral-400">Groups need at least 2 other members.</p>
    </Modal>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function GroupAvatar({ participants }: { participants: User[] }) {
  const shown = participants.slice(0, 2);
  if (shown.length === 0) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-400 dark:bg-neutral-800">
        <LuUsers className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="relative h-11 w-11 shrink-0">
      <div className="absolute left-0 top-0 h-8 w-8 overflow-hidden rounded-full ring-2 ring-white dark:ring-black">
        <Avatar user={shown[0]} size={8} />
      </div>
      {shown[1] && (
        <div className="absolute bottom-0 right-0 h-8 w-8 overflow-hidden rounded-full ring-2 ring-white dark:ring-black">
          <Avatar user={shown[1]} size={8} />
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const slug = useCommunitySlug();
  const {
    data,
    isLoading,
    isLoadingMore,
    loadMore,
    loadMoreError,
  } = useConversations();
  const [modalOpen, setModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [hidden, setHidden] = useState(() => readHiddenConversations());
  const { confirm, dialog } = useConfirm();

  const requestDelete = (username: string, displayName: string) =>
    confirm({
      title: "Delete conversation",
      description: `This removes the conversation with ${displayName} from your list. It will reappear if they message you again.`,
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: () => setHidden(hideConversation(username)),
    });

  const visibleConversations = (data?.conversations ?? []).filter(
    (c) => c.isGroup || !c.otherUser || !isConversationHidden(hidden, c.otherUser.username, c.lastMessageAt)
  );

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <h1 className="text-xl font-medium">Messages</h1>
        <div className="flex gap-1">
          <button
            onClick={() => setGroupModalOpen(true)}
            className="rounded-lg p-2 text-brand hover:bg-brand/10"
            aria-label="New group"
          >
            <LuUsers className="h-5 w-5" />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-brand p-2 text-white hover:bg-brand-dark"
            aria-label="New message"
          >
            <LuPlus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
      {!isLoading && data && visibleConversations.length === 0 && (
        <p className="p-6 text-center text-neutral-400">No messages yet. Start a conversation.</p>
      )}

      {visibleConversations.map((c) => {
        const isDeletedPeer = !c.isGroup && !!c.otherUser?.isDeleted;
        const rowBody = (
          <>
            {c.isGroup ? <GroupAvatar participants={c.groupParticipants ?? []} /> : c.otherUser && <Avatar user={c.otherUser} size={11} />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1">
                  <p className={`truncate font-medium ${isDeletedPeer ? "text-neutral-500" : ""}`}>
                    {c.isGroup ? c.groupName : c.otherUser?.displayName}
                  </p>
                  {!c.isGroup && c.otherUser && !isDeletedPeer && (
                    <UserBadges user={c.otherUser} className="h-3.5 w-3.5" />
                  )}
                  {isDeletedPeer && c.otherUser && (
                    <span className="ml-1 shrink-0 text-xs text-neutral-500">@{c.otherUser.username}</span>
                  )}
                </div>
                {c.lastMessageAt && <span className="shrink-0 text-xs text-neutral-500">{timeAgo(c.lastMessageAt)}</span>}
              </div>
              <p className="truncate text-sm text-neutral-500">{c.lastMessageText || "No messages yet"}</p>
            </div>
            {c.unreadCount > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
          </>
        );

        if (c.isGroup) {
          return (
            <Link
              key={c.id}
              to={communityPath(slug, `messages/group/${c.id}`)}
              className="flex items-center gap-3 p-4 rounded-md hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50"
            >
              {rowBody}
            </Link>
          );
        }

        if (isDeletedPeer || !c.otherUser) {
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-md p-4 opacity-70"
              aria-label="Conversation with a deleted account"
            >
              {rowBody}
            </div>
          );
        }

        return (
          <SwipeableRow
            key={c.id}
            to={communityPath(slug, `messages/${c.otherUser.username}`)}
            onDelete={() => requestDelete(c.otherUser!.username, c.otherUser!.displayName)}
          >
            {rowBody}
          </SwipeableRow>
        );
      })}

      {data?.hasMore && data.nextCursor && (
        <div className="flex justify-center p-4">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
      {loadMoreError && (
        <p className="px-4 pb-4 text-center text-sm text-red-500">
          {loadMoreError.message}
        </p>
      )}

      <NewMessageModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <NewGroupModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} />
      {dialog}
    </div>
  );
}
