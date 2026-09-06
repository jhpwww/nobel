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
import shutil
import subprocess
import sys

import cv2

from facecheck import ALIVE, iou, matches, models, moved, reference, sharpness

HERE = pathlib.Path(__file__).resolve().parent.parent
LECTURES = HERE / 'src/data/lectures.json'
VIDEO_POSTERS = HERE / 'src/data/video-posters.json'
OUT_DIR = HERE / 'public/assets/posters'
OUT_MAP = HERE / 'src/data/local-posters.json'
SHOTS = HERE / 'assets-src/posters'

# the runner has both on PATH; the working machine keeps a static ffmpeg in
# .tools and yt-dlp wherever pip put it
FF = str(HERE / '.tools/ffmpeg') if (HERE / '.tools/ffmpeg').exists() else (shutil.which('ffmpeg') or 'ffmpeg')
YTDLP = shutil.which('yt-dlp') or 'yt-dlp'

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
    r = run([YTDLP, '-f', fmt, '--print', '%(duration)s', '--print', 'urls',
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
    r = run([FF, '-nostdin', '-loglevel', 'error', '-ss', f'{t:.2f}',
             '-i', url, '-frames:v', '1', '-f', 'image2', '-vcodec', 'mjpeg',
             '-q:v', '2', '-'], timeout=120)
    if r.returncode != 0 or not r.stdout:
        return None
    import numpy as np
    return cv2.imdecode(np.frombuffer(r.stdout, np.uint8), cv2.IMREAD_COLOR)


def printed(hits: list) -> list[tuple]:
    """The faces in this recording that are not a person but a picture of one.

    Every one of these lectures is given in front of a printed banner carrying
    the laureate's own portrait, and half of them cut to a title slide that
    carries it too. Recognition says yes to those, correctly and uselessly:
    the first still this cut for Kobilka was an empty stage with his poster on
    the back wall.

    What separates the two is that a printed face does not move. So the boxes
    are compared across the whole sweep, and any that lands in the same place
    to within a fifth of its own area at three or more widely separated times
    is a fixture in the room rather than someone standing in it.
    """
    fixtures = []
    for i, (t, box, _sc, _sim) in enumerate(hits):
        agree = [u for u, b2, _s, _m in hits
                 if abs(u - t) > 45 and iou(box, b2) > 0.72]
        if len(agree) >= 2 and (max(agree) - min(agree)) > 240:
            fixtures.append(box)
    return fixtures


def sweep(url: str, seconds: float, det, rec, ref_vec, label: str):
    """Every sampled frame the laureate is really in, best first.

    Two passes and a filter. A coarse pass across the whole recording finds
    where they are on camera at all; the filter throws away the faces that are
    printed on the room rather than in it — see printed(); and a fine pass
    either side of the best survivor finds the frame where they are looking up
    rather than mid-blink. That last pass is what makes the difference between
    a usable portrait and a smear: a lecture cuts between speaker and slide
    every few seconds.
    """
    seen: list[tuple[float, tuple, float, float]] = []   # t, box, score, sim
    frames: dict[float, object] = {}

    def probe(t: float) -> None:
        if t in frames or t <= 0 or t >= seconds:
            return
        img = frame_at(url, t)
        if img is None:
            return
        frames[t] = img
        for sc, sim, box in matches(det, rec, ref_vec, img):
            seen.append((t, box, sc, sim))

    span = seconds * (LAST - FIRST)
    for i in range(COARSE):
        probe(seconds * FIRST + span * i / (COARSE - 1))

    fixed = printed(seen)
    live = [h for h in seen if not any(iou(h[1], f) > 0.72 for f in fixed)]
    if fixed:
        print(f'   {label} — {len(fixed)} face(s) printed on the room, set aside')
    if not live:
        return []

    around = max(live, key=lambda h: h[2])[0]
    for d in range(-int(FINE_SPAN / FINE_STEP), int(FINE_SPAN / FINE_STEP) + 1):
        probe(around + d * FINE_STEP)
    fixed = printed(seen)
    live = [h for h in seen if not any(iou(h[1], f) > 0.72 for f in fixed)]
    if not live:
        return []

    # ---- and the last of the printed ones ----
    # The test above catches a face the camera never reframes. A lecture that
    # cuts between a wide shot and a close one shows the same banner at two
    # different sizes, and that one gets through — so the best few are asked
    # the question a picture cannot answer: did this face change at all in
    # half a second?
    #
    # Worked down the whole list, not just the best few. On Kobilka's lecture
    # every one of the top eight was the banner at a different zoom, and
    # stopping there answered 'not recognised' for a recording he is in.
    alive: list[tuple] = []
    checked = 0
    for t, box, sc, sim in sorted(live, key=lambda h: -h[2]):
        if len(alive) >= 5 or checked >= 34:
            break
        checked += 1
        nxt = frame_at(url, t + 0.5)
        d = 99.0 if nxt is None else moved(frames[t], nxt, box)
        state = 'printed' if d < ALIVE else ''
        print(f'   {label} {t / 60:5.1f}m  score {sc:.2f}  match {sim:.2f}  '
              f'moved {d:5.2f} {state}')
        if d >= ALIVE:
            alive.append((t, box, sc, sim))
    if not alive:
        return []

    # A frame cut mid-pan is the right person, blurred. Sharpness is a tie
    # breaker rather than a term in the score: it separates two frames of the
    # same shot, and says nothing useful across different ones.
    top = sorted(alive, key=lambda h: -h[2])[:6]
    top.sort(key=lambda h: -(h[2] + 0.06 * min(1.0, sharpness(frames[h[0]]) / 400.0)))
    return [(sc, sim, t, frames[t]) for t, box, sc, sim in top]


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
            # never leave an earlier, worse still standing for a target that
            # has just been re-cut and failed
            old = have.pop(vid, None)
            if old:
                (HERE / 'public' / old).unlink(missing_ok=True)
                print(f'   removed {old}')
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
