// check-render.mjs <before-dist> <after-dist> [base-path]
//
// Proves that a change altered only what it meant to. Two comparisons over
// every built page: the HTML after normalising hashed asset names, and the
// computed style of every element (custom properties ignored, animations
// frozen, scripts stripped, no assets loaded — so it is deterministic and
// measures the stylesheets, not the network). A clean run means the DOM and
// the cascade are identical; a cleaned-up rule that changed nothing on any
// page shows up as nothing here. Copy dist/ aside before the change to have a
// before. The base path defaults to this museum's, /nobel/.
import { chromium } from 'playwright';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const [,, A, B, BASE = '/nobel/'] = process.argv;
if (!A || !B) { console.error('usage: node scripts/check-render.mjs <before-dist> <after-dist> [base-path]'); process.exit(2); }

async function walk(d, acc = []) {
  for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? await walk(p, acc) : acc.push(p); }
  return acc;
}
const norm = (s) => s.replace(/(_astro\/[A-Za-z0-9_\-\[\]\.]+?)\.[A-Za-z0-9_-]{8}\.(css|js)/g, '$1.HASH.$2')
                     .replace(/(assets\/fonts\/(?:bright\/)?[a-z0-9-]+)\.[a-f0-9]{8,}\.woff2/g, '$1.HASH.woff2');

// ---- 1. the HTML ----------------------------------------------------------
const fa = (await walk(A)).map((p) => relative(A, p)).sort();
const fb = new Set((await walk(B)).map((p) => relative(B, p)));
const pages = fa.filter((f) => f.endsWith('.html') && fb.has(f));
let problems = 0, sameHtml = 0;
for (const f of fa) if (!fb.has(f) && !/_astro\//.test(f)) { console.log(`MISSING in after: ${f}`); problems++; }
for (const f of pages) {
  const x = norm(await readFile(join(A, f), 'utf8')), y = norm(await readFile(join(B, f), 'utf8'));
  if (x === y) { sameHtml++; continue; }
  problems++;
  const xl = x.split('\n'), yl = y.split('\n'); let i = 0; while (i < xl.length && xl[i] === yl[i]) i++;
  console.log(`HTML DIFFERS: ${f}\n  before: ${(xl[i] ?? '').slice(0, 140)}\n  after:  ${(yl[i] ?? '').slice(0, 140)}`);
}
const bundles = async (root, files) => { const m = new Map(); for (const f of files) if (/_astro\/.*\.(css|js)$/.test(f)) m.set(norm(f), (await stat(join(root, f))).size); return m; };
const ba = await bundles(A, fa), bb = await bundles(B, [...fb]);
for (const [k, v] of ba) { const w = bb.get(k); if (w !== undefined && w !== v) console.log(`BUNDLE ${k}: ${v} -> ${w} B (${w - v >= 0 ? '+' : ''}${w - v})`); }
console.log(`html: ${sameHtml}/${pages.length} identical after hash normalisation`);

// ---- 2. the cascade -------------------------------------------------------
async function inline(root, html) {
  html = html.replace(/<meta http-equiv="refresh"[^>]*>/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  for (const m of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)]) {
    const rel = m[1].replace(BASE, '').replace(/^\//, '');
    let css = ''; try { css = await readFile(join(root, rel), 'utf8'); } catch { css = `/* MISSING ${rel} */`; }
    html = html.replace(m[0], `<style>${css}</style>`);
  }
  return html.replace('</head>', '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style></head>');
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/*', (r) => r.abort());
const page = await ctx.newPage();
const digest = () => page.evaluate(() => {
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el); let s = '';
    for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (!p.startsWith('--')) s += p + ':' + cs.getPropertyValue(p) + ';'; }
    for (const pe of ['::before', '::after']) { const q = getComputedStyle(el, pe); s += pe + q.content + q.display + q.background + q.opacity + q.transform + q.inset; }
    out.push(el.tagName + '.' + el.className + '#' + hash(s));
  }
  return out;
});
let sameCss = 0;
for (const f of pages) {
  await page.setContent(await inline(A, await readFile(join(A, f), 'utf8')), { waitUntil: 'load' }); const x = await digest();
  await page.setContent(await inline(B, await readFile(join(B, f), 'utf8')), { waitUntil: 'load' }); const y = await digest();
  if (x.length !== y.length) { console.log(`ELEMENT COUNT ${f}: ${x.length} -> ${y.length}`); problems++; continue; }
  const bad = x.map((v, i) => (v !== y[i] ? i : -1)).filter((i) => i >= 0);
  if (bad.length) { problems++; console.log(`STYLE DIFF ${f}: ${bad.length} elements, first ${x[bad[0]].split('#')[0]}`); } else sameCss++;
}
await browser.close();
console.log(`styles: ${sameCss}/${pages.length} pages with every element computed identically`);
console.log(problems ? `${problems} differences` : 'identical');
process.exit(problems ? 1 : 0);
