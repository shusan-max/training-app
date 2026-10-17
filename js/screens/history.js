// 「記録」画面
import { placeholderCard } from '../ui.js';

export default {
  title: '記録',
  render(container) {
    container.innerHTML = `
      ${placeholderCard('トレーニングの記録', '⑤', [
        '過去の練習の一覧',
        'あとから修正・削除',
      ])}
      ${placeholderCard('体の記録', '④', [
        '過去の体重・睡眠・疲労度などの一覧',
      ])}
    `;
  },
};
