import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { relativeTime, absoluteTime } from "../lib/time";
import { useSelection } from "../lib/selectionBus";
import {
  ActionButton,
  Meta,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Row,
  Tag,
} from "../components/panelKit";
import type { BannedIp } from "../types";

export function IpBans() {
  const [error, setError] = useState<string | null>(null);
  const selectedNetwork = useSelection("network");

  const query = useQuery<{ bans: BannedIp[] }>({
    queryKey: ["staff", "banned-ips"],
    queryFn: () => api.get<{ bans: BannedIp[] }>("/banned-ips"),
  });

  const bans = query.data?.bans ?? [];

  const unban = (ipHash: string) => {
    setError(null);
    api
      .delete(`/banned-ips/${encodeURIComponent(ipHash)}`)
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message));
  };

  return (
    <PanelShell>
      <PanelToolbar>
        <span className="text-[13px] text-neutral-500">Ban networks from Security Flags</span>
        <span className="ml-auto text-[13px] text-neutral-500">{bans.length} active</span>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={bans.length === 0}
          emptyLabel="No network bans in place."
        />

        {bans.map((ban) => (
          <Row key={ban.id} selected={selectedNetwork === ban.ipHash}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-neutral-200">{ban.handle}</span>
              {ban.expiresAt ? <Tag tone="medium">until {relativeTime(ban.expiresAt)}</Tag> : <Tag tone="high">permanent</Tag>}
              <div className="ml-auto">
                <ActionButton onClick={() => unban(ban.ipHash)} tone="danger">
                  Unban
                </ActionButton>
              </div>
            </div>

            {ban.reason ? <div className="text-[13px] text-neutral-400">{ban.reason}</div> : null}

            <Meta>
              <span>{ban.bannedBy ? `@${ban.bannedBy.username}` : "system"}</span>
              <span title={absoluteTime(ban.createdAt)}>{relativeTime(ban.createdAt)}</span>
            </Meta>
          </Row>
        ))}
      </PanelScroll>
    </PanelShell>
  );
}
