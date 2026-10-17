// 「今日」画面(ホーム)
import {
  placeholderCard, formatDateJa, formatFullDateJa, daysSince, daysUntil, todayString,
} from '../ui.js';
import { getBodyLog, summarizeBodyLog } from '../body-data.js';
import { getAllWorkouts, getSetsForWorkout } from '../workout-data.js';

const BACKUP_REMIND_DAYS = 7;

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

function goalCard(goal) {
  const daysLeft = daysUntil(goal.date);
  const remaining = daysLeft >= 0 ? `あと${daysLeft}日` : '目標日を過ぎました';
  return `
    <section class="card goal-card">
      <p class="sub">目標</p>
      <p class="goal-main">ベンチプレス <strong>${goal.weight}kg</strong></p>
      <p class="sub">${formatFullDateJa(goal.date)}まで ${remaining}</p>
    </section>
  `;
}

// 今日のトレーニング:途中なら「続ける」、終わっていれば「記録を見る」、まだなら「始める」
async function workoutCard() {
  const todays = (await getAllWorkouts()).filter((w) => w.date === todayString());
  const open = todays.find((w) => !w.finishedAt);
  if (open) {
    return `
      <section class="card">
        <h2>トレーニング</h2>
        <p class="sub">途中のトレーニングがあります</p>
        <a class="btn" href="#workout/${open.id}">続ける</a>
      </section>
    `;
  }
  const done = todays[todays.length - 1];
  if (done) {
    const sets = await getSetsForWorkout(done.id);
    const workSets = sets.filter((s) => !s.isWarmup).length;
    return `
      <section class="card">
        <h2>トレーニング</h2>
        <p>今日は記録済みです(${workSets}セット)</p>
        <a class="btn btn-secondary" href="#workout/${done.id}">記録を見る</a>
        <a class="btn btn-ghost" href="#workout">もう一度始める</a>
      </section>
    `;
  }
  return `
    <section class="card">
      <h2>トレーニング</h2>
      <a class="btn" href="#workout">トレーニングを始める</a>
    </section>
  `;
}

function bodyLogCard(log) {
  if (!log) {
    return `
      <section class="card">
        <h2>体の記録</h2>
        <p class="sub">今日はまだ記録していません</p>
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

export default {
  title: '今日',
  async render(container, { settings }) {
    const [todayLog, trainingHtml] = await Promise.all([getBodyLog(todayString()), workoutCard()]);
    container.innerHTML = `
      <p class="date-label">${formatDateJa(new Date())}</p>
      ${backupReminder(settings)}
      ${goalCard(settings.goal)}
      ${trainingHtml}
      ${bodyLogCard(todayLog)}
      ${placeholderCard('今日のメニュー', '⑦', [
        '重い日/量の日/軽め/MAX挑戦の提案',
        'ウォームアップと本番セット',
      ])}
      ${placeholderCard('継続と積み重ね', '⑧', [
        'カレンダー、累計、連続週数',
      ])}
    `;
  },
};
