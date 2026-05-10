document.addEventListener('DOMContentLoaded', function () {

  // ── モバイルナビ開閉 ──
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
    });

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.classList.remove('open');
      });
    });

    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !nav.contains(e.target)) {
        nav.classList.remove('open');
        toggle.classList.remove('open');
      }
    });
  }

  // ── アクティブリンクのハイライト ──
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // ── お問い合わせフォーム送信処理 ──
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      btn.textContent = '送信中...';
      btn.disabled = true;

      // 実際の運用では Google フォーム等の URL に POST するか
      // mailto: リンクに書き換えてください
      setTimeout(() => {
        contactForm.innerHTML = `
          <div style="text-align:center; padding: 40px 0;">
            <div style="font-size:3rem; margin-bottom:16px;">✅</div>
            <p style="font-size:1.1rem; font-weight:700; color:var(--primary-dark);">送信が完了しました</p>
            <p style="color:var(--text-light); margin-top:8px;">内容を確認のうえ、折り返しご連絡いたします。</p>
          </div>`;
      }, 800);
    });
  }

});
