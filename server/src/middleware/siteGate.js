import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis, isRedisConnected } from "../db/redis.js";
import { env } from "../config/env.js";
import { checkGatePassword, setGateCookie, isGateUnlocked } from "../services/siteGate.js";

const GATE_UNLOCK_PATH = "/api/gate";

const gateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redis && isRedisConnected()
    ? new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: "rl:gate:" })
    : undefined,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: (req, res) => res.status(429).json({ message: "Too many attempts, please try again later." }),
});

function gatePage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Restricted</title>
</head>
<body>
<form id="f">
<input id="pw" type="password" autocomplete="off" autofocus />
<button id="b" type="submit">Enter</button>
<p id="e"></p>
</form>
<script>
  var f = document.getElementById('f'), pw = document.getElementById('pw'),
      e = document.getElementById('e'), b = document.getElementById('b');
  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    e.textContent = ''; b.disabled = true;
    fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw.value })
    }).then(function (r) {
      if (r.ok) { window.location.reload(); return; }
      return r.json().catch(function () { return {}; }).then(function (d) {
        e.textContent = (r.status === 429)
          ? (d.message || 'Too many attempts, try again later.')
          : 'Incorrect access key.';
        b.disabled = false; pw.select();
      });
    }).catch(function () {
      e.textContent = 'Network error, try again.'; b.disabled = false;
    });
  });
</script>
</body>
</html>`;
}

export function siteGate(req, res, next) {
  if (!env.siteGate.enabled) return next();

  if (req.path === GATE_UNLOCK_PATH) {
    if (req.method === "GET") {
      return res.set("Cache-Control", "no-store").json({ gated: true, unlocked: isGateUnlocked(req) });
    }
    if (req.method === "POST") {
      return gateLimiter(req, res, () => {
        if (!checkGatePassword(req.body?.password)) {
          return res.status(401).json({ message: "Incorrect access key" });
        }
        setGateCookie(res);
        return res.json({ ok: true });
      });
    }
  }

  if (req.path === "/api/health") return next();

  if (isGateUnlocked(req)) return next();

  res.set("Cache-Control", "no-store");

  if (req.path.startsWith("/api")) {
    return res.status(401).json({ message: "Staging locked", gate: true });
  }

  res.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'"
  );
  return res.status(401).type("html").send(gatePage());
}
