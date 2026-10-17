// 「記録」画面
import { formatDateJa, parseDateString } from '../ui.js';
import { getAllBodyLogs, summarizeBodyLog } from '../body-data.js';
import { getAllWorkouts, getAllSets } from '../workout-data.js';
import { getExercise } from '../data/exercises.js';
import { bestEstimate } from '../logic/e1rm.js';

const PAGE_SIZE = 30;

function listRow(href, date, summary) {
  return `
    <a class="list-row" href="${href}">
      <span class="list-main">
        <span class="list-date">${formatDateJa(parseDateString(date))}</span>
        <span class="list-summary">${summary}</span>
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    </a>
  `;
}

function workoutSummary(workout, sets) {
  const names = workout.exerciseIds
    .filter((id) => sets.some((s) => s.exerciseId === id))
    .map((id) => getExercise(id).name);
  const parts = [names.join('・'), `${sets.filter((s) => !s.isWarmup).length}セット`];
  const bench = bestEstimate(sets.filter((s) => s.exerciseId === 'bench-press'));
  if (bench) parts.push(`ベンチ推定MAX ${bench.value.toFixed(1)}kg`);
  if (!workout.finishedAt) parts.push('途中');
  return parts.join(' ・ ');
}

// 「もっと見る」つきの一覧を作る
function pagedList(section, rows, emptyText) {
  const list = section.querySelector('.list');
  const moreButton = section.querySelector('[data-action="more"]');
  let shown = PAGE_SIZE;
  function draw() {
    list.innerHTML = rows.length ? rows.slice(0, shown).join('') : `<p class="sub">${emptyText}</p>`;
    moreButton.hidden = shown >= rows.length;
  }
  moreButton.addEventListener('click', () => {
    shown += PAGE_SIZE;
    draw();
  });
  draw();
}

export default {
  title: '記録',
  async render(container) {
    const [logs, workouts, allSets] = await Promise.all([getAllBodyLogs(), getAllWorkouts(), getAllSets()]);

    // トレーニングごとにセットをまとめる(セットが1つも無いものは出さない)
    const setsByWorkout = new Map();
    for (const set of allSets) {
      if (!setsByWorkout.has(set.workoutId)) setsByWorkout.set(set.workoutId, []);
      setsByWorkout.get(set.workoutId).push(set);
    }
    const workoutRows = workouts
      .filter((w) => setsByWorkout.has(w.id))
      .reverse() // 新しい順
      .map((w) => listRow(`#workout/${w.id}`, w.date, workoutSummary(w, setsByWorkout.get(w.id))));

    const bodyRows = [...logs].reverse()
      .map((log) => listRow(`#body/${log.date}`, log.date, summarizeBodyLog(log).join(' ・ ')));

    container.innerHTML = `
      <section class="card" data-list="workouts">
        <h2>トレーニングの記録</h2>
        <div class="list"></div>
        <button type="button" class="btn btn-ghost" data-action="more" hidden>もっと見る</button>
      </section>
      <section class="card" data-list="body">
        <h2>体の記録</h2>
        <div class="list"></div>
        <button type="button" class="btn btn-ghost" data-action="more" hidden>もっと見る</button>
        <a class="btn btn-secondary" href="#body">+ 記録を追加</a>
      </section>
    `;

    pagedList(container.querySelector('[data-list="workouts"]'), workoutRows, 'まだ記録がありません');
    pagedList(container.querySelector('[data-list="body"]'), bodyRows, 'まだ記録がありません');
  },
};
