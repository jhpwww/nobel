#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-backdrop-clips.py — the short loops that play behind the halls.

Never a live youtube-nocookie embed: measured on the live site, one streamed
0.27–0.30 MB/s and never stopped — ten seconds of looking cost 7 MB, a minute
21 MB. For decoration behind a hall, at 38–50% opacity under a grading layer,
that is indefensible.

These are ten-second cuts, encoded small, that loop. A visitor downloads a few
hundred KB once and the traffic then goes to nothing however long they stay.
It also fixes mobile: a muted, playsinline <video> autoplays on iOS where a
cross-origin iframe never will.

The clips are excerpts of the lecture recordings, held only as background
decoration. Update the About page if this changes.

    python3 scripts/make-backdrop-clips.py [--probe]

--probe writes a contact sheet of the chosen frames so the cuts can be judged
before committing several minutes of encoding.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent
# the runner has ffmpeg on PATH; the working machine keeps a static build in .tools
FF = str(HERE / '.tools/ffmpeg') if (HERE / '.tools/ffmpeg').exists() else (shutil.which('ffmpeg') or 'ffmpeg')
YTDLP = 'yt-dlp'
RAW = HERE / 'assets-src/backdrop'
OUT = HERE / 'public/media/backdrop'
SECONDS = int(os.environ.get('CLIP_SECONDS') or 10)

# id → (youtube id, start). Starts are chosen to land on the speaker mid-talk,
# clear of title cards and applause, and verified from the probe sheet.
CLIPS = [
    ('geim',     'rcE23c82xUc', '00:07:30'),
    ('thooft',   'OHIoN7OcMTM', '00:09:10'),
    ('karman',   'q3V6sN0zE7c', '00:08:40'),
    ('kornberg', 'zBzFC9ODs1M', '00:11:20'),
    ('queloz',   'awXleH-HVEI', '00:10:05'),
    ('murad',    'K86pQuvw144', '00:09:45'),
]


# YouTube answers datacenter addresses — a CI runner, for one — with "sign in
# to confirm you're not a bot", and which player client it will serve without
# that challenge moves around. Rather than pin one and have the job break next
# month, try them in turn and take the first that yields a file.
CLIENTS = ['tv_simply', 'android_vr', 'web_safari', 'mweb', 'ios', 'default']


def grab(name: str, vid: str, start: str) -> pathlib.Path:
    """Pull just the needed seconds, not the whole recording."""
    RAW.mkdir(parents=True, exist_ok=True)
    dest = RAW / f'{name}.mp4'
    if dest.exists():
        return dest
    h, m, sec = (int(x) for x in start.split(':'))
    begin = h * 3600 + m * 60 + sec
    # a couple of seconds of slack, so the encoder has a keyframe to cut on
    section = f'*{begin}-{begin + SECONDS + 2}'

    last = ''
    for client in CLIENTS:
        r = subprocess.run([
            YTDLP, '--no-warnings', '--no-progress',
            '--extractor-args', f'youtube:player_client={client}',
            '--ffmpeg-location', str(pathlib.Path(FF).parent),
            '-f', 'bv*[height<=720]/bv*',
            '--download-sections', section, '--force-keyframes-at-cuts',
            '-o', str(dest), f'https://www.youtube.com/watch?v={vid}',
        ], capture_output=True, text=True)
        if dest.exists() and dest.stat().st_size > 0:
            print(f'  {name}: fetched via player_client={client}')
            return dest
        last = (r.stderr or r.stdout).strip().splitlines()[-1] if (r.stderr or r.stdout).strip() else ''
        print(f'  {name}: {client} failed — {last[:120]}')
    raise SystemExit(f'{name}: every player client refused. Last error: {last}')


def encode(src: pathlib.Path, name: str) -> tuple[float, float]:
    OUT.mkdir(parents=True, exist_ok=True)
    # 854x480 is generous for something shown at 40% opacity behind a grading
    # layer; the halls blur and darken it further.
    common = ['-y', '-i', str(src), '-t', str(SECONDS), '-an', '-sn',
              '-vf', 'scale=854:-2:flags=lanczos,fps=24']
    subprocess.run([FF, '-loglevel', 'error', *common,
                    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '44',
                    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
                    str(OUT / f'{name}.webm')], check=True)
    subprocess.run([FF, '-loglevel', 'error', *common,
                    '-c:v', 'libx264', '-crf', '32', '-preset', 'slow',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    str(OUT / f'{name}.mp4')], check=True)
    return ((OUT / f'{name}.webm').stat().st_size / 1024,
            (OUT / f'{name}.mp4').stat().st_size / 1024)


def main() -> None:
    probe = '--probe' in sys.argv
    sheet = []
    total_w = total_m = 0
    for name, vid, start in CLIPS:
        src = grab(name, vid, start)
        if probe:
            shot = RAW / f'{name}.png'
            subprocess.run([FF, '-loglevel', 'error', '-y', '-i', str(src),
                            '-vf', 'scale=320:-2', '-frames:v', '1', str(shot)], check=True)
            sheet.append(str(shot))
            print(f'{name:<10} frame → {shot}')
            continue
        w, m = encode(src, name)
        total_w += w
        total_m += m
        print(f'{name:<10} webm {w:6.0f}KB   mp4 {m:6.0f}KB')

    if probe:
        subprocess.run([FF, '-loglevel', 'error', '-y', *sum([['-i', s] for s in sheet], []),
                        '-filter_complex', f'hstack=inputs={len(sheet)}',
                        str(RAW / 'contact.png')], check=True)
        print(f'\n→ {RAW / "contact.png"}')
        return

    manifest = [{'id': n, 'webm': f'media/backdrop/{n}.webm', 'mp4': f'media/backdrop/{n}.mp4'}
                for n, _, _ in CLIPS]
    (HERE / 'src/data/backdrop.json').write_text(
        json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'\ntotal      webm {total_w:6.0f}KB   mp4 {total_m:6.0f}KB')
    print('→ src/data/backdrop.json')


if __name__ == '__main__':
    main()
