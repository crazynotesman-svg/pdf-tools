/**
 * Path / locale utilities for the language switcher and hreflang (Meta).
 *
 * These are intentionally pure and free of JSON imports so they stay cheap to
 * unit-test and reuse across server (Astro) and client (React) code.
 */

import { locales, localeNames, isLocale, type Locale } from './config';

/** Human-readable locale name (e.g. for the language switcher label). */
export function getLocaleName(locale: Locale): string {
  return localeNames[locale];
}

/**
 * Map a routing locale to its BCP-47 language tag, used for localized date
 * formatting (toLocaleDateString) and the JSON-LD `inLanguage` field.
 *   de -> de-DE, en -> en-US, zh-TW -> zh-TW, es -> es-ES
 */
export function getBCP47(locale: Locale): string {
  switch (locale) {
    case 'de':
      return 'de-DE';
    case 'en':
      return 'en-US';
    case 'zh-TW':
      return 'zh-TW';
    case 'es':
      return 'es-ES';
  }
}

/**
 * Rewrite the leading locale segment of `path` to `locale`.
 *
 * Examples:
 *   getLocalizedPath('en', '/de/pdf-zusammenfuegen') -> '/en/pdf-zusammenfuegen'
 *   getLocalizedPath('de', '/blog')                 -> '/de/blog'
 *   getLocalizedPath('zh-TW', '/')                  -> '/zh-TW'
 *
 * NOTE: tool pages use different slugs per language (e.g. /de/pdf-zusammenfuegen
 * vs /en/pdf-merge). For those, the *caller* must pass the already-localized
 * tail — the slug translation is resolved via the tools collection in T3.
 * This function only rewrites the locale prefix.
 */
export function getLocalizedPath(locale: Locale, path: string): string {
  const tail = stripLocalePrefix(path);
  return `/${locale}${tail === '/' ? '' : tail}`;
}

function stripLocalePrefix(path: string): string {
  const segments = path.split('/');
  // segments[0] is '' because paths start with '/'
  if (segments[1] && isLocale(segments[1])) {
    segments.splice(1, 1);
  }
  const rest = segments.join('/');
  return rest === '' ? '/' : rest;
}

/**
 * Build the hreflang alternate-URL map (paths only, no origin) for a path.
 * The Meta component (T4) will prepend `Astro.site` and add `x-default`.
 */
export function getAlternateUrls(path: string): Record<Locale, string> {
  const map = {} as Record<Locale, string>;
  for (const locale of locales) {
    map[locale] = getLocalizedPath(locale, path);
  }
  return map;
}

export { locales };
