/**
 * package.mjs — builds the copy that is handed to someone else to deploy.
 *
 *   npm run package                                  # final address not yet known
 *   npm run package -- --site https://host/path/     # address known: canonical, hreflang, sitemap included
 *
 * Writes packages/nobel-site-YYYYMMDD-HHMM.zip, holding
 *   README.md     what the person deploying it needs to know, in Chinese with
 *                 an English summary (scripts/package-readme.md, blanks filled).
 *                 An ASCII file name on purpose: Info-ZIP's zip does not flag
 *                 UTF-8 names, and Windows Explorer garbles an unflagged one.
 *   VERSION.txt   commit, date, how it was built
 *   site/         the built site; everything in it goes into the web directory
 *
 * The build is relative throughout (integrations/relative.mjs). Before anything
 * is zipped it is served at / and at a random nested path and walked end to
 * end (scripts/check-relocatable.mjs); one broken address and no package is
 * written. PUBLIC_SUBMIT_URL in the environment is honoured, as in a deploy.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const site = opt('--site');
const outDir = resolve(opt('--out') ?? 'packages');

const env = { ...process.env };
if (site) {
  const u = new URL(site);
  env.SITE_URL = u.origin;
  env.BASE_PATH = u.pathname.replace(/\/+$/, '') || '/';
  delete env.PORTABLE;
} else {
  /* no address to put in canonical links or a sitemap, so none are written;
     the base is irrelevant to the output — every address is rewritten — and
     the default is kept, where the rewriter's matching is most robust */
  env.PORTABLE = '1';
  delete env.SITE_URL;
  delete env.BASE_PATH;
}

const run = (cmd, a, extra = {}) => execFileSync(cmd, a, { stdio: 'inherit', env, ...extra });
const say = (s) => console.log(`\n▶ ${s}`);

say(site ? `building for ${env.SITE_URL}${env.BASE_PATH}` : 'building a portable copy (address not yet known)');
run('npm', ['run', 'build']);

say('walking the build at / and at a nested path');
run('node', ['scripts/check-relocatable.mjs', 'dist', '--prefix', '/']);
const nested = `/pkg-check/${Math.random().toString(36).slice(2, 8)}/nobel-site/`;
run('node', ['scripts/check-relocatable.mjs', 'dist', '--prefix', nested]);

/* ---- the folder ---------------------------------------------------------- */
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const name = `nobel-site-${stamp}`;
const stage = join(outDir, name);
const zip = join(outDir, `${name}.zip`);
let sha = 'unknown';
try { sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* not a checkout */ }
let dirty = '';
try { dirty = execFileSync('git', ['status', '--porcelain']).toString().trim() ? ' (with uncommitted changes)' : ''; } catch { /* ignore */ }

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'site'), { recursive: true });
cpSync('dist', join(stage, 'site'), { recursive: true });
writeFileSync(join(stage, 'site', '.nojekyll'), '');

let files = 0, bytes = 0;
(function count(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) count(p); else { files++; bytes += statSync(p).size; }
  }
})(join(stage, 'site'));

const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const submit = env.PUBLIC_SUBMIT_URL?.trim();
const readme = readFileSync('scripts/package-readme.md', 'utf8')
  .replaceAll('{{SHA}}', sha + dirty)
  .replaceAll('{{DATE}}', date)
  .replaceAll('{{FILES}}', String(files))
  .replaceAll('{{MB}}', (bytes / 1048576).toFixed(0))
  .replaceAll('{{ADDRESS}}', site
    ? `這一包是以 **${env.SITE_URL}${env.BASE_PATH === '/' ? '/' : `${env.BASE_PATH}/`}** 為正式網址建置的：每頁的 canonical 連結、中英對照（hreflang）與 \`sitemap-index.xml\` 都指向這個網址。若實際網址不同，網站仍可正常使用，只是這三項會指錯地方；請告知站方重新打包。`
    : `這一包建置時**尚未指定正式網址**，所以沒有 canonical 連結、hreflang 與 sitemap——不影響使用。確定正式網址後請告知站方（GitHub 專案的維護者），重新打包即可補上，給搜尋引擎用。`)
  .replaceAll('{{ADDRESS_EN}}', site
    ? `This copy was built for ${env.SITE_URL}${env.BASE_PATH === '/' ? '/' : `${env.BASE_PATH}/`}: canonical links, hreflang pairs and the sitemap point there.`
    : 'This copy was built without a final address, so it carries no canonical links, hreflang pairs or sitemap; tell the maintainers the address and they will rebuild with them.')
  .replaceAll('{{SUBMIT}}', submit ? '已啟用（送往課程設定的 Google 試算表）' : '未啟用，頁面只有「下載」；啟用需課程端設定，見原始碼的 apps-script/submit.gs')
  .replaceAll('{{SUBMIT_EN}}', submit ? 'enabled (sends to the course\'s spreadsheet)' : 'disabled in this copy (download only)')
  .replaceAll('{{FOLDER}}', name);
writeFileSync(join(stage, 'README.md'), readme);

writeFileSync(join(stage, 'VERSION.txt'), [
  `走進諾貝爾 — 網站打包`,
  `commit:   ${sha}${dirty}`,
  `packaged: ${now.toISOString()}`,
  `address:  ${site ? `${env.SITE_URL}${env.BASE_PATH}` : 'not set (portable; no canonical, hreflang or sitemap)'}`,
  `submit:   ${submit ? 'PUBLIC_SUBMIT_URL set' : 'off'}`,
  `files:    ${files} in site/, ${(bytes / 1048576).toFixed(1)} MB`,
  `source:   https://github.com/jhpwww/nobel`,
  `how:      npm run package${site ? ` -- --site ${site}` : ''}`,
  '',
].join('\n'));

/* ---- the zip ------------------------------------------------------------- */
say(`zipping ${name}`);
rmSync(zip, { force: true });
run('zip', ['-r', '-X', '-q', zip, name], { cwd: outDir });
rmSync(stage, { recursive: true, force: true });

const digest = createHash('sha256').update(readFileSync(zip)).digest('hex');
let winPath = '';
try { winPath = execFileSync('wslpath', ['-w', zip]).toString().trim(); } catch { /* not WSL */ }
console.log(`
${zip}
${winPath ? `${winPath}\n` : ''}${(statSync(zip).size / 1048576).toFixed(1)} MB zipped, ${files} files in site/ (${(bytes / 1048576).toFixed(1)} MB)
sha256 ${digest}
commit ${sha}${dirty}
${existsSync(join(outDir, name)) ? '' : 'the folder was removed; the zip is the deliverable'}`);
