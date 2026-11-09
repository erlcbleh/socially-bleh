import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(rootDir, ".env.local"), override: true });
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set");
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

const cookieSecure = process.env.COOKIE_SECURE !== "false";

const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
const staffUrl = (process.env.STAFF_URL || "").replace(/\/+$/, "");
const statusUrl = (process.env.STATUS_URL || "").replace(/\/+$/, "");
const statusUpstream = (process.env.STATUS_UPSTREAM || "").replace(/\/+$/, "");
const discordRedirectUri = process.env.DISCORD_REDIRECT_URI || "";
const discordStaffRedirectUri = process.env.DISCORD_STAFF_REDIRECT_URI || "";

const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i;

if (cookieSecure) {
  if (!clientUrl.startsWith("https://")) {
    throw new Error(`CLIENT_URL must be an https:// public URL when COOKIE_SECURE is on (got "${clientUrl}")`);
  }
  if (LOCAL_HOST_RE.test(clientUrl)) {
    throw new Error(`CLIENT_URL must be your public domain, not localhost (got "${clientUrl}")`);
  }
  if (discordRedirectUri && LOCAL_HOST_RE.test(discordRedirectUri)) {
    throw new Error(`DISCORD_REDIRECT_URI must be your public domain, not localhost (got "${discordRedirectUri}")`);
  }
  if (staffUrl && !staffUrl.startsWith("https://")) {
    throw new Error(`STAFF_URL must be an https:// public URL when COOKIE_SECURE is on (got "${staffUrl}")`);
  }
  if (staffUrl && LOCAL_HOST_RE.test(staffUrl)) {
    throw new Error(`STAFF_URL must be your public domain, not localhost (got "${staffUrl}")`);
  }
  if (discordStaffRedirectUri && LOCAL_HOST_RE.test(discordStaffRedirectUri)) {
    throw new Error(`DISCORD_STAFF_REDIRECT_URI must be your public domain, not localhost (got "${discordStaffRedirectUri}")`);
  }
}

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

if (staffUrl && hostOf(clientUrl) && hostOf(clientUrl) === hostOf(staffUrl)) {
  throw new Error(
    `STAFF_URL must be a different host from CLIENT_URL, or the staff cookie will not be host-only (both are "${hostOf(clientUrl)}")`
  );
}

if (discordStaffRedirectUri && discordStaffRedirectUri === discordRedirectUri) {
  throw new Error("DISCORD_STAFF_REDIRECT_URI must differ from DISCORD_REDIRECT_URI - register a second redirect URI on the Discord application");
}

if (staffUrl && discordStaffRedirectUri && hostOf(discordStaffRedirectUri) !== hostOf(staffUrl)) {
  throw new Error(
    `DISCORD_STAFF_REDIRECT_URI must be on the STAFF_URL host (got "${hostOf(discordStaffRedirectUri)}", expected "${hostOf(staffUrl)}")`
  );
}

const cookieName = process.env.COOKIE_NAME || "token";
const staffCookieName = process.env.STAFF_COOKIE_NAME || "staff_token";

if (cookieName === staffCookieName) {
  throw new Error(`STAFF_COOKIE_NAME must differ from COOKIE_NAME (both are "${cookieName}")`);
}

const allowedOrigins = [...new Set([clientUrl, staffUrl].filter(Boolean))];
const staffEnabled = Boolean(staffUrl && discordStaffRedirectUri);

const statusHost = hostOf(statusUrl).split(":")[0];
const statusUpstreamHost = (process.env.STATUS_UPSTREAM_HOST || "").trim().toLowerCase();

if (statusUrl && hostOf(statusUrl) === hostOf(clientUrl)) {
  throw new Error(`STATUS_URL must be a different host from CLIENT_URL (both are "${hostOf(clientUrl)}")`);
}
if (statusUrl && staffUrl && hostOf(statusUrl) === hostOf(staffUrl)) {
  throw new Error(`STATUS_URL must be a different host from STAFF_URL (both are "${hostOf(staffUrl)}")`);
}

const rawTrustProxy = (process.env.TRUST_PROXY || "").trim();
const trustProxy = !rawTrustProxy
  ? null
  : Number.isFinite(Number(rawTrustProxy))
    ? Number(rawTrustProxy)
    : rawTrustProxy
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const siteGateFlag = process.env.SITE_GATE_ENABLED === "true";
const siteGateOff = process.env.SITE_GATE_ENABLED === "false";
const isStagingHost = hostOf(clientUrl).includes("staging") || hostOf(staffUrl).includes("staging");
const siteGateEnabled = siteGateOff ? false : siteGateFlag || isStagingHost;
const siteGatePassword = (process.env.SITE_GATE_PASSWORD || "").trim();

if (siteGateEnabled && siteGatePassword.length < 8) {
  throw new Error(
    "Site gate is enabled (staging host or SITE_GATE_ENABLED=true) but SITE_GATE_PASSWORD is missing or shorter than 8 characters"
  );
}

const databaseUrl = (process.env.DATABASE_URL || "").trim().replace(/^["']|["']$/g, "");

if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  const seen = databaseUrl ? `starts with "${databaseUrl.slice(0, 12)}"` : "it is empty";
  throw new Error(`DATABASE_URL must start with postgresql:// or postgres:// (${seen})`);
}

const mongodbUri = (process.env.MONGODB_URI || "").trim().replace(/^["']|["']$/g, "");

const cloudinaryCloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const cloudinaryApiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();

if (cloudinaryCloudName && !/^[a-z0-9][a-z0-9_-]*$/.test(cloudinaryCloudName)) {
  throw new Error(
    `CLOUDINARY_CLOUD_NAME must be the lowercase cloud name from your delivery URLs, not the display name (got "${cloudinaryCloudName}")`
  );
}
if (cloudinaryApiSecret && cloudinaryApiSecret === (process.env.DISCORD_CLIENT_SECRET || "").trim()) {
  throw new Error("CLOUDINARY_API_SECRET is identical to DISCORD_CLIENT_SECRET - one of them was pasted into the wrong field");
}

export const env = {
  port: process.env.PORT || 4000,
  clientUrl,
  staffUrl,
  staffEnabled,
  status: {
    host: statusHost,
    upstream: statusUpstream,
    upstreamHost: statusUpstreamHost,
  },
  allowedOrigins,
  trustProxy,
  siteGate: {
    enabled: siteGateEnabled,
    password: siteGatePassword,
  },
  databaseUrl,
  directUrl: (process.env.DIRECT_URL || databaseUrl).trim(),
  redisUrl: (process.env.REDIS_URL || "").trim(),
  mongodbUri,
  jwtSecret: process.env.JWT_SECRET,
  cookieName,
  staffCookieName,
  cookieSecure,
  applicationWebhookUrl: process.env.APPLICATION_WEBHOOK_URL || "",
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    botToken: (process.env.DISCORD_BOT_TOKEN || "").trim(),
    redirectUri: discordRedirectUri,
    staffRedirectUri: discordStaffRedirectUri,
  },
  giphyApiKey: process.env.GIPHY_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  webPush: {
    publicKey: (process.env.VAPID_PUBLIC_KEY || "").trim(),
    privateKey: (process.env.VAPID_PRIVATE_KEY || "").trim(),
    subject: (process.env.VAPID_SUBJECT || "mailto:support@socially.lol").trim(),
  },
  email: {
    resendApiKey: (process.env.RESEND_API_KEY || "").trim(),
    webhookSecret: (process.env.RESEND_WEBHOOK_SECRET || "").trim(),
    inboundToken: (process.env.EMAIL_INBOUND_TOKEN || "").trim(),
    supportAddress: (process.env.SUPPORT_EMAIL_FROM || "support@socially.lol").trim().toLowerCase(),
    legalAddress: (process.env.LEGAL_EMAIL_FROM || "legal@socially.lol").trim().toLowerCase(),
  },
  proxyCheckApiKey: (process.env.PROXYCHECK_API_KEY || "").trim(),
  cloudinary: {
    cloudName: cloudinaryCloudName,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: cloudinaryApiSecret,
  },
  r2: {
    accountId: (process.env.CF_ACCOUNT_ID || "").trim(),
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || "").trim(),
    bucketName: (process.env.R2_BUCKET_NAME || "socially-media").trim(),
    publicUrl: (() => {
      let raw = (process.env.R2_PUBLIC_URL || "https://cdn.socially.lol").trim().replace(/\/+$/, "");
      if (raw && !/^https?:\/\//i.test(raw)) {
        raw = `https://${raw}`;
      }
      return raw;
    })(),
  },
};
