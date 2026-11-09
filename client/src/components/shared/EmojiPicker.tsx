import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { EMOJI_CATEGORIES, EMOJI_KEYWORDS } from "../../lib/emojiData";
import { EmojiSprite } from "../../lib/emoji";

const RECENTS_KEY = "socially-emoji-recents";
const MAX_RECENTS = 24;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecents(emojis: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(emojis.slice(0, MAX_RECENTS)));
  } catch {
    return;
  }
}

export function rememberEmoji(emoji: string) {
  const next = [emoji, ...loadRecents().filter((e) => e !== emoji)];
  saveRecents(next);
}

export function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed) return null;
    const matches: string[] = [];
    for (const category of EMOJI_CATEGORIES) {
      for (const emoji of category.emojis) {
        const keywords = EMOJI_KEYWORDS[emoji];
        if (keywords && keywords.includes(trimmed)) matches.push(emoji);
      }
    }
    return matches;
  }, [trimmed]);

  const pick = (emoji: string) => {
    rememberEmoji(emoji);
    setRecents(loadRecents());
    onSelect(emoji);
  };

  const grid = (emojis: string[]) => (
    <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
      {emojis.map((emoji, i) => (
        <button
          key={`${emoji}-${i}`}
          onClick={() => pick(emoji)}
          className="flex items-center justify-center rounded-lg py-1.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label={EMOJI_KEYWORDS[emoji] || emoji}
        >
          <EmojiSprite emoji={emoji} size="1.6rem" />
        </button>
      ))}
    </div>
  );

  const current = EMOJI_CATEGORIES.find((c) => c.id === activeCategory) ?? EMOJI_CATEGORIES[0];

  return (
    <Modal open onClose={onClose} title="Emojis">
      <div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emojis"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />

        {!trimmed && (
          <div className="mt-3 flex gap-1 overflow-x-auto border-b border-neutral-100 pb-2 dark:border-neutral-800">
            {EMOJI_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                title={category.label}
                aria-label={category.label}
                className={`flex shrink-0 items-center justify-center rounded-lg px-2 py-1.5 transition ${
                  category.id === activeCategory
                    ? "bg-brand/10 ring-1 ring-brand"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <EmojiSprite emoji={category.icon} size="1.25rem" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 max-h-72 overflow-y-auto">
          {trimmed ? (
            results && results.length ? (
              grid(results)
            ) : (
              <p className="py-6 text-center text-sm text-neutral-400">No emojis match "{query.trim()}".</p>
            )
          ) : (
            <>
              {recents.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Recent</p>
                  {grid(recents)}
                </div>
              )}
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">{current.label}</p>
              {grid(current.emojis)}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
