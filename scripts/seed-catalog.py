#!/usr/bin/env python3
"""
seed-catalog.py — builds data/catalog.json from hand-verified source data.

Provenance of every field:
  schedule .............. 導讀拍攝進度 PDF (IPF programme), cross-checked against YouTube titles
  title_en .............. the talk as DELIVERED: the host's own page or upload (its title or
                          "Topic:" line), else the IPF upload's description ("keynote speech
                          on ..."), over the programme book's announced title where they name a
                          different talk. Corrected 2026-10-05 from the owner's assistant's
                          check: sudhof (the programme's title was the next day's panel),
                          haroche, kajita. Checked the same day against all 63 recordings:
                          thooft's IPF description shortens the title ("Fundamental science as
                          bridges between nations") — same talk, kept; semenza's IPF
                          description differs but NCKU's own upload, which the page plays,
                          gives the title used here — the host wins
  yt_lecture ............ the recording the page plays: the HOST's own upload where the host
                          published one (HOST_UPLOAD, 22 of 31 as of 2026-10-04 — 臺大演講網,
                          中央研究院, 清大學習科技組, 成大, 東海), otherwise the International
                          Peace BRIDGES Network channel (UCCzpgpyyiGMSQE08BuXECVw)
  yt_lecture_ipf ........ the IPF channel's upload, always, for provenance — not rendered
  lecture_channel ....... the name of the channel yt_lecture came from
  yt_guide (導讀影片) ..... 臺大演講網 channel; 15 published (6 NTU-hosted, 6 more on 2026-09-16,
                          3 more on 2026-10-01)
  interviews ............ IPF channel: 天下雜誌 CommonWealth + 風傳媒 The Storm Media
  ig_reel / ntu_* ....... https://cge.ntu.edu.tw/cl_n_203079.html
  nobel_facts ........... nobelprize.org, verified by HTTP status

Run:  python3 scripts/seed-catalog.py
"""
import json, pathlib, sys

HOSTS = {
    "NTU":  ("National Taiwan University", "國立臺灣大學", "Taipei"),
    "AS":   ("Academia Sinica", "中央研究院", "Taipei"),
    "TKU":  ("Tamkang University", "淡江大學", "New Taipei"),
    "NTHU": ("National Tsing Hua University", "國立清華大學", "Hsinchu"),
    "NCKU": ("National Cheng Kung University", "國立成功大學", "Tainan"),
    "NTNU": ("National Taiwan Normal University", "國立臺灣師範大學", "Taipei"),
    "AU":   ("Asia University", "亞洲大學", "Taichung"),
    "CMU":  ("China Medical University", "中國醫藥大學", "Taichung"),
    "NCHU": ("National Chung Hsing University", "國立中興大學", "Taichung"),
    "THU":  ("Tunghai University", "東海大學", "Taichung"),
    "TCU":  ("Tzu Chi University", "慈濟大學", "Hualien"),
    "YKH":  ("Yu Kuo-Hwa Foundation", "俞國華文教基金會", "Taipei"),
}

# no, id, laureate_en, laureate_zh, category, prize_year, affiliation, country,
# date, host, title_en, yt_lecture, nobel_slug
L = [
 (1,"geim","Prof. Sir Andre Geim","安德烈‧蓋姆","physics",2010,"University of Manchester","UK",
  "2025-11-10","NTU","Wonder materials","rcE23c82xUc","physics/2010/geim"),
 (2,"thooft","Prof. Gerardus 't Hooft","傑拉德‧特胡夫特","physics",1999,"Utrecht University","Netherlands",
  "2025-11-14","TKU","Education and collaboration in fundamental science as bridges between nations","OHIoN7OcMTM","physics/1999/thooft"),
 (3,"karman","Mrs. Tawakkol Karman","塔瓦庫‧卡曼","peace",2011,"Human rights activist","Yemen",
  "2025-11-17","NTHU","Sustainable development and shared future","q3V6sN0zE7c","peace/2011/karman"),
 (4,"kornberg","Prof. Roger D. Kornberg","羅傑‧康柏格","chemistry",2006,"Stanford University","USA",
  "2025-11-20","AS","The end of disease? – The extraordinary developments in biomedicine and the implications for humanity","zBzFC9ODs1M","chemistry/2006/kornberg"),
 (5,"queloz","Prof. Didier Queloz","迪迪埃‧奎洛茲","physics",2019,"ETH Zürich","Switzerland",
  "2025-11-24","NTNU","The role of science in building a global agenda for peace","awXleH-HVEI","physics/2019/queloz"),
 (6,"murad","Ms. Nadia Murad","娜迪雅‧穆拉德","peace",2018,"Human rights activist","Iraq / USA",
  "2025-12-01","AS","Who can influence the end of conflict-related sexual violence (CRSV) worldwide? – The power of personal stories and the role of activism","K86pQuvw144","peace/2018/murad"),
 (7,"pissarides","Prof. Sir Christopher A. Pissarides","克里斯多福‧皮薩里德斯","economics",2010,"London School of Economics","UK",
  "2025-12-09","NCKU","AI and the future of work and wellbeing","mDPup-8ozT4","economic-sciences/2010/pissarides"),
 (8,"maskin","Prof. Eric S. Maskin","艾瑞克‧馬斯金","economics",2007,"Harvard University","USA",
  "2025-12-15","NTU","Why globalization has failed to reduce inequality","Vaftz_NrTww","economic-sciences/2007/maskin"),
 (9,"sudhof","Prof. Thomas C. Südhof","湯瑪斯‧聚德霍夫","medicine",2013,"Stanford University","USA",
  "2026-01-05","AU","Scientific excellence and scientific integrity: A personal journey","BaeZY-6cwDk","medicine/2013/sudhof"),
 (10,"ciechanover","Prof. Aaron Ciechanover","亞倫‧切哈諾沃","chemistry",2004,"Israel Institute of Technology","Israel",
  "2026-01-09","CMU","Personalized medicine revolution: Are we going to cure all diseases and at what price?","m14M1uLkFFU","chemistry/2004/ciechanover"),
 (11,"strickland","Prof. Donna Strickland","唐娜‧史崔克蘭","physics",2018,"University of Waterloo","Canada",
  "2026-01-12","NTU","Why trust in science is important","C7PAOAEOczU","physics/2018/strickland"),
 (12,"stiglitz","Prof. Joseph E. Stiglitz","約瑟夫‧史迪格里茲","economics",2001,"Columbia University","USA",
  "2026-01-13","YKH","The road to freedom: economics and the good society","WlxbaXqWXAs","economic-sciences/2001/stiglitz"),
 (13,"haroche","Prof. Serge Haroche","塞爾日‧阿羅什","physics",2012,"Collège de France","France",
  "2026-01-16","AS","The Laser and Quantum Physics","JrkyzmChFjI","physics/2012/haroche"),
 (14,"schmidt","Prof. Brian P. Schmidt","布萊恩‧施密特","physics",2011,"Australian National University","Australia",
  "2026-01-19","NCHU","Science: Humanity's universal bridge","il_Wkv2Maaw","physics/2011/schmidt"),
 (15,"mayor","Prof. Michel Mayor","米歇爾‧麥耶","physics",2019,"University of Geneva","Switzerland",
  "2026-01-22","AS","Is there a Planet B – Will humanity emigrate to an exoplanet?","tj8OSXJRV0A","physics/2019/mayor"),
 (16,"meldal","Prof. Morten P. Meldal","莫頓‧梅爾達爾","chemistry",2022,"University of Copenhagen","Denmark",
  "2026-01-26","NTU","Chemistry for a sustainable world – Everything is chemistry and how that influences our choices","lTZP1kxTwSM","chemistry/2022/meldal"),
 (17,"engle","Prof. Robert F. Engle III","羅伯特‧恩格爾","economics",2003,"New York University","USA",
  "2026-02-02","THU","A financial approach to climate risk","EJVC6_gZc5o","economic-sciences/2003/engle"),
 (18,"roberts","Dr. Sir Richard J. Roberts","理查‧羅伯茨","medicine",1993,"New England Biolabs","USA",
  "2026-02-05","AS","Why you should love GMOs","VmpL2HPJ_g8","medicine/1993/roberts"),
 (19,"mbmoser","Prof. May-Britt Moser","梅‧布麗特‧莫澤","medicine",2014,"Norwegian University of Science and Technology","Norway",
  "2026-02-09","NTU","The brain's systems for navigation and memory and their relevance for Alzheimer's disease","JnBkvRgjA9I","medicine/2014/may-britt-moser"),
 (20,"nurse","Dr. Sir Paul Nurse","保羅‧納斯","medicine",2001,"Francis Crick Institute","UK",
  "2026-02-11","AS","What is life?","TN0GNDKL6mY","medicine/2001/nurse"),
 (21,"winter","Prof. Sir Gregory P. Winter","格雷戈里‧溫特","chemistry",2018,"MRC Laboratory of Molecular Biology","UK",
  "2026-03-02","AS","The antibody revolution","KTHc6qF3mo0","chemistry/2018/winter"),
 (22,"mcdonald","Prof. Arthur B. McDonald","阿瑟‧麥克唐納","physics",2015,"Sudbury Neutrino Observatory","Canada",
  "2026-03-09","TKU","Answering existential questions about our universe and its evolution","io3z9LwxM34","physics/2015/mcdonald"),
 (23,"noyori","Prof. Ryoji Noyori","野依良治","chemistry",2001,"Nagoya University","Japan",
  "2026-03-20","TKU","Chemistry is the science of value creation","zAM1_fhu6kY","chemistry/2001/noyori"),
 (24,"emoser","Prof. Edvard I. Moser","愛德華‧莫澤","medicine",2014,"Norwegian University of Science and Technology","Norway",
  "2026-03-27","AS","The brain's GPS: How we know where we are","QOvGspShTQU","medicine/2014/edvard-moser"),
 (25,"rice","Prof. Charles M. Rice","查爾斯‧萊斯","medicine",2020,"Rockefeller University","USA",
  "2026-03-30","TCU","Global infectious disease: triumphs and challenges","NJXpq2nSyTY","medicine/2020/rice"),
 (26,"wuthrich","Prof. Kurt Wüthrich","庫爾特‧維特里希","chemistry",2002,"ETH Zürich","Switzerland",
  "2026-04-07","AS","The molecules of life, AI and human health","xVOW7dzgRyM","chemistry/2002/wuthrich"),
 (27,"semenza","Prof. Gregg L. Semenza","格雷格‧塞門薩","medicine",2019,"Johns Hopkins University","USA",
  "2026-04-14","NCKU","Oxygen, carbon dioxide and sustainable life on Earth","ZEFnMve_8ig","medicine/2019/semenza"),
 (28,"roth","Prof. Alvin E. Roth","艾爾文‧羅斯","economics",2012,"Stanford University","USA",
  "2026-04-20","NTHU","Markets, market design and medicine","f1ib7S3mJpE","economic-sciences/2012/roth"),
 (29,"kobilka","Prof. Brian K. Kobilka","布萊恩‧科比爾卡","chemistry",2012,"Stanford University","USA",
  "2026-04-21","NTHU","The new era in drug development","DEURLJp2AUI","chemistry/2012/kobilka"),
 (30,"kajita","Prof. Takaaki Kajita","梶田隆章","physics",2015,"University of Tokyo","Japan",
  "2026-04-23","AS","International Collaboration in Basic Science – From My Experience","uWHIUdjWnGc","physics/2015/kajita"),
 (31,"frank","Prof. Joachim Frank","約阿希姆‧法蘭克","chemistry",2017,"Columbia University","USA",
  "2026-05-06","NTU","Cryo-electron microscopy, a new foundation for molecular medicine and drug design","yhZhymmeaso","chemistry/2017/frank"),
]

# 導讀影片 on 臺大演講網. The first six were filmed for the lectures NTU
# itself hosted; the second six went up on 2026-09-16 and the next three on
# 2026-10-01, each about ninety seconds, for lectures given at other hosts.
# All fifteen verified public and playable in an embed on the day they were
# added.
GUIDE = {"geim":"S2ohEFiR4u0","maskin":"ET-QoWIUjec","strickland":"5e6-gtnHV0M",
         "meldal":"UNt_MdCz5T0","mbmoser":"vK_aNwIlqRs","frank":"FJnh2-IxXy0",
         # 2026-09-16
         "thooft":"_8tHMlQr9Wo","karman":"C87eRAwvKyk","queloz":"RJs5WY4FCGE",
         "pissarides":"u4Hn6hByR44","ciechanover":"9szPY4r18GE","engle":"J1K1ZpFP8ng",
         # 2026-10-01
         "noyori":"wtv7oprRdkQ","mcdonald":"nprHwUKKGjU","stiglitz":"QNsGUf8cWRc"}

# The host's own upload of the lecture, where the host published one. At the
# owner's word (2026-10-04) this is the recording the page plays, in place of
# the IPF channel's; the IPF id stays in the record as `lecture_ipf`. Each
# was found on the institution's channel, checked public and embeddable, and
# listed with its IPF counterpart in a sheet for the course's own check. Eight
# lectures have no such upload (TKU ×3, NTNU, AU, CMU, YKH, TCU — searched on
# the institutions' official and unit channels) and keep the IPF recording.
# Durations differ from the IPF cut for several — the host's edit, usually
# without the Q&A, not a different event; the sheet shows both.
CHANNEL = {   # channel names as YouTube prints them; handles in the comments
 "IPF":  "International Peace BRIDGES Network",        # @peace-bridges-network
 "NTU":  "臺大演講網",                                   # @NTUSpeech
 "AS":   "中央研究院Academia Sinica",                    # @academiasinica_tw
 "NTHU": "國立清華大學計算機與通訊中心學習科技組",          # @NTHUCCCLT
 "NCKU": "National Cheng Kung University OIA,",         # @nationalchengkunguniversit1691 — the comma is in the name
 "THU":  "東海大學網路直播",                              # @LiveTHU
 "NCHU": "興大通識中心",                                  # @興大通識中心 — NCHU Center for General Education, 惠蓀講座 series
}
HOST_UPLOAD = {
 "geim":       ("1KdZldwfnT4", "NTU"),
 "maskin":     ("hv8g3oRq7Ms", "NTU"),
 "strickland": ("51o9waNOWD8", "NTU"),
 "meldal":     ("XhOCuaxqSHY", "NTU"),
 "mbmoser":    ("cRu-6W0kQKs", "NTU"),
 "frank":      ("pfNkuYxhgfM", "NTU"),
 "kornberg":   ("MuKipONTn-E", "AS"),
 "murad":      ("1rPkaODYmDE", "AS"),
 "haroche":    ("SYVcxcAWH78", "AS"),
 "mayor":      ("q9IjENh587o", "AS"),
 "roberts":    ("XhpZtAGdhNo", "AS"),
 "nurse":      ("BtrXjKm4X2A", "AS"),
 "winter":     ("Xd09m8G2SjQ", "AS"),
 "emoser":     ("RwQimHKJH30", "AS"),
 "wuthrich":   ("Y-7jRxRbzlM", "AS"),
 "kajita":     ("dSsy8tUJjpc", "AS"),
 "karman":     ("-BoYdq1hu7Q", "NTHU"),
 "roth":       ("MfkIKIrPad8", "NTHU"),
 "kobilka":    ("TEUP0edx1Q0", "NTHU"),
 "pissarides": ("5N4JXSQdejo", "NCKU"),
 "semenza":    ("A-iaC-Eodm4", "NCKU"),
 "engle":      ("-LsWML_Rtw0", "THU"),
 "schmidt":    ("MPtbINlLeDc", "NCHU"),   # 惠蓀講座 176, description dates it 115年1月19日
}

# Extra same-event sessions: the youtube id, the label, the day it was held,
# and the session's own title where it had one. Südhof's second day was a
# panel with its own subject — the IPF upload's description names it — and the
# title the page carries is the 5th's keynote, so the panel names itself and
# its card carries its own day. Chinese in copy-zh-en.py SESSION_ZH.
EXTRA_SESSIONS = {"sudhof":[dict(id="6sh75WDdREs", label="Day 2 · 2026-01-06", date="2026-01-06",
    title_en="Drug development for neurodegenerative diseases: towards cheaper and more sustainable treatment")]}

# (source, the media's OWN upload the page plays, the IPF channel's copy).
# The interviews were made by 天下雜誌 and 風傳媒; the IPF channel re-posted
# them, and until 2026-10-04 the site played the re-posts. At the owner's
# word each now plays the original on the medium's own channel — 風傳媒
# @TheStormMedia (《重磅專訪》 / Exclusive Interview), 天下雜誌 video
# UCoS753iLrVE-1PZrsUak6Qg (【與頂尖對話：諾貝爾獎得主系列】Ep.1–10) — found
# by title and matched on duration to the second, public and embeddable; the
# IPF id stays as `id_ipf` for provenance, unrendered.
INTERVIEWS = {
 "roth":[("cw","aa3FRMIPBZQ","lhgrxypspsU"),("storm","UXT37ygxNdQ","6E5szZDmbI4")],
 "rice":[("cw","y1Mu_i4SpXc","QwE4TN8Hmlo")],
 "nurse":[("cw","G-hJzrmdWus","9IyVEq0LHBM"),("storm","oZTgMbuTNGg","2AQFCYlhqFY")],
 "roberts":[("cw","qYp8NUcoMzg","yAL6mkgehbg"),("storm","jvt-Kmiru-A","GoVWwoxZZ2A")],
 "strickland":[("cw","86n7s3L4wnM","yzuzWHUBRF4"),("storm","FOVKf19GLOE","mfKzYae44F0")],
 "ciechanover":[("cw","yoKxk0u_20c","Spc1R-6Qhhs")],
 "sudhof":[("cw","pPmyA_Ilyko","85quwK-splA")],
 "maskin":[("cw","SuTzQ_qYkLs","KALrpOE4kfs"),("storm","izxn4dwzvbo","-BB6eP51GeQ")],
 "queloz":[("cw","fBPVWY0DP5c","ishzcLcC-Bc")],
 "frank":[("storm","fXGBEDNViro","7m_c74EtA1w")],
 "kajita":[("storm","-hDZfsBNM4I","0r0eBO35vEc")],
 "wuthrich":[("storm","SWrcbEufjy8","LpPpUHwFdaw")],
 "emoser":[("storm","RQ3o_r_DehI","mD7Hz7KVIVM")],
 "winter":[("storm","BJnJBsHzMtw","FpUEzPKrlBY")],
 "meldal":[("storm","kM88PyMTTNs","T3nEqnPrXEM")],
 "engle":[("storm","6iLI6W71I_M","UJDJJV67shY")],
 "mayor":[("storm","3XqxAdklNbQ","TewD-AbmUQw")],
 "haroche":[("storm","QCxpL80neSg","pJoT3EBR1us")],
 "kornberg":[("storm","7AmbaSVi1vc","sWcdQVzpkQA")],
}
INTERVIEW_SRC = {"cw":{"en":"CommonWealth Magazine","zh":"天下雜誌"},
                 "storm":{"en":"The Storm Media","zh":"風傳媒"}}

# From cge.ntu.edu.tw — NTU lectures only
NTU_LINKS = {
 "geim":       dict(ig="DQ6SspNATCL", epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1666&sn=39600",
                    spotlight="https://www.ntu.edu.tw/spotlight/2025/2424_20251112.html"),
 "maskin":     dict(ig="DSWODY1iK_K", epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1671&sn=39645",
                    spotlight="https://www.ntu.edu.tw/spotlight/2025/2439_20251217.html"),
 "strickland": dict(ig="DTzWJUciXtk", epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1674&sn=39685",
                    spotlight="https://www.ntu.edu.tw/spotlight/2026/2448_20260116.html"),
 "meldal":     dict(ig="DUE8cF7gnG7", epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1674&sn=39684",
                    spotlight="https://www.ntu.edu.tw/spotlight/2026/2451_20260128.html"),
 "mbmoser":    dict(ig="DVNnv4ogaXh", epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1675&sn=39698",
                    spotlight="https://www.ntu.edu.tw/spotlight/2026/2452_20260211.html"),
 "frank":      dict(ig="DYPb8dKgRW0", epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1687&sn=41788",
                    spotlight="https://www.ntu.edu.tw/spotlight/2026/2489_20260513.html"),
}

# Events that are part of the programme but are not one of the 31 lectures
SPECIAL = [
 dict(id="launch", kind="ceremony", date="2025-11-10", host="NTU",
      title_en="TAIWAN BRIDGES Launch with President Ching-te Lai",
      title_zh="臺灣橋樑計畫啟動儀式（賴清德總統出席）", yt="pcBGv6HRv0A"),
 dict(id="geim-fg", kind="outreach", date="2025-11-11", host=None,
      host_en="Taipei First Girls High School", host_zh="臺北市立第一女子高級中學",
      title_en="Prof. Sir Andre Geim at Taipei First Girls High School",
      title_zh="安德烈‧蓋姆爵士於北一女中", yt="3axu6HmxIJ4", laureate="geim"),
 dict(id="frank-fg", kind="outreach", date="2026-05-07", host=None,
      host_en="Taipei First Girls High School", host_zh="臺北市立第一女子高級中學",
      title_en="Prof. Joachim Frank at Taipei First Girls High School",
      title_zh="約阿希姆‧法蘭克於北一女中", yt="G38hTcV7Vxw", laureate="frank"),
 dict(id="roth-kobilka-panel", kind="panel", date="2026-04-21", host="NTHU",
      title_en="Nobel Laureates Alvin Roth and Brian Kobilka in conversation",
      title_zh="艾爾文‧羅斯與布萊恩‧科比爾卡對談", yt="jZKHkoxxaoY"),
 dict(id="exhibition", kind="exhibition", date="2026-05-04", host="NTU",
      title_en="In Dialogue with the Nobel Spirit — Special Exhibition",
      title_zh="對話諾貝爾特展", yt="5sqJElopVz0",
      note_zh="展期 2026/5/4–5/28，臺大校總區綜合教學館2樓，獲瑞典駐臺辦事處特別授權"),
]

# 專訪 that belong to the programme rather than to a single laureate. `yt` is
# the medium's own upload, `yt_ipf` the IPF channel's copy where one exists.
STANDALONE_RECORDS = [
    dict(id="morawetz-storm", source="storm", yt="nnW86BSQlUU", yt_ipf="fxqhag7i8zE",
         person_en="Uwe Morawetz", person_zh="烏維‧莫拉維茨",
         role_en="Chairman, International Peace Foundation",
         role_zh="世界和平基金會主席", date="2026-06-25"),
    # 天下's tenth film in the series is about the programme itself, not one
    # laureate; added 2026-10-04 at the owner's word. Never on the IPF channel.
    dict(id="cw-ep5", source="cw", yt="4vU0-2qcLRI", yt_ipf=None,
         person_en="TAIWAN BRIDGES — the programme", person_zh="臺灣橋樑計畫（計畫總覽）",
         role_en="What 31 Nobel laureates leave Taiwan: how the programme connects higher education to the world",
         role_zh="31 位諾獎得主為臺灣留住什麼？看臺灣橋樑計畫如何讓高教連結世界", date="2026-06-13"),
]

# ---------------------------------------------------------------------------
# 臺大「諾貝爾獎得主講座」 — the museum's second collection.
#
# These are NTU's own Nobel laureate lectures, and they are NOT 臺灣橋樑計畫.
# The programme runs from 2019 and continues alongside it; the About page
# tells that story. Everything the museum states about the Bridges series —
# 31 lectures in 32 sittings — counts `lectures` alone and must stay that way.
#
# Provenance of every field below: the recording's own description on 臺大演講網
# (UCSgvLn9EzRHS7yOJqXcJ68Q), cross-checked against NTU's own pages, which are
# the `links` on each record. nobelprize.org slugs verified by live request.
#
# speech.ntu.edu.tw sits behind a Cloudflare challenge and answers 403 to every
# automated client, so it is NOT linked anywhere — check-links.py would fail on
# it. Link cge.ntu.edu.tw and www.ntu.edu.tw instead; both were fetched 200.
# ---------------------------------------------------------------------------
NTU_SERIES = {
    "soong":      ("宋恭源先生頂尖研究講座",
                   "Raymond Soong Chair Professorship of Distinguished Research"),
    "palm":       ("臺大椰林講座", "NTU Royal Palm Lecture Series"),
    "pilgrimage": ("我的學思歷程",
                   "NTU Lectures on the Intellectual and Spiritual Pilgrimage"),
    "spe":        ("臺大國際政經學院課堂講座",
                   "Class lecture at the NTU School of Political Science and Economics"),
}

# no, id, laureate_en, laureate_zh, category, prize_year, affiliation, country,
# date, series_key, title_en, yt, nobel_slug, links
#
# `affiliation` is the affiliation AT THE TIME OF THE AWARD, as nobelprize.org
# gives it and as the 31 already do — not the post the laureate held when they
# came to Taipei.
NTU = [
 (1,"mourou","Prof. Gérard Mourou","傑拉‧慕儒","physics",2018,
  "École Polytechnique","France","2019-11-09","pilgrimage",
  # NTU's own English page names the talk; the Chinese page names it 《我一生對光的追求》
  "A Lifetime's Quest for Light","f_93MRC_cOQ","physics/2018/mourou",
  dict(spotlight="https://www.ntu.edu.tw/spotlight/2019/1783_20191216.html",
       cge="https://cge.ntu.edu.tw/News_Content_n_68922_s_75100.html")),
 (2,"stoddart","Sir J. Fraser Stoddart","弗雷澤‧史托達特","chemistry",2016,
  "Northwestern University","USA","2019-12-06","pilgrimage",
  # No talk title was ever published for this sitting — NTU lists the speaker
  # only. The series is what the session was, so the series is what stands
  # here; a title would be a guess, and the museum does not guess.
  "NTU Lectures on the Intellectual and Spiritual Pilgrimage","BclmeWfaM8Q",
  "chemistry/2016/stoddart",
  dict(cge="https://cge.ntu.edu.tw/News_Content_n_68922_s_75100.html")),
 (3,"ciechanover-ntu","Prof. Aaron Ciechanover","亞倫‧切哈諾沃","chemistry",2004,
  "Israel Institute of Technology","Israel","2024-04-01","palm",
  "The Revolution of Personalized Medicine: Are We Going to Cure All Diseases and at What Price?",
  "h0S66RZon2Y","chemistry/2004/ciechanover",
  dict(spotlight="https://www.ntu.edu.tw/spotlight/2024/2254_20240410.html",
       epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1600&sn=26071",
       cge="https://cge.ntu.edu.tw/cl_n_203876.html")),
 (4,"aspect","Prof. Alain Aspect","阿蘭‧阿斯佩","physics",2022,
  "Université Paris-Saclay","France","2024-10-14","soong",
  "From Einstein and Bell to quantum technologies: entanglement in action",
  "bnjb7Y98D1k","physics/2022/aspect",
  dict(spotlight="https://www.ntu.edu.tw/spotlight/2024/2309_20241016.html")),
 (5,"aspect-2","Prof. Alain Aspect","阿蘭‧阿斯佩","physics",2022,
  "Université Paris-Saclay","France","2024-10-15","soong",
  "The two quantum revolutions: From concept to applications",
  "VQ_QQD3BDkU","physics/2022/aspect",
  dict(spotlight="https://www.ntu.edu.tw/spotlight/2024/2311_20241023.html")),
 (6,"robinson","Prof. James A. Robinson","詹姆斯‧羅賓森","economics",2024,
  "University of Chicago","USA","2025-12-17","soong",
  "Why Nations Fail","BHLS1ogT6tE","economic-sciences/2024/robinson",
  dict(spotlight="https://www.ntu.edu.tw/spotlight/2025/2444_20251219.html",
       epaper="https://sec.ntu.edu.tw/epaper/article.asp?num=1672&sn=39658",
       spe="https://spe.ntu.edu.tw/news-events/institutions-culture-and-prosperity-nobel-laureate-james-a-robinson-speaks-at-spe/")),
 (7,"robinson-fish-i","Prof. James A. Robinson","詹姆斯‧羅賓森","economics",2024,
  "University of Chicago","USA","2025-12-17","spe",
  "Searching for Fish in Trees I","qgfcB-rGOcg","economic-sciences/2024/robinson",
  dict(spe="https://spe.ntu.edu.tw/news-events/institutions-culture-and-prosperity-nobel-laureate-james-a-robinson-speaks-at-spe/")),
 (8,"robinson-fish-ii","Prof. James A. Robinson","詹姆斯‧羅賓森","economics",2024,
  "University of Chicago","USA","2025-12-19","spe",
  "Searching for Fish in Trees II","sO6UQ214N88","economic-sciences/2024/robinson",
  dict(spe="https://spe.ntu.edu.tw/news-events/institutions-culture-and-prosperity-nobel-laureate-james-a-robinson-speaks-at-spe/")),
]


def build_ntu():
    """The NTU collection, in the same record shape the 31 use.

    Same shape on purpose: a lecture page renders one of these exactly as it
    renders a Bridges lecture. What differs is the `series` block, which the
    page prints, and the absence of `cw_hub` — 天下's hub covers the Bridges
    programme and nothing here belongs to it.
    """
    out = []
    for (no, lid, en, zh, cat, yr, aff, country, date, skey, title, yt, nslug, links) in NTU:
        h_en, h_zh, city = HOSTS["NTU"]
        s_zh, s_en = NTU_SERIES[skey]
        out.append({
            "id": lid, "no": no,
            "series": skey, "series_zh": s_zh, "series_en": s_en,
            "laureate": {"en": en, "zh": zh},
            "prize": {"category": cat, "year": yr},
            "affiliation": {"institution": aff, "country": country},
            "event": {"date": date, "host_key": "NTU", "host_en": h_en,
                      "host_zh": h_zh, "city": city},
            "title": {"en": title, "zh": None},
            "description": {"en": None, "zh": None},
            "video": {
                # 臺大演講網's upload is the only recording of these; nothing
                # of IPF's exists for them, so `lecture_ipf` is null.
                "lecture": yt, "lecture_channel": CHANNEL["NTU"], "lecture_ipf": None,
                "guide": None, "extra_sessions": [],
            },
            "interviews": [],
            "links": {
                "nobel_facts": f"https://www.nobelprize.org/prizes/{nslug}/facts/",
                "nobel_lecture": f"https://www.nobelprize.org/prizes/{nslug}/lecture/",
                **({"ntu_spotlight": links["spotlight"]} if "spotlight" in links else {}),
                **({"ntu_epaper": links["epaper"]} if "epaper" in links else {}),
                **({"ntu_cge": links["cge"]} if "cge" in links else {}),
                **({"ntu_spe": links["spe"]} if "spe" in links else {}),
            },
            "topic_tags": [],
        })
    return out


CW_HUB = "https://event.cw.com.tw/2026taiwanbridge/index.html"

def build():
    out = []
    for (no, lid, en, zh, cat, yr, aff, country, date, host, title, yt, nslug) in L:
        h_en, h_zh, city = HOSTS[host]
        rec = {
            "id": lid, "no": no, "series": "TAIWAN BRIDGES",
            "laureate": {"en": en, "zh": zh},
            "prize": {"category": cat, "year": yr},
            "affiliation": {"institution": aff, "country": country},
            "event": {"date": date, "host_key": host, "host_en": h_en, "host_zh": h_zh, "city": city},
            "title": {"en": title, "zh": None},
            "description": {"en": None, "zh": None},
            "video": {
                "lecture": HOST_UPLOAD[lid][0] if lid in HOST_UPLOAD else yt,
                "lecture_channel": CHANNEL[HOST_UPLOAD[lid][1] if lid in HOST_UPLOAD else "IPF"],
                "lecture_ipf": yt,
                "guide": GUIDE.get(lid),
                "extra_sessions": [{"id": x["id"], "label": x["label"], "date": x["date"],
                                    **({"title": {"en": x["title_en"], "zh": None}} if x.get("title_en") else {})}
                                   for x in EXTRA_SESSIONS.get(lid, [])],
            },
            "interviews": [
                {"source": s, "source_en": INTERVIEW_SRC[s]["en"], "source_zh": INTERVIEW_SRC[s]["zh"],
                 "id": v, "id_ipf": ipf}
                for s, v, ipf in INTERVIEWS.get(lid, [])
            ],
            "links": {
                "nobel_facts": f"https://www.nobelprize.org/prizes/{nslug}/facts/",
                # the original Nobel Lecture. The course requires students to
                # watch this and compare it with the Taiwan lecture, so it is
                # not optional extra reading — all 31 verified present.
                "nobel_lecture": f"https://www.nobelprize.org/prizes/{nslug}/lecture/",
                "cw_hub": CW_HUB,
                **({"instagram": f"https://www.instagram.com/reel/{NTU_LINKS[lid]['ig']}/",
                    "ntu_epaper": NTU_LINKS[lid]["epaper"],
                    "ntu_spotlight": NTU_LINKS[lid]["spotlight"]} if lid in NTU_LINKS else {}),
            },
            "topic_tags": [],
        }
        out.append(rec)
    return {"lectures": out, "ntu_lectures": build_ntu(),
            "special_events": SPECIAL,
            "standalone_records": STANDALONE_RECORDS,
            "ntu_series": {k: {"zh": v[0], "en": v[1]} for k, v in NTU_SERIES.items()},
            "hosts": {k: {"en": v[0], "zh": v[1], "city": v[2]} for k, v in HOSTS.items()}}

if __name__ == "__main__":
    root = pathlib.Path(__file__).resolve().parent.parent
    data = build()
    p = root / "data" / "catalog.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    lec = data["lectures"]
    print(f"wrote {p}  ({len(lec)} lectures, {len(data['ntu_lectures'])} NTU lectures, "
          f"{len(data['special_events'])} special events)")
    print(f"  with 導讀影片        : {sum(1 for r in lec if r['video']['guide'])}")
    print(f"  with interviews    : {sum(1 for r in lec if r['interviews'])}")
    print(f"  interview videos   : {sum(len(r['interviews']) for r in lec)}")
    print(f"  NTU extra material : {sum(1 for r in lec if 'ntu_spotlight' in r['links'])}")
    from collections import Counter
    print("  by category        :", dict(Counter(r['prize']['category'] for r in lec)))
    print("  by host            :", dict(Counter(r['event']['host_key'] for r in lec)))
