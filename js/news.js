/**
 * お知らせページ — Google スプレッドシート「お知らせ」シートから読み込む
 *
 * スプレッドシートの列構成（1行目は見出し）
 *   A: 公開日   例) 2026/05/10
 *   B: カテゴリ  行事 / 情報 / 配布物 / 重要
 *   C: タイトル
 *   D: 概要（一覧に表示される短い説明）
 *   E: 画像URL  GoogleドライブのURLをそのまま貼る（任意）
 *   F: PDF_URL  GoogleドライブのURLをそのまま貼る（任意）
 *   G: 公開     TRUE=公開、FALSE=下書き
 *
 * ⚠️ 個人の電話番号・住所・メールアドレスは入力しないでください。
 */

const CATEGORY_STYLE = {
  '行事':   { cls: 'tag-event',  label: '行事'   },
  '情報':   { cls: 'tag-info',   label: '情報'   },
  '配布物': { cls: 'tag-notice', label: '配布物' },
  '重要':   { cls: 'tag-urgent', label: '重要'   },
};

function buildNewsCard(item) {
  const cat     = CATEGORY_STYLE[item.category] ?? { cls: 'tag-info', label: item.category };
  const urgent  = item.category === '重要';

  const imgHtml = item.imageUrl
    ? `<div class="nc-img-wrap">
         <img src="${item.imageUrl}" alt="${esc(item.title)}"
              loading="lazy" onerror="this.parentElement.style.display='none'">
       </div>`
    : '';

  const pdfHtml = item.pdfUrl
    ? `<a href="${item.pdfUrl}" target="_blank" rel="noopener" class="nc-pdf-link">
         📄 添付ファイルを見る
       </a>`
    : '';

  return `
    <article class="nc-card ${urgent ? 'nc-urgent' : ''}" data-category="${esc(item.category)}">
      ${imgHtml}
      <div class="nc-body">
        <div class="nc-meta">
          <span class="nc-date">${esc(item.date)}</span>
          <span class="tag ${cat.cls}">${esc(cat.label)}</span>
        </div>
        <h3 class="nc-title">${esc(item.title)}</h3>
        <p class="nc-summary">${esc(item.summary)}</p>
        ${pdfHtml}
      </div>
    </article>`;
}

function renderNews(items, filter) {
  const container = document.getElementById('newsContainer');
  if (!container) return;

  const list = filter === 'all' ? items : items.filter(i => i.category === filter);

  if (list.length === 0) {
    showEmpty(container);
    return;
  }
  container.innerHTML = list.map(buildNewsCard).join('');
}

function setupFilter(items) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderNews(items, this.dataset.filter);
    });
  });
}

async function initNews() {
  const container = document.getElementById('newsContainer');
  if (!container) return;

  showLoading(container);

  try {
    const rows = await fetchSheet('お知らせ');

    if (rows === null) {
      showSetupMessage(container);
      return;
    }

    const items = rows
      .map(row => {
        const c = row.c ?? [];
        return {
          date:      parseDate(c[0]?.v).display,
          sortKey:   parseDate(c[0]?.v).sortKey,
          category:  cellStr(c[1]),
          title:     cellStr(c[2]),
          summary:   cellStr(c[3]),
          imageUrl:  driveImgUrl(cellStr(c[4])),
          pdfUrl:    drivePdfUrl(cellStr(c[5])),
          published: cellBool(c[6]),
        };
      })
      .filter(i => i.published && i.title)
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    if (items.length === 0) { showEmpty(container); return; }

    renderNews(items, 'all');
    setupFilter(items);

  } catch (err) {
    console.error(err);
    showError(container);
  }
}

document.addEventListener('DOMContentLoaded', initNews);
