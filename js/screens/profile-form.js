// 「目標と自分の情報」の入力フォーム。初回設定と、設定画面の編集の両方で使う。
import { FREQUENCY_OPTIONS } from '../settings-data.js';
import { parseNumber } from '../ui.js';

export function createProfileForm(settings, { submitLabel, onSubmit }) {
  const form = document.createElement('form');
  form.className = 'form';
  form.noValidate = true;

  const frequencyOptions = FREQUENCY_OPTIONS
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  form.innerHTML = `
    <section class="card">
      <h2>目標</h2>
      <p class="sub">種目:ベンチプレス</p>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">目標の重さ</span>
          <span class="input-unit"><input name="goalWeight" type="number" inputmode="decimal" step="any"><span>kg</span></span>
        </label>
        <label class="field">
          <span class="field-label">達成目標日</span>
          <input name="goalDate" type="date">
        </label>
      </div>
    </section>

    <section class="card">
      <h2>今のベンチプレス</h2>
      <p class="sub">最近できた重さと回数を入れてください(いくつでも)</p>
      <div class="bench-rows"></div>
      <button type="button" class="btn btn-ghost" data-action="add-row">+ 記録を追加</button>
    </section>

    <section class="card">
      <h2>自分の情報</h2>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">体重</span>
          <span class="input-unit"><input name="bodyWeightKg" type="number" inputmode="decimal" step="any"><span>kg</span></span>
        </label>
        <label class="field">
          <span class="field-label">身長</span>
          <span class="input-unit"><input name="heightCm" type="number" inputmode="decimal" step="any"><span>cm</span></span>
        </label>
        <label class="field">
          <span class="field-label">体脂肪率(任意)</span>
          <span class="input-unit"><input name="bodyFatPct" type="number" inputmode="decimal" step="any"><span>%</span></span>
        </label>
        <label class="field">
          <span class="field-label">経験</span>
          <span class="input-unit"><input name="experienceYears" type="number" inputmode="decimal" step="any"><span>年</span></span>
        </label>
      </div>
    </section>

    <section class="card">
      <h2>トレーニング</h2>
      <div class="field-grid">
        <label class="field">
          <span class="field-label">頻度</span>
          <select name="frequency">${frequencyOptions}</select>
        </label>
        <label class="field">
          <span class="field-label">1回の時間</span>
          <span class="input-unit"><input name="sessionMinutes" type="number" inputmode="numeric" step="1"><span>分</span></span>
        </label>
      </div>
      <label class="field">
        <span class="field-label">場所</span>
        <input name="place" type="text" placeholder="例:ジム(セーフティバーあり)">
      </label>
      <label class="field">
        <span class="field-label">ケガや痛む部位</span>
        <input name="injuries" type="text" placeholder="例:特になし">
      </label>
    </section>

    <p class="form-error" role="alert" hidden></p>
    <button type="submit" class="btn">${submitLabel}</button>
  `;

  // 今の設定の値を入力欄に入れる
  const f = form.elements;
  const { goal, profile, benchBaseline } = settings;
  f.goalWeight.value = goal.weight ?? '';
  f.goalDate.value = goal.date ?? '';
  f.bodyWeightKg.value = profile.bodyWeightKg ?? '';
  f.heightCm.value = profile.heightCm ?? '';
  f.bodyFatPct.value = profile.bodyFatPct ?? '';
  f.experienceYears.value = profile.experienceYears ?? '';
  f.frequency.value = profile.frequency;
  f.sessionMinutes.value = profile.sessionMinutes ?? '';
  f.place.value = profile.place ?? '';
  f.injuries.value = profile.injuries ?? '';

  // ベンチプレスの記録の行
  const rows = form.querySelector('.bench-rows');
  const records = benchBaseline.records.length > 0 ? benchBaseline.records : [{}];
  records.forEach((record) => addBenchRow(rows, record));

  form.querySelector('[data-action="add-row"]').addEventListener('click', () => {
    addBenchRow(rows, {});
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = form.querySelector('.form-error');
    const result = readForm(form);
    if (result.error) {
      errorBox.textContent = result.error;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    errorBox.hidden = true;
    form.querySelector('button[type="submit"]').disabled = true;
    try {
      await onSubmit(result.values);
    } finally {
      form.querySelector('button[type="submit"]').disabled = false;
    }
  });

  return form;
}

function addBenchRow(container, record) {
  const row = document.createElement('div');
  row.className = 'bench-row';
  row.innerHTML = `
    <span class="input-unit"><input data-field="weight" type="number" inputmode="decimal" step="any" aria-label="重さ"><span>kg</span></span>
    <span class="times">×</span>
    <span class="input-unit"><input data-field="reps" type="number" inputmode="numeric" step="1" aria-label="回数"><span>回</span></span>
    <button type="button" class="icon-btn" aria-label="この記録を消す">×</button>
  `;
  row.querySelector('[data-field="weight"]').value = record.weight ?? '';
  row.querySelector('[data-field="reps"]').value = record.reps ?? '';
  row.querySelector('.icon-btn').addEventListener('click', () => {
    // 最後の1行は消さずに中身を空にする
    if (container.children.length > 1) {
      row.remove();
    } else {
      row.querySelectorAll('input').forEach((input) => { input.value = ''; });
    }
  });
  container.append(row);
}

// 入力内容を読み取り、おかしなところがあれば error を返す
function readForm(form) {
  const f = form.elements;
  const fail = (error) => ({ error });

  const goalWeight = parseNumber(f.goalWeight.value);
  if (!(goalWeight > 0)) return fail('目標の重さを入れてください。');
  if (!f.goalDate.value) return fail('達成目標日を入れてください。');

  const benchRecords = [];
  for (const row of form.querySelectorAll('.bench-row')) {
    const weight = parseNumber(row.querySelector('[data-field="weight"]').value);
    const reps = parseNumber(row.querySelector('[data-field="reps"]').value);
    if (weight === null && reps === null) continue; // 空の行は飛ばす
    if (!(weight > 0)) return fail('ベンチプレスの重さを正しく入れてください。');
    if (!(Number.isInteger(reps) && reps >= 1 && reps <= 30)) {
      return fail('ベンチプレスの回数は1〜30の整数で入れてください。');
    }
    benchRecords.push({ weight, reps });
  }
  if (benchRecords.length === 0) return fail('今のベンチプレスの記録を1つ以上入れてください。');

  const bodyWeightKg = parseNumber(f.bodyWeightKg.value);
  if (!(bodyWeightKg > 0)) return fail('体重を入れてください。');

  // 任意の数字の項目:空なら null、入っていれば正の数か確かめる
  const optional = {};
  for (const [name, label] of [
    ['heightCm', '身長'],
    ['bodyFatPct', '体脂肪率'],
    ['experienceYears', '経験'],
    ['sessionMinutes', '1回の時間'],
  ]) {
    const value = parseNumber(f[name].value);
    if (value !== null && !(value >= 0)) return fail(`${label}を正しく入れてください。`);
    optional[name] = value;
  }

  return {
    values: {
      goal: { weight: goalWeight, date: f.goalDate.value },
      benchRecords,
      profile: {
        bodyWeightKg,
        ...optional,
        frequency: f.frequency.value,
        place: f.place.value.trim(),
        injuries: f.injuries.value.trim(),
      },
    },
  };
}
