// 「記録」画面
import { placeholderCard, formatDateJa, parseDateString } from '../ui.js';
import { getAllBodyLogs, summarizeBodyLog } from '../body-data.js';

const PAGE_SIZE = 30;

function bodyLogRow(log) {
  return `
    <a class="list-row" href="#body/${log.date}">
      <span class="list-main">
        <span class="list-date">${formatDateJa(parseDateString(log.date))}</span>
        <span class="list-summary">${summarizeBodyLog(log).join(' ・ ')}</span>
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    </a>
  `;
}

export default {
  title: '記録',
  async render(container) {
    const logs = (await getAllBodyLogs()).reverse(); // 新しい順
    let shown = PAGE_SIZE;

    container.innerHTML = `
      ${placeholderCard('トレーニングの記録', '⑤', [
        '過去の練習の一覧',
        'あとから修正・削除',
      ])}
      <section class="card">
        <h2>体の記録</h2>
        <div class="list"></div>
        <button type="button" class="btn btn-ghost" data-action="more" hidden>もっと見る</button>
        <a class="btn btn-secondary" href="#body">+ 記録を追加</a>
      </section>
    `;

    const list = container.querySelector('.list');
    const moreButton = container.querySelector('[data-action="more"]');

    function draw() {
      list.innerHTML = logs.length
        ? logs.slice(0, shown).map(bodyLogRow).join('')
        : '<p class="sub">まだ記録がありません</p>';
      moreButton.hidden = shown >= logs.length;
    }
    moreButton.addEventListener('click', () => {
      shown += PAGE_SIZE;
      draw();
    });
    draw();
  },
};
