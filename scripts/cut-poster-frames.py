#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cut-poster-frames.py — cut a still of the laureate out of the recording.

scripts/pick-posters.py chooses among the four frames YouTube samples for a
video, and for most of this series that is enough. For some of it there is
nothing to choose from: none of the four holds the laureate at all. What they
hold instead is whoever opened the session — a host at a lectern, an
introducer mid-sentence, a designed title card, and in Queloz's case a string
quartet. Seven lectures have no verified frame and three more fall back on the
uploader's title card.

So this goes into the recording itself. It samples frames across the whole of
it, recognises the laureate in them the same way the picker does — their
official portrait from nobelprize.org, embedded with SFace, and a frame only
counts if the person in it IS them — and writes the best one out as the
session's representative image.

WHY IT RUNS ON A RUNNER
The working machine's network routes googlevideo.com to a TANet edge that
refuses 443: yt-dlp reaches YouTube's metadata there and never its media. A
runner has open internet. Same reason the backdrop clips are cut in CI, and
.github/workflows/poster-frames.yml is that job.

WHAT IT WRITES
  · public/assets/posters/<youtube id>.webp   the still
  · src/data/local-posters.json               youtube id → its path

A local still wins over a YouTube frame wherever both exist; see
VideoFacade.astro and LectureCard.astro, which read the two in that order.
One frame identifying a session is what the About page's rights note
describes, in both languages.

    python3 scripts/cut-poster-frames.py [--only id,id] [--all] [--report]
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import cv2

from facecheck import best_face, models, reference, sharpness

HERE = pathlib.Path(__file__).resolve().parent.parent
LECTURES = HERE / 'src/data/lectures.json'
VIDEO_POSTERS = HERE / 'src/data/video-posters.json'
OUT_DIR = HERE / 'public/assets/posters'
OUT_MAP = HERE / 'src/data/local-posters.json'
SHOTS = HERE / 'assets-src/posters'

#: Recordings the owner named as showing the wrong person, which the picker
#: nevertheless found a frame for. A frame cut from inside the recording is a
#: better picture of the session than the best of four thumbnails either way,
#: so these are done as well as the ones with nothing at all.
FLAGGED = {
    'WlxbaXqWXAs',   # Stiglitz — the lecture
    'yAL6mkgehbg',   # Roberts — the CommonWealth interview
    'GoVWwoxZZ2A',   # Roberts — the Storm interview
    'yhZhymmeaso',   # Frank — the lecture
}

#: Where in the recording to look. Not the opening, which is the host and the
#: introduction, and not the end, which is applause and an empty stage.
FIRST, LAST, COARSE = 0.10, 0.92, 26
#: and then either side of whatever the coarse pass liked best
FINE_SPAN, FINE_STEP = 12.0, 2.0

#: 16:9, the shape every poster slot on the site is cut to
OUT_W, OUT_H = 1280, 720
WEBP_QUALITY = 86


def run(cmd: list[str], timeout: int = 180) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, timeout=timeout)


def stream(vid: str) -> tuple[str, float] | None:
    """A directly seekable video stream and how long it runs.

    Video only, and no bigger than 720p: this reads single frames over HTTP
    range requests rather than downloading anything, so the smaller and the
    more seekable the stream the better. avc1 first because ffmpeg seeks it
    without having to decode from the start of a segment.
    """
    url = f'https://www.youtube.com/watch?v={vid}'
    fmt = ('bv*[height<=720][vcodec^=avc1]/bv*[height<=720]/'
           'b[height<=720][vcodec^=avc1]/b[height<=720]/b')
    r = run(['yt-dlp', '-f', fmt, '--print', '%(duration)s', '--print', 'urls',
             '--no-warnings', url], timeout=240)
    if r.returncode != 0:
        print(f'   yt-dlp failed: {r.stderr.decode()[:200].strip()}')
        return None
    lines = [ln for ln in r.stdout.decode().splitlines() if ln.strip()]
    if len(lines) < 2:
        return None
    try:
        seconds = float(lines[0])
    except ValueError:
        return None
    return lines[-1], seconds


def frame_at(url: str, t: float):
    """One frame, decoded, or None. `-ss` before `-i` is the fast seek: ffmpeg
    range-requests its way to the keyframe instead of reading the file."""
    r = run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{t:.2f}',
             '-i', url, '-frames:v', '1', '-f', 'image2', '-vcodec', 'mjpeg',
             '-q:v', '2', '-'], timeout=120)
    if r.returncode != 0 or not r.stdout:
        return None
    import numpy as np
    return cv2.imdecode(np.frombuffer(r.stdout, np.uint8), cv2.IMREAD_COLOR)


def sweep(url: str, seconds: float, det, rec, ref_vec, label: str):
    """Every sampled frame the laureate is in, best first.

    Two passes. A coarse one across the whole recording finds where they are
    on camera at all; a fine one either side of the best hit finds the frame
    where they are looking up rather than mid-blink. The second pass is what
    makes the difference between a usable portrait and a smear — a lecture
    cuts between speaker and slide every few seconds.
    """
    hits: list[tuple[float, float, float, object]] = []
    span = seconds * (LAST - FIRST)
    times = [seconds * FIRST + span * i / (COARSE - 1) for i in range(COARSE)]
    for t in times:
        img = frame_at(url, t)
        if img is None:
            continue
        best = best_face(det, rec, ref_vec, img)
        if best is None:
            continue
        hits.append((best[0], best[1], t, img))
        print(f'   {label} {t / 60:5.1f}m  score {best[0]:.2f}  match {best[1]:.2f}')
    if not hits:
        return []

    hits.sort(key=lambda h: -h[0])
    around = hits[0][2]
    fine = [around + d for d in
            [x * FINE_STEP for x in range(-int(FINE_SPAN / FINE_STEP),
                                          int(FINE_SPAN / FINE_STEP) + 1)]
            if 0 < around + d < seconds]
    for t in fine:
        if any(abs(t - h[2]) < 0.5 for h in hits):
            continue
        img = frame_at(url, t)
        if img is None:
            continue
        best = best_face(det, rec, ref_vec, img)
        if best is None:
            continue
        hits.append((best[0], best[1], t, img))

    # A frame cut mid-pan is the right person, blurred. Sharpness is a tie
    # breaker rather than a term in the score: it separates two frames of the
    # same shot, and says nothing useful across different ones.
    top = sorted(hits, key=lambda h: -h[0])[:6]
    top.sort(key=lambda h: -(h[0] + 0.06 * min(1.0, sharpness(h[3]) / 400.0)))
    return top


def write_still(img, vid: str) -> str:
    """The still, cut to the shape every poster slot on the site uses."""
    h, w = img.shape[:2]
    want = OUT_W / OUT_H
    if w / h > want:                       # too wide: take the middle
        cut = int(h * want)
        x = (w - cut) // 2
        img = img[:, x:x + cut]
    else:                                  # too tall: take the upper middle,
        cut = int(w / want)                # which is where a standing speaker is
        y = min(h - cut, int((h - cut) * 0.35))
        img = img[max(0, y):max(0, y) + cut, :]
    img = cv2.resize(img, (OUT_W, OUT_H), interpolation=cv2.INTER_AREA)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f'{vid}.webp'
    cv2.imwrite(str(path), img, [cv2.IMWRITE_WEBP_QUALITY, WEBP_QUALITY])
    return f'assets/posters/{vid}.webp'


def targets(lectures: list, verified: dict) -> list[tuple[str, str, str, str]]:
    """(youtube id, lecture id, facts url, what this recording is).

    Anything with no verified frame, anything falling back on the uploader's
    title card, and anything the owner named. Stated as a rule rather than as
    a list so that a new session, or a re-run of the picker that loses a
    match, is picked up without anyone remembering to add it here.
    """
    out = []
    for lec in lectures:
        v, lid = lec['video'], lec['id']
        facts = lec['links'].get('nobel_facts', '')
        rows = [('lecture', v.get('lecture')),
                ('lecture_ntu', v.get('lecture_ntu')),
                ('guide', v.get('guide'))]
        rows += [(f"extra:{s.get('label', '')}", s.get('id'))
                 for s in v.get('extra_sessions', [])]
        rows += [(f"interview:{i.get('source', '')}", i.get('id'))
                 for i in lec.get('interviews', [])]
        for what, vid in rows:
            if not vid:
                continue
            frame = verified.get(vid)
            if frame in (None, 'maxresdefault') or vid in FLAGGED:
                out.append((vid, lid, facts, what))
    return out


def main() -> None:
    only = None
    for i, a in enumerate(sys.argv):
        if a == '--only' and i + 1 < len(sys.argv):
            only = {s.strip() for s in sys.argv[i + 1].split(',') if s.strip()}
    report = '--report' in sys.argv

    lectures = json.loads(LECTURES.read_text(encoding='utf-8'))['lectures']
    verified = json.loads(VIDEO_POSTERS.read_text(encoding='utf-8'))
    have = json.loads(OUT_MAP.read_text(encoding='utf-8')) if OUT_MAP.exists() else {}

    todo = targets(lectures, verified)
    if only:
        todo = [t for t in todo if t[0] in only]
    elif '--all' not in sys.argv:
        # already cut, and the file is still there: leave it alone
        todo = [t for t in todo
                if t[0] not in have or not (HERE / 'public' / have[t[0]]).exists()]

    print(f'{len(todo)} recording(s) to cut\n')
    det, rec = models()
    refs: dict[str, object] = {}
    done, failed = 0, []

    for vid, lid, facts, what in todo:
        print(f'{lid} · {what} · {vid}')
        if lid not in refs:
            ref_vec, why = reference(det, rec, lid, facts)
            if ref_vec is None:
                print(f'   {why}')
                failed.append(f'{lid} {what}: {why}')
                continue
            refs[lid] = ref_vec
        got = stream(vid)
        if not got:
            failed.append(f'{lid} {what}: no reachable stream')
            continue
        url, seconds = got
        top = sweep(url, seconds, det, rec, refs[lid], lid)
        if not top:
            print('   laureate not recognised anywhere in the recording')
            failed.append(f'{lid} {what}: not recognised in {COARSE} sampled frames')
            continue
        score, sim, t, img = top[0]
        if report:
            SHOTS.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(SHOTS / f'cut-{lid}-{vid}.jpg'), img)
        have[vid] = write_still(img, vid)
        done += 1
        print(f'   → {have[vid]}  at {t / 60:.1f}m  score {score:.2f}  match {sim:.2f}\n')

    OUT_MAP.write_text(json.dumps(have, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(f'\n{done} still(s) cut  →  {OUT_MAP}')
    if failed:
        print('\nstill on the recording\'s own thumbnail:')
        for f in failed:
            print(' ', f)


if __name__ == '__main__':
    main()
