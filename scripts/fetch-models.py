#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch-models.py — pull the six category GLBs and record their provenance.

Every model here is someone else's work under a licence that asks for credit.
The provenance written by this script is what the page's attribution block and
the per-model HTML comments are generated from, so the credit cannot drift
away from the file it belongs to.

Sources are re-read from the model page at fetch time rather than typed in by
hand, so the author and licence recorded are the ones the host is actually
publishing today.
"""
import json
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
poly = import_module('poly-search')

# category → Poly Pizza model id.  Chosen for being read-at-a-glance at icon
# size, and for matching what this collection's lectures are actually about:
# the physics here is largely observational, the medicine largely molecular.
PICKS = {
    'chemistry':  'eqIGxcsBe1V',  # Erlenmeyer flask
    'medicine':   '0e5xgkdcuEW',  # DNA
    'peace':      '2jmH3trzPFf',  # Dove
    'literature': '9RjoPxajS8Z',  # Quill and parchment
}

RAW = pathlib.Path('assets-src/models')
RAW.mkdir(parents=True, exist_ok=True)

# merge, never overwrite: build-models.mjs writes into the same file, and
# running either script alone must still leave a complete set
CREDITS = pathlib.Path('data/model-credits.json')
out = json.loads(CREDITS.read_text(encoding='utf-8')) if CREDITS.exists() else {}
# The owner has drawn all six awards, so every name here is now a supplied
# model and this script has nothing left to download. It refuses rather than
# overwrites: assets-src/models/<cat>.glb IS the source for each of them.
SUPPLIED = {'physics', 'chemistry', 'medicine', 'peace', 'economics', 'literature'}

for cat, mid in PICKS.items():
    if cat in SUPPLIED:
        print(f"{cat:11} skipped — the owner's own sculpture stands here")
        continue
    meta = poly.model(mid)
    if not meta:
        raise SystemExit(f'{cat}: could not read model page for {mid}')
    dest = RAW / f'{cat}.glb'
    subprocess.run(['curl', '-sL', '--max-time', '60', '-A', poly.UA,
                    meta['glb'], '-o', str(dest)], check=True)
    meta['bytes'] = dest.stat().st_size
    meta['source'] = 'poly'
    out[cat] = meta
    print(f'{cat:<11} {meta["bytes"]/1024:7.0f}KB  {meta["licence"]:<6} '
          f'{meta["title"]:<22} — {meta["author"]}')

CREDITS.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'\n→ {CREDITS}')
