import { useState } from "react";
import { useInfiniteQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { relativeTime } from "../lib/time";
import { setSelection } from "../lib/selectionBus";
import {
  ActionButton,
  Meta,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Row,
  Segmented,
} from "../components/panelKit";
import type { VerificationPage } from "../types";

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export function VerificationQueue() {
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useInfiniteQuery<VerificationPage>({
    queryKey: ["staff", "verification", status],
    queryFn: (pageParam) => {
      const params = new URLSearchParams({ status, limit: "50" });
      if (pageParam) params.set("cursor", String(pageParam));
      return api.get<VerificationPage>(`/verification?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const applications = query.pages.flatMap((page) => page.applications);

  const decide = (id: string, action: "approve" | "reject") => {
    setBusy(id);
    setError(null);
    api
      .post(`/verification/${id}/decide`, { action })
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  };

  const revert = (id: string) => {
    setBusy(id);
    setError(null);
    api
      .post(`/verification/${id}/revert`, {})
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <Segmented value={status} options={STATUSES} onChange={setStatus} />
        <span className="ml-auto text-[13px] text-neutral-500">
          {applications.length}
          {query.hasNextPage ? "+" : ""}
        </span>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={applications.length === 0}
          emptyLabel="Nothing in this queue."
        />

        {applications.map((application) => (
          <Row key={application.id}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelection("user", application.user.username)}
                className="truncate text-sm font-medium text-neutral-200 hover:text-white"
              >
                @{application.user.username}
              </button>
              <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                {relativeTime(application.createdAt)}
              </span>
            </div>

            <div className="whitespace-pre-wrap break-words text-[13px] text-neutral-400">{application.reason}</div>

            {status === "pending" ? (
              <Meta>
                <ActionButton onClick={() => decide(application.id, "approve")} tone="primary" disabled={busy === application.id}>
                  Approve
                </ActionButton>
                <ActionButton onClick={() => decide(application.id, "reject")} tone="danger" disabled={busy === application.id}>
                  Reject
                </ActionButton>
              </Meta>
            ) : (
              <Meta>
                <ActionButton onClick={() => revert(application.id)} disabled={busy === application.id}>
                  {busy === application.id ? "Undoing…" : "Undo decision"}
                </ActionButton>
              </Meta>
            )}
          </Row>
        ))}

        {query.hasNextPage ? (
          <button
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="w-full px-3.5 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-panel-hover hover:text-neutral-200 disabled:opacity-40"
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </PanelScroll>
    </PanelShell>
  );
}
