import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/authContext";
import { ActionButton } from "../panelKit";
import type { EmailAttachment, EmailConversation, EmailMessage, InternalNote } from "../../types";
import {
  ATTACHMENT_ACCEPT,
  MAX_OUTBOUND_ATTACHMENTS,
  fileToAttachment,
  validateAttachmentFile,
} from "./attachments";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "claimed", label: "Claimed" },
  { value: "pending_staff", label: "Pending Staff" },
  { value: "waiting_customer", label: "Waiting on Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const OVERRIDE_ROLES = new Set(["developer", "owner"]);

const REMINDERS = [
  "You are communicating on behalf of the organization. Please ensure your response is professional, respectful, and easy to understand.",
  "Before sending, check your spelling, grammar (SPAG), punctuation, tone, and clarity.",
  "We strongly recommend copying your response into a trusted third-party AI tool (such as ChatGPT, Claude, or another approved writing assistant) to proofread and improve professionalism before sending.",
];

function fullTimestamp(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function attachmentUrl(conversationId: string, attachmentId: string) {
  return `/api/staff/email/conversations/${conversationId}/attachments/${attachmentId}`;
}

function rewriteCidReferences(html: string, conversationId: string, attachments: EmailAttachment[]) {
  if (!attachments.length) return html;
  const byFilename = new Map<string, EmailAttachment>();
  for (const att of attachments) {
    byFilename.set(att.filename.toLowerCase(), att);
    const stem = att.filename.replace(/\.[^.]+$/, "").toLowerCase();
    if (stem && !byFilename.has(stem)) byFilename.set(stem, att);
  }
  return html.replace(/(src|href)\s*=\s*(["'])cid:([^"']+)\2/gi, (match, attr, quote, cidRaw) => {
    const cid = decodeURIComponent(cidRaw).trim().toLowerCase();
    const localPart = cid.split("@")[0];
    const hit =
      byFilename.get(cid) ||
      byFilename.get(localPart) ||
      byFilename.get(localPart.replace(/\.[^.]+$/, ""));
    if (!hit) return match;
    return `${attr}=${quote}${attachmentUrl(conversationId, hit.id)}${quote}`;
  });
}

const EMAIL_FRAME_STYLE = `
<meta name="color-scheme" content="dark">
<style>
  :root { color-scheme: dark; }
  html, body {
    background: transparent !important;
    color: #e5e5e5 !important;
    margin: 0;
    padding: 12px 14px;
    font-family: Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  body, table, tbody, thead, tfoot, tr, td, th, div, section, article, main,
  header, footer, aside, nav, center, p, span, li, ul, ol, figure {
    background-color: transparent !important;
    background-image: none !important;
  }
  *, *::before, *::after { color: inherit !important; border-color: rgba(255,255,255,0.12) !important; }
  a, a * { color: #93c5fd !important; text-decoration: underline; }
  img, video { max-width: 100%; height: auto; border-radius: 8px; background: transparent !important; }
  blockquote { border-left: 3px solid rgba(255,255,255,0.15); margin: 0 0 0 4px; padding-left: 10px; color: #a3a3a3 !important; }
  table { max-width: 100%; border-collapse: collapse; }
  pre, code { background: rgba(255,255,255,0.06) !important; padding: 2px 4px; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid rgba(255,255,255,0.12); }
</style>
`;

const COLLAPSED_MAX_HEIGHT = 240;
const LONG_CHAR_THRESHOLD = 800;

function plainTextLength(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().length;
}

function MessageBody({ email, conversationId }: { email: EmailMessage; conversationId: string }) {
  const imageAttachments = email.attachments?.filter((att) => att.mimeType.startsWith("image/")) ?? [];

  const html = email.html ? `${EMAIL_FRAME_STYLE}${rewriteCidReferences(email.html, conversationId, email.attachments || [])}` : null;

  const measuredLength = email.html ? plainTextLength(email.html) : (email.text?.length ?? 0);
  const isLong = measuredLength > LONG_CHAR_THRESHOLD;

  const [expanded, setExpanded] = useState(!isLong);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const applyHeight = useCallback(
    (h: number, isExpanded: boolean) => {
      const frame = iframeRef.current;
      if (!frame) return;
      if (isExpanded) {
        frame.style.height = `${Math.max(h + 4, 160)}px`;
      } else {
        frame.style.height = `${Math.min(Math.max(h + 4, 160), COLLAPSED_MAX_HEIGHT)}px`;
      }
    },
    []
  );

  useEffect(() => {
    if (contentHeight !== null) applyHeight(contentHeight, expanded);
  }, [expanded, contentHeight, applyHeight]);

  const showFade = !expanded && (contentHeight === null || contentHeight > COLLAPSED_MAX_HEIGHT);

  return (
    <div className="flex flex-col gap-2">
      {html ? (
        <div className="relative">
          <iframe
            ref={iframeRef}
            title={`email-${email.id}`}
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={(event) => {
              const frame = event.currentTarget;
              try {
                const doc = frame.contentDocument;
                if (!doc) return;
                const measure = () => {
                  const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
                  setContentHeight(h);
                  applyHeight(h, expanded);
                };
                measure();
                doc.querySelectorAll("img").forEach((img) => {
                  img.addEventListener("load", measure);
                  img.addEventListener("error", measure);
                });
              } catch {
                
              }
            }}
            scrolling="no"
            className="block min-h-[160px] w-full rounded-squircle border border-panel-border bg-panel-raised"
          />
          {showFade ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-squircle bg-gradient-to-b from-transparent to-panel-raised"
            />
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <pre
            className="overflow-hidden whitespace-pre-wrap break-words rounded-squircle border border-panel-border bg-panel-raised p-3 font-sans text-sm text-neutral-200"
            style={{ maxHeight: expanded ? undefined : COLLAPSED_MAX_HEIGHT }}
          >
            {email.text || "(no content)"}
          </pre>
          {!expanded && isLong ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-squircle bg-gradient-to-b from-transparent to-panel-raised"
            />
          ) : null}
        </div>
      )}

      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start rounded-full border border-panel-border px-3 py-1 text-[12px] text-neutral-300 transition-colors hover:border-white/40 hover:text-white"
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}

      {imageAttachments.length ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {imageAttachments.map((att) => (
            <a
              key={att.id}
              href={attachmentUrl(conversationId, att.id)}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-squircle border border-panel-border bg-panel-raised"
            >
              <img
                src={attachmentUrl(conversationId, att.id)}
                alt={att.filename}
                className="max-h-72 w-auto max-w-full object-contain"
              />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ConversationView({
  conversationId,
  onBack,
  onUpdated,
}: {
  conversationId: string;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const { user, staff } = useAuth();
  const [conversation, setConversation] = useState<EmailConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [noteText, setNoteText] = useState("");
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoadedFor = useRef<string | null>(null);
  const replyFileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<EmailConversation>(`/email/conversations/${conversationId}`);
      setConversation(data);
      if (draftLoadedFor.current !== conversationId) {
        const mine = data.drafts?.find((draft) => draft.author?.id === user?.id);
        setReplyText(mine?.content ?? "");
        draftLoadedFor.current = conversationId;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canOverride = OVERRIDE_ROLES.has(staff?.role ?? "");
  const isOwner = Boolean(conversation?.claimedBy && conversation.claimedBy.id === user?.id);
  const canAct = isOwner || canOverride;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const claim = () => run(() => api.post(`/email/conversations/${conversationId}/claim`));
  const unclaim = () => run(() => api.post(`/email/conversations/${conversationId}/unclaim`));
  const changeStatus = (status: string) =>
    run(() => api.post(`/email/conversations/${conversationId}/status`, { status }));

  const addNote = () => {
    const content = noteText.trim();
    if (!content) return;
    run(() => api.post(`/email/conversations/${conversationId}/notes`, { content }).then(() => setNoteText("")));
  };

  const onReplyChange = (value: string) => {
    setReplyText(value);
    if (!canAct) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      api.post(`/email/conversations/${conversationId}/draft`, { content: value }).catch(() => {});
    }, 1000);
  };

  const addReplyFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next = [...replyFiles];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_OUTBOUND_ATTACHMENTS) {
        setError(`Attach at most ${MAX_OUTBOUND_ATTACHMENTS} images.`);
        break;
      }
      const invalid = validateAttachmentFile(file);
      if (invalid) {
        setError(invalid);
        continue;
      }
      next.push(file);
    }
    setReplyFiles(next);
    if (replyFileInput.current) replyFileInput.current.value = "";
  };

  const removeReplyFile = (index: number) => setReplyFiles((prev) => prev.filter((_, i) => i !== index));

  const sendReply = (isReplyAll: boolean) => {
    const content = replyText.trim();
    if (!content) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    run(async () => {
      const attachments = await Promise.all(replyFiles.map(fileToAttachment));
      await api.post(`/email/conversations/${conversationId}/reply`, { content, isReplyAll, attachments });
      setReplyText("");
      setReplyFiles([]);
    });
  };

  const deleteDraft = () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    run(() => api.delete(`/email/conversations/${conversationId}/draft`).then(() => setReplyText("")));
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center bg-panel-bg p-6 text-sm text-neutral-500">Loading conversation…</div>;
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col bg-panel-bg p-5">
        <button onClick={onBack} className="self-start text-[13px] text-neutral-400 transition-colors hover:text-white">
          ← Back to inbox
        </button>
        <div className="mt-4 rounded-lg border border-severity-high/40 bg-severity-high/5 px-4 py-3 text-sm text-severity-high">
          {error || "Conversation not found"}
        </div>
      </div>
    );
  }

  const emails = conversation.emails ?? [];
  const notes = conversation.internalNotes ?? [];

  return (
    <div className="flex h-full flex-col bg-panel-bg">
      <div className="flex items-start gap-3 border-b border-panel-border px-5 py-4">
        <button onClick={onBack} className="mt-0.5 text-[13px] text-neutral-400 transition-colors hover:text-white">
          ← Back
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white">{conversation.subject}</h2>
          <p className="truncate text-sm text-neutral-400">{conversation.customerEmail}</p>
          <div className="mt-1 text-[13px] text-neutral-500">
            {conversation.claimedBy ? (
              <span>
                Claimed by{" "}
                <span className="font-medium text-neutral-300">
                  {conversation.claimedBy.displayName || conversation.claimedBy.username}
                </span>
                {conversation.claimedAt ? ` · ${fullTimestamp(conversation.claimedAt)}` : ""}
              </span>
            ) : (
              <span>Unclaimed</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {!conversation.claimedBy ? (
            <ActionButton tone="primary" onClick={claim} disabled={busy}>
              Claim
            </ActionButton>
          ) : canAct ? (
            <ActionButton onClick={unclaim} disabled={busy}>
              {canOverride && !isOwner ? "Force unclaim" : "Unclaim"}
            </ActionButton>
          ) : null}

          <select
            value={conversation.status}
            disabled={busy || !canAct}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded-lg border border-panel-border bg-panel-raised px-2.5 py-1.5 text-[13px] text-neutral-200 outline-none transition-colors focus:border-white/40 disabled:opacity-40"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-panel-raised text-neutral-200">
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="border-b border-severity-high/30 bg-severity-high/10 px-5 py-2.5 text-sm text-severity-high">
          {error}
        </div>
      ) : null}

      {conversation.claimedBy && !canAct ? (
        <div className="border-b border-panel-border bg-white/[0.03] px-5 py-2.5 text-sm text-neutral-400">
          This conversation is claimed by another staff member. You have read-only access.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            {emails.map((email) => {
              const outbound = email.direction === "outbound";
              return (
                <div
                  key={email.id}
                  className={`rounded-squircle border p-4 ${
                    outbound
                      ? "ml-6 border-white/15 bg-white/[0.05]"
                      : "mr-6 border-panel-border bg-panel-raised"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                    <span className="font-medium text-neutral-300">
                      {outbound ? "Staff" : "Customer"} · {email.from}
                    </span>
                    <span className="ml-auto">{fullTimestamp(email.sentAt || email.receivedAt || email.createdAt)}</span>
                    {outbound ? (
                      <span className="rounded-full border border-white/15 px-2 py-[1px] text-[11px] text-neutral-400">
                        {email.deliveryStatus}
                      </span>
                    ) : null}
                  </div>

                  <MessageBody email={email} conversationId={conversationId} />

                  {email.attachments?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {email.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={attachmentUrl(conversationId, att.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-panel-border px-3 py-1 text-[12px] text-neutral-300 transition-colors hover:border-white/40 hover:text-white"
                        >
                          📎 {att.filename} ({Math.round(att.size / 1024)} KB)
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            {canAct ? (
              <>
                <div className="mb-2 rounded-squircle border border-panel-border bg-white/[0.03] p-3 text-[12px] text-neutral-400">
                  <ul className="list-disc space-y-1 pl-4">
                    {REMINDERS.map((reminder) => (
                      <li key={reminder}>{reminder}</li>
                    ))}
                  </ul>
                </div>
                <textarea
                  value={replyText}
                  onChange={(e) => onReplyChange(e.target.value)}
                  rows={5}
                  placeholder={`Reply to ${conversation.customerEmail}`}
                  className="w-full resize-y rounded-lg border border-panel-border bg-transparent px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40"
                />
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => replyFileInput.current?.click()}
                      disabled={busy || replyFiles.length >= MAX_OUTBOUND_ATTACHMENTS}
                      className="rounded-lg border border-panel-border px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Attach image
                    </button>
                    <span className="text-[12px] text-neutral-500">PNG, JPEG, GIF, WebP · up to 15MB each</span>
                    <input
                      ref={replyFileInput}
                      type="file"
                      accept={ATTACHMENT_ACCEPT}
                      multiple
                      hidden
                      onChange={(e) => addReplyFiles(e.target.files)}
                    />
                  </div>
                  {replyFiles.length ? (
                    <div className="flex flex-wrap gap-2">
                      {replyFiles.map((file, index) => (
                        <span
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1.5 rounded-full border border-panel-border bg-white/[0.04] px-2.5 py-1 text-[12px] text-neutral-200"
                        >
                          <span className="max-w-[160px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeReplyFile(index)}
                            disabled={busy}
                            className="text-neutral-500 transition-colors hover:text-white"
                            aria-label={`Remove ${file.name}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-neutral-500">To: {conversation.customerEmail} (locked)</span>
                  <div className="ml-auto flex gap-2">
                    <ActionButton onClick={deleteDraft} disabled={busy || !replyText.trim()}>
                      Delete draft
                    </ActionButton>
                    <ActionButton onClick={() => sendReply(true)} disabled={busy || !replyText.trim()}>
                      Reply All
                    </ActionButton>
                    <ActionButton tone="primary" onClick={() => sendReply(false)} disabled={busy || !replyText.trim()}>
                      Reply
                    </ActionButton>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-squircle border border-panel-border p-4 text-center text-sm text-neutral-500">
                Claim this conversation to reply.
              </div>
            )}
          </div>
        </div>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-panel-border lg:flex">
          <div className="border-b border-panel-border px-4 py-3 text-sm font-semibold text-white">
            Internal notes
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {notes.length === 0 ? (
              <p className="text-[13px] text-neutral-500">No internal notes yet. Customers never see these.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {notes.map((note: InternalNote) => (
                  <div key={note.id} className="rounded-lg border border-panel-border p-2.5">
                    <div className="mb-1 flex items-center gap-2 text-[12px] text-neutral-500">
                      <span className="font-medium text-neutral-300">
                        {note.author?.displayName || note.author?.username}
                      </span>
                      <span className="ml-auto">{fullTimestamp(note.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-neutral-200">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {canAct ? (
            <div className="border-t border-panel-border p-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Add an internal note (staff only)"
                className="w-full resize-y rounded-lg border border-panel-border bg-transparent px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40"
              />
              <button
                onClick={addNote}
                disabled={busy || !noteText.trim()}
                className="mt-2 w-full rounded-full border border-white bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Add note
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
