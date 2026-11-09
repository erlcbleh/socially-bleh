import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuSmile, LuPencil, LuTrash2, LuFlag } from "react-icons/lu";
import type { MessageReaction } from "../../types";
import { EmojiSprite } from "../../lib/emoji";

const PICKER_WIDTH = 220;

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function ReactionRow({
  reactions,
  onToggle,
  align,
}: {
  reactions: MessageReaction[];
  onToggle: (emoji: string) => void;
  align: "start" | "end";
}) {
  if (!reactions.length) return null;

  return (
    <div className={`mt-1 flex flex-wrap gap-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition ${
            r.mine
              ? "border-brand bg-brand/10 text-brand"
              : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          }`}
        >
          <EmojiSprite emoji={r.emoji} size="1rem" />
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

export function MessageActions({
  mine,
  canEdit,
  canDeleteStaff,
  onReact,
  onEdit,
  onDelete,
  onReport,
}: {
  mine: boolean;
  canEdit: boolean;
  canDeleteStaff?: boolean;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPickerPosition({
        top: Math.max(rect.top - 8, 8),
        left: Math.min(Math.max(rect.left, 8), window.innerWidth - PICKER_WIDTH - 8),
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [pickerOpen]);

  const iconClass =
    "rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200";

  return (
    <div className="relative flex items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
      <button
        ref={triggerRef}
        onClick={() => setPickerOpen((v) => !v)}
        className={iconClass}
        aria-label="Add reaction"
      >
        <LuSmile className="h-3.5 w-3.5" />
      </button>

      {mine && canEdit && (
        <button onClick={onEdit} className={iconClass} aria-label="Edit message">
          <LuPencil className="h-3.5 w-3.5" />
        </button>
      )}
      {(mine || canDeleteStaff) && (
        <button onClick={onDelete} className={iconClass} aria-label="Delete message">
          <LuTrash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {!mine && onReport && (
        <button onClick={onReport} className={iconClass} aria-label="Report message">
          <LuFlag className="h-3.5 w-3.5" />
        </button>
      )}

      {pickerOpen &&
        pickerPosition &&
        createPortal(
          <>
            <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
            <div
              className="fixed z-40 flex -translate-y-full gap-0.5 rounded-full border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              style={{ top: pickerPosition.top, left: pickerPosition.left }}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(emoji);
                    setPickerOpen(false);
                  }}
                  className="rounded-full px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <EmojiSprite emoji={emoji} size="1.25rem" />
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export function TypingIndicator({ names }: { names: string[] }) {
  if (!names.length) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-neutral-500" aria-live="polite">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
      </span>
      {label}
    </div>
  );
}
