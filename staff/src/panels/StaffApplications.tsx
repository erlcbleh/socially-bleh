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
  Tag,
} from "../components/panelKit";
import type { StaffApplicationRow } from "../types";

const STATUSES = ["pending", "accepted", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export function StaffApplications() {
  const [status, setStatus] = useState<Status>("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery<{ applications: StaffApplicationRow[] }>({
    queryKey: ["staff", "applications", status],
    queryFn: () => api.get<{ applications: StaffApplicationRow[] }>(`/staff-applications?status=${status}`),
  });

  const applications = query.data?.applications ?? [];

  const decide = (id: string, action: string) => {
    setError(null);
    api
      .post(`/staff-applications/${id}/action`, { action })
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message));
  };

  const revert = (id: string) => {
    setBusy(id);
    setError(null);
    api
      .post(`/staff-applications/${id}/revert`, {})
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <Segmented value={status} options={STATUSES} onChange={setStatus} />
        <span className="ml-auto text-[13px] text-neutral-500">{applications.length}</span>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={applications.length === 0}
          emptyLabel="No applications in this queue."
        />

        {applications.map((application) => {
          const isOpen = expanded === application.id;
          return (
            <div key={application.id}>
              <Row onClick={() => setExpanded(isOpen ? null : application.id)} selected={isOpen}>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-200">{application.discordUsername}</span>
                  <Tag>{application.position}</Tag>
                  {application.department ? <Tag tone="low">{application.department}</Tag> : null}
                  <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                    {relativeTime(application.createdAt)}
                  </span>
                </div>
              </Row>

              {isOpen ? (
                <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Motivation</div>
                    <p className="whitespace-pre-wrap break-words text-[13px] text-neutral-300">{application.motivation}</p>
                  </div>

                  {application.experience ? (
                    <div>
                      <div className="text-[12px] font-semibold text-neutral-500">Experience</div>
                      <p className="whitespace-pre-wrap break-words text-[13px] text-neutral-300">{application.experience}</p>
                    </div>
                  ) : null}

                  {Array.isArray(application.scenarioResponses) && application.scenarioResponses.length > 0 ? (
                    <div>
                      <div className="text-[12px] font-semibold text-neutral-500">Scenarios</div>
                      <ul className="flex flex-col gap-1.5">
                        {application.scenarioResponses.map((response, index) => {
                          const isObject = response && typeof response === "object";
                          const question = isObject ? response.question : "";
                          const answer = isObject ? response.answer : String(response ?? "");
                          return (
                            <li key={index} className="rounded-lg border border-panel-border px-2.5 py-1.5">
                              {question ? (
                                <div className="text-[12px] font-medium text-neutral-400">{question}</div>
                              ) : null}
                              <p className="whitespace-pre-wrap break-words text-[13px] text-neutral-300">{answer}</p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {status === "pending" ? (
                    <Meta>
                      <ActionButton onClick={() => decide(application.id, "accept")} tone="primary">
                        Accept
                      </ActionButton>
                      <ActionButton onClick={() => decide(application.id, "reject")} tone="danger">
                        Reject
                      </ActionButton>
                    </Meta>
                  ) : (
                    <Meta>
                      <ActionButton onClick={() => revert(application.id)} disabled={busy === application.id}>
                        {busy === application.id
                          ? "Undoing…"
                          : status === "accepted"
                            ? "Undo acceptance"
                            : "Undo rejection"}
                      </ActionButton>
                    </Meta>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelScroll>
    </PanelShell>
  );
}
