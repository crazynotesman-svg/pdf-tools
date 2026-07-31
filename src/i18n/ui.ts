/**
 * Type-safe translation system.
 *
 * - `t(locale, key)` only accepts keys that actually exist in the dictionaries
 *   (e.g. `t('de', 'common.upload')`). Invalid keys are a compile-time error.
 * - Every locale dictionary is type-checked against the German (`de`) shape, so
 *   a missing translation in `en`/`zh-CN` fails the build.
 */

import de from './de.json';
import en from './en.json';
import zhCN from './zh-CN.json';
import type { Locale } from './config';

/** Source-of-truth dictionary shape (German defines the canonical structure). */
type Dict = typeof de;

/**
 * Recursively flattens a nested dictionary into dotted key paths:
 *   { common: { upload: string } } -> "common.upload"
 * Only string leaves become keys; objects recurse, everything else is excluded.
 */
type Flatten<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends object
      ? Flatten<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = Flatten<Dict>;

const dictionaries: Record<Locale, Dict> = {
  de,
  en,
  'zh-CN': zhCN,
};

function lookup(dict: Dict, key: string): string | undefined {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc !== null && typeof acc === 'object' && part in (acc as object)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict) as string | undefined;
}

/** Type-safe translation lookup. Invalid keys are a compile-time error. */
export function t(locale: Locale, key: TranslationKey): string {
  const direct = lookup(dictionaries[locale], key);
  if (direct !== undefined) return direct;
  // Graceful degradation: fall back to the default locale, then to the key.
  const fallback = lookup(dictionaries.de, key);
  return fallback ?? key;
}

/** Bind a translator to a locale for ergonomic repeated lookups in components. */
export function createTranslator(locale: Locale) {
  return (key: TranslationKey): string => t(locale, key);
}

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}
