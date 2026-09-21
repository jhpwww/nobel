/**
 * study.ts — the student's own work, kept in their browser.
 *
 * The course (走進諾貝爾, LibEdu1140) asks for three things this site can
 * scaffold:
 *   · 影音觀後個人筆記 — pick 6 Taiwan Bridges videos, watch each together with
 *     its original Nobel Lecture, and write 摘要 / 反思 / 延伸問題 for each
 *   · 提問競賽 — draft a deep, original question before each campus lecture
 *   · 準備 → 參與 → 反思 — track where you are in that cycle
 *
 * There is no account and no server: this is a static site, and a student's
 * unsubmitted coursework has no business leaving their machine. Everything
 * lives in localStorage and leaves it as one plain-text file — the lectures
 * and stages the student chose, named for them and the moment, with a record
 * of how each field was written (trace.ts) — for keeping or for handing in.
 *
 * Storage can throw (private windows, blocked site data), so every read and
 * write is guarded and the UI must work with an empty store.
 */
import { readTrace, setTrace, clearTrace, cleanTrace, removeTrace, describe, LEGEND, type FieldKey } from './trace';

export const REQUIRED_PICKS = 6;      // 影音觀後個人筆記: 自選 6 場
const KEY = 'nlm:study:v1';
/** who is writing — student number and name, asked for once, kept here */
const WHO_KEY = 'nlm:study:who:v1';

export interface Note {
  summary: string;      // 講者核心論點摘要
  reflection: string;   // 個人反思
  question: string;     // 至少一個延伸問題
  updated?: string;
}

export interface Entry {
  picked?: boolean;         // one of my six
  watchedTaiwan?: boolean;
  watchedNobel?: boolean;   // the original Nobel Lecture
  note?: Note;
  askQuestion?: string;      // 提問競賽 draft
}

export type Store = Record<string, Entry>;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : {};
    /* anything that is not a map of entries — a `null` that got in through a
       hand-edited file — reads as empty rather than throwing in every consumer */
    return isObj(s) ? (s as Store) : {};
  } catch {
    return {};
  }
}

/**
 * True when this browser will actually keep what we write. A private window,
 * or a browser set to block site data, throws on setItem — and a student who
 * is told "saved" in that state loses everything on reload, which is worse
 * than being told plainly that nothing is being kept.
 */
export function storageAvailable(): boolean {
  try {
    const probe = `${KEY}:probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Returns false when the write was refused, so callers can say so. */
function write(s: Store): boolean {
  let kept = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    kept = false;
  }
  dispatchEvent(new CustomEvent('study:changed', { detail: s }));
  return kept;
}

export const entry = (id: string): Entry => read()[id] ?? {};

export function update(id: string, patch: Partial<Entry>) {
  const s = read();
  s[id] = { ...(s[id] ?? {}), ...patch };
  write(s);
  return s[id];
}

/** as update(), but reports whether the change was actually kept */
export function updateKept(id: string, patch: Partial<Entry>): boolean {
  const s = read();
  s[id] = { ...(s[id] ?? {}), ...patch };
  return write(s);
}

export function setNote(id: string, patch: Partial<Note>): boolean {
  const s = read();
  const prev = s[id]?.note ?? { summary: '', reflection: '', question: '' };
  s[id] = { ...(s[id] ?? {}), note: { ...prev, ...patch, updated: new Date().toISOString() } };
  return write(s);
}

export const picks = () => Object.entries(read()).filter(([, e]) => e.picked).map(([id]) => id);

/** a note counts as done only when all three required parts are written */
export const noteComplete = (e: Entry) =>
  !!(e.note && e.note.summary.trim() && e.note.reflection.trim() && e.note.question.trim());

export function progress() {
  const s = read();
  const ids = Object.keys(s);
  return {
    picked: ids.filter((i) => s[i].picked).length,
    notesDone: ids.filter((i) => s[i].picked && noteComplete(s[i])).length,
    bothWatched: ids.filter((i) => s[i].picked && s[i].watchedTaiwan && s[i].watchedNobel).length,
    questions: ids.filter((i) => (s[i].askQuestion ?? '').trim()).length,
    required: REQUIRED_PICKS,
  };
}

/**
 * Everything the store holds for one lecture, as its own plain-text block.
 * The page can hand a single record back without the visitor having to take
 * the whole set — see 'one record at a time' in StudyDesk.
 */
export function exportOne(id: string, titleFor: (id: string) => string): string {
  const e = entry(id);
  const n = e.note ?? { summary: '', reflection: '', question: '' };
  const lines = [
    `── ${titleFor(id)}`,
    `【核心論點摘要】\n${n.summary.trim() || '（未填）'}`,
    `【個人反思】\n${n.reflection.trim() || '（未填）'}`,
    `【延伸問題】\n${n.question.trim() || '（未填）'}`,
  ];
  if ((e.askQuestion ?? '').trim()) {
    lines.push(`【想問講者的問題】\n${e.askQuestion!.trim()}`);
  }
  return lines.join('\n\n');
}

/** Anything at all written or ticked for this lecture. */
export const hasWork = (e: Entry) =>
  !!(e.picked || e.watchedTaiwan || e.watchedNobel || (e.askQuestion ?? '').trim() ||
     (e.note && (e.note.summary.trim() || e.note.reflection.trim() || e.note.question.trim())));

/** How many of the three note fields are written. */
export const noteParts = (e: Entry) =>
  [e.note?.summary, e.note?.reflection, e.note?.question].filter((v) => (v ?? '').trim()).length;

/**
 * One record, gone. Deleting is not the same as un-picking: un-ticking a
 * lecture leaves its note in the store, which is right — a visitor who
 * changes their six should not lose what they wrote — but it also means the
 * only way to actually get rid of something was to clear everything.
 */
export function remove(id: string): boolean {
  const s = read();
  delete s[id];
  removeTrace(id);
  return write(s);
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  dispatchEvent(new CustomEvent('study:changed', { detail: {} }));
}

/* ---- who ------------------------------------------------------------ */
export interface Who { id: string; name: string }

export function who(): Who {
  try {
    const raw = localStorage.getItem(WHO_KEY);
    const w = raw ? (JSON.parse(raw) as Partial<Who>) : {};
    return { id: (w.id ?? '').trim(), name: (w.name ?? '').trim() };
  } catch {
    return { id: '', name: '' };
  }
}

/** kept the moment it is typed; reports whether the browser kept it */
export function setWho(w: Who): boolean {
  try {
    localStorage.setItem(WHO_KEY, JSON.stringify({ id: w.id.trim(), name: w.name.trim() }));
    return true;
  } catch {
    return false;
  }
}

/* ---- the file for the course ------------------------------------------ */
/** the three stages, as the export lets them be chosen */
export type Part = 'prepare' | 'attend' | 'reflect';
export const PARTS: Part[] = ['prepare', 'attend', 'reflect'];

const yes = (v: boolean | undefined) => (v ? '是' : '否');
const or = (v: string | undefined) => (v ?? '').trim() || '（未填）';

/**
 * One stage of one lecture, as lines — the same lines the file prints and
 * the panel's three copy keys put on the clipboard, so that a stage pasted
 * into the course's form reads exactly as it does in the file. `field` is
 * called for each written field; the file's version adds the record under
 * it, the clipboard's does not.
 */
export function stageLines(
  e: Entry, part: Part,
  field: (k: FieldKey, label: string, text: string | undefined) => string[],
): string[] {
  const n = e.note ?? { summary: '', reflection: '', question: '' };
  switch (part) {
    case 'prepare':
      return [`〔1 準備〕已看原版 Nobel Lecture：${yes(e.watchedNobel)}`,
              ...field('askQuestion', '想問講者的問題', e.askQuestion)];
    case 'attend':
      return [`〔2 參與〕已看臺灣場次：${yes(e.watchedTaiwan)}`,
              ...field('summary', '講者核心論點摘要', n.summary)];
    case 'reflect':
      return ['〔3 反思〕',
              ...field('reflection', '個人反思', n.reflection),
              ...field('question', '延伸問題', n.question)];
  }
}

/** one stage of one lecture for the clipboard: headed by the lecture, no
    record lines, no trailing blank */
export function copyStage(id: string, part: Part, title: string): string {
  const lines = [`── ${title}`, ...stageLines(entry(id), part, (_k, label, text) => [`【${label}】`, or(text), ''])];
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/**
 * One file: the chosen lectures, the chosen stages of each, who wrote them,
 * when the file was made — and, under each field, how it came to be written
 * (see trace.ts). Chinese throughout, as the earlier exports were: the course
 * that reads it is taught in Chinese.
 */
export function exportSelected(
  ids: string[], parts: Part[], w: Who, titleFor: (id: string) => string,
  when = new Date(),
): string {
  const s = read();
  const tr = readTrace();
  const on = new Set(parts);
  const partName: Record<Part, string> = { prepare: '準備', attend: '參與', reflect: '反思' };
  const lines: string[] = [
    '走進諾貝爾：跨域思辨與時代對話 — 學習紀錄',
    `學號：${w.id || '（未填）'}　姓名：${w.name || '（未填）'}`,
    `匯出時間：${when.toLocaleString('zh-TW')}`,
    `匯出範圍：${ids.length} 場 · ${parts.map((p) => partName[p]).join('、')}`,
    '',
    LEGEND,
    '',
  ];
  for (const id of ids) {
    const e = s[id] ?? {};
    const field = (k: FieldKey, label: string, text: string | undefined) => {
      const out = [`【${label}】`, or(text)];
      const how = describe(tr[id]?.[k], (text ?? '').trim().length);
      if (how) out.push(`　書寫紀錄：${how}`);
      out.push('');
      return out;
    };
    lines.push(`── ${titleFor(id)}`);
    for (const part of PARTS) if (on.has(part)) lines.push(...stageLines(e, part, field));
    lines.push('');
  }
  if (!ids.length) lines.push('（未選任何場次）', '');
  return lines.join('\n');
}

/**
 * The file's own check: the first ten hex digits of a SHA-256 over
 * everything above the line that carries it. It is not a signature — anyone
 * can recompute it — but a file whose text has been edited after export no
 * longer matches the code at its foot, and a course that wants to know can
 * check in a second:  sed '/^═══ 核對 ═══$/,$d' file.txt | shasum -a 256
 */
export async function withChecksum(text: string): Promise<string> {
  const body = text.endsWith('\n') ? text : `${text}\n`;
  let code = '';
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    code = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
  } catch {
    code = '（此瀏覽器無法計算）';
  }
  return `${body}═══ 核對 ═══\n核對碼：${code}（此行以上全文的 SHA-256 前十位）\n`;
}

/** a name for the file: the course, who, and when, with nothing a file
    system would refuse — a space in a name becomes a hyphen, so 'Wang
    Hsiao-ming' stays readable */
export function fileName(w: Who, when = new Date(), blank = { id: '學號', name: '姓名' }): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}`;
  const clean = (v: string) => v.trim().replace(/[\u0000-\u001f\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 40);
  return `走進諾貝爾_${clean(w.id) || blank.id}_${clean(w.name) || blank.name}_${stamp}.txt`;
}

/**
 * What the course's end says when it has the file — printed at the foot of
 * the copy the student keeps, after the check code, so the code still covers
 * what it says it covers. See apps-script/submit.gs.
 */
export function receiptBlock(atIso: string, receipt: string): string {
  const at = new Date(atIso);
  const when = Number.isNaN(at.getTime()) ? atIso : at.toLocaleString('zh-TW');
  return [
    '═══ 繳交 ═══',
    `已於 ${when}（伺服器時間）繳交至課程，收據：${receipt}`,
    '課程端保有此檔案在繳交當下的原始副本，核對以該副本為準；此後對本檔的任何更動都不影響它。',
    '',
  ].join('\n');
}

/* ---- backup ------------------------------------------------------------ */
/**
 * Everything, as one file: the notes, who wrote them, and the record of how.
 * Restore takes this shape and the older one — a bare map of notes — because
 * a backup made before there was a record is still a backup.
 */
export const rawJSON = () =>
  JSON.stringify({ v: 2, entries: read(), who: who(), trace: readTrace() }, null, 2);

/** a map of entries and nothing else: every value an object, or the file
    is refused rather than half-taken */
function entriesOf(v: unknown): Store | null {
  if (!isObj(v)) return null;
  const out: Store = {};
  for (const [id, e] of Object.entries(v)) {
    if (!isObj(e)) return null;
    out[id] = e as Entry;
  }
  return out;
}

export function restoreJSON(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    if (!isObj(parsed)) return false;
    const now = new Date().toISOString();
    if (parsed.v === 2) {
      const entries = entriesOf(parsed.entries);
      if (!entries) return false;
      if (isObj(parsed.who)) setWho({ id: String(parsed.who.id ?? ''), name: String(parsed.who.name ?? '') });
      /* the record comes in checked and stamped — see cleanTrace; a file
         with no record leaves none behind, so nothing from before the
         restore is attributed to what it brought */
      setTrace(cleanTrace(parsed.trace, now));
      write(entries);
      return true;
    }
    /* the older backup: a bare map of notes, and no record of how they were
       written — so no record is kept for them */
    const entries = entriesOf(parsed);
    if (!entries) return false;
    clearTrace();
    write(entries);
    return true;
  } catch {
    return false;
  }
}

/** the notes and the record — not who. 學號 and 姓名 were asked for once and
    are kept until the student changes them, at the owner's word; the confirm
    that leads here says they stay. */
export function clearEverything() {
  clearAll();
  clearTrace();
}
