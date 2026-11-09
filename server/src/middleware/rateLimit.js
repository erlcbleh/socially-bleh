import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../db/redis.js";
import { logSecurityFlag } from "../services/securityFlags.js";

function getStore(prefix) {
  if (redis) {
    return new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: `rl:${prefix}:`,
    });
  }
  return undefined;
}

function onLimitReached(message) {
  return async (req, res) => {
    if (req.rateLimit?.used === req.rateLimit?.limit + 1) {
      await logSecurityFlag(req, "rate_limit", { windowMs: req.rateLimit.windowMs, limit: req.rateLimit.limit });
    }
    res.status(429).json({ message: message || "Too many requests, please try again later." });
  };
}

const isStaffPanelPath = (req) => req.path === "/staff" || req.path.startsWith("/staff/");
const isTypingPath = (req) => req.path.endsWith("/typing");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("api"),
  skip: isStaffPanelPath,
  handler: onLimitReached(),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("auth"),
  handler: onLimitReached("Too many attempts, please try again later."),
});

export const staffAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("staffAuth"),
  handler: onLimitReached("Too many attempts, please try again later."),
});

const byStaff = (req) =>
  req.staffUser ? `s:${req.staffUser.id}` : req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip);

export const staffApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6000,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("staffApi"),
  keyGenerator: byStaff,
  handler: onLimitReached(),
});

export const staffWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("staffWrite"),
  keyGenerator: byStaff,
  skip: (req) => SAFE_METHODS.has(req.method),
  handler: onLimitReached("You're acting too fast, slow down a moment."),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("upload"),
  keyGenerator: (req) => `u:${req.user.id}`,
  handler: onLimitReached("You've uploaded too much recently, please try again later."),
});

const byUser = (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip));

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("write"),
  keyGenerator: byUser,
  handler: onLimitReached("You're doing that too fast, slow down a moment."),
});

export const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("post"),
  keyGenerator: byUser,
  skip: (req) => !!req.body?.parentPost,
  handler: onLimitReached("You're posting too fast, slow down a moment."),
});

export const replyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("reply"),
  keyGenerator: byUser,
  skip: (req) => !req.body?.parentPost,
  handler: onLimitReached("You're replying too fast, slow down a moment."),
});

export const hourlyPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("hourlyPost"),
  keyGenerator: byUser,
  handler: onLimitReached("You've posted too much in the last hour, try again later."),
});

export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("mutation"),
  keyGenerator: ipKeyGenerator,
  skip: (req) => SAFE_METHODS.has(req.method) || isStaffPanelPath(req) || isTypingPath(req),
  handler: onLimitReached("You're doing that too fast, slow down a moment."),
});

export const typingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("typing"),
  keyGenerator: byUser,
  handler: onLimitReached("Too many requests, please try again later."),
});

export const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("analytics"),
  keyGenerator: byUser,
  handler: onLimitReached("Too many requests, please try again later."),
});

export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("publicRead"),
  handler: onLimitReached("Too many requests, please try again later."),
});

export const strictWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("strictWrite"),
  keyGenerator: byUser,
  handler: onLimitReached("You've done that too many times recently, try again later."),
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("search"),
  keyGenerator: byUser,
  handler: onLimitReached("Too many searches, slow down a moment."),
});

export const inviteLookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("inviteLookup"),
  handler: onLimitReached("Too many invite lookups, try again later."),
});

export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("publicForm"),
  handler: onLimitReached("Too many requests, please try again later."),
});

export const emailWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("emailWebhook"),
  handler: onLimitReached("Too many requests, please try again later."),
});
