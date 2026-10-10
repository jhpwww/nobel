#!/usr/bin/env python3
"""
make-floorplan.py — the museum's floor plan, from the owner's drawing.

    python3 scripts/make-floorplan.py

Source: assets-src/marks/museum-floorplan.png (the owner's file, 1600x1134,
transparent outside the walls). Writes public/assets/ui/floorplan.webp, the
picture FloorPlan.astro pins under the bar's keys: trimmed to the drawing's
own edges and brought down to 1000px across, which is three times the widest
the plan is ever drawn on screen (three key plates, about 330 CSS px) and so
sharp on a 3x phone. Lossless, because the drawing is flat colour and type,
and a lossy encode rings round every Han character.

The clickable regions in FloorPlan.astro are written in the SOURCE file's
coordinates, and the overlay's viewBox states the trim — so this script
prints the trim box, and if the owner's file is ever re-exported with a
different margin, that viewBox is the one number to update.
"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
src = Image.open(ROOT / 'assets-src/marks/museum-floorplan.png').convert('RGBA')
box = src.getbbox()           # (left, top, right, bottom) of everything that is not transparent
print('trim box (viewBox):', box[0], box[1], box[2] - box[0], box[3] - box[1])
plan = src.crop(box)
W = 1000
plan = plan.resize((W, round(plan.height * W / plan.width)), Image.LANCZOS)
out = ROOT / 'public/assets/ui/floorplan.webp'
plan.save(out, format='WEBP', lossless=True, quality=100, method=6)
print(out.relative_to(ROOT), plan.size, f'{out.stat().st_size / 1024:.0f} KB')
