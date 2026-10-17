// 種目の一覧(フォームなどの説明文は⑧で足す)
// equipment(道具):barbell バーベル / dumbbell ダンベル / machine マシン・ケーブル / bodyweight 自重

export const CATEGORIES = [
  ['main', 'メイン'],
  ['chest', '胸'],
  ['back', '背中'],
  ['shoulder', '肩'],
  ['arms', '腕(三頭筋)'],
];

export const EXERCISES = [
  { id: 'bench-press', name: 'ベンチプレス', category: 'main', equipment: 'barbell' },
  { id: 'dumbbell-press', name: 'ダンベルプレス', category: 'chest', equipment: 'dumbbell' },
  { id: 'incline-dumbbell-press', name: 'インクラインダンベルプレス', category: 'chest', equipment: 'dumbbell' },
  { id: 'incline-bench-press', name: 'インクラインベンチプレス', category: 'chest', equipment: 'barbell' },
  { id: 'push-up', name: '腕立て伏せ', category: 'chest', equipment: 'bodyweight' },
  { id: 'lat-pulldown', name: 'ラットプルダウン', category: 'back', equipment: 'machine' },
  { id: 'seated-row', name: 'シーテッドロウ', category: 'back', equipment: 'machine' },
  { id: 'dumbbell-row', name: 'ワンハンドダンベルロウ', category: 'back', equipment: 'dumbbell' },
  { id: 'barbell-row', name: 'ベントオーバーロウ', category: 'back', equipment: 'barbell' },
  { id: 'shoulder-press', name: 'ダンベルショルダープレス', category: 'shoulder', equipment: 'dumbbell' },
  { id: 'lateral-raise', name: 'サイドレイズ', category: 'shoulder', equipment: 'dumbbell' },
  { id: 'face-pull', name: 'フェイスプル', category: 'shoulder', equipment: 'machine' },
  { id: 'triceps-pushdown', name: 'トライセプスプッシュダウン', category: 'arms', equipment: 'machine' },
  { id: 'lying-triceps-extension', name: 'ライイングトライセプスエクステンション', category: 'arms', equipment: 'barbell' },
  { id: 'dips', name: 'ディップス', category: 'arms', equipment: 'bodyweight' },
];

export function getExercise(id) {
  return EXERCISES.find((e) => e.id === id)
    ?? { id, name: '(不明な種目)', category: 'other', equipment: 'machine' };
}

// ±ボタン1回で変わる重さ
export function weightStep(exercise, settings) {
  switch (exercise.equipment) {
    case 'barbell': return settings.training.plateStepKg;
    case 'dumbbell': return 1;
    default: return 2.5;
  }
}

// 重さの入力欄の名前
export function weightLabel(exercise) {
  switch (exercise.equipment) {
    case 'dumbbell': return '重さ(ダンベル1個)';
    case 'bodyweight': return '追加の重さ(なければ0)';
    default: return '重さ';
  }
}
