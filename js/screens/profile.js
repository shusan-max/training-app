// 「目標と自分の情報」の編集画面(設定画面から開く)
import { applyProfileValues, saveSettings } from '../settings-data.js';
import { toast } from '../ui.js';
import { createProfileForm } from './profile-form.js';

export default {
  title: '目標と自分の情報',
  tab: 'settings', // 下のタブでは「設定」に印をつける
  render(container, { settings }) {
    container.innerHTML = `<a class="back-link" href="#settings">‹ 設定に戻る</a>`;
    const form = createProfileForm(settings, {
      submitLabel: '保存する',
      onSubmit: async (values) => {
        await saveSettings(applyProfileValues(settings, values));
        toast('保存しました');
        location.hash = '#settings';
      },
    });
    container.append(form);
  },
};
