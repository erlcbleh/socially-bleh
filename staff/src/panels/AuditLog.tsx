import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { absoluteTime, relativeTime } from "../lib/time";
import {
  ActionButton,
  LoadMore,
  Meta,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Row,
  Tag,
  TextInput,
} from "../components/panelKit";
import type { AuditEntry, AuditPage } from "../types";

export function AuditLog() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  const params = useMemo(() => {
    const search = new URLSearchParams({ limit: "50" });
    if (q.trim()) search.set("q", q.trim());
    if (action.trim()) search.set("action", action.trim());
    if (importantOnly) search.set("important", "true");
    return search;
  }, [q, action, importantOnly]);

  const query = useInfiniteQuery<AuditPage>({
    queryKey: ["staff", "audit", q.trim(), action.trim(), importantOnly],
    queryFn: (pageParam) => {
      const search = new URLSearchParams(params);
      if (pageParam) search.set("cursor", String(pageParam));
      return api.get<AuditPage>(`/audit-log?${search.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const entries = query.pages.flatMap((page) => page.items);

  const downloadCsv = () => {
    window.open(`/api/staff/audit-log.csv?${params.toString()}`, "_blank", "noopener");
  };

  const undo = (id: string) => {
    setUndoing(id);
    setUndoError(null);
    api
      .post(`/audit-log/${id}/undo`, {})
      .then(() => query.refetch())
      .catch((err: Error) => setUndoError(err.message))
      .finally(() => setUndoing(null));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <TextInput value={q} onChange={setQ} placeholder="Search target or action" className="min-w-0 flex-1" />
        <TextInput value={action} onChange={setAction} placeholder="Action filter" className="w-36" />
        <ActionButton onClick={() => setImportantOnly((v) => !v)} tone={importantOnly ? "primary" : "neutral"}>
          Kept only
        </ActionButton>
        <ActionButton onClick={downloadCsv}>Export CSV</ActionButton>
      </PanelToolbar>

      {undoError ? (
        <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">
          {undoError}
        </div>
      ) : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && entries.length === 0}
          error={query.error}
          isEmpty={entries.length === 0 && !query.isLoading}
          emptyLabel="No audit entries match."
        />

        {entries.map((entry: AuditEntry) => (
          <div key={entry.id}>
            <Row onClick={() => setExpanded(expanded === entry.id ? null : entry.id)} selected={expanded === entry.id}>
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-neutral-200">{entry.action}</span>
                <Tag>{entry.targetType}</Tag>
                {entry.important ? <Tag tone="medium">Kept</Tag> : null}
                {entry.undone ? <Tag tone="low">undone</Tag> : null}
                {entry.undoable ? <Tag tone="low">undoable</Tag> : null}
                <span className="ml-auto shrink-0 text-[13px] text-neutral-500" title={absoluteTime(entry.createdAt)}>
                  {relativeTime(entry.createdAt)}
                </span>
              </div>

              <Meta>
                <span>{entry.staff ? `@${entry.staff.username}` : "system"}</span>
                <span className="text-neutral-500">→</span>
                <span className="truncate text-neutral-400">
                  {entry.targetLabel || entry.targetUser?.username || entry.targetId || "-"}
                </span>
              </Meta>
            </Row>

            {expanded === entry.id ? (
              <div className="border-b border-white/[0.08] bg-panel-raised/40">
                {entry.meta ? (
                  <pre className="max-h-56 overflow-auto px-3.5 py-2.5 text-[12px] leading-relaxed text-neutral-400">
                    {JSON.stringify(entry.meta, null, 2)}
                  </pre>
                ) : null}
                {entry.undone ? (
                  <div className="px-3.5 py-2.5 text-[13px] text-neutral-500">This action has already been undone.</div>
                ) : entry.undoable ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5">
                    <ActionButton
                      onClick={() => undo(entry.id)}
                      tone="danger"
                      disabled={undoing === entry.id}
                    >
                      {undoing === entry.id ? "Undoing…" : "Undo this action"}
                    </ActionButton>
                    <span className="text-[13px] text-neutral-500">Reverses the effect and records it in the log.</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}

        {query.hasNextPage ? <LoadMore onClick={() => query.fetchNextPage()} /> : null}
      </PanelScroll>
    </PanelShell>
  );
}
