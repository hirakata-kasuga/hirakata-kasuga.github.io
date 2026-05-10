/**
 * 広報誌ページ — Google スプレッドシート「広報誌」シートから読み込む
 *
 * スプレッドシートの列構成（1行目は見出し）
 *   A: 発行年月  例) 2026/04  ← YYYY/MM 形式
 *   B: 号数     例) 第15号
 *   C: テーマ   例) 春号 / 夏号 / 冬号
 *   D: 表紙画像URL  GoogleドライブのURLをそのまま貼る（任意）
 *   E: PDF_URL  GoogleドライブのURLをそのまま貼る
 *   F: 公開     TRUE=公開、FALSE=下書き
 */

function buildKouhouCard(item) {
  const imgHtml = item.imageUrl
    ? `<div class="kh-cover">
         <img src="${item.imageUrl}" alt="${esc(item.title)}号の表紙"
              loading="lazy" onerror="this.closest('.kh-cover').innerHTML='<div class=kh-noimg>🌸</div>'">
       </div>`
    : `<div class="kh-cover"><div class="kh-noimg">🌸</div></div>`;

  const pdfBtn = item.pdfUrl
    ? `<a href="${item.pdfUrl}" target="_blank" rel="noopener" class="btn btn-primary kh-btn">
         📖 広報誌を読む
       </a>`
    : `<span class="kh-soon">準備中</span>`;

  return `
    <article class="kh-card">
      ${imgHtml}
      <div class="kh-body">
        <div class="kh-issue">${esc(item.issue)}</div>
        <div class="kh-theme">${esc(item.theme)}</div>
        <div class="kh-date">${esc(item.monthLabel)} 発行</div>
        ${pdfBtn}
      </div>
    </article>`;
}

async function initKouhou() {
  const container = document.getElementById('kouhouContainer');
  if (!container) return;

  showLoading(container);

  try {
    const rows = await fetchSheet('広報誌');

    if (rows === null) { showSetupMessage(container); return; }

    const items = rows
      .map(row => {
        const c        = row.c ?? [];
        const ymParsed = parseDate(cellStr(c[0]));
        return {
          monthKey:   ymParsed.sortKey,
          monthLabel: ymParsed.display,
          issue:      cellStr(c[1]),
          theme:      cellStr(c[2]),
          imageUrl:   driveImgUrl(cellStr(c[3])),
          pdfUrl:     drivePdfUrl(cellStr(c[4])),
          published:  cellBool(c[5]),
          title:      cellStr(c[1]) || cellStr(c[2]),
        };
      })
      .filter(i => i.published && i.title)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    if (items.length === 0) { showEmpty(container); return; }

    // 最新号を大きく表示し、残りをグリッドに並べる
    const [latest, ...rest] = items;

    const latestImgHtml = latest.imageUrl
      ? `<div class="kh-latest-img">
           <img src="${latest.imageUrl}" alt="${esc(latest.title)}の表紙" loading="lazy"
                onerror="this.closest('.kh-latest-img').innerHTML='<div class=kh-latest-noimg>🌸</div>'">
         </div>`
      : `<div class="kh-latest-img"><div class="kh-latest-noimg">🌸</div></div>`;

    const latestPdf = latest.pdfUrl
      ? `<a href="${latest.pdfUrl}" target="_blank" rel="noopener" class="btn btn-white kh-latest-btn">
           📖 最新号を読む
         </a>`
      : '';

    const latestHtml = `
      <div class="kh-latest">
        ${latestImgHtml}
        <div class="kh-latest-body">
          <div class="kh-latest-badge">最新号</div>
          <div class="kh-latest-issue">${esc(latest.issue)}</div>
          <div class="kh-latest-theme">${esc(latest.theme)}</div>
          <div class="kh-latest-date">${esc(latest.monthLabel)} 発行</div>
          ${latestPdf}
        </div>
      </div>`;

    const restHtml = rest.length > 0
      ? `<h3 class="kh-backnumber-title">バックナンバー</h3>
         <div class="kh-grid">${rest.map(buildKouhouCard).join('')}</div>`
      : '';

    container.innerHTML = latestHtml + restHtml;

  } catch (err) {
    console.error(err);
    showError(container);
  }
}

document.addEventListener('DOMContentLoaded', initKouhou);
