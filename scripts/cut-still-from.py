#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cut-still-from.py — cut the laureate's frame out of ONE recording of an event
for the card of ANOTHER recording of the same event.

    .venv-cv/bin/python scripts/cut-still-from.py <lecture id> <source youtube id>

Since 2026-10-04 a lecture page plays the host institution's own upload where
there is one, and the IPF channel's upload of the same event stays in the
record as `video.lecture_ipf`. Some host uploads never show the laureate
large enough for a still — Academia Sinica's are slides with a small speaker
window, Tunghai's is a wide live stream — while the IPF camera did. The rule
is that the picture standing for a session is the laureate, from the Taiwan
lecture recording; the IPF recording IS that recording, so its frame stands
in. This cuts it the way scripts/cut-poster-frames.py does (same models, same
recognition against the official portrait, same thresholds) and writes
public/assets/posters/<source id>.webp. It does NOT touch
src/data/local-posters.json: add the line that maps the recording the page
plays to that file by hand, so the choice is visible in the diff —

    "-LsWML_Rtw0": "assets/posters/EJVC6_gZc5o.webp"
"""
import importlib.util, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / 'scripts'))          # cut-poster-frames imports facecheck from beside it
spec = importlib.util.spec_from_file_location('cpf', HERE / 'scripts/cut-poster-frames.py')
cpf = importlib.util.module_from_spec(spec); spec.loader.exec_module(cpf)

lid, src = sys.argv[1], sys.argv[2]
lectures = json.loads((HERE / 'src/data/lectures.json').read_text(encoding='utf-8'))['lectures']
lec = next(l for l in lectures if l['id'] == lid)
det, rec = cpf.models()
ref_vec, why = cpf.reference(det, rec, lid, lec['links'].get('nobel_facts', ''))
if ref_vec is None:
    sys.exit(f'{lid}: {why}')
got = cpf.stream(src)
if not got:
    sys.exit(f'{src}: no reachable stream')
url, seconds = got
top = cpf.sweep(url, seconds, det, rec, ref_vec, lid)
if not top:
    sys.exit(f'{lid}: not recognised anywhere in {src}')
score, sim, t, img = top[0]
path = cpf.write_still(img, src)
print(f'→ {path}  at {t / 60:.1f}m  score {score:.2f}  match {sim:.2f}')
print(f'now map the recording the page plays to it in src/data/local-posters.json')
