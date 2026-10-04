/**
 * relative.mjs — makes the built site relocatable.
 *
 * Astro writes every internal address from the site root: with `base` set
 * to /nobel/, a page links its stylesheet as /nobel/_astro/x.css, and the
 * site works at exactly one address. The museum is also handed over as a
 * folder for someone else to put on their own server, at a path nobody here
 * knows in advance. So, once Astro has finished, this hook walks the output
 * and turns every one of those addresses into a path relative to the file
 * that holds it: from dist/lecture/geim/index.html, ../../_astro/x.css; from
 * dist/index.html, ./_astro/x.css; from inside dist/_astro/a.css, ../media/x.
 * After it runs, the folder can sit at / or at /any/depth/ and nothing in it
 * has to change.
 *
 * WHAT IS REWRITTEN
 * HTML and CSS files. In HTML, an address is recognised by what stands before
 * it: an attribute quote, a JSON quote inside an attribute (&#34;), a url(
 * in a style, a comma in a srcset, or `url=` in a refresh. In CSS, url().
 * Only addresses that start with the base AND continue with something that
 * exists at the top of the output (lecture/, _astro/, assets/, …) or stop
 * there (the home page) are touched, so a prose "/nobel/" or the gallery
 * called nobel under /gallery/ is left alone.
 *
 * WHAT MUST NOT NEED REWRITING
 * JavaScript. A bundled script is shared by pages at every depth, so no fixed
 * relative path can be right inside it, and an absolute one is what this
 * hook exists to remove. Client code therefore never carries the base: a
 * script that must build an address reads <html data-root>, which this hook
 * rewrites like any other attribute, and the search index records each page
 * as a path under the root with no base at all. The hook checks the bundles
 * and fails the build if a base path got into one.
 *
 * WHAT STAYS ABSOLUTE
 * canonical, hreflang and the sitemap — the web wants those fully qualified,
 * and they come from `site`, which is right for the address the build was
 * configured for. A package for an address not yet known is built with
 * PORTABLE=1, which leaves them out (see astro.config.mjs).
 *
 * As a command, on a finished build:  node integrations/relative.mjs dist /nobel/
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/* what may stand before an address in HTML: a quote (attribute or JS string),
   an escaped quote (JSON in an attribute), url( in a style, the comma of a
   srcset, or the url= of a <meta refresh> */
const CTX_HTML = String.raw`(["'\x60]|&#34;|&quot;|&#39;|&apos;|url\(\s*["']?|,\s*|url=)`;
/* in a stylesheet, only url() — with or without quotes */
const CTX_CSS = String.raw`(url\(\s*["']?)`;
/* what ends an address once the base has been consumed */
const END = String.raw`["'\x60&\s)>,?#]`;

/**
 * The pattern for one base. `names` are the entries at the top of the output;
 * an address must continue into one of them, or stop at the base itself.
 * Base '/' is the delicate case: a bare quote followed by '/' is matched only
 * when a known name follows (or a delimiter: the home page), so "//cdn…" and
 * a '/' inside prose are never taken.
 */
export function pattern(base, names, ctx) {
  const B = base.replace(/\/$/, '');
  const into = `(?=(?:${names.map(esc).join('|')})(?:/|${END}|$))`;
  /* Under a named base the base alone — the home page's address — is taken
     too. Under '/' it is not taken here: a '/' on its own in a script
     ('a' + '/' + 'b', as in the slash guard at the top of every head) is not
     an address, and rewriting it to '../../' once broke that guard. The home
     link under '/' is handled by bareRoot(), which asks for an attribute. */
  const body = B
    ? `${esc(B)}(?:/${into}|/?(?=${END}|$))`
    : `/${into}`;
  return new RegExp(`${ctx}${body}`, 'g');
}

/** under base '/', the home page's own address: a '/' that is the whole value
    of an attribute (href="/") or of a JSON string inside one (&#34;/&#34;) */
export function bareRoot() {
  return new RegExp(`(=["']|&#34;|&quot;)/(?=${END}|$)`, 'g');
}

/** '' for the root, '../' per directory level below it */
export function prefixFor(fileRel) {
  const depth = fileRel.split(/[\\/]/).length - 1;
  return depth ? '../'.repeat(depth) : './';
}

async function walk(dir, root = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, root, out);
    else out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

/**
 * Rewrite a built site in place.
 * @param {string} root  the output directory
 * @param {string} base  the base it was built with, e.g. '/nobel/'
 * @returns {{ html: number, css: number, replaced: number, problems: string[] }}
 */
export async function relativize(root, base) {
  base = base.endsWith('/') ? base : `${base}/`;
  const names = (await readdir(root)).filter((n) => !n.startsWith('.'));
  const files = await walk(root);
  const B = base.replace(/\/$/, '');
  const report = { html: 0, css: 0, replaced: 0, problems: [] };

  /* after rewriting, anything that still looks like a root address is a miss:
     the base this build was configured with, or ANY root path in an address
     position — '/segment/…' or '/file.ext' after a quote, a url( or a
     srcset comma. The second form is how an address baked in with a different
     base (a stale manifest, a hand-written '/nobel/…') shows up when the
     build is for '/' or for another path; a relocatable page has no business
     holding a root path at all. A bare '/' is left alone — in a script,
     'a' + '/' + 'b' is not an address. */
  const rootPath = (ctx) => new RegExp(`${ctx}/(?=[\\w\\-.%~]+(?:/|\\.[a-z0-9]{1,5}(?:[?#]|${END}|$)))`, 'gi');
  const leftovers = (ctx) => [
    ...(B ? [new RegExp(`(?<![\\w.\\-])${esc(B)}(?=/|${END}|$)`, 'g')] : []),
    rootPath(ctx),
  ];
  const leftoverHtml = leftovers(CTX_HTML);
  const leftoverCss = leftovers(CTX_CSS);
  /* a bundle may carry neither the base nor a root path into the output's own
     names (vendored code may legitimately hold '/draco/' and the like for a
     CDN origin it builds elsewhere, so the general form is not used there) */
  const rootNames = [...names, ...(B ? [B.split('/').filter(Boolean)[0]] : [])];
  const rootInJs = new RegExp(`["'\\x60]/(?:${rootNames.map(esc).join('|')})(?:/|["'\\x60])`, 'g');
  const inJs = B ? [new RegExp(`["'\\x60]${esc(B)}(?=/|["'\\x60])`, 'g'), rootInJs] : [rootInJs];
  /* the index records a page's address in u; it must be a path under the root */
  const inJson = /"u":"\//g;

  const complain = (file, text, re, what) => {
    for (const m of text.matchAll(re)) {
      const at = Math.max(0, m.index - 40);
      report.problems.push(`${file}: ${what} — …${text.slice(at, m.index + 60).replace(/\s+/g, ' ')}…`);
      if (report.problems.length > 40) return;
    }
  };

  for (const rel of files) {
    const kind = rel.endsWith('.html') ? 'html' : rel.endsWith('.css') ? 'css' : rel.endsWith('.js') ? 'js' : rel.endsWith('.json') ? 'json' : null;
    if (!kind) continue;
    const file = join(root, rel);
    const text = await readFile(file, 'utf8');

    if (kind === 'js') { for (const re of inJs) complain(rel, text, re, 'root path in a bundle'); continue; }
    if (kind === 'json') { complain(rel, text, inJson, 'root path in data'); continue; }

    const to = prefixFor(rel);
    const res = [pattern(base, names, kind === 'html' ? CTX_HTML : CTX_CSS)];
    if (!B && kind === 'html') res.push(bareRoot());
    let n = 0;
    let out = text;
    for (const re of res) out = out.replace(re, (_, ctx) => { n++; return `${ctx}${to}`; });
    if (n) await writeFile(file, out);
    report[kind]++;
    report.replaced += n;
    for (const lre of kind === 'html' ? leftoverHtml : leftoverCss) complain(rel, out, lre, 'left absolute');
  }
  return report;
}

export default function relativePaths() {
  let base = '/';
  return {
    name: 'nlm:relative',
    hooks: {
      'astro:config:setup': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      },
      /* last in the list on purpose: the search index must already be on
         disk (it is checked), and the sitemap is left as it is */
      'astro:build:done': async ({ dir, logger }) => {
        const r = await relativize(fileURLToPath(dir), base);
        logger.info(`relative paths: ${r.replaced} addresses in ${r.html} pages and ${r.css} stylesheets`);
        if (r.problems.length) {
          for (const p of r.problems) logger.error(p);
          throw new Error(`relative.mjs: ${r.problems.length} address(es) would break when the site moves`);
        }
      },
    },
  };
}

/* ---- as a command: node integrations/relative.mjs dist [/nobel/] ---- */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const dir = process.argv[2] ?? 'dist';
  const base = process.argv[3] ?? '/nobel/';
  const r = await relativize(dir, base);
  console.log(`${r.replaced} addresses rewritten in ${r.html} pages and ${r.css} stylesheets`);
  for (const p of r.problems) console.error(p);
  process.exit(r.problems.length ? 1 : 0);
}
