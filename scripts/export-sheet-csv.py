#!/usr/bin/env python3
"""
export-sheet-csv.py — turn the verified catalogue into the CSV you paste into
Google Sheets to create the content backend.

  python3 scripts/export-sheet-csv.py     ->  data/sheet-seed.csv

Do this once. After that the Sheet is the source of truth: edit a row, press
"Run workflow" on the Actions tab, and the site rebuilds from it.

Column order here is the contract that scripts/sync-sheet.mjs reads. Adding a
column is safe; renaming or reordering one is not.
"""
import csv, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
cat = json.loads((ROOT / "src" / "data" / "lectures.json").read_text(encoding="utf-8"))

COLUMNS = [
    "id", "status", "series", "laureate_en", "laureate_zh", "category", "prize_year",
    "affiliation", "country", "date", "host_key", "title_en", "title_zh",
    "hook_zh", "hook_en", "summary_zh", "summary_en", "topic_tags",
    "yt_lecture", "lecture_channel", "yt_lecture_ipf", "yt_guide", "extra_sessions", "interviews",
    "nobel_facts", "instagram", "ntu_epaper", "ntu_spotlight",
]

def rows():
    for r in cat["lectures"]:
        yield {
            "id": r["id"],
            "status": "published",
            "series": r["series"],
            "laureate_en": r["laureate"]["en"],
            "laureate_zh": r["laureate"]["zh"],
            "category": r["prize"]["category"],
            "prize_year": r["prize"]["year"],
            "affiliation": r["affiliation"]["institution"],
            "country": r["affiliation"]["country"],
            "date": r["event"]["date"],
            "host_key": r["event"]["host_key"],
            "title_en": r["title"]["en"],
            "title_zh": r["title"]["zh"] or "",
            "hook_zh": r["hook"]["zh"],
            "hook_en": r["hook"]["en"],
            "summary_zh": r["description"]["zh"],
            "summary_en": r["description"]["en"],
            "topic_tags": " | ".join(r["topic_tags"]),
            "yt_lecture": r["video"]["lecture"] or "",
            "lecture_channel": r["video"].get("lecture_channel") or "",
            "yt_lecture_ipf": r["video"].get("lecture_ipf") or "",
            "yt_guide": r["video"]["guide"] or "",
            # id::label::date, and ::title_en::title_zh where the sitting had its own subject
            "extra_sessions": " | ".join(
                "::".join([s["id"], s["label"], s.get("date", "")]
                          + ([s["title"]["en"], s["title"]["zh"]] if s.get("title") else []))
                for s in r["video"]["extra_sessions"]),
            "interviews": " | ".join(f'{i["source"]}::{i["id"]}' for i in r["interviews"]),
            "nobel_facts": r["links"]["nobel_facts"],
            "instagram": r["links"].get("instagram", ""),
            "ntu_epaper": r["links"].get("ntu_epaper", ""),
            "ntu_spotlight": r["links"].get("ntu_spotlight", ""),
        }

out = ROOT / "data" / "sheet-seed.csv"
with out.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=COLUMNS)
    w.writeheader()
    for row in rows():
        w.writerow(row)
n = sum(1 for _ in rows())
print(f"wrote {out.relative_to(ROOT)}  ({n} rows, {len(COLUMNS)} columns)")
print("\nNext: create a Google Sheet, File > Import > Upload this CSV,")
print("      then File > Share > Publish to web > that tab > CSV.")
print("      Put the resulting URL in the SHEET_CSV_URL repository variable.")
