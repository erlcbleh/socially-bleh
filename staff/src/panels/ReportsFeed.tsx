import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@socially/shared/queryStore";
import { usePrompt } from "@socially/shared/components/PromptDialog";
import { api } from "../lib/api";
import { setSelection, useSelection } from "../lib/selectionBus";
import type { ReportPage, StaffReport } from "../types";
import { relativeTime } from "../lib/time";
import { clearReportPulse, useReportPulse } from "../lib/reportPulse";
import { publishFocus } from "../lib/realtime";
import { useHotkey } from "../lib/hotkeys";
import { Checkbox } from "../components/Checkbox";

const STATUSES = ["pending", "actioned", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

function targetLabel(report: StaffReport): string {
  if (report.targetType === "post") {
    const username = report.targetPost?.author?.username || report.snapshot?.authorUsername;
    return username ? `@${username}` : "post (deleted)";
  }
  if (report.targetType === "message") {
    const username = report.targetMessage?.sender?.username || report.snapshot?.authorUsername;
    return username ? `@${username}` : "message (deleted)";
  }
  return report.targetUser ? `@${report.targetUser.username}` : "user (deleted)";
}

function previewText(report: StaffReport): string {
  const raw = report.snapshot?.content || report.contentSnapshot || report.targetPost?.content || report.targetMessage?.content || "";
  return raw.replace(/\s+/g, " ").trim();
}

export function ReportsFeed({ compact = false }: { compact?: boolean } = {}) {
  const [status, setStatus] = useState<Status>("pending");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const selected = useSelection("report");
  const listRef = useRef<HTMLDivElement>(null);
  const { prompt, dialog } = usePrompt(bulkBusy);

  const query = useInfiniteQuery<ReportPage>({
    queryKey: ["staff", "reports", status],
    queryFn: (pageParam) => {
      const params = new URLSearchParams({ status, limit: "30" });
      if (pageParam) params.set("cursor", String(pageParam));
      return api.get<ReportPage>(`/reports?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const reports = useMemo(() => query.pages.flatMap((page) => page.items), [query.pages]);
  const pulse = useReportPulse();

  const changedIds = useMemo(() => {
    const loaded = new Set(reports.map((report) => report.id));
    return new Set(pulse.updated.filter((id) => loaded.has(id)));
  }, [reports, pulse.updated]);

  const pendingCount = (status === "pending" ? pulse.created.length : 0) + changedIds.size;

  useEffect(() => {
    setCursorIndex(0);
    setChecked(new Set());
    setBulkError(null);
    clearReportPulse();
  }, [status]);

  const toggleChecked = useCallback((id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runBulkDismiss = useCallback(() => {
    const ids = [...checked];
    if (ids.length === 0) return;

    prompt({
      title: `Dismiss ${ids.length} ${ids.length === 1 ? "report" : "reports"}`,
      description:
        "No action is taken against the reported users. Each dismissal is logged.",
      label: "Staff note (optional)",
      placeholder: "Why these are being dismissed together",
      multiline: true,
      required: false,
      maxLength: 2000,
      confirmLabel: `Dismiss ${ids.length}`,
      onSubmit: (staffNote) => {
        setBulkBusy(true);
        setBulkError(null);
        api
          .post<{ dismissed: number; skipped: number }>("/reports/bulk-action", {
            action: "dismiss",
            ids,
            staffNote: staffNote || undefined,
          })
          .then(() => {
            setChecked(new Set());
            clearReportPulse();
            return query.refetch();
          })
          .catch((err: Error) => setBulkError(err.message))
          .finally(() => setBulkBusy(false));
      },
    });
  }, [checked, prompt, query]);

  const applyPulse = useCallback(() => {
    clearReportPulse();
    query.refetch();
  }, [query]);

  const select = useCallback((report: StaffReport) => {
    setSelection("report", report.id);
    publishFocus({ channel: "report", id: report.id });
  }, []);

  const move = useCallback(
    (delta: number) => {
      setCursorIndex((current) => {
        const clamped = Math.max(0, Math.min(reports.length - 1, current + delta));
        const report = reports[clamped];
        if (report) {
          select(report);
          document.getElementById(`report-row-${report.id}`)?.scrollIntoView({ block: "nearest" });
        }
        return clamped;
      });
    },
    [reports, select]
  );

  useHotkey({ key: "j" }, () => move(1), [move], "Next report");
  useHotkey({ key: "k" }, () => move(-1), [move], "Previous report");

  useHotkey(
    { key: "Enter" },
    () => {
      const report = reports[cursorIndex];
      if (report) select(report);
    },
    [reports, cursorIndex, select],
    "Open the highlighted report"
  );

  useHotkey(
    { key: "x" },
    () => {
      const report = reports[cursorIndex];
      if (report && status === "pending") toggleChecked(report.id);
    },
    [reports, cursorIndex, status, toggleChecked],
    "Select the highlighted report for a bulk action"
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel-bg">
      {dialog}

      {compact ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-panel-border px-3 py-2.5">
          <span className="text-[12px] font-bold text-white">Live Reports</span>
          <span
            className="h-1.5 w-1.5 rounded-full bg-white"
            title="Live, updates without a refresh"
            aria-hidden="true"
          />
          <span className="ml-auto font-mono text-[12px] text-neutral-500">
            {reports.length}
            {query.hasNextPage ? "+" : ""}
          </span>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-1 border-b border-panel-border px-2.5 py-2">
        {STATUSES.map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`rounded px-2.5 py-1.5 text-sm font-medium capitalize transition-colors ${
              status === value ? "bg-white text-black" : "text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
            }`}
          >
            {value}
          </button>
        ))}
        <div className="ml-auto text-[13px] text-neutral-500">
          {reports.length}
          {query.hasNextPage ? "+" : ""} loaded
        </div>
      </div>

      {checked.size > 0 ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-panel-border bg-panel-raised px-2.5 py-2">
          <span className="text-[13px] text-neutral-300">
            {checked.size} selected
          </span>
          <button
            onClick={runBulkDismiss}
            disabled={bulkBusy}
            className="rounded-full border border-white bg-white px-3 py-1.5 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
          >
            {bulkBusy ? "Dismissing…" : "Dismiss selected"}
          </button>
          <button
            onClick={() => setChecked(new Set())}
            className="rounded px-2.5 py-1.5 text-[13px] text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
          >
            Clear
          </button>
          <button
            onClick={() => setChecked(new Set(reports.map((report) => report.id)))}
            className="ml-auto rounded px-2.5 py-1.5 text-[13px] text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
          >
            Select all loaded
          </button>
        </div>
      ) : null}

      {bulkError ? (
        <div className="shrink-0 border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">
          {bulkError}
        </div>
      ) : null}

      {pendingCount > 0 ? (
        <button
          onClick={applyPulse}
          aria-live="polite"
          className="mx-2 mt-2 shrink-0 rounded-full border border-white bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          {pendingCount} new {pendingCount === 1 ? "report" : "reports"}
        </button>
      ) : null}

      <div
        ref={listRef}
        tabIndex={0}
        aria-label="Reports"
        className="flex-1 overflow-y-auto outline-none focus:ring-1 focus:ring-inset focus:ring-white/30"
      >
        {query.isLoading && reports.length === 0 ? (
          <div className="p-4 text-base text-neutral-500">Loading reports…</div>
        ) : null}

        {query.error && reports.length === 0 ? (
          <div className="p-4 text-base text-severity-high">{query.error.message}</div>
        ) : null}

        {!query.isLoading && reports.length === 0 && !query.error ? (
          <div className="p-4 text-base text-neutral-500">Nothing in this queue.</div>
        ) : null}

        {reports.map((report, index) => {
          const isSelected = selected === report.id;
          const isCursor = index === cursorIndex;
          return (
            <div
              key={report.id}
              id={`report-row-${report.id}`}
              className={`flex items-start gap-2 border-b border-white/[0.08] px-3.5 py-2.5 transition-colors ${
                isSelected ? "bg-white/10" : isCursor ? "bg-panel-hover" : "hover:bg-panel-hover"
              }`}
            >
              {status === "pending" ? (
                <Checkbox
                  checked={checked.has(report.id)}
                  onChange={() => toggleChecked(report.id)}
                  label={`Select report ${report.id.slice(-8)}`}
                  className="mt-1"
                />
              ) : null}

              <button
                onClick={() => {
                  setCursorIndex(index);
                  select(report);
                }}
                className="flex min-w-0 flex-1 flex-col gap-1 text-left"
              >
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    report.source === "ai" ? "bg-severity-medium" : "bg-severity-low"
                  }`}
                />
                <span className="truncate text-sm font-medium text-neutral-200">{targetLabel(report)}</span>
                <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-[1px] text-[11px] font-semibold text-neutral-400">
                  {report.targetType}
                </span>
                {changedIds.has(report.id) ? (
                  <span className="shrink-0 rounded-full border border-white/45 px-2.5 py-[1px] text-[11px] font-semibold text-white">
                    changed
                  </span>
                ) : null}
                <span className="ml-auto shrink-0 text-[13px] text-neutral-500">{relativeTime(report.createdAt)}</span>
              </div>
              <div className="truncate text-[13px] text-neutral-400">{report.reason}</div>
              {previewText(report) ? (
                <div className="line-clamp-2 text-[13px] text-neutral-500">{previewText(report)}</div>
              ) : null}
              </button>
            </div>
          );
        })}

        {query.hasNextPage ? (
          <button
            onClick={() => query.fetchNextPage()}
            className="w-full px-3.5 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-panel-hover hover:text-neutral-200"
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
