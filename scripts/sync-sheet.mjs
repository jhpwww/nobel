#!/usr/bin/env node
/**
 * sync-sheet.mjs — rebuild src/data/lectures.json from the published Google Sheet.
 *
 *   SHEET_CSV_URL="https://docs.google.com/.../pub?gid=0&single=true&output=csv" \
 *     node scripts/sync-sheet.mjs
 *
 * With no SHEET_CSV_URL set, it exits 0 and leaves the committed JSON alone, so
 * a fresh clone still builds. With one set, a fetch failure or a malformed
 * required field FAILS THE BUILD rather than publishing partial content.
 *
 * The Sheet is the source of truth for lecture data. Never hand-edit
 * src/data/lectures.json — fix the Sheet and re-run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'lectures.json');
const URL_ = process.env.SHEET_CSV_URL?.trim();

if (!URL_) {
  console.log('sync-sheet: SHEET_CSV_URL not set — keeping the committed catalogue.');
  process.exit(0);
}

/* ---------- minimal RFC-4180 CSV reader (quotes, embedded commas/newlines) ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const s = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const list = (v) => (v ?? '').split('|').map((x) => x.trim()).filter(Boolean);
const pair = (v) => { const [a, ...b] = v.split('::'); return [a.trim(), b.join('::').trim()]; };

const INTERVIEW_SRC = {
  cw:    { en: 'CommonWealth Magazine', zh: '天下雜誌' },
  storm: { en: 'The Storm Media',       zh: '風傳媒' },
};
const VALID_CATEGORIES = ['physics', 'chemistry', 'medicine', 'economics', 'peace', 'nobel'];

/* ---------- fetch ---------- */
let text;
try {
  const res = await fetch(URL_, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  text = await res.text();
} catch (e) {
  console.error(`sync-sheet: FAILED to fetch the Sheet — ${e.message}`);
  console.error('Refusing to build with stale or partial content.');
  process.exit(1);
}
if (/^\s*</.test(text)) {
  console.error('sync-sheet: the URL returned HTML, not CSV.');
  console.error('Use File > Share > Publish to web > <tab> > CSV, not the normal edit URL.');
  process.exit(1);
}

const [header, ...body] = parseCSV(text);
if (!header) { console.error('sync-sheet: the Sheet is empty.'); process.exit(1); }
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

const REQUIRED = ['id', 'laureate_en', 'laureate_zh', 'category', 'prize_year', 'date', 'host_key', 'title_en'];
for (const r of REQUIRED) {
  if (!(r in col)) { console.error(`sync-sheet: missing required column "${r}"`); process.exit(1); }
}

/* ---------- keep the parts of the catalogue the Sheet does not own ---------- */
const existing = JSON.parse(await readFile(OUT, 'utf8'));

const errors = [];
const lectures = [];
body.forEach((cells, n) => {
  const g = (k) => (col[k] === undefined ? '' : (cells[col[k]] ?? '').trim());
  const id = g('id');
  const where = `row ${n + 2}${id ? ` (${id})` : ''}`;
  if (!id) { errors.push(`${where}: empty id`); return; }
  if (g('status') && g('status') !== 'published') return;      // drafts stay off the site

  for (const r of REQUIRED) if (!g(r)) errors.push(`${where}: empty required field "${r}"`);
  const category = g('category');
  if (category && !VALID_CATEGORIES.includes(category)) errors.push(`${where}: unknown category "${category}"`);
  const date = g('date');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`${where}: date "${date}" is not YYYY-MM-DD`);
  const year = Number(g('prize_year'));
  if (g('prize_year') && !Number.isInteger(year)) errors.push(`${where}: prize_year "${g('prize_year')}" is not a number`);
  for (const [k, v] of [['yt_lecture', g('yt_lecture')], ['yt_guide', g('yt_guide')], ['yt_lecture_ipf', g('yt_lecture_ipf')]]) {
    if (v && !/^[\w-]{11}$/.test(v)) errors.push(`${where}: ${k} "${v}" is not an 11-character YouTube id`);
  }

  const host = existing.hosts[g('host_key')];
  if (!host) errors.push(`${where}: unknown host_key "${g('host_key')}"`);

  const prev = existing.lectures.find((l) => l.id === id);
  lectures.push({
    id,
    no: prev?.no ?? n + 1,
    series: g('series') || 'TAIWAN BRIDGES',
    laureate: { en: g('laureate_en'), zh: g('laureate_zh') },
    prize: { category, year },
    affiliation: { institution: g('affiliation'), country: g('country') },
    event: {
      date, host_key: g('host_key'),
      host_en: host?.en ?? '', host_zh: host?.zh ?? '', city: host?.city ?? '',
    },
    title: { en: g('title_en'), zh: g('title_zh') || null },
    description: { zh: g('summary_zh'), en: g('summary_en') },
    hook: { zh: g('hook_zh'), en: g('hook_en') },
    video: {
      lecture: g('yt_lecture') || null,
      lecture_channel: g('lecture_channel') || null,
      lecture_ipf: g('yt_lecture_ipf') || null,
      guide: g('yt_guide') || null,
      /* id::label::date, then ::title_en::title_zh where the sitting had its own subject */
      extra_sessions: list(g('extra_sessions')).map((s) => {
        const [i2, label, date, en, zh] = s.split('::').map((x) => x.trim());
        return { id: i2, label, ...(date ? { date } : {}), ...(en && zh ? { title: { en, zh } } : {}) };
      }),
    },
    interviews: list(g('interviews')).map((s) => {
      const [src, vid] = pair(s);
      if (!INTERVIEW_SRC[src]) errors.push(`${where}: unknown interview source "${src}"`);
      return { source: src, source_en: INTERVIEW_SRC[src]?.en ?? src, source_zh: INTERVIEW_SRC[src]?.zh ?? src, id: vid };
    }),
    links: {
      nobel_facts: g('nobel_facts'),
      cw_hub: prev?.links.cw_hub ?? 'https://event.cw.com.tw/2026taiwanbridge/index.html',
      ...(g('instagram') ? { instagram: g('instagram') } : {}),
      ...(g('ntu_epaper') ? { ntu_epaper: g('ntu_epaper') } : {}),
      ...(g('ntu_spotlight') ? { ntu_spotlight: g('ntu_spotlight') } : {}),
    },
    topic_tags: list(g('topic_tags')).filter((t) => {
      if (!existing.tags[t]) { errors.push(`${where}: unknown topic tag "${t}"`); return false; }
      return true;
    }),
  });
});

if (!lectures.length) errors.push('the Sheet produced zero published lectures');
const dupes = lectures.map((l) => l.id).filter((v, i, a) => a.indexOf(v) !== i);
if (dupes.length) errors.push(`duplicate ids: ${[...new Set(dupes)].join(', ')}`);

if (errors.length) {
  console.error(`sync-sheet: ${errors.length} problem(s) in the Sheet — nothing was written.\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

lectures.sort((a, b) => a.event.date.localeCompare(b.event.date));
await writeFile(OUT, JSON.stringify({ ...existing, lectures }, null, 2) + '\n', 'utf8');
console.log(`sync-sheet: wrote ${lectures.length} lectures from the Sheet.`);
