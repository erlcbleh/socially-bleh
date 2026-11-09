import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { relativeTime } from "../lib/time";
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
import type { CopyrightRequestRow } from "../types";

const STATUSES = ["pending", "actioned", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export function CopyrightQueue() {
  const [status, setStatus] = useState<Status>("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery<{ requests: CopyrightRequestRow[] }>({
    queryKey: ["staff", "copyright", status],
    queryFn: () => api.get<{ requests: CopyrightRequestRow[] }>(`/copyright-requests?status=${status}`),
  });

  const requests = query.data?.requests ?? [];

  const decide = (id: string, action: string) => {
    setError(null);
    api
      .post(`/copyright-requests/${id}/action`, { action })
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <Segmented value={status} options={STATUSES} onChange={setStatus} />
        <span className="ml-auto text-[13px] text-neutral-500">{requests.length}</span>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={requests.length === 0}
          emptyLabel="No copyright requests in this queue."
        />

        {requests.map((request) => {
          const isOpen = expanded === request.id;
          return (
            <div key={request.id}>
              <Row onClick={() => setExpanded(isOpen ? null : request.id)} selected={isOpen}>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-200">{request.requesterName}</span>
                  <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                    {relativeTime(request.createdAt)}
                  </span>
                </div>
                <div className="truncate text-[13px] text-neutral-400">{request.copyrightedWork}</div>
              </Row>

              {isOpen ? (
                <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                  <div className="text-[13px] text-neutral-400">{request.requesterEmail}</div>

                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Infringing URLs</div>
                    <ul className="flex flex-col gap-0.5">
                      {(request.infringingUrls || []).map((url, index) => (
                        <li key={index} className="break-all font-mono text-[12px] text-neutral-400">
                          {url}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {request.details ? (
                    <p className="whitespace-pre-wrap break-words text-[13px] text-neutral-300">{request.details}</p>
                  ) : null}

                  <div className="text-[12px] text-neutral-500">Signed: {request.signature}</div>

                  {status === "pending" ? (
                    <Meta>
                      <ActionButton onClick={() => decide(request.id, "action")} tone="primary">
                        Action
                      </ActionButton>
                      <ActionButton onClick={() => decide(request.id, "reject")} tone="danger">
                        Reject
                      </ActionButton>
                    </Meta>
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
