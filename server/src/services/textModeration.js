import axios from "axios";
import { env } from "../config/env.js";

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";
const TIMEOUT_MS = 8000;
const MAX_CHARS = 4000;
const MAX_BATCH = 5;
const LINGER_MS = 50;
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

let cooldownUntil = 0;
let queue = [];
let timer = null;

function parseRetryDelayMs(err) {
  const header = Number(err.response?.headers?.["retry-after"]);
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, MAX_COOLDOWN_MS);

  const detail = err.response?.data?.error?.message || "";
  const match = detail.match(/try again in\s+(?:(\d+)m)?\s*([\d.]+)?s/i);
  if (match) {
    const minutes = Number(match[1] || 0);
    const seconds = Number(match[2] || 0);
    const ms = (minutes * 60 + seconds) * 1000;
    if (ms > 0) return Math.min(ms + 1000, MAX_COOLDOWN_MS);
  }
  return DEFAULT_COOLDOWN_MS;
}

export function moderationCoolingDown() {
  return Date.now() < cooldownUntil;
}

export function moderationCooldownRemainingMs() {
  return Math.max(0, cooldownUntil - Date.now());
}

function flaggedCategories(result) {
  return Object.entries(result.categories || {})
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);
}

const ALLOWED = { action: "allow", category: "none", rationale: "", failed: false };

function mapResult(result) {
  if (!result || !result.flagged) return ALLOWED;
  const categories = flaggedCategories(result);
  const label = categories.join(", ") || "flagged";
  return {
    action: "block",
    category: label,
    rationale: `OpenAI moderation flagged: ${label}`,
    failed: false,
  };
}

async function runBatch(batch) {
  try {
    const res = await axios.post(
      ENDPOINT,
      { model: MODEL, input: batch.map((item) => item.text.slice(0, MAX_CHARS)) },
      { headers: { Authorization: `Bearer ${env.openaiApiKey}` }, timeout: TIMEOUT_MS }
    );

    const results = res.data?.results || [];
    batch.forEach((item, i) => item.resolve(mapResult(results[i])));
  } catch (err) {
    const status = err.response?.status;
    const apiError = err.response?.data?.error || {};
    const code = apiError.code || apiError.type || "unknown";
    const detail = apiError.message || err.message;
    const retryable = status === 429 ? code !== "insufficient_quota" : !status || status >= 500;

    if (status === 429 && retryable) {
      const wait = parseRetryDelayMs(err);
      const wasCooling = moderationCoolingDown();
      cooldownUntil = Date.now() + wait;
      if (!wasCooling) {
        console.error(`Text moderation rate limited; pausing checks for ${Math.round(wait / 1000)}s. code=${code}: ${detail}`);
      }
    } else if (!retryable) {
      console.error(`Text moderation DISABLED - text is passing unchecked. status=${status} code=${code}: ${detail}`);
    } else {
      console.error(`Text moderation call failed (will retry). status=${status} code=${code}: ${detail}`);
    }

    const failure = { action: "allow", category: "none", rationale: "", failed: true, retryable };
    batch.forEach((item) => item.resolve(failure));
  }
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  runBatch(batch);
}

function enqueue(text) {
  return new Promise((resolve) => {
    queue.push({ text, resolve });
    if (queue.length >= MAX_BATCH) {
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, LINGER_MS);
    }
  });
}

export async function screenText(text) {
  const trimmed = (text || "").trim();
  if (!env.openaiApiKey || !trimmed) return ALLOWED;
  if (moderationCoolingDown()) {
    return { action: "allow", category: "none", rationale: "", failed: true, retryable: true };
  }
  return enqueue(trimmed);
}
