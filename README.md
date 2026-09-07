# 諾貝爾講座博物館 · Nobel Lecture Museum

A web-based virtual museum for the Nobel laureate lectures delivered in Taiwan under the
**臺灣橋樑計畫 (Taiwan Bridges Program)** — the lectures themselves, their 導讀影片, and the
interviews recorded alongside them.

Audience: high-school students, undergraduates, and the general public. Not specialists.

**Live site:** https://jhpwww.github.io/nobel/
**The dark museum it grew from:** https://jhpwww.github.io/taiwan-nobel-museum/

---

## What is here

| | |
|---|---|
| 31 lectures | Given in 32 sittings — Südhof's was delivered twice. Nov 2025 – May 2026, 31 Nobel laureates, 12 host institutions |
| 導讀影片 | 6 published so far; the schema carries all 31 as they are released |
| 專訪 | 25 — 天下雜誌 CommonWealth Magazine and 風傳媒 The Storm Media |
| Special events | Launch ceremony, two 北一女中 outreach lectures, a laureate panel, the 對話諾貝爾特展 |
| 63 videos | what `/lectures/` lists: 導讀 6 · 講座 32 · 專訪 25 |

Prize categories, in museum order: Physics 9 · Chemistry 8 · Medicine 7 · Peace 2 ·
Economics 5 · Literature 0. Those are lecture counts; each room prints **sittings**, so
Medicine shows 8.

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
page, and a fixed band at the top dissolves each page into it.

**Motion is a visitor preference, not just an OS one.** `prefers-reduced-motion` is honoured by
default, but on Windows turning off "Animation effects" — which people do for performance — sets
it system-wide and silently kills every effect here. So a toggle appears in the hall whenever
motion is off, the choice is stored per browser, and `data-motion` on `<html>` is set before
first paint. Everything, CSS and JS alike, asks `motionOn()` in `src/scripts/motion.ts`; nothing
gates on the media query alone.

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

A build produces 92 HTML pages.

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

One NTU course, 走進諾貝爾 (LibEdu1140), is built around this collection. It appears as a
subordinate aside at the foot of `/learn/` and as short parenthetical notes in the tools. **Keep
it subordinate**: the museum is not a course tool, and a visitor who is not enrolled should never
feel they have wandered into someone's classroom.

## Browsing

`/lectures/` lists every video the museum holds — 63 of them — with a search box and three
independent filter groups: **影片類別** (導讀 6 · 講座 32 · 專訪 25), **獎項類別**, and **主題**.
Filter state lives in the URL, so a filtered view can be shared and survives a reload.

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
