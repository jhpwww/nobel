// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import search from './integrations/search.mjs';
import relativePaths from './integrations/relative.mjs';

/**
 * GitHub Pages project site: https://jhpwww.github.io/nobel/. SITE_URL and
 * BASE_PATH describe that address; they decide the canonical links, the
 * hreflang pairs and the sitemap, and nothing else — every internal link goes
 * through src/i18n/routing.ts, and after the build integrations/relative.mjs
 * turns all of them into paths relative to the file that holds them, so the
 * same output also works wherever a copy of dist/ is put down.
 *
 * PORTABLE=1 builds the copy that is handed to someone else to deploy at an
 * address not yet known: the fully-qualified parts (canonical, hreflang,
 * sitemap) are left out rather than pointed at the wrong host. `npm run
 * package` sets it; see scripts/package.mjs.
 */
// `??` is not enough: CI passes an empty string when the repo variable is unset.
const SITE = process.env.SITE_URL || 'https://jhpwww.github.io';
const BASE = process.env.BASE_PATH || '/nobel';
const PORTABLE = process.env.PORTABLE === '1';

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
  /* search() writes dist/search/{zh,en}.json, the full text the drawer in the
     bar reads — see integrations/search.mjs. relativePaths() must come last:
     it rewrites what the others wrote. */
  integrations: [...(PORTABLE ? [] : [sitemap()]), search(), relativePaths()],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
