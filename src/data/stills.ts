/**
 * stills.ts — the picture that stands for a recording.
 *
 * Three sources, in this order, and the order is the whole point:
 *
 *  1. a frame cut out of the recording itself, where one was needed —
 *     src/data/local-posters.json, written by the CI job in
 *     .github/workflows/poster-frames.yml
 *  2. the best of the four frames YouTube samples, where the laureate was
 *     recognised in one — src/data/video-posters.json
 *  3. the uploader's own thumbnail, which for this series is very often the
 *     person who opened the session rather than the laureate
 *
 * Ten sessions never reach (2): none of the four frames YouTube offers holds
 * the laureate at all — a host at a lectern, an introducer mid-sentence, a
 * title card, and in Queloz's case a string quartet. Those are what (1) is
 * for. See scripts/pick-posters.py for the verification and
 * scripts/cut-poster-frames.py for the cutting; both recognise rather than
 * detect, against the laureate's own official portrait.
 *
 * The 導讀 are not in either file and are not meant to be. What was asked for
 * was the lectures and the interviews — the recordings where the picture
 * standing for the session was the person who introduced it rather than the
 * laureate. A guide video is the museum's own ninety seconds on a session and
 * its cover was made for it, so all six fall straight through to (3), which
 * is the uploader's pick and in their case the right one.
 */
import videoFrames from './video-posters.json';
import localStills from './local-posters.json';
import { asset } from '../i18n/routing';

const local = localStills as Record<string, string>;
const frames = videoFrames as Record<string, string>;

/** A still cut from the recording, if this session has one. */
export const cutStill = (yt: string): string | null =>
  local[yt] ? asset(local[yt]) : null;

/**
 * What to show, and what to show it at twice the width.
 *
 * A cut still is one file at 1280x720 and is its own large size; a YouTube
 * frame comes in two, and `maxresdefault` is the only large one YouTube keeps
 * for every video.
 */
export function still(yt: string, fallback = 'hqdefault') {
  const cut = cutStill(yt);
  if (cut) return { src: cut, hi: cut, cut: true };
  const frame = frames[yt] ?? fallback;
  return {
    src: `https://i.ytimg.com/vi/${yt}/${frame}.jpg`,
    hi: `https://i.ytimg.com/vi/${yt}/${frames[yt] === 'maxresdefault' || !frames[yt] ? 'maxresdefault' : frames[yt]}.jpg`,
    cut: false,
  };
}
