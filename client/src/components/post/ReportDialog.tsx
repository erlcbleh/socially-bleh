import { useState } from "react";
import { Modal } from "../shared/Modal";

const REASONS = ["Spam", "Harassment or bullying", "Hate speech", "Impersonation", "Misinformation", "Other"];

export function ReportDialog({
  open,
  onClose,
  onSubmit,
  title,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
  title: string;
  isSubmitting: boolean;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-lg p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
              <span className="text-sm">{r}</span>
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add any additional details (optional)"
          rows={3}
          className="w-full rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          onClick={() => onSubmit(reason, details)}
          disabled={isSubmitting}
          className="w-full rounded-full bg-red-500 py-2 font-medium text-white disabled:opacity-40"
        >
          Submit report
        </button>
      </div>
    </Modal>
  );
}
