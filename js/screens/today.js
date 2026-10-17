// 「今日」画面(ホーム)
import {
  formatDateJa, formatFullDateJa, daysSince, daysUntil, todayString,
  formatKg, parseDateString, isInstalledApp,
} from '../ui.js';
import { getAllBodyLogs, summarizeBodyLog } from '../body-data.js';
import { summarizeHistory } from '../logic/streaks.js';
import {
  getAllWorkouts, getAllSets, getAllPlans, startPlannedWorkout,
} from '../workout-data.js';
import { benchSessions, benchProgress } from '../logic/progress.js';
import { planToday, describeSteps, DAY_TYPES, SELECTABLE_TYPES } from '../logic/planner.js';
import { getExercise } from '../data/exercises.js';

const BACKUP_REMIND_DAYS = 7;

// 「種類を変える」で選んだもの(その日だけ有効)
let chosen = { date: null, type: null };

// 最後のバックアップから7日以上たっていたらお知らせを出す
function backupReminder(settings) {
  const last = settings.backup.lastBackupAt;
  const days = daysSince(last ?? settings.createdAt);
  if (days < BACKUP_REMIND_DAYS) return '';
  const message = last
    ? `最後のバックアップから${days}日たちました。`
    : 'まだ一度もバックアップしていません。';
  return `
    <section class="card notice">
      <h2>バックアップをおすすめします</h2>
      <p>${message}アプリを消すとデータも一緒に消えるので、時々「ファイル」アプリに保存しておきましょう。</p>
      <a class="btn" href="#settings">設定でバックアップする</a>
    </section>
  `;
}

function goalCard(goal, progress) {
  const daysLeft = daysUntil(goal.date);
  const remainingDays = daysLeft >= 0 ? `あと${daysLeft}日` : '目標日を過ぎました';
  let status = '';
  if (progress.bestActual != null) {
    status = progress.remaining > 0
      ? `実際の最高 ${formatKg(progress.bestActual)}kg ・ あと${formatKg(progress.remaining)}kg`
      : '目標達成!おめでとうございます';
  }
  return `
    <a class="card goal-card" href="#progress">
      <p class="sub">目標</p>
      <p class="goal-main">ベンチプレス <strong>${formatKg(goal.weight)}kg</strong></p>
      ${status ? `<p class="goal-status">${status}</p>` : ''}
      <p class="sub">${formatFullDateJa(goal.date)}まで ${remainingDays}</p>
    </a>
  `;
}

// 今日すでに始めた・終えたトレーニングがあるときのカード
function workoutCard(todays, sets) {
  const open = todays.find((w) => !w.finishedAt);
  if (open) {
    return `
      <section class="card">
        <h2>トレーニング</h2>
        <p class="sub">${open.type ? `${DAY_TYPES[open.type]}のメニューで、` : ''}途中のトレーニングがあります</p>
        <a class="btn" href="#workout/${open.id}">続ける</a>
      </section>
    `;
  }
  const done = todays[todays.length - 1];
  const workSets = sets.filter((s) => s.workoutId === done.id && !s.isWarmup).length;
  return `
    <section class="card">
      <h2>トレーニング</h2>
      <p>今日は記録済みです(${workSets}セット)。おつかれさまでした!</p>
      <a class="btn btn-secondary" href="#workout/${done.id}">記録を見る</a>
      <a class="btn btn-ghost" href="#workout">もう一度始める</a>
    </section>
  `;
}

// ===== 今日のメニュー =====
function weightText(weight, exercise) {
  if (weight == null) return '重さは自分で';
  if (exercise.equipment === 'bodyweight') return weight > 0 ? `自重+${formatKg(weight)}kg` : '自重';
  return `${formatKg(weight)}kg${exercise.equipment === 'dumbbell' ? '(1個)' : ''}`;
}

function benchLinesHtml(plan) {
  const steps = plan.steps.filter((s) => s.exerciseId === 'bench-press');
  const warm = steps.filter((s) => s.isWarmup).map((s) => `${formatKg(s.weight)}×${s.reps}`).join(' → ');
  const work = describeSteps(steps.filter((s) => !s.isWarmup)).map((g) => `
    <p class="menu-line"><span class="menu-tag">${g.label}</span>${formatKg(g.weight)}kg × ${g.reps}回${g.count > 1 ? ` × ${g.count}セット` : ''}</p>
  `).join('');
  return `
    <div class="menu-block">
      <h3>ベンチプレス</h3>
      ${warm ? `<p class="menu-line"><span class="menu-tag warm">W</span>${warm}</p>` : ''}
      ${work}
    </div>
  `;
}

function menuCardHtml(plan, isChosen) {
  const reasons = plan.reasons.map((r) => `<li>${r}</li>`).join('');
  const accessories = plan.accessories.map((a) => {
    const exercise = getExercise(a.exerciseId);
    return `
      <li>
        <span class="acc-name">${exercise.name}</span>
        <span class="acc-target">${weightText(a.weight, exercise)} × ${a.repsMin}〜${a.repsMax}回 × ${a.sets}セット</span>
        <span class="acc-note">${a.note}</span>
      </li>
    `;
  }).join('');
  const notes = plan.notes.map((n) => `<p class="sub menu-note">${n}</p>`).join('');
  const chips = SELECTABLE_TYPES.map((type) => `
    <button type="button" class="chip" data-type="${type}" aria-pressed="${plan.type === type}">${DAY_TYPES[type]}</button>
  `).join('');

  return `
    <section class="card menu-card">
      <div class="menu-head">
        <h2>今日のメニュー</h2>
        <span class="type-badge type-${plan.type}">${plan.typeLabel}</span>
      </div>
      <ul class="reasons">${reasons}</ul>
      ${plan.safety ? '<p class="safety">⚠️ 重い重量の日です。セーフティバーを設定するか、補助者についてもらいましょう。</p>' : ''}
      ${plan.bench ? benchLinesHtml(plan) : ''}
      ${accessories ? `<div class="menu-block"><h3>補助種目</h3><ul class="acc-list">${accessories}</ul></div>` : ''}
      ${notes}
      <div class="type-switch">
        <span class="field-label">種類を変える${isChosen ? '(もう一度押すと元に戻ります)' : ''}</span>
        <div class="chips">${chips}</div>
      </div>
      <div class="button-stack">
        <button type="button" class="btn" data-action="start-plan">このメニューで始める</button>
        <a class="btn btn-ghost" href="#workout">メニューを使わずに始める</a>
      </div>
    </section>
  `;
}

function bodyLogCard(log) {
  if (!log) {
    return `
      <section class="card">
        <h2>体の記録</h2>
        <p class="sub">今日はまだ記録していません。先につけると、メニューを体調に合わせます</p>
        <a class="btn" href="#body">体の記録をつける</a>
      </section>
    `;
  }
  const items = summarizeBodyLog(log).map((text) => `<li>${text}</li>`).join('');
  return `
    <section class="card">
      <h2>体の記録</h2>
      <ul class="tag-list">${items}</ul>
      <a class="btn btn-secondary" href="#body">直す</a>
    </section>
  `;
}

// 継続と積み重ね(くわしくは「記録」画面)
function streakCard(summary) {
  const recentPr = [...summary.timeline].reverse().find((t) => t.kind === 'pr');
  return `
    <a class="card streak-card" href="#history">
      <h2>継続と積み重ね</h2>
      <div class="streak-grid">
        <div><span class="big">${summary.weekStreak}</span><span class="unit">週連続</span><span class="cap">週1回以上</span></div>
        <div><span class="big">${summary.totalSessions}</span><span class="unit">回</span><span class="cap">累計トレーニング</span></div>
        <div><span class="big">${summary.bodyStreak}</span><span class="unit">日連続</span><span class="cap">体の記録</span></div>
      </div>
      <p class="sub">今週 ${summary.thisWeekCount}回${recentPr ? ` ・ 最新の自己ベスト:${recentPr.text.replace(' を初めて挙げた', '')}(${formatDateJa(parseDateString(recentPr.date))})` : ''}</p>
    </a>
  `;
}

export default {
  title: '今日',
  async render(container, { settings, refresh }) {
    const todayText = todayString();
    const today = parseDateString(todayText);
    const [bodyLogs, workouts, sets, plans] = await Promise.all([
      getAllBodyLogs(), getAllWorkouts(), getAllSets(), getAllPlans(),
    ]);
    const todayLog = bodyLogs.find((l) => l.date === todayText);
    const summary = summarizeHistory({
      workouts, sets, bodyLogs, baseline: settings.benchBaseline, today,
    });
    const progress = benchProgress(
      benchSessions(sets.filter((s) => s.exerciseId === 'bench-press'), settings.benchBaseline),
      settings.goal,
      today,
    );

    if (chosen.date !== todayText) chosen = { date: todayText, type: null };

    const todays = workouts.filter((w) => w.date === todayText);
    let plan = null;
    let trainingHtml;
    if (todays.length) {
      trainingHtml = workoutCard(todays, sets);
    } else {
      plan = planToday({
        settings, today, bodyLog: todayLog ?? null, workouts, sets, plans, forceType: chosen.type,
      });
      trainingHtml = menuCardHtml(plan, chosen.type != null);
    }

    // 体の記録がまだなら、メニューより先に出す(疲労度などでメニューが変わるため)
    container.innerHTML = `
      <p class="date-label">${formatDateJa(new Date())}</p>
      ${!isInstalledApp() && navigator.maxTouchPoints > 0 ? `
        <a class="card install-hint" href="#settings">
          📲 ホーム画面に追加すると、アプリとして使えます。手順は「設定」に ›
        </a>
      ` : ''}
      ${backupReminder(settings)}
      ${goalCard(settings.goal, progress)}
      ${todayLog ? '' : bodyLogCard(null)}
      ${trainingHtml}
      ${todayLog ? bodyLogCard(todayLog) : ''}
      ${streakCard(summary)}
    `;

    const menuCard = container.querySelector('.menu-card');
    if (!menuCard) return;

    // 種類を変える(同じものをもう一度押すと、おすすめに戻る)
    menuCard.querySelector('.type-switch').addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      const type = chip.dataset.type;
      chosen.type = chosen.type === type ? null : type;
      refresh();
    });

    menuCard.querySelector('[data-action="start-plan"]').addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      const workout = await startPlannedWorkout(plan, todayText);
      chosen.type = null;
      location.hash = `#workout/${workout.id}`;
    });
  },
};
