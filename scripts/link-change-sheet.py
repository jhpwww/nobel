#!/usr/bin/env python3
"""
link-change-sheet.py — the before/after sheet for a change of lecture recordings.

  python3 scripts/link-change-sheet.py <meta.json> <out.xlsx>

`meta.json` is a map of YouTube id → {title, channel, channel_url, upload_date,
duration, availability, embed, was_live, desc} as yt-dlp reports them (the
owner's machine reaches YouTube; a runner does not). The catalogue says which
id each lecture plays now (`video.lecture`) and which the IPF channel holds
(`video.lecture_ipf`); where the two differ, the recording was replaced and
the row goes on the first sheet, for the course's own check by hand. The
second sheet lists the lectures that still play the IPF recording and what was
searched; the third, the 導讀 added in the same change.

The sheet is for a person, not a program: every row says in words what to
look at, and the notes are computed from the metadata — the duration gap and
its direction, whether the host's own description names the event date,
whether the file is a raw live stream — never asserted.
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
}

MONTHS = {m_: i for i, m_ in enumerate(["january", "february", "march", "april", "may", "june", "july",
                                          "august", "september", "october", "november", "december"], 1)}
def dates_in(text):
    """every calendar date a description or title names, as YYYY-MM-DD"""
    out = set()
    t = text or ""
    for y, mo, d in re.findall(r"(20\d\d)[./年\-](\d{1,2})[./月\-](\d{1,2})", t):
        out.add(f"{y}-{int(mo):02d}-{int(d):02d}")
    for y, mo, d in re.findall(r"(1\d\d)年(\d{1,2})月(\d{1,2})日", t):            # 民國
        out.add(f"{int(y) + 1911}-{int(mo):02d}-{int(d):02d}")
    for mo, d, y in re.findall(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d\d)", t, re.I):
        out.add(f"{y}-{MONTHS[mo.lower()]:02d}-{int(d):02d}")
    return out

NO_UPLOAD = {  # what was searched for the second sheet, so nobody repeats it
    "thooft": "淡江大學官方頻道（110 支）、CyberTKU、開放式課程、物理系頻道皆無完整錄影；校方新聞稿說有線上直播但未公布平台。CyberTKU 只有 109 秒新聞片段（zLN50HxRLCQ）",
    "mcdonald": "淡江大學官方頻道、CyberTKU、開放式課程皆無完整錄影；熊貓講座網頁與淡江時報未附影片連結",
    "noyori": "淡江大學官方頻道、CyberTKU、化學系頻道（僅 3 支介紹片）皆無完整錄影",
    "queloz": "國立臺灣師範大學官方頻道無此場；師大頂尖學術講座網頁的「影片觀看」未連到任何影片",
    "sudhof": "亞洲大學官方頻道只有 6 分鐘花絮（aa8mawNKlEI，2026-05-08 上傳），非完整演講。第二天場次（6sh75WDdREs）同樣只有 IPF 版",
    "ciechanover": "中國醫藥大學官方頻道（CMUtw，131 支）與附設醫院頻道皆無此場",
    "stiglitz": "俞國華文教基金會無 YouTube 頻道；風傳媒頻道有完整演講與對談（UAeUv3d9hvY，2:24:42），但風傳媒是媒體合作方，不是主辦單位，故未更換",
    "rice": "慈濟大學各頻道（慈大媒體製作教學中心 300 支與 16 個播放清單）無此場；「慈濟大學26周年諾貝爾講座」（wxdc73KNLSg）是 2020 年的舊講座",
}

wb = Workbook()
head_font = Font(bold=True, color="FFFFFF")
head_fill = PatternFill("solid", fgColor="7A1F1F")
warn_fill = PatternFill("solid", fgColor="FFF4D6")
wrap = Alignment(wrap_text=True, vertical="top")

def sheet(ws, headers, rows, widths, warn_col=None):
    ws.append(headers)
    for c in ws[1]:
        c.font = head_font; c.fill = head_fill; c.alignment = Alignment(wrap_text=True, vertical="center")
    for r in rows: ws.append(r)
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = wrap
            if isinstance(c.value, str) and c.value.startswith("https://"):
                c.hyperlink = c.value; c.font = Font(color="0563C1", underline="single")
        if warn_col is not None and row[warn_col].value:
            row[warn_col].fill = warn_fill
    ws.freeze_panes = "D2"
    ws.auto_filter.ref = ws.dimensions
    ws.row_dimensions[1].height = 42

# ---- sheet 1: replaced ------------------------------------------------------
ws = wb.active; ws.title = "已更換連結"
rows = []
for r in cat["lectures"]:
    v = r["video"]; new, old = v["lecture"], v.get("lecture_ipf")
    if not old or new == old: continue
    d_new, d_old = m(new, "duration", None), m(old, "duration", None)
    t_new, t_old = m(new, "title"), m(old, "title")
    desc = m(new, "desc", "")
    named = dates_in(f"{t_new} {desc}")
    date_ok = r["event"]["date"] in named
    kind, handle = KIND.get(m(new, "channel"), ("未分類", ""))
    live = m(new, "was_live", False) is True

    notes, check = [], []
    if d_new and d_old:
        gap = int(d_new) - int(d_old)
        mins = abs(gap) // 60
        if abs(gap) <= 120:
            notes.append("兩版片長相同（差距在兩分鐘內），應為同一母帶")
            check.append("片長相同：快速確認開頭與結尾即可")
        elif gap < 0:
            notes.append(f"主辦單位版較 IPF 版短 {mins} 分鐘")
            if mins >= 15:
                check.append(f"主辦版短 {mins} 分鐘：請抽看兩版結尾，確認主辦版缺的是開場或 Q&A，而非演講本體")
            else:
                check.append("主辦版略短：多半是剪掉開場或片尾，抽看結尾即可")
        else:
            notes.append(f"主辦單位版較 IPF 版長 {mins} 分鐘")
            check.append(f"主辦版長 {mins} 分鐘：通常是直播前的等待畫面或休息時段，請確認開頭幾分鐘")
    else:
        notes.append("其中一版片長未查得")
    if live:
        notes.append("主辦單位版為直播原檔（未剪輯）")
        check.append("直播原檔：請確認開頭等待畫面多長、是否從頭就有聲音、結尾是否完整")
    if date_ok:
        notes.append("主辦單位影片的標題或說明載明演講日期，與本場相符")
    else:
        notes.append("主辦單位影片的標題與說明未寫出日期")
        check.append("未載明日期：以講者、主辦單位與上傳日期（演講後數週內）判斷為同一場，請一併確認")
    title_words = re.sub(r"[^a-z0-9 ]", " ", r["title"]["en"].lower()).split()
    host_title = t_new.lower()
    if sum(1 for w in title_words if len(w) > 3 and w in host_title) < max(2, len([w for w in title_words if len(w) > 3]) // 3):
        notes.append(f"主辦單位使用不同的講題名稱：「{t_new}」")
        check.append("講題名稱不同：以說明中的講者與日期確認為同一場")
    if m(new, "embed", None) is not True:
        check.append("可嵌入狀態非「是」：請在網站頁面上實際播放一次")

    rows.append([
        r["no"], r["laureate"]["zh"], r["laureate"]["en"], r["title"]["en"], r["event"]["date"], r["event"]["host_zh"],
        url(old), t_old, hms(d_old),
        url(new), m(new, "channel"), kind, handle, t_new, hms(d_new), ymd(m(new, "upload_date")),
        "是" if date_ok else "否", "是" if m(new, "embed", None) is True else str(m(new, "embed")),
        {"public": "公開", "unlisted": "不公開（有連結可看）", "private": "私人"}.get(m(new, "availability"), m(new, "availability")),
        "；".join(notes), "；".join(check), "",
    ])
sheet(ws, ["序號", "得主", "Laureate", "講題（本站／節目表）", "演講日期", "主辦單位",
           "更新前連結（IPF 頻道）", "更新前影片標題", "更新前片長",
           "更新後連結（主辦單位頻道）", "更新後頻道", "頻道性質", "頻道帳號", "更新後影片標題", "更新後片長", "更新後上傳日期",
           "說明載明日期", "可嵌入", "公開狀態", "備註（由影片資料算出）", "建議核檢重點", "人工核檢結果"],
      rows, [6, 12, 24, 36, 12, 12, 38, 40, 10, 38, 26, 18, 22, 44, 10, 12, 8, 7, 9, 44, 52, 14], warn_col=20)
dv = DataValidation(type="list", formula1='"正確,有疑問,錯誤"', allow_blank=True, showDropDown=False)
dv.prompt = "正確／有疑問／錯誤"; ws.add_data_validation(dv); dv.add(f"V2:V{len(rows) + 1}")

# ---- sheet 2: unchanged -----------------------------------------------------
ws2 = wb.create_sheet("未更換（無主辦單位上傳）")
rows2 = []
for r in cat["lectures"]:
    v = r["video"]
    if v.get("lecture_ipf") and v["lecture"] != v["lecture_ipf"]: continue
    rows2.append([r["no"], r["laureate"]["zh"], r["laureate"]["en"], r["title"]["en"], r["event"]["date"],
                  r["event"]["host_zh"], url(v["lecture"]), m(v["lecture"], "channel"), hms(m(v["lecture"], "duration", None)),
                  NO_UPLOAD.get(r["id"], "")])
    for s in v.get("extra_sessions", []):
        rows2.append([r["no"], r["laureate"]["zh"], r["laureate"]["en"], f'{r["title"]["en"]}（{s["label"]}）', r["event"]["date"],
                      r["event"]["host_zh"], url(s["id"]), m(s["id"], "channel"), hms(m(s["id"], "duration", None)),
                      "第二天場次，同樣只有 IPF 版"])
sheet(ws2, ["序號", "得主", "Laureate", "講題", "演講日期", "主辦單位", "目前連結（IPF 頻道，未更換）", "頻道", "片長", "查找結果（已找過的地方）"],
      rows2, [6, 12, 24, 36, 12, 12, 38, 26, 10, 80])

# ---- sheet 3: new guides ----------------------------------------------------
ws3 = wb.create_sheet("新增導讀影片")
NEW_GUIDES = ["noyori", "mcdonald", "stiglitz"]
rows3 = []
for r in cat["lectures"]:
    if r["id"] in NEW_GUIDES and r["video"].get("guide"):
        g = r["video"]["guide"]
        rows3.append([r["no"], r["laureate"]["zh"], r["laureate"]["en"], url(g), m(g, "channel"), m(g, "title"),
                      hms(m(g, "duration", None)), ymd(m(g, "upload_date")), "是" if m(g, "embed", None) is True else str(m(g, "embed"))])
sheet(ws3, ["序號", "得主", "Laureate", "導讀影片連結", "頻道", "影片標題", "片長", "上傳日期", "可嵌入"],
      rows3, [6, 12, 24, 38, 14, 60, 8, 12, 8])

# ---- sheet 4: how to read ---------------------------------------------------
ws4 = wb.create_sheet("說明")
for line in [
    "本檔由 scripts/link-change-sheet.py 從網站資料與 YouTube 影片資料產生，供人工核檢「講座影片連結更換」。",
    "",
    "「已更換連結」：原本網站播放 International Peace BRIDGES Network（IPF）頻道的錄影，現改播主辦單位自家頻道的同場錄影。每列附兩版連結、標題、片長，以及由影片資料算出的備註與建議核檢重點。",
    "「頻道性質」：校級／院級官方＝機構主頻道；校內單位＝該校錄影、直播或教學單位的頻道。四個校內單位頻道（清大學習科技組、成大國際事務處、東海網路直播、興大通識中心）的歸屬是依頻道名稱與內容判斷，若要百分之百確定，可向該校求證。",
    "「說明載明日期」：主辦單位影片的標題或說明文字中有寫出與本場相同的演講日期。",
    "「片長差異」：多數主辦單位版本較 IPF 版短，差的通常是開場致詞或演後 Q&A；長的通常是直播前的等待畫面。差距大於 15 分鐘的列已標黃，請抽看結尾。",
    "「人工核檢結果」：請填 正確／有疑問／錯誤（下拉選單）。有疑問或錯誤時，請在同列最右欄之後自行加註說明。",
    "",
    "「未更換」：找不到主辦單位自家頻道的完整錄影，網站維持 IPF 版；「查找結果」列出已找過的頻道，免得重複找。",
    "「新增導讀影片」：臺大演講網 2026-10-01 上線的三支導讀。",
    "",
    "另請注意：有三場的本站講題（節目表）與兩版影片實際使用的講題不同——梶田隆章（影片：International Collaboration in Basic Science – From My Experience）、阿羅什（影片：The Laser and Quantum Physics）、聚德霍夫第一天（IPF 說明：Scientific excellence and scientific integrity: A personal journey）。影片是同一場無誤，講題要不要改成實際講題，由課程決定。",
]:
    ws4.append([line])
ws4.column_dimensions["A"].width = 140
for row in ws4.iter_rows(): row[0].alignment = wrap

out.parent.mkdir(parents=True, exist_ok=True)
wb.save(out)
print(f"{out}: {len(rows)} replaced, {len(rows2)} unchanged rows, {len(rows3)} new 導讀")
