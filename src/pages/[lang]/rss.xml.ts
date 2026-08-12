/**
 * Per-language RSS feed (T7).
 *
 * One feed per locale: /de/rss.xml, /en/rss.xml, /zh-TW/rss.xml, /es/rss.xml. Each contains
 * only that locale's (non-draft) blog posts, sorted by pubDate desc, with
 * localized titles/descriptions and correct absolute links built from the
 * configured `site` URL.
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { locales, type Locale } from '@/i18n/config';
import { t } from '@/i18n/ui';
import { getBlogPosts, getBlogSlug, getBlogPath } from '@/lib/blog/router';

export function getStaticPaths() {
  return locales.map((lang) => ({ params: { lang } }));
}

export async function GET(context: APIContext) {
  const lang = context.params.lang as Locale;
  const site = context.site ?? new URL('https://pdf-tools.example.com');
  const posts = await getBlogPosts(lang);

  return rss({
    title: `${t(lang, 'common.siteName')} – ${t(lang, 'blog.title')}`,
    description: t(lang, 'blog.intro'),
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: new URL(getBlogPath(lang, getBlogSlug(post)), site).href,
      categories: post.data.tags,
    })),
  });
}
