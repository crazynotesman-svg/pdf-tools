/**
 * Sitemap slice configuration (T8).
 *
 * The site publishes a SPLIT sitemap, never one giant file:
 *   - one `sitemapindex` at /sitemap.xml lists every sub-sitemap
 *   - one sub-sitemap per (content type × language):
 *       /sitemap/tools/de.xml, /sitemap/tools/en.xml, /sitemap/tools/zh-TW.xml, /sitemap/tools/es.xml
 *       /sitemap/blog/de.xml,  /sitemap/blog/en.xml,  /sitemap/blog/zh-TW.xml,  /sitemap/blog/es.xml
 *       /sitemap/pages/de.xml, /sitemap/pages/en.xml, /sitemap/pages/zh-TW.xml, /sitemap/pages/es.xml
 *
 * Content types:
 *   - tools : the PDF tool pages (slugs from the tools collection)
 *   - blog  : published blog posts (filtered by language + draft)
 *   - pages : static per-language pages (home, blog index, legal pages)
 *
 * `locales` is the single source of truth (src/i18n/config.ts) — adding a
 * locale here automatically adds its sitemap slices too.
 */
import type { Locale } from '@/i18n/config';
import { locales } from '@/i18n/config';

/** Content types that each get their own sitemap slice. */
export const sitemapTypes = ['tools', 'blog', 'pages'] as const;
export type SitemapType = (typeof sitemapTypes)[number];

/** Every (type, locale) combo — drives getStaticPaths + the index. */
export function sitemapCombos(): { type: SitemapType; lang: Locale }[] {
  const out: { type: SitemapType; lang: Locale }[] = [];
  for (const type of sitemapTypes) {
    for (const lang of locales) {
      out.push({ type, lang });
    }
  }
  return out;
}
