import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(rootDir, ".env") });

const dbArgIdx = process.argv.indexOf("--db");
const dbUrl = dbArgIdx !== -1 ? process.argv[dbArgIdx + 1] : process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!dbUrl) {
  console.error("No database URL. Set DATABASE_URL in .env or pass --db <url>.");
  process.exit(1);
}
if (!jwtSecret) {
  console.error("No JWT_SECRET. It must be present in .env so ban hashes can be matched.");
  process.exit(1);
}

const hmacKey = crypto.createHash("sha256").update(`${jwtSecret}:ip-hash:v1`).digest();
function hashIp(ip) {
  const value = String(ip || "").trim();
  if (!value) return "";
  return crypto.createHmac("sha256", hmacKey).update(value).digest("hex");
}

const pool = new pg.Pool({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const FALLBACK_CF_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

const BOGUS_SINGLES = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "0.0.0.0", "unknown"];

async function fetchCloudflareV4() {
  try {
    const res = await fetch("https://www.cloudflare.com/ips-v4", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const cidrs = (await res.text()).split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (!cidrs.length) throw new Error("empty list");
    return cidrs;
  } catch (err) {
    console.warn(`Could not fetch live Cloudflare list (${err.message}); using built-in ranges.`);
    return FALLBACK_CF_V4;
  }
}

function ipToInt(ip) {
  return ip.split(".").reduce((acc, oct) => (acc * 256 + Number(oct)) >>> 0, 0) >>> 0;
}

function intToIp(int) {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}

function* enumerateCidr(cidr) {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const size = 2 ** (32 - bits);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const start = ipToInt(base) & mask;
  for (let i = 0; i < size; i++) yield intToIp((start + i) >>> 0);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const includeTracking = process.argv.includes("--include-tracking");

  console.log(`Connecting to ${dbUrl.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@")}`);

  const bans = await prisma.bannedIp.findMany({
    select: { id: true, ipHash: true, reason: true, createdAt: true, expiresAt: true },
  });
  const banByHash = new Map(bans.map((b) => [b.ipHash, b]));
  console.log(`Loaded ${bans.length} ban(s).`);

  let trackByHash = null;
  if (includeTracking) {
    const rows = await prisma.userIpAddress.findMany({ select: { id: true, ipHash: true } });
    trackByHash = new Map();
    for (const r of rows) {
      if (!trackByHash.has(r.ipHash)) trackByHash.set(r.ipHash, []);
      trackByHash.get(r.ipHash).push(r.id);
    }
    console.log(`Loaded ${rows.length} tracking row(s).`);
  }

  const cidrs = await fetchCloudflareV4();
  console.log(`Scanning ${cidrs.length} Cloudflare IPv4 range(s) + ${BOGUS_SINGLES.length} bogus singles...`);

  const matchedBans = [];
  const matchedTrackIds = [];
  let scanned = 0;

  const check = (ip) => {
    const h = hashIp(ip);
    const ban = banByHash.get(h);
    if (ban) {
      matchedBans.push({ ip, ban });
      banByHash.delete(h);
    }
    if (trackByHash) {
      const ids = trackByHash.get(h);
      if (ids) {
        matchedTrackIds.push(...ids);
        trackByHash.delete(h);
      }
    }
  };

  for (const single of BOGUS_SINGLES) check(single);
  for (const cidr of cidrs) {
    for (const ip of enumerateCidr(cidr)) {
      check(ip);
      if (++scanned % 250000 === 0) process.stdout.write(`  ...scanned ${scanned} IPs\r`);
    }
  }
  console.log(`\nScanned ${scanned} IPs.`);

  if (!matchedBans.length && !matchedTrackIds.length) {
    console.log("No Cloudflare/bogus-derived rows found. Nothing to clean.");
    return;
  }

  if (matchedBans.length) {
    console.log(`\nFound ${matchedBans.length} ban(s) that resolve to Cloudflare/bogus IPs:`);
    for (const { ip, ban } of matchedBans) {
      console.log(`  - ${ip}  (id=${ban.id}, reason="${ban.reason}", created=${ban.createdAt.toISOString()})`);
    }
  }
  if (trackByHash) console.log(`Found ${matchedTrackIds.length} poisoned tracking row(s).`);

  if (!apply) {
    console.log(`\nDRY RUN. Re-run with --apply to delete these rows.`);
    return;
  }

  if (matchedBans.length) {
    const { count } = await prisma.bannedIp.deleteMany({ where: { id: { in: matchedBans.map((m) => m.ban.id) } } });
    console.log(`Deleted ${count} ban(s).`);
  }
  if (matchedTrackIds.length) {
    const { count } = await prisma.userIpAddress.deleteMany({ where: { id: { in: matchedTrackIds } } });
    console.log(`Deleted ${count} tracking row(s).`);
  }
  console.log("Done. Restart the server (or wait ~30s) so the ban cache refreshes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
