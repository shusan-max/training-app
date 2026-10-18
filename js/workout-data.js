// トレーニング(1回の練習)とセットの読み書き
import { get, getAll, getAllByIndex, put, remove, removeMany, newId } from './db.js';
import { formatKg } from './ui.js';
import { recordType } from './data/exercises.js';

const byDateThenCreated = (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

export function getWorkout(id) {
  return get('workouts', id);
}

// 全部のトレーニングを、古い順で返す
export async function getAllWorkouts() {
  return (await getAll('workouts')).sort(byDateThenCreated);
}

export async function getAllSets() {
  return (await getAll('sets')).sort(byDateThenCreated);
}

// あるトレーニングのセットを、記録した順で返す
export async function getSetsForWorkout(workoutId) {
  return (await getAllByIndex('sets', 'workoutId', workoutId)).sort(byDateThenCreated);
}

export function saveWorkout(workout) {
  return put('workouts', workout);
}

export async function createWorkout(date) {
  const now = new Date().toISOString();
  return saveWorkout({
    id: newId(),
    date,
    type: null,          // 重い日/量の日など(⑦で使う)
    exerciseIds: [],     // この日にやる種目(画面に出す順)
    startedAt: now,
    finishedAt: null,
    note: '',
    createdAt: now,
  });
}

// ===== メニュー提案の記録 =====
export function getPlan(id) {
  return get('plans', id);
}

export function getAllPlans() {
  return getAll('plans');
}

// 提案されたメニューでトレーニングを始める(メニューも保存して、次回の重さ決めに使う)
export async function startPlannedWorkout(plan, date) {
  const workout = await createWorkout(date);
  const planRecord = {
    ...plan,
    id: newId(),
    date,
    workoutId: workout.id,
    createdAt: new Date().toISOString(),
  };
  await put('plans', planRecord);
  workout.type = plan.type;
  workout.planId = planRecord.id;
  workout.exerciseIds = [...plan.exerciseIds];
  await saveWorkout(workout);
  return workout;
}

// その日の、まだ終わっていないトレーニングを探す。無ければ新しく作る
export async function findOrCreateOpenWorkout(date) {
  const open = (await getAllWorkouts()).find((w) => w.date === date && !w.finishedAt);
  return open ?? createWorkout(date);
}

// トレーニングと、そのセット・メニューを全部消す
export async function deleteWorkout(id) {
  const workout = await getWorkout(id);
  const sets = await getSetsForWorkout(id);
  await removeMany('sets', sets.map((s) => s.id));
  if (workout?.planId) await remove('plans', workout.planId);
  await remove('workouts', id);
}

export function saveSet(set) {
  return put('sets', set);
}

export function deleteSet(id) {
  return remove('sets', id);
}

// 同じ種目の「前回」のセット(今のトレーニングより前で、一番新しい日の分)
export async function getPreviousSets(exerciseId, workout) {
  const earlier = (await getAllByIndex('sets', 'exerciseId', exerciseId))
    .filter((s) => s.workoutId !== workout.id && s.date <= workout.date)
    .sort(byDateThenCreated);
  if (earlier.length === 0) return null;
  const lastWorkoutId = earlier[earlier.length - 1].workoutId;
  const sets = earlier.filter((s) => s.workoutId === lastWorkoutId);
  return { date: sets[0].date, sets };
}

// 秒を「45秒」「1分30秒」の形にする
export function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}秒`;
  return s ? `${m}分${s}秒` : `${m}分`;
}

// 1セットを「70kg×3回」「20分・3km」「1分30秒」の形にする
export function formatSet(set, exercise) {
  switch (recordType(exercise)) {
    case 'cardio': {
      const minutes = `${Number(((set.durationSec ?? 0) / 60).toFixed(1))}分`;
      return set.distanceKm ? `${minutes}・${Number(set.distanceKm.toFixed(2))}km` : minutes;
    }
    case 'time':
      return formatSeconds(set.durationSec ?? 0);
    case 'bodyweight':
      return `${set.weight > 0 ? `自重+${formatKg(set.weight)}kg` : '自重'}×${set.reps}回`;
    default:
      return `${formatKg(set.weight)}kg×${set.reps}回`;
  }
}

// セットの並びを「70kg×3回 ×2セット、65kg×6回」の形にまとめる(ウォームアップは除く)
export function formatSetList(sets, exercise) {
  const work = sets.filter((s) => !s.isWarmup);
  if (work.length === 0) return 'ウォームアップのみ';
  const groups = [];
  for (const set of work) {
    const text = formatSet(set, exercise);
    const last = groups[groups.length - 1];
    if (last && last.text === text) {
      last.count += 1;
    } else {
      groups.push({ text, count: 1 });
    }
  }
  return groups.map((g) => `${g.text}${g.count > 1 ? ` ×${g.count}セット` : ''}`).join('、');
}
