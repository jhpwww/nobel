/**
 * check-glass.mjs — is the bright museum's home page still readable over its
 * own hall?
 *
 * The home page has no ground. The hall is fixed for the whole document and
 * the page is read in front of it, so what is behind any given word is a
 * photograph of a rotunda — white marble at one end of its range and a wall of
 * thirty-six dark screens at the other. Nothing in check-contrast.mjs can
 * speak to that: those tools compare tokens, and no token describes a room.
 *
 * So this measures the page as rendered. It hides the type and the pictures,
 * walks every element that carries text, and finds the darkest pixel actually
 * underneath each one — its real ground — then reports the worst.
 *
 * It runs at two device pixel ratios on purpose. A backdrop-filter is a GPU
 * texture and a texture may not exceed 8192px: an earlier version of this page
 * frosted its whole 3197px column, which is fine at ratio 2 and 9591px at
 * ratio 3. Chromium does not warn, does not fall back, and simply stops
 * filtering — so the bug was invisible on every desktop and present on most
 * phones. Panes are small now; ratio 3 is here to keep it that way.
 *
 *     node scripts/check-glass.mjs            # needs the bright dev server
 *     URL=https://... node scripts/check-glass.mjs
 *
 * Exits non-zero if any ground falls under WCAG AA for the text on it.
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const BASE = (process.env.URL ?? 'http://localhost:4322/taiwan-nobel-museum/bright/').replace(/\/$/, '');

/*
 * Every room whose page is read in front of the hall rather than on a ground
 * of its own — which since the sheets went to half alpha is all of them. The
 * root is the box the page's own words live in; everything outside it is
 * chrome, and chrome carries its own tablet.
 */
const PAGES = [
  { path: '/',                  root: '.after' },
  { path: '/gallery/physics/',  root: '.gr__sheet' },
  { path: '/gallery/nobel/',    root: '.gr__sheet' },
  { path: '/lecture/geim/',     root: '.lec__sheet' },
  { path: '/lectures/',         root: '.browse' },
  { path: '/learn/',            root: '.course' },
  { path: '/about/',            root: '.about' },
  { path: '/study/',            root: '.study' },
  { path: '/en/gallery/physics/', root: '.gr__sheet' },
  { path: '/en/lecture/geim/',  root: '.lec__sheet' },
];

/* everything that is not the ground: the type itself, and the pictures whose
   own darkness is not what any word is read against */
/* Everything, not just what is inside the root.
   The root chooses which BOXES are measured; it cannot choose which pixels
   land in them. A page's own footer is outside every root there is, and on a
   short page the sampler read 國立臺灣大學 through the box of a percentage
   forty lines above it and called the museum's own type a dark ground. So the
   type goes everywhere and only the measuring is scoped. */
const strip = (root) => `
  *, .bh__intro * { color: transparent !important; }
  /* and the ink a pseudo-element gives itself. \`*\` cannot reach it: a
     ::before inherits colour and so goes transparent with its owner, but one
     that DECLARES a colour keeps it, !important or not. The disclosure
     triangle on the note panel's summary is such a one — red, drawn inside
     the box of the paragraph under it, and reported as that paragraph's
     ground. A marker is decoration, like a rule or a border. */
  *::before, *::after { color: transparent !important; }
  img, picture, video, iframe, svg,
  .vf__btn, .card__media { visibility: hidden !important; }
  /* fixed chrome stands over the page rather than under it, and each piece of
     it carries its own frosted tablet — it is not ground for anything */
  /* And the band the page dissolves into at the top of the window, which is
     the same case pushed to its limit: a fixed copy of the room laid OVER the
     page, so that whatever is under it is on its way out of sight. Sampling
     through it reports the room as the ground of a word that is three-
     quarters gone — the 講座 badge on a card passing under the band read
     1.11:1 against the marble, and 7.34:1 against its own gold fill, which is
     the figure that is actually about whether anyone can read it. What a
     cover hides is not a contrast question. See 'the band every page
     dissolves into' in bright.css. */
  [data-roomtop],
  .topbar, .pn, .bh__lockup, .gr__lock, .bh__cue,
  /* the prize's own piece: it is pinned over the page like the museum's name,
     and a gold statue is not a ground anything is read against */
  .gr__rail { display: none !important; }
  /* an element's own rules and borders are its decoration, not the ground its
     words are read against */
  ${root} .section-h::after, ${root} .sec-h::after, ${root} .xp__h::after {
    display: none !important;
  }
  /* A link underlined with a border draws that border INSIDE its own box, so
     the sampler finds it and calls the link's own rule the link's ground.
     This museum underlines with borders in a dozen places; the rule is
     general rather than a list of them. */
  ${root} a { border-color: transparent !important; }
  /* And a heading's own mark: 延伸探索 and 2 個版本 carry a filled red square
     before them, which is inside the heading's box and is the darkest thing
     in it. A mark is a rule by another shape. */
  ${root} :is(h1, h2, h3)::before { display: none !important; }
  astro-dev-toolbar { display: none !important; }`;

const lum = (r, g, b) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const VIEWS = [
  { name: 'desktop',  viewport: { width: 1440, height: 900 }, dsf: 2, mobile: false },
  { name: 'phone x2', viewport: { width: 390, height: 844 },  dsf: 2, mobile: true },
  { name: 'phone x3', viewport: { width: 390, height: 844 },  dsf: 3, mobile: true },
];

/* WCAG 1.4.3: 4.5:1 for text, 3:1 for large-scale text */
const AA = 4.5;
const AA_LARGE = 3;

const browser = await chromium.launch();
let worst = { r: Infinity, margin: Infinity, need: 4.5 };

for (const v of VIEWS) {
 for (const pg of PAGES) {
  const page = await browser.newPage({
    viewport: v.viewport, deviceScaleFactor: v.dsf,
    isMobile: v.mobile, hasTouch: v.mobile,
  });
  const res = await page.goto(BASE + pg.path, { waitUntil: 'networkidle' });
  if (!res || res.status() !== 200) {
    console.error(`  ${pg.path} — HTTP ${res ? res.status() : 'no response'}`);
    await page.close();
    process.exitCode = 1;
    continue;
  }
  await page.waitForTimeout(2500);
  /* Each box's own ink, recorded before the type is blanked. A badge on a
     filled mark carries WHITE, and measuring white against the dark ink this
     used to assume made every one of them fail — 專訪 on its red pill read
     2.14:1 when what it actually is is white on red. */
  await page.evaluate((r) => {
    window.__root = r;
    for (const el of document.querySelectorAll(`${r} :is(h1,h2,h3,p,a,span,dt,dd,li)`)) {
      const c = getComputedStyle(el);
      el.dataset.ckInk = c.color;
      /* WCAG's own definition of large-scale text, which carries a 3:1
         threshold rather than 4.5: 18pt, or 14pt bold. In CSS pixels at the
         default 96dpi that is 24px, or 18.66px at weight 700. Recorded here
         with the ink, before the strip blanks either. */
      el.dataset.ckBig = String(
        parseFloat(c.fontSize) >= 24 ||
        (parseFloat(c.fontSize) >= 18.66 && parseInt(c.fontWeight, 10) >= 700));
    }
  }, pg.root);
  await page.addStyleTag({ content: strip(pg.root) });

  const doc = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(v.viewport.height * 0.7);

  for (let y = 0; y < doc - v.viewport.height * 0.5; y += step) {
    await page.evaluate((to) => scrollTo(0, to), y);
    await page.waitForTimeout(700);

    /* every box that carries its own words, and the colour it sets for them */
    const boxes = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll(
        `${window.__root} :is(h1,h2,h3,p,a,span,dt,dd,li)`)) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own) continue;
        /* Anything STRIP hid, and anything inside it. A badge lying on a
           video still — the kind label, the count — is in the picture the
           strip removed: it has its own opaque fill and is never read against
           the room, but its box survives `visibility: hidden` and would
           sample whatever the strip uncovered behind it. `visibility`
           inherits, so this one test catches the children too. */
        if (getComputedStyle(el).visibility === 'hidden') continue;
        const b = el.getBoundingClientRect();
        if (b.width < 8 || b.height < 8 || b.bottom < 0 || b.top > innerHeight) continue;
        out.push({ x: b.left, y: b.top, w: b.width, h: b.height,
                   ink: el.dataset.ckInk || '', tag: el.tagName,
                   big: el.dataset.ckBig === 'true',
                   text: (el.textContent || '').trim().slice(0, 16) });
      }
      return out;
    });
    if (!boxes.length) continue;

    const png = PNG.sync.read(await page.screenshot());
    const s = v.dsf;
    /* the body colour, for anything whose own ink could not be read */
    const fallback = lum(0x26, 0x22, 0x1e);

    for (const b of boxes) {
      let darkL = 1, dark = null;
      const y0 = Math.max(0, Math.ceil(b.y * s)), y1 = Math.min(png.height - 1, Math.floor((b.y + b.h) * s));
      const x0 = Math.max(0, Math.ceil(b.x * s)), x1 = Math.min(png.width - 1, Math.floor((b.x + b.w) * s));
      for (let py = y0; py <= y1; py += 2)
        for (let px = x0; px <= x1; px += 2) {
          const i = (png.width * py + px) << 2;
          const L = lum(png.data[i], png.data[i + 1], png.data[i + 2]);
          if (L < darkL) { darkL = L; dark = [png.data[i], png.data[i + 1], png.data[i + 2]]; }
        }
      if (!dark) continue;
      /* Its own ink against the darkest thing under it. For nearly everything
         that is warm near-black on marble; for a badge it is white on a fill,
         and the fill is exactly what should be measured. */
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(b.ink || '');
      const tl = m ? lum(+m[1], +m[2], +m[3]) : fallback;
      const r = ratio(tl, darkL);
      /* How far short of what this particular box needs, rather than how low
         the ratio is: large-scale text is held to 3:1 and body to 4.5, so a
         heading at 3.4 is fine while a caption at 3.6 is not, and ranking on
         the raw ratio reported the wrong one as the worst. */
      const need = b.big ? AA_LARGE : AA;
      const margin = r - need;
      if (margin < worst.margin)
        worst = { r, need, margin, dark, view: v.name, y, text: b.text, tag: b.tag, path: pg.path };
    }
  }
  await page.close();
 }
}

await browser.close();

console.log(`worst ground anywhere in the museum:`);
console.log(`  ${worst.path}  ${worst.view}  at scroll ${worst.y}  <${worst.tag}> "${worst.text}"`);
console.log(`  rgb(${worst.dark.join(',')})  ${worst.r.toFixed(2)}:1  ` +
            `${worst.margin >= 0 ? 'ok' : 'FAILS AA'} (needs ${worst.need}:1)`);
process.exit(worst.margin >= 0 && !process.exitCode ? 0 : 1);
