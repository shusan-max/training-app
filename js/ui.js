// 画面づくりで何度も使う部品をまとめたファイル。

// 日付を「10月17日(土)」の形にする
export function formatDateJa(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

// 日付を「2027年3月31日」の形にする(文字の日付 '2027-03-31' でも可)
export function formatFullDateJa(date) {
  const d = typeof date === 'string' ? parseDateString(date) : date;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

// 今日の日付を '2026-10-17' の形で返す
export function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// '2026-10-17' を日付に直す(その日の0時)
export function parseDateString(text) {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ある時点から今日まで何日たったか
export function daysSince(isoText) {
  return Math.floor((Date.now() - new Date(isoText).getTime()) / DAY_MS);
}

// 今日からある日付まで、あと何日か
export function daysUntil(dateText) {
  const today = parseDateString(todayString());
  return Math.round((parseDateString(dateText) - today) / DAY_MS);
}

// 画面の下に短いお知らせを出す
export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}

// 重さを「72.5」「70」のように、余計な0をつけずに書く
export function formatKg(value) {
  return String(Number(value.toFixed(2)));
}

// ホーム画面のアイコンから開いているか(アプリとして使っているか)
export function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// 挙げた重さの合計を「12.3トン」「850kg」の形にする
export function formatVolume(kg) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}トン` : `${Math.round(kg)}kg`;
}

// 入力欄の文字を数字に直す。空なら null、数字でなければ NaN
export function parseNumber(text) {
  const trimmed = String(text).trim();
  return trimmed === '' ? null : Number(trimmed);
}
