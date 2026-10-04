#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-glass-frame.py — the rim of a piece of glass, drawn once and stretched.

What makes iOS's Liquid Glass read as glass is not the blur. It is the rim:
glass is thick at its edge, so the edge is where light collects, and the eye
reads that gathered light long before it reads anything through the middle.
Three CSS attempts at the rim failed the same way — box-shadow can put a ring
round a box, but every ring it draws starts at the edge and spreads inward, so
what comes out is a soft glow rather than a profile with a shape.

A profile has a shape. From the outside in:

    a lit outer line     the edge itself catching light — crisp, nearly white
    a thin dark pull     glass is not the air around it; there is a boundary
    a wide bright band   light gathered in the thick part, cool, its peak a
                         third of the way in
    a long fade          the glass thinning toward the middle
    an inner hairline    where the thick rim ends and the clear pane begins

That is drawn here, at 4× and downsampled, and served as a nine-slice: the
corners keep their curve, the four sides stretch, and the middle is never
drawn at all so the pane stays clear. The lighting *direction* is deliberately
not baked in — a stretched edge cannot carry a gradient along its own length
without seaming — so the frame is the same all the way round and the specular
sweep is left to CSS, which can put it anywhere.

    python3 scripts/build-glass-frame.py
"""
import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = HERE / 'src/assets/ui'   # bundled by Vite and named in bright.css by relative url(); not public/, whose root paths the dev server does not rebase

#: the rim at its design size, in CSS px, and the corner radius that goes with
#: it. Everything scales together off border-width, so these are a ratio as
#: much as a size — see the note by .vf in bright.css.
RIM = 30
RADIUS = 26
SS = 4                      # supersampling
SLICE = RIM * SS
SIZE = SLICE * 2 + 24 * SS  # a little middle, never drawn

#: (depth in CSS px from the outer edge, rgb, alpha)
PROFILE = [
    (0.0,  (255, 255, 255), 0.00),
    (0.35, (255, 255, 255), 0.95),
    (1.3,  (255, 255, 255), 0.88),
    (2.1,  (196, 214, 236), 0.20),
    (3.4,  (214, 233, 255), 0.16),
    (6.5,  (232, 244, 255), 0.50),
    (9.0,  (240, 249, 255), 0.44),
    (14.0, (226, 240, 255), 0.22),
    (22.0, (222, 238, 255), 0.09),
    (25.4, (255, 255, 255), 0.10),
    (26.6, (255, 255, 255), 0.46),
    (27.8, (255, 255, 255), 0.12),
    (30.0, (255, 255, 255), 0.00),
]


def sample(d: float):
    """the profile at depth d, linearly interpolated"""
    if d <= PROFILE[0][0]:
        return PROFILE[0][1], PROFILE[0][2]
    for (d0, c0, a0), (d1, c1, a1) in zip(PROFILE, PROFILE[1:]):
        if d <= d1:
            t = (d - d0) / (d1 - d0) if d1 > d0 else 0.0
            return (tuple(round(x0 + (x1 - x0) * t) for x0, x1 in zip(c0, c1)),
                    a0 + (a1 - a0) * t)
    return PROFILE[-1][1], 0.0


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    n = SIZE
    r = RADIUS * SS
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    px = img.load()

    for y in range(n):
        for x in range(n):
            # signed distance to the rounded rectangle's boundary, positive in
            # (the standard rounded-box SDF, written out rather than imported)
            qx = abs(x + 0.5 - n / 2) - (n / 2 - r)
            qy = abs(y + 0.5 - n / 2) - (n / 2 - r)
            if qx > 0 and qy > 0:
                out = (qx * qx + qy * qy) ** 0.5 - r
            else:
                out = max(qx, qy) - r
            d = -out / SS                     # depth inward, in CSS px
            if d < 0 or d > RIM:
                continue
            (cr, cg, cb), a = sample(d)
            # feather the outermost half pixel so the curve does not stair-step
            if d < 0.5 / SS:
                a *= d * SS * 2
            px[x, y] = (cr, cg, cb, round(max(0.0, min(1.0, a)) * 255))

    img = img.resize((n // SS, n // SS), Image.LANCZOS)
    f = OUT / 'glass-frame.webp'
    img.save(f, lossless=True, method=6)
    print(f'{f.relative_to(HERE)}  {img.size[0]}x{img.size[1]}px  '
          f'slice {RIM}  radius {RADIUS}  {f.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
