import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

const rasterizeSameName = [
  { file: "favicon.svg", size: 256 },
  { file: "logo-black.svg", size: 512 },
  { file: "logo-blue.svg", size: 512 },
  { file: "logo-white.svg", size: 512 },
  { file: "og-image.svg", size: 1024 },
  { file: "wordmark-black.svg", size: 1024 },
  { file: "wordmark-white.svg", size: 1024 },
];

const pwaIcons = [
  { out: "pwa-192.png", size: 192, source: "logo-blue.svg", fit: "contain" },
  { out: "pwa-512.png", size: 512, source: "logo-blue.svg", fit: "contain" },
  { out: "pwa-maskable-512.png", size: 512, source: "logo-white.svg", fit: "contain", pad: 0.18, bg: "#1A4DFF" },
  { out: "apple-touch-icon.png", size: 180, source: "logo-white.svg", fit: "contain", pad: 0.12, bg: "#1A4DFF" },
];

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function bgColor(hex) {
  if (!hex) return transparent;
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}

async function renderSvg(file, size, pad, bg) {
  const svg = await readFile(path.join(publicDir, file));
  const inner = pad ? Math.round(size * (1 - pad * 2)) : size;
  const glyph = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: transparent })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: bgColor(bg) },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png();
}

async function main() {
  for (const { file, size } of rasterizeSameName) {
    const out = file.replace(/\.svg$/, ".png");
    const img = await renderSvg(file, size);
    await img.toFile(path.join(publicDir, out));
    console.log(`icon ${out} ${size}x${size}`);
  }
  for (const { out, size, source, pad, bg } of pwaIcons) {
    const img = await renderSvg(source, size, pad, bg);
    await img.toFile(path.join(publicDir, out));
    console.log(`icon ${out} ${size}x${size}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
