/**
 * generate-og.mjs — programmatically generate OpenGraph share images.
 *
 * Output: public/og/<tool-id>.png (1200×630) for the 8 PDF tools plus a
 * default brand image (pdf-tools.png). Rendered from inline SVG via sharp
 * (devDependency). Run: pnpm og  →  node scripts/generate-og.mjs
 *
 * Brand gradient mirrors the site palette (#2563EB → #4F46E5 → #7C3AED).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'og');

const tools = [
  { id: 'merge', name: 'Merge PDF' },
  { id: 'split', name: 'Split PDF' },
  { id: 'rotate', name: 'Rotate PDF' },
  { id: 'pdf-to-jpg', name: 'PDF to JPG' },
  { id: 'compress', name: 'Compress PDF' },
  { id: 'protect', name: 'Protect PDF' },
  { id: 'unlock', name: 'Unlock PDF' },
  { id: 'watermark', name: 'Add Watermark' },
  { id: 'pdf-tools', name: 'PDF Tools' },
];

function svgFor(name) {
  const title = name.replace(/&/g, '&amp;');
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563EB"/>
      <stop offset="0.5" stop-color="#4F46E5"/>
      <stop offset="1" stop-color="#7C3AED"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,0.16)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="260" fill="url(#shine)"/>
  <circle cx="1030" cy="110" r="230" fill="rgba(255,255,255,0.08)"/>
  <circle cx="120" cy="560" r="180" fill="rgba(255,255,255,0.07)"/>
  <rect x="76" y="76" width="72" height="72" rx="18" fill="rgba(255,255,255,0.96)"/>
  <text x="112" y="126" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#2563EB" text-anchor="middle">✦</text>
  <text x="600" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="#FFFFFF" text-anchor="middle">${title}</text>
  <text x="600" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.88)" text-anchor="middle">Free · Private · In your browser</text>
</svg>`;
}

mkdirSync(outDir, { recursive: true });
for (const tool of tools) {
  const png = await sharp(Buffer.from(svgFor(tool.name))).png().toBuffer();
  const file = join(outDir, `${tool.id}.png`);
  writeFileSync(file, png);
  console.log(`og: ${tool.id}.png (${(png.byteLength / 1024).toFixed(1)} kB)`);
}
console.log('Done — OG images written to public/og/');
