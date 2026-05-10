/**
 * 配布物ページ — Google スプレッドシート「配布物」シートから読み込む
 *
 * スプレッドシートの列構成（1行目は見出し）
 *   A: 年月    例) 2026/05  ← 必ず YYYY/MM 形式で入力
 *   B: 種別    回覧板 / 市配布 / その他
 *   C: タイトル 例) 5月回覧①　行事のご案内
 *   D: 説明    （任意）ファイルの簡単な説明
 *   E: PDF_URL GoogleドライブのURLをそのまま貼る
 *   F: 公開    TRUE=公開、FALSE=下書き
 *
 * ⚠️ 個人の電話番号・住所は入力しないでください。
 */

const SHUBETSU_STYLE = {
  '回覧板': { cls: 'tag-info',   label: '回覧板' },
  '市配布': { cls: 'tag-notice', label: '市配布' },
  'その他': { cls: 'tag-event',  label: 'その他' },
};

// URLパラメータ ?month=YYYY-MM を読む
function getMonthParam() {
  return new URLSearchParams(location.search).get('month') ?? null;
}

// 月別にグループ化して { "2026-05": [...], "2026-04": [...] } を返す
function groupByMonth(items) {
  const map = {};
  items.forEach(item => {
    if (!map[item.monthKey]) map[item.monthKey] = [];
    map[item.monthKey].push(item);
  });
  return map;
}

// 月一覧カードのHTML
function buildMonthCard(monthKey, items) {
  const [y, m]    = monthKey.split('-');
  const label     = `${y}年${m}月`;
  const countText = `${items.length}件`;

  // 種別ごとの件数バッジ
  const counts = {};
  items.forEach(i => { counts[i.shubetsu] = (counts[i.shubetsu] ?? 0) + 1; });
  const badges = Object.entries(counts)
    .map(([s, n]) => {
      const st = SHUBETSU_STYLE[s] ?? { cls: 'tag-info', label: s };
      return `<span class="tag ${st.cls}">${esc(st.label)} ${n}件</span>`;
    }).join('');

  return `
    <a href="haifubutsu.html?month=${monthKey}" class="month-card">
      <div class="month-card-header">
        <span class="month-label">${esc(label)}</span>
        <span class="month-count">${countText}</span>
      </div>
      <div class="month-badges">${badges}</div>
      <div class="month-arrow">一覧を見る →</div>
    </a>`;
}

// 年ごとにセクションを分けて月カードを並べる
function renderMonthList(grouped) {
  const container = document.getElementById('haifubutsuContainer');

  // sortKey降順で並べ直す
  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // 年ごとにグループ化
  const byYear = {};
  sortedKeys.forEach(key => {
    const year = key.split('-')[0];
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(key);
  });

  const html = Object.entries(byYear)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, keys]) => `
      <div class="year-section">
        <h3 class="year-heading">${esc(year)}年</h3>
        <div class="month-grid">
          ${keys.map(k => buildMonthCard(k, grouped[k])).join('')}
        </div>
      </div>`
    ).join('');

  container.innerHTML = html;
}

// 種別バッジ
function shubetsuTag(s) {
  const st = SHUBETSU_STYLE[s] ?? { cls: 'tag-info', label: s || 'その他' };
  return `<span class="tag ${st.cls}">${esc(st.label)}</span>`;
}

// 詳細ページ: 月内の配布物一覧
function renderDetail(monthKey, items) {
  const container  = document.getElementById('haifubutsuContainer');
  const pageHeader = document.getElementById('pageSubtitle');
  const [y, m]     = monthKey.split('-');
  const monthLabel = `${y}年${m}月`;

  if (pageHeader) pageHeader.textContent = `${monthLabel}の配布物`;

  // ページタイトル更新
  document.title = `${monthLabel}の配布物 | 配布物・回覧板 | 春日小学校区コミュニティ協議会`;

  // パンくずの「詳細」部分を追加
  const bc = document.getElementById('breadcrumbDetail');
  if (bc) bc.innerHTML = `<span>›</span><span>${esc(monthLabel)}</span>`;

  const rows = items.map(item => {
    const pdfBtn = item.pdfUrl
      ? `<a href="${item.pdfUrl}" target="_blank" rel="noopener" class="pdf-open-btn">開く ↗</a>`
      : `<span class="pdf-none">準備中</span>`;

    const desc = item.description
      ? `<div class="doc-desc">${esc(item.description)}</div>`
      : '';

    return `
      <li class="doc-item">
        <div class="doc-icon">📄</div>
        <div class="doc-info">
          <div class="doc-meta">${shubetsuTag(item.shubetsu)}</div>
          <div class="doc-title">${esc(item.title)}</div>
          ${desc}
        </div>
        <div class="doc-action">${pdfBtn}</div>
      </li>`;
  }).join('');

  container.innerHTML = `
    <a href="haifubutsu.html" class="back-btn">← 月別一覧に戻る</a>
    <div class="card detail-card">
      <div class="detail-month-head">
        <span class="detail-month-label">${esc(monthLabel)}</span>
        <span class="detail-count">${items.length}件</span>
      </div>
      <ul class="doc-list">${rows}</ul>
    </div>`;
}

async function initHaifubutsu() {
  const container = document.getElementById('haifubutsuContainer');
  if (!container) return;

  showLoading(container);

  try {
    const rows = await fetchSheet('配布物');

    if (rows === null) { showSetupMessage(container); return; }

    const items = rows
      .map(row => {
        const c        = row.c ?? [];
        const ymParsed = parseDate(cellStr(c[0]));
        return {
          monthKey:    ymParsed.sortKey,   // "2026-05"
          monthLabel:  ymParsed.display,   // "2026年05月"
          shubetsu:    cellStr(c[1]) || 'その他',
          title:       cellStr(c[2]),
          description: cellStr(c[3]),
          pdfUrl:      drivePdfUrl(cellStr(c[4])),
          published:   cellBool(c[5]),
        };
      })
      .filter(i => i.published && i.title && i.monthKey);

    if (items.length === 0) { showEmpty(container); return; }

    const monthParam = getMonthParam();

    if (monthParam) {
      // 詳細ビュー: 指定月のアイテムだけ表示
      const detail = items.filter(i => i.monthKey === monthParam);
      if (detail.length === 0) {
        showEmpty(container);
      } else {
        renderDetail(monthParam, detail);
      }
    } else {
      // 月一覧ビュー
      renderMonthList(groupByMonth(items));
    }

  } catch (err) {
    console.error(err);
    showError(container);
  }
}

document.addEventListener('DOMContentLoaded', initHaifubutsu);
