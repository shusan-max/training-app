// 種目を作る・直すフォーム(下から出てくる画面)
// トレーニング中の「種目を追加」と、「種目」タブの両方から使う
import { CATEGORIES, RECORD_TYPES, WEIGHT_EQUIPMENT, recordType } from './data/exercises.js';
import { saveCustomExercise } from './exercise-data.js';

const options = (list, selected) => list
  .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
  .join('');

/**
 * exercise: 直すときはその種目、作るときは null
 * onSaved(exercise): 保存したあとに呼ばれる
 */
export function openExerciseForm({ exercise = null, onSaved }) {
  const record = exercise ? recordType(exercise) : 'weight';
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${exercise ? '種目を直す' : '種目を作る'}">
      <div class="sheet-head">
        <h2>${exercise ? '種目を直す' : '種目を作る'}</h2>
        <button type="button" class="icon-btn" data-close aria-label="閉じる">×</button>
      </div>
      <form class="sheet-body form" novalidate>
        <label class="field">
          <span class="field-label">名前</span>
          <input name="name" type="text" placeholder="例:ブルガリアンスクワット" maxlength="40">
        </label>
        <label class="field">
          <span class="field-label">部位</span>
          <select name="category">${options(CATEGORIES.filter(([c]) => c !== 'main'), exercise?.category ?? 'other')}</select>
        </label>
        <label class="field">
          <span class="field-label">記録のしかた</span>
          <select name="record">${options(RECORD_TYPES, record)}</select>
        </label>
        <label class="field" data-show-for="weight">
          <span class="field-label">道具(±ボタンの刻みが変わります)</span>
          <select name="equipment">${options(WEIGHT_EQUIPMENT, exercise?.equipment ?? 'machine')}</select>
        </label>
        <p class="sub record-hint"></p>
        <p class="form-error" role="alert" hidden></p>
        <button type="submit" class="btn">${exercise ? '保存する' : '作る'}</button>
      </form>
    </div>
  `;

  const form = backdrop.querySelector('form');
  form.elements.name.value = exercise?.name ?? '';

  const HINTS = {
    weight: '例:マシン、ダンベル、バーベルの種目。重さと回数を記録します',
    bodyweight: '例:懸垂、腹筋。回数を記録します(重りを持ったら、その重さも)',
    cardio: '例:ラン、バイク。時間(分)と距離(km)を記録します',
    time: '例:プランク。時間(秒)を記録します',
  };
  function updateRecordFields() {
    const value = form.elements.record.value;
    form.querySelector('[data-show-for="weight"]').hidden = value !== 'weight';
    form.querySelector('.record-hint').textContent = HINTS[value];
  }
  form.elements.record.addEventListener('change', updateRecordFields);
  updateRecordFields();

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close]')) close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const errorBox = form.querySelector('.form-error');
    if (!name) {
      errorBox.textContent = '名前を入れてください。';
      errorBox.hidden = false;
      return;
    }
    const value = form.elements.record.value;
    const equipment = { weight: form.elements.equipment.value, bodyweight: 'bodyweight', cardio: 'cardio', time: 'bodyweight' }[value];
    const saved = await saveCustomExercise({
      name,
      category: form.elements.category.value,
      record: value,
      equipment,
    }, exercise);
    close();
    onSaved?.(saved);
  });

  document.body.append(backdrop);
  form.elements.name.focus();
}
