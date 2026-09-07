# CLAUDE.md

Conventions for this repository — the bright museum, at https://jhpwww.github.io/nobel/.
Read `README.md` first for what the project is.

Everything here is a standing rule or a trap that has already cost a rebuild.
Keep it that way: add a rule, not an account of the work that produced it.

## Stack

Astro 5 + TypeScript, plain CSS, no UI framework. Fully static: no server, no serverless
function, no database, no login. If a task seems to need one, stop and say so.

## The owner's standing requests

These are decided. Do not reopen them, and do not let a tidy-up quietly reverse one.

- **The museum's name and its main axis do not change.**
- **The dark museum is preserved as it is**, in `jhpwww/taiwan-nobel-museum` at
  https://jhpwww.github.io/taiwan-nobel-museum/. This repository is the bright museum alone;
  nothing here touches the dark site. Its ~56 text styles below AA are deliberate and stay.
- **The 導讀 narration scripts are reference material only.** Their text must never
  appear on the site.
- **Representative images are chosen for 講座 and 專訪 only.** A 導讀 keeps the frame
  YouTube gives it; both poster scripts skip guide videos on purpose.
- **A number inside a design kit the owner supplied is already decided.** When feedback
  touches one, build the comparison and send it first — the choice is theirs to make
  while looking at it. The button kit's frame widths are not to be changed again.
- **Do not darken the block red.** See "The bright palette's one known exception".
- **Every change ships to the running dev server (`npm run dev`, port 4322, at
  `/nobel/`) and to GitHub Pages in the same turn**,
  and is reported with three readings, not a claim: a clean `git status`,
  `git rev-list --left-right --count origin/main...HEAD` at 0/0, and the Pages run green
  on that SHA.
- **Install whatever the work needs and finish it.** Do not stop mid-task to ask.

## Layout

```
data/
  catalog.json          verified facts, produced by scripts/seed-catalog.py
  prize-facts.json      per-category statistics, from the official Nobel API
  model-credits.json    provenance for the six sculptures; merged, never overwritten
  sheet-seed.csv        the CSV to import when creating the Google Sheet
scripts/                ~29 of them; these are the ones you will touch
  seed-catalog.py       hand-verified source data -> data/catalog.json
  copy-zh-en.py         editorial hook + summary for all 31, both languages
  copy-galleries.py     per-category prose
  build-catalog.py      catalog.json + copy -> src/data/lectures.json   (npm run content)
  export-sheet-csv.py   src/data/lectures.json -> data/sheet-seed.csv   (npm run sheet)
  sync-sheet.mjs        published Google Sheet -> src/data/lectures.json (CI, dormant)
  pick-posters.py       -> src/data/posters.json + video-posters.json
  cut-poster-frames.py  -> public/assets/posters/ + src/data/local-posters.json
  facecheck.py          shared portrait/detector/threshold module for both of those
  make-backdrop-clips.py-> public/media/backdrop/ + src/data/backdrop.json
  normalise-models.mjs  the model pipeline's centre; writes both tinted and gold sets
  subset-fonts.mjs      this museum's faces (`--theme dark` re-cuts the dark set)
  check-links.py        four kinds of reference, over dist/
  check-contrast.mjs / audit-contrast.mjs / audit-type.mjs / check-glass.mjs
  shots.mjs             serve dist/ and screenshot it with Playwright
src/
  data/catalog.ts       the typed accessor — import from here, never from the JSON
  data/lectures.json    generated; do not hand-edit
  data/stills.ts        the single poster resolver (cut still -> verified frame -> hqdefault)
  i18n/ui.ts            every user-facing string
  i18n/routing.ts       every internal URL
  theme.ts              the one place THEME is read: bright unless THEME=dark
  scripts/              env, motion, plinth, roomfade, rotunda, study, walkin
  components/ layouts/ pages/ styles/ vendor/
```

## Rules

**Content**
- `src/data/lectures.json` is generated. Never hand-edit it — fix the upstream source and
  re-run: `scripts/copy-zh-en.py` or `data/catalog.json` today, via `npm run content`;
  the published Google Sheet once it exists.
- Never invent a laureate name, date, video id, or URL. A missing field renders as absent,
  not as a plausible guess. `sync-sheet.mjs` fails the build on a malformed required field.
- Do not put pronunciation glosses (e.g. `Sudhof (酥豆腐)`) anywhere near a page.

**Language**
- In Chinese copy, gloss every proper noun and technical term with its original on first use:
  人名（Ragnar Frisch）, 機構（Sveriges Riksbank）, 學術用語（click chemistry）. The audience is
  students who will meet these terms in English everywhere else.
- zh-TW is primary, en is secondary, with a switch in the header. Taiwanese usage throughout
  — 軟體, 資訊, 程式. Never mainland variants.
- English lecture titles stay as delivered; the Chinese rendering sits under them in `.gloss`.
  Laureate names follow the same rule: English is primary, the Chinese name is the gloss
  beneath it. Set names in `--font-display`, not `--font-han-serif`, or the `:lang(zh) h1`
  rule will render Latin text in the CJK serif.
- No hardcoded user-facing strings in components. Everything goes through `src/i18n/ui.ts`.

**Links and routing**
- Every internal URL comes from `src/i18n/routing.ts`. Never hardcode a leading `/` — this is
  a project site served from `/<repo>/` and `base` must be respected.
- Every EXTERNAL link goes through `ExtLink.astro`, or carries the same three things it does:
  `target="_blank"`, `rel="noopener noreferrer"`, and a visually-hidden "opens in a new tab".
  Audit with a grep over `dist/` for external `<a>` without `target="_blank"` — it should
  return zero.

**Home page**
- The announcement slot is never empty: `nextUpcoming()` if the schedule still has a future
  lecture, otherwise `recommended()`. "Today" is the BUILD date, so a lecture stops being
  upcoming at the next rebuild, not at midnight. An upcoming lecture may have no video yet —
  that branch must keep working.
- `recommended()` is a named choice, `RECOMMENDED` in `src/data/catalog.ts`, currently
  `strickland`. The old ranking stays underneath as the fallback so the slot cannot go empty
  if the id is retired or mistyped. Naming the lecture names the film: the home page shows
  that lecture's 導讀.

**The halls**
- Four variants share one `HomePage.astro` via a `style` prop: `flat` (SVG, `Hall.astro`),
  `room` (CSS 3D, `Hall3D.astro`), `gl` (WebGL, `HallGL.astro`), `models` (glTF via
  `<model-viewer>`, `HallModels.astro`). A fifth, `HallBright.astro`, is not a `style` value —
  it is selected by `bright` from `src/theme.ts` and overrides the prop, so in this museum all
  four routes open on the bright hall. Only the hall differs; never fork the pages below it.
- `Sculpture3D.astro` EXTRUDES `Sculpture.astro` — it stacks the same SVG along Z and darkens
  the back slices. Do not rebuild the forms from CSS primitives.
- The ROTUNDA's WebGL scene (`src/scripts/rotunda.ts`) is procedural on purpose: no model or
  texture files, so its only payload is three.js. Keep it that way. DPR is capped at 1.6,
  there are no shadow maps (contact shadows are painted planes), and the loop must stop on
  IntersectionObserver and visibilitychange. The objects hall is the deliberate exception:
  real glTF drawn by the vendored `model-viewer` (`vendor/model-viewer.min.js`), not three.js.
- Anything drawn on the canvas is decoration. Every link must exist in the markup underneath.
- NEVER gate an animation on `@media (prefers-reduced-motion: reduce)` or on
  `matchMedia(...).matches` alone. Ask `motionOn()` (`src/scripts/motion.ts`) in JS and key CSS
  off `html[data-motion='off']`, which is set before first paint and which the visitor's own
  MotionToggle always wins. The OS switch is system-wide and unoverridable; used raw it leaves
  visitors with a completely static museum and no way back.
- Over the hall the header is `.topbar--ghost`: fixed, full width, and deliberately
  `pointer-events: none`, with only its nav links and buttons re-enabled. Keep that pair
  intact — give the ghost bar a surface again and it swallows taps across the whole strip it
  covers, 200px tall on a phone, over the first row of sculptures. On ordinary pages the
  topbar is `position: sticky` with a real panel and does take the pointer.
- Camera moves are WALL-CLOCK driven (`performance.now()` against a stored `t0`), never by
  accumulating a clamped per-frame delta. With a clamp, a slow renderer stretches a 1.15 s move
  into tens of seconds and any navigation waiting on its callback never happens.
- Any action that waits on the render loop needs a timeout backstop that runs regardless.
- The adaptive quality ladder in `degrade()` must always draw a frame before it stops; resizing
  clears the buffer, so stopping straight after a resize leaves a black canvas.
- The footer copyright must not wrap on desktop: `.foot__copy` is `white-space: nowrap` with a
  viewport-scaled clamp, and it needs `max-width: none` because the global
  `p { max-width: var(--measure) }` (62ch) otherwise forces a break. It must hold from 320px up.
  Below 48rem it wraps on purpose — one unbroken Han line across a phone is unreadable type.
- `scripts/make-ambient.py` regenerates the background loop, which runs behind the flat, room
  and objects halls (not the rotunda, not the bright hall). Every motion period must divide the
  clip length exactly — that is what makes it seamless without a crossfade. Keep it dark; it
  sits behind text.

**Outbound links**
- Run `python3 scripts/check-links.py dist` after any change touching external URLs. A HEAD
  request is NOT enough — it misses dead DNS and soft 404s.
- Verify every link that gets added, not a sample — the SHARED urls as well as the
  per-category ones.
- The YouTube ids are NOT in `href` — they sit in `data-yt`, iframe srcs and `data-picks`. Any
  link audit that only reads `href` misses every video on the site.
- oEmbed 200 proves a video is public, not that it is embeddable — and `check-links.py` only
  calls oEmbed. The embed endpoint is a manual check the script does not cover: do it by hand
  for every new id, or add it to `oembed()`.

**Framing**
- This site is a MUSEUM. Its name, its home page and its navigation are the museum's.
- The learning tools are museum features that happen to suit a course. Course-specific framing
  must stay subordinate: an aside at the foot of `/learn/`, or a parenthetical note — never a
  page title, never a nav item, never the first thing on a lecture page. A visitor who is not
  taking the course must not feel they have wandered into a classroom.

**Media and rights**
- The hall backdrop is lecture imagery via `LectureScreen.astro`, never a stock loop and never
  a live embed. A cross-origin YouTube iframe CANNOT be read into a WebGL texture — that is why
  the rotunda cycles published frames instead. Do not try to sample the player.
- Playback is always YouTube's, via `youtube-nocookie.com`, behind the click-to-load facade.
  Never re-host, re-cut, proxy or redistribute a RECORDING.
- Single still frames are the deliberate exception, and the About page's rights note is what
  bounds it: one frame, used only to identify a session. Anything added here must stay inside
  what that note already says — and if it cannot, the note changes first.
- Nobel Foundation material is linked, never copied into the repo.

**Security**
- No API key, token or secret in the repo or in client code. The site is public and static.
- Never add staff names, phone numbers or email addresses to content. They exist in the
  internal production sheet and must not reach the published tab or this repo.

**Galleries**
- `CategoryKey` is the six real prize categories. `GalleryKey` adds `nobel`, the introduction
  room, which is *not* a prize category — the hall renders it separately from the plinths and
  `categoryList()` deliberately excludes it. Use `galleryKeys()` for routing.
- A category with zero lectures still gets a plinth and a page. Say so plainly and link out;
  never hide the category or show a bare "0". Hall order comes from `categoryList()`, which reads
  the `order` field — change it in `scripts/build-catalog.py`, not in the component. The order is
  physics, chemistry, medicine, peace, economics, literature.
- The museum counts SITTINGS, not lectures, wherever it says 場講座: 31 lectures in 32 sittings,
  because Südhof's was given twice. Medicine therefore shows 8 where it holds 7 lectures.
- Every gallery must carry material beyond video: intro, history, statistics, official links.
  Category prose lives in `scripts/copy-galleries.py`; the numbers in `data/prize-facts.json`.
- The official Nobel pages sit in the 延伸探索 rail down the right of each prize room — the same
  place and shape a laureate's page keeps it. Each is an ExtLink with its description rendered
  beside it as plain text, always visible: no hover popup, no touch-device branch.
- nobelprize.org slugs are **not** uniform — Peace and Economic Sciences break the
  `…-nobel-prize-in-X` pattern. Verify every URL in `fetch-prize-facts.py` with a live request
  before changing one; do not tidy them by pattern.

**Badges**
- The guide mark is the same object in THREE components: `.card__badge` in LectureCard,
  `.vf__label` in VideoFacade, `.vc__kind` in VideoCard. All three are top-left, 0.66rem,
  0.12em tracking, radius 2px, `--on-accent` on `--accent-block`. Restyle all three or none.
- Two things differ and must not be flattened. The wording comes from `guideBadgeKey(action)`
  in `src/data/catalog.ts` — a picture that PLAYS says 導讀影片, one that GOES somewhere says
  有導讀影片. And `.vc__kind` is overridden per video kind (`--kind-guide` / `--kind-lecture` /
  `--kind-record`), so on the browse page it does not take `--accent-block` at all.

**Touch**
- Never leave a `:hover` rule ungated on anything that navigates or acts on tap. On a touch
  device the first tap applies hover; if the page visibly changes the browser withholds the
  click, so the control only fires on the second or third tap. Put hover effects inside
  `@media (hover: hover) and (pointer: fine)` and give the same affordance to `:focus-visible`.
- Gate `pointerenter`/`pointerleave` handlers on `pointerType === 'mouse'` for the same reason —
  reacting to the pointer events of a tap is itself the visible change that eats the tap.
- Interactive elements carry `touch-action: manipulation` (set globally in global.css) so the
  browser does not hold the click waiting for a possible double-tap-zoom.
- Playwright's device emulation does NOT reproduce these behaviours: it delivers a clean tap and
  ignores sticky hover. A green emulated test is not evidence the bug is fixed on a real phone.

**The video facade**
- The player is built on `pointerdown`, hidden behind the poster, and revealed on `click`.
  That ordering is the point: mobile browsers refuse to start unmuted video in an iframe created
  AFTER the gesture, so building it first lets the tap land on a player that already exists.
  A gesture that turns into a scroll (pointermove past ~12px, pointercancel, or a scroll event)
  discards the half-built player.
- Never put `pointer-events: none` on the facade button. It is still waiting for the pointerup
  and click that hand over to the player; suppressing them strands the video permanently.

**Weight of the CSS-3D room**
- `Sculpture3D` extrudes each SVG into 12 slices, each with its own `filter` — so each slice is
  a separate composited surface; six pieces and a mirrored copy of each make 144 filtered SVGs,
  fine on a desktop GPU and enough to get the tab discarded on iOS Safari.
- Below 62rem the mirrors and the video wall are `display: none` (their nodes stay in the DOM)
  while the slices past the third are actually REMOVED, by a script that runs on every
  `.x3d__turn` stack including the hidden mirrors'. Keeping the mirror's three slices in the
  document is exactly why the phone count is 39 and not 21: do not "tidy" the removal to skip
  hidden stacks without re-measuring.
- The walk-in zoom (`--walk-zoom`, set from JS) is 1 on small screens: scaling the room
  re-rasterises every composited layer at the new size, which is what kills the tab at the
  moment of navigating into a gallery.
- Before adding anything to this room, `document.querySelectorAll('.x3d svg').length` on a
  phone must read exactly 39, against 152 untrimmed.

**CSS**
- Three ways type is read over a room, and the length of the read chooses between them.
  bright.css declares all three at its head. For a caption, a label or one sentence: `--ink-edge`
  (and `--ink-edge-h` for a heading), the four-layer white text-shadow a line carries when it
  stands on the photograph. For a framed block: `--pane` / `--pane-blur`, the 62% white and 9px
  blur the index of films puts under every card. For a room that is MOSTLY reading — the
  introduction room and the colophon — neither: the column stands on `room-sheet`, a plain
  translucent rectangle of the column's own width, and the edge comes off everything inside it.
  At two thousand words an edge per line is a haze over the whole page, which is the owner's
  judgement and the reason the sheet exists. Never two of the three on one element: a ground is
  a ground, and type on one with an edge as well is type printed twice. `--surface` is 3.5%
  BLACK — a dark-museum tint that over a photograph darkens a block instead of lifting it.
- A room's head — emblem, title, the three words it is read by, the sentence under them — stands
  in a box of its own OUTSIDE the box marked `[data-fade]`, and wears `room-head`. `[data-fade]`
  is `isolation: isolate`, and an isolated ancestor caps every z-index under it, so a title
  inside the faded box can never be lifted over the band the page dissolves into. The page's own
  opening padding goes on the head's box; the body's is zeroed, because `.hall-head` places
  itself by subtracting that same 3.4rem. A room whose head is a HERO — a prize room, a
  laureate's page — says the same thing by putting `room-head` on the element that already
  carries `data-fade`: isolation caps what is inside an element, a z-index is where the whole of
  it stands, so the two sit together.
- The ladder over the band is band 10, a room's head 11, the logo beside that head 12 — and the
  logo is a step above the head, not level with it, because the head draws a field of light
  behind its own title that reaches past the title's box and is later in the document. Level,
  it painted over the medal and the wreath.
- Two accent tokens, and they are not interchangeable. `--accent` paints strokes, text, borders
  and the sculptures — full-strength hue. `--accent-block` paints solid fills: the guide badge in
  its three forms and the study panel's keys and marks. Never use `--accent` for a solid block.
- In the dark museum `--on-accent` (#150d05) sits on `--accent-block`, so any change to those
  tokens must be re-checked for WCAG AA (4.5:1); economics is the tightest at 7.03:1. In the
  bright museum `--on-accent` is #ffffff on `--red` for every category.
- Warm palette, and prize category is the sole carrier of hue via `[data-cat]` → `--accent` —
  **in the dark museum only**. The bright museum deliberately drops category hue: all six `--c-*`
  tokens resolve to `--red-ink` and every `[data-cat]` takes `--accent-block: var(--red)`, so the
  sculptures, not the colour, say which hall you are in. Do not "restore" per-category hue there.
- Dark-museum tokens live in `src/styles/global.css`; the bright museum restates them in
  `src/styles/bright.css`. Add a token rather than a one-off hex value — and add it to both files
  if the two museums need different values.

**SVG**
- Gradient strokes need `gradientUnits="userSpaceOnUse"`. With the default
  `objectBoundingBox`, a perfectly straight line has a zero-area box and renders **invisible**.
  Do not reintroduce it.

## Definition of done

- `npm run check` (astro check; there is no separate tsc step) and `npm run build` both clean
- `npm run shots -- '[{"name":"home","path":"/","w":390}]'` — the script takes a JSON array and
  captures nothing without one — then actually look at the PNGs in `shots/`. Shots need a
  current `dist/`: the script serves the built site, it does not build it. The viewport default
  is 1440×900, so 390 must be asked for.
- For a change that is meant to alter nothing visible — a clean-up, a refactor — copy `dist/`
  aside first and run `node scripts/check-render.mjs <before> <after>` (the base path
  defaults to `/nobel/`): it compares every page's DOM and every element's computed style, and
  "identical" is the proof. Pixels are not: the halls' own motion makes two shots of one
  build differ.
- Keyboard-navigable, visible focus, WCAG AA contrast
- No console errors; no layout shift
- Test at 390px before 1440px

## Copy voice

Every descriptive string on the site is a museum wall label, not a lesson.

- Facts first. State what was found, then why it mattered. No preamble.
- Third person throughout gallery, lecture and hall copy. Second person is
  allowed only in the study tools, where the reader is writing.
- No rhetorical-question hooks, no closing moral, no telling the reader what
  to feel or how impressed to be.
- Never the 「不是 X，而是 Y」 rhythm as an ornament; only where the contrast
  is the actual point, and at most once.
- Chinese: 破折號 (——) sparingly, and never in a hook. Official lecture
  titles keep whatever punctuation they were delivered with.

## PageNav (the three standing controls, lower right)

`src/components/PageNav.astro`, mounted once in `Base.astro`.

- "Back to top" appears only past `max(320px, 60vh)` of scroll. Clicking it also moves focus to
  `#main` (which carries `tabindex="-1"`), or a keyboard visitor's focus stays deep in the page.
- "Previous page" is shown only when `document.referrer` is same-origin. `history.length` is
  useless for this — a fresh tab already reports 2 — and without the check the control dead-ends
  on a search engine.
- "Next page" sits under it and calls `history.forward()`. There is no `canGoForward` and there
  never was — the session's entries are deliberately unreadable — so the key shows itself only
  where the browser will admit there is something ahead: on a page whose
  `PerformanceNavigationTiming.type` is `back_forward`. It re-asks on `pageshow`, because a page
  restored from the back/forward cache never re-runs the module.
- z-index is 35: above page content, below the walk-in overlay (40) so the transition covers
  it, and clear of the switcher (60) and toggle (61).
- The button keeps its slot when hidden (`visibility`), so nothing shifts as it fades in. Only
  the referrer and history checks use `hidden`, decided once at load.

## The way on travels a screen at a time

`src/components/ScrollCue.astro`, pinned to the foot of the window on every page that has
something below its opening screen.

- One press is one window, every press, and the press before it does not have to have finished.
  A smooth scroll reports the position it has animated TO, so `scrollBy` from there loses the
  difference and two quick presses travel less than two screens: the target is carried in the
  module instead, clamped to `scrollHeight - innerHeight`.
- The carried target is released the moment the reader moves the page themselves — a wheel, a
  touch, an arrow key — but NOT when the press lands on the cue, which arrives as a `mousedown`
  or a `keydown` a moment before the click it belongs to.
- Smooth only when `motionOn()` says so, exactly as the pinned keys ask it.
- It is still an `<a href="#…">`. The anchor is the fallback for a visitor whose scripts have
  not run, and the three `<span class="gr__anchor">` marker spans exist for it.

## The study store must never claim a save it did not make

`localStorage.setItem` throws in a private window and wherever the browser blocks site data.
Swallowing that and printing 「已儲存」 is worse than any crash: the student trusts the
confirmation and loses every note on reload.

- `write()` in `src/scripts/study.ts` returns whether the value was kept; `setNote()` and
  `updateKept()` pass it up, and the UI shows 「未能儲存」 in the warning colour, held longer
  than the success message.
- `storageAvailable()` probes once on load; `StudyPanel` and `StudyDesk` show a standing banner
  when it fails, before anything has been typed.

## Where a visitor can actually write

The learning area carries the chooser (all 31 lectures), the watch toggles and
the note fields, so the whole task can be done on one page: `StudyDesk.astro`,
rendered inside `LearnPage.astro` at `/learn/#record`. `/study/` is now only a
redirect stub, kept so old links still arrive. The lecture-page panel stays,
with its three stages and all four fields always rendered.

Rebuild the editable blocks only when the *set* of chosen ids changes — never
on input. Repainting a textarea from storage mid-sentence discards what is
being typed.

「收藏這場演講」 stands ABOVE the three stages, under the line that says where
the six are kept, and in red. It is the one mark on a lecture page that the
learning area counts — not a field to fill in — and inside 準備 it read as a
fourth. It has to stay inside `<section class="sp">`: that element carries
`data-study` and is the panel script's query root, so a row moved out of it
takes `[data-pick]` with it and the panel dies before it hydrates.

## The search panel

`src/components/SiteSearch.astro`, one `<dialog>` opened with `showModal()`.

- The field carries `autofocus`. That is what puts the caret there: the dialog's
  own focusing steps run inside `showModal()`, in the same turn as the press,
  and a phone raises its keyboard only for a focus that happens inside the
  gesture that asked for it. A `requestAnimationFrame(() => input.focus())` has
  already spent the activation. `open()` focuses again, synchronously, for the
  two keyboard ways in.
- On a phone the plate stands 5rem from the top and its cap is
  `calc(100svh - 5.5rem)`. The two move together: the dialog is the window with
  `overflow: visible`, the plate clips its own overflow, and the document behind
  is scroll-locked, so any height past the bottom of the screen is unreachable.
- Do not reach for `env(safe-area-inset-*)`: the viewport meta has no
  `viewport-fit=cover`, so on iOS it resolves to 0.

## The objects hall (`/models/`)

All six pieces are the owner's own award sculptures: `assets-src/models/<cat>.glb` IS the
source and may not be overwritten. Three scripts own the pipeline; run them in this order:

1. `scripts/build-base-rings.mjs` — cuts the three gold bands into the drum and writes the
   `_base-ringed.glb` everything downstream consumes.
2. `scripts/normalise-models.mjs` — the centre of the pipeline (see "Smooth statues").
3. `scripts/render-posters.mjs` — renders the poster through model-viewer itself, so the still
   matches the frame the live model settles into (serves `public/` on its own port; needs no
   external server). Re-run it after any geometry change, or the poster no longer matches the
   model.

`scripts/fetch-models.py` (Poly Pizza) and `scripts/build-models.mjs` (the balance) remain but
are inert: all six names sit in their `SUPPLIED` sets and are skipped. Keep them, and keep
their rules, for the day a borrowed stand-in comes back — restoring one means removing its
name from `SUPPLIED` and from `ON_BASE`.

- `ON_BASE` in normalise-models.mjs holds all six. Membership skips the perch-and-scale path,
  skips `smoothNormals()` + `weld()` and the `SUBDIVIDE` pass, and puts the piece on the drum
  unchanged; one fixed factor is then applied to all six assemblies with the drum's foot on the
  bottom of the unit box, so every hall shows the same drum at the same size.
- Materials are re-cast and the model written twice: in the hall's `TINT[cat]` to
  `public/assets/models/`, then in gold to `public/assets/models/gold/` for the bright museum.
  The drum's inlay ring (`base__` prefix) and the invisible cage material are exempt.
- `data/model-credits.json` is written by both inert scripts and **merged**, never overwritten,
  so a future borrowed stand-in cannot clobber the rest. An empty `page` suppresses the outbound
  credit link (the title renders as `<b>` instead of `<a>`); `source: 'original'` selects the
  wording and drives `borrowedCount`.
- Matrix order in build-models.mjs is column-major: in `chain(a, b)` it is `b` that reaches the
  point first. Backwards, geometry collapses in ways that look plausible until rendered.
- `CAMERA`, `CAMERA_TARGET` and `CAMERA_LIMIT` appear in FOUR places — `render-posters.mjs`,
  `HallModels.astro`, `HallBright.astro` and `GalleryPage.astro` — and must match, or the
  poster jumps when the model takes over.
- model-viewer lives in `vendor/` at the repo root, not `public/`: imported it is bundled once;
  a copy in `public/` would ship a second megabyte that nothing requests.
- The model is decoration inside the link, so it carries `pointer-events: none`; without it the
  anchor never sees the click.
- The fallback chain is model → poster → bare link. The `<img slot="poster">` is what a browser
  that never upgrades the custom element renders, so it must stay a real child element.
- Credits are emitted with `<Fragment set:html>`; a JSX comment (`{/* … */}`) is stripped at
  build and never reaches the page.

## Fonts are self-hosted and subset

`scripts/subset-fonts.mjs` owns this museum's faces — four families: Noto Sans
TC, Noto Serif TC, Source Serif 4, Source Sans 3. (The dark set — Noto Sans TC,
Noto Serif TC, Cormorant Garamond — is still in the tree and `--theme dark`
re-cuts it, for the preserved museum only.) Self-hosting keeps a third party out
of the request path of every visit, which the About page's privacy claim depends on.

- **Bucket by the font that will actually draw the character, not the head of
  the stack.** The script opens all 92 built pages and reads
  `getComputedStyle().fontFamily` on every text node, then reads the whole
  stack: the bright body stack names Source Sans 3 first, so crediting
  `fontFamily.split(',')[0]` gives a Latin face every ideograph and leaves the
  CJK face with none at all. The serif only draws headings, so it carries far
  fewer ideographs than the sans — that split is the whole saving.
- **Two passes**, because the corpus comes from the rendered site and the
  second build is what picks up the new hashes:
  `npm run build && node scripts/subset-fonts.mjs && npm run build`. The script
  reads `dist/`, writes `public/assets/fonts/bright/` and the manifest with the
  `/nobel/` base path baked into every URL (`BASE_PATH` overrides it), and the
  second build links the new hashes. Re-run whenever visible text changes.
- **Link the stylesheet, do not bundle it.** Both font sets name families like
  `Noto Serif TC`. With both stylesheets in one build the browser matches the
  other museum's `@font-face` and fetches a file that is not there. One `<link>`
  per build makes the collision impossible.
- **Derive the URL from the output path.** Hardcoding `assets/fonts/` produces a
  preload pointing at nothing once the bright faces move to a subdirectory.
- Generated, do not hand-edit: `public/assets/fonts/fonts.css` and
  `public/assets/fonts/bright/fonts.css`, plus `src/data/font-manifest.json` and
  `src/data/font-manifest-bright.json`. The manifest exists so the preload in
  `Base.astro` names the identical hashed URL the CSS asks for — name it
  differently and the font downloads twice.
- Font files are hashed because `public/` URLs are stable across deploys and
  GitHub Pages serves them with `max-age`.
- Upstream TTFs and `.venv-fonts/` are gitignored; the script fetches the fonts
  if they are missing.
- A glyph outside the corpus is not tofu — it falls back to PingFang TC /
  Microsoft JhengHei. Visitors typing into the study notes are fine; only the
  typeface shifts.

## The hall backdrop

`LectureScreen.astro` has two paths and picks the first that is available:

1. **Self-hosted cuts** — `src/data/backdrop.json`, generated by
   `scripts/make-backdrop-clips.py`: ten-second loops, a few hundred KB, as a muted
   `playsinline` `<video>` so it also autoplays on iOS.
2. **Cross-faded stills** — the fallback while that file is empty, which it is today: the
   lectures' own frames, alternating between two `<img>` layers every nine seconds.

Both paths are gated on Save-Data, 2G-class connections and `motionOn()`.

**When clips are added, the About page must be amended in both languages.** Its rights note
discloses single still frames only; moving footage re-hosted under `public/media/backdrop/` is
outside what it says.

Never verify playback by asking whether the element exists — `iframe present` and `data-on set`
say nothing about it. Compare two frames after the reveal has finished, and remember that
headless Chromium applies desktop autoplay policy whatever the `isMobile` flag says.

## Card thumbnails

Two rules from the owner: the frame comes from the **Taiwan lecture** recording, never the
導讀, and it shows the **laureate's** face.

`src/data/stills.ts` is the single resolver, in order — a cut still (`local-posters.json`),
then the verified YouTube frame (`video-posters.json`), then the uploader's `hqdefault`.

- `scripts/pick-posters.py` writes two files, and **both are needed**: `src/data/posters.json`
  (lecture id → frame suffix, for the card in a grid) and `src/data/video-posters.json`
  (YouTube id → frame suffix, for every facade on a laureate's page). Without the second, a
  recording carries the laureate's face in the grid and an opening speaker's on its own page.
  Run it as `.venv-cv/bin/python scripts/pick-posters.py [--report]`.
- Detection alone cannot find the laureate — YuNet also returns the banner behind the stage, a
  slide, the audience — so every candidate face is matched with SFace against the laureate's
  official portrait, read from the nobelprize.org page the catalogue already links to.
  `SAME_PERSON` is 0.363, the model's own threshold; loosening it lets through any grey-haired
  man in a dark suit.
- `maxresdefault` is a hard last resort, not a scoring nudge — in this series it is usually a
  designed title card, which is not a 講座截圖.
- Where none of the four frames YouTube samples holds the laureate,
  `scripts/cut-poster-frames.py` samples the recording itself and writes
  `public/assets/posters/<youtube id>.webp` plus `src/data/local-posters.json`. **Run it
  locally** — a CI runner is a datacenter address and YouTube answers it with "sign in to
  confirm you're not a bot" on every player client; `.github/workflows/poster-frames.yml` is
  kept as a fallback that does not currently work.
- Re-run after changing which video a lecture points at.
- `scripts/facecheck.py` is the shared module both scripts import for the portrait, the
  detector and the threshold; it names the models to fetch, which live in `.tools/`
  (gitignored).

## The bright museum

This museum. It grew inside `jhpwww/taiwan-nobel-museum` as the same site in
daylight — same routes, same data, same components, built a second time with
`THEME=bright` and nested under `/bright/` — and on 2026-09-07 it moved here, to
`https://jhpwww.github.io/nobel/`. The old `/bright/` addresses redirect here.
`src/theme.ts` exports `bright`, true unless `THEME=dark`.

- `Base.astro` emits `data-theme="bright"` when `bright` is true. A `THEME=dark`
  build ships the same stylesheet with the attribute absent, so no bright rule
  matches and it renders the dark museum — a comparison build, nothing more.
- Everything in `src/styles/bright.css` is scoped to `html[data-theme='bright']`:
  the token overrides first, then the component and layout rules the bright ground
  needs. Add a bright rule there, never a fork of a component.
- White ground, near-black text. Red carries the marks, the fills and `--accent`;
  a plain link rests in gold (`--gold-deep`) and turns red on hover. There are no
  category hues here at all.
- Gold models: `scripts/normalise-models.mjs` writes a second set to
  `public/assets/models/gold/`. Metalness near 1 with low roughness is what
  makes them read as a statuette; the base colour alone reads as yellow paint.
- `HallBright.astro` and `HallRing.astro` are the two components with no dark
  counterpart. The room is a **photograph**, and what stands in it is placed in
  per cent of a plate carrying the picture's own aspect ratio, so a crop moves
  the picture and its contents together. The eye level is measured at 69.2% of
  the plate — see `scripts/crop-hall.py`.
- No embers and no dust: motes are invisible against a hall this bright. The
  light in this room is the photograph's own.

**The fade band is a fixed copy of the room, not a mask on the page.** `mask-image` has no
`fixed` attachment, so a mask driven from a scroll handler can never keep up with the
compositor: the text rises at full opacity and then snaps pale. Instead each page renders its
room a second time, marked `[data-roomtop]`, laid over the page with a static mask — a cover of
alpha `1 − a` equals blending the page toward the room at `a`, at no per-frame cost. Do not
reintroduce a scroll-driven mask.

- The bar says which room you are in. `Base.astro` derives it from `segments` — the same list
  `routing.ts` builds every key's href from — and writes `aria-current="page"`; bright.css turns
  that into red ink and a fuller plate. Colour and colour only: a key's width is its label plus
  its padding, so a heavier or wider label pushes every key to its right along a row joined by a
  hairline, and the frame widths are the owner's. The kit's own `[aria-current]` rule is inert
  here — it paints `::before`, which the plate hides. A prize room lights nothing: the 關於諾獎
  key opens the introduction room, and a physics room is not it.
- The emblem a room hangs beside its title is caught at `--emb-k` and hung at `--emb-y`, both in
  bright.css. A desktop catches it at 0.4 — twice what it was, at the owner's word — with its top
  edge on the mark's own; a phone keeps 0.38 and the old centring, because 0.38 of an emblem that
  is already a fifth of the screen is the size of the mark beside it. `--emb-h` is load-bearing
  for `--head-min`, `--hall-indent` and `.hall-head`'s top margin; `--emb-k` and `--emb-y` are
  read in one place only. A prize room's sculpture is doubled the same way, in `GalleryPage`'s
  own `.gr__rail[data-pinned] .gr__piece` (0.4, with `--piece-back-y` halving the crop with it);
  the phone keeps `--piece-back-k`.
- A laureate's name is caught into the corner beside the mark when the h1's top edge reaches the
  top of the window, and the h1 hands it over in the same movement (`data-handed`) — two of the
  same name a finger apart read as a fault, and until the head was lifted out of the band the big
  one was half dissolved by then. It wraps rather than being cut: the room beside the mark is
  measured every frame (`--pin-max`) because that row is five labels in one of two languages and
  folds into a column on a phone.

**Traps in the bright layout that have already cost a rebuild:**
- A CSS box gap is not the painted gap when the background is a picture with
  transparent margin baked in. `key-plate.webp` carries 12px of its own margin;
  halving `row-gap` changes nothing a visitor can see. Measure the artwork rows,
  not the box.
- `element.getAnimations()` keeps FINISHED animations. Test
  `playState === 'running'`, or a stillness check never passes.
- Individual transform properties resolve `translate → rotate → scale →
  transform`, so a length written inside `transform` is multiplied by the
  `scale` property. And `translate` percentages resolve against the element's
  own size, `inset` percentages against the containing block.
- Custom properties inherit downward only. A cue computed on a child cannot be
  read by its parent.
- Anything that must sit above the fade band needs a z-index above
  `[data-roomtop]`'s 10.
- Stop a Playwright check before editing source: an HMR navigation destroys its
  execution context mid-run.
- Never write a `pgrep -f` wait loop — it matches itself and never exits.

## Colour is measured, not eyeballed

Run both after any palette change:

- `node scripts/check-contrast.mjs` (bright by default; `--theme dark` reads the dark tokens)
  — reads the tokens out of the stylesheet
  and checks the pairings the site renders.
- `node scripts/audit-contrast.mjs <origin>` — the one that finds real bugs: for every text node
  on the built pages it resolves the colour actually painted and the nearest opaque background
  behind it, and reports anything under AA. Token-level checking cannot see a safe colour
  applied over a surface it was never measured against, which is how a gold link reaches 3.2:1.

Three things a sampler cannot do, and they all produce false readings:

- A computed colour comes back as `rgb()` with 0–255 channels, or — once `color-mix()` is
  involved, which every surface here uses — as `color(srgb r g b / a)` with 0–1 channels.
  Reading the second as the first makes every surface look black and every reading a false
  failure.
- Text over a gradient cannot be sampled this way at all. Skip it and look.
- Text under a cover is sampled THROUGH the cover. `[data-roomtop]` is in `check-glass.mjs`'s
  exclusion list for that reason; anything else laid over the page needs the same treatment, or
  the walker reports 1.11:1 on type that actually reads at 7:1.

**Never fix a theme problem by out-specifying a component.** Astro's scoped
selectors carry a `[data-astro-cid-…]` on every part, so a component's own
`.cards[cid] a[cid]` at (0,3,1) BEATS `html[data-theme='bright'] .cards a` at
(0,2,2) — and it fails silently, so a rule can sit there unread for its whole
life. When a component hardcodes a colour, give it a token — `--on-accent`,
`--kind-guide` — and restate that token in the theme. Where a token cannot
carry it, put the component's own class in the theme selector to win on
specificity, not to scope.

## Smooth statues

`scripts/normalise-models.mjs` runs, in order: `dedup, prune`, then `smoothNormals` on named
parts only (`SMOOTH_PARTS = { peace: ['dove'] }`, the owner's exception), then prune,
textureCompress and quantize. Full `smoothNormals()`, `weld()` and the `SUBDIVIDE` pass are
gated on `!ON_BASE.has(cat)` and so run for no shipped model (see the objects hall). Keep the
code and keep these rules for the day a borrowed low-poly stand-in comes back:

1. `smoothNormals()` is per **corner**, not per vertex, and crease-aware at 60°: a corner
   averages only the faces meeting at its position whose own normal lies within the threshold.
   Average everything and the sharp edges soften too — a flask's rim rounds off, a balance's
   beam melts into its pans.
2. `weld()` only after smoothing: before it every corner carries its own face normal and
   nothing can merge.
3. Loop subdivision is for `SUBDIVIDE` only, then smooth and weld again. Smooth normals fix the
   shading but not the outline: an eight-facet flask has an eight-sided silhouette however lit.
4. The dove is deliberately NOT subdivided: its mesh carries split vertices along the wings and
   tail, and Loop subdivision pulls those apart into visible cracks — the wing detaches.

`quantize()` — **and the extension must be registered on the `NodeIO`**.
gltf-transform silently drops an unregistered extension on write, which leaves
quantised accessors with no `KHR_mesh_quantization` declaration: invalid glTF
that happens to load in three.js. Check `extensionsRequired` in the output
before trusting it.

## The bright palette's one known exception

`--accent-block` is TED's #e62b1e because the owner asked for the brand red on
filled blocks. White on it measures **4.44:1** against AA's 4.5 — a 1.3%
shortfall, and unfixable while the fill stays that red, since white is already
the lightest ink available. What still puts white on it: the lecture card's
badge, the video card's kind badge, the video facade's label, and the study
desk's picked tags.

Text red is the darkened `--red-ink` (5.72:1) and passes everywhere. **Do not
"fix" the block red by darkening it — the owner has ruled on that.** If strict
AA is wanted later, the lever is the label, not the colour: at 18.66px bold the
bar drops to 3:1.

## Type on paper

`scripts/audit-type.mjs <origin>` lists what each page actually renders — family, size, weight,
tracking in em, leading as a ratio — rather than what the stylesheet intends. Run it before and
after any type change; the numbers a typographer reasons in are not the ones
`getComputedStyle` returns. Run its conflict check when a label looks different between a
parent and child page: the same text set in two faces is a defect, but a filter chip set in
sans while the heading is serif is not — those are different roles.

The bright theme restates the type: on the dark ground glyphs bloom, so that museum opens its
tracking and sits at a light weight; on white the same weight reads thin and the same tracking
reads loose.

- Headings and the title-and-name set go to **600** on paper, because Source Sans carries
  less colour than the serif at the same number. Cormorant is not in the bright museum at all —
  a display Garamond's hairlines disappear on white under about 40px.
- Uppercase Latin labels keep their tracking. What is pulled back is Chinese that inherited a
  Latin small-caps measure: Latin eyebrows 0.22em → 0.13em, `:lang(zh)` eyebrows
  0.16em → 0.08em, hall hints 0.18em → 0.07em.
- Leading tightens slightly (1.75 → 1.72).

All of it is scoped to `html[data-theme='bright']`; the audit on the dark origin should still
report `.lec__who` at 500/0.03em and `.eyebrow` at 0.16em.

**Undimmed backgrounds mean type carries its own light.** The four section backgrounds are
shown at full strength with only a gradient at the foot, so every title, gold sub-line and note
over them needs its own layered white edge (`text-shadow`, four stops).

## The bright museum leads with its sans

Every title, and every laureate's name where it heads a block, is set in Source Sans. Only the
one-line hook keeps a serif — it is a pull-quote, the one place the museum speaks rather than
labels, and it has its own token (`--font-hook`) so a theme can move every heading without
dragging the editorial voice along.

Do this **at the token**, never by out-specifying components (see "Colour is measured"):
`--font-display` and `--font-han-serif` are both the sans in the bright theme.
