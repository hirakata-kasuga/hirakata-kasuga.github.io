/**
 * Google スプレッドシート共通フェッチユーティリティ
 * config.js の SITE_CONFIG.SPREADSHEET_ID を参照する
 */

/** シート名を指定してデータ行の配列を取得する */
async function fetchSheet(sheetName) {
  const id = window.SITE_CONFIG?.SPREADSHEET_ID;
  if (!id || id === 'YOUR_SHEET_ID_HERE') return null; // 未設定

  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq`
    + `?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;

  const res  = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
  return json.table?.rows ?? [];
}

/** セルの値を安全に文字列として取得する */
function cellStr(cell) {
  if (!cell || cell.v == null) return '';
  return String(cell.v).trim();
}

/** セルの値が FALSE / false / "FALSE" でなければ true と見なす */
function cellBool(cell) {
  if (!cell || cell.v == null) return true;
  const v = cell.v;
  if (v === false) return false;
  if (typeof v === 'string' && v.toUpperCase() === 'FALSE') return false;
  return true;
}

/**
 * "Date(2026,4,10)" 形式 または "2026/05/10" "2026-05" 等の文字列を
 * { display: "2026.05.10", sortKey: "2026-05-10" } に変換する
 */
function parseDate(val) {
  if (!val) return { display: '', sortKey: '' };

  // gviz Date オブジェクト形式
  const dm = String(val).match(/Date\((\d+),(\d+),(\d+)\)/);
  if (dm) {
    const y = dm[1];
    const m = String(Number(dm[2]) + 1).padStart(2, '0');
    const d = String(dm[3]).padStart(2, '0');
    return { display: `${y}.${m}.${d}`, sortKey: `${y}-${m}-${d}` };
  }

  // "YYYY/MM" 形式（配布物・広報誌の年月のみ）
  const ym = String(val).match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (ym) {
    const y = ym[1];
    const m = ym[2].padStart(2, '0');
    return { display: `${y}年${m}月`, sortKey: `${y}-${m}` };
  }

  // "YYYY/MM/DD" 形式
  const parts = String(val).match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (parts) {
    const y = parts[1];
    const m = parts[2].padStart(2, '0');
    const d = parts[3].padStart(2, '0');
    return { display: `${y}.${m}.${d}`, sortKey: `${y}-${m}-${d}` };
  }

  const s = String(val).trim();
  return { display: s, sortKey: s };
}

/** Google Drive 共有URLを画像サムネイルURLに変換する */
function driveImgUrl(url) {
  if (!url) return '';
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : url.trim();
}

/** Google Drive 共有URLをPDF閲覧URLに変換する */
function drivePdfUrl(url) {
  if (!url) return '';
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/view?usp=sharing` : url.trim();
}

/** XSS対策: HTML エスケープ */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** 未設定メッセージを container に表示する */
function showSetupMessage(container) {
  container.innerHTML = `
    <div class="state-box">
      <div class="state-icon">📋</div>
      <h3>スプレッドシートの設定が必要です</h3>
      <p>js/config.js の SPREADSHEET_ID を設定してください。</p>
    </div>`;
}

/** ローディング中表示 */
function showLoading(container) {
  container.innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      <p>読み込み中...</p>
    </div>`;
}

/** エラー表示 */
function showError(container, msg) {
  container.innerHTML = `
    <div class="state-box">
      <div class="state-icon">⚠️</div>
      <p>${esc(msg || 'データの読み込みに失敗しました。')}</p>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:8px;">
        スプレッドシートの共有設定をご確認ください。
      </p>
    </div>`;
}

/** 件数ゼロ表示 */
function showEmpty(container) {
  container.innerHTML = `
    <div class="state-box">
      <div class="state-icon">📭</div>
      <p>現在公開中のデータはありません</p>
    </div>`;
}
