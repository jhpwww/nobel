/**
 * search-index.mjs — the museum's full text, one file per language.
 *
 * The drawer in the bar (SiteSearch) ships with a hand-built index: the
 * laureates, the rooms, the museum's own pages. That answers 'Kobilka' and
 * 'Peace', and it cannot answer 'ubiquitin', 'quantum entanglement' or
 * '黑箱' — words that are on a page but are nobody's name and no room's.
 * This is the second index, built from what the pages actually say.
 *
 * WHAT IT READS
 * The built HTML, not the sources: a sentence reaches a page through i18n
 * strings, catalogue copy, component markup and the odd literal, and the only
 * place all of those have already been resolved is the page itself. Each
 * page's <main> is walked in document order and cut into sections at its
 * headings, so a hit can say which part of which page it is in and can send
 * the reader there.
 *
 * WHAT IT LEAVES OUT
 *   · anything marked data-search-skip — the boilerplate a component repeats
 *     on every page it appears on: the note panel, the 延伸探索 rail, the
 *     next-three cards, the film grids that summarise other pages
 *   · scripts, styles, templates, dialogs, SVG, model-viewer, anything
 *     aria-hidden, and anything visually hidden — none of it is the page's
 *     reading
 *   · any block whose text turns up on REPEAT_LIMIT or more pages of one
 *     language. That is the second net under the first: a line like
 *     「本場導讀影片製作中」 is on twenty-seven laureate pages and belongs to
 *     none of them, and a search for 製作中 that returned twenty-seven rows
 *     would be a search that returned nothing.
 *
 * Run on its own:  node scripts/search-index.mjs dist
 * Run by the build: see integrations/search.mjs, which calls build() on
 * astro:build:done and again, over the dev server, when the dev drawer asks.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';

/** a block seen on this many pages of one language is boilerplate */
export const REPEAT_LIMIT = 4;

/** elements whose whole text is one block of reading */
const BLOCK = new Set([
  'p', 'li', 'dt', 'dd', 'td', 'th', 'figcaption', 'blockquote', 'summary',
  'label', 'legend', 'pre', 'address', 'caption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);
const HEADING = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
/** never read */
const DROP = [
  'script', 'style', 'template', 'noscript', 'dialog', 'svg', 'model-viewer',
  'iframe', 'video', 'audio', 'picture', 'canvas',
  '[aria-hidden="true"]', '[data-search-skip]', '.visually-hidden', '[hidden]',
].join(',');

const tidy = (s) => s.replace(/[ \t\f\v\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
/** a block with no letter in it — a bare figure, a dash — is not reading */
const isReading = (s) => /\p{L}/u.test(s);

/** tags that are inline by default: a link or an emphasis inside a sentence */
const INLINE = new Set(['a', 'b', 'i', 'em', 'strong', 'span', 'mark', 'code', 'small',
  'sup', 'sub', 'abbr', 'time', 'kbd', 'q', 'cite', 'dfn', 'var', 'samp', 'u', 's', 'bdi', 'bdo', 'wbr', 'br']);
const WORD = /[\p{L}\p{N}]/u;
const HAN = /\p{Script=Han}/u;

/**
 * A text node's whitespace as the browser renders it: any run is one space,
 * a line break in the source included — even between two Han characters.
 * CSS Text would have that break vanish; Chromium (measured, 2026-09) keeps
 * a space there, and a text fragment built from here has to match what the
 * page shows, not what the specification says. (Safari follows the
 * specification; a fragment that crosses such a break misses there and the
 * reader lands on the section instead.) Structural breaks are added later
 * by textOf and are the only newlines that survive.
 */
const flat = (t) => t.replace(/\s+/g, ' ');

/**
 * The text of an element as it READS, not as textContent glues it.
 * compressHTML has taken the whitespace out from between tags, so
 * `<span>物理</span><span>Physics</span><span>1901</span>` comes back as
 * 物理Physics1901 and a heading with a styled conjunction as 'Nobelandthe'.
 * Two rules put the reading back:
 *   · a block made of nothing but element children — a row of parts, not a
 *     sentence with a link in it — is one line per child;
 *   · elsewhere, a space goes between two pieces where a word would otherwise
 *     run into another: Latin/digit against Latin/digit, or Han against
 *     Latin/digit. Han against Han is left alone, because Han has no spaces
 *     and a text fragment built from this must still match the page.
 */

function textOf(el) {
  const kids = [...el.childNodes];
  const hasText = kids.some((n) => n.nodeType === 3 && n.textContent.trim());
  const pieces = [];
  for (const n of kids) {
    if (n.nodeType === 3) { pieces.push(flat(n.textContent)); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') { pieces.push('\n'); continue; }
    const inner = textOf(n);
    if (!inner) continue;
    if (!hasText && !INLINE.has(tag)) pieces.push('\n' + inner + '\n');
    else if (!hasText) pieces.push(inner + '\n');
    else pieces.push(inner);
  }
  let out = '';
  for (const piece of pieces) {
    const a = out.replace(/\s+$/, '').slice(-1);
    const b = piece.replace(/^\s+/, '').slice(0, 1);
    if (a && b && WORD.test(a) && WORD.test(b) && !(HAN.test(a) && HAN.test(b)) && !/\s$/.test(out) && !/^\s/.test(piece)) out += ' ';
    out += piece;
  }
  return out;
}

/**
 * Pages that are another page over again. The three hall variants are the
 * hall with a different piece of furniture, and /study/ is a redirect.
 */
export const SKIP_PAGES = /^\/(?:[a-z]{2}\/)?(?:models|room|rotunda|study)\/$/;

/**
 * One page's reading, as sections.
 * @param {string} html
 * @param {string} url  the page's address, as the drawer should link it
 * @returns {{ u: string, t: string, l: string, s: { h: string, a: string, x: string[] }[] } | null}
 */
export function extract(html, url) {
  const { document } = parseHTML(html);
  const main = document.querySelector('main');
  if (!main) return null;
  const l = (document.documentElement.getAttribute('lang') ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  /* the page's own name: the <title> less the museum's, which every page ends
     with and no search should have to wade through */
  const t = tidy(document.querySelector('title')?.textContent ?? '').split(' — ')[0];

  for (const el of main.querySelectorAll(DROP)) el.remove();

  const sections = [];
  let cur = { h: '', a: '', x: [] };
  const push = () => { if (cur.x.length) sections.push(cur); };

  const visit = (el) => {
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    if (HEADING.has(tag)) {
      push();
      cur = { h: tidy(textOf(el)).replace(/\n/g, ' '), a: el.id || nearestAnchor(el, main), x: [] };
      return;
    }
    /* a block that holds other blocks — a list item with a paragraph and a
       list inside it — is read part by part, not flattened; a block that
       holds only phrasing is one piece of reading, though it may come back as
       several lines (see textOf) and each line is its own block */
    if (BLOCK.has(tag) && el.querySelector(BLOCKSEL)) {
      for (const child of el.children) visit(child);
      return;
    }
    if (BLOCK.has(tag) || !el.querySelector(BLOCKSEL)) {
      for (const line of tidy(textOf(el)).split('\n')) {
        const text = line.trim();
        if (isReading(text)) cur.x.push(text);
      }
      return;
    }
    for (const child of el.children) visit(child);
  };
  for (const child of main.children) visit(child);
  push();
  return { u: url, t, l, s: sections };
}
const BLOCKSEL = [...BLOCK].join(',');

/** a heading with no id of its own can still be reached by its section's —
    but not by <main>'s, which is the top of the page and no place at all */
function nearestAnchor(h, main) {
  let el = h;
  while (el && el !== main) {
    if (el.id) return el.id;
    el = el.parentElement;
  }
  return '';
}

/**
 * Drop the blocks that are on too many pages, then fold each section's
 * blocks into one string. Done per language: the two museums repeat
 * themselves separately.
 * @param {ReturnType<typeof extract>[]} pages
 */
export function dedupe(pages) {
  const out = { zh: [], en: [] };
  const dropped = { zh: new Map(), en: new Map() };
  for (const lang of ['zh', 'en']) {
    const mine = pages.filter((p) => p && p.l === lang);
    /* Headings count too, or 'The full lecture' survives on every page as a
       section with nothing under it. Counted by page TITLE rather than by
       page: Robinson's three pages carry his name, his prize and his
       university three times over, and a fourth lecture of his would
       otherwise strike all of it off every one of them as boilerplate. */
    const seen = new Map();
    for (const p of mine) {
      const once = new Set(p.s.flatMap((s) => [s.h, ...s.x]).filter(Boolean));
      for (const x of once) {
        if (!seen.has(x)) seen.set(x, new Set());
        seen.get(x).add(p.t);
      }
    }
    const count = (x) => seen.get(x)?.size ?? 0;
    for (const p of mine) {
      const s = [];
      for (const sec of p.s) {
        const kept = sec.x.filter((x) => {
          const n = count(x);
          if (n >= REPEAT_LIMIT) { dropped[lang].set(x, n); return false; }
          return true;
        });
        /* a heading with nothing under it is still the heading, and 'The six
           prizes' should find that section; but not a bare heading that every
           page repeats */
        if (!kept.length && (!sec.h || count(sec.h) >= REPEAT_LIMIT)) continue;
        /* joined on a newline, not a space: the drawer cuts the clause it
           links to at a line break, and a text fragment that ran from one
           block into the next would match nothing on the page */
        s.push({ h: sec.h, a: sec.a, x: kept.join('\n') });
      }
      out[lang].push({ u: p.u, t: p.t, s });
    }
  }
  return { out, dropped };
}

/**
 * Build both files from a list of pages. `pages` are { url, html }.
 * @returns {{ zh: object, en: object, dropped: { zh: Map, en: Map } }}
 */
export function build(pages, base = '/', built = new Date().toISOString()) {
  const under = (url) => `/${url.startsWith(base) ? url.slice(base.length) : url.replace(/^\/+/, '')}`;
  const extracted = pages
    .filter(({ url }) => !SKIP_PAGES.test(under(url)))
    .map(({ url, html }) => extract(html, url));
  const { out, dropped } = dedupe(extracted);
  const file = (lang) => ({ v: 1, built, pages: out[lang] });
  return { zh: file('zh'), en: file('en'), dropped };
}

/** every page under a built site, as { url, html } */
export async function readDist(dir, base, pathnames) {
  const pages = [];
  for (const p of pathnames) {
    const rel = p.replace(/^\/+/, '');
    const file = join(dir, rel, 'index.html');
    let html;
    try { html = await readFile(file, 'utf8'); } catch { continue; }
    pages.push({ url: `${base}${rel}`, html });
  }
  return pages;
}

export async function writeIndex(dir, index) {
  await mkdir(join(dir, 'search'), { recursive: true });
  for (const lang of ['zh', 'en']) {
    await writeFile(join(dir, 'search', `${lang}.json`), JSON.stringify(index[lang]));
  }
}

/* ---- as a command: node scripts/search-index.mjs dist [/nobel/] ---- */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const dir = process.argv[2] ?? 'dist';
  const base = process.argv[3] ?? '/nobel/';
  const { readdir } = await import('node:fs/promises');
  const walk = async (d, acc = []) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(join(d, e.name), acc);
      else if (e.name === 'index.html') acc.push(d);
    }
    return acc;
  };
  const dirs = await walk(dir);
  const pathnames = dirs.map((d) => d.slice(dir.length).replace(/^\/+/, '') + '/').map((p) => p === '/' ? '' : p);
  const pages = await readDist(dir, base, pathnames);
  const index = build(pages, base);
  await writeIndex(dir, index);
  for (const lang of ['zh', 'en']) {
    const size = JSON.stringify(index[lang]).length;
    console.log(`${lang}: ${index[lang].pages.length} pages, ${index[lang].pages.reduce((n, p) => n + p.s.length, 0)} sections, ${(size / 1024).toFixed(0)} KB`);
    console.log(`  dropped as boilerplate: ${index.dropped[lang].size} distinct blocks`);
  }
  if (process.env.SHOW_DROPPED) {
    for (const [x, n] of [...index.dropped.zh].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${x.slice(0, 90)}`);
  }
}
