import { useCallback, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

export interface ConfirmRequest {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
}

export function ConfirmDialog({
  request,
  isSubmitting,
  onClose,
}: {
  request: ConfirmRequest | null;
  isSubmitting?: boolean;
  onClose: () => void;
}) {
  if (!request) return null;

  const danger = request.tone === "danger";

  return (
    <Modal open onClose={onClose} title={request.title} tone={request.tone} size="sm">
      <div>
        {request.description && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400">{request.description}</div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {request.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
            disabled={isSubmitting}
            className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-40 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
            }`}
          >
            {request.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function useConfirm(isSubmitting?: boolean) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);

  const dialog = <ConfirmDialog request={request} isSubmitting={isSubmitting} onClose={close} />;

  return { confirm, dialog };
}
