import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const BASE = '/nobel';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
               '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
               '.xml':'application/xml', '.json':'application/json', '.webp':'image/webp' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/')) p += 'index.html';
  if (!extname(p)) p += '/index.html';
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(4321, r));

const shots = JSON.parse(process.argv[2] ?? '[]');
const outDir = new URL('../shots/', import.meta.url).pathname;
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
for (const s of shots) {
  const page = await browser.newPage({
    viewport: { width: s.w ?? 1440, height: s.h ?? 900 },
    deviceScaleFactor: 2,
  });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${s.name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${s.name}: ${e.message}`));
  await page.goto(`http://localhost:4321${BASE}${s.path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(s.wait ?? 900);
  // a continuous rAF loop or a playing video never lets the page go idle
  await page.evaluate(() => {
    (window).__rotunda?.stop?.();
    document.querySelectorAll('video').forEach((v) => v.pause());
  }).catch(() => {});
  await page.waitForTimeout(150);
  if (s.hover) { try { await page.hover(s.hover); await page.waitForTimeout(1200); } catch {} }
  await page.screenshot({ path: join(outDir, `${s.name}.png`), fullPage: !!s.full, timeout: 60000 });
  await page.close();
}
await browser.close();
server.close();
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
