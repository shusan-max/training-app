// 「今日」画面(ホーム)
import { placeholderCard, formatDateJa, formatFullDateJa, daysSince, daysUntil } from '../ui.js';

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

export default {
  title: '今日',
  render(container, { settings }) {
    container.innerHTML = `
      <p class="date-label">${formatDateJa(new Date())}</p>
      ${backupReminder(settings)}
      ${goalCard(settings.goal)}
      ${placeholderCard('今日のメニュー', '⑦', [
        '重い日/量の日/軽め/MAX挑戦の提案',
        'ウォームアップと本番セット',
        '「トレーニングを始める」ボタン',
      ])}
      ${placeholderCard('体の記録', '④', [
        '体重・睡眠・疲労度などを入力',
      ])}
      ${placeholderCard('継続と積み重ね', '⑧', [
        'カレンダー、累計、連続週数',
      ])}
    `;
  },
};
