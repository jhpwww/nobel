// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * GitHub Pages project site. When a custom domain is added later, set
 * SITE_URL and drop BASE_PATH to '/' — nothing else needs to change,
 * because every internal link goes through src/i18n/routing.ts.
 */
// `??` is not enough: CI passes an empty string when the repo variable is unset.
const SITE = process.env.SITE_URL || 'https://jhpwww.github.io';
const BASE = process.env.BASE_PATH || '/taiwan-nobel-museum';

/**
 * The bright museum is the same site in daylight — same routes, same data,
 * same components — built a second time with a different palette and its own
 * hall, and deployed alongside under /bright/. Nothing about the dark build
 * changes: the theme is one attribute on <html>, and every bright rule in
 * src/styles/bright.css is scoped to it.
 */

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
