import { foldHomoglyphs } from "./sanitizeInput.js";

const ZERO_WIDTH = /[­᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;

const MINOR_SEXUAL_TERMS = [
  "pedophile",
  "pedophiles",
  "pedophilia",
  "paedophile",
  "paedophiles",
  "paedophilia",
  "pedo",
  "paedo",
  "csam",
  "childporn",
];

const SLUR_TERMS = [
  "nigger",
  "niggers",
  "niggerz",
  "nigga",
  "niggas",
  "niggaz",
  "niggah",
  "niggahs",
  "niglet",
  "niglets",
  "nig",
  "nigs",
  "nigg",
  "niggs",
  "sandnigger",
  "sandniggers",
  "sandnig",
  "kike",
  "kikes",
  "heeb",
  "sheeny",
  "faggot",
  "faggots",
  "tranny",
  "trannies",
  "gook",
  "gooks",
  "spic",
  "spics",
  "wetback",
  "wetbacks",
  "beaner",
  "beaners",
  "towelhead",
  "towelheads",
  "raghead",
  "ragheads",
  "kaffir",
  "kaffirs",
  "coon",
  "coons",
  "jigaboo",
  "jigaboos",
  "porchmonkey",
  "gyppo",
  "retard",
  "retards",
  "retarded",
  "chink",
  "chinks",
  "zipperhead",
  "abo",
  "abos",
  "gippo",
  "pikey",
  "pikeys",
  "shitskin",
  "shitskins",
  "mudslime",
  "mudslimes",
  "groid",
  "groids",
  "tarbaby",
  "muzzie",
  "muzzies",
  "currymuncher",
  "dothead",
  "dotheads",
  "halfbreed",
  "mongoloid",
  "mongoloids",
  "spearchucker",
  "houseniger",
  "fag",
  "fags",
  "faggy",
  "dyke",
  "dykes",
  "shemale",
  "shemales",
  "trannies",
  "troon",
  "troons",
];

const HATE_TERMS = [
  "hitler",
  "hitlers",
  "adolfhitler",
  "heilhitler",
  "heil",
  "sieg",
  "siegheil",
  "hailhitler",
  "fuhrer",
  "nazi",
  "nazis",
  "nazism",
  "neonazi",
  "neonazis",
  "gasthejews",
  "gasjews",
  "gaschamber",
  "gaschambers",
  "holohoax",
  "hitlerdidnothingwrong",
  "whitepower",
  "whitepride",
  "racewar",
  "kkk",
  "kluxklan",
  "kukluxklan",
  "lynchthem",
  "aryanbrotherhood",
  "bloodandsoil",
  "blutundboden",
  "thirdreich",
  "swastika",
  "swastikas",
  "hakenkreuz",
  "zyklonb",
  "finalsolution",
  "greatreplacement",
  "dayoftherope",
];

const CATEGORIES = [
  { category: "minor_sexual", terms: MINOR_SEXUAL_TERMS },
  { category: "slur", terms: SLUR_TERMS },
  { category: "hate", terms: HATE_TERMS },
];

const SAFE_WORDS = ["niggardly", "niggardliness", "niggard", "niggards"];

const COMPACT_MIN_LENGTH = 5;

const LEET_MAP = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

const RAW_PATTERNS = [
  { category: "hate", label: "1488", pattern: /\b14\s*\/?\s*88\b/ },
  { category: "hate", label: "88 heil", pattern: /\bh\s*8\s*8\b/i },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SAFE_WORD_PATTERN = new RegExp(`\\b(?:${SAFE_WORDS.map(escapeRegex).join("|")})\\b`, "gi");

function foldLeet(text) {
  return foldHomoglyphs(String(text || ""))
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .replace(/[013456789@$!|+]/g, (ch) => LEET_MAP[ch] ?? ch)
    .replace(SAFE_WORD_PATTERN, " ");
}

function compact(text) {
  return foldLeet(text).replace(/[^a-z0-9]/g, "");
}

function squeeze(text) {
  return compact(text).replace(/(.)\1+/g, "$1");
}

const squeezeTerm = (term) => term.replace(/(.)\1+/g, "$1");

const COMPILED = CATEGORIES.map(({ category, terms }) => ({
  category,
  pattern: new RegExp(`\\b(?:${terms.map(escapeRegex).join("|")})\\b`, "i"),
  compactTerms: terms.filter((term) => term.length >= COMPACT_MIN_LENGTH),
  squeezedTerms: [
    ...new Set(
      terms
        .map((term) => squeezeTerm(term))
        .filter((term) => term.length >= COMPACT_MIN_LENGTH)
    ),
  ],
}));

export function findHardBlockedMatch(text) {
  const raw = foldHomoglyphs(String(text || "")).replace(ZERO_WIDTH, "");
  for (const { category, label, pattern } of RAW_PATTERNS) {
    if (pattern.test(raw)) return { term: label, category };
  }

  const folded = foldLeet(text);
  if (!folded) return null;

  for (const { category, pattern } of COMPILED) {
    const match = folded.match(pattern);
    if (match) return { term: match[0], category };
  }

  const squashed = compact(text);
  if (!squashed) return null;

  for (const { category, compactTerms } of COMPILED) {
    for (const term of compactTerms) {
      if (squashed.includes(term)) return { term, category };
    }
  }

  const squeezed = squeeze(text);
  if (!squeezed) return null;

  for (const { category, squeezedTerms } of COMPILED) {
    for (const term of squeezedTerms) {
      if (squeezed.includes(term)) return { term, category };
    }
  }

  return null;
}

export function findHardBlockedTerm(text) {
  return findHardBlockedMatch(text)?.term ?? null;
}

export function isHardBlocked(text) {
  return findHardBlockedMatch(text) !== null;
}
