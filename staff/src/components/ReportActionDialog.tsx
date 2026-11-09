import { useEffect, useMemo, useState } from "react";
import { Modal } from "@socially/shared/components/Modal";
import { Checkbox } from "./Checkbox";
import { DateTimePicker } from "./DateTimePicker";

export type ReportAction = "dismiss" | "delete_post" | "suspend" | "deactivate";

export type PurgeWindowId = "1h" | "6h" | "24h" | "3d" | "7d" | "all";

export interface ReportActionPayload {
  action: ReportAction;
  reason: string;
  until?: string;
  purgeRecent?: boolean;
  purgeWindow?: PurgeWindowId;
  deleteAccount?: boolean;
  staffNote?: string;
}

const DURATIONS = [
  { id: "permanent", label: "Permanent", hours: 0 },
  { id: "24h", label: "24 hours", hours: 24 },
  { id: "3d", label: "3 days", hours: 72 },
  { id: "7d", label: "7 days", hours: 168 },
  { id: "30d", label: "30 days", hours: 720 },
  { id: "custom", label: "Custom", hours: -1 },
] as const;

type DurationId = (typeof DURATIONS)[number]["id"];

const PURGE_WINDOWS: { id: PurgeWindowId; label: string }[] = [
  { id: "1h", label: "Last hour" },
  { id: "6h", label: "Last 6 hours" },
  { id: "24h", label: "Last 24 hours" },
  { id: "3d", label: "Last 3 days" },
  { id: "7d", label: "Last 7 days" },
  { id: "all", label: "Everything" },
];

const PURGE_WINDOW_LABEL: Record<PurgeWindowId, string> = {
  "1h": "the last hour",
  "6h": "the last 6 hours",
  "24h": "the last 24 hours",
  "3d": "the last 3 days",
  "7d": "the last 7 days",
  all: "all time",
};

const ACTION_LABEL: Record<ReportAction, string> = {
  dismiss: "Dismiss report",
  delete_post: "Delete post",
  suspend: "Suspend author",
  deactivate: "Deactivate account",
};

function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ReportActionDialog({
  action,
  targetLabel,
  isAdmin,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  action: ReportAction | null;
  targetLabel: string;
  isAdmin: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: ReportActionPayload) => void;
}) {
  const [reason, setReason] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [duration, setDuration] = useState<DurationId>("permanent");
  const [customUntil, setCustomUntil] = useState("");
  const [purgeRecent, setPurgeRecent] = useState(false);
  const [purgeWindow, setPurgeWindow] = useState<PurgeWindowId>("24h");
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setReason("");
    setStaffNote("");
    setDuration("permanent");
    setCustomUntil(toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    setPurgeRecent(false);
    setPurgeWindow("24h");
    setDeleteAccount(false);
    setTouched(false);
  }, [action]);

  const isUserAction = action === "suspend" || action === "deactivate";
  const isSuspend = action === "suspend";
  const isDeactivate = action === "deactivate";
  const isPermanent = isSuspend && duration === "permanent";
  const canDeleteAccount = isAdmin && (isPermanent || isDeactivate);
  const deleteAccountLabel = isDeactivate
    ? "Delete account (Includes all posts)"
    : "Ban permanently and delete the account";

  useEffect(() => {
    if (!isUserAction) setPurgeRecent(false);
    if (!canDeleteAccount) setDeleteAccount(false);
    if (!isAdmin) setPurgeWindow((current) => (current === "all" ? "24h" : current));
  }, [isUserAction, canDeleteAccount, isAdmin]);

  const until = useMemo(() => {
    if (action !== "suspend" || duration === "permanent") return undefined;
    if (duration === "custom") {
      if (!customUntil) return undefined;
      const parsed = new Date(customUntil);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    const hours = DURATIONS.find((d) => d.id === duration)?.hours ?? 0;
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }, [action, duration, customUntil]);

  if (!action) return null;

  const reasonRequired = action === "suspend";
  const reasonError = reasonRequired && !reason.trim() ? "A reason is required to suspend a user." : null;
  const untilError =
    action === "suspend" && duration === "custom" && !until
      ? "Choose a valid end date."
      : action === "suspend" && duration === "custom" && until && new Date(until) <= new Date()
        ? "The end date must be in the future."
        : null;

  const blocked = Boolean(reasonError || untilError) || isSubmitting;
  const danger = action === "suspend" || action === "deactivate" || action === "delete_post";

  const summary = (() => {
    if (action === "dismiss") return `Dismiss this report. No action is taken against ${targetLabel}.`;
    if (action === "delete_post") return `Delete the reported post by ${targetLabel}.`;

    if (action === "deactivate") {
      if (deleteAccount) {
        return `Deactivate ${targetLabel}, delete every post and message they ever made, and delete the account.`;
      }
      const base = `Deactivate ${targetLabel} and end their sessions.`;
      if (!purgeRecent) return base;
      return `${base} Posts and messages from ${PURGE_WINDOW_LABEL[purgeWindow]} will be deleted.`;
    }

    if (deleteAccount) {
      return `Permanently ban ${targetLabel}, delete every post and message they ever made, and delete the account. Their Discord account is blocked from ever signing up again.`;
    }

    const sentence = until
      ? `Suspend ${targetLabel} until ${new Date(until).toLocaleString()}.`
      : `Permanently suspend ${targetLabel}.`;

    if (!purgeRecent) return sentence;
    return `${sentence} Posts and messages from ${PURGE_WINDOW_LABEL[purgeWindow]} will be deleted.`;
  })();

  const field =
    "w-full rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-500 focus:border-neutral-500";

  return (
    <Modal open onClose={onCancel} title={ACTION_LABEL[action]} tone={danger ? "danger" : "default"} size="sm">
      <div className="flex flex-col gap-3">
        {(reasonRequired || isUserAction) && (
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-neutral-500">
              Reason {reasonRequired ? "" : "(optional)"}
            </label>
            <textarea
              autoFocus
              rows={3}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Shown to the user and logged"
              aria-invalid={Boolean(touched && reasonError)}
              className={`${field} resize-y`}
            />
            <div className="mt-1 flex justify-between">
              <span className="text-[12px] text-severity-high" role={touched && reasonError ? "alert" : undefined}>
                {touched ? reasonError || "" : ""}
              </span>
              <span className="text-[12px] text-neutral-500">{reason.length}/500</span>
            </div>
          </div>
        )}

        {action === "suspend" && (
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-neutral-500">Duration</label>
            <div className="flex flex-wrap gap-1">
              {DURATIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDuration(option.id)}
                  className={`rounded px-2.5 py-1.5 text-[13px] transition-colors ${
                    duration === option.id
                      ? "bg-white text-black"
                      : "bg-panel-raised text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {duration === "custom" && (
              <div className="mt-2">
                <DateTimePicker
                  value={customUntil}
                  onChange={setCustomUntil}
                  min={new Date()}
                  label="Suspension end date and time"
                />
              </div>
            )}
            {untilError && (
              <p className="mt-1 text-[12px] text-severity-high" role="alert">
                {untilError}
              </p>
            )}
          </div>
        )}

        {isUserAction && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <Checkbox
                checked={purgeRecent}
                disabled={deleteAccount}
                onChange={setPurgeRecent}
                label="Delete their recent posts and messages"
              />
              <span className={`text-[13px] ${deleteAccount ? "text-neutral-500" : "text-neutral-300"}`}>
                Delete their recent posts and messages
              </span>
            </div>

            {purgeRecent && !deleteAccount && (
              <div className="flex flex-wrap gap-1 pl-7">
                {PURGE_WINDOWS.map((option) => {
                  const locked = option.id === "all" && !isAdmin;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={locked}
                      onClick={() => setPurgeWindow(option.id)}
                      title={locked ? "Only admins and above can delete an entire history" : undefined}
                      className={`rounded px-2.5 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        purgeWindow === option.id
                          ? "bg-white text-black"
                          : "bg-panel-bg text-neutral-400 enabled:hover:bg-panel-hover enabled:hover:text-neutral-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className={`flex items-center gap-2.5 text-[13px] ${
                canDeleteAccount ? "text-neutral-300" : "cursor-not-allowed text-neutral-500"
              }`}
              title={
                !isAdmin
                  ? "Only admins and above can delete an account"
                  : !canDeleteAccount
                    ? "Set the duration to Permanent to delete the account"
                    : undefined
              }
            >
              <Checkbox
                checked={deleteAccount}
                disabled={!canDeleteAccount}
                onChange={setDeleteAccount}
                label={deleteAccountLabel}
              />
              <span>{deleteAccountLabel}</span>
            </div>

            {deleteAccount && (
              <p className="pl-7 text-[12px] leading-relaxed text-severity-high">
                {isDeactivate
                  ? "Deletes every post and message from all time and removes the account. This cannot be undone."
                  : "Deletes every post and message from all time, removes the account, and blocks their Discord account from signing up again. This cannot be undone."}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-semibold text-neutral-500">
            Staff note (optional)
          </label>
          <textarea
            rows={2}
            value={staffNote}
            maxLength={2000}
            onChange={(e) => setStaffNote(e.target.value)}
            placeholder="Internal note, not shown to the user"
            className={`${field} resize-y`}
          />
        </div>

        <div
          className={`rounded border px-2.5 py-2.5 text-[13px] ${
            danger
              ? "border-severity-high/40 bg-severity-high/10 text-severity-high"
              : "border-panel-border bg-panel-raised text-neutral-300"
          }`}
        >
          {summary}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-panel-border px-3.5 py-2 text-[13px] font-medium text-neutral-300 hover:bg-panel-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setTouched(true);
              if (reasonError || untilError) return;
              onSubmit({
                action,
                reason: reason.trim(),
                until,
                purgeRecent: purgeRecent && !deleteAccount ? true : undefined,
                purgeWindow: purgeRecent && !deleteAccount ? purgeWindow : undefined,
                deleteAccount: deleteAccount || undefined,
                staffNote: staffNote.trim() || undefined,
              });
            }}
            disabled={blocked}
            className={`rounded-full px-3.5 py-2 text-[13px] font-medium disabled:opacity-40 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-white text-black hover:bg-neutral-200"
            }`}
          >
            {isSubmitting ? "Working…" : ACTION_LABEL[action]}
          </button>
        </div>
      </div>
    </Modal>
  );
}
