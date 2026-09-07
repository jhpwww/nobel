#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pick-posters.py — choose the card thumbnail for each lecture.

Two rules, both from the project owner:

  · the thumbnail comes from the **Taiwan lecture** recording, never the 導讀
  · it shows the **laureate's** face

Detection alone cannot do the second. Run over these recordings it happily
returns a face — on the printed banner behind the stage, on a slide, on a
member of the audience, on the host holding the microphone. Several of the
uploader-chosen thumbnails are designed promo cards rather than footage at
all, and one lecture's opens on a string quartet.

So this recognises rather than detects. Each laureate's official portrait is
read from the nobelprize.org page the catalogue already links to, embedded
with SFace, and every face in every candidate frame is compared against it.
A frame only wins if the person in it *is* the laureate.

Candidates are the three automatic frames YouTube samples from inside the
recording. `maxresdefault` is deliberately last: it is whatever the uploader
chose, which for this series is usually a title card. Where none of the three
holds the laureate, scripts/cut-poster-frames.py cuts a frame out of the
recording itself.

Writes two files.

  · src/data/posters.json — lecture id → frame suffix, for the card in a grid.
  · src/data/video-posters.json — YOUTUBE id → frame suffix, for every facade
    on a laureate's page: the Taiwan lecture, NTU's own recording of it, the
    導讀, the extra sittings and each interview.

Anything unmatched is omitted, and the reader falls back to the recording's
default thumbnail.

    .venv-cv/bin/python scripts/pick-posters.py [--report]
"""
import json
import pathlib
import sys

import cv2

from facecheck import best_face, decode, get, models, reference

HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = HERE / 'src/data/posters.json'
OUT_VID = HERE / 'src/data/video-posters.json'
SHOTS = HERE / 'assets-src/posters'

# Real frames from inside the recording first; the uploader's pick last,
# because in this series it is usually a designed title card.
CANDIDATES = ['hq1', 'hq2', 'hq3', 'maxresdefault']


def main() -> None:
    report = '--report' in sys.argv
    if report:
        SHOTS.mkdir(parents=True, exist_ok=True)

    lectures = json.loads((HERE / 'src/data/lectures.json').read_text(encoding='utf-8'))['lectures']
    det, rec = models()

    chosen: dict[str, str] = {}
    by_video: dict[str, str] = {}
    misses: list[str] = []

    def rank(vid: str, ref_vec) -> list:
        """Every candidate frame of one recording that has the laureate in it,
        best first. Returns (score, similarity, frame name, image, face box)."""
        out = []
        for name in CANDIDATES:
            img = decode(get(f'https://i.ytimg.com/vi/{vid}/{name}.jpg'))
            if img is None:
                continue
            best = best_face(det, rec, ref_vec, img)
            if best is not None:
                out.append((best[0], best[1], name, img, best[2]))
        return out

    def pick(results: list):
        # A hard preference, not a scoring nudge. A title card carries a large,
        # well-lit, dead-centre portrait and will out-score any real stage shot
        # every time — and a title card is not a 講座截圖. Take the best frame
        # from inside the recording whenever one recognises the laureate at
        # all, and only fall back to the uploader's pick when none does.
        inside = [r for r in results if r[2] != 'maxresdefault']
        pool = sorted(inside or results, key=lambda r: -r[0])
        return pool

    for lec in lectures:
        lid = lec['id']
        vid = lec['video'].get('lecture')
        if not vid:
            misses.append(f'{lid}: no Taiwan recording')
            continue

        ref_vec, why = reference(det, rec, lid, lec['links'].get('nobel_facts', ''))
        if ref_vec is None:
            misses.append(f'{lid}: {why}')
            print(f'{lid:<12} —  no reference portrait')
            continue

        # Every other recording this laureate appears in, verified the same
        # way. Their own page shows all of them.
        #
        # Except the 導讀. The owner asked for the lectures and the interviews
        # and named neither the guide videos nor anything else; a 導讀 is the
        # museum's own ninety-second introduction to a session, its cover is
        # the cover somebody made for it, and a frame of the laureate cut out
        # of the middle of one is not an improvement on that. It keeps the
        # uploader's pick, which is what stills.ts falls back to when nothing
        # is recorded here.
        others = [v for v in (
            lec['video'].get('lecture_ntu'),
            *[s.get('id') for s in lec['video'].get('extra_sessions', [])],
            *[i.get('id') for i in lec.get('interviews', [])],
        ) if v]
        for ov in others:
            op = pick(rank(ov, ref_vec))
            if op:
                by_video[ov] = op[0][2]

        results = rank(vid, ref_vec)

        if not results:
            misses.append(f'{lid}: laureate not recognised in any frame')
            print(f'{lid:<12} —  not recognised')
            continue

        inside = [r for r in results if r[2] != 'maxresdefault']
        pool = pick(results)
        s, sim, name, img, box = pool[0]
        chosen[lid] = name
        by_video[vid] = name
        rest = ' '.join(f'{n}:{v:.2f}' for v, _, n, _, _ in pool[1:])
        flag = '' if inside else '   ← title card, no in-video frame matched'
        print(f'{lid:<12} {name:<14} score {s:.2f}  match {sim:.2f}   ({rest}){flag}')

        if report:
            x, y, w, h = box
            cv2.rectangle(img, (x, y), (x + w, y + h), (80, 200, 255), 3)
            cv2.imwrite(str(SHOTS / f'{lid}-{name}.jpg'), img)

    OUT.write_text(json.dumps(chosen, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    OUT_VID.write_text(json.dumps(by_video, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(f'\n{len(chosen)}/{len(lectures)} recognised  →  {OUT}')
    if misses:
        print('\nfalling back to the default thumbnail:')
        for m in misses:
            print(' ', m)


if __name__ == '__main__':
    main()
