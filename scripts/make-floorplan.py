#!/usr/bin/env python3
"""
make-floorplan.py — the museum's floor plan, from the owner's drawing, in
both languages.

    python3 scripts/make-floorplan.py

Source: assets-src/marks/museum-floorplan.png (the owner's file, 1600x1134,
transparent outside the walls, labelled in Han). Writes two pictures that
FloorPlan.astro pins under the bar's keys:

  public/assets/ui/floorplan.webp      the owner's drawing, with the two
                                       sides of the rotunda exchanged — see
                                       SWAP below
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

SWAP: the owner's file has the introduction room on the left of the rotunda
and the learning area on the right; on 2026-10-11 they asked for the two
sides exchanged — the learning area on the left, the introduction room and
the colophon on the right. The file is not touched: everything from the
rotunda down is mirrored about the drawing's axis, and the four labels in
that part are copied back the right way round. The rotunda, its ring, its
dots and the entrance are symmetric and land on themselves; the display
cases are rectangles and read the same mirrored. Set SWAP = False to have
the file as drawn.

Both pictures are trimmed to the drawing's own edges and brought down to
1000px across — three times the widest the plan is ever drawn on screen
(three key plates, about 330 CSS px), so sharp on a 3x phone — and lossless,
because the drawing is flat colour and type and a lossy encode rings round
every character.

The clickable regions in FloorPlan.astro are written in the SOURCE file's
coordinates — mirrored by the same rule where SWAP applies — and the
overlay's viewBox states the trim, which is why this script prints the trim
box and refuses to write an English plan whose trim differs from the Han
one: the two share one overlay. If the owner's file is ever re-exported with
a different margin, that viewBox is the one number to update — and the label
boxes below, which are measured off the drawing.

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

SWAP = True
# The first row of the part that is mirrored: just under the corridor that
# joins the index of films to the rotunda. The rotunda's circle is centred on
# x = 799.5 to the pixel (measured on three rows), which is the axis a
# 1600px-wide array flips about; the corridors are within a pixel of it.
AXIS_Y = 691

def mirror_box(b):
    x0, y0, x1, y1 = b
    return (1600 - x1, y0, 1600 - x0, y1)

def write(plan, name):
    box = plan.getbbox()           # (left, top, right, bottom) of everything not transparent
    out = plan.crop(box)
    out = out.resize((W, round(out.height * W / out.width)), Image.LANCZOS)
    path = OUT / name
    out.save(path, format='WEBP', lossless=True, quality=100, method=6)
    print(f'{path.relative_to(ROOT)}  {out.size[0]}x{out.size[1]}  {path.stat().st_size / 1024:.0f} KB'
          f'  trim box (viewBox): {box[0]} {box[1]} {box[2] - box[0]} {box[3] - box[1]}')
    return box

# ---------------------------------------------------------------------------
# the labels — in the owner's file's own coordinates
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

# ---------------------------------------------------------------------------
# the Han plan
# ---------------------------------------------------------------------------
src = Image.open(SRC).convert('RGBA')
if SWAP:
    a = np.array(src)
    out = a.copy()
    out[AXIS_Y:] = a[AXIS_Y:, ::-1]
    # the labels go back the right way round: each box's own pixels, fill and
    # all (the fills are flat, so the patch is seamless), copied from the
    # file into the box's mirrored place
    for key, box, *_ in LABELS:
        if box[1] < AXIS_Y:
            continue
        x0, y0, x1, y1 = box
        mx0, _, mx1, _ = mirror_box(box)
        out[y0:y1, mx0:mx1] = a[y0:y1, x0:x1]
    src = Image.fromarray(out)
    LABELS = [(k, mirror_box(b) if b[1] >= AXIS_Y else b, *rest) for k, b, *rest in LABELS]

box_zh = write(src, 'floorplan.webp')

# ---------------------------------------------------------------------------
# the English plan
# ---------------------------------------------------------------------------
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

def fit(kind, text, max_w, max_h):
    """the largest size at which the word fits its room"""
    size = 8
    while True:
        _, (w, h), _ = measure(kind, text, size + 1)
        if w > max_w or h > max_h:
            return size
        size += 1

en = src.copy()
rgb = np.array(en)[:, :, :3].astype(int)
dark = rgb.sum(axis=2) < 330

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
#    three rooms round the rotunda, and the rotunda's own — a tenth under
#    what would fill it, at the owner's word (2026-10-11)
ROOM_LONG, ROOM_ACROSS = 400, 150          # down the room, across it
tall = [l for l in LABELS if l[5]]
size_tall = min(fit(l[3], l[2], ROOM_LONG, ROOM_ACROSS) for l in tall)
low = [l for l in LABELS if not l[5] and l[0] != 'home']
size_low = min(fit(l[3], l[2], (l[1][2] - l[1][0]) + 36, 92) for l in low)
size_hall = round(0.9 * fit('sans', 'Hall', 250, 110))
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
src.save(ROOT / 'shots/floorplan-zh.png')     # the full-size drawings, for checking
en.save(ROOT / 'shots/floorplan-en.png')
box_en = write(en, 'floorplan-en.webp')
if box_en != box_zh:
    sys.exit(f'the English plan trims to {box_en}, the Han one to {box_zh}: the two must share one viewBox')
