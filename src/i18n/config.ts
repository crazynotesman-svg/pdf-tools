/**
 * SINGLE SOURCE OF TRUTH for locale facts.
 *
 * This file owns the locale facts (routing list, default locale, <html lang>,
 * UI names, the `Locale` type). `astro.config.mjs` imports `locales` +
 * `defaultLocale` from here so Astro's i18n routing and the UI layer can never
 * drift. Do NOT redeclare locales/defaultLocale in astro.config.mjs — the
 * `pnpm check:i18n` guard fails the build if you do.
 *
 * To add a locale (e.g. fr): add it here, add a dict in src/i18n/*.json, add a
 * tool slug + blog file, and the sitemap / RSS / hreflang pick it up
 * automatically.
 */

export const locales = ['de', 'en', 'zh-TW', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'de';

/** Maps a routing locale to the <html lang> attribute. */
export const htmlLang: Record<Locale, string> = {
  de: 'de',
  en: 'en',
  'zh-TW': 'zh-TW',
  es: 'es',
};

/** Human-readable names for the language switcher UI. */
export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  'zh-TW': '繁體中文',
  es: 'Español',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
