// 「今日」画面(ホーム)
// 上:ストライプのダッシュボード(連続週数・START)/中:時間と回数・今週の目標/下:今日のメニュー
import {
  formatDateJa, daysSince, daysUntil, todayString,
  formatKg, parseDateString, isInstalledApp, ICONS, escapeHtml,
} from '../ui.js';
import { videoUrlFor } from '../video.js';
import { getAllBodyLogs, summarizeBodyLog } from '../body-data.js';
import { summarizeHistory } from '../logic/streaks.js';
import {
  getAllWorkouts, getAllSets, getAllPlans, startPlannedWorkout,
} from '../workout-data.js';
import { saveSettings, weeklyGoalMinutes } from '../settings-data.js';
import { benchSessions, benchProgress } from '../logic/progress.js';
import { planToday, describeSteps, DAY_TYPES, SELECTABLE_TYPES } from '../logic/planner.js';
import { getExercise } from '../data/exercises.js';

const BACKUP_REMIND_DAYS = 7;

// 動画のリンクを作るときに使う、今の設定
let currentSettings = null;
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

// 「種類を変える」で選んだもの(その日だけ有効)
let chosen = { date: null, type: null };

// 「9:30」の形(時間:分)
function formatHM(minutes) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
// 「1時間30分」の形
function formatGoal(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h ? `${h}時間` : ''}${m ? `${m}分` : ''}`;
}

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

// ===== 上のストライプ部分 =====
function heroHtml(summary, startHtml) {
  const n = summary.weekStreak;
  const title = n > 0 ? `${n} WEEK${n > 1 ? 'S' : ''}<br>STREAK` : 'LET’S<br>START';
  return `
    <section class="hero">
      <div class="hero-top">
        <span class="hero-date">${formatDateJa(new Date())}</span>
        <a class="hero-icon" href="#settings" aria-label="設定">${ICONS.settings}</a>
      </div>
      <h2 class="hero-title display">${title}</h2>
      <p class="hero-sub">週1回以上 ・ 自己ベスト ${summary.bestWeekStreak}週</p>
      <div class="hero-actions">
        <a class="round-btn" href="#progress" aria-label="進捗を見る">${ICONS.chart}</a>
        ${startHtml}
        <a class="round-btn" href="#body" aria-label="体の記録">${ICONS.heart}</a>
      </div>
    </section>
  `;
}

// まん中の丸いボタン:まだなら START、途中なら RESUME、終わっていれば DONE
function startButtonHtml(todays, plan) {
  const open = todays.find((w) => !w.finishedAt);
  if (open) {
    return `<a class="start-btn" href="#workout/${open.id}"><span class="display">RESUME</span><small>続ける</small></a>`;
  }
  const done = todays[todays.length - 1];
  if (done) {
    return `<a class="start-btn done" href="#workout/${done.id}"><span class="display">DONE</span><small>記録を見る</small></a>`;
  }
  return `<button type="button" class="start-btn" data-action="start-plan"><span class="display">START</span><small>${plan.typeLabel}</small></button>`;
}

// ===== 時間・回数・今週の目標 =====
function statsHtml(summary) {
  return `
    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">総トレーニング時間</span>
        <span class="stat-value">${formatHM(summary.totalMinutes)}</span>
        <span class="sub">時間:分</span>
      </div>
      <div class="stat">
        <span class="stat-label">総トレーニング回数</span>
        <span class="stat-value">${summary.totalSessions}</span>
        <span class="sub">回</span>
      </div>
    </div>
  `;
}

function weekCardHtml(summary, goal) {
  const done = summary.thisWeekMinutes;
  const ratio = Math.min(1, done / goal);
  const circumference = 2 * Math.PI * 40;
  const achieved = done >= goal;
  const scaleMax = Math.max(30, goal / 2, ...summary.weekDayMinutes);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const bars = summary.weekDayMinutes.map((m) => {
    const height = m > 0 ? Math.max(8, Math.round((m / scaleMax) * 100)) : 0;
    return `<span class="bar"><span class="bar-fill" style="height:${height}%"></span></span>`;
  }).join('');
  const labels = WEEKDAYS.map((w, i) => `<span class="${i === todayIndex ? 'is-today' : ''}">${w}</span>`).join('');

  const options = [];
  for (let m = 30; m <= 600; m += 30) {
    options.push(`<option value="${m}"${m === goal ? ' selected' : ''}>${formatGoal(m)}</option>`);
  }

  return `
    <section class="card week-card">
      <div class="ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="40" class="ring-track"/>
          <circle cx="50" cy="50" r="40" class="ring-fill"
            stroke-dasharray="${circumference.toFixed(1)}"
            stroke-dashoffset="${(circumference * (1 - ratio)).toFixed(1)}"
            transform="rotate(-90 50 50)"/>
        </svg>
        <div class="ring-center">
          <span class="ring-label">今週</span>
          <span class="ring-value display">${formatHM(done)}</span>
          ${achieved ? '<span class="achieved">ACHIEVED</span>' : ''}
        </div>
      </div>
      <div class="week-side">
        <div class="week-goal">
          <span>今週の目標 <strong>${formatGoal(goal)}</strong></span>
          <label class="goal-change">変更
            <select data-action="weekly-goal" aria-label="今週の目標の時間">${options.join('')}</select>
          </label>
        </div>
        <div class="bars" role="img" aria-label="今週の曜日ごとのトレーニング時間">${bars}</div>
        <div class="bar-labels">${labels}</div>
      </div>
    </section>
  `;
}

// ===== ベンチプレスの目標 =====
function goalCard(goal, progress) {
  const daysLeft = daysUntil(goal.date);
  const remainingDays = daysLeft >= 0 ? `あと${daysLeft}日` : '目標日を過ぎました';
  let status = '';
  if (progress.bestActual != null) {
    status = progress.remaining > 0
      ? `実際の最高 ${formatKg(progress.bestActual)}kg ・ あと${formatKg(progress.remaining)}kg`
      : '目標達成!おめでとうございます';
  }
  const percent = Math.floor((progress.rate ?? 0) * 100);
  return `
    <a class="card goal-card" href="#progress">
      <div class="goal-row">
        <span class="goal-title display">BENCH ${formatKg(goal.weight)}KG</span>
        <span class="sub">${remainingDays}</span>
      </div>
      ${status ? `<p class="goal-status">${status}</p>` : ''}
      <div class="meter"><div class="meter-fill" style="width:${percent}%"></div></div>
    </a>
  `;
}

// ===== 今日のメニュー =====
function weightText(weight, exercise) {
  if (weight == null) return '重さは自分で';
  if (exercise.equipment === 'bodyweight') return weight > 0 ? `自重+${formatKg(weight)}kg` : '自重';
  return `${formatKg(weight)}kg${exercise.equipment === 'dumbbell' ? '(1個)' : ''}`;
}

function benchRowHtml(plan) {
  const steps = plan.steps.filter((s) => s.exerciseId === 'bench-press');
  const warm = steps.filter((s) => s.isWarmup).map((s) => `${formatKg(s.weight)}×${s.reps}`).join(' → ');
  const groups = describeSteps(steps.filter((s) => !s.isWarmup));
  const summary = plan.bench.attempts
    ? `${plan.bench.attempts.map((w) => formatKg(w)).join(' → ')}kg に挑戦`
    : `${formatKg(groups[0].weight)}kg × ${groups[0].reps}回 × ${groups[0].count}セット`;
  const lines = groups.map((g) => `
    <p class="menu-line"><span class="menu-tag">${g.label}</span>${formatKg(g.weight)}kg × ${g.reps}回${g.count > 1 ? ` × ${g.count}セット` : ''}</p>
  `).join('');
  return `
    <details class="menu-row">
      <summary>
        <span class="icon-circle">${ICONS.barbell}</span>
        <span class="row-main"><span class="row-name">ベンチプレス</span><span class="row-sub">${summary}</span></span>
        <span class="chev" aria-hidden="true">${ICONS.chevron}</span>
      </summary>
      <div class="row-detail">
        ${warm ? `<p class="menu-line"><span class="menu-tag warm">W</span>${warm}</p>` : ''}
        ${lines}
        <a class="row-link" href="#exercise/bench-press">フォームを見る ›</a>
        <a class="row-link" href="${escapeHtml(videoUrlFor(getExercise('bench-press'), currentSettings))}" target="_blank" rel="noopener">動画を見る ›</a>
      </div>
    </details>
  `;
}

function accessoryRowHtml(a) {
  const exercise = getExercise(a.exerciseId);
  return `
    <details class="menu-row">
      <summary>
        <span class="icon-circle">${ICONS.barbell}</span>
        <span class="row-main">
          <span class="row-name">${exercise.name}</span>
          <span class="row-sub">${weightText(a.weight, exercise)} × ${a.repsMin}〜${a.repsMax}回 × ${a.sets}セット</span>
        </span>
        <span class="chev" aria-hidden="true">${ICONS.chevron}</span>
      </summary>
      <div class="row-detail">
        <p class="sub">${a.note}</p>
        <a class="row-link" href="#exercise/${exercise.id}">フォームを見る ›</a>
        <a class="row-link" href="${escapeHtml(videoUrlFor(exercise, currentSettings))}" target="_blank" rel="noopener">動画を見る ›</a>
      </div>
    </details>
  `;
}

function menuCardHtml(plan, isChosen) {
  const reasons = plan.reasons.map((r) => `<li>${r}</li>`).join('');
  const notes = plan.notes.map((n) => `<p class="sub menu-note">${n}</p>`).join('');
  const chips = SELECTABLE_TYPES.map((type) => `
    <button type="button" class="chip" data-type="${type}" aria-pressed="${plan.type === type}">${DAY_TYPES[type]}</button>
  `).join('');

  return `
    <h2 class="section-title display">TODAY’S MENU</h2>
    <section class="card menu-card">
      <div class="menu-head">
        <span class="type-badge type-${plan.type}">${plan.typeLabel}</span>
      </div>
      <ul class="reasons">${reasons}</ul>
      ${plan.safety ? '<p class="safety">⚠️ 重い重量の日です。セーフティバーを設定するか、補助者についてもらいましょう。</p>' : ''}
      <div class="menu-rows">
        ${plan.bench ? benchRowHtml(plan) : ''}
        ${plan.accessories.map(accessoryRowHtml).join('')}
      </div>
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

// 今日のトレーニングが終わったあとのカード
function doneCardHtml(todays, sets, summary) {
  const done = todays[todays.length - 1];
  const workSets = sets.filter((s) => s.workoutId === done.id && !s.isWarmup).length;
  return `
    <h2 class="section-title display">TODAY</h2>
    <section class="card">
      <p><strong>今日は記録済みです(${workSets}セット)。おつかれさまでした!</strong></p>
      <p class="sub" style="margin-top:4px">今週 ${summary.thisWeekCount}回 ・ ${formatHM(summary.thisWeekMinutes)}</p>
      <a class="btn btn-secondary" href="#workout/${done.id}">記録を見る</a>
      <a class="btn btn-ghost" href="#workout">もう一度始める</a>
    </section>
  `;
}

function bodyLogCard(log) {
  if (!log) {
    return `
      <section class="card">
        <h2>体の記録</h2>
        <p class="sub">先につけると、メニューを体調に合わせます</p>
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

// 積み重ね(くわしくは「記録」画面)
function streakCard(summary) {
  const recentPr = [...summary.timeline].reverse().find((t) => t.kind === 'pr');
  return `
    <a class="card streak-card" href="#history">
      <h2>積み重ね</h2>
      <div class="streak-grid">
        <div><span class="big">${summary.bodyStreak}</span><span class="unit">日連続</span><span class="cap">体の記録</span></div>
        <div><span class="big">${summary.thisWeekCount}</span><span class="unit">回</span><span class="cap">今週の練習</span></div>
        <div><span class="big">${summary.totalSets}</span><span class="unit">セット</span><span class="cap">累計</span></div>
      </div>
      <p class="sub">${recentPr ? `最新の自己ベスト:${recentPr.text.replace(' を初めて挙げた', '')}(${formatDateJa(parseDateString(recentPr.date))}) ・ ` : ''}カレンダーを見る ›</p>
    </a>
  `;
}

export default {
  title: '今日',
  async render(container, { settings, refresh }) {
    currentSettings = settings;
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
    let menuHtml = '';
    if (todays.length === 0) {
      plan = planToday({
        settings, today, bodyLog: todayLog ?? null, workouts, sets, plans, forceType: chosen.type,
      });
      menuHtml = menuCardHtml(plan, chosen.type != null);
    } else if (todays.every((w) => w.finishedAt)) {
      menuHtml = doneCardHtml(todays, sets, summary);
    }

    // 体の記録がまだなら、メニューより先に出す(疲労度などでメニューが変わるため)
    container.innerHTML = `
      ${heroHtml(summary, startButtonHtml(todays, plan))}
      ${!isInstalledApp() && navigator.maxTouchPoints > 0 ? `
        <a class="card install-hint" href="#settings">
          📲 ホーム画面に追加すると、アプリとして使えます。手順は「設定」に ›
        </a>
      ` : ''}
      ${backupReminder(settings)}
      ${statsHtml(summary)}
      ${weekCardHtml(summary, weeklyGoalMinutes(settings))}
      ${goalCard(settings.goal, progress)}
      ${todayLog ? '' : bodyLogCard(null)}
      ${menuHtml}
      ${todayLog ? bodyLogCard(todayLog) : ''}
      ${streakCard(summary)}
    `;

    // 今週の目標を変える
    container.querySelector('[data-action="weekly-goal"]').addEventListener('change', async (event) => {
      settings.training = { ...settings.training, weeklyGoalMinutes: Number(event.target.value) };
      await saveSettings(settings);
      refresh();
    });

    // 種類を変える(同じものをもう一度押すと、おすすめに戻る)
    container.querySelector('.type-switch')?.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      const type = chip.dataset.type;
      chosen.type = chosen.type === type ? null : type;
      refresh();
    });

    // START・「このメニューで始める」
    container.querySelectorAll('[data-action="start-plan"]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        const workout = await startPlannedWorkout(plan, todayText);
        chosen.type = null;
        location.hash = `#workout/${workout.id}`;
      });
    });
  },
};
