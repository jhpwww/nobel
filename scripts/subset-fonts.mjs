/**
 * subset-fonts.mjs — cut the three web fonts to the glyphs this site renders.
 *
 * Google Fonts splits CJK into ~100 unicode-range chunks and the browser takes
 * the ones a page touches. Clever, but this site's Chinese reaches across most
 * of them, so most came down: measured live, every hall pulled 2.1–3.6 MB of
 * third-party font data — more than the gap between any two of the four hall
 * designs put together. Self-hosting also takes Google out of the request path,
 * which the About page's privacy claim is the better for.
 *
 * The subset is not one corpus but three. A character is only needed in the
 * font that actually draws it, and the serif draws headings while the sans
 * draws body text — so the page is opened in a browser and every text node is
 * bucketed by its *resolved* font, rather than guessed at from selectors.
 *
 * Licence: all three are SIL OFL 1.1, which permits subsetting and
 * redistribution. The licence ships beside the fonts.
 *
 * The two museums keep separate faces and separate files. The dark museum
 * pairs Cormorant Garamond with the Noto CJK families; the bright one pairs
 * Source Serif 4 and Source Sans 3 with them instead — Noto Serif TC *is*
 * Source Han Serif TC and Noto Sans TC *is* Source Han Sans TC, so the Source
 * Latin faces are their siblings by design and share their proportions and
 * colour. A display Garamond's hairlines do not survive on white at text size.
 *
 * Nothing is shared: separate font list, separate output directory, separate
 * generated stylesheet and manifest. Changing one museum's type cannot touch
 * the other's.
 *
 * Two-pass by nature, since the corpus comes from the rendered site:
 *
 *     npm run build      && node scripts/subset-fonts.mjs               && npm run build
 *     <bright build>     && node scripts/subset-fonts.mjs --theme bright && <bright build>
 *
 * The second build picks up the new file hashes. Re-run whenever visible text
 * changes. A glyph that is missing falls back to the next family in the stack
 * (PingFang TC, Microsoft JhengHei …) — a slight change of typeface, not tofu.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PY = '.venv-fonts/bin/python';
const SUBSET = '.venv-fonts/bin/pyftsubset';
const SRC = 'assets-src/fonts';

/* this museum's faces by default; `--theme dark` re-cuts the dark museum's set */
const BRIGHT = !(process.argv.includes('--theme')
  && process.argv[process.argv.indexOf('--theme') + 1] === 'dark');

const OUT = BRIGHT ? 'public/assets/fonts/bright' : 'public/assets/fonts';
const BASE = process.env.BASE_PATH || '/nobel';
const DIST = 'dist';
/*
 * The @font-face rules go to public/, not src/, and are linked rather than
 * bundled. Both museums name families like 'Noto Serif TC', so bundling both
 * stylesheets into one build let the browser match either declaration and
 * fetch the other museum's file — a 404 on the bright site and the exact
 * mixing this split exists to prevent. Linking one stylesheet per build makes
 * the collision impossible.
 */
const CSS_OUT = `${OUT}/fonts.css`;
const MANIFEST = BRIGHT ? 'src/data/font-manifest-bright.json' : 'src/data/font-manifest.json';

/** css family name → source file, output name, the axis range the CSS asks for */
const FONTS = BRIGHT ? {
  'Noto Sans TC': ['NotoSansTC-VF.ttf', 'noto-sans-tc', 'wght=350:600'],
  'Noto Serif TC': ['NotoSerifTC-VF.ttf', 'noto-serif-tc', 'wght=400:700'],
  // opsz is pinned to the size these are actually set at; carrying the whole
  // 8-60 optical range would ship deltas for text this site never renders
  'Source Serif 4': ['SourceSerif4-VF.ttf', 'source-serif-4', 'wght=400:700 opsz=20'],
  'Source Sans 3': ['SourceSans3-VF.ttf', 'source-sans-3', 'wght=400:600'],
} : {
  'Noto Sans TC': ['NotoSansTC-VF.ttf', 'noto-sans-tc', 'wght=300:500'],
  'Noto Serif TC': ['NotoSerifTC-VF.ttf', 'noto-serif-tc', 'wght=400:600'],
  'Cormorant Garamond': ['CormorantGaramond-VF.ttf', 'cormorant-garamond', 'wght=400:600'],
};

/* Kept whatever the current build happens to show: the ranges a visitor's own
   typing and any future copy reach for first. Cheap — these are Latin and
   punctuation, not ideographs. */
const ALWAYS = [
  'U+0020-007E', 'U+00A0-00FF', 'U+2010-2027', 'U+2030-205E',
  'U+3000-303F', 'U+FE30-FE4F', 'U+FF00-FFEF',
].join(',');

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.json': 'application/json' };

/* The upstream variable fonts are 29 MB and are not kept in the repo — they
   are inputs, not artefacts. Fetched on demand so the script runs from a clean
   checkout. All three are SIL OFL 1.1; the licences ship in public/assets/fonts. */
const UPSTREAM = {
  'NotoSansTC-VF.ttf': 'ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf',
  'NotoSerifTC-VF.ttf': 'ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf',
  'CormorantGaramond-VF.ttf': 'ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf',
  'SourceSerif4-VF.ttf': 'ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf',
  'SourceSans3-VF.ttf': 'ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf',
};
fs.mkdirSync(SRC, { recursive: true });
for (const [name, rel] of Object.entries(UPSTREAM)) {
  const dest = path.join(SRC, name);
  if (fs.existsSync(dest)) continue;
  console.log(`fetching ${name} …`);
  execFileSync('curl', ['-sL', '--max-time', '180',
    `https://github.com/google/fonts/raw/main/${rel}`, '-o', dest]);
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(BASE, '');
  let file = path.join(DIST, rel);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}${BASE}`;

/* Every page but the ones that are not pages. A redirect stub is a meta
   refresh with a zero delay: it navigates the moment it is opened, and the
   evaluate below then dies with 'execution context was destroyed' and takes
   the whole run with it. They carry no type of their own worth cutting a face
   for, so they are simply not read. */
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') {
      if (/http-equiv=["']?refresh/i.test(fs.readFileSync(p, 'utf8'))) continue;
      pages.push(p.replace(DIST, '').replace(/index\.html$/, ''));
    }
  }
})(DIST);
console.log(`${pages.length} pages to read\n`);

const buckets = Object.fromEntries(Object.keys(FONTS).map((k) => [k, new Set()]));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const rel of pages) {
  await page.goto(origin + rel, { waitUntil: 'domcontentloaded' });
  /*
   * A character belongs to the font that will actually draw it, which is not
   * always the first family named. The bright museum sets Source Sans 3 ahead
   * of Noto Sans TC, so reading only the head of the stack credited a thousand
   * ideographs to a face that has none — and left the CJK face with nothing.
   *
   * So the whole stack is read, and each character is assigned to the first
   * family in it that can plausibly render that character: a CJK face for CJK,
   * the first known face otherwise.
   */
  const found = await page.evaluate(() => {
    const out = {};
    const isCJK = (c) => /[\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/.test(c);
    const stackOf = (el) => getComputedStyle(el).fontFamily
      .split(',').map((f) => f.replace(/['"]/g, '').trim());
    const add = (el, text) => {
      if (!text) return;
      const stack = stackOf(el);
      const cjkFam = stack.find((f) => /TC$|CJK|Han/.test(f)) ?? stack[0];
      for (const c of text) {
        if (!c.trim()) continue;
        const fam = isCJK(c) ? cjkFam : stack[0];
        (out[fam] ??= new Set()).add(c);
      }
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!n.nodeValue.trim() || !el || el.closest('script, style')) continue;
      add(el, n.nodeValue);
    }
    // placeholders and values are drawn too, and live outside the text tree
    for (const f of document.querySelectorAll('input, textarea')) {
      add(f, (f.placeholder ?? '') + (f.value ?? ''));
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].join('')]));
  });
  for (const [fam, chars] of Object.entries(found)) {
    if (!buckets[fam]) continue;
    for (const c of chars) buckets[fam].add(c);
  }
}
await browser.close();
server.close();

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
const faces = [];
const manifest = {};
for (const [family, [src, name, axis]] of Object.entries(FONTS)) {
  const chars = [...buckets[family]].sort().join('');
  const corpus = `.${name}-corpus.txt`;
  fs.writeFileSync(corpus, chars, 'utf8');

  // Two tools, in this order. instancer narrows the weight axis to what the CSS
  // asks for — carrying wght 100–900 when the site uses 300–500 is dead weight
  // in gvar. pyftsubset then drops the ~19,700 ideographs never shown.
  const trimmed = `.${name}-axis.ttf`;
  execFileSync(PY, ['-m', 'fontTools.varLib.instancer', '-q',
    path.join(SRC, src), ...axis.split(' '), '-o', trimmed]);
  execFileSync(SUBSET, [trimmed,
    `--text-file=${corpus}`, `--unicodes=${ALWAYS}`,
    `--output-file=${path.join(OUT, `${name}.woff2`)}`, '--flavor=woff2',
    '--layout-features=kern,liga,clig,ccmp,locl,palt,vert,vrt2',
    '--no-hinting', '--desubroutinize', '--name-IDs=1,2,3,4,6,13,14']);
  fs.unlinkSync(trimmed); fs.unlinkSync(corpus);

  const file = path.join(OUT, `${name}.woff2`);
  // hashed, for the same reason the models are: files under public/ keep their
  // URL across deploys and GitHub Pages serves them with max-age, so a resubset
  // would otherwise never reach anyone who already had the old one
  const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  // derived from OUT, not assumed: the bright museum keeps its faces in a
  // subdirectory, and hardcoding the path silently produced a preload URL that
  // pointed at nothing
  const href = `${BASE}/${OUT.replace(/^public\//, '')}/${name}.woff2?v=${hash}`;
  manifest[name] = href;
  faces.push(`@font-face {
  font-family: '${family}';
  src: url('${href}') format('woff2-variations');
  font-weight: ${axis.match(/wght=([\d.]+):([\d.]+)/).slice(1, 3).join(' ')};
  font-style: normal;
  font-display: swap;
}`);

  const kb = fs.statSync(file).size / 1024;
  total += kb;
  const cjk = [...chars].filter((c) => c >= '一' && c <= '鿿').length;
  console.log(`${family.padEnd(20)} ${String(chars.length).padStart(5)} chars ` +
    `(${String(cjk).padStart(4)} ideographs) → ${kb.toFixed(1).padStart(7)}KB`);
}
console.log(`\n${'total'.padEnd(20)} ${total.toFixed(1).padStart(31)}KB self-hosted`);

/* Generated, not hand-kept: the hashes have to change with the files, and the
   preload in Base.astro has to name the same URL the CSS asks for or the font
   is fetched twice. */
fs.writeFileSync(CSS_OUT,
  `/* Generated by scripts/subset-fonts.mjs — do not edit.\n` +
  `   ${Object.keys(FONTS).join(', ')}: SIL OFL 1.1,\n` +
  `   subset to the glyphs this site renders. Licence in public/assets/fonts/. */\n\n` +
  `${faces.join('\n\n')}\n`);
manifest._stylesheet = `${BASE}/${CSS_OUT.replace(/^public\//, '')}`;
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n→ ${CSS_OUT}, ${MANIFEST}`);
