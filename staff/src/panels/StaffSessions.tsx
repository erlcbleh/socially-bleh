import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { UserName } from "../components/UserName";
import { absoluteTime, relativeTime } from "../lib/time";
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
import type { StaffSessionRow } from "../types";

const SCOPES = [
  { value: "active" as const, label: "Active" },
  { value: "all" as const, label: "All" },
];

export function StaffSessions() {
  const [scope, setScope] = useState<"active" | "all">("active");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery<{ items: StaffSessionRow[] }>({
    queryKey: ["staff", "sessions", scope],
    queryFn: () => api.get<{ items: StaffSessionRow[] }>(`/staff-sessions?all=${scope === "all"}`),
  });

  const sessions = query.data?.items ?? [];

  const revoke = (session: StaffSessionRow) => {
    setError(null);
    api
      .post(`/staff-sessions/${encodeURIComponent(session.jti)}/revoke`)
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <Segmented value={scope} options={SCOPES} onChange={setScope} />
        <span className="ml-auto text-[13px] text-neutral-500">{sessions.length} sessions</span>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={sessions.length === 0}
          emptyLabel="No staff sessions."
        />

        {sessions.map((session) => (
          <Row key={session.id}>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-neutral-200">
                {session.user ? `@${session.user.username}` : "unknown"}
              </span>
              {session.isCurrent ? <Tag tone="low">this session</Tag> : null}
              {session.isActive ? <Tag tone="low">active</Tag> : <Tag tone="high">ended</Tag>}

              <div className="ml-auto">
                {session.isActive && !session.isCurrent ? (
                  <ActionButton onClick={() => revoke(session)} tone="danger">
                    Revoke
                  </ActionButton>
                ) : null}
              </div>
            </div>

            <Meta>
              <span className="font-mono">{session.network || "-"}</span>
              <span className="truncate" title={session.userAgent}>
                {session.userAgent?.slice(0, 48) || "-"}
              </span>
            </Meta>

            <Meta>
              <span title={absoluteTime(session.lastSeenAt)}>seen {relativeTime(session.lastSeenAt)}</span>
              <span title={absoluteTime(session.absoluteExpiresAt)}>caps {relativeTime(session.absoluteExpiresAt)}</span>
              {session.revokedAt ? (
                <span className="text-severity-high">
                  revoked {relativeTime(session.revokedAt)}
                  {session.revokedBy ? ` by @${session.revokedBy.username}` : ""}
                </span>
              ) : null}
            </Meta>
          </Row>
        ))}
      </PanelScroll>
    </PanelShell>
  );
}
