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
 * lives in localStorage and is exported as plain text for pasting into the
 * course's own forms.
 *
 * Storage can throw (private windows, blocked site data), so every read and
 * write is guarded and the UI must work with an empty store.
 */
export const REQUIRED_PICKS = 6;      // 影音觀後個人筆記: 自選 6 場
const KEY = 'nlm:study:v1';

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

export function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
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

/** plain text, ready to paste into the course form */
export function exportNotes(titleFor: (id: string) => string): string {
  const s = read();
  const lines: string[] = [];
  for (const [id, e] of Object.entries(s)) {
    if (!e.picked || !e.note) continue;
    const n = e.note;
    if (!n.summary.trim() && !n.reflection.trim() && !n.question.trim()) continue;
    lines.push(`── ${titleFor(id)}`);
    lines.push(`【核心論點摘要】\n${n.summary.trim() || '（未填）'}`);
    lines.push(`【個人反思】\n${n.reflection.trim() || '（未填）'}`);
    lines.push(`【延伸問題】\n${n.question.trim() || '（未填）'}`);
    lines.push('');
  }
  return lines.join('\n') || '（尚未撰寫任何筆記）';
}

export function exportAll(titleFor: (id: string) => string): string {
  const s = read();
  const p = progress();
  const head = [
    '走進諾貝爾：跨域思辨與時代對話 — 我的學習紀錄',
    `匯出時間：${new Date().toLocaleString('zh-TW')}`,
    `自選場次：${p.picked}/${p.required}　完成筆記：${p.notesDone}　兩版本皆看完：${p.bothWatched}`,
    '',
  ];
  const qs: string[] = [];
  for (const [id, e] of Object.entries(s)) {
    if ((e.askQuestion ?? '').trim()) qs.push(`── ${titleFor(id)}\n${e.askQuestion!.trim()}`);
  }
  return [
    ...head,
    '═══ 影音觀後個人筆記 ═══',
    exportNotes(titleFor),
    '',
    '═══ 提問競賽草稿 ═══',
    qs.join('\n\n') || '（尚未撰寫）',
  ].join('\n');
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
  return write(s);
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  dispatchEvent(new CustomEvent('study:changed', { detail: {} }));
}

/** so a student can move their work between browsers */
export function importJSON(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return false;
    write(parsed as Store);
    return true;
  } catch {
    return false;
  }
}

export const rawJSON = () => JSON.stringify(read(), null, 2);
