# 諾貝爾講座博物館 · Nobel Lecture Museum

A web-based virtual museum for Nobel laureate lectures delivered in Taiwan. It holds two
collections. The first and the main axis is **臺灣橋樑計畫 (Taiwan Bridges Program)** — the
lectures themselves, their 導讀影片, and the interviews recorded alongside them. The second is
**臺大「諾貝爾獎得主講座」**, NTU's own Nobel laureate lectures, running since 2019 and
continuing alongside the programme.

The two are never mixed. Every figure the museum states about the Bridges programme — 31
lectures, 32 sittings — counts the first collection alone; the figures that describe the
museum's holdings, on the front page and beside the index of films, count both.

Audience: high-school students, undergraduates, and the general public. Not specialists.

**Live site:** https://jhpwww.github.io/nobel/
**The dark museum it grew from:** https://jhpwww.github.io/taiwan-nobel-museum/

---

## What is here

| | |
|---|---|
| 31 lectures | Given in 32 sittings — Südhof's was delivered twice. Nov 2025 – May 2026, 31 Nobel laureates, 12 host institutions |
| 導讀影片 | 12 published so far (six more went up on 臺大演講網 on 2026-09-16); the schema carries all 31 as they are released |
| 專訪 | 25 — 天下雜誌 CommonWealth Magazine and 風傳媒 The Storm Media |
| Special events | Launch ceremony, two 北一女中 outreach lectures, a laureate panel, the 對話諾貝爾特展 |
| 臺大「諾貝爾獎得主講座」 | 8 recordings, 5 laureates, 2019–2025, all at NTU: 我的學思歷程 (Mourou, Stoddart), 臺大椰林講座 (Ciechanover), 宋恭源先生頂尖研究講座 (Aspect ×2, Robinson), and two SPE class lectures (Robinson) |
| 77 videos | what `/lectures/` lists: 導讀 12 · 講座 40 · 專訪 25 |

Prize categories, in museum order, as the plinths and the room headings print them —
**sittings** across both collections: Physics 12 · Chemistry 10 · Medicine 8 · Peace 2 ·
Economics 8 · Literature 0. A prize room's lectures are not limited to the Bridges
programme, at the owner's word: the NTU records stand in the room's own grid with no
heading of their own. Medicine shows 8 against 7 lectures because Südhof's was given twice.

Three places print that figure — the plinth's label, the plinth's caption and the search
drawer's room rows — and all three read `categoryList()`. Do not count it again locally;
each of the three did once, and each drifted.

The great hall shows all six prize categories. Literature has a plinth like the others but
stands at the far right, since this series brought no Literature laureate — its room is built
and says so rather than showing a bare zero. **諾貝爾與諾貝爾獎** — the room about Alfred Nobel
and how the prizes are decided — is not a prize category, so it sits below the plinths as its
own marked entrance (關於這座獎 / About the prize), with the medal as its emblem.

Every gallery opens with more than video: what the prize recognises, a short history, five
counted statistics, and the 延伸探索 rail down the right — five official Nobel pages per
category plus two series links, each an outbound button with its description beside it in
plain text. The statistics come from the official Nobel API via
`scripts/fetch-prize-facts.py` and are stamped with the date they were fetched — re-run it
once a year after the October announcements.

## Two museums, two repositories

This repository is the **bright museum**: white ground, red for anything actionable, gold for
what the museum owns, and one hall of its own. It began inside
[jhpwww/taiwan-nobel-museum](https://github.com/jhpwww/taiwan-nobel-museum) as the same site
built a second time in daylight and published under `/bright/`; on 2026-09-07 it moved here
and to https://jhpwww.github.io/nobel/, and the old `/bright/` addresses redirect to it.

The **dark museum** — the original — is preserved as it was, in that repository and at
https://jhpwww.github.io/taiwan-nobel-museum/. Nothing here changes it.

Same routes, same data, same components. `src/theme.ts` exports `bright`, true unless
`THEME=dark`; `Base.astro` then emits `data-theme="bright"`, and `src/styles/bright.css` is
scoped entirely to that attribute. A `THEME=dark` build still renders the dark museum from this
tree, for comparison only.

## The hall

The entrance is one hall, `HallBright.astro`: a domed neoclassical rotunda — white marble, a
glazed dome, a ring of arched windows — with the six prize sculptures set out on its floor in
gold, each a real glTF piece in its own `<model-viewer>`. The room is a photograph, and what
stands in it is placed in per cent of a plate that carries the picture's own aspect ratio, so
a crop moves the picture and its contents together; the eye level is measured at 69.2% of the
plate (`scripts/crop-hall.py`). No embers, no dust, no video wall: the light in this room is
the photograph's own.

Every page below the hall stands in the same room — `RoomBack.astro` paints it behind the
page, and a fixed band at the top dissolves each page into it. A room's own head is the one
thing that never dissolves: emblem, title, the three words it is read by and the sentence
under them stand over the band rather than under it, with the logo a step above the head.
Below that there are two treatments and only two: a block of text stands on a frame of its own
(62% white and a 9px blur), and the headings between those frames carry a white shadow tight to
the letterform. The photograph itself is never washed — the only thing that fades it is its own
gradient at the foot.

Three standing controls sit in the lower right (top, back, forward), the way on at the foot of
the window travels one screen per press, and the key in the bar for the room you are in is
marked in red, so a page scrolled a long way still says where you are.

**Motion is a visitor preference, not just an OS one.** `prefers-reduced-motion` is honoured by
default, but on Windows turning off "Animation effects" — which people do for performance — sets
it system-wide and silently kills every effect here. So a toggle appears in the hall whenever
motion is off, the choice is stored per browser, and `data-motion` on `<html>` is set before
first paint. Everything, CSS and JS alike, asks `motionOn()` in `src/scripts/motion.ts`; nothing
gates on the media query alone. A journey asks a different question — the way on and the key
that returns to the top glide unless the visitor's own toggle says otherwise, because the
movement between here and there is what tells a reader the page moved rather than that another
page arrived.

The dark museum's four halls — flat SVG (`Hall.astro`), CSS 3D room (`Hall3D.astro`), WebGL
rotunda (`HallGL.astro`), glTF objects (`HallModels.astro`) — are still in this tree, and the
routes `/room/`, `/rotunda/` and `/models/` still build; in this museum every one of them
opens on the bright hall. Their backdrop (`LectureScreen.astro`, `AmbientVideo.astro`) is
likewise here and on no bright page; the clip pipeline behind it (`scripts/make-backdrop-clips.py`,
`src/data/backdrop.json`) is kept for whatever replaces the apse's video wall.

## Stack

Astro 5 + TypeScript, no UI framework, no runtime database, no CMS, no login.
Plain CSS with custom properties. Deployed to GitHub Pages by GitHub Actions.

JavaScript is kept small and local: the shared modules in `src/scripts/` (env, motion, plinth,
roomfade, rotunda, study, walkin) come to a few KB gzipped on an ordinary page. The one heavy
payload is the vendored model-viewer (~287 KB gz), imported on demand by the hall for its six
gold pieces; the dark museum's three.js rotunda is in the tree but on no bright page. Videos
are embedded from `youtube-nocookie.com` and load nothing until clicked.

Fonts are self-hosted and subset to the site's own text, so no third party sits in the request
path of a visit.

## Running it

```bash
npm install
npm run dev        # http://localhost:4322/nobel/  (port 4322 leaves 4321 to the dark museum's checkout)
npm run build      # -> dist/, base path /nobel/
npm run check      # astro check

THEME=dark npm run build   # the dark museum from this tree, for comparison only
```

A build produces 108 HTML pages, plus `search/zh.json` and `search/en.json`.

Node 20+ required. **On WSL, keep this repo in the Linux filesystem** (`~/…`), not under
`/mnt/c/…` — npm on the Windows mount is roughly 50× slower and will appear to hang.

## Content backend

`src/data/lectures.json` is the source of truth today. It is **generated** — never hand-edit
it — from verified facts plus editorial copy:

```
data/catalog.json (scripts/seed-catalog.py)  ┐
scripts/copy-zh-en.py                        ├─ npm run content ─> src/data/lectures.json ─> build
scripts/copy-galleries.py + prize-facts.json ┘
```

**To add or edit a lecture:** edit `scripts/copy-zh-en.py` (copy) or `data/catalog.json` via
`scripts/seed-catalog.py` (facts), run `npm run content`, and commit. Pushing to `main` deploys.
There is no schedule — nothing publishes until someone decides to publish it.

A published Google Sheet is wired up as the eventual backend but **has never been switched on**:

```
Google Sheet ──(publish tab as CSV)──> SHEET_CSV_URL ──> scripts/sync-sheet.mjs ──> src/data/lectures.json
```

- Set `SHEET_CSV_URL` under **Settings → Secrets and variables → Actions → Variables**. While
  it is unset, `sync-sheet.mjs` exits without writing and the build uses the committed
  catalogue, so a fresh clone always works.
- `scripts/sync-sheet.mjs` validates every row and **fails the build** on a malformed field
  rather than shipping partial content. A row with `status` set to anything other than
  `published` is skipped.
- **Before turning the Sheet on, close one gap:** the round-trip drops `links.nobel_lecture`.
  Neither `export-sheet-csv.py`'s `COLUMNS` nor `sync-sheet.mjs`'s `links` object carries it,
  so the first real sync would strip a required field that two components render. Add it to
  both, or have `sync-sheet.mjs` carry it forward from `prev` the way it already does for
  `cw_hub`.
- `data/prize-facts.json` holds the per-category statistics; regenerate with
  `python3 scripts/fetch-prize-facts.py`.
- `data/sheet-seed.csv` is the CSV to import when first creating the Sheet;
  regenerate with `npm run sheet`.

> Publish only a dedicated tab holding publishable columns. The internal production sheet
> carries staff names, phone numbers and email addresses; those must never reach the site.

## Where the data came from

Everything in `data/catalog.json` is traceable. See the header of `scripts/seed-catalog.py`.

- Schedule — the IPF 導讀拍攝進度 programme sheet
- Lecture videos — the International Peace Foundation channel
- 導讀影片 and the NTU uploads — 臺大演講網
- Per-lecture NTU material — https://cge.ntu.edu.tw/cl_n_203079.html
- Nobel citations — nobelprize.org, two per lecture: `nobel_facts` (the prize page) and
  `nobel_lecture` (the Stockholm lecture page)

## Representative images

Each lecture and each video shows a frame of the **laureate**, taken from the **Taiwan lecture**
recording. 導讀 films are left with whatever frame YouTube gives them.

`scripts/pick-posters.py` scores the four frames YouTube publishes per video, matching every
face against the laureate's official portrait with SFace at the model's own threshold — face
detection alone finds the banner behind the stage, a portrait in a slide, someone in the third
row. Where none of the four holds the laureate, `scripts/cut-poster-frames.py` goes into the
recording itself and writes a single still under `public/assets/posters/` (17 today).
`src/data/stills.ts` resolves the three sources in order.

## The learning area

`/learn/` is a **museum** feature, not a course site: how to get something out of a lecture,
a place to keep notes, and the two-version comparison. Every lecture page carries a notes panel
(save the lecture, mark each version watched, write 摘要 / 反思 / 延伸問題, draft a question) and
the record section at `/learn/#record` aggregates it with export, backup and restore. No account
and no server — it all lives in `localStorage`, and the page says so. (`/study/` is a redirect
stub kept so older links still arrive.)

**Export** (匯出繳交) makes one plain-text file: the student's number and name (typed once, kept
in the browser, editable any time), the saved lectures they tick, the stages (準備 / 參與 / 反思)
they tick, named `走進諾貝爾_學號_姓名_YYYYMMDD-HHMM.txt`. Where the browser can ask
(Chrome / Edge on desktop) the student chooses where to save it; elsewhere (Firefox, Safari,
every phone) it goes to the downloads folder and the line under the key says so.

**What the file records, and what that is worth.** Under every field the file prints how it
was written — `src/scripts/trace.ts` counts characters that arrived a few at a time (keyboard,
input method, predictive word, spelling fix, a sentence moved within the field), by paste (with
the number of pastes and the largest), and in one trusted burst of forty or more with no key and
no composition behind it (an automation tool's `insertText`, a script — but also dictation and
handwriting panels), plus sittings and active minutes; the file opens with a legend saying
exactly that, and ends with a SHA-256 check code over everything above it. Read it as context,
not as evidence:

- 貼上 800 字 in one sitting is what pasting ChatGPT looks like — and also what pasting one's own
  Word draft looks like. Nothing in the record tells them apart.
- The record catches the careless path only. A tool that owns the browser can type one
  character at a time with key events, pace itself, and shift the clock; the file then reads
  like a person's. A student can retype what a machine wrote.
- The download key refuses an untrusted event or a browser that declares `navigator.webdriver`,
  and on Chrome/Edge the save-as dialog is native, so a page-driving agent cannot finish the
  export itself — it hands the last click back to the student. An agent driving Chrome through
  `chrome.debugger` sets no `webdriver` flag, and on browsers without the dialog the plain
  download is automatable. The one thing that reliably deters an LLM agent is the visible
  request on the page (`study.policy`), which is also in the accessibility tree of every field
  and of the key; keep it.
- The check code is a transport check — it catches a file edited or truncated after export
  until someone recomputes it, and the recipe is printed in the file. It says nothing about
  authorship. Reproduce it on any system with
  `sed '/^═══ 核對 ═══$/,$d' file.txt | shasum -a 256` (GNU: `sha256sum`).
- Records restored from a backup file are re-validated and stamped 自備份還原 in the file, and a
  backup made before there was a record (a bare map of notes) restores with no record; notes
  written before 2026-09-21 print 無書寫紀錄. The preview textarea holds the same text the file
  will, minus the check code.

The tracing is disclosed on the page, on the panel where the writing happens
(`study.panelPolicy`) and above the download key (`study.policy`).

### Handing in without a file to edit: 繳交給課程

Everything above is made in the browser, so everything above is the student's to edit before
it is handed in — the record lines included. No code on a static page can prevent that. What
closes the *quiet* edit is a copy the course takes at the moment of export, and that needs one
small piece the course runs itself: `apps-script/submit.gs`, a Google Apps Script bound to a
Sheet the course owns. Once it is deployed and its URL is set as the `PUBLIC_SUBMIT_URL`
repository variable, the export block grows a **繳交給課程** key (and 下載 steps back to a plain
key):

1. The student chooses where to save, as with 下載 (asked first, while the press is fresh).
2. The same file is POSTed to the script, which stamps it with the server's clock, signs the
   whole text with a secret only the script holds (HMAC‑SHA256, first 16 hex = the **收據**),
   appends a row to the `submissions` tab (time, 學號, 姓名, 核對碼, 收據, length, Drive link or
   text) and keeps the full text in Drive when a `FOLDER_ID` is set. The 核對碼 column is the
   SHA‑256 of the text above the file's own 核對 line — the same figure the file prints.
3. The student's copy is written with a 繳交 block at its foot carrying the receipt. If no
   receipt comes back — no connection, a timeout, an odd answer — the unsigned copy is still
   written and the student is told to treat it as not handed in and press again later. (The
   page cannot know whether the row was written before the answer was lost; a second press
   then makes a second row, which is harmless: rows are read side by side.)

**What a row proves, and what it does not.** It proves that *this exact text* reached the
course at *that time* and has not changed since. It does not prove how the text was made or
who sent it: the script cannot tell the page's own send from a hand-made one — a student who
edits an export and re-posts it with `curl` (the URL is in the page) gets a row and a receipt
like anyone else's — and a student number typed in is a claim, not a login. What the channel
removes is the edit nobody sees: the file the course grades is the one it received, not the
one handed over later. Rules that follow from this, for the course: the Drive copy (or the
sheet cell) is the submission and a `.txt` need not be asked for; when one 學號 has several
rows, read them side by side and let the receipt printed in the student's copy name theirs;
read the sheet against the roster. Closing the remaining door — a forged record posted from
outside the page, or forged in the browser's storage before export — would take a log of
writing activity sent to the course *as it happens*, so that a record with sittings the course
never saw stands out; that is a different promise to students about where their work goes, and
it is not built.

Setup is written at the head of `apps-script/submit.gs` (five minutes: new Sheet → Apps
Script → paste → run `setup` → Deploy as web app, anyone → check the URL answers
`configured: true` → set the variable → press the key once yourself). Until the variable exists
the site sends nothing anywhere and the privacy line stands as written; when it exists, the note
panel's privacy line names the one press that is the exception, and where it goes (a Google
Sheet the course owns). To try it locally, put `PUBLIC_SUBMIT_URL=…` in `.env` before
`npm run dev` or `npm run build`.

## Browsing

`/lectures/` lists every video the museum holds — 77 of them, both collections — with a search
box and three independent filter groups: **影片類別** (導讀 12 · 講座 40 · 專訪 25),
**獎項類別**, and **主題**. A card out of the NTU collection prints its series beside its date;
the filters sort by kind, not by collection, because these are all 講座.
Filter state lives in the URL, so a filtered view can be shared and survives a reload — and
survives the language switch: the flag in the bar carries the page's query and hash across.

## Searching

The 搜尋 key in the bar opens one drawer that searches the whole museum, in two layers:

1. **What the museum holds** — laureates, rooms, the museum's own pages — is a small index
   built into the page (`SiteSearch.astro`), so the first keystroke needs no fetch.
2. **What the pages say** — every sentence of every page — is `dist/search/{zh,en}.json`,
   written at build time by `integrations/search.mjs` from the built HTML
   (`scripts/search-index.mjs` does the cutting: one section per heading, boilerplate that
   repeats under four or more page titles left out, anything under `data-search-skip` left out). The
   drawer fetches the file for its language the first time it opens (about 45 KB each, less
   over the wire). A hit
   shows the sentence the word is in and opens the page on that sentence, by a text fragment
   in the URL, with the section's own anchor before it as the fallback.

Matching folds case, width, accents and the museum's name separator, so `sudhof` finds Südhof
and 科比爾卡 finds 布萊恩‧科比爾卡. On the dev server the same address is answered by a crawl
of the museum through the dev server itself (first ask a second or two, cached until a source file
changes). Rebuild the index from an existing `dist/` with `node scripts/search-index.mjs dist`;
`SHOW_DROPPED=1` prints what the boilerplate net caught.

## Checking links

```bash
python3 scripts/check-links.py dist
```

Audits four kinds of reference, because each fails differently, and exits non-zero if anything
needs attention:

| | |
|---|---|
| internal | resolved against the build — the target file must exist. Stylesheet `href`s land here too |
| assets | `src`, `data-src` and `poster` attributes: images, scripts, the ambient video, the poster frames |
| youtube | the ids actually embedded — these live in `data-yt` and iframe srcs, **not** in `href` |
| external | a real GET, following redirects, printing the destination title so a wrong-but-200 target is visible |

Note what it does **not** cover: a video being public is not the same as it being embeddable.
The script calls oEmbed only, so the embed endpoint is a manual check for every new id.

## Editorial copy

`scripts/copy-zh-en.py` holds the hook and summary for every lecture in both languages.
It is plain reviewable text — rewrite it freely, then:

```bash
npm run content    # merge copy + facts -> src/data/lectures.json
npm run sheet      # regenerate data/sheet-seed.csv
```

The 導讀 narration scripts were used as background reference only. They are not site content.

## Rights

Playback is always YouTube's: every video is embedded and remains the copyright of its original
publisher. Nothing here re-cuts, re-hosts or redistributes a recording. The one exception is the
session stills — where none of the frames YouTube publishes holds the laureate, a single frame
is taken from the recording, used only to identify that session, its copyright still its
publisher's. The About page says so in both languages, and anything added to the site must stay
inside what that note describes.

Nobel Foundation text and images are linked, never copied. "Nobel Prize" and the medal are
trademarks of the Nobel Foundation; this is an independent educational project, not affiliated
with or endorsed by it.

The six award sculptures are the copyright of 吳俊輝 (Jiun-Huei Proty Wu).
