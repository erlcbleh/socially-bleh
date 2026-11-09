import { useState } from "react";
import { useInfiniteQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { setSelection } from "../lib/selectionBus";
import { UserName } from "../components/UserName";
import { openPanel } from "../lib/panelBus";
import { absoluteTime, relativeTime } from "../lib/time";
import {
  LoadMore,
  Meta,
  PanelScroll,
  PanelShell,
  PanelTitle,
  PanelToolbar,
  QueryState,
  Row,
  Segmented,
  Tag,
} from "../components/panelKit";
import { UserPicker } from "../components/UserPicker";
import type { AuditPage, UserLookupResult } from "../types";

const KINDS = [
  { value: "all", label: "All" },
  { value: "users", label: "Users" },
  { value: "posts", label: "Posts" },
  { value: "ips", label: "Networks" },
] as const;

function toneFor(action: string): "high" | "medium" | "neutral" {
  if (/ban|suspend|delete|purge|deactivate/.test(action)) return "high";
  if (/dismiss|unban|reinstate/.test(action)) return "medium";
  return "neutral";
}

export function ModerationHistory() {
  const [kind, setKind] = useState<string>("all");
  const [target, setTarget] = useState<UserLookupResult | null>(null);

  const query = useInfiniteQuery<AuditPage>({
    queryKey: ["staff", "moderation-history", kind, target?.username ?? ""],
    queryFn: (pageParam) => {
      const params = new URLSearchParams({ limit: "30" });
      if (kind !== "all") params.set("kind", kind);
      if (target) params.set("username", target.username);
      if (pageParam) params.set("cursor", String(pageParam));
      return api.get<AuditPage>(`/moderation-history?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.pages.flatMap((page) => page.items);

  return (
    <PanelShell>
      <PanelToolbar>
        <PanelTitle>Moderation History</PanelTitle>
        <Segmented value={kind} options={KINDS} onChange={setKind} />
        <UserPicker
          value={target}
          onChange={setTarget}
          placeholder="Filter by account"
          label="Filter moderation history by account"
          className="w-52"
        />
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && items.length === 0}
          error={query.error}
          isEmpty={items.length === 0 && !query.isLoading}
          emptyLabel="No moderation actions match this filter."
        />

        {items.map((entry) => (
          <Row key={entry.id}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag tone={toneFor(entry.action)}>{entry.action.replace(/_/g, " ")}</Tag>
              <span className="truncate text-[13px] text-neutral-300">{entry.targetLabel || entry.targetType}</span>
              <span className="ml-auto shrink-0 text-[12px] text-neutral-500" title={absoluteTime(entry.createdAt)}>
                {relativeTime(entry.createdAt)}
              </span>
            </div>

            <Meta>
              <span className="flex items-center gap-1">
                by <UserName username={entry.staff?.username} fallback="(deleted staff)" />
              </span>

              {entry.targetUser ? (
                <span className="flex items-center gap-1">
                  → <UserName username={entry.targetUser.username} />
                </span>
              ) : null}

              {entry.targetType === "report" && entry.targetId ? (
                <button
                  onClick={() => {
                    setSelection("report", entry.targetId!);
                    openPanel({ panelId: "reports.workspace" });
                  }}
                  className="hover:text-white"
                >
                  open report ↗
                </button>
              ) : null}
            </Meta>
          </Row>
        ))}

        {query.hasNextPage ? <LoadMore onClick={() => query.fetchNextPage()} /> : null}
      </PanelScroll>
    </PanelShell>
  );
}
