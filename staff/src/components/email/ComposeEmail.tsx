import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { ActionButton } from "../panelKit";
import type { Mailbox } from "../../types";
import {
  ATTACHMENT_ACCEPT,
  MAX_OUTBOUND_ATTACHMENTS,
  fileToAttachment,
  validateAttachmentFile,
} from "./attachments";

const REMINDERS = [
  "You are communicating on behalf of the organization. Please ensure your message is professional, respectful, and easy to understand.",
  "Before sending, check your spelling, grammar (SPAG), punctuation, tone, and clarity.",
];

const inputClass =
  "rounded-lg border border-panel-border bg-transparent px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40";

export function ComposeEmail({
  mailbox,
  onClose,
  onSent,
}: {
  mailbox: Mailbox;
  onClose: () => void;
  onSent: (conversationId: string) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const canSend = Boolean(to.trim() && subject.trim() && body.trim() && !busy);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next = [...files];
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
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const attachments = await Promise.all(files.map(fileToAttachment));
      const { conversationId } = await api.post<{ conversationId: string }>("/email/compose", {
        mailbox: mailbox.key,
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        attachments,
      });
      onSent(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-squircle border border-panel-border bg-panel-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <h2 className="text-base font-semibold text-white">New {mailbox.label} email</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 transition-colors hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="rounded-squircle border border-panel-border bg-white/[0.03] p-3 text-[12px] text-neutral-400">
            <ul className="list-disc space-y-1 pl-4">
              {REMINDERS.map((reminder) => (
                <li key={reminder}>{reminder}</li>
              ))}
            </ul>
          </div>

          <div className="text-[12px] text-neutral-500">From: {mailbox.address}</div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-neutral-400">To</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-neutral-400">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-neutral-400">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your message…"
              className={`resize-y ${inputClass}`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy || files.length >= MAX_OUTBOUND_ATTACHMENTS}
                className="rounded-lg border border-panel-border px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Attach image
              </button>
              <span className="text-[12px] text-neutral-500">PNG, JPEG, GIF, WebP · up to 15MB each</span>
              <input
                ref={fileInput}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
            {files.length ? (
              <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-1.5 rounded-full border border-panel-border bg-white/[0.04] px-2.5 py-1 text-[12px] text-neutral-200"
                  >
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
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

          {error ? (
            <div className="rounded-lg border border-severity-high/40 bg-severity-high/5 px-3.5 py-2.5 text-sm text-severity-high">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-panel-border px-5 py-4">
          <ActionButton onClick={onClose} disabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" onClick={send} disabled={!canSend}>
            {busy ? "Sending…" : "Send"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
