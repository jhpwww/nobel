/**
 * check-relocatable.mjs — proves a built site works wherever it is put.
 *
 *   node scripts/check-relocatable.mjs [dist] [--prefix /any/depth/] [--port N] [--no-redirect]
 *
 * Serves the output at the prefix on a local port, the way a plain static
 * server would (index.html for a directory, a 301 onto the trailing slash,
 * ordinary MIME types, no fallbacks), then walks it from the home page the
 * way a browser would: every href, src, srcset, poster, data-src, the
 * addresses inside JSON attributes, url() in styles and stylesheets, the
 * <meta refresh>, the search index and what it points at, and the script
 * bundles. Each address must resolve inside the prefix and answer 200 — an
 * address that climbs out of the prefix is exactly the one that would break
 * on relocation. The bundles must carry no root path at all.
 *
 * Non-zero exit on the first kind of trouble; the list says which page held
 * which address. integrations/relative.mjs is what makes this pass;
 * scripts/package.mjs runs it at / and at a random nested path before zipping.
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { parseHTML } from 'linkedom';

const args = process.argv.slice(2);
const dist = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) ?? 'dist';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
let prefix = opt('--prefix', '/');
if (!prefix.startsWith('/')) prefix = `/${prefix}`;
if (!prefix.endsWith('/')) prefix += '/';
/* the encoded form is what URL.pathname yields (the walker's side); the
   decoded form is what the file system is asked for (the server's side) */
prefix = new URL(prefix, 'http://x').pathname;
const prefixFs = decodeURIComponent(prefix);
const port = Number(opt('--port', '0'));
const noRedirect = args.includes('--no-redirect');
/* --slashless: answer …/dir with dir/index.html and no redirect, as nginx
   `try_files $uri $uri/index.html` does — the hostile case the page's own
   first script exists for */
const slashless = args.includes('--slashless');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon',
};

/* ---- a plain static server, nothing clever ------------------------------ */
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p;
  try { p = decodeURIComponent(u.pathname); } catch { res.writeHead(400); res.end(); return; }
  if (`${p}/` === prefixFs) {
    if (noRedirect) { res.writeHead(404); res.end(); return; }
    if (!slashless) { res.writeHead(301, { location: `${u.pathname}/${u.search}` }); res.end(); return; }
    p += '/';
  }
  if (!p.startsWith(prefixFs)) { res.writeHead(404); res.end('outside the site'); return; }
  const rel = normalize(p.slice(prefixFs.length)).replace(/^(\.\.[\\/])+/, '');
  let file = join(dist, rel);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!p.endsWith('/') && !slashless) {
      if (noRedirect) { res.writeHead(404); res.end(); return; }
      res.writeHead(301, { location: `${u.pathname}/${u.search}` }); res.end(); return;
    }
    file = join(file, 'index.html');
  }
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

/* --serve: no walk, just the server, to look at the site at that path or to
   point a browser probe at it */
if (args.includes('--serve')) {
  console.log(`serving ${dist} at ${origin}${prefix} — Ctrl-C to stop`);
  await new Promise(() => {});
}

/* ---- the walk ------------------------------------------------------------ */
const names = readdirSync(dist).filter((n) => !n.startsWith('.'));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const rootPathInJs = new RegExp(`["'\\x60]/(?:nobel/|(?:${names.map(esc).join('|')})(?:/|["'\\x60]))`, 'g');

const problems = [];
const seenPages = new Set();
const processed = new Set();         // stylesheets, bundles and indexes already read
const checked = new Map();           // pathname+search → Promise<{status, type, body?}>
let pages = 0, refs = 0, stylesheets = 0, bundles = 0, indexed = 0;

const skip = (u) => u === '' || /^(#|mailto:|tel:|javascript:|data:|blob:|https?:|\/\/)/i.test(u);
const trouble = (page, u, why) => { if (problems.length < 60) problems.push(`${page}  →  ${u}\n      ${why}`); else problems.length++; };

function urlsInCss(text) {
  const out = [];
  for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) out.push(m[2].trim());
  return out;
}

/* A relative url() inside a custom property has two readings: Chromium
   resolves it against the stylesheet that consumes the var(), other engines
   against where it was declared. With every address relative, those differ
   by depth, so such a declaration is a bug wherever it stands. */
function varUrls(text) {
  const out = [];
  for (const m of text.matchAll(/--[\w-]+\s*:([^;{}]*)/g)) {
    for (const u of urlsInCss(m[1])) if (!skip(u)) out.push(u);
  }
  return out;
}

function stringsIn(value, out = []) {
  if (typeof value === 'string') { if (/^(\.{1,2}\/|\/(?!\/))/.test(value)) out.push(value); }
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

/** every address a browser would resolve from this document */
function refsOf(doc) {
  const out = [];
  const add = (u, why) => { if (u != null && !skip(String(u).trim())) out.push({ u: String(u).trim(), why }); };
  const scan = (scope) => {
    for (const el of scope.querySelectorAll('*')) {
      for (const a of ['href', 'src', 'poster', 'data-src', 'data-text', 'data-browse', 'action']) {
        if (el.hasAttribute(a)) add(el.getAttribute(a), `${el.tagName.toLowerCase()}[${a}]`);
      }
      if (el.hasAttribute('srcset')) {
        for (const part of el.getAttribute('srcset').split(',')) add(part.trim().split(/\s+/)[0], 'srcset');
      }
      if (el.tagName === 'META' && /refresh/i.test(el.getAttribute('http-equiv') ?? '')) {
        const m = /url=(.+)$/i.exec(el.getAttribute('content') ?? '');
        if (m) add(m[1].trim().replace(/^['"]|['"]$/g, ''), 'meta refresh');
      }
      if (el.hasAttribute('style')) {
        for (const u of urlsInCss(el.getAttribute('style'))) add(u, 'style attribute url()');
        for (const u of varUrls(el.getAttribute('style'))) out.push({ u, why: 'url() inside a custom property (style attribute)', ambiguous: true });
      }
      if (el.tagName === 'STYLE') {
        for (const u of urlsInCss(el.textContent)) add(u, '<style> url()');
        for (const u of varUrls(el.textContent)) out.push({ u, why: 'url() inside a custom property (<style>)', ambiguous: true });
      }
      for (const { name, value } of el.attributes) {
        if (/^[[{]/.test(value)) {
          try { for (const s of stringsIn(JSON.parse(value))) add(s, `${name} (json)`); } catch { /* not json */ }
        }
      }
      if (el.tagName === 'TEMPLATE' && el.content) scan(el.content);
    }
  };
  scan(doc);
  return out;
}

async function get(url) {
  const key = url.pathname + url.search;
  if (!checked.has(key)) {
    checked.set(key, fetch(url.href, { redirect: 'manual' }).then(async (res) => ({
      status: res.status,
      type: res.headers.get('content-type') ?? '',
      body: res.status === 200 && /text\/|json|javascript/.test(res.headers.get('content-type') ?? '') ? await res.text() : '',
    })).catch((e) => ({ status: 0, type: '', body: '', err: String(e) })));
  }
  return checked.get(key);
}

async function check(pageUrl, u, why) {
  refs++;
  let target;
  try { target = new URL(u, pageUrl); } catch { trouble(pageUrl.pathname, u, `${why}: not a URL`); return; }
  if (target.origin !== origin) { trouble(pageUrl.pathname, u, `${why}: leaves the host`); return; }
  if (!target.pathname.startsWith(prefix)) { trouble(pageUrl.pathname, u, `${why}: climbs out of the site root (${target.pathname})`); return; }
  const r = await get(target);
  if (r.status === 301) { trouble(pageUrl.pathname, u, `${why}: a directory without its trailing slash — works only where the server redirects`); return; }
  if (r.status !== 200) { trouble(pageUrl.pathname, u, `${why}: ${r.status || r.err}`); return; }
  if (/text\/html/.test(r.type)) { await page(target, r.body); return; }
  /* what a file contains is read once, however many pages point at it */
  if (processed.has(target.pathname)) return;
  processed.add(target.pathname);
  if (/text\/css/.test(r.type)) {
    stylesheets++;
    for (const cu of urlsInCss(r.body)) if (!skip(cu)) await check(target, cu, 'stylesheet url()');
    for (const cu of varUrls(r.body)) trouble(target.pathname, cu, 'url() inside a custom property: resolved against a different base per browser');
    return;
  }
  if (/javascript/.test(r.type)) {
    bundles++;
    for (const m of r.body.matchAll(rootPathInJs)) {
      trouble(target.pathname, m[0], 'a root path inside a script bundle'); break;
    }
    for (const m of r.body.matchAll(/import\(\s*["']([^"']+)["']/g)) {
      if (!/^(\.{1,2}\/|https?:)/.test(m[1])) trouble(target.pathname, m[1], 'a dynamic import that is not relative');
    }
    return;
  }
  if (/json/.test(r.type) && /\/search\/(zh|en)\.json$/.test(target.pathname)) {
    let data;
    try { data = JSON.parse(r.body); } catch { trouble(target.pathname, '', 'search index is not JSON'); return; }
    for (const p of data.pages ?? []) {
      indexed++;
      if (typeof p.u !== 'string' || p.u.startsWith('/')) { trouble(target.pathname, String(p.u), 'index entry is not a path under the root'); continue; }
      const t = new URL(prefix + p.u, origin);
      const rr = await get(t);
      if (rr.status !== 200 || !/text\/html/.test(rr.type)) trouble(target.pathname, p.u, `index entry answers ${rr.status}`);
    }
  }
}

async function page(url, html) {
  const key = url.pathname;
  if (seenPages.has(key)) return;
  seenPages.add(key);
  pages++;
  const { document } = parseHTML(html);
  const root = document.documentElement?.getAttribute('data-root');
  /* a redirect stub (src/pages/study) runs no script and needs no root */
  const stub = !!document.querySelector('meta[http-equiv="refresh" i]');
  if (root == null) { if (!stub) trouble(key, '', '<html> has no data-root'); }
  else if (new URL(root, url).pathname !== prefix) trouble(key, root, `data-root resolves to ${new URL(root, url).pathname}, not ${prefix}`);
  const list = refsOf(document);
  for (const r of list) if (r.ambiguous) trouble(key, r.u, `${r.why}: resolved against a different base per browser`);
  /* a few at a time; the server is local and the walk is the whole site */
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < list.length) { const { u, why, ambiguous } = list[i++]; if (!ambiguous) await check(url, u, why); }
  }));
}

const t0 = Date.now();
const home = new URL(prefix, origin);
const first = await get(home);
if (first.status !== 200) { console.error(`home page at ${home.href}: ${first.status}`); process.exit(1); }
await page(home, first.body);
/* then every page on disk that no link reached — a redirect stub, a room
   nothing points at — because the server will serve it all the same */
const stray = [];
(function walk(dir, rel = '') {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name), `${rel}${e.name}/`);
    else if (e.name === 'index.html' && !seenPages.has(prefix + rel)) stray.push(rel);
  }
})(dist);
for (const rel of stray) {
  const u = new URL(prefix + rel, origin);
  const r = await get(u);
  if (r.status !== 200) { trouble(prefix + rel, '', `on disk but answers ${r.status}`); continue; }
  await page(u, r.body);
}
server.close();

console.log(`${dist} served at ${prefix}: ${pages} pages (${stray.length} reached by no link), ${refs} addresses followed, ${stylesheets} stylesheets, ${bundles} bundles, ${indexed} index entries, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 60)) console.error(`  ${p}`);
  process.exit(1);
}
console.log('every address resolves inside the site, wherever it is mounted');
