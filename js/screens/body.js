// 体の記録の入力画面
// #body なら今日の記録、#body/2026-10-15 ならその日の記録を開く
import {
  PAIN_AREAS, FATIGUE_LABELS,
  getBodyLog, getAllBodyLogs, saveBodyLog, deleteBodyLog, latestValue,
} from '../body-data.js';
import { todayString, parseNumber, toast } from '../ui.js';
import { stepperHtml, bindSteppers } from '../stepper.js';

// ±ボタンで増減する項目
const STEPPERS = [
  { name: 'weightKg', label: '体重', unit: 'kg', step: 0.1, min: 20, max: 300 },
  { name: 'bodyFatPct', label: '体脂肪率', unit: '%', step: 0.1, min: 1, max: 70 },
  { name: 'sleepHours', label: '睡眠時間', unit: '時間', step: 0.5, min: 0, max: 24 },
];

function previousHint(value, unit) {
  return value != null ? `前回 ${Number(value.toFixed(1))}${unit}` : '';
}

export default {
  title: '体の記録',
  tab: 'today',
  async render(container, { settings, params }) {
    const fromList = Boolean(params[0]);
    const date = params[0] ?? todayString();
    const [existing, allLogs] = await Promise.all([getBodyLog(date), getAllBodyLogs()]);
    const log = existing ?? { date, painAreas: [] };

    // ±を初めて押したときに使う「前回の値」(その日より前の記録から探す)
    const earlier = allLogs.filter((l) => l.date < date);
    const previous = {
      weightKg: latestValue(earlier, 'weightKg') ?? settings.profile.bodyWeightKg,
      bodyFatPct: latestValue(earlier, 'bodyFatPct') ?? settings.profile.bodyFatPct,
      sleepHours: latestValue(earlier, 'sleepHours'),
    };
    const startValue = { ...previous, sleepHours: previous.sleepHours ?? 7 };

    const fatigueButtons = [1, 2, 3, 4, 5].map((n) => `
      <button type="button" role="radio" aria-checked="${log.fatigue === n}" data-value="${n}">
        <strong>${n}</strong><small>${FATIGUE_LABELS[n]}</small>
      </button>
    `).join('');

    const painChips = PAIN_AREAS.map(([key, label]) => `
      <button type="button" class="chip" aria-pressed="${log.painAreas.includes(key)}" data-value="${key}">${label}</button>
    `).join('');

    container.innerHTML = `
      <a class="back-link" href="${fromList ? '#history' : '#today'}">‹ ${fromList ? '記録' : '今日'}に戻る</a>
      <form class="form" novalidate>
        <section class="card">
          <label class="field" style="margin-top:0">
            <span class="field-label">日付</span>
            <input name="date" type="date" max="${todayString()}">
          </label>
          <p class="sub" style="margin-top:8px">どの項目も、入れたいものだけで大丈夫です。±を押すと前回の値から始まります。</p>
        </section>

        <section class="card">
          ${STEPPERS.map((s) => stepperHtml({ ...s, hint: previousHint(previous[s.name], s.unit) })).join('')}
        </section>

        <section class="card">
          <h2>疲労度</h2>
          <div class="segmented" role="radiogroup" aria-label="疲労度">${fatigueButtons}</div>
        </section>

        <section class="card">
          <h2>痛みのある部位</h2>
          <p class="sub">なければ何も選ばなくてOK。左右などはメモへ。</p>
          <div class="chips">${painChips}</div>
        </section>

        <section class="card">
          <label class="field" style="margin-top:0">
            <span class="field-label">メモ</span>
            <textarea name="memo" rows="3" placeholder="例:右肩に少し違和感"></textarea>
          </label>
        </section>

        <p class="form-error" role="alert" hidden></p>
        <div class="button-stack">
          <button type="submit" class="btn">保存する</button>
          ${existing ? '<button type="button" class="btn btn-danger" data-action="delete">この日の記録を消す</button>' : ''}
        </div>
      </form>
    `;

    const form = container.querySelector('form');
    const f = form.elements;
    f.date.value = date;
    f.weightKg.value = log.weightKg ?? '';
    f.bodyFatPct.value = log.bodyFatPct ?? '';
    f.sleepHours.value = log.sleepHours ?? '';
    f.memo.value = log.memo ?? '';

    // 日付を変えたら、その日の記録を開き直す
    f.date.addEventListener('change', () => {
      if (f.date.value) location.hash = `#body/${f.date.value}`;
    });

    // ±ボタン(空のときは、まず前回の値を入れる)
    bindSteppers(form, STEPPERS.map((s) => ({ ...s, start: startValue[s.name] })));

    // 疲労度:もう一度押すと選択を外す
    const fatigueGroup = form.querySelector('.segmented');
    fatigueGroup.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const wasChecked = button.getAttribute('aria-checked') === 'true';
      fatigueGroup.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', 'false'));
      if (!wasChecked) button.setAttribute('aria-checked', 'true');
    });

    // 痛む部位:押すたびに選ぶ/外す
    form.querySelector('.chips').addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    });

    const backTo = fromList ? '#history' : '#today';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorBox = form.querySelector('.form-error');
      const values = { date: f.date.value || date };

      for (const def of STEPPERS) {
        const value = parseNumber(f[def.name].value);
        if (value !== null && !(value >= def.min && value <= def.max)) {
          errorBox.textContent = `${def.label}は${def.min}〜${def.max}${def.unit}の範囲で入れてください。`;
          errorBox.hidden = false;
          return;
        }
        values[def.name] = value;
      }
      const checked = fatigueGroup.querySelector('[aria-checked="true"]');
      values.fatigue = checked ? Number(checked.dataset.value) : null;
      values.painAreas = [...form.querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.value);
      values.memo = f.memo.value.trim();

      const isEmpty = STEPPERS.every((d) => values[d.name] === null)
        && values.fatigue === null && values.painAreas.length === 0 && !values.memo;
      if (isEmpty) {
        errorBox.textContent = '何か1つは入れてください。';
        errorBox.hidden = false;
        return;
      }

      await saveBodyLog({ ...log, ...values });
      toast('保存しました');
      location.hash = backTo;
    });

    form.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm('この日の体の記録を消します。よろしいですか?')) return;
      await deleteBodyLog(date);
      toast('消しました');
      location.hash = backTo;
    });
  },
};
