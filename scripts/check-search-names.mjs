/**
 * check-search-names.mjs — no two rows in the search drawer may read alike
 * and open different pages.
 *
 * Searches a list of names and words in both languages, through the drawer
 * itself in Chromium, and counts rows whose name and mark (and, for a
 * laureate's row, the talk under the name) are the same but whose address is
 * not. Aspect's two pages, Robinson's three and Ciechanover's two once all
 * read as one; see CLAUDE.md, "The search panel". Exits 1 on any.
 *
 *   node scripts/check-search-names.mjs http://localhost:4322/nobel/
 */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4322/nobel/';
const Q = {
  zh: ['阿斯佩', 'Aspect', '羅賓森', 'Robinson', '切哈諾沃', 'Ciechanover', '量子', '宋恭源', '專訪', '天下雜誌', '風傳媒',
       '聚德霍夫', '馬斯金', '史崔克蘭', '羅伯茨', '納斯', '羅斯', '講座', '臺灣大學', '2024', '經濟', '諾貝爾', '國家', '緣木求魚', '醫療', '其他場次'],
  en: ['Aspect', 'Robinson', 'Ciechanover', 'quantum', 'Soong', 'interview', 'CommonWealth', 'Storm', 'Sudhof', 'Maskin',
       'Strickland', 'Roberts', 'Nurse', 'Roth', 'lecture', 'National Taiwan University', '2024', 'economic', 'Nobel', 'nations', 'fish', 'medicine', 'Other sessions'],
};
const browser = await chromium.launch();
let bad = 0;
for (const lang of ['zh', 'en']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base + (lang === 'en' ? 'en/' : ''), { waitUntil: 'networkidle' });
  /* on a phone-width window the key is in the menu; this runs wide */
  await page.click('[data-ss-open]');
  for (const q of Q[lang]) {
    await page.fill('[data-ss-in]', q);
    await page.waitForTimeout(700);
    const rows = await page.$$eval('[data-ss-list] .ss__row', (els) => els.map((e) => ({
      n: e.querySelector('[data-n]')?.textContent?.trim() ?? '', s: e.querySelector('[data-s]')?.textContent?.trim() ?? '',
      m: e.querySelector('[data-m]')?.textContent?.trim() ?? '', h: new URL(e.querySelector('a')?.getAttribute('href') ?? '', location.href).pathname,
      g: e.dataset.g ?? '' })));
    /* what a reader takes the row to be: its name and its mark */
    const by = new Map();
    for (const r of rows) { const k = r.g === 't' ? `${r.g}|${r.n}|${r.m}` : `${r.g}|${r.n}|${r.s}|${r.m}`; if (!by.has(k)) by.set(k, new Set()); by.get(k).add(r.h); }
    for (const [k, hs] of by) if (hs.size > 1) { bad++; console.log(`${lang} "${q}": same name+mark → ${hs.size} pages: ${k}  ${[...hs].join(' ')}`); }
    if (process.env.SHOW) for (const r of rows) console.log(`   ${lang} "${q}" [${r.g}] ${r.n} | ${r.m} | ${r.s.slice(0, 50)} → ${r.h}`);
  }
  await page.close();
}
console.log('rows that read alike for different pages:', bad);
await browser.close();
process.exit(bad ? 1 : 0);
