/**
 * index.js  ── トップページ「お知らせ」最新5件表示
 */
(async () => {
  const container = document.getElementById('indexNewsContainer');
  if (!container) return;

  // ローディング表示
  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">読み込み中...</div>';

  try {
    const rows = await fetchSheet('お知らせ');

    // 「公開」列が TRUE のもののみ・新しい順に最大5件
    const items = rows
      .filter(r => cellBool(r, 6))   // G列: 公開
      .sort((a, b) => {
        const da = parseDate(cellStr(a, 0));
        const db = parseDate(cellStr(b, 0));
        return db - da;
      })
      .slice(0, 5);

    if (items.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted);">現在お知らせはありません</p>';
      return;
    }

    const catStyle = {
      '行事': 'tag-event',
      '情報': 'tag-info',
      '配布物': 'tag-notice',
      '重要': 'tag-urgent',
    };

    const li = items.map(r => {
      const date  = parseDate(cellStr(r, 0));
      const cat   = cellStr(r, 1);
      const title = cellStr(r, 2);
      const pdfUrl = cellStr(r, 5);

      const dateStr = date
        ? `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`
        : '';

      const tagClass = catStyle[cat] || 'tag-info';

      const pdfLink = pdfUrl
        ? ` <a href="${esc(drivePdfUrl(pdfUrl))}" target="_blank" rel="noopener"
               style="font-size:0.8rem;margin-left:6px;color:var(--primary);">📄 添付</a>`
        : '';

      return `
        <li class="news-item">
          <div class="news-meta">
            <span class="news-date">${esc(dateStr)}</span>
            <span class="tag ${tagClass}">${esc(cat)}</span>
          </div>
          <div class="news-text">${esc(title)}${pdfLink}</div>
        </li>`;
    }).join('');

    container.innerHTML = `<ul class="news-list">${li}</ul>`;

  } catch (e) {
    console.error('index news error:', e);
    container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted);">お知らせの読み込みに失敗しました</p>';
  }
})();
