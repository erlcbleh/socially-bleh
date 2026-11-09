import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

export interface PromptRequest {
  title: string;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}

export function PromptDialog({
  request,
  isSubmitting,
  onClose,
}: {
  request: PromptRequest | null;
  isSubmitting?: boolean;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue(request?.initialValue ?? "");
    setError(null);
    setTouched(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const timer = setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [request]);

  const validate = useCallback(
    (next: string): string | null => {
      if (!request) return null;
      const trimmed = next.trim();
      if (request.required !== false && trimmed.length === 0) {
        return `${request.label || "This field"} is required.`;
      }
      if (request.maxLength && next.length > request.maxLength) {
        return `Must be ${request.maxLength} characters or fewer.`;
      }
      return request.validate ? request.validate(trimmed) : null;
    },
    [request]
  );

  if (!request) return null;

  const danger = request.tone === "danger";
  const currentError = touched ? error ?? validate(value) : error;
  const blocked = Boolean(validate(value)) || isSubmitting;

  const submit = () => {
    const problem = validate(value);
    setTouched(true);
    setError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }
    request.onSubmit(value.trim());
    onClose();
  };

  const onKeyDown = (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
    if (event.key !== "Enter") return;
    if (request.multiline && !event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  const fieldClass =
    "w-full rounded-lg border border-[var(--field-border,#d4d4d4)] bg-[var(--field-surface,#fff)] px-3 py-2 text-sm text-[var(--field-fg,inherit)] outline-none transition-colors placeholder:text-neutral-500 focus:border-[var(--field-border-focus,#737373)]";

  return (
    <Modal open onClose={onClose} title={request.title} tone={request.tone} size="sm">
      <div>
        {request.description && (
          <div className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">{request.description}</div>
        )}

        {request.label && (
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {request.label}
          </label>
        )}

        {request.multiline ? (
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            rows={4}
            value={value}
            placeholder={request.placeholder}
            maxLength={request.maxLength}
            onChange={(e) => {
              setValue(e.target.value);
              if (touched) setError(validate(e.target.value));
            }}
            onBlur={() => {
              setTouched(true);
              setError(validate(value));
            }}
            onKeyDown={onKeyDown}
            aria-invalid={Boolean(currentError)}
            className={`${fieldClass} resize-y`}
          />
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type="text"
            value={value}
            placeholder={request.placeholder}
            maxLength={request.maxLength}
            onChange={(e) => {
              setValue(e.target.value);
              if (touched) setError(validate(e.target.value));
            }}
            onBlur={() => {
              setTouched(true);
              setError(validate(value));
            }}
            onKeyDown={onKeyDown}
            aria-invalid={Boolean(currentError)}
            className={fieldClass}
          />
        )}

        <div className="mt-1 flex items-start justify-between gap-2">
          <p className="text-xs text-red-600 dark:text-red-400" role={currentError ? "alert" : undefined}>
            {currentError || ""}
          </p>
          {request.maxLength && (
            <span className="shrink-0 text-xs text-neutral-400">
              {value.length}/{request.maxLength}
            </span>
          )}
        </div>

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
            onClick={submit}
            disabled={blocked}
            className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-40 ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
            }`}
          >
            {request.confirmLabel || "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function usePrompt(isSubmitting?: boolean) {
  const [request, setRequest] = useState<PromptRequest | null>(null);

  const prompt = useCallback((next: PromptRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);

  const dialog = <PromptDialog request={request} isSubmitting={isSubmitting} onClose={close} />;

  return { prompt, dialog };
}
