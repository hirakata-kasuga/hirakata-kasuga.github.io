/**
 * post.js — 部会向け投稿ページ（ログイン不要）
 * URL: post.html            （部会を選んで投稿）
 *      post.html?org=老人会 （部会を事前選択。部会ごとの配布用リンク・QRコードに使う）
 *
 * 送信先は config.js の SITE_CONFIG.POST_ENDPOINT（Apps Script の Web アプリURL）。
 * 合言葉の照合は Apps Script 側で行う（このファイルには合言葉を置かない）。
 */

const ORG_GROUPS = [
  { label: '自治会', orgs: [
    '茄子作自治会', '春日丘自治会', '香楽自治会', '松下茄子作自治会', '茄子作広野自治会',
    '茄子作住宅自治会', '高田２丁目自治会', '京阪ひろ野自治会', '高田府住自治会',
    '香里ハイツ自治会', '南茄子作自治会',
  ]},
  { label: '各種団体', orgs: [
    '自主防災会', '福祉委員会', '体育振興会', '青少年を守る会・青少年育成指導員',
    'スポーツ推進委員', '防犯協議会春日支部', '交通対策協議会春日支部', '日赤奉仕団連合分団',
    '日赤婦人部', '民生委員・児童委員・主任児童委員', '老人会', '子ども会', '春日小学校PTA',
  ]},
];

const MAX_PDF_BYTES   = 8 * 1024 * 1024;
const MAX_FILES       = 10;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // 送信データ(base64前)の合計上限
const IMG_MAX_EDGE    = 2400;             // 紙の資料の文字が読める大きさ

(() => {
  const form    = document.getElementById('postForm');
  const orgSel  = document.getElementById('fOrg');
  const fileEl  = document.getElementById('fFile');
  const previews = document.getElementById('filePreviews');
  const msgEl   = document.getElementById('postMsg');
  const btn     = document.getElementById('postSubmit');
  if (!form) return;

  // ── 部会プルダウン ──
  orgSel.innerHTML = '<option value="">選んでください</option>' + ORG_GROUPS.map(g =>
    `<optgroup label="${esc2(g.label)}">${g.orgs.map(o => `<option value="${esc2(o)}">${esc2(o)}</option>`).join('')}</optgroup>`
  ).join('');
  const pre = new URLSearchParams(location.search).get('org');
  if (pre) orgSel.value = pre;

  function esc2(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showError(text) {
    msgEl.textContent = text;
    msgEl.className = 'post-msg error';
  }

  // ── ファイル選択時のプレビュー ──
  fileEl.addEventListener('change', () => {
    previews.innerHTML = '';
    const files = Array.from(fileEl.files);
    if (files.length > MAX_FILES) {
      showError(`ファイルは${MAX_FILES}個までです。選び直してください。`);
      fileEl.value = '';
      return;
    }
    msgEl.className = 'post-msg';
    files.forEach(f => {
      if (f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'pv';
        img.alt = f.name;
        img.src = URL.createObjectURL(f);
        previews.appendChild(img);
      } else {
        const d = document.createElement('div');
        d.className = 'pv pv-pdf';
        d.textContent = 'PDF';
        previews.appendChild(d);
      }
    });
  });

  /** 画像を長辺 IMG_MAX_EDGE px の JPEG に縮小して base64 を返す */
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, IMG_MAX_EDGE / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ mime: 'image/jpeg', ext: 'jpg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`「${file.name}」を読み込めませんでした。iPhoneの場合は、写真アプリから選び直すか、スクリーンショットにしてお試しください。`));
      };
      img.src = url;
    });
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve({ mime: file.type, ext: 'pdf', data: String(r.result).split(',')[1] });
      r.onerror = () => reject(new Error('ファイルを読み込めませんでした。'));
      r.readAsDataURL(file);
    });
  }

  async function buildFiles() {
    const files = Array.from(fileEl.files);
    if (files.length > MAX_FILES) throw new Error(`ファイルは${MAX_FILES}個までです。`);
    let total = 0;
    const out = [];
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        out.push({ name: f.name, ...(await shrinkImage(f)) });
      } else if (f.type === 'application/pdf') {
        if (f.size > MAX_PDF_BYTES) throw new Error(`「${f.name}」が大きすぎます（PDFは8MBまで）。`);
        out.push({ name: f.name, ...(await readBase64(f)) });
      } else {
        throw new Error(`「${f.name}」は送れません。写真かPDFを選んでください。`);
      }
      total += out[out.length - 1].data.length * 0.75;
    }
    if (total > MAX_TOTAL_BYTES) throw new Error('ファイルの合計が大きすぎます。数回に分けて送ってください。');
    return out;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgEl.className = 'post-msg';

    const endpoint = window.SITE_CONFIG?.POST_ENDPOINT;
    if (!endpoint) { showError('投稿の設定がまだ完了していません。事務局にご連絡ください。'); return; }

    const org   = orgSel.value;
    const pass  = document.getElementById('fPass').value;
    const title = document.getElementById('fTitle').value.trim();
    if (!org)   { showError('部会・自治会名を選んでください。'); return; }
    if (!pass)  { showError('合言葉を入力してください。'); return; }
    if (!title) { showError('タイトルを入力してください。'); return; }

    btn.disabled = true;
    btn.textContent = '送信中...（そのままお待ちください）';
    try {
      const payload = {
        org, pass, title,
        category: document.getElementById('fCat').value,
        body:     document.getElementById('fBody').value.trim(),
        hp:       document.getElementById('fHp').value,
        files:    await buildFiles(),
      };
      // text/plain にするとブラウザの事前確認(preflight)が不要になり、Apps Script で受け取れる
      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '送信に失敗しました。');

      document.getElementById('postCard').innerHTML = `
        <div class="post-done">
          <div class="icon">✅</div>
          <p style="font-size:1.1rem;font-weight:700;color:var(--primary-dark);">送信しました</p>
          <p style="color:var(--text-light);margin-top:8px;">事務局が内容を確認してから、サイトに掲載されます。</p>
          <p style="margin-top:24px;"><a href="${location.pathname}${location.search}" class="btn btn-primary">続けて投稿する</a></p>
        </div>`;
    } catch (err) {
      console.error('post error:', err);
      showError(err.message || '送信に失敗しました。時間をおいてもう一度お試しください。');
      btn.disabled = false;
      btn.textContent = '送信する';
    }
  });
})();
