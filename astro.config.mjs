// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * GitHub Pages project site: https://jhpwww.github.io/nobel/. When a custom
 * domain is added later, set SITE_URL and drop BASE_PATH to '/' — nothing else
 * needs to change, because every internal link goes through
 * src/i18n/routing.ts. The font stylesheets under public/assets/fonts/bright/
 * carry the base path too; scripts/subset-fonts.mjs rewrites them.
 */
// `??` is not enough: CI passes an empty string when the repo variable is unset.
const SITE = process.env.SITE_URL || 'https://jhpwww.github.io';
const BASE = process.env.BASE_PATH || '/nobel';

/**
 * This is the bright museum. It grew inside jhpwww/taiwan-nobel-museum as a
 * second build of the dark museum — same routes, same data, same components,
 * a different palette and its own hall — and moved here on 2026-09-07. The
 * theme is one attribute on <html>, set from src/theme.ts, and every bright
 * rule in src/styles/bright.css is scoped to it.
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
