import { env } from "../config/env.js";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const REWRITABLE = [
  "text/",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/rss+xml",
  "application/manifest+json",
  "image/svg+xml",
];

const SOCIALLY_THEME = `
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f%5B%5D=satoshi@300,400,500,700,900&display=swap">
<link rel="icon" type="image/svg+xml" href="https://socially.lol/logo-white.svg">
<meta name="theme-color" content="#1A4DFF">
<style id="socially-status-theme">
:root{
  --font-inter:"Satoshi","Inter",ui-sans-serif,system-ui,sans-serif;
  --font-sans:"Satoshi",ui-sans-serif,system-ui,sans-serif;
  --default-font-family:"Satoshi",ui-sans-serif,system-ui,sans-serif;
  --rgb-color-statuspage-blue:26,77,255;
}
.dark{
  --rgb-color-statuspage-blue:91,123,255;
  --color-statuspage-neutral-900:#000000;
  --color-statuspage-neutral-800:#050505;
  --color-statuspage-neutral-700:#0a0a0a;
  --color-statuspage-neutral-600:#1c1c1c;
}
html,body{font-family:"Satoshi","Inter",ui-sans-serif,system-ui,sans-serif;}
html.dark,html.dark body{background-color:#000000;}
@supports (corner-shape: superellipse(1.618)){
  [class*="rounded-"]:not([class*="rounded-full"]):not([class*="rounded-none"]){corner-shape:superellipse(1.618);}
}
</style>
`;

function injectTheme(html) {
  const marker = html.match(/<\/head>/i);
  if (!marker) return html;
  return html.replace(marker[0], `${SOCIALLY_THEME}${marker[0]}`);
}

const statusHost = env.status.host;
const upstreamOrigin = env.status.upstream ? env.status.upstream.replace(/\/+$/, "") : "";
const upstreamHost = (() => {
  try {
    return upstreamOrigin ? new URL(upstreamOrigin).host.toLowerCase() : "";
  } catch {
    return "";
  }
})();
const forwardHost = env.status.upstreamHost || upstreamHost;

export const statusEnabled = Boolean(statusHost && upstreamOrigin);

export const isStatusHost = (req) => Boolean(statusHost) && req.hostname?.toLowerCase() === statusHost;

const MAX_PROXY_BODY_BYTES = 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_PROXY_BODY_BYTES) {
        const err = new Error("Request body too large");
        err.status = 413;
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function rewriteText(text) {
  if (!upstreamHost || !statusHost || upstreamHost === statusHost) return text;
  return text.split(upstreamHost).join(statusHost);
}

function isRewritable(contentType) {
  if (!contentType) return false;
  const lowered = contentType.toLowerCase();
  return REWRITABLE.some((prefix) => lowered.includes(prefix));
}

export async function statusProxy(req, res) {
  const target = `${upstreamOrigin}${req.originalUrl}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (lower === "host") continue;
    if (lower === "accept-encoding") continue;
    if (value !== undefined) headers[key] = value;
  }
  headers.host = forwardHost;
  headers["accept-encoding"] = "identity";
  headers["x-forwarded-host"] = statusHost;
  headers["x-forwarded-proto"] = "https";

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let body;
  if (hasBody) {
    try {
      body = await readBody(req);
    } catch (err) {
      res.status(err.status === 413 ? 413 : 400).type("text/plain").send("Request body could not be read.");
      return;
    }
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });
  } catch (err) {
    console.error("Status page upstream fetch failed", err);
    res.status(502).type("text/plain").send("Status page is temporarily unavailable.");
    return;
  }

  res.status(upstream.status);

  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "set-cookie") return;
    if (lower === "location") {
      res.set("location", rewriteText(value));
      return;
    }
    res.set(key, value);
  });

  if (setCookies.length) {
    res.set(
      "set-cookie",
      setCookies.map((cookie) => cookie.replace(/;\s*domain=[^;]*/i, ""))
    );
  }

  const contentType = upstream.headers.get("content-type") || "";

  if (isRewritable(contentType)) {
    let text = rewriteText(await upstream.text());
    if (contentType.toLowerCase().includes("text/html")) {
      text = injectTheme(text);
    }
    res.set("content-length", Buffer.byteLength(text));
    res.end(text);
    return;
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.set("content-length", buffer.length);
  res.end(buffer);
}
