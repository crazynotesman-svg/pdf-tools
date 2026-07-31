/**
 * robots.txt — generated at build time so it always points at the real,
 * configured `site` origin (set in astro.config.mjs). The Sitemap directive
 * references the split sitemap index (see src/pages/sitemap.xml.ts), which in
 * turn links the per-content-type / per-language sub-sitemaps.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL('https://pdf-tools.example.com')).href.replace(/\/$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `# Split sitemap index (per content type × language).`,
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
