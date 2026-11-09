import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../../node_modules/emoji-datasource-apple/emoji.json");
const out = resolve(__dirname, "../src/lib/emojiData.ts");

const data = JSON.parse(readFileSync(src, "utf8"));

const toChar = (unified) => unified.split("-").map((c) => String.fromCodePoint(parseInt(c, 16))).join("");

const CATEGORY_META = [
  { key: "Smileys & Emotion", id: "smileys", label: "Smileys & emotion", icon: "😀" },
  { key: "People & Body", id: "people", label: "People & body", icon: "👋" },
  { key: "Animals & Nature", id: "animals", label: "Animals & nature", icon: "🐻" },
  { key: "Food & Drink", id: "food", label: "Food & drink", icon: "🍔" },
  { key: "Activities", id: "activity", label: "Activity", icon: "⚽" },
  { key: "Travel & Places", id: "travel", label: "Travel & places", icon: "✈️" },
  { key: "Objects", id: "objects", label: "Objects", icon: "💡" },
  { key: "Symbols", id: "symbols", label: "Symbols", icon: "❤️" },
  { key: "Flags", id: "flags", label: "Flags", icon: "🏳️" },
];

const sprites = [];
const seen = new Set();
const addSprite = (native, x, y) => {
  if (seen.has(native)) return;
  seen.add(native);
  sprites.push([native, x, y]);
};

const keywords = {};
const categories = CATEGORY_META.map((m) => ({ ...m, emojis: [] }));
const catById = Object.fromEntries(categories.map((c) => [c.key, c]));

for (const e of data) {
  if (!e.has_img_apple) continue;
  const native = toChar(e.unified);
  addSprite(native, e.sheet_x, e.sheet_y);
  if (e.skin_variations) {
    for (const v of Object.values(e.skin_variations)) {
      if (v.has_img_apple) addSprite(toChar(v.unified), v.sheet_x, v.sheet_y);
    }
  }
  const cat = catById[e.category];
  if (!cat) continue;
  cat.emojis.push({ native, sort: e.sort_order });
  const kw = [...new Set([...(e.short_names || []), ...(e.name ? e.name.toLowerCase().split(/\s+/) : [])])]
    .join(" ")
    .replace(/[_-]/g, " ");
  if (kw) keywords[native] = kw;
}

for (const c of categories) {
  c.emojis.sort((a, b) => a.sort - b.sort);
}

const catOut = categories.map((c) => ({
  id: c.id,
  label: c.label,
  icon: c.icon,
  emojis: c.emojis.map((e) => e.native),
}));

const header = `export const SHEET_COLS = 62;
export const SHEET_ROWS = 62;

export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

`;

const spritesTs = `export const EMOJI_SPRITES: [string, number, number][] = ${JSON.stringify(sprites)};\n\n`;
const catsTs = `export const EMOJI_CATEGORIES: EmojiCategory[] = ${JSON.stringify(catOut, null, 0)};\n\n`;
const kwTs = `export const EMOJI_KEYWORDS: Record<string, string> = ${JSON.stringify(keywords)};\n`;

writeFileSync(out, header + spritesTs + catsTs + kwTs, "utf8");
console.log(`wrote ${out}`);
console.log(`sprites: ${sprites.length}, picker emojis: ${catOut.reduce((n, c) => n + c.emojis.length, 0)}`);
