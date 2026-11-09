import { useEffect, useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { ReportActionDialog, type ReportAction, type ReportActionPayload } from "../components/ReportActionDialog";
import { PanelTitle } from "../components/panelKit";
import { UserName } from "../components/UserName";
import { JumpTo } from "../components/JumpTo";
import { postUrl, profileUrl } from "../lib/links";
import { api } from "../lib/api";
import { usePinnedSelection } from "../lib/selectionBus";
import { absoluteTime, relativeTime } from "../lib/time";
import { claimResource, releaseResource, useResourceClaim } from "../lib/realtime";
import { useAuth } from "../lib/authContext";
import { RANK_LEVEL } from "../types";
import type { StaffReport } from "../types";

const CLAIM_HEARTBEAT_MS = 2 * 60 * 1000;

interface Props {
  pinnedId?: string | null;
  onPinChange?: (id: string | null) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] font-semibold text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-200">{children}</span>
    </div>
  );
}

function SnapshotView({ report }: { report: StaffReport }) {
  const snapshot = report.snapshot;
  const liveContent = report.targetPost?.content || report.targetMessage?.content || "";
  const content = snapshot?.content || report.contentSnapshot || liveContent;
  const author =
    snapshot?.authorUsername ||
    report.targetPost?.author?.username ||
    report.targetMessage?.sender?.username ||
    report.targetUser?.username ||
    null;

  const targetGone =
    (report.targetType === "post" && !report.targetPost) ||
    (report.targetType === "message" && !report.targetMessage) ||
    (report.targetType === "user" && !report.targetUser);

  return (
    <div className="rounded-lg border border-panel-border bg-panel-raised">
      <div className="flex items-center gap-2 border-b border-panel-border px-3.5 py-2.5">
        <UserName username={author} className="text-sm font-medium text-neutral-200" />
        {snapshot?.postedAt ? (
          <span className="text-[13px] text-neutral-500">{absoluteTime(snapshot.postedAt)}</span>
        ) : null}
        {targetGone ? (
          <span className="ml-auto rounded-full border border-severity-high/50 px-2.5 py-[1px] text-[11px] font-semibold text-severity-high">
            deleted
          </span>
        ) : null}
      </div>

      <div className="px-3.5 py-2.5">
        {content ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-200">{content}</p>
        ) : (
          <p className="text-sm italic text-neutral-500">No text content</p>
        )}

        {snapshot?.pollOptions?.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {snapshot.pollOptions.map((option, index) => (
              <li key={index} className="rounded-lg border border-panel-border px-2.5 py-1.5 text-[13px] text-neutral-300">
                {option}
              </li>
            ))}
          </ul>
        ) : null}

        {snapshot?.mediaUrl || snapshot?.gifUrl ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-panel-border">
            <img
              src={snapshot.mediaUrl || snapshot.gifUrl || ""}
              alt="Reported media"
              className="max-h-64 w-full object-contain"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StaffNoteEditor({
  reportId,
  value,
  onSaved,
}: {
  reportId: string;
  value: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
    setSavedAt(null);
  }, [reportId, value]);

  const dirty = draft.trim() !== value.trim();

  const save = () => {
    setSaving(true);
    setError(null);
    api
      .patch(`/reports/${reportId}/note`, { staffNote: draft.trim() })
      .then(() => {
        setSavedAt(Date.now());
        onSaved();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="rounded-lg border border-panel-border bg-panel-raised px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-neutral-500">Staff note</div>
        {savedAt && !dirty ? <span className="text-[12px] text-neutral-500">Saved</span> : null}
      </div>

      <textarea
        rows={3}
        value={draft}
        maxLength={2000}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Internal note, not shown to the user"
        className="mt-1 w-full resize-y rounded-lg border border-panel-border bg-panel-bg px-2.5 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-500 focus:border-neutral-500"
      />

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[12px] text-severity-high" role={error ? "alert" : undefined}>
          {error || ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-neutral-500">{draft.length}/2000</span>
          {dirty ? (
            <button
              type="button"
              onClick={() => setDraft(value)}
              className="rounded px-2.5 py-1 text-[13px] text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
            >
              Revert
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full border border-white bg-white px-3 py-1 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportWorkspace({ pinnedId, onPinChange }: Props) {
  const [localPin, setLocalPin] = useState<string | null>(pinnedId ?? null);
  const activePin = pinnedId ?? localPin;
  const reportId = usePinnedSelection("report", activePin);

  const query = useQuery<{ report: StaffReport }>({
    queryKey: ["staff", "report", reportId],
    queryFn: () => api.get<{ report: StaffReport }>(`/reports/${reportId}`),
    enabled: Boolean(reportId),
  });

  const report = query.data?.report;

  const { user } = useAuth();
  const resource = reportId ? `report:${reportId}` : null;
  const claim = useResourceClaim(resource);
  const claimedByMe = Boolean(claim && user && claim.userId === user.id);
  const claimedByOther = Boolean(claim && !claimedByMe);

  useEffect(() => {
    if (!resource || !claimedByMe) return;
    const timer = setInterval(() => {
      claimResource(resource);
    }, CLAIM_HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [resource, claimedByMe]);

  const toggleClaim = () => {
    if (!resource) return;
    if (claimedByMe) releaseResource(resource);
    else claimResource(resource);
  };

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<ReportAction | null>(null);

  const isAdmin = RANK_LEVEL[user?.role ?? "user"] >= RANK_LEVEL.admin;

  const targetLabel = report?.snapshot?.authorUsername
    ? `@${report.snapshot.authorUsername}`
    : report?.targetPost?.author?.username
      ? `@${report.targetPost.author.username}`
      : report?.targetMessage?.sender?.username
        ? `@${report.targetMessage.sender.username}`
        : report?.targetUser
          ? `@${report.targetUser.username}`
          : "this user";

  const runAction = (payload: ReportActionPayload) => {
    if (!reportId) return;

    setBusy(true);
    setActionError(null);
    api
      .post(`/reports/${reportId}/action`, payload)
      .then(() => {
        setPendingAction(null);
        if (resource) releaseResource(resource);
        return query.refetch();
      })
      .catch((err: Error) => setActionError(err.message))
      .finally(() => setBusy(false));
  };

  const togglePin = () => {
    const next = activePin ? null : reportId;
    setLocalPin(next);
    onPinChange?.(next);
  };

  if (!reportId) {
    return (
      <div className="flex h-full items-center justify-center bg-panel-bg p-6 text-center">
        <p className="max-w-xs text-sm text-neutral-500">
          Select a report from the feed. Use <kbd className="rounded bg-panel-raised px-1">j</kbd> and{" "}
          <kbd className="rounded bg-panel-raised px-1">k</kbd> to move through the queue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-panel-bg">
      <ReportActionDialog
        action={pendingAction}
        targetLabel={targetLabel}
        isAdmin={isAdmin}
        isSubmitting={busy}
        onCancel={() => setPendingAction(null)}
        onSubmit={runAction}
      />

      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-panel-border bg-panel-bg px-3.5 py-2.5">
        <PanelTitle>Report</PanelTitle>
        <span className="font-mono text-[13px] text-neutral-500">{reportId.slice(-8)}</span>

        <button
          onClick={toggleClaim}
          disabled={claimedByOther}
          className={`ml-auto rounded px-2.5 py-1.5 text-[13px] transition-colors ${
            claimedByMe
              ? "bg-severity-medium/20 text-severity-medium"
              : claimedByOther
                ? "cursor-not-allowed bg-panel-raised text-neutral-500"
                : "text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
          }`}
          title={
            claimedByOther
              ? `@${claim?.username} is working on this report`
              : claimedByMe
                ? "Release so another moderator can take it"
                : "Claim so other moderators know you are on it"
          }
        >
          {claimedByOther ? `@${claim?.username} has this` : claimedByMe ? "Claimed by you" : "Claim"}
        </button>

        <button
          onClick={togglePin}
          className={`rounded px-2.5 py-1.5 text-[13px] transition-colors ${
            activePin ? "bg-white text-black" : "text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
          }`}
          title={activePin ? "Unpin to follow the feed selection" : "Pin this report while browsing the feed"}
        >
          {activePin ? "Pinned" : "Pin"}
        </button>
      </div>

      {report && report.status === "pending" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-panel-border bg-panel-bg px-3.5 py-2">
          <button
            onClick={() => setPendingAction("dismiss")}
            disabled={busy}
            className="rounded px-2.5 py-1.5 text-[13px] font-medium text-neutral-400 transition-colors hover:bg-panel-hover hover:text-neutral-200 disabled:opacity-40"
          >
            Dismiss
          </button>
          {report.targetType === "post" ? (
            <button
              onClick={() => setPendingAction("delete_post")}
              disabled={busy}
              className="rounded px-2.5 py-1.5 text-[13px] font-medium text-severity-medium transition-colors hover:bg-severity-medium/15 disabled:opacity-40"
            >
              Delete post
            </button>
          ) : null}
          <button
            onClick={() => setPendingAction("suspend")}
            disabled={busy}
            className="rounded px-2.5 py-1.5 text-[13px] font-medium text-severity-high transition-colors hover:bg-severity-high/15 disabled:opacity-40"
          >
            Suspend author
          </button>
          <button
            onClick={() => setPendingAction("deactivate")}
            disabled={busy}
            className="rounded px-2.5 py-1.5 text-[13px] font-medium text-severity-high transition-colors hover:bg-severity-high/15 disabled:opacity-40"
          >
            Deactivate
          </button>

          {claimedByOther ? (
            <span className="ml-auto text-[12px] text-severity-medium">@{claim?.username} is on this report</span>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">
          {actionError}
        </div>
      ) : null}

      {query.isLoading ? <div className="p-4 text-base text-neutral-500">Loading report…</div> : null}
      {query.error ? <div className="p-4 text-base text-severity-high">{query.error.message}</div> : null}

      {report ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reason">{report.reason}</Field>
            <Field label="Status">
              <span
                className={
                  report.status === "pending"
                    ? "text-severity-medium"
                    : report.status === "actioned"
                      ? "text-severity-high"
                      : "text-neutral-400"
                }
              >
                {report.status}
              </span>
            </Field>
            <Field label="Source">{report.source === "ai" ? "AI moderation" : "User report"}</Field>
            <Field label="Filed">{relativeTime(report.createdAt)}</Field>
            <Field label="Reporter">
              <UserName username={report.reporter?.username} className="text-sm text-neutral-200" fallback="-" />
            </Field>
            <Field label="Community">{report.communityName || report.communitySlug || "-"}</Field>
          </div>

          {report.details ? (
            <div className="rounded-lg border border-panel-border bg-panel-raised px-3.5 py-2.5">
              <div className="text-[12px] font-semibold text-neutral-500">Reporter notes</div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-300">{report.details}</p>
            </div>
          ) : null}

          <SnapshotView report={report} />

          <StaffNoteEditor
            reportId={report.id}
            value={report.staffNote || ""}
            onSaved={() => query.refetch()}
          />

          {report.actionTaken ? <Field label="Action taken">{report.actionTaken}</Field> : null}
        </div>
      ) : null}
    </div>
  );
}
