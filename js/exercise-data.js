// 自分で作った種目の読み書き
import { getAll, getAllByIndex, put, remove, newId } from './db.js';
import { setCustomExercises } from './data/exercises.js';

// 保存してある自作種目を読み込んで、種目の一覧に加える
export async function loadCustomExercises() {
  const list = await getAll('exercises');
  setCustomExercises(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  return list;
}

export async function saveCustomExercise(values, existing = null) {
  const exercise = existing
    ? { ...existing, ...values, updatedAt: new Date().toISOString() }
    : { id: `custom-${newId()}`, custom: true, createdAt: new Date().toISOString(), ...values };
  await put('exercises', exercise);
  await loadCustomExercises();
  return exercise;
}

// 消す。記録がある種目は、記録を残すために「一覧から隠す」だけにする
export async function deleteCustomExercise(exercise) {
  const used = await getAllByIndex('sets', 'exerciseId', exercise.id);
  if (used.length > 0) {
    await put('exercises', { ...exercise, archived: true, updatedAt: new Date().toISOString() });
  } else {
    await remove('exercises', exercise.id);
  }
  await loadCustomExercises();
  return used.length > 0 ? 'archived' : 'removed';
}
