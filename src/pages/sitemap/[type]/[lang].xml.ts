/**
 * Per-content-type / per-language sub-sitemap.
 *
 * Route: /sitemap/{type}/{lang}.xml  (prerendered by getStaticPaths)
 *   type ∈ tools | blog | pages ;  lang ∈ de | en | zh-TW | es
 *
 * URLs mirror the exact canonical paths the site emits:
 *   - tools : getToolPath(locale, slug)            -> /{lang}/{slug}/  (trailing slash)
 *   - blog  : getBlogPath(locale, slug)            -> /{lang}/blog/{slug}/  (trailing slash)
 *   - pages : static per-language list             (home + blog index + legal)
 *
 * Blog entries carry a <lastmod> from updatedDate ?? pubDate.
 */
import type { APIRoute, GetStaticPathsResult } from 'astro';
import { getCollection } from 'astro:content';
import { locales, type Locale } from '@/i18n/config';
import { sitemapTypes, type SitemapType } from '@/lib/sitemap/config';
import { getToolPath } from '@/lib/tools/router';
import { getBlogPath, getBlogSlug } from '@/lib/blog/router';

export const getStaticPaths = (): GetStaticPathsResult => {
  const paths: GetStaticPathsResult = [];
  for (const type of sitemapTypes) {
    for (const lang of locales) {
      paths.push({ params: { type, lang } });
    }
  }
  return paths;
};

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ params, site }) => {
  const type = params.type as SitemapType;
  const lang = params.lang as Locale;
  const base = (site ?? new URL('https://pdf-tools.example.com')).href.replace(/\/$/, '');

  const urls: SitemapUrl[] = [];

  if (type === 'tools') {
    const tools = await getCollection('tools');
    for (const t of tools) {
      urls.push({ loc: `${base}${getToolPath(lang, t.data.slug[lang])}` });
    }
  } else if (type === 'blog') {
    const posts = await getCollection('blog', ({ data }) => !data.draft);
    for (const p of posts) {
      if (!p.id.startsWith(`${lang}/`)) continue;
      const lastmod = (p.data.updatedDate ?? p.data.pubDate).toISOString().slice(0, 10);
      urls.push({ loc: `${base}${getBlogPath(lang, getBlogSlug(p))}`, lastmod });
    }
  } else {
    // pages: per-language static pages (home, blog index, legal).
    urls.push(
      { loc: `${base}/${lang}/` },
      { loc: `${base}/${lang}/blog/` },
      { loc: `${base}/${lang}/privacy` },
      { loc: `${base}/${lang}/impressum` },
      { loc: `${base}/${lang}/contact` },
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>${
            u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''
          }</url>`,
      )
      .join('\n') +
    `\n</urlset>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
