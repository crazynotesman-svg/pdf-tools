/**
 * Tool routing helpers.
 *
 * Responsibility (per project decision): turn a stable tool `id` + a `Locale`
 * into the correct, localized URL. The slug-per-locale lives in the MDX
 * frontmatter (single source of truth) — we never hardcode slugs here.
 *
 * Example:
 *   getToolUrl('merge', 'en')  -> '/en/pdf-merge'
 *   getToolUrl('merge', 'de')  -> '/de/pdf-zusammenfuegen'
 */

import type { Locale } from '@/i18n/config';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getBlogSiblingUrl } from '@/lib/blog/router';

/** Typed tool entry pulled from the `tools` content collection. */
export type ToolEntry = CollectionEntry<'tools'>;

/**
 * Pure, synchronous path builder from an already-known slug.
 * Safe to call inside templates, hreflang maps and <a href> attributes.
 */
export function getToolPath(locale: Locale, slug: string): string {
  return `/${locale}/${slug}`;
}

/**
 * Resolve a tool URL by its stable id + locale.
 *
 * Async because it reads the content collection (the MDX frontmatter is the
 * single source of truth for slugs). Use this when you have an id but not the
 * slug — e.g. RelatedTools rendering cross-links from `relatedTools: [...]`.
 */
export async function getToolUrl(id: string, locale: Locale): Promise<string> {
  const entries = await getCollection('tools');
  const entry = entries.find((e) => e.data.id === id);
  if (!entry) {
    throw new Error(`[tools/router] unknown tool id: "${id}"`);
  }
  return getToolPath(locale, entry.data.slug[locale]);
}

/** All tool entries, typed. */
export async function getAllTools(): Promise<ToolEntry[]> {
  return getCollection('tools');
}

/** Look up a single tool entry by its stable id. */
export async function getToolById(id: string): Promise<ToolEntry | undefined> {
  const entries = await getCollection('tools');
  return entries.find((e) => e.data.id === id);
}

/**
 * Resolve the locale-equivalent URL of `currentPath` in `toLocale`.
 *
 * Per project rule (T5 #2): language switching MUST resolve the correct URL via
 * the router, never a naive locale-prefix swap. Two slug namespaces differ per
 * language and must be resolved from their content collections:
 *   - tools:  slug map lives in the MDX frontmatter (single source)
 *   - blog:   each article's three language files share a `translationKey`; the
 *             slug is the filename, which also differs per language, so we look
 *             up the sibling by translationKey.
 * Everything else (home, privacy, blog index, …) keeps its segment across
 * locales, so a prefix swap is correct there.
 *
 * Used by LanguageSwitcher so a language change preserves the current
 * tool/page — including blog posts whose slugs are not transliterations.
 */
export async function getLocalizedPagePath(
  currentPath: string,
  fromLocale: Locale,
  toLocale: Locale,
): Promise<string> {
  const segments = currentPath.split('/').filter(Boolean);

  // Blog section: resolve via translationKey (slug differs per language).
  if (segments[1] === 'blog') {
    const slug = segments[2];
    if (!slug) return `/${toLocale}/blog`; // blog index — segment is locale-invariant
    const posts = await getCollection('blog');
    const current = posts.find((p) => p.id === `${fromLocale}/${slug}`);
    if (current) {
      const sibling = await getBlogSiblingUrl(current, toLocale);
      if (sibling) return sibling;
    }
    // Graceful fallback if a translation is missing: keep the slug.
    return `/${toLocale}/blog/${slug}`;
  }

  // Tools: slug map lives in the MDX frontmatter (single source).
  const maybeSlug = segments[1];
  if (maybeSlug) {
    const entries = await getCollection('tools');
    const tool = entries.find((e) => e.data.slug[fromLocale] === maybeSlug);
    if (tool) {
      return getToolPath(toLocale, tool.data.slug[toLocale]);
    }
  }

  // Static page: keep the rest of the path, swap the locale prefix.
  const rest = segments.slice(1).join('/');
  return rest ? `/${toLocale}/${rest}` : `/${toLocale}`;
}
