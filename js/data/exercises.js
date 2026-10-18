// 種目の一覧(最初から入っている種目+自分で作った種目)
// equipment(道具):barbell バーベル / dumbbell ダンベル / machine マシン・ケーブル / bodyweight 自重 / cardio 有酸素マシンなど
// record(記録のしかた):weight 重さ×回数 / bodyweight 自重×回数 / cardio 時間×距離 / time 時間だけ
//   record を書いていない種目は、道具から決める(自重なら bodyweight、それ以外は weight)

export const CATEGORIES = [
  ['main', 'メイン'],
  ['chest', '胸'],
  ['back', '背中'],
  ['shoulder', '肩'],
  ['arms', '腕'],
  ['legs', '脚・お尻'],
  ['abs', '腹筋・体幹'],
  ['cardio', '有酸素'],
  ['other', 'その他'],
];

export const RECORD_TYPES = [
  ['weight', '重さ × 回数'],
  ['bodyweight', '自重 × 回数'],
  ['cardio', '時間 × 距離'],
  ['time', '時間だけ'],
];

// 「重さ × 回数」の種目の道具(±ボタンの刻み幅が変わる)
export const WEIGHT_EQUIPMENT = [
  ['barbell', 'バーベル'],
  ['dumbbell', 'ダンベル'],
  ['machine', 'マシン・ケーブル'],
];

// muscles は説明文(exercise-guides.js)が無い種目でも、効く部位を出すために使う
export const EXERCISES = [
  // メイン
  { id: 'bench-press', name: 'ベンチプレス', category: 'main', equipment: 'barbell' },

  // 胸
  { id: 'dumbbell-press', name: 'ダンベルプレス', category: 'chest', equipment: 'dumbbell' },
  { id: 'incline-dumbbell-press', name: 'インクラインダンベルプレス', category: 'chest', equipment: 'dumbbell' },
  { id: 'incline-bench-press', name: 'インクラインベンチプレス', category: 'chest', equipment: 'barbell' },
  { id: 'push-up', name: '腕立て伏せ', category: 'chest', equipment: 'bodyweight' },
  { id: 'chest-press', name: 'チェストプレス(マシン)', category: 'chest', equipment: 'machine', muscles: ['大胸筋', '上腕三頭筋', '三角筋(前部)'] },
  { id: 'pec-fly', name: 'ペックフライ(マシン)', category: 'chest', equipment: 'machine', muscles: ['大胸筋'] },
  { id: 'dumbbell-fly', name: 'ダンベルフライ', category: 'chest', equipment: 'dumbbell', muscles: ['大胸筋'] },
  { id: 'cable-crossover', name: 'ケーブルクロスオーバー', category: 'chest', equipment: 'machine', muscles: ['大胸筋'] },

  // 背中
  { id: 'lat-pulldown', name: 'ラットプルダウン', category: 'back', equipment: 'machine' },
  { id: 'seated-row', name: 'シーテッドロウ', category: 'back', equipment: 'machine' },
  { id: 'dumbbell-row', name: 'ワンハンドダンベルロウ', category: 'back', equipment: 'dumbbell' },
  { id: 'barbell-row', name: 'ベントオーバーロウ', category: 'back', equipment: 'barbell' },
  { id: 'pull-up', name: '懸垂(チンニング)', category: 'back', equipment: 'bodyweight', muscles: ['広背筋', '大円筋', '上腕二頭筋'] },
  { id: 'deadlift', name: 'デッドリフト', category: 'back', equipment: 'barbell', muscles: ['脊柱起立筋', '大臀筋', 'ハムストリングス', '広背筋'] },
  { id: 'back-extension', name: 'バックエクステンション', category: 'back', equipment: 'bodyweight', muscles: ['脊柱起立筋', '大臀筋'] },

  // 肩
  { id: 'shoulder-press', name: 'ダンベルショルダープレス', category: 'shoulder', equipment: 'dumbbell' },
  { id: 'overhead-press', name: 'オーバーヘッドプレス(バーベル)', category: 'shoulder', equipment: 'barbell', muscles: ['三角筋(前部・中部)', '上腕三頭筋'] },
  { id: 'machine-shoulder-press', name: 'ショルダープレス(マシン)', category: 'shoulder', equipment: 'machine', muscles: ['三角筋(前部・中部)', '上腕三頭筋'] },
  { id: 'lateral-raise', name: 'サイドレイズ', category: 'shoulder', equipment: 'dumbbell' },
  { id: 'rear-raise', name: 'リアレイズ', category: 'shoulder', equipment: 'dumbbell', muscles: ['三角筋(後部)'] },
  { id: 'face-pull', name: 'フェイスプル', category: 'shoulder', equipment: 'machine' },

  // 腕
  { id: 'triceps-pushdown', name: 'トライセプスプッシュダウン', category: 'arms', equipment: 'machine' },
  { id: 'lying-triceps-extension', name: 'ライイングトライセプスエクステンション', category: 'arms', equipment: 'barbell' },
  { id: 'dips', name: 'ディップス', category: 'arms', equipment: 'bodyweight' },
  { id: 'barbell-curl', name: 'バーベルカール', category: 'arms', equipment: 'barbell', muscles: ['上腕二頭筋'] },
  { id: 'dumbbell-curl', name: 'ダンベルカール', category: 'arms', equipment: 'dumbbell', muscles: ['上腕二頭筋'] },
  { id: 'hammer-curl', name: 'ハンマーカール', category: 'arms', equipment: 'dumbbell', muscles: ['上腕筋', '腕橈骨筋', '上腕二頭筋'] },

  // 脚・お尻
  { id: 'squat', name: 'スクワット(バーベル)', category: 'legs', equipment: 'barbell', muscles: ['大腿四頭筋', '大臀筋', 'ハムストリングス'] },
  { id: 'leg-press', name: 'レッグプレス', category: 'legs', equipment: 'machine', muscles: ['大腿四頭筋', '大臀筋'] },
  { id: 'leg-extension', name: 'レッグエクステンション', category: 'legs', equipment: 'machine', muscles: ['大腿四頭筋'] },
  { id: 'leg-curl', name: 'レッグカール', category: 'legs', equipment: 'machine', muscles: ['ハムストリングス'] },
  { id: 'lunge', name: 'ランジ(ダンベル)', category: 'legs', equipment: 'dumbbell', muscles: ['大腿四頭筋', '大臀筋'] },
  { id: 'hip-thrust', name: 'ヒップスラスト', category: 'legs', equipment: 'barbell', muscles: ['大臀筋', 'ハムストリングス'] },
  { id: 'calf-raise', name: 'カーフレイズ', category: 'legs', equipment: 'machine', muscles: ['ふくらはぎ'] },

  // 腹筋・体幹
  { id: 'crunch', name: 'クランチ', category: 'abs', equipment: 'bodyweight', muscles: ['腹直筋'] },
  { id: 'plank', name: 'プランク', category: 'abs', equipment: 'bodyweight', record: 'time', muscles: ['腹横筋', '腹直筋', '体幹'] },
  { id: 'ab-roller', name: 'アブローラー', category: 'abs', equipment: 'bodyweight', muscles: ['腹直筋', '体幹'] },
  { id: 'hanging-leg-raise', name: 'ハンギングレッグレイズ', category: 'abs', equipment: 'bodyweight', muscles: ['腹直筋(下部)', '腸腰筋'] },

  // 有酸素
  { id: 'treadmill-run', name: 'トレッドミル(ラン)', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '脚'] },
  { id: 'treadmill-walk', name: 'トレッドミル(ウォーク)', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '脚'] },
  { id: 'outdoor-run', name: 'ランニング(屋外)', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '脚'] },
  { id: 'bike', name: 'エアロバイク', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '脚'] },
  { id: 'cross-trainer', name: 'クロストレーナー', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '全身'] },
  { id: 'rowing-machine', name: 'ローイングマシン', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '背中', '脚'] },
  { id: 'stair-climber', name: 'ステアクライマー', category: 'cardio', equipment: 'cardio', record: 'cardio', muscles: ['心肺', '脚', 'お尻'] },
];

// 自分で作った種目(アプリを開いたときに読み込んでおく)
let customExercises = [];
export function setCustomExercises(list) {
  customExercises = list;
}

// 種目の一覧。消した自作種目は、記録を表示するときだけ使う
export function allExercises({ includeArchived = false } = {}) {
  return [...EXERCISES, ...customExercises.filter((e) => includeArchived || !e.archived)];
}

export function getExercise(id) {
  return EXERCISES.find((e) => e.id === id)
    ?? customExercises.find((e) => e.id === id)
    ?? { id, name: '(不明な種目)', category: 'other', equipment: 'machine' };
}

// 記録のしかた
export function recordType(exercise) {
  return exercise.record ?? (exercise.equipment === 'bodyweight' ? 'bodyweight' : 'weight');
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
  switch (recordType(exercise)) {
    case 'bodyweight': return '追加の重さ(なければ0)';
    default: return exercise.equipment === 'dumbbell' ? '重さ(ダンベル1個)' : '重さ';
  }
}
