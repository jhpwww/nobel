#!/usr/bin/env python3
"""
link-change-sheet.py — every video the museum plays, and what changed.

  python3 scripts/link-change-sheet.py <meta.json> <out.xlsx>

`meta.json` is a map of YouTube id → {title, channel, channel_url, upload_date,
duration, availability, embed, was_live, desc} as yt-dlp reports them (the
owner's machine reaches YouTube; a runner does not).

Sheet 1 lists EVERY recording the site plays — 導讀, 講座, the second sitting,
專訪, the NTU collection, the standalone films and the special events on the
About page — with the link it plays now. Where a record also carries the IPF
channel's id (`lecture_ipf`, `id_ipf`, `yt_ipf`) and it differs, the recording
was replaced by the originator's own upload: the row is marked, highlighted,
and carries the IPF link it replaced. Sheet 2 is every replaced recording in
full, for the course's own check by hand, with per-row notes computed from
the metadata — the duration gap and its direction, whether the host's own
description names the event date, whether the file is a raw live stream —
never asserted. Sheet 3 explains.
"""
import json, pathlib, re, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = pathlib.Path(__file__).resolve().parents[1]
meta = json.load(open(sys.argv[1], encoding="utf-8"))
out = pathlib.Path(sys.argv[2])
cat = json.load(open(ROOT / "data" / "catalog.json", encoding="utf-8"))
MISSING = "未查得"
NEW_GUIDES = {"noyori", "mcdonald", "stiglitz"}       # 臺大演講網 2026-10-01
NEW_RECORDS = {"cw-ep5"}                              # 天下 Ep.5, added 2026-10-04

def hms(s):
    if not s: return MISSING
    s = int(s); return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"
def ymd(d):
    return f"{d[:4]}-{d[4:6]}-{d[6:]}" if d and len(d) == 8 else MISSING
def url(v): return f"https://www.youtube.com/watch?v={v}"
def m(v, k, default=MISSING):
    d = meta.get(v) or {}
    return d[k] if k in d and d[k] not in (None, "") else default

# what kind of channel each is — the hand-checker can confirm with the host
# if the owner wants certainty beyond the channel's own name and content
KIND = {
    "臺大演講網": ("校級官方", "@NTUSpeech"),
    "中央研究院Academia Sinica": ("院級官方", "@academiasinica_tw"),
    "國立清華大學計算機與通訊中心學習科技組": ("校內單位（錄影單位）", "@NTHUCCCLT"),
    "National Cheng Kung University OIA,": ("校內單位（國際事務處；頻道名稱本身含逗號）", "@nationalchengkunguniversit1691"),
    "東海大學網路直播": ("校內單位（直播頻道）", "@LiveTHU"),
    "興大通識中心": ("校內單位（通識教育中心，惠蓀講座）", "@興大通識中心"),
    "風傳媒 The Storm Media": ("媒體自家頻道（原始上傳）", "@TheStormMedia"),
    "天下雜誌 video": ("媒體自家頻道（原始上傳）", "UCoS753iLrVE-1PZrsUak6Qg"),
}

MONTHS = {m_: i for i, m_ in enumerate(["january", "february", "march", "april", "may", "june", "july",
                                          "august", "september", "october", "november", "december"], 1)}
def dates_in(text):
    """every calendar date a description or title names, as YYYY-MM-DD"""
    out = set(); t = text or ""
    for y, mo, d in re.findall(r"(20\d\d)[./年\-](\d{1,2})[./月\-](\d{1,2})", t):
        out.add(f"{y}-{int(mo):02d}-{int(d):02d}")
    for y, mo, d in re.findall(r"(1\d\d)年(\d{1,2})月(\d{1,2})日", t):            # 民國
        out.add(f"{int(y) + 1911}-{int(mo):02d}-{int(d):02d}")
    for mo, d, y in re.findall(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d\d)", t, re.I):
        out.add(f"{y}-{MONTHS[mo.lower()]:02d}-{int(d):02d}")
    return out

NO_UPLOAD = {  # what was searched, so nobody repeats it
    "thooft": "淡江大學官方頻道（110 支）、CyberTKU、開放式課程、物理系頻道皆無完整錄影；校方新聞稿說有線上直播但未公布平台。CyberTKU 只有 109 秒新聞片段（zLN50HxRLCQ）",
    "mcdonald": "淡江大學官方頻道、CyberTKU、開放式課程皆無完整錄影；熊貓講座網頁與淡江時報未附影片連結",
    "noyori": "淡江大學官方頻道、CyberTKU、化學系頻道（僅 3 支介紹片）皆無完整錄影",
    "queloz": "國立臺灣師範大學官方頻道無此場；師大頂尖學術講座網頁的「影片觀看」未連到任何影片",
    "sudhof": "亞洲大學官方頻道只有 6 分鐘花絮（aa8mawNKlEI，2026-05-08 上傳），非完整演講。第二天場次同樣只有 IPF 版",
    "ciechanover": "中國醫藥大學官方頻道（CMUtw，131 支）與附設醫院頻道皆無此場",
    "stiglitz": "俞國華文教基金會無 YouTube 頻道；風傳媒頻道有完整演講與對談（UAeUv3d9hvY，2:24:42），但風傳媒是媒體合作方，不是主辦單位，故未更換",
    "rice": "慈濟大學各頻道（慈大媒體製作教學中心 300 支與 16 個播放清單）無此場；「慈濟大學26周年諾貝爾講座」（wxdc73KNLSg）是 2020 年的舊講座",
}
EVENT_NOTE = {  # special events still on the IPF channel, and what was searched
    "launch": "臺大演講網（最新 400 支）、NTU Campus 校園頻道、臺大國際事務處頻道皆未找到啟動儀式的獨立影片",
    "geim-fg": "搜尋到的北一女中相關頻道（校友會、科學班、樂儀旗隊、畢籌會等）皆無此場；未找到校方官方頻道上的上傳",
    "frank-fg": "同上",
    "roth-kobilka-panel": "清大學習科技組頻道最新 120 支無獨立的對談影片",
}

wb = Workbook()
head_font = Font(bold=True, color="FFFFFF")
head_fill = PatternFill("solid", fgColor="7A1F1F")
upd_fill = PatternFill("solid", fgColor="FFF4D6")     # a replaced link
new_fill = PatternFill("solid", fgColor="E8F3E2")     # a recording added in this change
wrap = Alignment(wrap_text=True, vertical="top")

def sheet(ws, headers, rows, widths, fills=None, freeze="D2"):
    ws.append(headers)
    for c in ws[1]:
        c.font = head_font; c.fill = head_fill; c.alignment = Alignment(wrap_text=True, vertical="center")
    for r in rows: ws.append(r)
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for i, row in enumerate(ws.iter_rows(min_row=2)):
        fill = fills[i] if fills else None
        for c in row:
            c.alignment = wrap
            if fill: c.fill = fill
            if isinstance(c.value, str) and c.value.startswith("https://"):
                c.hyperlink = c.value; c.font = Font(color="0563C1", underline="single")
    ws.freeze_panes = freeze
    ws.auto_filter.ref = ws.dimensions
    ws.row_dimensions[1].height = 42

def kind_of(vid):
    return KIND.get(m(vid, "channel"), ("", ""))

# ---- sheet 1: every recording on the site -------------------------------------
ws = wb.active; ws.title = "全部影片"
rows, fills = [], []
replaced = []   # (kind, who_zh, who_en, title, date, where, new, old) for sheet 2
def add(kind, who_zh, who_en, title, date, where, cur, old, note, new=False):
    updated = bool(old) and old != cur
    rows.append([kind, who_zh, who_en, title, date, where,
                 url(cur), m(cur, "channel"), hms(m(cur, "duration", None)), ymd(m(cur, "upload_date")),
                 "是" if updated else "否", url(old) if updated else "", hms(m(old, "duration", None)) if updated else "",
                 m(old, "channel") if updated else "", note])
    fills.append(upd_fill if updated else new_fill if new else None)
    if updated: replaced.append((kind, who_zh, who_en, title, date, where, cur, old))

for r in cat["lectures"]:
    v = r["video"]; who = (r["laureate"]["zh"], r["laureate"]["en"]); host = r["event"]["host_zh"]; date = r["event"]["date"]
    if v.get("guide"):
        new = r["id"] in NEW_GUIDES
        add("導讀", *who, f"臺灣橋樑計畫導讀 — {r['laureate']['en']}", date, "臺大演講網（製作：臺灣大學）", v["guide"], None,
            "本次新增（臺大演講網 2026-10-01 上線）" if new else "", new)
    updated = bool(v.get("lecture_ipf")) and v["lecture"] != v["lecture_ipf"]
    note = ""
    if updated:
        kind, handle = kind_of(v["lecture"]); note = f"改播主辦單位頻道（{kind}，{handle}）；細節見「已更換連結」頁"
    elif r["id"] in NO_UPLOAD:
        note = f"維持 IPF 版：{NO_UPLOAD[r['id']]}"
    add("講座", *who, r["title"]["en"], date, host, v["lecture"], v.get("lecture_ipf"), note)
    for s in v.get("extra_sessions", []):
        add("講座（第二天）", *who, f"{r['title']['en']}（{s['label']}）", date, host, s["id"], None, "維持 IPF 版（主辦單位無上傳）")
    for iv in r["interviews"]:
        kind, handle = kind_of(iv["id"])
        add(f"專訪（{iv['source_zh']}）", *who, m(iv["id"], "title"), date, f"{iv['source_zh']}（{handle}）", iv["id"], iv.get("id_ipf"),
            f"改播{iv['source_zh']}自家頻道的原始上傳" if iv.get("id_ipf") and iv["id"] != iv["id_ipf"] else "")

for r in sorted(cat["ntu_lectures"], key=lambda x: x["event"]["date"]):
    add("臺大講座（非橋樑計畫）", r["laureate"]["zh"], r["laureate"]["en"], r["title"]["en"], r["event"]["date"],
        f"{r['event']['host_zh']}（{r.get('series_zh') or ''}）", r["video"]["lecture"], None, "臺大演講網原本就是唯一來源")

for s in cat["standalone_records"]:
    src = {"storm": "風傳媒", "cw": "天下雜誌"}.get(s.get("source"), s.get("source", ""))
    new = s["id"] in NEW_RECORDS
    add(f"專訪／影片（{src}，計畫層級）", s.get("person_zh", ""), s.get("person_en", ""), m(s["yt"], "title"), s.get("date", ""),
        f"{src}（{kind_of(s['yt'])[1]}）", s["yt"], s.get("yt_ipf"),
        "本次新增（天下「與頂尖對話」Ep.5，計畫總覽）" if new else (f"改播{src}自家頻道的原始上傳" if s.get("yt_ipf") else s.get("role_zh", "")), new)

for s in cat["special_events"]:
    add("特別活動（關於本館頁）", s.get("title_zh", ""), s.get("title_en", ""), s.get("title_en", ""), s.get("date", ""),
        s.get("host_zh") or s.get("host") or "", s["yt"], s.get("yt_ipf"),
        (f"改播{m(s['yt'], 'channel')}的上傳" if s.get("yt_ipf") and s["yt"] != s["yt_ipf"] else
         (f"維持 IPF 版：{EVENT_NOTE[s['id']]}" if s["id"] in EVENT_NOTE else s.get("note_zh", ""))))

sheet(ws, ["類型", "得主／人物", "Laureate / person", "講題／影片標題（本站）", "日期", "主辦單位／來源",
           "目前連結", "目前頻道", "目前片長", "上傳日期",
           "連結已更新", "更新前連結（IPF 頻道）", "更新前片長", "更新前頻道", "備註"],
      rows, [18, 14, 26, 44, 12, 26, 38, 26, 10, 12, 8, 38, 10, 22, 60], fills=fills)

# ---- sheet 2: every replaced recording, in full, for the check by hand ---------
ws2 = wb.create_sheet("已更換連結（核檢用）")
rows2 = []
for kind, who_zh, who_en, title, date, where, new, old in replaced:
    d_new, d_old = m(new, "duration", None), m(old, "duration", None)
    t_new, t_old = m(new, "title"), m(old, "title")
    is_lecture = kind.startswith("講座")
    desc = m(new, "desc", "")
    date_ok = date in dates_in(f"{t_new} {desc}")
    ch_kind, handle = kind_of(new)
    live = m(new, "was_live", False) is True

    notes, check = [], []
    if d_new and d_old:
        gap = int(d_new) - int(d_old); mins = abs(gap) // 60
        if abs(gap) <= 120:
            notes.append("兩版片長相同（差距在兩分鐘內），應為同一母帶")
            check.append("片長相同：快速確認開頭與結尾即可" if is_lecture else "片長相同：開啟確認是同一支影片即可")
        elif gap < 0:
            notes.append(f"新版較 IPF 版短 {mins} 分鐘")
            check.append(f"新版短 {mins} 分鐘：請抽看兩版結尾，確認缺的是開場或 Q&A，而非演講本體" if mins >= 15
                         else "新版略短：多半是剪掉開場或片尾，抽看結尾即可")
        else:
            notes.append(f"新版較 IPF 版長 {mins} 分鐘")
            check.append(f"新版長 {mins} 分鐘：通常是直播前的等待畫面或休息時段，請確認開頭幾分鐘")
    else:
        notes.append("其中一版片長未查得")
    if live:
        notes.append("新版為直播原檔（未剪輯）"); check.append("直播原檔：請確認開頭等待畫面多長、是否從頭就有聲音、結尾是否完整")
    if is_lecture:
        if date_ok:
            notes.append("主辦單位影片的標題或說明載明演講日期，與本場相符")
        else:
            notes.append("主辦單位影片的標題與說明未寫出日期"); check.append("未載明日期：以講者、主辦單位與上傳日期（演講後數週內）判斷為同一場，請一併確認")
        words = [w for w in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split() if len(w) > 3]
        if sum(1 for w in words if w in t_new.lower()) < max(2, len(words) // 3):
            notes.append(f"主辦單位使用不同的講題名稱：「{t_new}」"); check.append("講題名稱不同：以說明中的講者與日期確認為同一場")
    else:
        notes.append("媒體自家頻道的原始上傳；IPF 頻道的是轉載")
    if m(new, "embed", None) is not True:
        check.append("可嵌入狀態非「是」：請在網站頁面上實際播放一次")

    rows2.append([
        kind, who_zh, who_en, title, date, where,
        url(old), t_old, hms(d_old),
        url(new), m(new, "channel"), ch_kind, handle, t_new, hms(d_new), ymd(m(new, "upload_date")),
        ("是" if date_ok else "否") if is_lecture else "—", "是" if m(new, "embed", None) is True else str(m(new, "embed")),
        {"public": "公開", "unlisted": "不公開（有連結可看）", "private": "私人"}.get(m(new, "availability"), m(new, "availability")),
        "；".join(notes), "；".join(check), "",
    ])
sheet(ws2, ["類型", "得主／人物", "Laureate / person", "講題／標題（本站）", "日期", "主辦單位／來源",
            "更新前連結（IPF 頻道）", "更新前影片標題", "更新前片長",
            "更新後連結", "更新後頻道", "頻道性質", "頻道帳號", "更新後影片標題", "更新後片長", "更新後上傳日期",
            "說明載明日期", "可嵌入", "公開狀態", "備註（由影片資料算出）", "建議核檢重點", "人工核檢結果"],
      rows2, [16, 12, 24, 36, 12, 18, 38, 40, 10, 38, 26, 18, 22, 44, 10, 12, 8, 7, 9, 44, 52, 14],
      fills=[upd_fill if "分鐘：請抽看" in r[20] else None for r in rows2])
dv = DataValidation(type="list", formula1='"正確,有疑問,錯誤"', allow_blank=True, showDropDown=False)
dv.prompt = "正確／有疑問／錯誤"; ws2.add_data_validation(dv); dv.add(f"V2:V{len(rows2) + 1}")

# ---- sheet 3: how to read -----------------------------------------------------
ws3 = wb.create_sheet("說明")
n_upd = sum(1 for f in fills if f is upd_fill); n_new = sum(1 for f in fills if f is new_fill)
n_lec = sum(1 for r in replaced if r[0].startswith("講座")); n_itv = len(replaced) - n_lec
for line in [
    "本檔由 scripts/link-change-sheet.py 從網站資料與 YouTube 影片資料產生。",
    "",
    f"「全部影片」：網站目前播放的每一支影片，共 {len(rows)} 列——導讀、講座、第二天場次、專訪、臺大講座（非橋樑計畫）、計畫層級的專訪與影片，以及「關於本館」頁的特別活動影片。",
    f"  黃底 {n_upd} 列＝連結已更新（{n_lec} 場講座改播主辦單位自家頻道；{n_itv} 支專訪與影片改播天下雜誌、風傳媒自家頻道的原始上傳），「更新前連結」欄附上原本的 IPF 頻道連結與片長；綠底 {n_new} 列＝本次新增。其餘列未更動。",
    f"「已更換連結（核檢用）」：同樣的 {len(rows2)} 列，附兩版標題、片長、頻道性質、由影片資料算出的備註與建議核檢重點；「人工核檢結果」請填 正確／有疑問／錯誤（下拉選單），有疑問時在最右欄之後加註。",
    "「頻道性質」：校級／院級官方＝機構主頻道；校內單位＝該校錄影、直播或教學單位的頻道；媒體自家頻道＝天下雜誌 video、風傳媒 The Storm Media 的原始上傳。四個校內單位頻道（清大學習科技組、成大國際事務處、東海網路直播、興大通識中心）的歸屬是依頻道名稱與內容判斷，若要百分之百確定，可向該校求證。",
    "「說明載明日期」（講座列）：主辦單位影片的標題或說明文字中有寫出與本場相同的演講日期。專訪列不適用，標「—」。",
    "「片長差異」：多數主辦單位版本較 IPF 版短，差的通常是開場致詞或演後 Q&A；長的通常是直播前的等待畫面；專訪兩版片長皆相同。差距大於 15 分鐘的列在核檢頁標黃，請抽看結尾。",
    "",
    "維持 IPF 版的：8 場講座（淡江 3、師大、亞大、中國醫大、俞國華、慈濟）、聚德霍夫第二天，以及 4 支特別活動（啟動儀式、北一女中 2 場、羅斯與科比爾卡對談）；「備註」欄列出已找過的頻道，免得重複找。",
    "",
    "另請注意：有三場的本站講題（節目表）與兩版影片實際使用的講題不同——梶田隆章（影片：International Collaboration in Basic Science – From My Experience）、阿羅什（影片：The Laser and Quantum Physics）、聚德霍夫第一天（IPF 說明：Scientific excellence and scientific integrity: A personal journey）。影片是同一場無誤，講題要不要改成實際講題，由課程決定。",
]:
    ws3.append([line])
ws3.column_dimensions["A"].width = 140
for row in ws3.iter_rows(): row[0].alignment = wrap

out.parent.mkdir(parents=True, exist_ok=True)
wb.save(out)
print(f"{out}: {len(rows)} videos ({n_upd} replaced: {n_lec} lectures + {n_itv} interviews/films; {n_new} new), {len(rows2)} rows on the check sheet")
