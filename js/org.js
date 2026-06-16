/**
 * org.js — 組織個別ページ
 * URL: org.html?name=○○自治会
 *
 * スプレッドシート「組織お知らせ」タブの列構成（Google Forms 自動生成）:
 *   c[0] タイムスタンプ  c[1] 組織名  c[2] 公開日  c[3] カテゴリ
 *   c[4] タイトル       c[5] 内容    c[6] 添付ファイル  c[7] 公開
 */

const SHEET_NAME = '組織お知らせ';

const CAT_CLASS = {
  '行事': 'tag-event',
  '情報': 'tag-info',
  '重要': 'tag-urgent',
};

/** Google Forms アップロードURL / Drive 共有URL → 閲覧URLに変換 */
function fileViewUrl(url) {
  if (!url) return '';
  // /file/d/ID/ 形式
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/file/d/${m1[1]}/view?usp=sharing`;
  // open?id=ID 形式（Google Forms アップロード）
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/file/d/${m2[1]}/view?usp=sharing`;
  return url.trim();
}

(async () => {
  // ── URL パラメータから組織名を取得 ──
  const params  = new URLSearchParams(location.search);
  const orgName = params.get('name') || '';

  // ページタイトル・見出しに組織名をセット
  if (orgName) {
    document.title = `${orgName} | 春日校区コミュニティ協議会`;
    const h1 = document.getElementById('orgTitle');
    const bc = document.getElementById('orgBreadcrumb');
    if (h1) h1.textContent = orgName;
    if (bc) bc.textContent = orgName;
  }

  const container = document.getElementById('orgNewsContainer');
  if (!container) return;

  if (!orgName) {
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">組織が指定されていません。</p>';
    return;
  }

  container.innerHTML = `
    <div style="text-align:center;padding:40px;">
      <div class="nc-spinner"></div>
      <p style="color:var(--text-muted);margin-top:12px;">読み込み中...</p>
    </div>`;

  try {
    const rows = await fetchSheet(SHEET_NAME);

    if (!rows) {
      container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">スプレッドシートが未設定です。</p>';
      return;
    }

    // 組織名一致 かつ 公開列が「公開する」のもの・新しい順
    const items = rows
      .filter(r => {
        const name   = cellStr(r.c?.[1]);
        const koukai = cellStr(r.c?.[7]);
        return name === orgName && koukai === '公開する';
      })
      .sort((a, b) => {
        const da = parseDate(cellStr(a.c?.[2])).sortKey;
        const db = parseDate(cellStr(b.c?.[2])).sortKey;
        return db.localeCompare(da);
      });

    if (items.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:white;border-radius:var(--radius-lg);box-shadow:var(--shadow);">
          <div style="font-size:2.5rem;margin-bottom:16px;">📭</div>
          <p style="color:var(--text-muted);">現在お知らせはありません</p>
        </div>`;
      return;
    }

    const cards = items.map(r => {
      const dateStr  = parseDate(cellStr(r.c?.[2])).display;
      const cat      = cellStr(r.c?.[3]);
      const title    = cellStr(r.c?.[4]);
      const body     = cellStr(r.c?.[5]);
      const fileUrl  = fileViewUrl(cellStr(r.c?.[6]));
      const tagClass = CAT_CLASS[cat] || 'tag-info';

      const fileLink = fileUrl
        ? `<a href="${esc(fileUrl)}" target="_blank" rel="noopener" class="nc-pdf-link">📎 添付ファイルを開く</a>`
        : '';

      const bodyHtml = body
        ? `<p class="nc-summary">${esc(body).replace(/\n/g, '<br>')}</p>`
        : '';

      return `
        <div class="nc-card">
          <div class="nc-body">
            <div class="nc-meta">
              <span class="nc-date">${esc(dateStr)}</span>
              ${cat ? `<span class="tag ${tagClass}">${esc(cat)}</span>` : ''}
            </div>
            <div class="nc-title">${esc(title)}</div>
            ${bodyHtml}
            ${fileLink}
          </div>
        </div>`;
    }).join('');

    container.innerHTML = cards;

  } catch (e) {
    console.error('org news error:', e);
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;background:white;border-radius:var(--radius-lg);box-shadow:var(--shadow);">
        <p style="color:var(--text-muted);">お知らせの読み込みに失敗しました。</p>
      </div>`;
  }
})();
