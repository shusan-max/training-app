// 画面づくりで何度も使う部品をまとめたファイル。

// 「この部分は〇〇で作ります」というカードを作る(まだ作っていない機能の目印)
export function placeholderCard(title, step, items) {
  const list = items.map((item) => `<li>${item}</li>`).join('');
  return `
    <section class="card placeholder">
      <span class="badge">${step}で作ります</span>
      <h2>${title}</h2>
      <ul>${list}</ul>
    </section>
  `;
}

// 日付を「10月17日(土)」の形にする
export function formatDateJa(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}
