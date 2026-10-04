# 走進諾貝爾 — 網站部署說明

版本：`{{SHA}}`（{{DATE}} 打包）
原始碼：https://github.com/jhpwww/nobel

## 這一包裡有什麼

解壓縮後是一個資料夾 `{{FOLDER}}/`，裡面有：

- `site/`：網站全部檔案，共 {{FILES}} 個、約 {{MB}} MB。純靜態：HTML、CSS、JavaScript、字型、圖片、3D 模型、短片。沒有後端程式、沒有資料庫。
- `README.md`：本文件（部署說明）。
- `VERSION.txt`：版本與建置方式。

## 怎麼部署

把 `site/` **裡面的所有內容**（包含以底線開頭的 `_astro/` 和隱藏檔 `.nojekyll`）原樣複製到網站目錄，就完成了。

- 放在網域根目錄（`https://example.ntu.edu.tw/`）或任何子目錄（`https://example.ntu.edu.tw/nobel/`、`https://example.ntu.edu.tw/a/b/c/`）都可以。**所有連結與資源路徑都是相對路徑**，不需要改任何檔案，也不需要設定 base path。
- 請保持目錄結構與檔名不變，包含大小寫。
- 不需要重寫規則、`.htaccess`、404 頁或任何伺服器端設定。
- 必須經由網頁伺服器以 `http://` 或 `https://` 提供。直接在檔案總管裡雙擊 `index.html`（`file://`）打不開完整網站：瀏覽器會擋下模組化腳本與搜尋索引的讀取。

{{ADDRESS}}

## 伺服器需求

1. **純靜態檔案伺服器**：Apache、nginx、IIS、物件儲存加 CDN 皆可。
2. **目錄預設文件是 `index.html`**。每一頁都是一個資料夾加 `index.html`（例如 `lecture/geim/index.html`）。
3. **目錄網址以 `/` 結尾**：站內連結一律寫成 `…/lecture/geim/`。若訪客手動輸入不帶斜線的 `…/lecture/geim`，伺服器應轉向到帶斜線的網址——這是 Apache（mod_dir）、nginx、IIS 的預設行為，請不要關閉。（網頁本身也有一道保險：若伺服器直接在不帶斜線的網址回應頁面，頁面會自行跳到帶斜線的網址。）
4. **MIME 類型**要正確。多數伺服器已內建；IIS 請確認下列副檔名都有登錄。其中 `.js` 與 `.css` 最要緊：型別錯了，瀏覽器會直接拒載，整站只剩空白。

   | 副檔名 | Content-Type |
   |---|---|
   | `.js` | `text/javascript` |
   | `.css` | `text/css` |
   | `.json` | `application/json` |
   | `.woff2` | `font/woff2` |
   | `.webp` | `image/webp` |
   | `.glb` | `model/gltf-binary` |
   | `.webm` / `.mp4` | `video/webm` / `video/mp4` |
   | `.svg` | `image/svg+xml` |

5. **HTML 的 `Content-Type` 標頭不得宣告 UTF-8 以外的編碼**。檔案都是 UTF-8，頁內也已宣告；但若伺服器加上 `charset=Big5` 之類的標頭（Apache 的 `AddDefaultCharset Big5`，部分舊校內主機仍有），標頭會蓋過頁內宣告，所有中文變成亂碼，而且不會出現任何錯誤訊息。請設為 `UTF-8` 或關閉。
6. **支援 HTTP Range 請求**（`206 Partial Content`）：Safari 播放大廳的短片需要。Apache、nginx、IIS 預設支援；自寫的或極簡的靜態伺服器請確認。
7. **建議以 HTTPS 提供**。網站在 HTTP 下也能用，但瀏覽器只在 HTTPS（或 localhost）開放三件事：學習專區「下載」時的選擇存檔位置對話框、匯出檔尾核對碼的計算、一鍵複製。HTTP 下它們分別退為：直接下載到預設資料夾、核對碼註記「無法計算」、改用舊式複製。
8. **訪客端需能連上 YouTube**（`youtube-nocookie.com`、`i.ytimg.com`）：演講影片由 YouTube 播放。伺服器本身不需要對外連線。若網站套有內容安全政策（CSP），需允許頁內的 inline script／style 與 `youtube-nocookie.com` 的 iframe。
9. **快取**（可選）：`_astro/` 內的檔名含內容雜湊，可設長快取（例如一年、`immutable`）。`assets/` 下的字型、3D 模型與介面圖片檔名固定、版本在網址的 `?v=` 查詢字串上，長快取時請確認快取鍵包含查詢字串，否則設中等快取（一天到一週）。HTML 與 `search/*.json` 不含版號，請設短快取或 `no-cache`，日後更新時訪客才會立刻拿到新版。
10. `.nojekyll` 只對 GitHub Pages 一類會忽略底線資料夾的主機有意義，留著無害。

## 部署後請開一遍（驗收）

- 首頁 `…/`：大廳、六個獎項的門、中央的 3D 獎牌（需要 WebGL；沒有時會顯示靜態圖）。中文標題與內文顯示正常、沒有亂碼。
- 任一演講頁，例如 `…/lecture/geim/`：影片、右欄資訊、頁尾「我的筆記」。
- 把網址列的結尾斜線拿掉再按 Enter（`…/lecture/geim`）：應回到帶斜線的網址，頁面樣式完整。
- 右上角「搜尋」：輸入「石墨烯」應出現「內文」結果；點選後跳到該段落（新版瀏覽器會把該句標成金色底色）。
- 右上角旗幟：切到 `…/en/…` 再切回來。
- 瀏覽器開發者工具：Network 分頁**沒有任何 404**（尤其是 `_astro/`、`assets/fonts/bright/`、`assets/models/`、`search/zh.json`）；Console 分頁沒有紅色錯誤（尤其是 MIME type 相關訊息）。
- 若方便，請也用 iPhone 的 Safari 開首頁與任一演講頁看一次。

## 其他

- 「繳交給課程」功能在此包中{{SUBMIT}}。
- 網站不設 cookie、不用第三方分析、不含任何個人聯絡資料；學生的筆記與介面偏好只存在訪客自己的瀏覽器裡（localStorage／sessionStorage）。
- 日後要更新內容，請向站方（上列 GitHub 專案的維護者）索取新的一包。更新時建議先清空網站目錄再放入新的 `site/` 內容（直接覆蓋也能用，只是舊版的 `_astro/` 檔案會留著佔空間）。

---

## English summary

A static site. Unzip; copy everything inside `site/` (including `_astro/` and `.nojekyll`) to any directory on any static web server, keeping the directory layout and file-name case exactly as shipped. All paths are relative, so it works at the domain root or at any sub-path with no configuration. It must be served over http(s) — opening `index.html` from disk does not work.

Server requirements: `index.html` as the directory index; the usual redirect from `/dir` to `/dir/` (the page also corrects itself if the server answers the slash-less form); correct MIME types — above all `.js` as `text/javascript` and `.css` as `text/css` (module scripts are refused on any other type), plus `.json .woff2 .webp .glb .webm .mp4 .svg` (IIS: make sure they are registered); no `charset` other than UTF-8 in the HTML `Content-Type` header (a `Big5` default turns every page into mojibake with no error); HTTP Range support (Safari video); HTTPS recommended (the save-location dialog, the checksum and one-click copy exist only in a secure context). Visitors need to reach YouTube for the videos. Caching: `_astro/` may be cached for a year (hashed names); files under `assets/` are versioned by a `?v=` query string, so include it in the cache key; keep HTML and `search/*.json` short or no-cache. No server-side code, no rewrite rules, no 404 page needed.

After deploying: open the home page, a lecture page (e.g. `lecture/geim/`), try the same URL without its trailing slash, use the search (query 石墨烯) and the language flag, and confirm the Network tab shows no 404 and the Console no errors. The site sets no cookies and keeps students' notes only in their own browser; course submission is {{SUBMIT_EN}}. When updating, replace the whole directory. {{ADDRESS_EN}}
