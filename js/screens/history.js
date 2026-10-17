// 「記録」画面
import { formatDateJa, parseDateString, todayString, formatVolume } from '../ui.js';
import { summarizeHistory } from '../logic/streaks.js';
import { createCalendar } from '../calendar.js';
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

const TIMELINE_SHOWN = 8;

function timelineRow(item) {
  const icon = { start: '🏁', pr: '🎉', milestone: '⭐' }[item.kind];
  return `
    <li>
      <span class="tl-date">${formatDateJa(parseDateString(item.date))}</span>
      <span class="tl-text">${icon} ${item.text}</span>
    </li>
  `;
}

function accumulationHtml(summary) {
  const timeline = [...summary.timeline].reverse(); // 新しい順
  return `
    <section class="card" data-section="accumulation">
      <h2>積み重ね</h2>
      <div class="stat-row three">
        <div class="stat"><span class="stat-label">トレーニング</span><span class="stat-value">${summary.totalSessions}<small>回</small></span></div>
        <div class="stat"><span class="stat-label">セット</span><span class="stat-value">${summary.totalSets}<small>セット</small></span></div>
        <div class="stat"><span class="stat-label">挙げた重さの合計</span><span class="stat-value">${formatVolume(summary.totalVolume)}</span></div>
      </div>
      <p class="streak-line">週1回以上 <strong>${summary.weekStreak}週連続</strong> ・ 週2回できた週 <strong>${summary.twiceWeeks}週</strong> ・ 体の記録 <strong>${summary.bodyStreak}日連続</strong></p>
      <div class="calendar"></div>
      <h3 class="timeline-title">自己ベストと記念日</h3>
      ${timeline.length ? `<ol class="timeline">${timeline.slice(0, TIMELINE_SHOWN).map(timelineRow).join('')}</ol>` : '<p class="sub">記録をつけると、ここに残っていきます</p>'}
      ${timeline.length > TIMELINE_SHOWN ? '<button type="button" class="btn btn-ghost" data-action="all-timeline">すべて見る</button>' : ''}
    </section>
  `;
}

export default {
  title: '記録',
  async render(container, { settings }) {
    const [logs, workouts, allSets] = await Promise.all([getAllBodyLogs(), getAllWorkouts(), getAllSets()]);
    const today = parseDateString(todayString());
    const summary = summarizeHistory({
      workouts, sets: allSets, bodyLogs: logs, baseline: settings.benchBaseline, today,
    });

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
      ${accumulationHtml(summary)}
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

    createCalendar(container.querySelector('.calendar'), { days: summary.days, today });

    container.querySelector('[data-action="all-timeline"]')?.addEventListener('click', (event) => {
      const all = [...summary.timeline].reverse().map(timelineRow).join('');
      container.querySelector('.timeline').innerHTML = all;
      event.currentTarget.remove();
    });

    pagedList(container.querySelector('[data-list="workouts"]'), workoutRows, 'まだ記録がありません');
    pagedList(container.querySelector('[data-list="body"]'), bodyRows, 'まだ記録がありません');
  },
};
