// 「今日」画面(ホーム)
import { placeholderCard, formatDateJa } from '../ui.js';

export default {
  title: '今日',
  render(container) {
    container.innerHTML = `
      <p class="date-label">${formatDateJa(new Date())}</p>
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
      ${placeholderCard('バックアップのお知らせ', '③', [
        '最後のバックアップから7日たったら表示',
      ])}
    `;
  },
};
