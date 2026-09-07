#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
crop-hall.py — cut the bright museum's plate from its source render.

The hall is a photograph, and the ring of stills and the row of pieces are
placed in per cent of it, so the crop is not a matter of taste: change it and
they drift off the architecture. This records the crop rather than leaving it
in an image editor, and prints the landmarks HallBright.astro needs after any
change.

Where the horizon is, and how it was found
------------------------------------------
This room is a rotunda, so its 'horizontal' lines are circles, and a circle
photographs as a straight line only when the camera's eye is at its height.
So trace the rings and read off the height where their curvature changes sign.
Six of them agree here:

    balustrade ring   21.8%   dips in the middle — seen from below
    entablature       32.5%   dips
    window sill       64.9%   dips
    column base       66.7%   dips
    step foot         72.5%   rises — seen from above
    floor ring        79.0%   rises

The sign turns between the column base and the step foot, at y = 651 of 941.
That lands on the foot of the colonnade, level with the door's threshold: the
camera's eye is at the height of the top step.

(A Hough-and-least-squares fit over every receding line — how the very first
plate was measured — is wrong in a room like this. Most of what it finds are
dome ribs, and those converge on the dome's own axis, not the room's horizon.)

    .venv-cv/bin/python scripts/crop-hall.py
"""
import pathlib
import sys

import cv2
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent.parent
SRC = HERE / 'assets-src/hall/bright-hall-source.png'
OUT = HERE / 'public/media'

#: No crop at all: the plate is shown whole rather than covering the hero.
#:
#: The picture is already framed — dome to floor with nothing dead at either
#: end — and the page's own join dissolves its last twelve per cent anyway.
#:
#: And a crop would cost more than it saves. A contained plate is letterboxed
#: against a hero that is squarer than it is, so the taller the plate the more
#: of the hero it fills: at 1440x900 the render's own 1.78 leaves a 90px band
#: below it where a 1.92 crop leaves 150. Cropping the picture makes the
#: picture smaller.
CROP_TOP = 0
CROP_BOTTOM = 0

#: measured on the source, in source pixels — see the note above
HORIZON = 651.0
AXIS = 836.0
LANDMARKS = {
    'balustrade ring': 204.7,
    'entablature': 305.4,
    'window sill': 610.7,
    'horizon / column base': HORIZON,
    'step foot': 681.9,
    'floor ring': 743.6,
}

#: Nothing to take down in this plate — it arrived without the two red banners
#: the previous one hung, so BANNERS is empty and take_down_the_banners() is a
#: no-op. The machinery is kept because the note below is the reason a banner
#: cannot simply be cropped around, and the next render may hang one again.
#:
#: The two red banners come out.
#:
#: Not a matter of taste. The plate is wider than the window it is shown in, so
#: the outermost part of the picture is cropped away at most viewport widths,
#: and the banners sit exactly there — at 1440px the left one loses its first
#: column of characters and the English beneath it reads '...rate the / ...f
#: Knowledge / ...etter World'. Text clipped mid-character is a defect however
#: handsome the banner is. And this text could not be fixed in place even if it
#: were whole: it is baked into a photograph, so it cannot be edited, cannot be
#: translated for the English rooms, and speaks in a voice the rest of the
#: museum does not use.
#:
#: They are removed rather than cropped around, because cropping the plate
#: narrow enough to miss them costs the outer bays and the edges of the dome.
#: Everything behind a banner is flat wall, and every feature in that wall runs
#: vertically — pilaster, shaft, capital, the string course below. So each
#: column of the patch is a ramp between the wall above and the wall below it,
#: which loses the banner and keeps the architecture. Marble at this scale
#: carries no texture worth reconstructing; a whisper of grain is enough.
#:
#: x0, y0, x1, y1 — the banner with its rod, its finials, its fringe, and the
#: shadow it casts on the wall.
BANNERS = []
BANNER_PAD = 40          # rows of clean wall sampled above and below
BANNER_FEATHER = 8       # px, so the patch has no seam

#: the plate is served at twice its CSS size; the hall is the first thing on
#: the page and a soft one is the first thing anybody sees
SCALE = 2
QUALITY = {'jpg': 82, 'webp': 78}


def take_down_the_banners(bgr: np.ndarray) -> np.ndarray:
    """Replace each banner with the wall it hangs on — see the note above."""
    rng = np.random.default_rng(7)
    img = bgr.astype(np.float32)
    out = img.copy()
    for x0, y0, x1, y1 in BANNERS:
        top = np.median(img[y0 - BANNER_PAD:y0, x0:x1], axis=0)
        bot = np.median(img[y1:y1 + BANNER_PAD, x0:x1], axis=0)
        h = y1 - y0
        t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
        t = t * t * (3 - 2 * t)                 # smoothstep: no kink where it rejoins
        patch = top[None] * (1 - t) + bot[None] * t
        patch += cv2.GaussianBlur(
            rng.normal(0, 1.6, (h, x1 - x0, 3)).astype(np.float32), (0, 0), 1.1)
        out[y0:y1, x0:x1] = patch
    mask = np.zeros(img.shape[:2], np.float32)
    for x0, y0, x1, y1 in BANNERS:
        mask[y0:y1, x0:x1] = 1
    mask = cv2.GaussianBlur(mask, (0, 0), BANNER_FEATHER)[..., None]
    return np.clip(img * (1 - mask) + out * mask, 0, 255).astype(np.uint8)


def main() -> None:
    if not SRC.exists():
        sys.exit(f'{SRC} missing')
    bgr = cv2.imread(str(SRC))
    if bgr is None:
        sys.exit(f'{SRC} unreadable')
    src = Image.fromarray(cv2.cvtColor(take_down_the_banners(bgr), cv2.COLOR_BGR2RGB))
    w, h = src.size
    box = (0, CROP_TOP, w, h - CROP_BOTTOM)
    plate = src.crop(box)
    pw, ph = plate.size

    print(f'source {w}x{h}  →  plate {pw}x{ph}   ratio {pw / ph:.4f}')
    print(f'\nHallBright.astro wants:')
    print(f'  const PLATE = {{ w: {pw // SCALE}, h: {ph // SCALE} }};   '
          f'/* aspect-ratio: {pw} / {ph} */')
    print(f'  const VP = {{ x: {100 * AXIS / pw:.1f}, y: {100 * (HORIZON - CROP_TOP) / ph:.1f} }};')
    print('\nlandmarks, in per cent of the plate:')
    for name, y in LANDMARKS.items():
        print(f'  {name:20} {100 * (y - CROP_TOP) / ph:5.1f}%')

    OUT.mkdir(parents=True, exist_ok=True)
    out = plate if SCALE == 2 else plate.resize((pw * SCALE // 2, ph * SCALE // 2), Image.LANCZOS)
    out.save(OUT / 'bright-hall.jpg', quality=QUALITY['jpg'], optimize=True, progressive=True)
    out.save(OUT / 'bright-hall.webp', quality=QUALITY['webp'], method=6)
    print()
    for f in ('bright-hall.jpg', 'bright-hall.webp'):
        print(f'  {f:20} {(OUT / f).stat().st_size / 1024:6.1f} KB')


if __name__ == '__main__':
    main()
