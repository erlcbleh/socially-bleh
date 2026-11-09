import { forwardRef, useRef, type TextareaHTMLAttributes } from "react";
import { renderWithEmoji } from "../../lib/emoji";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & {
  value: string;
  wrapperClassName?: string;
  emojiSize?: string;
};

export const EmojiTextarea = forwardRef<HTMLTextAreaElement, Props>(function EmojiTextarea(
  { value, className = "", wrapperClassName = "", emojiSize = "1.15em", onScroll, ...rest },
  ref,
) {
  const backdropRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <div
        ref={backdropRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words ${className}`}
      >
        {value ? renderWithEmoji(value, emojiSize) : null}
        {"​"}
      </div>
      <textarea
        ref={ref}
        value={value}
        onScroll={(e) => {
          if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
          onScroll?.(e);
        }}
        className={`relative w-full bg-transparent text-transparent caret-black dark:caret-white ${className}`}
        {...rest}
      />
    </div>
  );
});
