/**
 * check-i18n.mjs — guard the i18n SINGLE SOURCE OF TRUTH.
 *
 * T8 unified the two previously-duplicated locale lists: the routing locales
 * now live ONLY in `src/i18n/config.ts` and `astro.config.mjs` imports them.
 * This script fails the build (exit 1) if that invariant is broken, i.e. if
 * `astro.config.mjs`:
 *   (a) does NOT import `locales`/`defaultLocale` from ./src/i18n/config, OR
 *   (b) re-hardcodes a literal `locales: [...]` / `defaultLocale: '...'` in its
 *       i18n block (which would silently re-introduce drift).
 *
 * Run: `node scripts/check-i18n.mjs` (wired as `pnpm check:i18n`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

const astroSrc = read('astro.config.mjs');
const configSrc = read('src/i18n/config.ts');

let ok = true;

// (1) canonical locale list + default read from the single source.
const localesMatch = configSrc.match(/export const locales = \[(.*?)\] as const/);
if (!localesMatch) {
  console.error('[check-i18n] Could not parse `locales` from src/i18n/config.ts');
  process.exit(2);
}
const canonicalLocales = localesMatch[1]
  .split(',')
  .map((s) => s.trim().replace(/['"]/g, ''))
  .filter(Boolean);

const defaultMatch = configSrc.match(/export const defaultLocale[^=]*=\s*['"]([^'"]+)['"]/);
if (!defaultMatch) {
  console.error('[check-i18n] Could not parse `defaultLocale` from src/i18n/config.ts');
  process.exit(2);
}
const canonicalDefault = defaultMatch[1];

// (2) astro.config.mjs MUST import the locale facts from the single source.
const importsConfig = /from\s+['"]\.?\/src\/i18n\/config(?:\.ts)?['"]/.test(astroSrc);
if (!importsConfig) {
  ok = false;
  console.error(
    '[check-i18n] astro.config.mjs must import `locales`/`defaultLocale` from ./src/i18n/config.ts (single source of truth).',
  );
}

// (3) astro.config.mjs must NOT re-hardcode a literal locales array in i18n.
// A spread like `locales: [...i18nLocales]` is fine (it IS the imported value);
// only a quoted literal `locales: ['de', 'en', ...]` is drift risk. So require a
// quote right after the opening bracket.
if (/i18n:\s*\{[^}]*locales:\s*\[\s*['"]/.test(astroSrc)) {
  ok = false;
  console.error(
    '[check-i18n] astro.config.mjs hardcodes `locales: [...]` — it must use the imported value from src/i18n/config.ts.',
  );
}

// (4) astro.config.mjs must NOT re-hardcode a literal defaultLocale in i18n.
if (/i18n:\s*\{[^}]*defaultLocale:\s*['"][^'"]+['"]/.test(astroSrc)) {
  ok = false;
  console.error(
    '[check-i18n] astro.config.mjs hardcodes `defaultLocale` — it must use the imported value.',
  );
}

if (!ok) {
  console.error(
    '\n[check-i18n] i18n single-source invariant broken. Edit src/i18n/config.ts, not astro.config.mjs.',
  );
  process.exit(1);
}

console.log(
  `[check-i18n] OK — single source: locales ${JSON.stringify(canonicalLocales)} / default '${canonicalDefault}' (astro.config.mjs imports from src/i18n/config.ts).`,
);
