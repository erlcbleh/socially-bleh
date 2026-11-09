import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { openPanel } from "../lib/panelBus";
import { setSelection } from "../lib/selectionBus";
import { relativeTime } from "../lib/time";
import { PanelScroll, PanelTitle,
  PanelShell, PanelToolbar, QueryState, Tag } from "../components/panelKit";
import type { QueueCounts, ReportPage } from "../types";

function Tile({
  label,
  value,
  tone = "neutral",
  hint,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "high" | "medium" | "low";
  hint?: string;
  onClick?: () => void;
}) {
  const tones = {
    neutral: "text-neutral-200",
    high: "text-severity-high",
    medium: "text-severity-medium",
    low: "text-severity-low",
  };

  const body = (
    <>
      <span className={`text-3xl font-semibold tabular-nums ${tones[tone]}`}>{value}</span>
      <span className="text-[13px] text-neutral-400">{label}</span>
      {hint ? <span className="text-[12px] text-neutral-500">{hint}</span> : null}
    </>
  );

  const className =
    "flex flex-col gap-0.5 rounded-lg border border-panel-border bg-panel-raised px-3.5 py-2.5 text-left transition-colors";

  if (!onClick) return <div className={className}>{body}</div>;

  return (
    <button onClick={onClick} className={`${className} hover:bg-panel-hover`}>
      {body}
    </button>
  );
}

export function Overview() {
  const { staff } = useAuth();
  const canSeeApplications = Boolean(staff?.isAdmin);
  const counts = useQuery<QueueCounts>({
    queryKey: ["staff", "queue-counts"],
    queryFn: () => api.get<QueueCounts>("/queue-counts"),
  });

  const recent = useQuery<ReportPage>({
    queryKey: ["staff", "overview", "recent"],
    queryFn: () => api.get<ReportPage>("/reports?status=pending&limit=6"),
  });

  const data = counts.data;
  const backlog =
    (data?.reports.pending ?? 0) +
    (data?.verification.pending ?? 0) +
    (canSeeApplications ? data?.copyright.pending ?? 0 : 0) +
    (canSeeApplications ? data?.staffApplications.pending ?? 0 : 0) +
    (canSeeApplications ? data?.businessApplications.pending ?? 0 : 0);

  return (
    <PanelShell>
      <PanelToolbar>
        <PanelTitle>Overview</PanelTitle>
        {backlog > 0 ? <Tag tone={backlog > 25 ? "high" : "medium"}>{backlog} open</Tag> : <Tag tone="low">clear</Tag>}
        <button
          onClick={() => {
            counts.refetch();
            recent.refetch();
          }}
          className="ml-auto rounded px-2.5 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-panel-hover hover:text-neutral-200"
        >
          Refresh
        </button>
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={counts.isLoading && !data}
          error={counts.error}
          isEmpty={false}
          emptyLabel=""
        />

        {data ? (
          <div className="flex flex-col gap-4 p-3">
            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-neutral-500">Reports</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile
                  label="Pending"
                  value={data.reports.pending}
                  tone={data.reports.pending > 0 ? "medium" : "neutral"}
                  onClick={() => openPanel({ panelId: "reports.feed" })}
                />
                <Tile
                  label="AI-flagged"
                  value={data.reports.aiPending}
                  tone={data.reports.aiPending > 0 ? "medium" : "neutral"}
                  hint="awaiting review"
                  onClick={() => openPanel({ panelId: "ai.falsePositives" })}
                />
                <Tile label="Actioned" value={data.reports.actioned} tone="low" />
                <Tile label="Dismissed" value={data.reports.dismissed} />
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-neutral-500">Queues</div>
              <div className="grid grid-cols-2 gap-2">
                <Tile
                  label="Verification"
                  value={data.verification.pending}
                  tone={data.verification.pending > 0 ? "medium" : "neutral"}
                  onClick={() => openPanel({ panelId: "verification.queue" })}
                />
                {canSeeApplications ? (
                  <Tile
                    label="Copyright"
                    value={data.copyright.pending}
                    tone={data.copyright.pending > 0 ? "medium" : "neutral"}
                    onClick={() => openPanel({ panelId: "governance.copyright" })}
                  />
                ) : null}
                {canSeeApplications ? (
                  <>
                    <Tile
                      label="Staff applications"
                      value={data.staffApplications.pending}
                      tone={data.staffApplications.pending > 0 ? "medium" : "neutral"}
                      onClick={() => openPanel({ panelId: "governance.staffApplications" })}
                    />
                    <Tile
                      label="Business applications"
                      value={data.businessApplications.pending}
                      tone={data.businessApplications.pending > 0 ? "medium" : "neutral"}
                      onClick={() => openPanel({ panelId: "applications.business" })}
                    />
                  </>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-neutral-500">
                Oldest pending reports
              </div>

              {recent.data?.items.length ? (
                <div className="overflow-hidden rounded-lg border border-panel-border">
                  {recent.data.items.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelection("report", report.id);
                        openPanel({ panelId: "reports.workspace" });
                      }}
                      className="flex w-full items-center gap-2 border-b border-white/[0.08] px-3 py-2 text-left transition-colors last:border-0 hover:bg-panel-hover"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          report.source === "ai" ? "bg-severity-medium" : "bg-severity-low"
                        }`}
                      />
                      <span className="truncate text-[13px] text-neutral-300">{report.reason}</span>
                      <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                        {relativeTime(report.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-panel-border px-3.5 py-4 text-center text-[13px] text-neutral-500">
                  Nothing pending. The queue is clear.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </PanelScroll>
    </PanelShell>
  );
}
