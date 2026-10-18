// 「種目」画面(種目の一覧)
import { CATEGORIES, allExercises, recordType, RECORD_TYPES } from '../data/exercises.js';
import { GUIDES } from '../data/exercise-guides.js';
import { openExerciseForm } from '../exercise-form.js';
import { escapeHtml } from '../ui.js';

let lastQuery = ''; // さがしていた文字を覚えておく

function rowHtml(exercise) {
  const muscles = GUIDES[exercise.id]?.muscles ?? exercise.muscles;
  const sub = muscles?.join('・') ?? RECORD_TYPES.find(([r]) => r === recordType(exercise))?.[1] ?? '';
  return `
    <a class="list-row" href="#exercise/${exercise.id}">
      <span class="list-main">
        <span class="list-date">${escapeHtml(exercise.name)}${exercise.custom ? '<span class="custom-tag">自作</span>' : ''}</span>
        <span class="list-summary">${sub}</span>
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    </a>
  `;
}

export default {
  title: '種目',
  render(container, { refresh }) {
    container.innerHTML = `
      <div class="list-tools">
        <input type="search" class="pick-search" placeholder="種目名でさがす" aria-label="種目名でさがす">
        <button type="button" class="btn" data-action="create">+ 自分で種目を作る</button>
      </div>
      <div class="exercise-groups"></div>
    `;

    const search = container.querySelector('.pick-search');
    search.value = lastQuery;

    function draw() {
      const q = search.value.trim();
      lastQuery = search.value;
      const groups = CATEGORIES.map(([category, label]) => {
        const items = allExercises().filter((e) => e.category === category && (!q || e.name.includes(q)));
        if (items.length === 0) return '';
        return `<section class="card"><h2>${label}</h2>${items.map(rowHtml).join('')}</section>`;
      }).join('');
      container.querySelector('.exercise-groups').innerHTML = groups
        || '<section class="card"><p class="sub">見つかりません。「+ 自分で種目を作る」から作れます。</p></section>';
    }

    search.addEventListener('input', draw);
    container.querySelector('[data-action="create"]').addEventListener('click', () => {
      openExerciseForm({ onSaved: () => refresh() });
    });
    draw();
  },
};
