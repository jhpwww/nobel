/**
 * render-posters.mjs — a still of each model, for the poster attribute.
 *
 * <model-viewer> shows the poster until the GLB has loaded and decoded, and it
 * is all a visitor without WebGL ever sees. So the poster has to be the shot
 * the live model settles into, not an approximation: same camera, same
 * exposure, same environment. Rendering it through model-viewer itself is the
 * only way to guarantee that.
 *
 * Self-contained: serves public/ on an ephemeral port, renders, exits.
 * Output is transparent PNG so the hall's ground shows through.
 *
 *   node scripts/render-posters.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import sharp from 'sharp';
import path from 'node:path';

const CATS = ['physics', 'chemistry', 'medicine', 'peace', 'economics', 'literature'];
const ROOT = 'public';
/**
 * Both casts get a poster: the bright museum shows the gold models, and the
 * poster is what stands until its GLB decodes — and for good for anyone
 * without WebGL.
 */
const SETS = [
  { dir: 'public/assets/models', src: '/assets/models' },
  { dir: 'public/assets/models/gold', src: '/assets/models/gold' },
];
/** must stay in step with the camera in HallModels.astro and HallBright.astro */
const CAMERA = '35deg 98deg 1.55m';
const CAMERA_TARGET = '0m 0m 0m';
const CAMERA_LIMIT = 'auto auto 1.55m';

const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };

const server = http.createServer((req, res) => {
  // the viewer lives outside public/ so the site bundles it only once
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url.startsWith('/vendor/') ? url.slice(1) : path.join(ROOT, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;

fs.writeFileSync(`${ROOT}/__poster.html`, `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}
model-viewer{width:320px;height:640px;background:transparent;--poster-color:transparent}</style>
<script type="module" src="/vendor/model-viewer.min.js"></script>
<model-viewer id="m" alt="" camera-orbit="${CAMERA}" camera-target="${CAMERA_TARGET}" min-camera-orbit="${CAMERA_LIMIT}" max-camera-orbit="${CAMERA_LIMIT}" field-of-view="30deg"
  interaction-prompt="none" environment-image="neutral" exposure="1.15"
  shadow-intensity="0"></model-viewer>
<script>{const q = new URLSearchParams(location.search);
  document.getElementById('m').src = q.get('src') + '/' + q.get('cat') + '.glb';}</script>`);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 });

for (const { dir, src } of SETS) {
 fs.mkdirSync(dir, { recursive: true });
 for (const cat of CATS) {
  await page.goto(`${origin}/__poster.html?cat=${cat}&src=${encodeURIComponent(src)}`,
                  { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('m')?.loaded === true, null, { timeout: 45_000 });
  await page.waitForTimeout(900);
  const png = await page.locator('#m').screenshot({ omitBackground: true });
  // WebP, because these are smooth shaded gradients on transparency — the coin
  // alone costs 159KB as PNG and a fifth of that as WebP, at 512px for a frame
  // that is never wider than 200
  const webp = await sharp(png).resize(640, 1280, { fit: 'inside' })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 }).toBuffer();
  fs.writeFileSync(`${dir}/${cat}.webp`, webp);
  console.log(`${src.padEnd(26)} ${cat.padEnd(11)} png ${(png.length / 1024).toFixed(0).padStart(4)}KB` +
              ` → webp ${(webp.length / 1024).toFixed(0).padStart(3)}KB`);
 }
}

await browser.close();
fs.unlinkSync(`${ROOT}/__poster.html`);
server.close();
