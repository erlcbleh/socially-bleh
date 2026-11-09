import axios from "axios";
import { env } from "../config/env.js";

const ENDPOINT = "https://proxycheck.io/v2/";
const TIMEOUT_MS = 5000;

const PRIVATE_RE =
  /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd|fe80:)/i;

function normalizeIp(ip) {
  const value = String(ip || "").trim();
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return mapped ? mapped[1] : value;
}

function isPrivate(ip) {
  return !ip || ip === "unknown" || PRIVATE_RE.test(ip);
}

export async function screenIp(ip) {
  const value = normalizeIp(ip);
  if (isPrivate(value)) return { flagged: false, failed: false };

  const params = { vpn: 1, risk: 1 };
  if (env.proxyCheckApiKey) params.key = env.proxyCheckApiKey;

  try {
    const res = await axios.get(`${ENDPOINT}${encodeURIComponent(value)}`, { params, timeout: TIMEOUT_MS });

    const data = res.data || {};
    if (data.status !== "ok" && data.status !== "warning") {
      console.warn(`proxycheck.io lookup returned status "${data.status}" for ${value}: ${data.message || ""}`);
      return { flagged: false, failed: true };
    }

    const record = data[value] || {};
    const flagged = record.proxy === "yes" || record.type === "VPN";
    console.log(`proxycheck.io: ${value} proxy=${record.proxy || "?"} type=${record.type || "?"} -> ${flagged ? "BLOCKED" : "allowed"}`);
    return { flagged, failed: false, type: record.type };
  } catch (err) {
    console.error("proxycheck.io lookup failed", err.response?.status || err.message);
    return { flagged: false, failed: true };
  }
}
