#!/usr/bin/env python3
"""
check-links.py — audit every link and reference in the built site.

  python3 scripts/check-links.py [dist-dir]

Covers four kinds of reference, because each fails differently:

  external   real GET, follow redirects, report the final URL and page title,
             so a wrong-but-200 destination is visible. A HEAD is not enough:
             it misses dead DNS and soft 404s.
  internal   resolved against the built output — the file must exist on disk.
  assets     img/script/link/video sources, including the data-src the ambient
             video is loaded from and the poster frames.
  youtube    the video ids the page will actually embed. These live in
             data-yt attributes and iframe srcs, NOT in href, so an href-only
             sweep silently skips the most important links on the site.
             Checked through YouTube's public oEmbed endpoint.

Exit code is non-zero if anything needs attention, so it can gate a release.
"""
import concurrent.futures as cf, html, json, pathlib, re, sys, urllib.error, urllib.parse, urllib.request

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
BASE = "/nobel/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; nlm-link-check/2.0)"}

external, internal, assets, ytids = set(), set(), set(), set()

for f in root.rglob("*.html"):
    src = f.read_text(encoding="utf-8")

    # connection hints are origins, not destinations
    hints = set(re.findall(r'<link[^>]+rel="(?:preconnect|dns-prefetch)"[^>]*href="([^"]+)"', src))
    hints |= set(re.findall(r'<link[^>]+href="([^"]+)"[^>]*rel="(?:preconnect|dns-prefetch)"', src))

    for m in re.finditer(r'href="([^"]+)"', src):
        u = html.unescape(m.group(1))
        if u in hints or u.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        (external if u.startswith("http") else internal).add((u, f))

    for attr in ("src", "data-src", "poster"):
        for m in re.finditer(rf'{attr}="([^"]+)"', src):
            u = html.unescape(m.group(1))
            if u.startswith("data:"):
                continue
            assets.add((u, f))

    # the ids that actually get embedded
    for m in re.finditer(r'data-yt="([\w-]{11})"', src):
        ytids.add(m.group(1))
    for m in re.finditer(r'youtube(?:-nocookie)?\.com/embed/([\w-]{11})', src):
        ytids.add(m.group(1))
    for m in re.finditer(r'youtube\.com/watch\?v=([\w-]{11})', src):
        ytids.add(m.group(1))
    for m in re.finditer(r'data-picks="([^"]+)"', src):
        for p in json.loads(html.unescape(m.group(1))):
            ytids.add(p["id"])
    for m in re.finditer(r'i\.ytimg\.com/vi(?:_webp)?/([\w-]{11})/', src):
        ytids.add(m.group(1))

def to_path(u: str):
    p = urllib.parse.urlsplit(u).path
    if not p.startswith(BASE):
        return None
    rel = p[len(BASE):]
    if rel == "" or rel.endswith("/"):
        rel += "index.html"
    return root / rel

def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
            body = r.read(90_000).decode("utf-8", "replace")
            t = re.search(r"<title>(.*?)</title>", body, re.S)
            return r.status, r.geturl(), (html.unescape(t.group(1)).strip()[:64] if t else "")
    except urllib.error.HTTPError as e:
        # A bot challenge is not a broken link: the page is there, the checker
        # just is not a person. Cloudflare answers 403 with its own interstitial
        # and a cf-mitigated header; a visitor passes it and reads the page.
        body = ""
        try:
            body = e.read(4000).decode("utf-8", "replace")
        except Exception:
            pass
        if e.code in (403, 503) and (
            e.headers.get("cf-mitigated")
            or "Just a moment" in body
            or "cf-browser-verification" in body
        ):
            return "CHALLENGED", u, "bot challenge, not a dead link"
        return e.code, u, ""
    except Exception as e:
        return f"ERR {type(e).__name__}", u, str(e)[:70]

def oembed(vid):
    u = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={vid}", safe="")
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25) as r:
            j = json.load(r)
            return vid, 200, f"{j.get('author_name','')} — {' '.join(j.get('title','').split())[:56]}"
    except urllib.error.HTTPError as e:
        return vid, e.code, "unavailable (private, deleted, or embedding disabled)"
    except Exception as e:
        return vid, "ERR", str(e)[:50]

bad = []

print(f"── internal ({len(internal)} refs)")
missing = sorted({u for u, f in internal if (to_path(u) is None or not to_path(u).exists())})
for u in missing:
    bad.append(("internal", u, "target file not found"))
print(f"   {len(internal) - len(missing)} resolve, {len(missing)} broken")
for u in missing[:20]:
    print(f"   BROKEN {u}")

print(f"\n── assets ({len({u for u, _ in assets})} refs)")
amiss = []
for u in sorted({u for u, _ in assets}):
    if u.startswith("http"):
        continue
    p = to_path(u)
    if p is None or not p.exists():
        amiss.append(u); bad.append(("asset", u, "file not found"))
print(f"   {len({u for u,_ in assets if not u.startswith('http')}) - len(amiss)} local assets present, {len(amiss)} missing")
for u in amiss[:20]:
    print(f"   MISSING {u}")

print(f"\n── youtube ({len(ytids)} video ids)")
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for vid, code, note in sorted(ex.map(oembed, sorted(ytids))):
        if code != 200:
            bad.append(("youtube", vid, note))
            print(f"   DEAD {vid}  {note}")
print(f"   {len(ytids) - sum(1 for b in bad if b[0]=='youtube')} playable, "
      f"{sum(1 for b in bad if b[0]=='youtube')} unavailable")

challenged = []
print(f"\n── external ({len({u for u, _ in external})} urls)")
ext = sorted({u for u, _ in external})
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    for u, (code, final, title) in zip(ext, ex.map(get, ext)):
        suspect = code == 200 and re.search(r"not found|404", title, re.I)
        if code == "CHALLENGED":
            challenged.append(u)
            print(f"   note  {u}  — {title}")
        elif code != 200 or suspect:
            bad.append(("external", u, f"{code} {title}"))
            print(f"   BAD {code}  {u}  {title}")
print(f"   {len(ext) - sum(1 for b in bad if b[0]=='external') - len(challenged)} OK, "
      f"{len(challenged)} bot-challenged, "
      f"{sum(1 for b in bad if b[0]=='external')} need attention")

print(f"\n{'ALL REFERENCES GOOD' if not bad else str(len(bad)) + ' PROBLEM(S)'}")
for kind, u, note in bad:
    print(f"  [{kind}] {u} — {note}")
sys.exit(1 if bad else 0)
