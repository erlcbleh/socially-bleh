import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
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
  Tag,
} from "../components/panelKit";
import type { SecurityFlagDetail, SecurityFlagGroup } from "../types";

const GROUPINGS = [
  { value: "network" as const, label: "By network" },
  { value: "user" as const, label: "By user" },
  { value: "type" as const, label: "By type" },
];

const WINDOWS = [
  { value: "1", label: "1h" },
  { value: "24", label: "24h" },
  { value: "168", label: "7d" },
];

type GroupBy = "network" | "user" | "type";

export function SecurityFlags() {
  const [groupBy, setGroupBy] = useState<GroupBy>("network");
  const [hours, setHours] = useState("24");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery<{ groups: SecurityFlagGroup[] }>({
    queryKey: ["staff", "security", groupBy, hours],
    queryFn: () => api.get<{ groups: SecurityFlagGroup[] }>(`/security-flags?groupBy=${groupBy}&hours=${hours}`),
  });

  const detail = useQuery<{ items: SecurityFlagDetail[] }>({
    queryKey: ["staff", "security", "detail", groupBy, expanded, hours],
    queryFn: () =>
      api.get<{ items: SecurityFlagDetail[] }>(
        `/security-flags/detail?groupBy=${groupBy}&key=${encodeURIComponent(expanded || "")}&hours=${hours}`
      ),
    enabled: Boolean(expanded),
  });

  const groups = query.data?.groups ?? [];

  const banNetwork = (ipHash: string) => {
    setError(null);
    api
      .post("/banned-ips", { ipHash, reason: `Security flags: ${hours}h window` })
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <Segmented value={groupBy} options={GROUPINGS} onChange={setGroupBy} />
        <div className="ml-2">
          <Segmented value={hours} options={WINDOWS} onChange={setHours} />
        </div>
        <span className="ml-auto text-[13px] text-neutral-500">{groups.length} groups</span>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={groups.length === 0}
          emptyLabel="Nothing flagged in this window."
        />

        {groups.map((group) => {
          const isOpen = expanded === group.key;
          return (
            <div key={group.key}>
              <Row
                onClick={() => {
                  setExpanded(isOpen ? null : group.key);
                  if (groupBy === "network") setSelection("network", group.key);
                  if (groupBy === "user" && group.user) setSelection("user", group.user.username);
                }}
                selected={isOpen}
              >
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm text-neutral-200 ${groupBy === "network" ? "font-mono" : ""}`}>
                    {group.label}
                  </span>
                  <Tag tone={group.count > 50 ? "high" : group.count > 10 ? "medium" : "neutral"}>
                    {group.count}
                  </Tag>
                  {group.isBanned ? <Tag tone="high">banned</Tag> : null}
                  <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                    {relativeTime(group.lastSeenAt)}
                  </span>
                </div>
              </Row>

              {isOpen ? (
                <div className="border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                  {groupBy === "network" && !group.isBanned ? (
                    <div className="mb-2">
                      <ActionButton onClick={() => banNetwork(group.key)} tone="danger">
                        Ban {group.label}
                      </ActionButton>
                    </div>
                  ) : null}

                  {detail.isLoading ? <div className="text-[13px] text-neutral-500">Loading events…</div> : null}

                  <div className="flex flex-col gap-1">
                    {(detail.data?.items ?? []).slice(0, 25).map((flag) => (
                      <div key={flag.id} className="flex flex-col gap-0.5 border-b border-white/[0.06] pb-1 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-neutral-300">{flag.type}</span>
                          <span className="truncate font-mono text-[12px] text-neutral-500">
                            {flag.method} {flag.path}
                          </span>
                          <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                            {relativeTime(flag.createdAt)}
                          </span>
                        </div>
                        <Meta>
                          {groupBy !== "network" ? <span className="font-mono">{flag.network}</span> : null}
                          {flag.user ? <span>@{flag.user.username}</span> : null}
                        </Meta>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelScroll>
    </PanelShell>
  );
}
