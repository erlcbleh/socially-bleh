import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { setSelection } from "../lib/selectionBus";
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
import type { AiCategoryResponse, AiFalsePositivePage, AiStuckResponse } from "../types";

const RANGES = [
  { value: "1", label: "24h" },
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
] as const;

function percent(value: number | null) {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

export function AiCategories() {
  const [days, setDays] = useState<string>("7");

  const query = useQuery<AiCategoryResponse>({
    queryKey: ["staff", "ai", "categories", days],
    queryFn: () => api.get<AiCategoryResponse>(`/ai/categories?days=${days}`),
  });

  const data = query.data;
  const busiest = data?.categories[0]?.total ?? 0;

  return (
    <PanelShell>
      <PanelToolbar>
        <PanelTitle>AI Categories</PanelTitle>
        <Segmented value={days} options={RANGES} onChange={setDays} />
        {data ? <Tag>{data.total} flagged</Tag> : null}
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && !data}
          error={query.error}
          isEmpty={Boolean(data && data.categories.length === 0)}
          emptyLabel="Nothing flagged in this window."
        />

        {data && data.categories.length > 0 ? (
          <div className="flex flex-col gap-4 p-3">
            <div className="flex flex-wrap gap-1">
              {data.verdicts.map((entry) => (
                <span
                  key={entry.verdict}
                  className="rounded bg-panel-raised px-2.5 py-1.5 text-[12px] text-neutral-400"
                >
                  {entry.verdict.replace(/_/g, " ")} ×{entry.count}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              {data.categories.map((entry) => (
                <div key={entry.category} className="rounded-lg border border-panel-border bg-panel-raised px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-200">
                      {entry.category.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto shrink-0 text-sm tabular-nums text-neutral-200">{entry.total}</span>
                  </div>

                  <div className="mt-1.5 h-1 overflow-hidden rounded bg-panel-bg">
                    <div
                      className="h-full rounded bg-white"
                      style={{ width: `${busiest > 0 ? Math.max(2, (entry.total / busiest) * 100) : 0}%` }}
                    />
                  </div>

                  <Meta>
                    <span className="text-severity-medium">{entry.pending} pending</span>
                    <span className="text-severity-high">{entry.actioned} actioned</span>
                    <span>{entry.dismissed} dismissed</span>
                    <span
                      className="ml-auto"
                      title="Share of decided reports that were dismissed"
                    >
                      false positives {percent(entry.falsePositiveRate)}
                    </span>
                  </Meta>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </PanelScroll>
    </PanelShell>
  );
}

export function AiFalsePositives() {
  const query = useInfiniteQuery<AiFalsePositivePage>({
    queryKey: ["staff", "ai", "false-positives"],
    queryFn: (pageParam) => {
      const params = new URLSearchParams({ limit: "30" });
      if (pageParam) params.set("cursor", String(pageParam));
      return api.get<AiFalsePositivePage>(`/ai/false-positives?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.pages.flatMap((page) => page.items);

  return (
    <PanelShell>
      <PanelToolbar>
        <PanelTitle>AI False Positives</PanelTitle>
        <Tag>{items.length}</Tag>
        <span className="ml-auto text-[12px] text-neutral-500">AI reports a moderator dismissed</span>
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && items.length === 0}
          error={query.error}
          isEmpty={items.length === 0 && !query.isLoading}
          emptyLabel="No dismissed AI reports."
        />

        {items.map((item) => (
          <Row key={item.id} onClick={() => setSelection("report", item.id)}>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.categories.map((category) => (
                <Tag key={category} tone="medium">
                  {category.replace(/_/g, " ")}
                </Tag>
              ))}
              <Tag>{item.verdict.replace(/_/g, " ")}</Tag>
              {item.stillLive === false ? <Tag tone="high">target deleted</Tag> : null}
              <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                {relativeTime(item.createdAt)}
              </span>
            </div>

            {item.content ? (
              <div className="line-clamp-2 text-[13px] text-neutral-400">{item.content}</div>
            ) : (
              <div className="text-[13px] italic text-neutral-500">No text content</div>
            )}

            <Meta>
              {item.reviewedBy ? <span>dismissed by @{item.reviewedBy.username}</span> : null}
              {item.reviewedAt ? <span>{absoluteTime(item.reviewedAt)}</span> : null}
              {item.staffNote ? <span className="text-neutral-400">“{item.staffNote}”</span> : null}
            </Meta>
          </Row>
        ))}

        {query.hasNextPage ? <LoadMore onClick={() => query.fetchNextPage()} /> : null}
      </PanelScroll>
    </PanelShell>
  );
}

export function AiStuckQueue() {
  const query = useQuery<AiStuckResponse>({
    queryKey: ["staff", "ai", "stuck"],
    queryFn: () => api.get<AiStuckResponse>("/ai/stuck?limit=100"),
  });

  const data = query.data;
  const exhausted = data?.byAttempt.filter((row) => row.exhausted).reduce((sum, row) => sum + row.count, 0) ?? 0;
  const stalledHours = data?.oldestPendingAt
    ? (Date.now() - new Date(data.oldestPendingAt).getTime()) / 3_600_000
    : 0;

  return (
    <PanelShell>
      <PanelToolbar>
        <PanelTitle>AI Retry Backlog</PanelTitle>
        {data ? (
          <Tag tone={data.total === 0 ? "low" : stalledHours > 1 ? "high" : "medium"}>
            {data.total} awaiting scan
          </Tag>
        ) : null}
        <button
          onClick={() => query.refetch()}
          className="ml-auto rounded px-2.5 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-panel-hover hover:text-neutral-200"
        >
          Refresh
        </button>
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading && !data}
          error={query.error}
          isEmpty={Boolean(data && data.total === 0)}
          emptyLabel="Nothing waiting on the moderation scanner."
        />

        {data && data.total > 0 ? (
          <>
            {stalledHours > 1 ? (
              <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2.5 text-[13px] text-severity-high">
                The oldest post has been waiting {Math.round(stalledHours)}h. The moderation scanner may be down
                or rate-limited.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1 border-b border-panel-border px-3.5 py-2.5">
              {data.byAttempt.map((row) => (
                <span
                  key={row.attempts}
                  className={`rounded px-2.5 py-1.5 text-[12px] ${
                    row.exhausted
                      ? "bg-severity-high/15 text-severity-high"
                      : "bg-panel-raised text-neutral-400"
                  }`}
                  title={
                    row.exhausted
                      ? `Retried ${row.attempts}×, at the ${data.maxAttempts} attempt ceiling`
                      : `Retried ${row.attempts}×`
                  }
                >
                  {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"} ×{row.count}
                </span>
              ))}
              {exhausted > 0 ? (
                <span className="ml-auto text-[12px] text-severity-high">
                  {exhausted} past the {data.maxAttempts}-attempt ceiling
                </span>
              ) : null}
            </div>

            {data.items.map((post) => (
              <Row
                key={post.id}
                onClick={() => {
                  if (!post.author) return;
                  setSelection("user", post.author.username);
                  openPanel({ panelId: "users.dossier" });
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-200">
                    {post.author ? `@${post.author.username}` : "(deleted author)"}
                  </span>
                  {post.hasMedia ? <Tag>media</Tag> : null}
                  <Tag tone={post.exhausted ? "high" : "medium"}>
                    {post.attempts} {post.attempts === 1 ? "try" : "tries"}
                  </Tag>
                  <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                    {relativeTime(post.createdAt)}
                  </span>
                </div>
                {post.content ? (
                  <div className="line-clamp-2 text-[13px] text-neutral-400">{post.content}</div>
                ) : (
                  <div className="text-[13px] italic text-neutral-500">No text content</div>
                )}
              </Row>
            ))}
          </>
        ) : null}
      </PanelScroll>
    </PanelShell>
  );
}
