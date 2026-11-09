const LEET = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
};

const BLOCKED_TERMS = [
  "nigg",
  "niger",
  "negroid",
  "coon",
  "kike",
  "spic",
  "wetback",
  "chink",
  "gook",
  "jap",
  "beaner",
  "darkie",
  "gypsy",
  "raghead",
  "towelhead",
  "hitler",
  "nazi",
  "heilhitler",
  "holocaust",
  "kkk",
  "whitepower",
  "faggot",
  "fag",
  "dyke",
  "tranny",
  "shemale",
  "retard",
  "mongoloid",
  "rapist",
  "rape",
  "pedo",
  "paedo",
  "molest",
  "incest",
  "lolicon",
  "childporn",
  "csam",
  "groomer",
];

const ALLOWED_SUBSTRINGS = [
  "nigerian",
  "nigeria",
  "raccoon",
  "cocoon",
  "tycoon",
  "japanese",
  "japan",
  "spice",
  "spicy",
  "therapist",
  "therapy",
  "scrape",
  "grape",
  "drape",
  "trapeze",
  "wrapper",
  "wrapping",
  "rapper",
  "rapping",
  "suspicious",
  "suspicion",
  "auspicious",
  "pedometer",
  "pedodontic",
  "torpedo",
  "speedo",
  "gobbledygook",
].sort((a, b) => b.length - a.length);

const PATTERNS = BLOCKED_TERMS.map((term) => ({
  term,
  regex: new RegExp(
    term
      .split("")
      .map((ch) => `${ch}+`)
      .join("")
  ),
}));

export function normalizeForFilter(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/[0-9]/g, (digit) => LEET[digit] ?? "");
}

function stripAllowed(normalized) {
  let result = normalized;
  for (const allowed of ALLOWED_SUBSTRINGS) {
    if (!result.includes(allowed)) continue;
    result = result.split(allowed).join(" ");
  }
  return result;
}

export function findBlockedTerm(value) {
  const normalized = normalizeForFilter(value);
  if (!normalized) return null;

  const haystack = stripAllowed(normalized);
  for (const { term, regex } of PATTERNS) {
    if (regex.test(haystack)) return term;
  }
  return null;
}

export function isBlockedUsername(value) {
  return findBlockedTerm(value) !== null;
}
