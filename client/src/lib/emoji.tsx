import { Fragment, type CSSProperties, type ReactNode } from "react";
import { EMOJI_SPRITES, SHEET_COLS, SHEET_ROWS } from "./emojiData";

const SHEET_URL = "/emoji-apple-64.png";

const stripVariation = (s: string) => s.replace(/️/g, "");

const spriteMap = new Map<string, [number, number]>();
for (const [native, x, y] of EMOJI_SPRITES) {
  spriteMap.set(native, [x, y]);
  spriteMap.set(stripVariation(native), [x, y]);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const emojiRegex = new RegExp(
  "(" +
    [...new Set(EMOJI_SPRITES.map(([native]) => stripVariation(native)))]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|") +
    ")",
  "gu",
);

function spriteStyle(x: number, y: number, size: string): CSSProperties {
  return {
    display: "inline-block",
    width: size,
    height: size,
    verticalAlign: "-0.15em",
    backgroundImage: `url(${SHEET_URL})`,
    backgroundSize: `${100 * SHEET_COLS}% ${100 * SHEET_ROWS}%`,
    backgroundPosition: `${(100 * x) / (SHEET_COLS - 1)}% ${(100 * y) / (SHEET_ROWS - 1)}%`,
    backgroundRepeat: "no-repeat",
  };
}

export function EmojiSprite({ emoji, size = "1.15em" }: { emoji: string; size?: string }) {
  const pos = spriteMap.get(emoji);
  if (!pos) return <>{emoji}</>;
  return (
    <span
      role="img"
      aria-label={emoji}
      style={spriteStyle(pos[0], pos[1], size)}
    />
  );
}

export function renderWithEmoji(text: string, size = "1.15em"): ReactNode[] {
  if (!text) return [text];
  const parts = stripVariation(text).split(emojiRegex);
  return parts.map((part, i) => {
    const pos = spriteMap.get(part);
    if (pos) {
      return <span key={i} role="img" aria-label={part} style={spriteStyle(pos[0], pos[1], size)} />;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function EmojiText({
  children,
  size,
  className,
}: {
  children: string | null | undefined;
  size?: string;
  className?: string;
}) {
  if (!children) return null;
  return <span className={className}>{renderWithEmoji(children, size)}</span>;
}
