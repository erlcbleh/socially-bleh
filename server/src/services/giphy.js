import axios from "axios";
import { env } from "../config/env.js";

const TRENDING_CACHE_MS = 60_000;

let trendingCache = null;

function mapResults(data) {
  return data.map((g) => ({
    id: g.id,
    url: g.images?.original?.url,
    previewUrl: g.images?.fixed_width_small?.url || g.images?.original?.url,
    description: g.title,
  }));
}

export async function searchGiphy(query, limit = 24) {
  const res = await axios.get("https://api.giphy.com/v1/gifs/search", {
    timeout: 10_000,
    params: {
      q: query,
      api_key: env.giphyApiKey,
      limit,
      rating: "pg-13",
    },
  });

  return mapResults(res.data.data);
}

export function fetchGiphyTrending(limit = 24) {
  if (
    trendingCache &&
    trendingCache.limit === limit &&
    trendingCache.expiresAt > Date.now()
  ) {
    return trendingCache.value;
  }

  let entry;
  const value = axios
    .get("https://api.giphy.com/v1/gifs/trending", {
      timeout: 10_000,
      params: {
        api_key: env.giphyApiKey,
        limit,
        rating: "pg-13",
      },
    })
    .then((res) => mapResults(res.data.data))
    .catch((error) => {
      if (trendingCache === entry) trendingCache = null;
      throw error;
    });
  entry = { limit, expiresAt: Date.now() + TRENDING_CACHE_MS, value };
  trendingCache = entry;
  return value;
}

const GIPHY_URL_RE = /^https:\/\/(?:media\d*|i|gips)\.giphy\.com\//i;

export function isGiphyUrl(url) {
  return typeof url === "string" && GIPHY_URL_RE.test(url);
}
