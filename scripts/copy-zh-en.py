#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
copy-zh-en.py — editorial copy for the 31 lectures, drafted for the site's
audience (high-school and undergraduate students, general public).

Sources used as reference, never quoted verbatim onto the page:
  · the lecture titles from the IPF programme book
  · the 31 導讀 narration scripts (reference only, per the project owner)
  · each laureate's official Nobel Prize citation

Fields per lecture:
  title_zh  — Chinese rendering of the English lecture title (English stays primary)
  hook      — one tempting line; this is what makes someone click
  summary   — 2-3 sentences, no assumed background, no undefined jargon
  tags      — taxonomy keys, see TAGS below

Rewrite freely. Nothing here is generated at build time; it is all reviewable text.
"""

TAGS = {
  "physics-fundamental": ("基礎物理", "Fundamental physics"),
  "physics-applied":     ("應用物理", "Applied physics"),
  "chemistry-molecular": ("分子化學", "Molecular chemistry"),
  "life-science":        ("生命科學", "Life science"),
  "medicine-clinical":   ("臨床醫學", "Medicine & therapy"),
  "economics":           ("經濟學",   "Economics"),
  "peace-society":       ("和平與社會", "Peace & society"),
  "climate-energy":      ("氣候與能源", "Climate & energy"),
  "ai-computation":      ("人工智慧與計算", "AI & computation"),
  "method-discovery":    ("科學方法與發現歷程", "How discovery happens"),
  "ethics-responsibility":("科學倫理與社會責任", "Science & responsibility"),
  "education-career":    ("教育與生涯", "Education & careers"),
}

COPY = {

"geim": dict(
  title_zh="神奇材料",
  hook_zh="用鉛筆芯與一捲膠帶剝出的單原子薄片。",
  hook_en="A single atom thick, lifted with pencil lead and sticky tape.",
  summary_zh="石墨烯（graphene）只有一顆原子厚，卻極為強韌，也極為導電。其中的電子行為近似無質量，使相對論（relativity）效應能在實驗桌上被觀察。蓋姆與同事取得第一片的方法簡單得近乎兒戲：鉛筆芯，加上膠帶。",
  summary_en="Graphene is one atom thick, extraordinarily strong and highly conductive. Its electrons behave as though they had no mass, which puts relativity within reach of a laboratory bench. Geim and his colleague obtained the first flake with pencil lead and adhesive tape.",
  tags=["physics-applied", "method-discovery"]),

"thooft": dict(
  title_zh="以基礎科學的教育與合作，作為國與國之間的橋樑",
  hook_zh="一生研究最小的粒子，談的卻是國與國之間的距離。",
  hook_en="A career on the smallest particles, and a talk about the distance between nations.",
  summary_zh="特胡夫特的工作屬於粒子物理最抽象的一端。在這場演講裡，他談的是科學社群跨越國界運作的方式：共用的語言、共用的方法，以及在政治無法對話的時候，實驗室仍然可以。",
  summary_en="'t Hooft's work belongs to the most abstract end of particle physics. Here he speaks about how the scientific community operates across borders — a shared language, a shared method, and laboratories that keep talking when governments do not.",
  tags=["physics-fundamental", "education-career", "peace-society"]),

"karman": dict(
  title_zh="永續發展與共享的未來",
  hook_zh="戰爭之下，綠色的未來無從談起。",
  hook_en="Under war, a green future does not begin.",
  summary_zh="卡曼是葉門記者與人權運動者。她在這場演講中主張，永續（sustainability）的討論若略過戰爭、貧窮與人權，便失去意義：當生活被摧毀、當利潤先於人的尊嚴，成長本身無從發生。",
  summary_en="Karman is a Yemeni journalist and human-rights campaigner. Her argument here is that any account of sustainability that leaves out war, poverty and human rights is incomplete: where lives are being destroyed and profit comes before dignity, growth does not begin.",
  tags=["peace-society", "climate-energy", "ethics-responsibility"]),

"kornberg": dict(
  title_zh="疾病的終點？——生物醫學的非凡進展及其對人類的意義",
  hook_zh="細胞讀取基因的那一刻，被他看清楚了。",
  hook_en="The moment a cell reads its own genes, seen clearly.",
  summary_zh="康柏格解出了細胞轉錄基因的分子細節，那是生命一切運作的第一步。他從這個基礎談起近年生物醫學的進展速度，以及當醫學真的走得那麼遠時，人類將面對的問題。",
  summary_en="Kornberg worked out the molecular detail of how a cell transcribes its genes — the first step in everything a living thing does. From there he considers the pace of recent progress in biomedicine, and what follows if medicine really does go that far.",
  tags=["life-science", "medicine-clinical", "ethics-responsibility"]),

"queloz": dict(
  title_zh="科學在建立全球和平議程中的角色",
  hook_zh="找到第一顆繞著別的太陽運行的行星。",
  hook_en="The first planet found orbiting another Sun.",
  summary_zh="奎洛茲與馬約共同發現第一顆繞類太陽恆星運行的系外行星（exoplanet），此後銀河系不再被視為只有一個行星系。他在這場演講中把視線移回地球，談跨國科學合作能為共同問題帶來什麼。",
  summary_en="Queloz and Mayor found the first exoplanet orbiting a Sun-like star, after which the galaxy could no longer be thought of as holding one planetary system. Here he turns back towards Earth, and what international scientific collaboration offers shared problems.",
  tags=["physics-fundamental", "peace-society", "method-discovery"]),

"murad": dict(
  title_zh="誰能終結全球的衝突相關性暴力？——個人故事的力量與行動者的角色",
  hook_zh="一份證詞，讓長期沉默的罪行被看見。",
  hook_en="One testimony, and a long-silent crime became visible.",
  summary_zh="穆拉德是戰爭中性暴力（conflict-related sexual violence, CRSV）的倖存者。她選擇公開自己的經歷，使這項長期不被追究的罪行進入國際議程。這場演講談的是個人證詞如何成為制度改變的起點。",
  summary_en="Murad survived sexual violence used as a weapon of war and chose to tell her own story, putting a long-unprosecuted crime on the international agenda. This lecture is about how personal testimony becomes institutional change.",
  tags=["peace-society", "ethics-responsibility"]),

"pissarides": dict(
  title_zh="AI 與工作和福祉的未來",
  hook_zh="AI 取代的是工作的一部分，不是工作本身。",
  hook_en="AI takes parts of jobs, not jobs.",
  summary_zh="皮薩里德斯研究勞動市場（labour market）如何媒合人與職缺。他認為 AI 影響的是每份工作中的某些環節；判斷、溝通、照顧與臨場決策仍然需要人。真正決定結果的是訓練與轉職的機會是否跟得上。",
  summary_en="Pissarides studies how labour markets match people to work. His view is that AI takes over parts of many jobs while judgement, communication, care and split-second decisions still need people. What settles the outcome is whether training and retraining keep pace.",
  tags=["economics", "ai-computation", "education-career"]),

"maskin": dict(
  title_zh="為什麼全球化沒有縮小不平等",
  hook_zh="經濟成長的同時，差距也一起長大。",
  hook_en="As the economy grew, so did the gap.",
  summary_zh="今日的全球化以跨國分工（global value chains）為形式：一件產品，多種工序，多種技能層級。高技能的工作接上了世界市場，低技能的沒有。馬斯金主張的解方不在於減少貿易，而在於讓更多人具備參與其中的能力。",
  summary_en="Globalization now takes the form of global value chains: one product, many tasks, many skill levels. High-skill work connects to the world market; low-skill work does not. Maskin's remedy lies not in less trade but in equipping more people to take part in it.",
  tags=["economics", "education-career"]),

"sudhof": dict(
  title_zh="神經退化性疾病的藥物開發：邁向更便宜、更可持續的治療",
  hook_zh="神經之間傳遞訊號，只有千分之一秒的餘裕。",
  hook_en="Nerve cells pass a signal with a millisecond to spare.",
  summary_zh="聚德霍夫解開了神經細胞之間精確傳遞訊號（synaptic transmission）的機制。這場演講談的是阿茲海默症（Alzheimer's disease）與帕金森氏症（Parkinson's disease）等神經退化疾病（neurodegenerative diseases）的用藥困境：藥要開發得出來，也要負擔得起、供得上。",
  summary_en="Südhof worked out how nerve cells pass signals to one another with millisecond precision. This lecture concerns the harder part of treating neurodegenerative diseases such as Alzheimer's and Parkinson's: a drug must not only exist but be affordable and sustainable to supply.",
  tags=["life-science", "medicine-clinical", "ethics-responsibility"]),

"ciechanover": dict(
  title_zh="個人化醫療革命：我們能治好所有疾病嗎？代價又是什麼？",
  hook_zh="同樣的診斷，同樣的藥，結果卻不同。",
  hook_en="Same diagnosis, same drug, different outcome.",
  summary_zh="切哈諾沃發現細胞如何標記並分解不需要的蛋白質（ubiquitin-mediated protein degradation），這套機制失控時可能導致癌症。他在此談醫學離開「一體適用」的過程：2 名病人可以共有一個診斷，卻不共有一套基因。",
  summary_en="Ciechanover discovered how cells tag unwanted proteins for destruction, a system that can end in cancer when it goes wrong. Here he traces medicine's move away from one-size-fits-all: two patients may share a diagnosis without sharing a genome.",
  tags=["chemistry-molecular", "medicine-clinical", "ethics-responsibility"]),

"strickland": dict(
  title_zh="為什麼信任科學很重要",
  hook_zh="疫情期間，科學第一次在所有人面前修正自己。",
  hook_en="During the pandemic, science revised itself in public.",
  summary_zh="GPS（全球定位系統）、網際網路與個人電腦，都出自需要多年才做對的科學。史崔克蘭指出，公開修正並非科學失靈，而是它一貫的工作方式，只是這一次發生在所有人眼前。",
  summary_en="GPS, the internet and the personal computer all came out of science that took years to get right. Strickland's point is that revising in public is not a failure of science but its ordinary method, this time carried out in front of everyone.",
  tags=["physics-applied", "ethics-responsibility", "method-discovery"]),

"stiglitz": dict(
  title_zh="通往自由之路：經濟學與美好社會",
  hook_zh="市場愈自由，未必人人愈自由。",
  hook_en="A freer market is not the same as a freer person.",
  summary_zh="史迪格里茲的研究處理資訊不對稱（information asymmetry）：當交易雙方掌握的資訊不同，市場會如何失靈。這場演講延伸到更大的題目——一個社會如何安排規則，才不至於讓自由只屬於最有力量的人。",
  summary_en="Stiglitz built his career on information asymmetry: what goes wrong in markets when one side knows more than the other. This lecture extends that to a larger question — how a society arranges its rules so that freedom is not reserved for the powerful.",
  tags=["economics", "ethics-responsibility", "peace-society"]),

"haroche": dict(
  title_zh="雷射科學與量子光學、電子學及運算的新發展與應用",
  hook_zh="看見單顆光子，而沒有毀掉它。",
  hook_en="Seeing a single photon without destroying it.",
  summary_zh="測量量子系統通常會摧毀它。阿羅什設計出方法，能反覆觀測被困住的單顆光子（photon）而不將其破壞，量子世界的行為因此第一次被直接看見。他由此談雷射（laser）、量子光學（quantum optics）與量子運算（quantum computing）的走向。",
  summary_en="Measuring a quantum system usually destroys it. Haroche devised a way to observe a single trapped photon repeatedly without wrecking it, making quantum behaviour directly visible for the first time. From there he looks at lasers, quantum optics and quantum computing.",
  tags=["physics-fundamental", "ai-computation", "method-discovery"]),

"schmidt": dict(
  title_zh="科學：人類共通的橋樑",
  hook_zh="宇宙不只在膨脹，而且愈脹愈快。",
  hook_en="The universe is not only expanding. It is speeding up.",
  summary_zh="施密特的團隊測量遙遠的超新星（supernova），原本要確定宇宙膨脹減慢了多少，得到的卻是加速的結果。這個沒有人預期的答案開啟了暗能量（dark energy）的問題。他以此為例，談科學作為一種共通方法的意義。",
  summary_en="Schmidt's team measured distant supernovae expecting to find how much the expansion of the universe had slowed, and found it accelerating instead. That unwanted answer opened the question of dark energy. He uses it to talk about science as a method held in common.",
  tags=["physics-fundamental", "method-discovery", "peace-society"]),

"mayor": dict(
  title_zh="有沒有 B 行星？——人類會移民到系外行星嗎？",
  hook_zh="找到最多世界的人，說我們哪裡也去不了。",
  hook_en="The man who found other worlds says we are not going to them.",
  summary_zh="馬約與奎洛茲共同發現第一顆繞類太陽恆星運行的系外行星（exoplanet），此後已知的行星以千計。正因清楚那些世界的距離與環境，他在這場演講中給出的答案很直接：沒有 B 行星。",
  summary_en="Mayor and Queloz found the first exoplanet orbiting a Sun-like star; thousands are now known. Precisely because he knows how far away and how hostile those worlds are, his answer here is a plain one: there is no Planet B.",
  tags=["physics-fundamental", "climate-energy", "ethics-responsibility"]),

"meldal": dict(
  title_zh="為永續世界而生的化學——萬物皆化學，以及它如何影響我們的選擇",
  hook_zh="讓分子像扣子一樣扣上，乾淨且快速。",
  hook_en="Molecules that snap together, quickly and cleanly.",
  summary_zh="梅爾達爾是「點擊化學」（click chemistry）的奠基者之一。這套方法讓分子快速而精確地接合，減少廢棄物、耗能與副反應，也改變了製藥與新材料的做法。以更少的材料、更少的能源，達成同樣的結果。",
  summary_en="Meldal is one of the founders of click chemistry, a way of joining molecules quickly and precisely with less waste, less energy and fewer side reactions. It changed how drugs and new materials are made. Less material, less energy, the same result.",
  tags=["chemistry-molecular", "climate-energy", "method-discovery"]),

"engle": dict(
  title_zh="以金融方法看氣候風險",
  hook_zh="氣候風險已經在退休金的帳上。",
  hook_en="Climate risk is already on the pension statement.",
  summary_zh="恩格爾發明了衡量金融市場波動會群聚（volatility clustering）的方法，成為風險管理的基本工具。他把同一套思路用於氣候：乾旱、洪水與政策轉向都會改變資產價格，因此氣候風險就是財務風險。",
  summary_en="Engle invented the method for measuring how financial volatility clusters, now a standard tool of risk management. He applies the same thinking to the climate: droughts, floods and policy shifts move asset prices, which makes climate risk a financial risk.",
  tags=["economics", "climate-energy"]),

"roberts": dict(
  title_zh="你為什麼應該喜歡基因改造食品",
  hook_zh="基因不是一段連續的文字。",
  hook_en="A gene is not one continuous piece of text.",
  summary_zh="羅伯茨發現基因中夾著必須被剪除的片段（introns，內含子），改寫了人們對基因運作的理解。在這場演講中，他直接處理一個有爭議的題目，主張對基因改造作物的恐懼，代價由最需要糧食的人承擔。",
  summary_en="Roberts discovered that genes are interrupted by stretches that must be cut out — introns — which rewrote how genes were understood. Here he takes on a contested subject, arguing that fear of genetically modified crops is paid for by the people who most need food.",
  tags=["life-science", "ethics-responsibility", "climate-energy"]),

"mbmoser": dict(
  title_zh="大腦的導航與記憶系統，及其與阿茲海默症的關聯",
  hook_zh="大腦裡有一組細胞，替空間鋪出座標。",
  hook_en="A set of cells lays a coordinate grid over space.",
  summary_zh="在大腦的內嗅皮質（entorhinal cortex）中，一群神經細胞以規律的網格形式放電，讓人知道自己身在何處，也把空間與記憶連在一起。莫瑟指出，這套系統在阿茲海默症（Alzheimer's disease）早期即受損。",
  summary_en="In the brain's entorhinal cortex, certain neurons fire in a regular grid, telling you where you are and tying space to memory. Moser shows that this system is among the first to be damaged in Alzheimer's disease.",
  tags=["life-science", "medicine-clinical"]),

"nurse": dict(
  title_zh="生命是什麼？",
  hook_zh="控制細胞何時分裂的開關，從酵母菌到人類幾乎一樣。",
  hook_en="The switch that times cell division is nearly the same in yeast and in us.",
  summary_zh="納斯找到了細胞週期（cell cycle）推進的關鍵控制點，這套機制跨越物種幾乎不變，也是癌症研究的核心。累積了一生的答案之後，他回到那個最基本的提問。",
  summary_en="Nurse identified the control point that drives the cell cycle forward, a mechanism almost unchanged across species and central to cancer research. With a career's worth of answers behind him, he returns to the most basic question of all.",
  tags=["life-science", "method-discovery"]),

"winter": dict(
  title_zh="抗體革命",
  hook_zh="在實驗室裡讓演化跑一遍。",
  hook_en="Evolution, run inside a laboratory.",
  summary_zh="溫特找到方法，讓實驗室能一輪一輪篩選出愈來愈精準的抗體（phage display，噬菌體展示）。今日許多治療癌症與自體免疫疾病（autoimmune diseases）的藥物，都由此而來。",
  summary_en="Winter found a way to let a laboratory run selection itself, round after round, for ever more precise antibodies. Many of today's cancer and autoimmune drugs are made exactly this way.",
  tags=["chemistry-molecular", "medicine-clinical", "method-discovery"]),

"mcdonald": dict(
  title_zh="回答關於宇宙及其演化的根本問題",
  hook_zh="地底 2 公里處，為了看清楚太陽。",
  hook_en="Two kilometres underground, in order to see the Sun.",
  summary_zh="太陽送出的微中子（neutrino），地面只測到預期的三分之一，這個落差困擾物理學界 30 年。麥克唐納在地底深處的實驗證明它們並未消失，只是改變了身分。微中子因此必須具有質量，標準模型（Standard Model）並不完整。",
  summary_en="Only a third of the neutrinos the Sun should send us were being counted, a discrepancy that troubled physics for 30 years. McDonald's experiment, deep underground, showed they had not vanished but changed identity: neutrinos must have mass, and the Standard Model is incomplete.",
  tags=["physics-fundamental", "method-discovery"]),

"noyori": dict(
  title_zh="化學是創造價值的科學",
  hook_zh="同一個分子的左手與右手，作用可能相反。",
  hook_en="The left and right hand of one molecule can do opposite things.",
  summary_zh="許多分子存在互為鏡像的 2 種形式，如同左右手。在人體內往往只有一種有效，另一種可能有害。野依良治發展出不對稱催化（asymmetric catalysis），能選擇性地只合成需要的那一種。",
  summary_en="Many molecules exist in two mirror-image forms, like a left and a right hand. Inside the body often only one is useful and the other may do harm. Noyori developed asymmetric catalysis, which builds only the hand that is wanted.",
  tags=["chemistry-molecular", "method-discovery"]),

"emoser": dict(
  title_zh="大腦的 GPS：我們如何知道自己在哪裡",
  hook_zh="移動的時候，大腦始終知道自己在哪。",
  hook_en="As you move, the brain keeps track of where you are.",
  summary_zh="莫瑟與研究團隊發現了網格細胞（grid cells）：它們在大腦中鋪出規律的座標網，使人在移動時持續掌握自身位置。這是大腦為空間建立地圖的方式，記憶也附著其上。",
  summary_en="Moser and his colleagues discovered grid cells, which lay a regular coordinate mesh inside the brain so that position is tracked continuously during movement. It is how the brain maps space, and the scaffold that memory hangs on.",
  tags=["life-science", "method-discovery"]),

"rice": dict(
  title_zh="全球傳染病：勝利與挑戰",
  hook_zh="一種曾經無藥可醫的病毒，如今幾週可癒。",
  hook_en="A virus once beyond treatment, now cured in weeks.",
  summary_zh="C 型肝炎（hepatitis C）曾在全球感染數千萬人，終致肝硬化（cirrhosis）與肝癌。萊斯的研究讓這種病毒首次能在實驗室中完整培養，治癒性藥物才得以出現。他以此為起點，談下一場疫情所欠缺的準備。",
  summary_en="Hepatitis C infected tens of millions worldwide and ended in cirrhosis and liver cancer. Rice's work made it possible to grow the virus in the laboratory for the first time, which is what opened the way to a cure. He takes that as the starting point for what is still missing before the next outbreak.",
  tags=["life-science", "medicine-clinical"]),

"wuthrich": dict(
  title_zh="生命的分子、AI 與人類健康",
  hook_zh="蛋白質的形狀決定它的功能，而它小到看不見。",
  hook_en="A protein's shape decides what it does, and it is far too small to see.",
  summary_zh="維特里希發展出以核磁共振（nuclear magnetic resonance, NMR）在溶液中解出蛋白質三維結構的方法，也就是在接近生命實際狀態的環境下觀察它。這條路一直延伸到今日的 AI 結構預測（protein structure prediction）。",
  summary_en="Wüthrich developed a way to determine a protein's three-dimensional structure in solution using nuclear magnetic resonance — that is, close to the state in which life keeps it. That road runs all the way to today's AI structure prediction.",
  tags=["chemistry-molecular", "ai-computation", "method-discovery"]),

"semenza": dict(
  title_zh="氧氣、二氧化碳，與地球上的永續生命",
  hook_zh="身體隨時在數氧氣，並且知道該怎麼辦。",
  hook_en="The body counts its oxygen, and knows what to do about it.",
  summary_zh="塞門薩找到細胞感測氧氣濃度的分子開關（HIF，缺氧誘導因子）。缺氧時它會啟動一整套反應，例如生成新血管。這套機制關係到貧血與心血管疾病，腫瘤也利用它為自己供血。",
  summary_en="Semenza found the molecular switch by which a cell senses how much oxygen it has. When oxygen runs short it triggers a whole programme of responses, such as growing new blood vessels. The same system underlies anaemia and heart disease, and tumours use it to feed themselves.",
  tags=["life-science", "medicine-clinical", "climate-energy"]),

"roth": dict(
  title_zh="市場、市場設計與醫療",
  hook_zh="腎臟不能買賣，但仍然必須被分配。",
  hook_en="A kidney cannot be bought, and still must be allocated.",
  summary_zh="有些東西不該標價，配對卻仍然得做，而且做得好壞攸關生死。羅斯把經濟學轉為一種設計工作（market design，市場設計）：重新設計規則本身，使捐贈者與病患得以配對。這套方法已在多國實際運作。",
  summary_en="Some things should carry no price, yet the matching still has to be done, and how well it is done decides who lives. Roth turned economics into a design discipline: redesigning the rules themselves so that donors and patients can be matched. The method is in use in several countries.",
  tags=["economics", "medicine-clinical", "ethics-responsibility"]),

"kobilka": dict(
  title_zh="藥物開發的新時代",
  hook_zh="市售藥物約有三分之一，作用在同一類受體上。",
  hook_en="About a third of all medicines act on the same family of receptors.",
  summary_zh="細胞表面的 G 蛋白偶合受體（G protein-coupled receptors, GPCR）負責把外界訊號傳入細胞。科比爾卡拍下了這類受體在傳遞訊號當下的立體結構，使藥物設計得以看著標靶進行。",
  summary_en="G protein-coupled receptors sit on the cell surface and carry signals from the outside world in. Kobilka captured their three-dimensional structure at the instant a signal passes, which let drug design begin to aim at a target it can see.",
  tags=["chemistry-molecular", "medicine-clinical", "method-discovery"]),

"kajita": dict(
  title_zh="科學對建立和平的重要性",
  hook_zh="每一秒，數以兆計的微中子穿過人體。",
  hook_en="Trillions of neutrinos pass through a body every second.",
  summary_zh="梶田隆章證明微中子（neutrino）在飛行途中會改變身分（neutrino oscillation，微中子振盪），這代表它們具有質量，而粒子物理原先假設沒有。這項結果需要跨國、跨世代的合作才可能完成，也是他在此談論的主題。",
  summary_en="Kajita showed that neutrinos change identity in mid-flight, which means they carry mass where particle physics had assumed none. The result took collaboration across nations and across generations, and that is his subject here.",
  tags=["physics-fundamental", "peace-society", "method-discovery"]),

"frank": dict(
  title_zh="冷凍電子顯微鏡：分子醫學與藥物設計的新基礎",
  hook_zh="數千張模糊的照片，合成一個清晰的分子。",
  hook_en="Thousands of blurred pictures, combined into one clear molecule.",
  summary_zh="法蘭克發展出影像處理方法，將成千上萬張模糊的電子顯微鏡（electron microscope）影像合成為清晰的立體結構。配合急速冷凍，也就是冷凍電子顯微鏡（cryo-electron microscopy, cryo-EM），蛋白質首次能在接近自然的狀態下被看見。",
  summary_en="Frank developed the image processing that combines thousands of blurred electron-microscope pictures into one sharp three-dimensional structure. With flash-freezing — cryo-electron microscopy — proteins could be seen close to their natural state for the first time.",
  tags=["chemistry-molecular", "medicine-clinical", "method-discovery"]),
}
# ---------------------------------------------------------------------------
# 臺大「諾貝爾獎得主講座」 — copy for the museum's second collection.
#
# Same fields, same voice, same ruler. Measured against the 31: title 4-31
# characters, hook_zh 12-24, hook_en 5-15 words, summary_zh 53-88 characters of
# prose once the bracketed originals are set aside, summary_en 31-55 words.
# Glosses are free against that budget and every proper noun takes one on first
# use — except a laureate this museum already holds, who is named bare the way
# queloz and mayor name each other.
#
# Written from the recordings themselves, watched through their caption tracks;
# nothing is quoted. Where the caption track could not support a claim, the
# claim is not here.
# ---------------------------------------------------------------------------
NTU_COPY = {

"mourou": dict(
  title_zh="我一生對光的追求",
  hook_zh="雷射脈衝得先拉長，才能放大。",
  hook_en="A laser pulse had to be stretched before it could be amplified.",
  summary_zh="慕儒與博士生史崔克蘭發明了啁啾脈衝放大（chirped pulse amplification, CPA）：脈衝先拉長，放大後再壓回。雷射強度 20 年的停滯就此結束，近視雷射手術與粒子加速隨之而來。談到研究卡關，他說手上永遠同時做好幾個題目。",
  summary_en="Mourou and his doctoral student Donna Strickland invented chirped pulse amplification: a pulse is stretched, amplified, then squeezed back. Twenty years of stalled laser intensity ended with it, and laser eye surgery and particle acceleration followed. Asked what he does when work stalls, he says he always keeps several projects running.",
  tags=["physics-applied", "method-discovery", "education-career"]),

"stoddart": dict(
  title_zh="我的學思歷程",
  hook_zh="在沒有電的農場長大，後來造出了會動的分子。",
  hook_en="A childhood on a farm with no electricity, a career building molecules that move.",
  summary_zh="史托達特把分子做成互相套住的環：沒有化學鍵，卻分不開。這是機械鍵（mechanical bond）：環沿著軸來回滑動，分子機器（molecular machines）由此而來。演講從他 18 歲才通電的蘇格蘭農場講起，收在給年輕研究者的建議。",
  summary_en="Stoddart's molecules are rings threaded through one another: no chemical bond, and impossible to pull apart. That mechanical bond lets a ring slide back and forth along an axle, and molecular machines follow. The lecture runs from a Scottish farm that had no electricity until he was eighteen to his advice to young researchers.",
  tags=["chemistry-molecular", "education-career"]),

"ciechanover-ntu": dict(
  title_zh="個人化醫療的革命：我們能治好所有疾病嗎？代價又是什麼？",
  hook_zh="人類多活的 35 年，大半是 20 世紀給的。",
  hook_en="Most of the years a life has gained were added in the twentieth century.",
  summary_zh="20 世紀讓人活得夠久，才遇得上心血管疾病、癌症與神經退化疾病（neurodegenerative diseases）。切哈諾沃追溯藥物開發從偶然（penicillin，盤尼西林）到大量篩選（high-throughput screening），再到針對病人自身突變設計的藥物；代價落在費用、可近性（accessibility）與基因隱私。",
  summary_en="The twentieth century made lives long enough to meet heart disease, cancer and neurodegeneration. Ciechanover traces drug development from chance — penicillin — through high-throughput screening to drugs aimed at a patient's own mutation, and puts the price at cost, access and genetic privacy.",
  tags=["medicine-clinical", "method-discovery", "ethics-responsibility"]),

"aspect": dict(
  title_zh="從愛因斯坦與貝爾到量子科技：量子糾纏的實際運作",
  hook_zh="光子還在路上，才切換要測的方向。",
  hook_en="The measurement was chosen while the photons were already in flight.",
  summary_zh="愛因斯坦（Albert Einstein）認為量子力學並不完整，貝爾（John Bell）證明這個爭論可以用實驗裁決。阿斯佩以成對的糾纏光子（entangled photons）做出測量，並在光子飛行途中才切換測量的方向。他由此談到量子密碼（quantum cryptography）與量子運算（quantum computing）。",
  summary_en="Einstein held that quantum mechanics was incomplete; Bell showed the dispute could be settled by experiment. Aspect made that measurement with pairs of entangled photons, switching the direction of measurement while the photons were in flight. From there he turns to quantum cryptography and quantum computing.",
  tags=["physics-fundamental", "ai-computation", "method-discovery"]),

"aspect-2": dict(
  title_zh="兩次量子革命：從概念到應用",
  hook_zh="電晶體與雷射，只是第一次量子革命的成果。",
  hook_en="The transistor and the laser were only the first quantum revolution.",
  summary_zh="阿斯佩把量子物理分成兩次革命：第一次從波粒二象性（wave-particle duality）走到電晶體與雷射；第二次從量子糾纏（entanglement）起步，還要能逐一操控單一量子物體（individual quantum objects）。他指出，量子電腦（quantum computer）的優勢可能是更省電，而不是解出更難的題目。",
  summary_en="Aspect divides quantum physics into two revolutions. The first ran from wave-particle duality to the transistor and the laser; the second starts from entanglement, and needs quantum objects handled one at a time. A quantum computer's advantage, he suggests, may lie in using less electricity rather than in solving harder problems.",
  tags=["physics-fundamental", "physics-applied", "ai-computation"]),

"robinson": dict(
  title_zh="國家為什麼會失敗",
  hook_zh="他說自己和共同作者，當年太看重物質，低估了觀念。",
  hook_en="He and his co-author were too materialist, he says, and underrated ideas.",
  summary_zh="廣納型制度（inclusive institutions）把誘因與機會開放給所有人，榨取型制度（extractive institutions）只留給少數人，貧富由此而分。經濟能否廣納，取決於政治權力是否分散：臺灣與南韓威權時期的成長，是靠後來的政治轉型才留下來。",
  summary_en="Inclusive institutions open incentives and opportunity to everyone; extractive ones keep both for a few, and prosperity follows. Whether an economy can be inclusive depends on how widely political power is spread. Growth under authoritarian rule in Taiwan and South Korea lasted, Robinson argues, because the politics opened afterwards.",
  tags=["economics", "peace-society"]),

"robinson-fish-i": dict(
  title_zh="緣木求魚（上）",
  hook_zh="健康與教育排得出高下，文化排不出。",
  hook_en="Health and schooling can be ranked. Culture cannot.",
  summary_zh="發展經濟學（development economics）看窮國，向來是缺什麼就補什麼。羅賓森重新分類：哪些真有高下，哪些只是不同，哪些改得動。世界銀行（World Bank）在賴索托（Lesotho）開牛隻市場，沒有人賣牛：牛在當地是積蓄，也是聘禮。",
  summary_en="Development economics looks at a poor country and asks what it lacks. Robinson re-sorts those lacks: what can genuinely be ranked, what is merely different, and what can be changed. The World Bank opened a cattle market in Lesotho and nobody sold a cow. Cattle there are savings, and bride wealth.",
  tags=["economics", "method-discovery"]),

"robinson-fish-ii": dict(
  title_zh="緣木求魚（下）",
  hook_zh="同一項特質，在不同的社會裡優劣可能相反。",
  hook_en="The same trait can rank opposite ways in two societies.",
  summary_zh="文化、規範與社會組織是發展的非古典決定因素（non-classical determinants）。羅賓森指出，這類特質沒有普遍的高下，換個社會就可能對調；想用政策直接改變，結果多半不如預期。干預應順著既有特質走，而非改造它。",
  summary_en="Culture, norms and social organisation are development's non-classical determinants. Robinson argues they carry no general ranking: a trait that helps one society hinders the next, and policy aimed straight at changing it mostly misfires. The case is for interventions that take existing traits as given rather than remake them.",
  tags=["economics", "ethics-responsibility", "method-discovery"]),
}
