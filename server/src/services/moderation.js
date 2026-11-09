import axios from "axios";
import { env } from "../config/env.js";

const MAX_IMAGES = 8;
const TIMEOUT_MS = 20_000;
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

let cooldownUntil = 0;

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

export function imageModerationCoolingDown() {
  return Date.now() < cooldownUntil;
}

export function imageModerationCooldownRemainingMs() {
  return Math.max(0, cooldownUntil - Date.now());
}

function collectCategories(results) {
  const categories = new Set();
  for (const result of results) {
    for (const [category, flagged] of Object.entries(result.categories || {})) {
      if (flagged) categories.add(category);
    }
  }
  return [...categories];
}

export async function moderateImages({ imageUrls = [] }) {
  if (!env.openaiApiKey) return { flagged: false, categories: [], failed: false };
  if (imageModerationCoolingDown()) {
    return { flagged: false, categories: [], failed: true, retryable: true };
  }

  const input = [];
  for (const url of imageUrls.filter(Boolean).slice(0, MAX_IMAGES)) {
    input.push({ type: "image_url", image_url: { url } });
  }
  if (!input.length) return { flagged: false, categories: [], failed: false };

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/moderations",
      { model: "omni-moderation-latest", input },
      { headers: { Authorization: `Bearer ${env.openaiApiKey}` }, timeout: TIMEOUT_MS }
    );

    const results = res.data.results || [];
    if (!results.length) return { flagged: false, categories: [], failed: false };

    return {
      flagged: results.some((r) => r.flagged),
      categories: collectCategories(results),
      failed: false,
    };
  } catch (err) {
    const status = err.response?.status;
    const apiError = err.response?.data?.error || {};
    const code = apiError.code || apiError.type || "unknown";
    const detail = apiError.message || err.message;

    const retryable = status === 429 ? code !== "insufficient_quota" : !status || status >= 500;

    if (status === 429 && retryable) {
      const wait = parseRetryDelayMs(err);
      const wasCooling = imageModerationCoolingDown();
      cooldownUntil = Date.now() + wait;
      if (!wasCooling) {
        console.error(
          `Image moderation rate limited; pausing image checks for ${Math.round(wait / 1000)}s. code=${code}: ${detail}`
        );
      }
    } else if (!retryable) {
      console.error(`Image moderation DISABLED - media will auto-clear unchecked. status=${status} code=${code}: ${detail}`);
    } else {
      console.error(`Image moderation check failed (will retry). status=${status} code=${code}: ${detail}`);
    }

    return { flagged: false, categories: [], failed: true, retryable };
  }
}
