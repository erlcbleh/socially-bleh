import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { useConfirm } from "@socially/shared/components/ConfirmDialog";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { relativeTime } from "../lib/time";
import { ActionButton, PanelScroll, PanelTitle,
  PanelShell, PanelToolbar, QueryState, Segmented, Tag } from "../components/panelKit";
import type { StaffNotesResponse } from "../types";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
] as const;

export function Notes() {
  const { user, staff } = useAuth();
  const [scope, setScope] = useState<string>("all");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm(busy);

  const query = useQuery<StaffNotesResponse>({
    queryKey: ["staff", "notes", scope],
    queryFn: () => api.get<StaffNotesResponse>(`/notes${scope === "mine" ? "?mine=true" : ""}`),
  });

  const notes = query.data?.notes ?? [];

  const run = (promise: Promise<unknown>) => {
    setBusy(true);
    setError(null);
    promise
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const add = () => {
    const body = draft.trim();
    if (!body) return;
    run(api.post("/notes", { body }).then(() => setDraft("")));
  };

  return (
    <PanelShell>
      {dialog}
      <PanelToolbar>
        <PanelTitle>Notes</PanelTitle>
        <Segmented value={scope} options={SCOPES} onChange={setScope} />
        <Tag>{notes.length}</Tag>
      </PanelToolbar>

      <div className="shrink-0 border-b border-panel-border px-2.5 py-2.5">
        <textarea
          rows={2}
          value={draft}
          maxLength={5000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Leave context for the next shift"
          className="w-full resize-y rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-500 focus:border-white/40"
        />
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12px] text-severity-high" role={error ? "alert" : undefined}>
            {error || ""}
          </span>
          <span className="ml-auto text-[12px] text-neutral-500">⌘⏎ to post</span>
          <ActionButton onClick={add} tone="primary" disabled={busy || !draft.trim()}>
            Post note
          </ActionButton>
        </div>
      </div>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && notes.length === 0}
          error={query.error}
          isEmpty={notes.length === 0 && !query.isLoading}
          emptyLabel="No notes yet."
        />

        {notes.map((note) => {
          const isMine = note.author?.id === user?.id;
          const canDelete = isMine || staff?.isAdmin;

          return (
            <div
              key={note.id}
              className={`flex flex-col gap-1 border-b border-white/[0.08] px-3.5 py-2.5 ${
                note.pinned ? "bg-severity-medium/5" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {note.pinned ? <Tag tone="medium">pinned</Tag> : null}
                <span className="truncate text-[13px] font-medium text-neutral-300">
                  {note.author ? `@${note.author.username}` : "(deleted)"}
                </span>
                {note.targetType && note.targetId ? (
                  <button
                    onClick={() => {
                      setSelection(note.targetType as "report" | "user", note.targetId as string);
                      openPanel({
                        panelId: note.targetType === "user" ? "users.dossier" : "reports.workspace",
                      });
                    }}
                    className="rounded bg-panel-raised px-2 py-1 text-[12px] text-neutral-400 hover:text-white"
                  >
                    {note.targetType} ↗
                  </button>
                ) : null}
                <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                  {relativeTime(note.createdAt)}
                </span>
              </div>

              <p className="whitespace-pre-wrap break-words text-sm text-neutral-200">{note.body}</p>

              {isMine || canDelete ? (
                <div className="flex items-center gap-1">
                  {isMine ? (
                    <ActionButton
                      onClick={() => run(api.patch(`/notes/${note.id}`, { pinned: !note.pinned }))}
                      disabled={busy}
                    >
                      {note.pinned ? "Unpin" : "Pin"}
                    </ActionButton>
                  ) : null}
                  {canDelete ? (
                    <ActionButton
                      tone="danger"
                      disabled={busy}
                      onClick={() =>
                        confirm({
                          title: "Delete this note?",
                          description: "It is removed for everyone.",
                          confirmLabel: "Delete",
                          tone: "danger",
                          onConfirm: () => run(api.delete(`/notes/${note.id}`)),
                        })
                      }
                    >
                      Delete
                    </ActionButton>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelScroll>
    </PanelShell>
  );
}
