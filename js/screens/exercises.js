// 「種目」画面
import { placeholderCard } from '../ui.js';

export default {
  title: '種目',
  render(container) {
    container.innerHTML = `
      ${placeholderCard('種目の説明', '⑧', [
        '正しいフォーム、効く部位、よくある間違い、注意点',
        'ベンチプレスは特に詳しく',
      ])}
    `;
  },
};
