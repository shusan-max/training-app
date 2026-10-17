// 「種目」画面(種目の一覧)
import { CATEGORIES, EXERCISES } from '../data/exercises.js';
import { GUIDES } from '../data/exercise-guides.js';

export default {
  title: '種目',
  render(container) {
    const groups = CATEGORIES.map(([category, label]) => {
      const rows = EXERCISES.filter((e) => e.category === category).map((e) => `
        <a class="list-row" href="#exercise/${e.id}">
          <span class="list-main">
            <span class="list-date">${e.name}</span>
            <span class="list-summary">${GUIDES[e.id]?.muscles.join('・') ?? ''}</span>
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </a>
      `).join('');
      return `
        <section class="card">
          <h2>${label}</h2>
          ${rows}
        </section>
      `;
    }).join('');

    container.innerHTML = `
      <p class="sub" style="margin:0 0 12px">フォームや注意点を見たい種目を選んでください。</p>
      ${groups}
    `;
  },
};
