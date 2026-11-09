import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useQuery } from "../lib/queryStore";
import type { Message } from "../types";

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

interface MessageHistory extends MessagePage {
  identity: string;
  initialized: boolean;
  loadedOlder: boolean;
}

export const MAX_RETAINED_MESSAGES = 500;

function emptyHistory(identity: string): MessageHistory {
  return {
    identity,
    initialized: false,
    loadedOlder: false,
    messages: [],
    nextCursor: null,
  };
}

export function mergeMessagePages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)
  );
}

export function useMessagePages({
  enabled,
  identity,
  path,
  queryKey,
}: {
  enabled: boolean;
  identity: string;
  path: string;
  queryKey: readonly unknown[];
}) {
  const latest = useQuery({
    queryKey,
    queryFn: () => api.get<MessagePage>(path),
    enabled,
    refetchInterval: 60_000,
  });
  const [history, setHistory] = useState<MessageHistory>(() => emptyHistory(identity));
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setHistory((current) => {
      if (!enabled || !latest.data) {
        return current.identity === identity ? current : emptyHistory(identity);
      }

      const sameThread = current.identity === identity;
      const loadedOlder = sameThread && current.loadedOlder;
      const messages = loadedOlder
        ? mergeMessagePages(current.messages, latest.data.messages)
        : latest.data.messages;

      if (messages.length > MAX_RETAINED_MESSAGES) {
        return {
          identity,
          initialized: true,
          loadedOlder: false,
          ...latest.data,
        };
      }

      return {
        identity,
        initialized: true,
        loadedOlder,
        messages,
        nextCursor: loadedOlder ? current.nextCursor : latest.data.nextCursor,
      };
    });
  }, [enabled, identity, latest.data]);

  useEffect(() => {
    requestIdRef.current += 1;
    setIsLoadingOlder(false);
    setOlderError(null);
  }, [identity]);

  const visibleHistory =
    history.identity === identity && history.initialized
      ? history
      : latest.data
        ? {
            identity,
            initialized: true,
            loadedOlder: false,
            ...latest.data,
          }
        : null;
  const nextCursor = visibleHistory?.nextCursor ?? null;

  const loadOlder = useCallback(async () => {
    if (!enabled || !nextCursor || isLoadingOlder) return;

    const requestId = ++requestIdRef.current;
    setIsLoadingOlder(true);
    setOlderError(null);
    try {
      const separator = path.includes("?") ? "&" : "?";
      const page = await api.get<MessagePage>(
        `${path}${separator}cursor=${encodeURIComponent(nextCursor)}`
      );
      if (requestIdRef.current !== requestId) return;

      setHistory((current) => {
        if (current.identity !== identity) return current;
        return {
          ...current,
          initialized: true,
          loadedOlder: true,
          messages: mergeMessagePages(current.messages, page.messages),
          nextCursor: page.nextCursor,
        };
      });
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setOlderError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      if (requestIdRef.current === requestId) setIsLoadingOlder(false);
    }
  }, [enabled, identity, isLoadingOlder, nextCursor, path]);

  const updateMessage = useCallback(
    (id: string, patch: Partial<Message>) => {
      setHistory((current) => {
        if (current.identity !== identity) return current;
        const index = current.messages.findIndex((message) => message.id === id);
        if (index < 0) return current;
        const messages = [...current.messages];
        messages[index] = { ...messages[index], ...patch };
        return { ...current, messages };
      });
    },
    [identity]
  );

  const data = useMemo<MessagePage | undefined>(
    () =>
      visibleHistory
        ? { messages: visibleHistory.messages, nextCursor: visibleHistory.nextCursor }
        : undefined,
    [visibleHistory]
  );

  return { ...latest, data, loadOlder, isLoadingOlder, olderError, updateMessage };
}
