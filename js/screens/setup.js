// 初回設定の画面(設定がまだ無いときだけ出る)
import { defaultSettings, applyProfileValues, saveSettings } from '../settings-data.js';
import { requestPersistentStorage } from '../db.js';
import { createProfileForm } from './profile-form.js';

export default {
  title: 'はじめに',
  render(container, { refresh }) {
    container.innerHTML = `
      <section class="card intro">
        <p>目標と今の状態を入力してください。あとから「設定」でいつでも変えられます。</p>
      </section>
    `;
    const form = createProfileForm(defaultSettings(), {
      submitLabel: 'はじめる',
      onSubmit: async (values) => {
        await saveSettings(applyProfileValues(defaultSettings(), values));
        await requestPersistentStorage();
        history.replaceState(null, '', '#today');
        await refresh();
      },
    });
    container.append(form);
  },
};
