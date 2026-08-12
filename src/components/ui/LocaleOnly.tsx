import type { ComponentType, ReactNode } from 'react';
import type { Locale } from '@/i18n/config';

interface LocaleOnlyProps {
  /** The language of THIS block, written as an attribute in the MDX body. */
  locale: Locale;
  /** The active page locale, injected by SeoContent via makeLocaleOnly(). */
  activeLocale: Locale;
  children?: ReactNode;
}

/**
 * Renders its children only when `locale` matches `activeLocale`.
 *
 * Tool MDX bodies keep all languages in one file, each language wrapped
 * in <LocaleOnly locale="de|en|zh-TW|es">. At build time we inject the active
 * locale, so only the matching block is emitted — no hidden duplicate text,
 * which protects SEO (Google won't see N× duplicated copy).
 */
export default function LocaleOnly({ locale, activeLocale, children }: LocaleOnlyProps) {
  if (locale !== activeLocale) return null;
  return <>{children}</>;
}

/**
 * Bind the active locale and return a component suitable for the MDX
 * `components` map. This is the clean, SSG-safe way to inject the current
 * language into the <LocaleOnly> tags authored in MDX (no module globals, no
 * wrapper races between concurrently-built pages).
 */
export function makeLocaleOnly(
  activeLocale: Locale,
): ComponentType<{ locale: Locale; children?: ReactNode }> {
  return function LocaleOnlyWrapper({ locale, children }: { locale: Locale; children?: ReactNode }) {
    return <LocaleOnly locale={locale} activeLocale={activeLocale}>{children}</LocaleOnly>;
  };
}
