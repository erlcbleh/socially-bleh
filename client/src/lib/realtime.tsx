import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import type { TypingUser } from "../types";
import { useAuth } from "./authContext";
import { apiOrigin } from "./api";
import { useQueryClient } from "./queryStore";
import { useNavCommunitySlug } from "../hooks/useCommunitySlug";

interface TypingEvent {
  communitySlug: string;
  threadType: "dm" | "group";
  threadId: string;
  user: TypingUser;
  ttlMs: number;
}

interface MessageChangedEvent {
  communitySlug: string;
  conversationId: string;
  kind: "message" | "conversation";
  threadType: "dm" | "group";
}

interface TypingEntry {
  user: TypingUser;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

interface TypingSnapshot {
  typing: TypingUser[];
}

const EMPTY_TYPING: TypingSnapshot = { typing: [] };
const typingEntries = new Map<string, Map<string, TypingEntry>>();
const typingSnapshots = new Map<string, TypingSnapshot>();
const typingListeners = new Map<string, Set<() => void>>();

function typingKey(communitySlug: string, threadType: "dm" | "group", threadId: string) {
  return `${communitySlug.toLowerCase()}:${threadType}:${threadId.toLowerCase()}`;
}

function publishTypingSnapshot(key: string) {
  const entries = typingEntries.get(key);
  if (entries?.size) {
    typingSnapshots.set(key, {
      typing: [...entries.values()].map((entry) => entry.user),
    });
  } else {
    typingEntries.delete(key);
    typingSnapshots.delete(key);
  }
  typingListeners.get(key)?.forEach((listener) => listener());
}

function recordTyping(event: TypingEvent) {
  if (
    !event ||
    !event.communitySlug ||
    !event.threadId ||
    !event.user?.id ||
    !Number.isFinite(event.ttlMs) ||
    event.ttlMs <= 0
  ) {
    return;
  }

  const key = typingKey(event.communitySlug, event.threadType, event.threadId);
  let entries = typingEntries.get(key);
  if (!entries) {
    entries = new Map();
    typingEntries.set(key, entries);
  }

  const previous = entries.get(event.user.id);
  if (previous) clearTimeout(previous.timer);

  const expiresAt = Date.now() + event.ttlMs;
  const timer = setTimeout(() => {
    const current = typingEntries.get(key)?.get(event.user.id);
    if (!current || current.expiresAt !== expiresAt) return;
    typingEntries.get(key)?.delete(event.user.id);
    publishTypingSnapshot(key);
  }, event.ttlMs);

  entries.set(event.user.id, { user: event.user, expiresAt, timer });
  publishTypingSnapshot(key);
}

function clearTyping() {
  for (const entries of typingEntries.values()) {
    for (const entry of entries.values()) clearTimeout(entry.timer);
  }
  const keys = [...typingEntries.keys()];
  typingEntries.clear();
  typingSnapshots.clear();
  keys.forEach((key) => typingListeners.get(key)?.forEach((listener) => listener()));
}

function subscribeCommunity(socket: Socket, slug: string | undefined) {
  if (!slug) {
    socket.emit("community:unsubscribe");
    return;
  }
  socket.emit("community:subscribe", { slug });
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const communitySlug = useNavCommunitySlug();
  const userId = user?.id;
  const socketRef = useRef<Socket | null>(null);
  const communitySlugRef = useRef(communitySlug);
  communitySlugRef.current = communitySlug;

  useEffect(() => {
    if (!userId) {
      clearTyping();
      return;
    }

    const options = { withCredentials: true };
    const socket = apiOrigin ? io(apiOrigin, options) : io(options);
    socketRef.current = socket;

    const invalidateMessages = () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    };
    const invalidatePosts = () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post"] });
      queryClient.invalidateQueries({ queryKey: ["profilePosts"] });
      queryClient.invalidateQueries({ queryKey: ["profileReplies"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["poll"] });
    };
    const invalidateStories = () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    };
    const invalidateSocial = () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    };
    const pendingMessageChanges = new Map<string, MessageChangedEvent>();
    let invalidMessageChange = false;
    let messageInvalidationTimer: ReturnType<typeof setTimeout> | undefined;
    let postsInvalidationTimer: ReturnType<typeof setTimeout> | undefined;
    let storiesInvalidationTimer: ReturnType<typeof setTimeout> | undefined;
    let socialInvalidationTimer: ReturnType<typeof setTimeout> | undefined;
    const flushMessageChanges = () => {
      messageInvalidationTimer = undefined;
      if (invalidMessageChange) {
        invalidMessageChange = false;
        pendingMessageChanges.clear();
        invalidateMessages();
        return;
      }

      for (const event of pendingMessageChanges.values()) {
        queryClient.invalidateQueries({
          queryKey: ["messages", "conversations", event.communitySlug],
        });
        queryClient.invalidateQueries({
          queryKey: ["messages", "unread-count", event.communitySlug],
        });
        if (event.threadType === "group") {
          queryClient.invalidateQueries({
            queryKey: [
              "messages",
              "group-thread",
              event.conversationId,
              event.communitySlug,
            ],
          });
          if (event.kind === "conversation") {
            queryClient.invalidateQueries({
              queryKey: [
                "messages",
                "group",
                event.conversationId,
                event.communitySlug,
              ],
            });
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ["messages", "thread"] });
          queryClient.invalidateQueries({ queryKey: ["messages", "conversation"] });
        }
      }
      pendingMessageChanges.clear();
    };
    const queueMessageChange = (event: MessageChangedEvent) => {
      if (
        !event ||
        !event.communitySlug ||
        !event.conversationId ||
        !["message", "conversation"].includes(event.kind) ||
        !["dm", "group"].includes(event.threadType)
      ) {
        invalidMessageChange = true;
      } else {
        const key = `${event.communitySlug}:${event.conversationId}`;
        const previous = pendingMessageChanges.get(key);
        pendingMessageChanges.set(key, {
          ...event,
          kind:
            previous?.kind === "conversation" || event.kind === "conversation"
              ? "conversation"
              : "message",
        });
      }
      messageInvalidationTimer ??= setTimeout(flushMessageChanges, 150);
    };
    const queuePostsChange = () => {
      postsInvalidationTimer ??= setTimeout(() => {
        postsInvalidationTimer = undefined;
        invalidatePosts();
      }, 150);
    };
    const queueStoriesChange = () => {
      storiesInvalidationTimer ??= setTimeout(() => {
        storiesInvalidationTimer = undefined;
        invalidateStories();
      }, 150);
    };
    const queueSocialChange = () => {
      socialInvalidationTimer ??= setTimeout(() => {
        socialInvalidationTimer = undefined;
        invalidateSocial();
      }, 150);
    };
    const invalidateNotifications = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    let connectedOnce = false;
    const refreshAfterReconnect = () => {
      subscribeCommunity(socket, communitySlugRef.current);
      if (!connectedOnce) {
        connectedOnce = true;
        return;
      }
      invalidateMessages();
      invalidateNotifications();
      invalidatePosts();
      invalidateStories();
      invalidateSocial();
    };

    socket.on("connect", refreshAfterReconnect);
    socket.on("messages:changed", queueMessageChange);
    socket.on("notifications:changed", invalidateNotifications);
    socket.on("messages:typing", recordTyping);
    socket.on("posts:changed", queuePostsChange);
    socket.on("stories:changed", queueStoriesChange);
    socket.on("social:changed", queueSocialChange);

    if (socket.connected) subscribeCommunity(socket, communitySlugRef.current);

    return () => {
      if (messageInvalidationTimer) clearTimeout(messageInvalidationTimer);
      if (postsInvalidationTimer) clearTimeout(postsInvalidationTimer);
      if (storiesInvalidationTimer) clearTimeout(storiesInvalidationTimer);
      if (socialInvalidationTimer) clearTimeout(socialInvalidationTimer);
      socketRef.current = null;
      socket.emit("community:unsubscribe");
      socket.disconnect();
      clearTyping();
    };
  }, [queryClient, userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userId) return;
    subscribeCommunity(socket, communitySlug);
  }, [communitySlug, userId]);

  return children;
}

export function useRealtimeTyping(
  communitySlug: string,
  threadType: "dm" | "group",
  threadId: string | undefined
) {
  const key = threadId ? typingKey(communitySlug, threadType, threadId) : null;
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!key) return () => {};
      let listeners = typingListeners.get(key);
      if (!listeners) {
        listeners = new Set();
        typingListeners.set(key, listeners);
      }
      listeners.add(listener);
      return () => {
        listeners?.delete(listener);
        if (!listeners?.size) typingListeners.delete(key);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(
    () => (key ? typingSnapshots.get(key) ?? EMPTY_TYPING : EMPTY_TYPING),
    [key]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
