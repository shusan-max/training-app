// 種目の説明画面(#exercise/bench-press など)
import { getExercise } from '../data/exercises.js';
import { GUIDES } from '../data/exercise-guides.js';
import { getAllSets, formatSet, formatSetList } from '../workout-data.js';
import { bestEstimate } from '../logic/e1rm.js';
import { formatDateJa, parseDateString } from '../ui.js';

// あなたのこれまでの記録(前回と自己ベスト)
function myRecordHtml(exercise, sets) {
  const mine = sets.filter((s) => s.exerciseId === exercise.id && !s.isWarmup);
  if (mine.length === 0) return '<p class="sub">まだ記録がありません</p>';
  const lastDate = mine[mine.length - 1].date;
  const last = mine.filter((s) => s.date === lastDate);
  const heaviest = mine.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best));
  const rows = [
    `<div><dt>前回(${formatDateJa(parseDateString(lastDate))})</dt><dd>${formatSetList(last, exercise)}</dd></div>`,
  ];
  if (exercise.equipment !== 'bodyweight') {
    rows.push(`<div><dt>一番重い記録</dt><dd>${formatSet(heaviest, exercise)}</dd></div>`);
    const best = bestEstimate(mine);
    if (best) rows.push(`<div><dt>推定MAXの最高</dt><dd>${best.value.toFixed(1)}kg</dd></div>`);
  }
  return `<dl class="summary stacked">${rows.join('')}</dl>`;
}

export default {
  title: '種目の説明',
  tab: 'exercises',
  async render(container, { params }) {
    const exercise = getExercise(params[0]);
    const guide = GUIDES[exercise.id];
    const sets = await getAllSets();

    const sections = (guide?.sections ?? []).map((section) => `
      <section class="card guide-section">
        <h2>${section.title}</h2>
        <ul>${section.items.map((item) => `<li>${item}</li>`).join('')}</ul>
      </section>
    `).join('');

    container.innerHTML = `
      <button type="button" class="back-link link-button" data-action="back">‹ 戻る</button>
      <section class="card">
        <h2 class="guide-title">${exercise.name}</h2>
        ${guide ? `
          <p class="field-label">効く部位</p>
          <ul class="tag-list">${guide.muscles.map((m) => `<li>${m}</li>`).join('')}</ul>
        ` : ''}
      </section>
      ${sections}
      <section class="card">
        <h2>あなたの記録</h2>
        ${myRecordHtml(exercise, sets)}
      </section>
      <section class="card notice">
        <p>痛みが出たら中止してください。痛みが続くときは、医療機関に相談しましょう。</p>
      </section>
    `;

    // 前の画面(トレーニング中なら、トレーニング画面)に戻る
    container.querySelector('[data-action="back"]').addEventListener('click', () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.hash = '#exercises';
      }
    });
  },
};
