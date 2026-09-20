/**
 * trace.ts — how a note came to be written.
 *
 * The learning area exports a student's notes for a course to mark, and the
 * question a course now has to ask of any text is whether the student wrote
 * it. A static site cannot answer that, and it should not pretend to; what it
 * can do is keep an honest record of how each field was filled and put that
 * record in the file beside the words. Per field, per lecture:
 *
 *   typed   characters that arrived a few at a time — a keystroke, an input
 *           method's composition, a word from a predictive keyboard, a
 *           spelling correction, a sentence the student moved within the
 *           field
 *   pasted  characters that arrived by paste or drop from somewhere else;
 *           `pastes` counts the pastes and `biggest` the largest one, because
 *           six pastes of fifty characters and one of eight hundred are
 *           different stories
 *   auto    characters that arrived in one trusted burst of forty or more with
 *           no key and no composition behind it — an automation tool's
 *           insertText, a script setting the value, a synthetic event; and,
 *           honestly, dictation and handwriting panels, which arrive the same
 *           way, so the file calls this 其他輸入 and says what it can be
 *   edits   separate sittings, ten minutes apart or more
 *   active  seconds spent with the field changing, idle gaps struck out
 *   first / last  when
 *   restored      set when the record came in through a backup file rather
 *                 than being written here — see study.ts restoreJSON()
 *
 * What makes the three kinds tellable apart is the browser's own account of
 * an edit: the input event's inputType, whether the event is trusted, and
 * whether an input method was composing. None of it is proof — a tool that
 * owns the browser can type one character at a time and look like a person,
 * and a person can type out what a machine wrote — but a file that says
 * 「其他輸入 2,400 字，1 次編輯，共不到 1 分鐘」 says what it says, and the
 * file is honest about what it cannot say.
 *
 * Kept apart from the notes themselves so the notes' own store keeps its
 * shape, and exported and restored with them so a backup carries its record.
 */
const KEY = 'nlm:study:trace:v1';

export type FieldKey = 'askQuestion' | 'summary' | 'reflection' | 'question';

export interface FieldTrace {
  typed: number;
  pasted: number;
  auto: number;
  edits: number;
  active: number;
  pastes?: number;
  biggest?: number;
  first?: string;
  last?: string;
  restored?: string;
}

export type Trace = Record<string, Partial<Record<FieldKey, FieldTrace>>>;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function readTrace(): Trace {
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? JSON.parse(raw) : {};
    return isObj(t) ? (t as Trace) : {};
  } catch {
    return {};
  }
}

function writeTrace(t: Trace) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* the notes' own save reports this */ }
  /* every watcher on this page lets go of what it was holding — see watch() */
  dispatchEvent(new CustomEvent('trace:reset'));
}

/**
 * One field's record as it came out of a file, checked: numbers that are
 * numbers, dates that are dates, nothing else. A record that came through a
 * file is stamped as such, because a file is something a student can edit
 * before restoring it, and the export prints the stamp.
 */
export function cleanTrace(raw: unknown, restoredAt: string): Trace {
  const out: Trace = {};
  if (!isObj(raw)) return out;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined);
  for (const [id, fields] of Object.entries(raw)) {
    if (!isObj(fields)) continue;
    const rec: Partial<Record<FieldKey, FieldTrace>> = {};
    for (const k of ['askQuestion', 'summary', 'reflection', 'question'] as FieldKey[]) {
      const f = fields[k];
      if (!isObj(f)) continue;
      rec[k] = {
        typed: num(f.typed), pasted: num(f.pasted), auto: num(f.auto),
        edits: num(f.edits), active: num(f.active),
        pastes: num(f.pastes) || undefined, biggest: num(f.biggest) || undefined,
        first: iso(f.first), last: iso(f.last),
        restored: iso(f.restored) ?? restoredAt,
      };
    }
    if (Object.keys(rec).length) out[id] = rec;
  }
  return out;
}

/** replace the whole record — used when a backup is restored */
export function setTrace(t: Trace) { writeTrace(t); }

export function clearTrace() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  dispatchEvent(new CustomEvent('trace:reset'));
}

/** one lecture's record, gone with its note */
export function removeTrace(id: string) {
  const t = readTrace();
  if (!(id in t)) return;
  delete t[id];
  writeTrace(t);
}

export const traceOf = (id: string, field: FieldKey): FieldTrace | undefined => readTrace()[id]?.[field];

const blank = (): FieldTrace => ({ typed: 0, pasted: 0, auto: 0, edits: 0, active: 0 });

/** a gap longer than this between two changes is a new sitting */
const SITTING_GAP = 10 * 60 * 1000;
/** a gap longer than this is not counted as time spent writing */
const IDLE_GAP = 60 * 1000;
/** a trusted insert of this many characters at once, with no key and no
    composition behind it, did not come from a keyboard */
const BURST = 40;
/** a key that went down this recently is what caused the insert */
const KEY_WINDOW = 120;

/**
 * Watch one textarea and keep its record. The record is flushed to storage
 * on the same 450 ms debounce the note itself is saved on, so a page closed
 * mid-word loses at most one word of the record and one word of the note.
 *
 * The length the field had BEFORE each change is read on beforeinput, not
 * remembered from the last change: the panel fills its fields from storage
 * after this is attached, a restore refills them, and another tab may write
 * them — and none of that is writing. Only what changes between beforeinput
 * and input is counted.
 */
export function watch(el: HTMLTextAreaElement, id: string, field: FieldKey) {
  let rec: FieldTrace | null = null;
  let lastAt = 0;
  let keyAt = 0;
  let composing = false;
  let composeFrom = 0;
  let prevLen = el.value.length;
  let flushTimer = 0;
  /** what the student last cut out of this field, so that pasting it back
      is a move and not a paste */
  let lastCut = '';
  /** what the last drag took out, so a drop of the same length is a move */
  let dragged = 0;

  const load = () => { if (!rec) rec = { ...blank(), ...(traceOf(id, field) ?? {}) }; return rec; };

  /* A field that is no longer in the document is a field whose block was
     rebuilt (see paintWork in StudyDesk) — its record is stale and must not
     be written back over the live one, least of all on pagehide. */
  const flush = () => {
    if (!rec || !el.isConnected) return;
    const t = readTrace();
    t[id] = { ...(t[id] ?? {}), [field]: rec };
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* reported by the note's own save */ }
  };

  /* the store was cleared or replaced under us — in this tab or another:
     forget what we were holding and read afresh at the next change */
  addEventListener('trace:reset', () => { rec = null; lastAt = 0; });
  addEventListener('storage', (ev) => { if (ev.key === null || ev.key === KEY) { rec = null; lastAt = 0; } });

  const tick = (now: number) => {
    const r = load();
    /* on a fresh page the last change is the one the record remembers, so a
       reload a minute later is the same sitting, not a new one */
    if (!lastAt && r.last) lastAt = Date.parse(r.last) || 0;
    const gap = lastAt ? now - lastAt : Infinity;
    if (gap >= SITTING_GAP) r.edits += 1;
    else if (gap < IDLE_GAP) r.active += gap / 1000;
    lastAt = now;
    const iso = new Date(now).toISOString();
    if (!r.first) r.first = iso;
    r.last = iso;
    clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 450);
  };

  const add = (kind: 'typed' | 'pasted' | 'auto', n: number, now: number) => {
    if (n <= 0) { tick(now); return; }
    const r = load();
    r[kind] += n;
    if (kind === 'pasted') {
      r.pastes = (r.pastes ?? 0) + 1;
      r.biggest = Math.max(r.biggest ?? 0, n);
    }
    tick(now);
  };

  /** a key went down just before: this insert is that key's */
  const keyed = () => performance.now() - keyAt < KEY_WINDOW;

  /* only the browser's own events say anything about how text arrived; a
     script can dispatch a keydown or a compositionstart as easily as an input */
  el.addEventListener('beforeinput', (ev) => { if (ev.isTrusted) prevLen = el.value.length; });
  el.addEventListener('focus', () => { prevLen = el.value.length; });
  el.addEventListener('keydown', (ev) => { if (ev.isTrusted) keyAt = performance.now(); });
  el.addEventListener('compositionstart', (ev) => {
    if (!ev.isTrusted) return;
    composing = true;
    composeFrom = el.value.length;
  });
  el.addEventListener('compositionend', (ev) => {
    if (!ev.isTrusted) return;
    composing = false;
    /* what the input method left behind, counted once, as typed */
    add('typed', Math.max(0, el.value.length - composeFrom), Date.now());
    prevLen = el.value.length;
  });
  el.addEventListener('cut', () => {
    lastCut = el.value.slice(el.selectionStart, el.selectionEnd);
  });

  el.addEventListener('input', (ev) => {
    const e = ev as InputEvent;
    const now = Date.now();
    const len = el.value.length;
    const before = prevLen;
    const grew = Math.max(0, len - before);
    prevLen = len;
    /* a composition is counted when it ends, not letter by letter */
    if (composing || e.inputType === 'insertCompositionText') return;
    if (e.inputType === 'insertFromComposition') { add('typed', grew, now); return; }
    /* what a drag took out, so the drop that follows can be told from a
       drop of foreign text */
    if (e.inputType === 'deleteByDrag') dragged = Math.max(0, before - len);
    /* deleting, undoing, redoing, formatting: time spent, nothing new arrived
       — an undo brings back what was already counted once */
    if (!grew || e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { tick(now); return; }
    if (!e.isTrusted) { add('auto', grew, now); return; }
    switch (e.inputType) {
      case 'insertFromPaste':
      case 'insertFromYank': {
        /* the student's own words coming back into the field they were cut
           from are moved, not pasted */
        const moved = !!lastCut && (e.data ?? '') === lastCut;
        add(moved ? 'typed' : 'pasted', grew, now);
        return;
      }
      case 'insertFromDrop': {
        /* dropped back what a drag just took out of this same field */
        const moved = dragged > 0 && Math.abs(grew - dragged) <= 1;
        dragged = 0;
        add(moved ? 'typed' : 'pasted', grew, now);
        return;
      }
      case 'insertReplacementText':
        /* a spelling correction or an autocorrect: the student's own word,
           mended */
        add('typed', grew, now);
        return;
      default:
        /* insertText and the line breaks: a keystroke, a predictive word, an
           input method that commits without composing — all typed, unless a
           whole passage landed at once with nothing behind it */
        add(grew >= BURST && !keyed() ? 'auto' : 'typed', grew, now);
    }
  });

  addEventListener('pagehide', flush);
}

/** a day in the reader's own calendar, not UTC's — the file header and the
    file name are local, and a record that said 昨天 for a note written at
    one in the morning would contradict both */
const day = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** one line, in the course's language, for the file */
export function describe(t: FieldTrace | undefined, length: number): string {
  if (!t) return length ? '無書寫紀錄' : '';
  const known = t.typed + t.pasted + t.auto;
  const parts = [`鍵盤輸入 ${t.typed} 字`];
  if (t.pasted) {
    const n = t.pastes ?? 1;
    parts.push(n > 1 ? `貼上 ${t.pasted} 字（${n} 次，最大一次 ${t.biggest ?? t.pasted} 字）` : `貼上 ${t.pasted} 字（1 次）`);
  } else parts.push('貼上 0 字');
  if (t.auto) parts.push(`其他輸入 ${t.auto} 字`);
  if (length > known * 1.15 + 20) parts.push(`另有 ${length - known} 字無書寫紀錄`);
  const mins = Math.round(t.active / 60);
  const span = t.first && t.last
    ? (day(t.first) === day(t.last) ? `（${day(t.first)}）` : `（${day(t.first)} ～ ${day(t.last)}）`)
    : '';
  parts.push(`${t.edits} 次編輯，${mins < 1 ? '共不到 1 分鐘' : `共 ${mins} 分鐘`}${span}`);
  if (t.restored) parts.push(`自備份還原（${day(t.restored)}）`);
  return parts.join(' · ');
}

/** what the record's words mean, printed once at the head of the file so a
    reader does not have to guess — and does not read more into it than it says */
export const LEGEND = [
  '書寫紀錄說明：「鍵盤輸入」為逐字鍵入或由輸入法組字；「貼上」為自其他文件貼入，可能是同學在別處起草的自己的文字；',
  '「其他輸入」為一次到位的整段文字，如語音、手寫板、自動化工具或程式；「編輯」為相隔十分鐘以上的次數；「分鐘」只計欄位有變動的時間，',
  '停頓超過一分鐘不計，故為下限；「自備份還原」表示該筆紀錄曾經由備份檔還原（換電腦或換瀏覽器時的正常情形）。紀錄自 2026-09-21 起留存，',
  '之前所寫的內容標為「無書寫紀錄」。任一項單獨皆不足以斷定內容是否出自 AI。',
].join('\n');
