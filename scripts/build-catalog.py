#!/usr/bin/env python3
"""
build-catalog.py — merge verified facts (seed-catalog.py) with editorial copy
(copy-zh-en.py) into src/data/lectures.json, which the site imports.

  python3 scripts/build-catalog.py

Fails loudly on a missing or unknown field rather than emitting a plausible
default. Never hand-edit src/data/lectures.json.
"""
import json, pathlib, importlib.util, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

copy = load("copy", "scripts/copy-zh-en.py")
gal  = load("gal",  "scripts/copy-galleries.py")
cat  = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))

errors = []


def merge_copy(records, table, what):
    """Fold editorial copy into verified facts, or fail loudly.

    Two collections, one function: the 31 臺灣橋樑計畫 lectures take `COPY`, the
    臺大「諾貝爾獎得主講座」 records take `NTU_COPY`. Neither may borrow the
    other's key — an id that appears in the wrong table is a missing entry
    here, which is exactly the error we want.
    """
    for rec in records:
        c = table.get(rec["id"])
        if not c:
            errors.append(f"{what} {rec['id']}: no editorial copy"); continue
        for f in ("title_zh", "hook_zh", "hook_en", "summary_zh", "summary_en", "tags"):
            if not c.get(f):
                errors.append(f"{what} {rec['id']}: empty {f}")
        for t in c["tags"]:
            if t not in copy.TAGS:
                errors.append(f"{what} {rec['id']}: unknown tag {t}")
        rec["title"]["zh"]       = c["title_zh"]
        rec["hook"]              = {"zh": c["hook_zh"], "en": c["hook_en"]}
        rec["description"]["zh"] = c["summary_zh"]
        rec["description"]["en"] = c["summary_en"]
        rec["topic_tags"]        = c["tags"]


merge_copy(cat["lectures"], copy.COPY, "lecture")
merge_copy(cat.get("ntu_lectures", []), copy.NTU_COPY, "ntu")

# Two collections, one museum, and the ids must never collide: a lecture page
# is routed by id alone, so a duplicate would be two pages at one address.
_seen = {}
for group in ("lectures", "ntu_lectures"):
    for rec in cat.get(group, []):
        if rec["id"] in _seen:
            errors.append(f"duplicate id {rec['id']}: {_seen[rec['id']]} and {group}")
        _seen[rec["id"]] = group

if errors:
    print("BUILD FAILED:", file=sys.stderr)
    for e in errors: print("  -", e, file=sys.stderr)
    sys.exit(1)

cat["tags"] = {k: {"zh": v[0], "en": v[1]} for k, v in copy.TAGS.items()}
# The six prize categories. Nobel's will lists Literature fourth, but this
# series brought no Literature laureate, so it stands at the far right rather
# than leaving a gap mid-row. `nobel` is not a prize category — it is the
# introduction room, and the hall presents it separately.
cat["categories"] = {
    # The label is the short form; the prize keeps its own name, which is
    # 諾貝爾物理學獎 and not 諾貝爾物理獎.
    "physics":    {"zh": "物理", "prize_zh": "物理學",
                                   "en": "Physics",                "order": 1},
    "chemistry":  {"zh": "化學",        "en": "Chemistry",              "order": 2},
    "medicine":   {"zh": "生理學或醫學",  "en": "Physiology or Medicine", "order": 3},
    "peace":      {"zh": "和平",        "en": "Peace",                  "order": 4},
    "economics":  {"zh": "經濟學",      "en": "Economic Sciences",      "order": 5},
    "literature": {"zh": "文學",        "en": "Literature",             "order": 6},
}
# Two subjects, one connector. Chinese has no spaces, so the 與 is set smaller
# to keep 諾貝爾 and 諾貝爾獎 legible as separate things; English gets the same
# treatment on "and" for consistency.
cat["intro"] = {
    "key": "nobel",
    "zh": "諾貝爾與諾貝爾獎",
    "en": "Nobel and the Nobel Prize",
    "parts": {"zh": ["諾貝爾", "與", "諾貝爾獎"],
              "en": ["Nobel", "and", "the Nobel Prize"]},
}

# ---- gallery material: editorial prose + counted facts + verified links ----
facts = json.loads((ROOT / "data" / "prize-facts.json").read_text(encoding="utf-8"))
cat["prize_facts_asof"] = facts["fetched"]
cat["stat_labels"] = gal.STAT_LABELS
for key, meta in cat["categories"].items():
    g = gal.GALLERIES.get(key)
    f = facts["categories"].get(key)
    if not g:  errors.append(f"gallery copy missing for {key}")
    if not f:  errors.append(f"prize facts missing for {key}")
    if not (g and f): continue
    meta["intro"]   = {"zh": g["intro_zh"],   "en": g["intro_en"]}
    meta["history"] = {"zh": g["history_zh"], "en": g["history_en"]}
    meta["stats"] = [
        {"key": k, "value": f[k], "zh": gal.STAT_LABELS[k]["zh"], "en": gal.STAT_LABELS[k]["en"]}
        for k in ("first_year", "prizes_awarded", "laureates", "women_laureates", "years_not_awarded")
    ]
    meta["links"] = [
        {"url": f["links"][slot], **gal.LINK_LABELS[slot]} for slot in ("hub", "all", "facts")
    ] + gal.SHARED_LINKS

if errors:
    print("BUILD FAILED:", file=sys.stderr)
    for e in errors: print("  -", e, file=sys.stderr)
    sys.exit(1)
cat["lectures"].sort(key=lambda r: r["event"]["date"])
cat.get("ntu_lectures", []).sort(key=lambda r: r["event"]["date"])

out = ROOT / "src" / "data" / "lectures.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8")
n = len(cat["lectures"])
print(f"wrote {out.relative_to(ROOT)}  ({n} lectures, "
      f"{len(cat.get('ntu_lectures', []))} NTU lectures, "
      f"{len(cat['special_events'])} special events)")
print(f"  copy complete for {n}/{n};  tags: {len(cat['tags'])};  categories: {len(cat['categories'])}")
