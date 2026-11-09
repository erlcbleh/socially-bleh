export const CLOUDFLARE_IPS = [
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
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

export const TRUSTED_PROXIES = ["loopback", "linklocal", "uniquelocal", ...CLOUDFLARE_IPS];

function ipv4ToBytes(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

function ipv6ToBytes(value) {
  let addr = value.toLowerCase();
  if (addr.startsWith("[") && addr.endsWith("]")) addr = addr.slice(1, -1);
  const zone = addr.indexOf("%");
  if (zone !== -1) addr = addr.slice(0, zone);
  if (!addr.includes(":")) return null;

  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = ipv4ToBytes(tail);
    if (!v4) return null;
    const high = ((v4[0] << 8) | v4[1]).toString(16);
    const low = ((v4[2] << 8) | v4[3]).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;

  const groups = [...left, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...right];
  const bytes = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const n = parseInt(group, 16);
    bytes.push((n >> 8) & 0xff, n & 0xff);
  }
  return bytes;
}

export function parseIp(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes(":")) return ipv4ToBytes(trimmed);

  const bytes = ipv6ToBytes(trimmed);
  if (!bytes) return null;
  const isV4Mapped =
    bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  return isV4Mapped ? bytes.slice(12) : bytes;
}

const CLOUDFLARE_SUBNETS = CLOUDFLARE_IPS.map((cidr) => {
  const [subnet, bits] = cidr.split("/");
  return { bytes: parseIp(subnet), bits: Number(bits) };
}).filter((entry) => entry.bytes && Number.isFinite(entry.bits));

function matchesSubnet(bytes, subnet) {
  if (bytes.length !== subnet.bytes.length) return false;
  let remaining = subnet.bits;
  for (let i = 0; i < subnet.bytes.length && remaining > 0; i += 1) {
    const take = Math.min(8, remaining);
    const mask = (0xff << (8 - take)) & 0xff;
    if ((bytes[i] & mask) !== (subnet.bytes[i] & mask)) return false;
    remaining -= take;
  }
  return true;
}

export function isCloudflareIp(value) {
  const bytes = parseIp(value);
  if (!bytes) return false;
  return CLOUDFLARE_SUBNETS.some((subnet) => matchesSubnet(bytes, subnet));
}

export function clientIp(req, _res, next) {
  const remoteAddr = req.socket.remoteAddress;
  if (!remoteAddr || !isCloudflareIp(remoteAddr)) {
    return next();
  }

  const header = req.headers["cf-connecting-ip"] || req.headers["true-client-ip"];
  const raw = Array.isArray(header) ? header[0] : header;
  const ip = typeof raw === "string" ? raw.split(",")[0].trim() : "";
  if (ip && parseIp(ip)) {
    Object.defineProperty(req, "ip", { value: ip, configurable: true, enumerable: true });
  }
  next();
}
