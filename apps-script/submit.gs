/**
 * submit.gs — the course's end of 「繳交給課程」.
 *
 * WHY THIS EXISTS
 * The museum is static files. Everything a student writes stays in their
 * browser, and the file the learning area exports — notes, and under each
 * field the record of how it was written — is made in the browser too. That
 * means the record is the student's to edit before it is handed in: no code
 * on the page can stop that, and the page says so. What this script gives
 * the course is a copy taken at the moment the key is pressed, stamped with
 * the server's own clock, signed with a secret only the course holds, and
 * kept here. The copy here is the submission; the file the student walks
 * away with is a courtesy copy. Whatever is done to that file afterwards, the
 * course already has the text as it was.
 *
 * WHAT IT PROVES, AND WHAT IT DOES NOT
 * A row proves that THIS text reached the course at THAT time and has not
 * changed since. It does not prove how the text was made or who sent it: the
 * script cannot tell the page's own send from a hand-made one — a student
 * who edits an export and re-posts it with curl (the URL is in the page)
 * gets a row and a receipt like anyone else's — and a student number typed
 * in is a claim, not a login. What the script removes is the quiet edit after
 * export. Read the sheet against the roster; when one 學號 has several rows,
 * read them side by side, and the receipt at the foot of a student's copy
 * names the row that is theirs.
 *
 * SET UP, ONCE (about five minutes)
 *   1. Make a new Google Sheet, under an account the course controls and
 *      that allows sharing outside its domain (see step 5). Extensions ▸
 *      Apps Script.
 *   2. Replace the editor's contents with this file. Save. Project Settings
 *      ▸ Time zone: Asia/Taipei (and File ▸ Settings in the Sheet itself).
 *   3. Run `setup` once from the editor. Expect the permissions dialog and,
 *      behind it, the "Google hasn't verified this app" screen: Advanced ▸
 *      Go to <project> (unsafe) ▸ Allow. The Drive permission is for the
 *      optional folder in step 4. setup() writes a random SECRET into Script
 *      Properties and adds the `submissions` tab with its header row.
 *   4. Optional: make a Drive folder for the files, copy its id from the URL,
 *      and put it under Project Settings ▸ Script Properties as FOLDER_ID.
 *      Without it the full text is kept in the sheet cell (up to ~45k
 *      characters). A folder that cannot be opened does not lose the
 *      submission: the row is still written, with the error in the 檔案 column.
 *   5. Deploy ▸ New deployment ▸ type Web app ▸ Execute as: Me ▸ Who has
 *      access: Anyone ▸ Deploy. Copy the Web app URL. If "Anyone" is not
 *      offered, the account's Workspace domain forbids it, and the browser's
 *      call will fail — make the Sheet under an account that allows it.
 *   6. Check: open the URL in a private window. It must answer
 *      {"ok":true,"service":"nlm-submit","configured":true}.
 *   7. In the museum's GitHub repo: Settings ▸ Secrets and variables ▸
 *      Actions ▸ Variables ▸ New: PUBLIC_SUBMIT_URL = that URL. Push, or run
 *      the deploy workflow by hand. The learning area then shows 「繳交給課程」
 *      beside 「下載」; press it once yourself and see the row arrive. Until
 *      the variable exists, nothing on the site sends anything anywhere.
 *
 * Anyone who can EDIT the Sheet can open this script and read SECRET; share
 * the Sheet with graders as viewers. After changing this file: Deploy ▸
 * Manage deployments ▸ edit ▸ New version. Do not rename the `submissions`
 * tab — a missing tab is recreated empty and later rows land there.
 *
 * READING IT
 * One row per submission: server time, 學號, 姓名, how many lectures, which
 * stages, the 核對碼 (SHA-256 of the text above the file's own 核對 line,
 * first ten hex — the same figure the file prints), the receipt (HMAC of the
 * whole text under SECRET, first sixteen hex, printed at the foot of the
 * student's copy), the length, and the Drive link or the text. A handed-in
 * .txt is identical to what the course received exactly when its 核對碼
 * equals the row's; but the Drive copy is the submission, and the .txt need
 * not be asked for at all. At a busy moment (a deadline) a press can be
 * refused by Apps Script's limit on simultaneous runs; the student then keeps
 * an unsigned copy and is told to press again.
 */

const PROPS = PropertiesService.getScriptProperties();
const TAB = 'submissions';
const HEADER = ['伺服器時間', '學號', '姓名', '場次數', '內容', '核對碼', '收據', '字數', '檔案', '內文'];
/** the largest body accepted, in characters — a semester's notes are ~30k */
const MAX_CHARS = 300000;
/** the line the file's own check code stands under; what is above it is
    what that code covers — see withChecksum() in src/scripts/study.ts */
const MARK = '\n═══ 核對 ═══\n';

/** run once from the editor */
function setup() {
  if (!PROPS.getProperty('SECRET')) {
    /* Utilities.getUuid() is java.util.UUID.randomUUID(): a strong source */
    PROPS.setProperty('SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  }
  sheet_();
  Logger.log('ready — now Deploy ▸ New deployment ▸ Web app');
}

function doGet() {
  return out_({ ok: true, service: 'nlm-submit', configured: !!PROPS.getProperty('SECRET') });
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return out_({ ok: false, error: 'empty' });
    if (raw.length > MAX_CHARS) return out_({ ok: false, error: 'too large' });
    const body = JSON.parse(raw);
    const id = String(body.id || '').trim().slice(0, 24);
    const name = String(body.name || '').trim().slice(0, 40);
    const text = String(body.text || '');
    const lectures = Number(body.lectures) || 0;
    const parts = String(body.parts || '').slice(0, 40);
    if (!id || !name || !text) return out_({ ok: false, error: 'missing id, name or text' });
    const secret = PROPS.getProperty('SECRET');
    if (!secret) return out_({ ok: false, error: 'server not set up — run setup()' });

    const now = new Date();
    /* the same span the file's own code covers, so the column and the
       printed figure agree; lastIndexOf, because a student can type the
       marker inside a note */
    const cut = text.lastIndexOf(MARK);
    const above = cut >= 0 ? text.slice(0, cut + 1) : text;
    const sha = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, above, Utilities.Charset.UTF_8)).slice(0, 10);
    const receipt = hex(Utilities.computeHmacSha256Signature(text, secret, Utilities.Charset.UTF_8)).slice(0, 16).toUpperCase();

    /* one writer at a time: a deadline is a burst, and two appends at once
       are the case Google's own form samples lock around */
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      /* the Drive copy is best effort: the text is already in hand, and a
         folder that cannot be opened must not cost the submission */
      let link = '';
      const folderId = PROPS.getProperty('FOLDER_ID');
      if (folderId) {
        try {
          const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
          const safe = function (v) { return v.replace(/[\\/:*?"<>|\s]+/g, '-'); };
          link = DriveApp.getFolderById(folderId)
            .createFile(stamp + '_' + safe(id) + '_' + safe(name) + '.txt', text, MimeType.PLAIN_TEXT)
            .getUrl();
        } catch (err) {
          link = 'Drive: ' + String(err && err.message || err);
        }
      }
      const kept = /^https?:/.test(link);
      sheet_().appendRow([now, cell_(id), cell_(name), lectures, cell_(parts), sha, receipt, text.length,
                          cell_(link), kept ? '' : cell_(text.slice(0, 45000))]);
    } finally {
      lock.releaseLock();
    }

    return out_({ ok: true, at: now.toISOString(), receipt: receipt, sha: sha });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

/** a cell the Sheet reads as text, whatever it starts with: appendRow takes
    a leading = + - @ as a formula, and the endpoint is public */
function cell_(v) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(TAB);
  if (!s) {
    s = ss.insertSheet(TAB);
    s.appendRow(HEADER);
    s.setFrozenRows(1);
  }
  return s;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function hex(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
