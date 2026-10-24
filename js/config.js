/**
 * ▼ サイト全体の設定
 *
 * Google スプレッドシートを1つ作成し、以下の3つのシートタブを用意してください。
 *   タブ名「お知らせ」  → お知らせページに表示
 *   タブ名「配布物」    → 配布物ページに表示
 *   タブ名「広報誌」    → 広報誌ページに表示
 *
 * スプレッドシートのIDはURLの以下の部分です：
 *   https://docs.google.com/spreadsheets/d/【ここ】/edit
 *
 * 設定後、スプレッドシートの共有設定を
 * 「リンクを知っている全員が閲覧可」にしてください。
 *
 * ⚠️ このスプレッドシートはインターネット上に公開されます。
 *    個人の電話番号・住所・メールアドレスは絶対に入力しないでください。
 */
const SITE_CONFIG = {
  SPREADSHEET_ID: '1vCOsZNghw_of0muLrmfdkKL4bPEGEmAHleddrwSEsz4',

  // 部会向け投稿ページ(post.html)の送信先。Apps Script をデプロイして発行された
  // 「ウェブアプリ」のURL（https://script.google.com/macros/s/…/exec）を貼る。
  // 設定手順は事務局で別途保管。空のままだと投稿ページは「設定未完了」と表示する。
  POST_ENDPOINT: '',
};
window.SITE_CONFIG = SITE_CONFIG;
