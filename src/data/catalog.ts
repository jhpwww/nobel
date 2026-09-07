import raw from './lectures.json';
import type { Lang } from '../i18n/ui';

/** The six Nobel prize categories. */
export type CategoryKey = 'physics' | 'chemistry' | 'medicine' | 'literature' | 'peace' | 'economics';
/** Every gallery the museum has, including the introduction room. */
export type GalleryKey = CategoryKey | 'nobel';
/** The introduction room — not a prize category; the hall shows it on its own. */
export const INTRO: GalleryKey = 'nobel';

export interface Bilingual { zh: string; en: string }

export interface Lecture {
  id: string;
  no: number;
  /**
   * Which collection this lecture belongs to. `TAIWAN BRIDGES` for the 31;
   * one of the `ntu_series` keys for the 臺大「諾貝爾獎得主講座」 records. The
   * two names below are what a page prints — they are only present on the
   * second collection, because the first has never needed to say which series
   * it is: it is the museum's main axis and every page is already about it.
   */
  series: string;
  series_zh?: string;
  series_en?: string;
  laureate: Bilingual;
  prize: { category: CategoryKey; year: number };
  affiliation: { institution: string; country: string };
  event: { date: string; host_key: string; host_en: string; host_zh: string; city: string };
  title: { en: string; zh: string };
  description: Bilingual;
  hook: Bilingual;
  video: {
    lecture: string | null;
    lecture_ntu: string | null;
    guide: string | null;
    extra_sessions: { id: string; label: string }[];
  };
  interviews: { source: string; source_en: string; source_zh: string; id: string }[];
  links: {
    nobel_facts: string;
    nobel_lecture: string;
    /** 天下's programme hub — the Bridges lectures only; nothing else is in it. */
    cw_hub?: string;
    instagram?: string;
    ntu_epaper?: string;
    ntu_spotlight?: string;
    ntu_cge?: string;
    ntu_spe?: string;
  };
  topic_tags: string[];
}

export interface Stat { key: string; value: number; zh: string; en: string }
export interface MaterialLink { url: string; zh: string; en: string; dzh: string; den: string }
export interface CategoryMeta extends Bilingual {
  /**
   * The name the prize itself takes, where that is not the label. Physics is
   * shown as 物理 but the prize is 諾貝爾物理學獎, never 諾貝爾物理獎.
   */
  prize_zh?: string;
  order: number;
  intro: Bilingual;
  history: Bilingual;
  stats: Stat[];
  links: MaterialLink[];
}

export interface StandaloneRecord {
  id: string; source: string; yt: string;
  person_en: string; person_zh: string;
  role_en: string; role_zh: string; date: string;
}

export interface SpecialEvent {
  id: string; kind: string; date: string; yt: string;
  title_en: string; title_zh: string;
  host?: string | null; host_en?: string; host_zh?: string;
  laureate?: string; note_zh?: string;
}

interface Catalog {
  lectures: Lecture[];
  ntu_lectures: Lecture[];
  ntu_series: Record<string, Bilingual>;
  special_events: SpecialEvent[];
  standalone_records: StandaloneRecord[];
  hosts: Record<string, { en: string; zh: string; city: string }>;
  tags: Record<string, Bilingual>;
  categories: Record<CategoryKey, CategoryMeta>;
  prize_facts_asof: string;
  intro: Bilingual & { key: string; parts: { zh: string[]; en: string[] } };
}

export const catalog = raw as unknown as Catalog;

export const lectures = catalog.lectures;
/* ============================================================
   Two collections, one museum
   ============================================================
   `lectures` is 臺灣橋樑計畫 — the 31, in 32 sittings, and every figure the
   museum states about that programme counts these and only these.

   `ntuLectures` is 臺大「諾貝爾獎得主講座」: NTU's own Nobel laureate lectures,
   running from 2019 and continuing alongside the Bridges programme —
   我的學思歷程, 臺大椰林講座, 宋恭源先生頂尖研究講座. They are the same record
   shape, so a lecture page renders one exactly as it renders a Bridges
   lecture, and they carry `series_zh` / `series_en`, which that page prints.

   What they must never do is leak into a Bridges count. `byCategory`,
   `categoryList`, `sittings`, `totalSittings`, `relatedTo`, `nextUpcoming` and
   `recommended` all read `lectures` alone, and that is deliberate: the hall's
   plinths, a room's 「N 場講座」 and the home page's 得主 figure are statements
   about the programme this museum was built around.

   What they SHOULD join is anything that describes the museum's holdings:
   `videoList` (the index of films must list every film it holds, or its own
   total contradicts its grid) and `allLectures`, which is what routes pages.
   ============================================================ */
export const ntuLectures = catalog.ntu_lectures ?? [];
export const ntuSeries = catalog.ntu_series ?? {};

/** Every lecture the museum holds, both collections. Routing reads this. */
export const allLectures = (): Lecture[] => [...lectures, ...ntuLectures];

/** True for a record in the NTU collection rather than 臺灣橋樑計畫. */
export const isNtu = (l: Lecture) => l.series !== 'TAIWAN BRIDGES';

/** The series this record was given in, named, or null for a Bridges lecture. */
export const seriesName = (l: Lecture, lang: Lang) =>
  (lang === 'zh' ? l.series_zh : l.series_en) ?? null;

/** The NTU collection in one prize category, oldest first. */
export const ntuByCategory = (key: GalleryKey) =>
  ntuLectures.filter((l) => l.prize.category === key)
             .sort((a, b) => a.event.date.localeCompare(b.event.date));

export const specialEvents = catalog.special_events;
const standaloneRecords = catalog.standalone_records ?? [];
export const hosts = catalog.hosts;
export const tags = catalog.tags;
export const categories = catalog.categories;
export const intro = catalog.intro;
export const factsAsOf = catalog.prize_facts_asof;

/** [subject, connector, subject] — the connector is rendered smaller. */
export const introParts = (lang: Lang): [string, string, string] =>
  intro.parts[lang] as [string, string, string];

/** Display name of a prize category in the given language. */
export const catName = (key: GalleryKey, lang: Lang) =>
  key === INTRO ? intro[lang] : categories[key as CategoryKey][lang];
/**
 * The same category name in the other language, to sit under the first. The
 * halls and the gallery headings carry both, the way the lecture titles do.
 */
export const catNameAlt = (key: GalleryKey, lang: Lang) =>
  catName(key, lang === 'zh' ? 'en' : 'zh');

/**
 * The category as the prize is named — '{year} 年諾貝爾{category}獎得主' is
 * built from this, not from the label, because the two are not always the same
 * word. Only Chinese distinguishes them so far.
 */
export const catPrizeName = (key: GalleryKey, lang: Lang) =>
  (lang === 'zh' && key !== INTRO && categories[key as CategoryKey].prize_zh)
    || catName(key, lang);

/** Display name of a topic tag in the given language. */
export const tagName = (key: string, lang: Lang) => tags[key]?.[lang] ?? key;

/** Prize categories in museum order, with how many lectures each holds. */
export function categoryList() {
  return (Object.keys(categories) as CategoryKey[])
    .sort((a, b) => categories[a].order - categories[b].order)
    .map((key) => ({
      key,
      order: categories[key].order,
      /* Sittings, not lectures — see 'A lecture, and a sitting' above. Both
         collections, because this is the figure under a plinth and on a room's
         own head, and those two have to say the same thing as the grid. */
      count: byCategory(key).reduce((n, l) => n + sittings(l), 0),
    }));
}

/** Every routable gallery: the six categories plus the introduction room. */
export const galleryKeys = (): GalleryKey[] =>
  [...categoryList().map((c) => c.key), INTRO];

/**
 * Every lecture a prize room holds, oldest first — BOTH collections.
 *
 * At the owner's word: a room's lectures are not limited to 臺灣橋樑計畫. The
 * NTU records are that prize's lectures too, so they stand in the room's own
 * grid with no heading of their own, and the room's 「N 場講座」 counts them.
 * What stays a statement about the programme is the programme's own figure,
 * `totalSittings()`, and the copy on the colophon that tells its story.
 */
export const byCategory = (key: GalleryKey) =>
  [...lectures, ...ntuLectures]
    .filter((l) => l.prize.category === key)
    .sort((a, b) => a.event.date.localeCompare(b.event.date));

const byDateAsc  = () => [...lectures].sort((a, b) => a.event.date.localeCompare(b.event.date));
export const byDateDesc = () => [...lectures].sort((a, b) => b.event.date.localeCompare(a.event.date));

/* ============================================================
   A lecture, and a sitting
   ============================================================
   Thirty-one laureates gave thirty-one lectures, and one of those lectures was
   given twice: Südhof spoke at 亞洲大學 on the 5th of January and again on the
   6th. Two sittings, two recordings, two things a visitor can watch — so
   anywhere the museum says 場講座 it counts sittings, and that is 32.

   What it is NOT is a second upload of the same sitting. If one ever arrives
   it belongs in `interviews`, not here — `extra_sessions` means what its name
   says.

   The laureate count stays 31. Südhof is one person however many times he
   spoke.
   ============================================================ */

/** how many times this lecture was actually given */
export const sittings = (l: Lecture) => 1 + l.video.extra_sessions.length;

/**
 * Every sitting of 臺灣橋樑計畫: 32. A statement about the programme, so it
 * counts `lectures` alone and does not move when the museum acquires
 * anything else.
 */
export const totalSittings = () => lectures.reduce((n, l) => n + sittings(l), 0);

/**
 * Every lecture FILM the museum holds — both collections, which is what the
 * index of films lists and therefore what any figure standing beside that
 * index has to say. 32 sittings + the NTU collection.
 */
export const lectureFilms = () => videoList().filter((v) => v.kind === 'lecture').length;

/** Every video this lecture offers, for the "n videos" badge. */
export function videoCount(l: Lecture) {
  return (l.video.lecture ? 1 : 0) + (l.video.guide ? 1 : 0) +
         (l.video.lecture_ntu ? 1 : 0) + l.interviews.length + l.video.extra_sessions.length;
}

/** Onward viewing: same prize category first, then shared topics. */
export function relatedTo(l: Lecture, n = 3) {
  /* A record looks for company inside its own collection. Mixing them would
     rewrite 「接著看」 on twenty existing laureate pages, because the NTU
     records predate every Bridges lecture and would sort to the head of the
     same-category list. */
  const pool = isNtu(l) ? ntuLectures : lectures;
  const others = pool.filter((x) => x.id !== l.id);
  return [
    ...others.filter((x) => x.prize.category === l.prize.category),
    ...others.filter((x) => x.topic_tags.some((t) => l.topic_tags.includes(t))),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, n);
}

/**
 * The next lecture still to come, or null when the schedule is exhausted.
 *
 * `today` is the BUILD date, not the visitor's — this is a static site. A
 * lecture therefore stops being "upcoming" at the next rebuild after it
 * happens, not at midnight. Rebuild from the Actions tab to refresh it.
 */
export function nextUpcoming(today: string): Lecture | null {
  return byDateAsc().find((l) => l.event.date > today) ?? null;
}

/**
 * What stands in 本館推薦 when nothing is upcoming: a named lecture, named in
 * one place, because a recommendation is a choice somebody makes rather than
 * whatever the catalogue happens to make richest. The home page shows this
 * lecture's 導讀 if it has one — see the facade in HomePage — so naming the
 * lecture names the film.
 *
 * The ranking below is the fallback, for the day this id is retired or
 * mistyped: the slot is on the museum's front page and must never be empty.
 */
const RECOMMENDED = 'strickland';

export function recommended(): Lecture {
  return (
    lectures.find((l) => l.id === RECOMMENDED) ??
    [...lectures].sort((a, b) => {
      const g = Number(!!b.video.guide) - Number(!!a.video.guide);
      return g !== 0 ? g : videoCount(b) - videoCount(a);
    })[0]
  );
}

/* ------------------------------------------------------------------ *
 * Every video the museum holds, as one flat list.
 *
 * Three kinds, which is what the 影片類別 filter switches between:
 *   guide   導讀影片 — the short introduction filmed for each lecture
 *   lecture 講座     — the lecture itself
 *   record  專訪     — the interviews by 天下雜誌 and 風傳媒
 * ------------------------------------------------------------------ */
export type VideoKind = 'guide' | 'lecture' | 'record';

export interface VideoItem {
  key: string;                 // unique within the list
  yt: string;                  // youtube id
  kind: VideoKind;
  lecture: Lecture | null;     // null for records not tied to one laureate
  personZh: string;
  personEn: string;
  category: CategoryKey | null;
  topics: string[];
  date: string;
  /** 天下雜誌 / 風傳媒, for records only */
  sourceZh?: string;
  sourceEn?: string;
  /** what this person is, where the row is not tied to a lecture page */
  roleZh?: string;
  roleEn?: string;
  /** the series this recording was given in, for the NTU collection */
  seriesZh?: string;
  seriesEn?: string;
  /** a second upload of the same lecture, shown as a note */
  altOf?: string;
  /** which sitting this is, where a lecture was given more than once */
  sessionLabel?: string;
}

export function videoList(): VideoItem[] {
  const out: VideoItem[] = [];

  for (const l of byDateAsc()) {
    const base = {
      lecture: l,
      personZh: l.laureate.zh,
      personEn: l.laureate.en,
      category: l.prize.category,
      topics: l.topic_tags,
      date: l.event.date,
    };
    if (l.video.guide) out.push({ key: `${l.id}-guide`, yt: l.video.guide, kind: 'guide', ...base });
    /* One row per SITTING, which is 32: a second day is a second thing to
       watch — see 'A lecture, and a sitting' above. */
    if (l.video.lecture) out.push({ key: `${l.id}-lecture`, yt: l.video.lecture, kind: 'lecture', ...base });
    for (const s of l.video.extra_sessions) {
      out.push({ key: `${l.id}-${s.id}`, yt: s.id, kind: 'lecture', sessionLabel: s.label, ...base });
    }
    for (const iv of l.interviews) {
      out.push({
        key: `${l.id}-${iv.id}`, yt: iv.id, kind: 'record',
        sourceZh: iv.source_zh, sourceEn: iv.source_en, ...base,
      });
    }
  }

  /* The NTU collection, after the programme's own films rather than
     interleaved by date: these are older than every Bridges lecture, and
     sorting them together would put 2019 at the head of the index of films.
     Each row carries its series, which is what the card prints to say which
     collection it came out of. */
  for (const l of [...ntuLectures].sort((a, b) => a.event.date.localeCompare(b.event.date))) {
    if (!l.video.lecture) continue;
    out.push({
      key: `${l.id}-lecture`, yt: l.video.lecture, kind: 'lecture', lecture: l,
      personZh: l.laureate.zh, personEn: l.laureate.en,
      category: l.prize.category, topics: l.topic_tags, date: l.event.date,
      seriesZh: l.series_zh, seriesEn: l.series_en,
    });
  }

  for (const r of standaloneRecords) {
    out.push({
      key: r.id, yt: r.yt, kind: 'record', lecture: null,
      personZh: r.person_zh, personEn: r.person_en,
      category: null, topics: [], date: r.date,
      sourceZh: r.source === 'cw' ? '天下雜誌' : '風傳媒',
      sourceEn: r.source === 'cw' ? 'CommonWealth Magazine' : 'The Storm Media',
      /* the catalogue has carried these two since the record was seeded;
         without them the card had to guess, and guessed one person's job
         title onto everybody */
      roleZh: r.role_zh, roleEn: r.role_en,
    });
  }
  return out;
}

export const videoCounts = () => {
  const v = videoList();
  return {
    all: v.length,
    guide: v.filter((x) => x.kind === 'guide').length,
    lecture: v.filter((x) => x.kind === 'lecture').length,
    record: v.filter((x) => x.kind === 'record').length,
  };
};

export const localDate = (iso: string, lang: Lang, long = false) =>
  new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-GB', {
    year: 'numeric', month: long ? 'long' : 'short', day: 'numeric',
  });


/* ============================================================
   What a mark on a picture is allowed to say
   ============================================================
   A still frame with a label over it is one of two quite different things:

     · The picture PLAYS. Pressing it starts the video. The mark names what
       will play: 導讀影片.
     · The picture GOES somewhere. Pressing it opens a page. The mark names
       what is waiting on that page: 有導讀影片.

   Written as a function rather than fixed at each call site so that the
   next picture anyone adds has to say which kind it is, and gets the right
   word for free.
   ============================================================ */
export type BadgeAction = 'plays' | 'goes';

/** the i18n key for the 'this is / this has a guide video' mark */
export const guideBadgeKey = (action: BadgeAction) =>
  action === 'plays' ? 'lec.guide' : 'lec.guideHas';


/* ============================================================
   The prize itself, for any room that wants to point at it
   ============================================================
   One list, in one place, for every room that ends by pointing outward: the
   introduction room and the index of films both read it.
   ============================================================ */
export const generalLinks = [
  { url: 'https://www.nobelprize.org/alfred-nobel/',
    zh: '諾貝爾其人', en: 'Alfred Nobel, the man',
    dzh: '炸藥的發明者，與他留下的遺囑。', den: 'The inventor of dynamite, and the will he left behind.' },
  { url: 'https://www.nobelprize.org/prizes/facts/nobel-prize-facts/',
    zh: '諾貝爾獎小知識', en: 'Nobel Prize facts',
    dzh: '最年輕、最年長、得過 2 次的人：官方統計。', den: 'Youngest, oldest, twice-awarded: the official numbers.' },
  { url: 'https://www.nobelprize.org/the-nobel-prize-organisation/',
    zh: '獎項如何評選', en: 'How the prizes are decided',
    dzh: '提名、審議、保密 50 年的評選過程。', den: 'Nomination, deliberation, and 50 years of secrecy.' },
  { url: 'https://www.nobelprize.org/educational/',
    zh: '諾貝爾教育資源', en: 'Nobel Prize education',
    dzh: '官方為學生製作的互動教材與遊戲（英文）。', den: 'Interactive teaching material and games from the official site.' },
];
