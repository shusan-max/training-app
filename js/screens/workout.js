// トレーニング記録の画面
// #workout          … 今日の続き(無ければ新しく始める)
// #workout/<番号>    … そのトレーニングを開く(過去の記録の修正にも使う)
import {
  getWorkout, findOrCreateOpenWorkout, saveWorkout, deleteWorkout, getPlan,
  getSetsForWorkout, saveSet, deleteSet, getPreviousSets, formatSet, formatSetList,
} from '../workout-data.js';
import { describeSteps, DAY_TYPES } from '../logic/planner.js';
import { CATEGORIES, EXERCISES, getExercise, weightStep, weightLabel } from '../data/exercises.js';
import { bestEstimate, describeEstimate } from '../logic/e1rm.js';
import { startRest, stopRest, unlockAudio } from '../rest-timer.js';
import { stepperHtml, bindSteppers } from '../stepper.js';
import { newId } from '../db.js';
import { formatDateJa, formatKg, parseDateString, parseNumber, todayString, toast } from '../ui.js';

// 「あと何回できたか」の選択肢(3は「3回以上」)
const RIR_OPTIONS = [[0, '0'], [1, '1'], [2, '2'], [3, '3+']];

// ===== 練習中は画面が消えないようにする =====
let wakeLock = null;
let keepAwake = false;

// この画面で付けた「押されたら〇〇する」をまとめて外すためのもの
let listeners = null;

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch { /* 使えない環境では何もしない */ }
}
function onVisibilityChange() {
  if (keepAwake && document.visibilityState === 'visible') requestWakeLock();
}

// ===== 種目を選ぶ画面(下から出てくる) =====
function openExercisePicker(alreadyAdded, onPick) {
  const groups = CATEGORIES.map(([category, label]) => {
    const buttons = EXERCISES.filter((e) => e.category === category).map((e) => `
      <button type="button" class="pick" data-id="${e.id}" ${alreadyAdded.includes(e.id) ? 'disabled' : ''}>${e.name}</button>
    `).join('');
    return `<h3>${label}</h3><div class="pick-list">${buttons}</div>`;
  }).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="種目を追加">
      <div class="sheet-head">
        <h2>種目を追加</h2>
        <button type="button" class="icon-btn" data-close aria-label="閉じる">×</button>
      </div>
      <div class="sheet-body">${groups}</div>
    </div>
  `;
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close]')) {
      close();
      return;
    }
    const pick = event.target.closest('.pick');
    if (pick && !pick.disabled) {
      close();
      onPick(pick.dataset.id);
    }
  });
  document.body.append(backdrop);
}

export default {
  title: 'トレーニング',
  tab: 'today',

  // ほかの画面に移るとき
  leave() {
    listeners?.abort();
    listeners = null;
    keepAwake = false;
    wakeLock?.release?.();
    wakeLock = null;
    document.querySelectorAll('.sheet-backdrop').forEach((el) => el.remove());
  },

  async render(container, { settings, params }) {
    listeners = new AbortController();
    const { signal } = listeners;

    let workout;
    if (params[0]) {
      workout = await getWorkout(params[0]);
    } else {
      workout = await findOrCreateOpenWorkout(todayString());
      // 再読み込みしても同じトレーニングが開くように、URL に番号を入れておく
      history.replaceState(null, '', `#workout/${workout.id}`);
    }
    if (!workout) {
      container.innerHTML = '<section class="card"><p>記録が見つかりませんでした。</p></section>';
      return;
    }

    // 「今日のメニュー」から始めたときは、そのメニュー
    const plan = workout.planId ? await getPlan(workout.planId) : null;
    const planStepsFor = (exerciseId) => (plan ? plan.steps.filter((s) => s.exerciseId === exerciseId) : []);

    const state = {
      sets: await getSetsForWorkout(workout.id),
      previous: {},          // 種目ごとの前回の記録
      drafts: {},            // 種目ごとの、入力途中の値
      active: null,          // 入力欄を開いている種目
      editingSetId: null,    // 直しているセット
    };

    const setsFor = (exerciseId) => state.sets.filter((s) => s.exerciseId === exerciseId);
    // メニューのセットがまだ残っている、最初の種目
    const nextPlannedExercise = () => workout.exerciseIds
      .find((id) => setsFor(id).length < planStepsFor(id).length) ?? null;

    state.active = (plan && nextPlannedExercise())
      ?? workout.exerciseIds[workout.exerciseIds.length - 1] ?? null;

    // 前回の記録。ベンチプレスで記録が無ければ、初回設定の記録を使う
    async function loadPrevious(exerciseId) {
      const previous = await getPreviousSets(exerciseId, workout);
      if (previous) {
        state.previous[exerciseId] = previous;
      } else if (exerciseId === 'bench-press' && settings.benchBaseline.records.length) {
        state.previous[exerciseId] = {
          date: settings.benchBaseline.date,
          sets: settings.benchBaseline.records,
          isBaseline: true,
        };
      }
    }
    await Promise.all(workout.exerciseIds.map(loadPrevious));

    if (!workout.finishedAt) {
      keepAwake = true;
      requestWakeLock();
      document.addEventListener('visibilitychange', onVisibilityChange, { signal });
    }

    // 入力欄の最初の値:メニューの次のセット → 今日の最後のセット → 前回の最初のセット → 空
    function draftFor(exercise) {
      if (state.drafts[exercise.id]) return state.drafts[exercise.id];
      const own = setsFor(exercise.id).filter((s) => !s.isWarmup);
      const last = own[own.length - 1] ?? state.previous[exercise.id]?.sets.find((s) => !s.isWarmup);
      const next = planStepsFor(exercise.id)[setsFor(exercise.id).length];
      if (next) {
        return { weight: next.weight ?? last?.weight ?? null, reps: next.reps, rir: null, warmup: next.isWarmup };
      }
      if (last) return { weight: last.weight, reps: last.reps, rir: null, warmup: false };
      return { weight: exercise.equipment === 'bodyweight' ? 0 : null, reps: null, rir: null, warmup: false };
    }

    // 入力欄の見出し(例:「次:ウォームアップ 2/5」)
    function panelTitle(exerciseId) {
      const steps = planStepsFor(exerciseId);
      if (steps.length === 0) return '次のセット';
      const index = setsFor(exerciseId).length;
      const step = steps[index];
      if (!step) return '予定のセットは終わりました(追加で記録もできます)';
      const sameLabel = steps.filter((s) => s.label === step.label);
      const position = steps.slice(0, index + 1).filter((s) => s.label === step.label).length;
      return sameLabel.length > 1 ? `次:${step.label} ${position}/${sameLabel.length}` : `次:${step.label}`;
    }

    // カードに出す「今日の予定」
    function planLinesHtml(exercise) {
      const steps = planStepsFor(exercise.id);
      if (steps.length === 0) return '';
      if (exercise.id === 'bench-press') {
        const warm = steps.filter((s) => s.isWarmup).map((s) => `${formatKg(s.weight)}×${s.reps}`).join(' → ');
        const work = describeSteps(steps.filter((s) => !s.isWarmup))
          .map((g) => `${g.label} ${formatKg(g.weight)}kg×${g.reps}回${g.count > 1 ? ` ×${g.count}セット` : ''}`);
        return `<p class="plan-line">今日の予定:${warm ? `W ${warm} / ` : ''}${work.join(' / ')}</p>`;
      }
      const a = plan.accessories.find((x) => x.exerciseId === exercise.id);
      let weight;
      if (a.weight == null) weight = '重さは自分で';
      else if (exercise.equipment === 'bodyweight') weight = a.weight > 0 ? `自重+${formatKg(a.weight)}kg` : '自重';
      else weight = `${formatKg(a.weight)}kg`;
      return `<p class="plan-line">今日の予定:${weight} × ${a.repsMin}〜${a.repsMax}回 × ${a.sets}セット(${a.note})</p>`;
    }

    // ----- 表示 -----
    function setRowHtml(set, label, exercise) {
      const rir = set.rir != null ? `余裕${set.rir === 3 ? '3+' : set.rir}` : '';
      return `
        <li>
          <button type="button" class="set-row${set.id === state.editingSetId ? ' editing' : ''}" data-action="edit-set" data-set-id="${set.id}">
            <span class="set-no${set.isWarmup ? ' warmup' : ''}">${label}</span>
            <span class="set-main">${formatSet(set, exercise)}</span>
            <span class="set-meta">${rir}</span>
          </button>
        </li>
      `;
    }

    function panelHtml(exercise, editing) {
      const draft = editing
        ? { weight: editing.weight, reps: editing.reps, rir: editing.rir, warmup: editing.isWarmup }
        : draftFor(exercise);
      const rirButtons = RIR_OPTIONS.map(([value, label]) => `
        <button type="button" role="radio" aria-checked="${draft.rir === value}" data-rir="${value}"><strong>${label}</strong></button>
      `).join('');
      return `
        <div class="set-panel">
          <p class="panel-title">${editing ? 'セットを直す' : panelTitle(exercise.id)}</p>
          ${stepperHtml({ name: 'weight', label: weightLabel(exercise), unit: 'kg' })}
          ${stepperHtml({ name: 'reps', label: '回数', unit: '回' })}
          <div class="field">
            <span class="field-label">あと何回できそうだった?(任意)</span>
            <div class="segmented rir" role="radiogroup" aria-label="あと何回できたか">${rirButtons}</div>
          </div>
          <label class="check">
            <input type="checkbox" name="warmup" ${draft.warmup ? 'checked' : ''}>
            <span>ウォームアップのセット</span>
          </label>
          <button type="button" class="btn" data-action="save-set">${editing ? '直す' : '記録する'}</button>
          ${editing ? `
            <div class="button-row">
              <button type="button" class="btn btn-danger" data-action="delete-set">消す</button>
              <button type="button" class="btn btn-secondary" data-action="cancel-edit">やめる</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    function cardHtml(exerciseId) {
      const exercise = getExercise(exerciseId);
      const sets = setsFor(exerciseId);
      const previous = state.previous[exerciseId];
      let previousText = '前回の記録はありません';
      if (previous) {
        const when = previous.isBaseline ? '初回設定の記録' : `前回(${formatDateJa(parseDateString(previous.date))})`;
        previousText = `${when}:${formatSetList(previous.sets, exercise)}`;
      }

      let workNo = 0;
      const rows = sets.map((set) => {
        if (!set.isWarmup) workNo += 1;
        return setRowHtml(set, set.isWarmup ? 'W' : String(workNo), exercise);
      }).join('');

      const editing = state.editingSetId && sets.find((s) => s.id === state.editingSetId);
      const isActive = state.active === exerciseId;

      let estimateHtml = '';
      const best = exercise.equipment === 'bodyweight' ? null : bestEstimate(sets);
      if (best) {
        estimateHtml = `
          <div class="estimate">
            <p><span class="sub">今日の推定MAX</span> <strong>${best.value.toFixed(1)}kg</strong></p>
            <p class="sub">${describeEstimate(best)}</p>
          </div>
        `;
      }

      return `
        <section class="card exercise-card" data-exercise="${exerciseId}">
          <div class="exercise-head">
            <h2>${exercise.name}</h2>
            ${sets.length === 0 ? `<button type="button" class="icon-btn" data-action="remove-exercise" data-exercise="${exerciseId}" aria-label="${exercise.name}を外す">×</button>` : ''}
          </div>
          <p class="previous">${previousText}</p>
          ${planLinesHtml(exercise)}
          ${rows ? `<ol class="set-list">${rows}</ol>` : ''}
          ${isActive
            ? panelHtml(exercise, editing)
            : `<button type="button" class="btn btn-ghost" data-action="activate" data-exercise="${exerciseId}">+ セットを記録</button>`}
          ${estimateHtml}
        </section>
      `;
    }

    function draw() {
      const ids = workout.exerciseIds;
      container.innerHTML = `
        <a class="back-link" href="#today">‹ 今日に戻る</a>
        <p class="date-label">${formatDateJa(parseDateString(workout.date))}${workout.finishedAt ? '(終了済み)' : ''}</p>
        ${plan ? `
          <section class="card plan-head">
            <span class="type-badge type-${plan.type}">${DAY_TYPES[plan.type]}のメニュー</span>
            ${plan.safety ? '<p class="safety">⚠️ セーフティバーを設定するか、補助者についてもらいましょう。</p>' : ''}
            ${plan.notes.filter((n) => !n.includes('体の記録')).map((n) => `<p class="sub">${n}</p>`).join('')}
          </section>
        ` : ''}
        ${ids.length ? '' : '<section class="card"><p class="sub">「+ 種目を追加」から始めましょう。</p></section>'}
        ${ids.map(cardHtml).join('')}
        <div class="button-stack">
          <button type="button" class="btn btn-secondary" data-action="add-exercise">+ 種目を追加</button>
          ${workout.finishedAt
            ? '<button type="button" class="btn btn-danger" data-action="delete-workout">この日のトレーニングを消す</button>'
            : '<button type="button" class="btn" data-action="finish">トレーニングを終える</button>'}
        </div>
      `;

      // 開いている入力欄に値を入れ、±ボタンを動くようにする
      const panel = container.querySelector('.set-panel');
      if (panel) {
        const exercise = getExercise(state.active);
        const editing = state.sets.find((s) => s.id === state.editingSetId);
        const draft = editing ? { weight: editing.weight, reps: editing.reps } : draftFor(exercise);
        panel.querySelector('[name="weight"]').value = draft.weight ?? '';
        panel.querySelector('[name="reps"]').value = draft.reps ?? '';
        bindSteppers(panel, [
          { name: 'weight', step: weightStep(exercise, settings), min: 0, max: 500, start: draft.weight ?? 20 },
          { name: 'reps', step: 1, min: 1, max: 100, start: draft.reps ?? 5 },
        ]);
      }
    }

    // 入力欄の値を読む
    function readPanel() {
      const panel = container.querySelector('.set-panel');
      const checked = panel.querySelector('.rir [aria-checked="true"]');
      return {
        weight: parseNumber(panel.querySelector('[name="weight"]').value),
        reps: parseNumber(panel.querySelector('[name="reps"]').value),
        rir: checked ? Number(checked.dataset.rir) : null,
        warmup: panel.querySelector('[name="warmup"]').checked,
      };
    }

    // 入力途中の値を覚えておく(ほかの種目に切り替えても消えないように)
    function rememberDraft() {
      if (!state.active || state.editingSetId || !container.querySelector('.set-panel')) return;
      state.drafts[state.active] = readPanel();
    }

    function scrollToPanel() {
      container.querySelector('.set-panel')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    async function reloadSets() {
      state.sets = await getSetsForWorkout(workout.id);
    }

    // ----- ボタンの動き -----
    container.addEventListener('click', async (event) => {
      // 「あと何回」のボタン:もう一度押すと外れる
      const rirButton = event.target.closest('[data-rir]');
      if (rirButton) {
        const wasChecked = rirButton.getAttribute('aria-checked') === 'true';
        rirButton.parentElement.querySelectorAll('[data-rir]').forEach((b) => b.setAttribute('aria-checked', 'false'));
        if (!wasChecked) rirButton.setAttribute('aria-checked', 'true');
        return;
      }

      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;

      if (action === 'save-set') {
        unlockAudio(); // ボタンを押した瞬間に音の準備(iPhone のため)
        const values = readPanel();
        if (values.weight === null || Number.isNaN(values.weight) || values.weight < 0 || values.weight > 500) {
          toast('重さを入れてください');
          return;
        }
        if (!Number.isInteger(values.reps) || values.reps < 1 || values.reps > 100) {
          toast('回数を1以上の整数で入れてください');
          return;
        }
        const editing = state.sets.find((s) => s.id === state.editingSetId);
        if (editing) {
          await saveSet({ ...editing, weight: values.weight, reps: values.reps, rir: values.rir, isWarmup: values.warmup });
          state.editingSetId = null;
          toast('直しました');
        } else {
          await saveSet({
            id: newId(),
            workoutId: workout.id,
            date: workout.date,
            exerciseId: state.active,
            weight: values.weight,
            reps: values.reps,
            rir: values.rir,
            isWarmup: values.warmup,
            createdAt: new Date().toISOString(),
          });
          // ウォームアップのあとは短めの休憩(最大1分)
          const rest = settings.training.restSeconds;
          startRest(values.warmup ? Math.min(60, rest) : rest);
        }
        await reloadSets();
        if (!editing) {
          if (planStepsFor(state.active).length) {
            // メニューがあるときは、次のセットもメニューから
            delete state.drafts[state.active];
            // この種目の予定が終わったら、次の種目へ
            if (setsFor(state.active).length >= planStepsFor(state.active).length) {
              state.active = nextPlannedExercise() ?? state.active;
            }
          } else {
            // 次のセットも同じ重さ・回数から始める(「あと何回」は毎回選び直す)
            state.drafts[state.active] = { ...values, rir: null };
          }
        }
        draw();
        return;
      }

      if (action === 'edit-set') {
        rememberDraft();
        const set = state.sets.find((s) => s.id === target.dataset.setId);
        state.active = set.exerciseId;
        state.editingSetId = set.id;
        draw();
        scrollToPanel();
        return;
      }

      if (action === 'cancel-edit') {
        state.editingSetId = null;
        draw();
        return;
      }

      if (action === 'delete-set') {
        if (!confirm('このセットを消します。よろしいですか?')) return;
        await deleteSet(state.editingSetId);
        state.editingSetId = null;
        await reloadSets();
        draw();
        toast('消しました');
        return;
      }

      if (action === 'activate') {
        rememberDraft();
        state.active = target.dataset.exercise;
        state.editingSetId = null;
        draw();
        scrollToPanel();
        return;
      }

      if (action === 'add-exercise') {
        rememberDraft();
        openExercisePicker(workout.exerciseIds, async (exerciseId) => {
          workout.exerciseIds = [...workout.exerciseIds, exerciseId];
          await saveWorkout(workout);
          await loadPrevious(exerciseId);
          state.active = exerciseId;
          state.editingSetId = null;
          draw();
          scrollToPanel();
        });
        return;
      }

      if (action === 'remove-exercise') {
        const exerciseId = target.dataset.exercise;
        workout.exerciseIds = workout.exerciseIds.filter((id) => id !== exerciseId);
        await saveWorkout(workout);
        if (state.active === exerciseId) state.active = null;
        draw();
        return;
      }

      if (action === 'finish') {
        stopRest();
        if (state.sets.length === 0) {
          if (!confirm('セットの記録がないので、このトレーニングは消します。よろしいですか?')) return;
          await deleteWorkout(workout.id);
          location.hash = '#today';
          return;
        }
        workout.finishedAt = new Date().toISOString();
        await saveWorkout(workout);
        const workSets = state.sets.filter((s) => !s.isWarmup).length;
        toast(`おつかれさまでした!${workSets}セット記録しました`);
        location.hash = '#today';
        return;
      }

      if (action === 'delete-workout') {
        if (!confirm('この日のトレーニングの記録を全部消します。よろしいですか?')) return;
        await deleteWorkout(workout.id);
        toast('消しました');
        location.hash = '#history';
      }
    }, { signal });

    draw();
  },
};
