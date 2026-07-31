/**
 * Blog routing helpers (T7).
 *
 * Blog articles are LANGUAGE-SEPARATED files: src/content/blog/{lang}/{slug}.md.
 * The glob loader (content.config.ts) keeps the entry id as `{lang}/{slug}`, and
 * the three translations of one article share a `translationKey` in frontmatter.
 *
 * Everything here is derived from the content collection — no slugs are
 * hard-coded, mirroring the tool router's single-source-of-truth approach.
 */
import type { Locale } from '@/i18n/config';
import { getCollection, type CollectionEntry } from 'astro:content';

/** Typed blog entry pulled from the `blog` content collection. */
export type BlogEntry = CollectionEntry<'blog'>;

/** The URL slug of a blog entry (the segment after the language prefix in id). */
export function getBlogSlug(entry: BlogEntry): string {
  return entry.id.split('/')[1] ?? entry.id;
}

/**
 * Pure, synchronous path builder from an already-known (locale, slug).
 * Includes a trailing slash: blog posts are nested folder-index routes
 * (dist/de/blog/<slug>/index.html), so the canonical and hreflang URLs must
 * match the trailing-slash form to avoid redirects/404s.
 */
export function getBlogPath(locale: Locale, slug: string): string {
  return `/${locale}/blog/${slug}/`;
}

/** All blog entries, typed. */
export async function getAllBlogPosts(): Promise<BlogEntry[]> {
  return getCollection('blog');
}

/**
 * Blog entries for one locale, drafts excluded, sorted by pubDate desc.
 * Used by the blog index page and the RSS feed.
 */
export async function getBlogPosts(locale: Locale): Promise<BlogEntry[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts
    .filter((p) => p.id.startsWith(`${locale}/`))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Resolve the sibling URL of `entry` in `toLocale` via its shared translationKey.
 * Returns undefined when that locale has no translation of the article.
 */
export async function getBlogSiblingUrl(
  entry: BlogEntry,
  toLocale: Locale,
): Promise<string | undefined> {
  const posts = await getCollection('blog');
  const sibling = posts.find(
    (p) => p.data.translationKey === entry.data.translationKey && p.id.startsWith(`${toLocale}/`),
  );
  if (!sibling) return undefined;
  return getBlogPath(toLocale, getBlogSlug(sibling));
}

/**
 * Build hreflang alternate URLs for a blog post: one per locale that actually
 * has a translation, derived from the shared translationKey. The current
 * locale's own URL is included too (callers dedupe as needed).
 */
export async function getBlogAlternateUrls(
  entry: BlogEntry,
): Promise<{ locale: Locale; url: string }[]> {
  const posts = await getCollection('blog');
  const out: { locale: Locale; url: string }[] = [];
  for (const p of posts) {
    if (p.data.translationKey !== entry.data.translationKey) continue;
    const lang = p.id.split('/')[0] as Locale;
    out.push({ locale: lang, url: getBlogPath(lang, getBlogSlug(p)) });
  }
  return out;
}
