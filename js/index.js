/**
 * index.js  ── トップページ「お知らせ」最新5件表示
 */
(async () => {
  const container = document.getElementById('indexNewsContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">読み込み中...</div>';

  try {
    const rows = await fetchSheet('お知らせ');

    if (!rows) {
      container.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-muted);">スプレッドシートが未設定です</p>';
      return;
    }

    // 「公開」列(G=index6) が TRUE のもののみ・新しい順に最大5件
    const items = rows
      .filter(r => cellBool(r.c?.[6]))
      .sort((a, b) => {
        const da = parseDate(cellStr(a.c?.[0])).sortKey;
        const db = parseDate(cellStr(b.c?.[0])).sortKey;
        return db.localeCompare(da);
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
      const dateStr = parseDate(cellStr(r.c?.[0])).display;
      const cat     = cellStr(r.c?.[1]);
      const title   = cellStr(r.c?.[2]);
      const pdfUrl  = cellStr(r.c?.[5]);

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
