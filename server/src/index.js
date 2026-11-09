import path from "path";
import fs from "fs";
import { createServer } from "node:http";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import { connectDb, prisma } from "./db/connect.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter, mutationLimiter } from "./middleware/rateLimit.js";
import { ipBanGuard, refreshBannedIps } from "./middleware/ipBan.js";
import { clientIp, TRUSTED_PROXIES } from "./middleware/clientIp.js";
import { sanitizeRequest } from "./services/sanitizeInput.js";
import { requireAuth, optionalAuth } from "./middleware/requireAuth.js";
import { requireActiveAccount } from "./middleware/requireActiveAccount.js";
import { requireCommunity, guestCommunity, blockBannedMember } from "./middleware/requireCommunity.js";
import { siteGate } from "./middleware/siteGate.js";
import { notifyExpiredPolls } from "./services/pollExpiry.js";
import { scanPendingPosts } from "./services/moderationScan.js";
import { sweepOrphanedUploads } from "./services/mediaCleanup.js";
import { sweepExpiredStories } from "./services/storyExpiry.js";
import { sweepOldAuditLogs } from "./services/auditLogRetention.js";
import { sweepOldSecurityFlags } from "./services/securityFlagCleanup.js";
import { ensureGlobalCommunity } from "./services/globalCommunity.js";
import { attachRealtime } from "./services/realtime.js";
import { refreshRevokedStaffSessions } from "./services/staffSession.js";
import { statusEnabled, isStatusHost, statusProxy } from "./services/statusProxy.js";

import authRoutes from "./routes/auth.js";
import onboardingRoutes from "./routes/onboarding.js";
import userRoutes from "./routes/users.js";
import communityRoutes from "./routes/communities.js";
import communityContentRoutes from "./routes/communityContent.js";
import gifRoutes from "./routes/gifs.js";
import mediaRoutes from "./routes/media.js";
import verificationRoutes from "./routes/verification.js";
import staffAuthRoutes from "./routes/staffAuth.js";
import staffPanelRoutes from "./routes/staffPanel.js";
import staffLayoutRoutes from "./routes/staffLayouts.js";
import staffCommunityRoutes from "./routes/staffCommunities.js";
import copyrightRoutes from "./routes/copyright.js";
import staffApplicationRoutes from "./routes/staffApplications.js";
import businessRoutes from "./routes/business.js";
import emailSupportRoutes from "./routes/emailSupport.js";
import pushRoutes from "./routes/push.js";
import { buildMeta, injectMeta } from "./services/ogTags.js";
import { sitemapIndex, getSitemap, robotsTxt } from "./services/sitemap.js";

const app = express();
const httpServer = createServer(app);
attachRealtime(httpServer);

app.set("trust proxy", env.trustProxy);
app.use(clientIp);

if (env.cookieSecure) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

if (env.status.host) {
  app.use((req, res, next) => {
    if (!isStatusHost(req)) return next();
    if (!statusEnabled) {
      return res
        .status(503)
        .type("text/plain")
        .send("Status page is not configured on this deployment (set STATUS_UPSTREAM).");
    }
    return statusProxy(req, res);
  });
}

const GIPHY_CDN = "https://*.giphy.com";
const DISCORD_CDN = "https://cdn.discordapp.com";
const DISCORD_API = "https://discord.com";
const CLOUDFLARE_INSIGHTS = "https://static.cloudflareinsights.com";
const THEME_SCRIPT_HASH = "'sha256-cGoCqTIhlGWsG5mIkNal4QoRzz8K5bWK/fy/1U3AzYo='";
const R2_CDN = env.r2.publicUrl || "https://cdn.socially.lol";
const R2_STORAGE = "https://*.r2.cloudflarestorage.com";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:", R2_CDN, GIPHY_CDN, DISCORD_CDN],
        "media-src": ["'self'", "data:", "blob:", R2_CDN, GIPHY_CDN],
        "script-src": ["'self'", "'unsafe-inline'", THEME_SCRIPT_HASH, "https://static.cloudflareinsights.com"],
        "connect-src": ["'self'", R2_CDN, R2_STORAGE, DISCORD_API, "https://cloudflareinsights.com"],
        "worker-src": ["'self'"],
        "manifest-src": ["'self'"],
      },
    },
  })
);
const allowedOrigins = Array.isArray(env.allowedOrigins) 
  ? env.allowedOrigins 
  : (env.allowedOrigins || "").split(",").map(o => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      if (
        allowedOrigins.includes(origin) || 
        origin === "https://socially.lol" ||
        origin === "https://www.socially.lol" ||
        origin === "https://scly.lol" || 
        origin === "https://www.scly.lol"
      ) {
        return callback(null, true);
      }
      
      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
const LAYOUT_BODY_PATH = "/api/staff/layouts";
const EMAIL_WEBHOOK_PATH = "/api/staff/email/webhook/resend";
const captureRawBody = (req, _res, buf) => {
  req.rawBody = buf;
};
const globalJson = express.json({ limit: "100kb", verify: captureRawBody });
const webhookJson = express.json({ limit: "25mb", verify: captureRawBody });
const emailSendJson = express.json({ limit: "30mb", verify: captureRawBody });
const isEmailSendPath = (p) =>
  p === "/api/staff/email/compose" ||
  (p.startsWith("/api/staff/email/conversations/") && p.endsWith("/reply"));
app.use((req, res, next) => {
  if (req.path === LAYOUT_BODY_PATH || req.path.startsWith(`${LAYOUT_BODY_PATH}/`)) return next();
  if (req.path === EMAIL_WEBHOOK_PATH) return webhookJson(req, res, next);
  if (isEmailSendPath(req.path)) return emailSendJson(req, res, next);
  return globalJson(req, res, next);
});
app.use(cookieParser());
app.use(siteGate);
app.use("/api", sanitizeRequest);
app.use("/api", ipBanGuard);
app.use("/api", apiLimiter);
app.use("/api", mutationLimiter);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use("/api/copyright", copyrightRoutes);
app.use("/api/staff-applications", staffApplicationRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gifs", gifRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/staff/auth", staffAuthRoutes);
app.use("/api/staff/layouts", staffLayoutRoutes);
app.use("/api/staff/communities", staffCommunityRoutes);
app.use("/api/staff/email", emailSupportRoutes);
app.use("/api/staff", staffPanelRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/push", pushRoutes);

app.use("/api/communities", communityRoutes);

function optionalActiveAccount(req, res, next) {
  return req.user ? requireActiveAccount(req, res, next) : next();
}

function communityForContent(req, res, next) {
  return req.user ? requireCommunity(req, res, next) : guestCommunity(req, res, next);
}

function guestContentGuard(req, res, next) {
  if (req.user) return next();
  if (req.method === "GET") {
    const p = req.path;
    if (p === "/posts" || p === "/posts/") return next();
    if (p !== "/posts/bookmarks" && /^\/posts\/[^/]+$/.test(p)) return next();
    if (/^\/posts\/[^/]+\/comments$/.test(p)) return next();
  }
  return res.status(401).json({ message: "Not authenticated" });
}

app.use(
  "/api/communities/:slug",
  optionalAuth,
  optionalActiveAccount,
  communityForContent,
  blockBannedMember,
  guestContentGuard,
  communityContentRoutes
);

app.get("/api/health", async (req, res) => {
  let db = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "connected";
  } catch {
    db = "disconnected";
  }
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    db,
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const clientDist = path.resolve(projectRoot, "client/dist");
const staffDist = path.resolve(projectRoot, "staff/dist");

const staffHost = (() => {
  try {
    return env.staffUrl ? new URL(env.staffUrl).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
})();

const isStaffHost = (req) => Boolean(staffHost) && req.hostname?.toLowerCase() === staffHost;

app.get("/sitemap.xml", (req, res) => {
  if (isStaffHost(req)) return res.status(404).type("text/plain").send("Not found");
  res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.type("application/xml");
  res.send(sitemapIndex());
});

app.get("/sitemap-:name.xml", async (req, res) => {
  if (isStaffHost(req)) return res.status(404).type("text/plain").send("Not found");
  try {
    const xml = await getSitemap(req.params.name);
    if (xml === null) return res.status(404).type("text/plain").send("Not found");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.type("application/xml");
    res.send(xml);
  } catch (err) {
    console.error("Failed to build sitemap", err);
    res.status(503).type("text/plain").send("Sitemap temporarily unavailable");
  }
});

app.get("/robots.txt", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.type("text/plain");
  res.send(robotsTxt({ staffHost: isStaffHost(req) }));
});

if (staffHost && fs.existsSync(staffDist)) {
  const staffIndexPath = path.join(staffDist, "index.html");
  const staffStatic = express.static(staffDist, { maxAge: "1y", index: false });

  app.use((req, res, next) => (isStaffHost(req) ? staffStatic(req, res, next) : next()));

  app.use((req, res, next) => {
    if (!isStaffHost(req)) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.set("Cache-Control", "no-store");
    res.sendFile(staffIndexPath);
  });
}

if (staffHost) {
  app.use((req, res, next) => {
    if (!isStaffHost(req)) return next();
    if (req.path.startsWith("/api")) return next();
    res.status(503).type("text/plain").send("Staff panel is not built on this deployment.");
  });
}

if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      maxAge: "1y",
      index: false,
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        if (base === "sw.js" || base === "manifest.webmanifest" || base === "workbox-" || base.startsWith("workbox-")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  const indexPath = path.join(clientDist, "index.html");
  let indexHtml = null;

  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();

    try {
      const meta = await buildMeta(req.path);
      if (meta) {
        if (indexHtml === null) indexHtml = await fs.promises.readFile(indexPath, "utf8");
        res.type("html").set("Cache-Control", "public, max-age=0, s-maxage=300");
        return res.send(injectMeta(indexHtml, meta));
      }
    } catch (err) {
      console.error("Failed to build link preview metadata", err);
    }

    res.sendFile(indexPath);
  });
}

app.use(errorHandler);

function schedule(name, task, intervalMs) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await task();
    } catch (err) {
      console.error(`${name} failed`, err);
    } finally {
      running = false;
    }
  }, intervalMs);
}

connectDb()
  .then(ensureGlobalCommunity)
  .then(refreshBannedIps)
  .then(refreshRevokedStaffSessions)
  .then(() => {
    httpServer.listen(env.port, () => {
      console.log(`Server listening on port ${env.port}`);
      console.log(`  client host: ${env.clientUrl || "(unset)"}`);
      console.log(`  staff host:  ${env.staffUrl || "(unset)"}`);
      console.log(`  staff panel: ${env.staffEnabled ? "enabled" : "disabled"}`);
      console.log(`  status host: ${env.status.host || "(unset)"}${statusEnabled ? ` -> ${env.status.upstream}` : env.status.host ? " (STATUS_UPSTREAM unset)" : ""}`);

      if (!env.staffUrl) {
        console.warn(
          "STAFF_URL is unset, so every hostname serves the main client app and the staff panel is unreachable."
        );
      } else if (!env.staffEnabled) {
        console.warn(
          "DISCORD_STAFF_REDIRECT_URI is unset, so the staff panel loads but every sign-in returns 503."
        );
      }
    });
    schedule("refreshRevokedStaffSessions", refreshRevokedStaffSessions, 30_000);
    schedule("notifyExpiredPolls", notifyExpiredPolls, 60_000);
    schedule("scanPendingPosts", scanPendingPosts, 30_000);
    schedule("sweepOrphanedUploads", sweepOrphanedUploads, 600_000);
    schedule("sweepExpiredStories", sweepExpiredStories, 60_000);
    schedule("sweepOldAuditLogs", sweepOldAuditLogs, 6 * 60 * 60 * 1000);
    schedule("sweepOldSecurityFlags", sweepOldSecurityFlags, 6 * 60 * 60 * 1000);
  })
  .catch((err) => {
    console.error("Failed to connect to PostgreSQL", err);
    process.exit(1);
});
