// 「進捗」画面
import { placeholderCard } from '../ui.js';

export default {
  title: '進捗',
  render(container) {
    container.innerHTML = `
      ${placeholderCard('ベンチプレス80kgへの進捗', '⑥', [
        '推定MAXと実際の最高重量のグラフ',
        '80kgまでの残りと達成率',
        '3月31日に間に合いそうかの判定',
        '体重の何倍を挙げたか',
      ])}
      ${placeholderCard('体の変化', '④', [
        '体重・体脂肪率のグラフ',
      ])}
    `;
  },
};
