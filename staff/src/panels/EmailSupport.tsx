import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import type { EmailConversation, Mailbox } from "../types";
import {
  ActionButton,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Segmented,
  TextInput,
} from "../components/panelKit";
import { ConversationList } from "../components/email/ConversationList";
import { ConversationView } from "../components/email/ConversationView";
import { ComposeEmail } from "../components/email/ComposeEmail";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "unread", label: "Unread" },
  { value: "claimed", label: "Claimed" },
  { value: "waiting_customer", label: "Waiting" },
  { value: "pending_staff", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

export function EmailSupport() {
  const { staff } = useAuth();
  const [conversations, setConversations] = useState<EmailConversation[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailbox, setMailbox] = useState<string>("support");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("open");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const activeMailbox = mailboxes.find((box) => box.key === mailbox) ?? null;

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: filter, mailbox });
      if (search.trim()) params.set("search", search.trim());
      const data = await api.get<{
        items: EmailConversation[];
        nextCursor: string | null;
        mailboxes?: Mailbox[];
      }>(`/email/conversations?${params.toString()}`);
      setConversations(data.items);
      if (data.mailboxes) setMailboxes(data.mailboxes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load conversations"));
    } finally {
      setIsLoading(false);
    }
  }, [filter, search, mailbox]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (!staff?.isAdmin) {
    return (
      <PanelShell>
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
          Admin access required to view Email Support.
        </div>
      </PanelShell>
    );
  }

  if (selectedId) {
    return (
      <ConversationView
        conversationId={selectedId}
        onBack={() => setSelectedId(null)}
        onUpdated={loadConversations}
      />
    );
  }

  return (
    <PanelShell>
      {mailboxes.length > 1 ? (
        <div className="flex shrink-0 gap-1 border-b border-panel-border px-4 pt-3">
          {mailboxes.map((box) => {
            const isActive = mailbox === box.key;
            return (
              <button
                key={box.key}
                onClick={() => {
                  setMailbox(box.key);
                  setSelectedId(null);
                }}
                title={box.address}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-white text-white"
                    : "border-transparent text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {box.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <PanelToolbar>
        <TextInput value={search} onChange={setSearch} placeholder="Search subject or email…" className="flex-1" />
        {activeMailbox?.compose ? (
          <ActionButton tone="primary" onClick={() => setComposing(true)}>
            Compose
          </ActionButton>
        ) : null}
      </PanelToolbar>

      <PanelToolbar>
        <Segmented value={filter} options={FILTERS} onChange={setFilter} />
        <span className="ml-auto text-[13px] text-neutral-500">{conversations.length}</span>
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={conversations.length === 0}
          emptyLabel="No conversations found."
        />
        {!isLoading && !error && conversations.length > 0 ? (
          <ConversationList conversations={conversations} onSelectId={setSelectedId} />
        ) : null}
      </PanelScroll>

      {composing && activeMailbox ? (
        <ComposeEmail
          mailbox={activeMailbox}
          onClose={() => setComposing(false)}
          onSent={(conversationId) => {
            setComposing(false);
            loadConversations();
            setSelectedId(conversationId);
          }}
        />
      ) : null}
    </PanelShell>
  );
}
