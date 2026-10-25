/**
 * 投稿受付 Web アプリ（Google Apps Script）
 *
 * 流れ（AUTO_PUBLISH = false の承認制のとき）:
 *   post.html → doPost → 【非公開】スプレッドシートの「投稿受付」タブ + 非公開のDriveファイル
 *   役員が内容を確認し、公開列を「公開する」に変更
 *   → publishApproved（5分おきに自動実行）が、ファイルを閲覧可にして
 *     【公開】サイト用スプレッドシートの「組織お知らせ」へコピー
 *
 * こうすることで、確認前の投稿（本文・写真）は外から一切読めない。
 * AUTO_PUBLISH = true のときは、承認を待たず、投稿を受け取った時点で公開側へ書き込む。
 *
 * このスクリプトは「非公開」側のスプレッドシート（合言葉・投稿受付を置く方）の
 * 拡張機能 → Apps Script から作成する。手順は別途保管の手順書を参照。
 * 推奨: 個人ではなく、協議会用のGoogleアカウント（2段階認証あり）で作る。
 */

// ▼ 設定 ───────────────────────────────────────────
const FOLDER_ID  = '【添付ファイル保存用 Drive フォルダのID（非公開のまま）】';
const SITE_SS_ID = '【サイト用（公開）スプレッドシートのID】';
const PASS_SHEET = '合言葉';      // A列: 組織名 / B列: 合言葉
const IN_SHEET   = '投稿受付';    // 非公開側。列: タイムスタンプ/組織名/公開日/カテゴリ/タイトル/内容/添付ファイル/公開/処理結果
const OUT_SHEET  = '組織お知らせ'; // 公開側（サイト用）
const AUTO_PUBLISH = true;         // true: 投稿を確認なしですぐ公開する / false: 事務局が「公開する」にするまで公開しない
const MAX_FAILS  = 5;             // 合言葉の間違いがこの回数に達したら10分間その組織の投稿を止める
const MAX_FILES  = 10;
const MAX_BYTES  = 10 * 1024 * 1024; // 1ファイルの上限（デコード後）
// ▲ ────────────────────────────────────────────────

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const p = JSON.parse(e.postData.contents);

    if (p.hp) return reply({ ok: true });                     // ボット対策（隠し欄に入力あり → 黙って捨てる）

    const org   = String(p.org || '').trim();
    const title = String(p.title || '').trim();
    const body  = String(p.body || '').trim();
    if (!org || !title) return reply({ ok: false, error: '部会名とタイトルは必須です。' });
    if (title.length > 100 || body.length > 3000) return reply({ ok: false, error: '文字数が多すぎます。' });

    const auth = checkPass_(org, String(p.pass || ''));
    if (auth !== 'ok') return reply({ ok: false, error: auth });

    const files = (p.files || []).filter(f => f && f.data);
    if (files.length > MAX_FILES) return reply({ ok: false, error: 'ファイルは' + MAX_FILES + '個までです。' });
    // 非公開のまま保存（公開は承認後に publishApproved が行う）
    const urls = files.map((f, i) => saveFile_(org, title, f, i + 1));

    const category = ['情報', '行事', '重要'].indexOf(p.category) >= 0 ? p.category : '情報';
    const now  = new Date();
    const inSh = SpreadsheetApp.getActive().getSheetByName(IN_SHEET);
    const fileCell = urls.join('\n');

    if (AUTO_PUBLISH) {
      // 即公開: ファイルを閲覧可にして公開側へ書き込み、受付側には記録として残す
      urls.forEach(u => shareFile_(u));
      appendRow_(SpreadsheetApp.openById(SITE_SS_ID).getSheetByName(OUT_SHEET),
        [now, org, now, category, title, body, fileCell, '公開する']);
      appendRow_(inSh, [now, org, now, category, title, body, fileCell, '自動公開', '反映済 ' + stampNow_()]);
    } else {
      appendRow_(inSh, [now, org, now, category, title, body, fileCell, '確認待ち', '']);
    }
    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: '送信に失敗しました。時間をおいてもう一度お試しください。' });
  } finally {
    lock.releaseLock();
  }
}

/** 合言葉を照合する。OKなら 'ok'、だめならエラーメッセージを返す */
function checkPass_(org, pass) {
  const cache = CacheService.getScriptCache();
  const key   = 'fail:' + org;
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return '合言葉の間違いが続いたため、しばらく投稿できません。10分ほど待ってからお試しください。';

  const rows = SpreadsheetApp.getActive().getSheetByName(PASS_SHEET).getDataRange().getValues();
  const row  = rows.find(r => String(r[0]).trim() === org);
  if (row && String(row[1]).trim() !== '' && String(row[1]).trim() === pass.trim()) return 'ok';

  cache.put(key, String(fails + 1), 600);
  return '合言葉が違います。';
}

/** Drive に非公開で保存してURLを返す。中身がPDF/JPEGでなければ拒否 */
function saveFile_(org, title, f, n) {
  const bytes = Utilities.base64Decode(f.data);
  if (bytes.length > MAX_BYTES) throw new Error('file too large');
  const b = bytes.slice(0, 4).map(x => x & 0xFF);
  const isPdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;   // %PDF
  const isJpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  if (!isPdf && !isJpg) throw new Error('unsupported file');

  const ext   = isPdf ? 'pdf' : 'jpg';
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  const name  = stamp + '_' + org + '_' + title.slice(0, 20).replace(/[\/\\]/g, '_') + '_' + n + '.' + ext;
  const blob  = Utilities.newBlob(bytes, isPdf ? 'application/pdf' : 'image/jpeg', name);
  return DriveApp.getFolderById(FOLDER_ID).createFile(blob).getUrl();
}

/**
 * 行を追記する。文字列は書式「テキスト」にして書くので、
 * 「=」「+」などで始まる入力が数式として実行されることはない。
 * 日時(Date)の列はそのまま。
 */
function appendRow_(sheet, values) {
  const r = sheet.getLastRow() + 1;
  const range = sheet.getRange(r, 1, 1, values.length);
  range.setNumberFormat('@');                                // 一度すべてテキストに
  range.setValues([values.map(v => v instanceof Date ? v : String(v))]);
  [1, 3].forEach(c => {                                      // A(タイムスタンプ)・C(公開日)は日時に戻す
    if (values[c - 1] instanceof Date) sheet.getRange(r, c).setNumberFormat('yyyy/MM/dd HH:mm:ss').setValue(values[c - 1]);
  });
}

function shareFile_(url) {
  const id = fileId_(url);
  if (id) DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
}

function stampNow_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}

/** Drive URL → ファイルID */
function fileId_(url) {
  const m = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * 承認済み(公開列=「公開する」)の投稿を公開側にコピーし、ファイルを閲覧可にする。
 * 「却下」の投稿はファイルをゴミ箱へ。時間トリガー(setupTriggers)で5分おきに実行される。
 */
function publishApproved() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const inSheet  = SpreadsheetApp.getActive().getSheetByName(IN_SHEET);
    const outSheet = SpreadsheetApp.openById(SITE_SS_ID).getSheetByName(OUT_SHEET);
    const rows = inSheet.getDataRange().getValues();
    const stamp = () => Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = String(row[7]).trim();
      if (String(row[8]).trim() !== '') continue;            // 処理済み

      const ids = String(row[6]).split('\n').map(fileId_).filter(Boolean);
      if (status === '公開する') {
        ids.forEach(id => DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW));
        appendRow_(outSheet, [row[0], row[1], row[2], row[3], row[4], row[5], row[6], '公開する']);
        inSheet.getRange(i + 1, 9).setValue('反映済 ' + stamp());
      } else if (status === '却下') {
        ids.forEach(id => DriveApp.getFileById(id).setTrashed(true));
        inSheet.getRange(i + 1, 9).setValue('却下済 ' + stamp());
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/** 最初に1回だけ手動で実行する（5分おきに publishApproved を動かす） */
function setupTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'publishApproved')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('publishApproved').timeBased().everyMinutes(5).create();
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
