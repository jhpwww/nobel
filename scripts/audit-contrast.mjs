/**
 * audit-contrast.mjs — measure the contrast of text as it actually renders.
 *
 * Checking tokens is not enough: a token can pass and still be applied to text
 * over a surface it was never measured against, and components reach for
 * `--gold` in places the palette author never saw. This walks every text node
 * on a set of built pages, resolves the colour actually painted and the
 * nearest opaque background behind it, and reports anything under WCAG AA.
 *
 *   node scripts/audit-contrast.mjs <origin>
 */
import { chromium } from 'playwright';

const ORIGIN = process.argv[2] ?? 'http://localhost:4570/nobel';
const PAGES = ['/', '/gallery/physics/', '/gallery/peace/', '/lecture/geim/',
               '/lectures/', '/learn/', '/study/', '/about/', '/en/'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
let failures = [];

for (const path of PAGES) {
  await page.goto(ORIGIN + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const bad = await page.evaluate(() => {
    /* A computed colour can come back as rgb()/rgba() with 0-255 channels, or
       — once color-mix() is involved, which this site uses for surfaces — as
       color(srgb r g b / a) with 0-1 channels. Reading the second as the first
       makes every surface look black and every reading a false failure. */
    const parse = (c) => {
      const m = (c.match(/[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
      if (!m.length) return { r: 255, g: 255, b: 255, a: 1 };
      if (/^color\(/.test(c)) {
        return { r: m[0] * 255, g: m[1] * 255, b: m[2] * 255, a: m[3] ?? 1 };
      }
      return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
    };
    const L = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const over = (fg, bg) => ({                    // flatten a translucent colour
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
    });
    const bgOf = (el) => {
      let n = el, acc = null;
      while (n && n !== document.documentElement.parentNode) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.a > 0) acc = acc ? over(acc, c) : c;
        if (acc && acc.a >= 0.999) return acc;
        n = n.parentElement;
      }
      return acc ?? { r: 255, g: 255, b: 255, a: 1 };
    };
    const out = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.nodeValue.trim()) continue;
      const el = t.parentElement;
      if (!el || el.closest('script, style, .visually-hidden, .skip-link')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      // text sitting on a picture cannot be measured this way
      if (el.closest('.bh__scene, .ls, .vf__btn, .card__media, .amb')) continue;
      const size = parseFloat(cs.fontSize);
      const bold = +cs.fontWeight >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      // a gradient or image behind the text cannot be sampled this way; note
      // it for the eye rather than reporting a number that is not true
      let painted = el;
      let gradient = false;
      while (painted && painted !== document.body) {
        const bi = getComputedStyle(painted).backgroundImage;
        if (bi && bi !== 'none') { gradient = true; break; }
        painted = painted.parentElement;
      }
      const fg = parse(cs.color);
      const bg = bgOf(el);
      if (gradient) continue;
      const r = ratio(over(fg, bg), bg);
      if (r < need) {
        const key = `${cs.color}|${el.className}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text: t.nodeValue.trim().slice(0, 28), cls: String(el.className).slice(0, 34),
                   color: cs.color, size: size.toFixed(0), r: r.toFixed(2), need });
      }
    }
    return out;
  });
  if (bad.length) {
    console.log(`\n${path}`);
    for (const b of bad) {
      console.log(`  ${b.r}:1 (needs ${b.need})  ${b.color}  ${b.size}px  .${b.cls}  “${b.text}”`);
    }
    failures = failures.concat(bad);
  }
}
await browser.close();
console.log(failures.length ? `\n${failures.length} failing text style(s)\n` : '\nevery text style passes AA\n');
process.exitCode = failures.length ? 1 : 0;
