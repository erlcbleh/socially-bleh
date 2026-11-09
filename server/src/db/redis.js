import Redis from "ioredis";
import { env } from "../config/env.js";

let redisClient = null;
let isConnected = false;

if (env.redisUrl) {
  try {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      isConnected = true;
      console.log("Redis connected");
    });

    redisClient.on("error", (err) => {
      isConnected = false;
      console.warn("Redis err:", err?.message || err);
    });

    redisClient.connect().catch(() => {});
  } catch (err) {
    console.warn("Redis err:", err?.message || err);
  }
}

export const redis = redisClient;
export const isRedisConnected = () => isConnected;

export async function cacheGet(key) {
  if (!redisClient || !isConnected) return null;
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  if (!redisClient || !isConnected) return;
  try {
    const raw = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redisClient.set(key, raw, "EX", ttlSeconds);
    } else {
      await redisClient.set(key, raw);
    }
  } catch {}
}

export async function cacheDel(keyOrPattern) {
  if (!redisClient || !isConnected) return;
  try {
    if (keyOrPattern.includes("*")) {
      const keys = await redisClient.keys(keyOrPattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      await redisClient.del(keyOrPattern);
    }
  } catch {}
}