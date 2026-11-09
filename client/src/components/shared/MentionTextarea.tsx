import { useRef } from "react";
import { renderMentionHighlight } from "../../lib/mentions";

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  textClassName = "text-base",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  textClassName?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative rounded-xl border border-neutral-300 focus-within:border-brand dark:border-neutral-700 dark:bg-neutral-900">
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 ${textClassName}`}
      >
        {value ? renderMentionHighlight(value) : null}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={`relative w-full resize-none border-none bg-transparent px-3 py-2 text-transparent caret-black outline-none placeholder:text-neutral-400 dark:caret-white ${textClassName}`}
      />
    </div>
  );
}
