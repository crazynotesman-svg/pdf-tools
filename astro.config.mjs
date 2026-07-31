// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

// Single source of truth for locales + default locale.
// `src/i18n/config.ts` owns the locale facts (UI names, <html lang>, types);
// Astro's i18n routing imports the routing-relevant subset from there so the
// two can never drift. See scripts/check-i18n.mjs (pnpm check:i18n).
import { locales as i18nLocales, defaultLocale as i18nDefaultLocale } from './src/i18n/config.ts';

// https://astro.build/config
export default defineConfig({
  // TODO(launch): replace with the real production domain.
  // Required for canonical URLs, sitemap and RSS generation.
  site: 'https://pdf-tools.example.com',

  // Static Site Generation — best for SEO, speed and Cloudflare Pages cost.
  output: 'static',

  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }), // we import Tailwind via src/styles/global.css
    mdx(),
  ],

  // Built-in i18n routing (Astro 5), driven by the single source of truth in
  // src/i18n/config.ts (see import above). Locales: de (default, German market
  // first), en, zh-CN. prefixDefaultLocale: true keeps /de explicit (matches the
  // required URL scheme). Do NOT hardcode `locales`/`defaultLocale` here — edit
  // src/i18n/config.ts instead, or `pnpm check:i18n` will fail the build.
  i18n: {
    defaultLocale: i18nDefaultLocale,
    locales: [...i18nLocales],
    routing: {
      prefixDefaultLocale: true,
    },
  },

  vite: {
    // Clean path aliases for the modular src/ layout.
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});
