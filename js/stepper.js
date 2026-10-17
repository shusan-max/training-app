// ±ボタンつきの数字入力。体の記録とトレーニング記録で使う。
import { parseNumber } from './ui.js';

export function stepperHtml({ name, label, unit, hint = '' }) {
  return `
    <div class="field">
      <span class="field-label">${label}<span class="hint">${hint}</span></span>
      <div class="stepper" data-name="${name}">
        <button type="button" class="step-btn" data-dir="-1" aria-label="${label}を減らす">−</button>
        <span class="input-unit"><input name="${name}" type="number" inputmode="decimal" step="any" aria-label="${label}"><span>${unit}</span></span>
        <button type="button" class="step-btn" data-dir="1" aria-label="${label}を増やす">+</button>
      </div>
    </div>
  `;
}

/**
 * ±ボタンを動くようにする。
 * defs: [{ name, step, min, max, start }]
 *   start は、欄が空のときに±を押したら入る値(前回の値など)
 */
export function bindSteppers(root, defs) {
  root.querySelectorAll('.stepper').forEach((stepper) => {
    const def = defs.find((d) => d.name === stepper.dataset.name);
    if (!def) return;
    const input = stepper.querySelector('input');
    stepper.querySelectorAll('.step-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const current = parseNumber(input.value);
        let next;
        if (current === null || Number.isNaN(current)) {
          next = def.start ?? 0;
        } else {
          next = current + Number(button.dataset.dir) * def.step;
        }
        next = Math.min(def.max, Math.max(def.min, Math.round(next * 100) / 100));
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}
