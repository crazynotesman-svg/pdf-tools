/**
 * generate-icons.mjs — PWA-ready site icons (favicon / apple-touch / app icons).
 *
 * Outputs to public/: favicon.svg, favicon-16.png, favicon-32.png,
 * apple-touch-icon.png (180), icon-192.png, icon-512.png.
 * Run: pnpm icons  →  node scripts/generate-icons.mjs
 *
 * Design: rounded-square brand gradient (#2563EB → #7C3AED) with a white ✦.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="32" y="44" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#FFFFFF" text-anchor="middle">✦</text>
</svg>`;

function iconSvg(size) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.55);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text x="${size / 2}" y="${size * 0.68}" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#FFFFFF" text-anchor="middle">✦</text>
</svg>`;
}

async function writePng(name, svg, size) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(join(outDir, name), png);
  console.log(`${name} (${png.byteLength / 1024 | 0} kB)`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'favicon.svg'), FAVICON_SVG);
console.log('favicon.svg');
await writePng('favicon-16.png', iconSvg(64), 16);
await writePng('favicon-32.png', iconSvg(64), 32);
await writePng('apple-touch-icon.png', iconSvg(512), 180);
await writePng('icon-192.png', iconSvg(512), 192);
await writePng('icon-512.png', iconSvg(512), 512);
console.log('Done — icons written to public/');
