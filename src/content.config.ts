/**
 * Content Collections — single source of truth for structured site content.
 *
 * Design boundary (per project decision):
 *   - src/i18n/*.json  -> system UI text only (buttons, nav, footer, toasts)
 *   - src/content/tools/*.mdx -> ALL SEO content (title, description, H1,
 *     intro, FAQ, HowTo, related tools, schema config) + the long-form
 *     article body, one mixed-language MDX per tool (body wrapped in
 *     <LocaleOnly> per language).
 *   - src/content/blog/{lang}/{slug}.md -> blog articles as LANGUAGE-SEPARATED
 *     files (per T7 constraint #1). Each language is its own .md file; the three
 *     translations of one article share a `translationKey` so hreflang + the
 *     language switcher can link them. This deliberately does NOT use the tool
 *     page MDX <LocaleOnly> pattern.
 *
 * Every localized field is modelled as an explicit { de, en, 'zh-TW', es } object
 * (never a loose Record) so a missing locale fails the build — exactly like the
 * i18n JSON type-check in T2.
 */

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// --- Reusable building blocks ---------------------------------------------

/** A single localized string pair used across SEO + content blocks. */
const seoBlock = z.object({
  title: z.string(),
  description: z.string(),
});

/** Tool-facing copy: the H1 and the lead paragraph under the hero. */
const contentBlock = z.object({
  h1: z.string(),
  intro: z.string(),
});

/** One FAQ entry (question + answer). Rendered as accordion + FAQPage schema. */
const faqItem = z.object({
  question: z.string(),
  answer: z.string(),
});

/** One HowTo step for the HowToSchema structured data. */
const howToStep = z.object({
  name: z.string(),
  text: z.string(),
});

/** One feature / benefit / limitation bullet (rendered as a list on tool pages). */
const listItem = z.object({
  title: z.string(),
  text: z.string(),
});

/**
 * Fine-grained JSON-LD controls. Most tools can rely on the defaults; a tool
 * can override `applicationType` to emit WebApplication instead of
 * SoftwareApplication.
 */
const schemaConfig = z.object({
  applicationCategory: z.string().default('Utilities'),
  operatingSystem: z.string().default('Web'),
  offersPrice: z.string().default('0'),
  offersPriceCurrency: z.string().default('EUR'),
  applicationType: z.enum(['SoftwareApplication', 'WebApplication']).default('SoftwareApplication'),
});

// --- The tools collection --------------------------------------------------

const tools = defineCollection({
  // MDX content collection (per project decision: MDX, not YAML).
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/tools',
    // IMPORTANT: Astro's glob loader reserves the frontmatter `slug` field to
    // derive the entry id. Our `slug` is a *multilingual object* ({ de, en,
    // 'zh-TW', 'es' }), so we must supply our own id generator (file name without
    // extension) and keep `slug` as plain data. Without this, the loader would
    // try to use the object as the id and crash (`id.endsWith is not a function`).
    generateId: ({ entry }) => {
      const file = entry.split(/[\\/]/).pop() ?? entry;
      return file.replace(/\.mdx$/, '');
    },
  }),
  schema: z.object({
    /** Stable identifier, also used by the router + relatedTools cross-links. */
    id: z.string(),

    /** Optional content update date — rendered as "Updated: <Month Year>" on
     *  the tool page and emitted as `dateModified` in structured data. */
    updatedDate: z.coerce.date().optional(),

    /**
     * Operation family — drives which lib function runs in Phase 2/3
     * (merge / split / rotate / toImage / compress / protect / unlock /
     * watermark) and groups tools for SEO categories.
     */
    toolType: z.enum([
      'merge',
      'split',
      'rotate',
      'toImage',
      'compress',
      'protect',
      'unlock',
      'watermark',
    ]),

    /** Per-locale URL slug. The router maps (id, locale) -> /{locale}/{slug}. */
    slug: z.object({
      de: z.string(),
      en: z.string(),
      'zh-TW': z.string(),
      es: z.string(),
    }),

    /** SEO <title> + meta description, per locale. */
    seo: z.object({
      de: seoBlock,
      en: seoBlock,
      'zh-TW': seoBlock,
      es: seoBlock,
    }),

    /** Hero copy (H1 + intro), per locale. */
    content: z.object({
      de: contentBlock,
      en: contentBlock,
      'zh-TW': contentBlock,
      es: contentBlock,
    }),

    /** At least 5 entries recommended for the FAQPage rich result. */
    faq: z.object({
      de: z.array(faqItem),
      en: z.array(faqItem),
      'zh-TW': z.array(faqItem),
      es: z.array(faqItem),
    }),

    /** Step-by-step instructions for the HowToSchema rich result. */
    howTo: z.object({
      de: z.array(howToStep),
      en: z.array(howToStep),
      'zh-TW': z.array(howToStep),
      es: z.array(howToStep),
    }),

    /** Cross-links to other tool ids (rendered by RelatedTools in T6). */
    relatedTools: z.array(z.string()),

    /**
     * Additional cross-links for the internal-link authority pass (Phase 2.2):
     * a wider recommendation set, rendered together with relatedTools.
     */
    recommendedTools: z.array(z.string()).default([]),

    /**
     * Semantic cluster id used to group tools for internal-linking sections
     * (e.g. 'organize' | 'convert' | 'optimize' | 'secure'). Free-form string.
     */
    toolCluster: z.string().default('organize'),

    /**
     * Structured feature highlights (Phase 2.2). Rendered as a "feature
     * highlights" section and mined for long-tail SEO terms. Multilingual.
     */
    features: z.object({
      de: z.array(listItem),
      en: z.array(listItem),
      'zh-TW': z.array(listItem),
      es: z.array(listItem),
    }),

    /** User-facing benefits — what the user gains. Multilingual. */
    benefits: z.object({
      de: z.array(listItem),
      en: z.array(listItem),
      'zh-TW': z.array(listItem),
      es: z.array(listItem),
    }),

    /** Honest limitations (e.g. browser-side constraints). Multilingual. */
    limitations: z.object({
      de: z.array(listItem),
      en: z.array(listItem),
      'zh-TW': z.array(listItem),
      es: z.array(listItem),
    }),

    /**
     * Head search keywords per locale (Phase 2.3.9). Not rendered directly —
     * reserved for future programmatic SEO: FAQ expansion, meta variants and
     * internal-link generation. Multilingual.
     */
    searchKeywords: z.object({
      de: z.array(z.string()),
      en: z.array(z.string()),
      'zh-TW': z.array(z.string()),
      es: z.array(z.string()),
    }),

    /** Primary target keyword per locale (Phase 3.2.2) — base for title/H1/meta
     *  optimization and future programmatic pages. Multilingual. */
    primaryKeyword: z.object({
      de: z.string(),
      en: z.string(),
      'zh-TW': z.string(),
      es: z.string(),
    }),

    /**
     * Long-tail keywords per locale (>=5 recommended): mix of transactional,
     * question and use-case terms. Reserved for FAQ expansion, content matrix
     * and programmatic SEO. Multilingual.
     */
    longTailKeywords: z.object({
      de: z.array(z.string()),
      en: z.array(z.string()),
      'zh-TW': z.array(z.string()),
      es: z.array(z.string()),
    }),

    /** Search intent of the tool's primary keyword (single value, language-agnostic). */
    searchIntent: z.enum(['informational', 'transactional', 'navigational']),

    /** Whether the tool is highlighted on the landing page ("Popular" badge). */
    popular: z.boolean().default(false),

    /** Landing ordering — lower number first. Default 99 (not featured). */
    priority: z.number().default(99),

    /**
     * Related blog article translationKeys (Phase 3.2.5). Rendered as a
     * "Related articles" section on the tool page (ToolBlogLinks). Values are
     * blog `translationKey`s (one key maps the article across all three
     * locales), NOT slugs. Empty by default — old MDX without the field still
     * builds and simply renders no section.
     */
    relatedBlogPosts: z.array(z.string()).default([]),

    /** Optional JSON-LD overrides; falls back to defaults when omitted. */
    schema: schemaConfig.optional(),
  }),
});

// --- The blog collection (T7) --------------------------------------------
//
// Language-separated files: src/content/blog/{lang}/{slug}.md
//   de/warum-pdfs-zusammenfuegen.md
//   en/why-merge-pdfs.md
//   zh-TW/wei-shi-me-he-bing-pdf.md
//
// The glob loader's default `generateId` would again try to read frontmatter
// `slug`; here we keep the path as the id (`de/warum-pdfs-zusammenfuegen`) so a
// single article's three language files live under one `translationKey`.

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    generateId: ({ entry }) => {
      // entry = "de/warum-pdfs-zusammenfuegen.md" -> "de/warum-pdfs-zusammenfuegen"
      return entry.replace(/\.md$/, '');
    },
  }),
  schema: z.object({
    /**
     * Links the language variants of ONE article. Every translation file of the
     * same post uses the same `translationKey`, so hreflang alternates and the
     * language switcher can resolve siblings across locales.
     */
    translationKey: z.string(),

    /** Article title (in this file's language). */
    title: z.string(),

    /** Meta description / RSS summary (in this file's language). */
    description: z.string(),

    /** Publication date (used for sorting + RSS pubDate + JSON-LD). */
    pubDate: z.coerce.date(),

    /** Optional last-updated date (falls back to pubDate in JSON-LD). */
    updatedDate: z.coerce.date().optional(),

    /** Free-form tags, also emitted as RSS categories. */
    tags: z.array(z.string()).default([]),

    /** Author display name; defaults to the site brand. */
    author: z.string().default('PDF Werkzeuge'),

    /** Optional cover image path/URL (emitted in JSON-LD + RSS if present). */
    cover: z.string().optional(),

    /** Drafts are excluded from build + RSS. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { tools, blog };
