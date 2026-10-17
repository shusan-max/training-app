// 「設定」画面
import { placeholderCard } from '../ui.js';

export default {
  title: '設定',
  render(container) {
    container.innerHTML = `
      ${placeholderCard('目標と自分の情報', '③', [
        '目標重量・目標日、身長・体重などの編集',
      ])}
      ${placeholderCard('トレーニングの設定', '③', [
        '重量の刻み幅、休憩時間、軽めの週の間隔',
      ])}
      ${placeholderCard('バックアップ', '③', [
        'データの書き出し・読み込み',
      ])}
    `;
  },
};
