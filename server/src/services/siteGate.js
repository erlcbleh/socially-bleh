import crypto from "crypto";
import { env } from "../config/env.js";
import { cookieValue } from "./cookies.js";

export const GATE_COOKIE_NAME = "site_gate";
const GATE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function gateToken() {
  return crypto
    .createHmac("sha256", `${env.jwtSecret}:${env.siteGate.password}`)
    .update("site-gate-v1")
    .digest("hex");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyGateCookie(value) {
  if (!value) return false;
  return timingSafeEqual(value, gateToken());
}

export function checkGatePassword(input) {
  if (!env.siteGate.password) return false;
  return timingSafeEqual(input, env.siteGate.password);
}

export function isGateUnlocked(req) {
  const value = req.cookies?.[GATE_COOKIE_NAME] ?? cookieValue(req.headers?.cookie, GATE_COOKIE_NAME);
  return verifyGateCookie(value);
}

export function setGateCookie(res) {
  res.cookie(GATE_COOKIE_NAME, gateToken(), {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE_MS,
  });
}
