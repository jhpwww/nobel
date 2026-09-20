/**
 * search.mjs — hangs the full-text index on the build and on the dev server.
 *
 * BUILT SITE
 * astro:build:done reads every page Astro just wrote, cuts it into sections
 * (scripts/search-index.mjs) and writes dist/search/zh.json and en.json next
 * to them. GitHub Pages serves those as it serves everything else; the drawer
 * fetches the one for its language the first time it opens.
 *
 * DEV SERVER
 * There is no dist to read while `astro dev` is running, and the owner reads
 * every change on the dev server first. So the same address answers there
 * too: the middleware crawls the museum through the dev server itself —
 * starting at the hall, following every internal link — and builds the index
 * from what it gets back, once, and again after any source file changes. The
 * first ask costs the time it takes to render a hundred pages; every ask
 * after it is a cache hit.
 */
import { build, readDist, writeIndex } from '../scripts/search-index.mjs';

export default function search() {
  let base = '/';
  return {
    name: 'nlm:search-index',
    hooks: {
      'astro:config:setup': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      },

      'astro:build:done': async ({ dir, pages, logger }) => {
        const root = dir.pathname;
        const built = await readDist(root, base, pages.map((p) => p.pathname));
        const index = build(built, base);
        await writeIndex(root, index);
        for (const lang of ['zh', 'en']) {
          const n = index[lang].pages.length;
          const kb = (JSON.stringify(index[lang]).length / 1024).toFixed(0);
          logger.info(`search/${lang}.json: ${n} pages, ${kb} KB, ${index.dropped[lang].size} repeated blocks left out`);
        }
      },

      'astro:server:setup': ({ server, logger }) => {
        /** @type {null | Promise<{zh: object, en: object}>} */
        let cache = null;
        const invalidate = () => { cache = null; };
        server.watcher.on('change', invalidate);
        server.watcher.on('add', invalidate);
        server.watcher.on('unlink', invalidate);

        const crawl = async (origin) => {
          const seen = new Set([base]);
          const queue = [base];
          const pages = [];
          const one = async (path) => {
            let html;
            try {
              /* bounded: one render that hangs must not pin the shared promise */
              const res = await fetch(origin + path, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(15000) });
              if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return;
              html = await res.text();
            } catch { return; }
            pages.push({ url: path, html });
            /* every internal link on the page that is a page: under the base,
               no file extension, no query, hash struck off */
            for (const m of html.matchAll(/href="([^"#?]+)/g)) {
              const href = m[1];
              if (!href.startsWith(base)) continue;
              if (/\.[a-z0-9]{2,5}$/i.test(href)) continue;
              const norm = href.endsWith('/') ? href : `${href}/`;
              if (!seen.has(norm)) { seen.add(norm); queue.push(norm); }
            }
          };
          /* a few at a time: a dev render is slow and the server is idle
             between them, so four in flight cuts the first ask to a quarter */
          const workers = Array.from({ length: 4 }, async () => {
            while (queue.length) await one(queue.shift());
          });
          await Promise.all(workers);
          /* a stable order, so the file is the same file whichever worker
             got there first */
          pages.sort((a, b) => a.url.localeCompare(b.url));
          return pages;
        };

        /* Vite's own base middleware has already struck the base off req.url
           by the time this runs, so the address is matched with or without it */
        const esc = base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
        const route = new RegExp(`^(?:${esc}|/)search/(zh|en)\\.json(?:\\?.*)?$`);
        server.middlewares.use(async (req, res, next) => {
          const m = req.url?.match(route);
          if (!m) return next();
          const lang = m[1];
          try {
            if (!cache) {
              const origin = `http://${req.headers.host}`;
              logger.info(`search/${lang}.json asked for: crawling the museum through ${origin} …`);
              const t0 = Date.now();
              cache = crawl(origin).then((pages) => {
                const index = build(pages, base);
                logger.info(`indexed ${pages.length} pages in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
                return index;
              });
              cache.catch(invalidate);
            }
            const index = await cache;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(JSON.stringify(index[lang]));
          } catch (err) {
            logger.error(String(err));
            res.statusCode = 500;
            res.end('{}');
          }
        });
      },
    },
  };
}
