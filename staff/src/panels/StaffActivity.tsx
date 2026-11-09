import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { relativeTime } from "../lib/time";
import { PanelScroll, PanelTitle,
  PanelShell, PanelToolbar, QueryState, Segmented, Tag } from "../components/panelKit";
import type { StaffActivityResponse } from "../types";

const RANGES = [
  { value: "1", label: "24h" },
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
] as const;

export function StaffActivity() {
  const [days, setDays] = useState<string>("7");

  const query = useQuery<StaffActivityResponse>({
    queryKey: ["staff", "activity", days],
    queryFn: () => api.get<StaffActivityResponse>(`/staff-activity?days=${days}`),
  });

  const data = query.data;
  const busiest = data?.staff[0]?.count ?? 0;

  return (
    <PanelShell>
      <PanelToolbar>
        <PanelTitle>Staff Activity</PanelTitle>
        <Segmented value={days} options={RANGES} onChange={setDays} />
        {data ? <Tag>{data.total} actions</Tag> : null}
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && !data}
          error={query.error}
          isEmpty={Boolean(data && data.staff.length === 0)}
          emptyLabel="No staff actions in this window."
        />

        {data && data.staff.length > 0 ? (
          <div className="flex flex-col gap-4 p-3">
            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-neutral-500">Per moderator</div>
              <div className="flex flex-col gap-1.5">
                {data.staff.map((row) => (
                  <div
                    key={row.staffId}
                    className="rounded-lg border border-panel-border bg-panel-raised px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!row.staff) return;
                          setSelection("user", row.staff.username);
                          openPanel({ panelId: "users.dossier" });
                        }}
                        disabled={!row.staff}
                        className="truncate text-sm font-medium text-neutral-200 hover:text-white disabled:cursor-default disabled:hover:text-neutral-200"
                      >
                        {row.staff ? `@${row.staff.username}` : "(deleted account)"}
                      </button>
                      <span className="ml-auto shrink-0 text-sm tabular-nums text-neutral-200">{row.count}</span>
                    </div>

                    <div className="mt-1.5 h-1 overflow-hidden rounded bg-panel-bg">
                      <div
                        className="h-full rounded bg-white"
                        style={{ width: `${busiest > 0 ? Math.max(2, (row.count / busiest) * 100) : 0}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {row.actions.map((entry) => (
                        <span
                          key={entry.action}
                          className="rounded bg-panel-bg px-2 py-1 text-[12px] text-neutral-400"
                        >
                          {entry.action.replace(/_/g, " ")} ×{entry.count}
                        </span>
                      ))}
                      {row.lastActionAt ? (
                        <span className="ml-auto text-[12px] text-neutral-500">
                          last {relativeTime(row.lastActionAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-neutral-500">By action</div>
              <div className="overflow-hidden rounded-lg border border-panel-border">
                {data.actions.map((entry) => (
                  <div
                    key={entry.action}
                    className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2 last:border-0"
                  >
                    <span className="truncate text-[13px] text-neutral-300">
                      {entry.action.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto shrink-0 text-[13px] tabular-nums text-neutral-400">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </PanelScroll>
    </PanelShell>
  );
}
