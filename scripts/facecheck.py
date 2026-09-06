#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
facecheck.py — is the person in this picture the laureate?

The one question both poster scripts ask, and neither can answer with
detection alone. Run over these recordings a detector happily returns a face:
on the printed banner behind the stage, on a slide, on a member of the
audience, on the host holding the microphone. So the museum recognises rather
than detects — each laureate's official portrait is read from the
nobelprize.org page the catalogue already links to, embedded with SFace, and
every face in every candidate frame is compared against it.

  · scripts/pick-posters.py   chooses among the four frames YouTube samples
  · scripts/cut-poster-frames.py  cuts one out of the recording itself, for
    the sessions where none of those four holds the laureate at all

Both need the same portrait, the same detector, the same threshold and the
same idea of what makes one frame a better picture of a person than another,
which is why those live here rather than in either of them.

Needs the two OpenCV Zoo models in .tools/ — download-models() below says
where they come from; the CI job that calls this fetches them itself.
"""
from __future__ import annotations

import html
import pathlib
import re
import subprocess

import cv2
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent.parent
DETECT = HERE / '.tools/yunet.onnx'
RECOGNISE = HERE / '.tools/sface.onnx'
CACHE = HERE / 'assets-src/portraits'

DETECT_CONF = 0.70
#: SFace's own documented same-person threshold for cosine similarity. Lower
#: values let through the audience member in the third row who happens to be a
#: grey-haired man in a dark suit — which, at a lecture like these, is most of
#: the third row. Better to fail loudly and let a human supply the still.
SAME_PERSON = 0.363

UA = 'Mozilla/5.0 (compatible; nobel-museum-poster-picker/1.0)'


def get(url: str) -> bytes:
    r = subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, url],
                       capture_output=True)
    return r.stdout if r.returncode == 0 else b''


def decode(raw: bytes) -> np.ndarray | None:
    if not raw:
        return None
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    # YouTube answers a missing size with a small grey placeholder
    return None if img is None or img.shape[0] < 180 else img


def models() -> tuple:
    """The detector and the recogniser, or a plain exit saying what is missing."""
    for m in (DETECT, RECOGNISE):
        if not m.exists():
            raise SystemExit(f'{m} missing — OpenCV Zoo face_detection_yunet '
                             'and face_recognition_sface; the CI job fetches them')
    return (cv2.FaceDetectorYN.create(str(DETECT), '', (320, 320), 0.6),
            cv2.FaceRecognizerSF.create(str(RECOGNISE), ''))


def portrait(lid: str, facts_url: str) -> np.ndarray | None:
    """The laureate's official portrait, cached so reruns are cheap."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f'{lid}.jpg'
    if cached.exists():
        return cv2.imread(str(cached))
    page = html.unescape(get(facts_url).decode('utf-8', 'replace'))
    urls = re.findall(r'https://www\.nobelprize\.org/images/[^"\'\s]+\.(?:jpg|jpeg|png)', page)
    # the portrait crop is tighter on the face than the landscape one
    urls.sort(key=lambda u: (0 if 'portrait' in u else 1, len(u)))
    for u in urls:
        img = decode(get(u))
        if img is not None:
            cached.write_bytes(get(u))
            return img
    return None


def faces(det, img: np.ndarray):
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, found = det.detect(img)
    return [] if found is None else [f for f in found if f[-1] >= DETECT_CONF]


def reference(det, rec, lid: str, facts_url: str):
    """The embedding of the laureate's own face, or None with a reason."""
    img = portrait(lid, facts_url)
    if img is None:
        return None, 'no official portrait'
    found = faces(det, img)
    if not found:
        return None, 'no usable official portrait'
    return rec.feature(rec.alignCrop(img, found[0])), ''


def best_face(det, rec, ref_vec, img: np.ndarray):
    """The laureate in this frame, if they are in it.

    Returns (score, similarity, box) or None. The score is what decides
    between two frames that both hold the laureate: how sure the match is,
    how much of the frame the face fills — a portrait against a speck on a
    distant stage — and how near the middle it sits.
    """
    h, w = img.shape[:2]
    best = (0.0, 0.0, None)
    for f in faces(det, img):
        sim = rec.match(ref_vec, rec.feature(rec.alignCrop(img, f)),
                        cv2.FaceRecognizerSF_FR_COSINE)
        if sim < SAME_PERSON:
            continue
        x, y, fw, fh = f[0], f[1], f[2], f[3]
        size = min(1.0, (fh / h) / 0.30)
        cx, cy = (x + fw / 2) / w, (y + fh / 2) / h
        central = 1.0 - min(1.0, abs(cx - 0.5) * 1.2 + abs(cy - 0.45) * 0.7)
        sc = 0.50 * float(sim) + 0.32 * size + 0.18 * central
        if sc > best[0]:
            best = (sc, float(sim), (int(x), int(y), int(fw), int(fh)))
    return None if best[2] is None else best


def sharpness(img: np.ndarray) -> float:
    """Variance of the Laplacian, normalised. A frame cut mid-pan is a smear
    of the right person, which is worse than a still frame of them."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())
