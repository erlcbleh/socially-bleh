import crypto from "crypto";
import { env } from "../config/env.js";

const secret = crypto.createHash("sha256").update(`${env.jwtSecret}:ip-hash:v1`).digest();

export const IP_HASH_RE = /^[0-9a-f]{64}$/;

export function hashIp(ip) {
  const value = String(ip || "").trim();
  if (!value) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function isIpHash(value) {
  return IP_HASH_RE.test(String(value || ""));
}

export function ipHandle(hash) {
  return isIpHash(hash) ? `net_${String(hash).slice(0, 12)}` : "unknown";
}
