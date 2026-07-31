/**
 * Sitemap index — /sitemap.xml
 *
 * Lists the per-content-type / per-language sub-sitemaps (the site is split,
 * never a single giant sitemap). See src/lib/sitemap/config.ts for the matrix.
 * The slice URLs are derived from the same `locales` single source of truth.
 */
import type { APIRoute } from 'astro';
import { locales } from '@/i18n/config';
import { sitemapTypes } from '@/lib/sitemap/config';

export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL('https://pdf-tools.example.com')).href.replace(/\/$/, '');
  const locs = sitemapTypes.flatMap((type) =>
    locales.map((lang) => `${base}/sitemap/${type}/${lang}.xml`),
  );

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    locs.map((l) => `  <sitemap><loc>${l}</loc></sitemap>`).join('\n') +
    `\n</sitemapindex>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
