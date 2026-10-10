#!/usr/bin/env python3
"""
make-floorplan.py — the museum's floor plan, from the owner's drawing, in
both languages.

    python3 scripts/make-floorplan.py

Source: assets-src/marks/museum-floorplan.png (the owner's file, 1600x1134,
transparent outside the walls, labelled in Han). Writes two pictures that
FloorPlan.astro pins under the bar's keys:

  public/assets/ui/floorplan.webp      the owner's drawing as supplied
  public/assets/ui/floorplan-en.webp   the same drawing with its labels in
                                       English — made here, not drawn: each
                                       Han label is painted out with its own
                                       room's fill and the English word set in
                                       its place, in the two voices the
                                       drawing already has (the brown serif of
                                       the seven rooms, the black sans of the
                                       rotunda and the three rooms round it).
                                       The seven rooms are tall and narrow, so
                                       their words run down the room, as a
                                       Han label does two characters deep; the
                                       words are the short forms the owner
                                       asked for (2026-10-11), the way 生醫
                                       stands for 生理學或醫學.

Both are trimmed to the drawing's own edges and brought down to 1000px
across — three times the widest the plan is ever drawn on screen (three key
plates, about 330 CSS px), so sharp on a 3x phone — and lossless, because
the drawing is flat colour and type and a lossy encode rings round every
character.

The clickable regions in FloorPlan.astro are written in the SOURCE file's
coordinates, and the overlay's viewBox states the trim, which is why this
script prints the trim box and refuses to write an English plan whose trim
differs from the Han one: the two share one overlay. If the owner's file is
ever re-exported with a different margin, that viewBox is the one number to
update — and the label boxes below, which are measured off the drawing.

The faces are the museum's own, from assets-src/fonts (scripts/subset-fonts.mjs
fetches them if they are missing): Source Serif 4 and Source Sans 3.
"""
import pathlib
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets-src/marks/museum-floorplan.png'
OUT = ROOT / 'public/assets/ui'
FONTS = ROOT / 'assets-src/fonts'
W = 1000

def write(plan, name):
    box = plan.getbbox()           # (left, top, right, bottom) of everything not transparent
    out = plan.crop(box)
    out = out.resize((W, round(out.height * W / out.width)), Image.LANCZOS)
    path = OUT / name
    out.save(path, format='WEBP', lossless=True, quality=100, method=6)
    print(f'{path.relative_to(ROOT)}  {out.size[0]}x{out.size[1]}  {path.stat().st_size / 1024:.0f} KB'
          f'  trim box (viewBox): {box[0]} {box[1]} {box[2] - box[0]} {box[3] - box[1]}')
    return box

src = Image.open(SRC).convert('RGBA')
box_zh = write(src, 'floorplan.webp')

# ---------------------------------------------------------------------------
# the English plan
# ---------------------------------------------------------------------------
BROWN = (111, 81, 17)     # the drawing's own ink for the seven rooms — #6f5111, the museum's deep gold
BLACK = (0, 0, 0)

# key, the box the Han label occupies (source px, with its anti-aliased fringe),
# the English word, the face, the ink, and whether the word runs down the room
LABELS = [
    ('physics',    (120, 190, 262, 476), 'Physics',     'serif', BROWN, True),
    ('chemistry',  (335, 190, 472, 476), 'Chemistry',   'serif', BROWN, True),
    ('medicine',   (549, 190, 686, 476), 'Medicine',    'serif', BROWN, True),
    ('lectures',   (746, 118, 852, 553), 'All Videos',  'sans',  BLACK, True),   # 片 reaches 552; the case below starts at 554
    ('peace',      (912, 190, 1050, 476), 'Peace',      'serif', BROWN, True),
    ('economics',  (1126, 190, 1266, 476), 'Economics', 'serif', BROWN, True),
    ('literature', (1340, 190, 1478, 476), 'Literature','serif', BROWN, True),
    ('nobel',      (106, 760, 518, 868), 'Nobel Prize', 'sans',  BLACK, False),
    ('learn',      (1083, 806, 1497, 908), 'Learning',  'sans',  BLACK, False),
    ('about',      (191, 992, 598, 1098), 'About',      'sans',  BLACK, False),
    ('home',       (670, 804, 930, 932), 'Hall',        'sans',  BLACK, False),
]

def face(kind, size):
    path = FONTS / ('SourceSerif4-VF.ttf' if kind == 'serif' else 'SourceSans3-VF.ttf')
    if not path.exists():
        sys.exit(f'{path} is missing — run scripts/subset-fonts.mjs once to fetch the faces')
    f = ImageFont.truetype(str(path), size)
    # the drawing's Han labels are heavy; Semibold serif and Bold sans match them
    want = b'Semibold' if kind == 'serif' else b'Bold'
    names = f.get_variation_names()
    f.set_variation_by_name(want if want in names else names[-1])
    return f

def measure(kind, text, size):
    f = face(kind, size)
    l, t, r, b = f.getbbox(text)
    return f, (r - l, b - t), (l, t)

def fit(kind, text, max_long, max_short, vertical):
    """the largest size at which the word fits its room: along the room and across it"""
    size = 8
    while True:
        _, (w, h), _ = measure(kind, text, size + 1)
        along, across = (w, h) if vertical else (w, h)
        if vertical and (w > max_long or h > max_short): break
        if not vertical and (w > max_long or h > max_short): break
        size += 1
    return size

en = src.copy()
arr = np.array(en)
rgb = arr[:, :, :3].astype(int)
dark = rgb.sum(axis=2) < 330
draw = ImageDraw.Draw(en)

# 1. paint every Han label out with its own room's fill — the strokes and
#    their anti-aliased fringe only (the ink, grown by three pixels), not the
#    whole box: the rotunda's inner ring runs under 大廳, and a box would have
#    cut it. The fills are flat (measured: a standard deviation of exactly 0
#    in every room), so the median of what is not ink is the fill itself.
for key, (x0, y0, x1, y1), *_ in LABELS:
    patch = rgb[y0:y1, x0:x1]
    ink = dark[y0:y1, x0:x1]
    fill = tuple(int(v) for v in np.median(patch[~ink], axis=0))
    mask = Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    en.paste(fill + (255,), (x0, y0, x1, y1), mask)

# 2. one size for the seven rooms (the longest word decides), one for the
#    three rooms round the rotunda, and the rotunda's own
ROOM_LONG, ROOM_ACROSS = 400, 150          # down the room, across it
tall = [l for l in LABELS if l[5]]
size_tall = min(fit(l[3], l[2], ROOM_LONG, ROOM_ACROSS, True) for l in tall)
low = [l for l in LABELS if not l[5] and l[0] != 'home']
size_low = min(fit(l[3], l[2], (l[1][2] - l[1][0]) + 36, 92, False) for l in low)
size_hall = fit('sans', 'Hall', 250, 110, False)
print(f'type: rooms {size_tall}px, lower rooms {size_low}px, hall {size_hall}px')

# 3. set each word where the Han label stood
for key, (x0, y0, x1, y1), text, kind, ink, vertical in LABELS:
    size = size_hall if key == 'home' else size_tall if vertical else size_low
    f, (w, h), (l, t) = measure(kind, text, size)
    tile = Image.new('RGBA', (w + 8, h + 8), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((4 - l, 4 - t), text, font=f, fill=ink + (255,))
    if vertical:
        tile = tile.rotate(-90, expand=True)     # reads top to bottom, as a spine does
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    en.alpha_composite(tile, (round(cx - tile.width / 2), round(cy - tile.height / 2)))

(ROOT / 'shots').mkdir(exist_ok=True)
en.save(ROOT / 'shots/floorplan-en.png')      # the full-size English drawing, for checking
box_en = write(en, 'floorplan-en.webp')
if box_en != box_zh:
    sys.exit(f'the English plan trims to {box_en}, the Han one to {box_zh}: the two must share one viewBox')
