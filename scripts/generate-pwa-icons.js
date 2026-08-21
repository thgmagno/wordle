/**
 * One-off generator for the PWA icon set. Not part of the app's runtime —
 * run manually (`node scripts/generate-pwa-icons.js`) whenever the icon
 * design changes; the rasterized PNGs it writes to public/icons are what
 * actually ships, not this script.
 *
 * Renders a single source SVG (the classic Wordle-style letter-tile
 * motif — a 2x2 grid of rounded tiles in the game's own correct/
 * present/absent colors, on the app's brand blue) at every size the
 * manifest and Apple's home-screen convention need.
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const BRAND_BLUE = "#2563eb";
const CORRECT_GREEN = "#16a34a";
const PRESENT_YELLOW = "#ca8a04";
const ABSENT_SLATE = "#475569";

// Plain (non-maskable) icon: tiles fill most of the canvas, small margin.
function baseIconSvg({ size, tileInset, cornerRadius, background = BRAND_BLUE }) {
  const tile = (size - tileInset * 3) / 2;
  const r = size * cornerRadius;
  const tr = tile * 0.16;
  const positions = [
    { x: tileInset, y: tileInset, fill: CORRECT_GREEN },
    { x: tileInset * 2 + tile, y: tileInset, fill: PRESENT_YELLOW },
    { x: tileInset, y: tileInset * 2 + tile, fill: ABSENT_SLATE },
    { x: tileInset * 2 + tile, y: tileInset * 2 + tile, fill: "#ffffff", outline: true },
  ];

  const tiles = positions
    .map(
      (p) =>
        `<rect x="${p.x}" y="${p.y}" width="${tile}" height="${tile}" rx="${tr}" fill="${p.fill}" ${
          p.outline ? `fill-opacity="0.18" stroke="#ffffff" stroke-width="${tile * 0.06}"` : ""
        }/>`,
    )
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="${background}"/>
    ${tiles}
  </svg>`;
}

const targets = [
  // Standard manifest icons — Chrome/Android apply their own masking
  // chrome, so these can use the full canvas.
  { name: "icon-192.png", size: 192, tileInset: 14, cornerRadius: 0.22 },
  { name: "icon-512.png", size: 512, tileInset: 36, cornerRadius: 0.22 },
  // Maskable: the OS can crop anywhere outside the inner "safe zone"
  // (a centered circle at ~80% of the canvas per the maskable-icon spec),
  // so the background fills the entire canvas edge-to-edge (no rounded
  // corners of its own — the OS supplies the shape) and the tiles sit
  // further inset to stay clear of the crop.
  { name: "icon-maskable-512.png", size: 512, tileInset: 96, cornerRadius: 0, background: BRAND_BLUE },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const t of targets) {
    const svg = baseIconSvg(t);
    const outPath = path.join(OUT_DIR, t.name);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    console.log("wrote", path.relative(process.cwd(), outPath));
  }

  // Also refresh the browser-tab favicon so it matches (replaces the
  // leftover default Next.js starter icon).
  const faviconSvg = baseIconSvg({ size: 64, tileInset: 5, cornerRadius: 0.22 });
  const faviconPng32 = await sharp(Buffer.from(faviconSvg)).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(__dirname, "..", "src", "app", "icon.png"), faviconPng32);
  console.log("wrote src/app/icon.png");

  // Apple touch icon: iOS applies its own rounding and a subtle gloss,
  // and does NOT support transparency — same safe full-bleed background,
  // and written straight to src/app/apple-icon.png so Next.js's file
  // convention auto-detects and links it (no manual <link> needed, same
  // as icon.png above).
  const appleSvg = baseIconSvg({ size: 180, tileInset: 16, cornerRadius: 0 });
  const applePng = await sharp(Buffer.from(appleSvg)).png().toBuffer();
  fs.writeFileSync(path.join(__dirname, "..", "src", "app", "apple-icon.png"), applePng);
  console.log("wrote src/app/apple-icon.png");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
