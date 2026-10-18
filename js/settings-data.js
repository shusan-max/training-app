// 設定(目標・自分の情報・トレーニングの設定)の読み書き
import { get, put } from './db.js';
import { todayString } from './ui.js';

const SETTINGS_ID = 'main';

// 初めて使うときの設定
export function defaultSettings() {
  const now = new Date().toISOString();
  return {
    id: SETTINGS_ID,
    goal: {
      exercise: 'bench-press',
      weight: 80,
      date: '2027-03-31',
    },
    // 初回設定で入力した「今のベンチプレス」の記録
    benchBaseline: {
      date: todayString(),
      records: [], // { weight, reps } の並び
    },
    profile: {
      heightCm: null,
      bodyWeightKg: null,
      bodyFatPct: null,
      frequency: '1-2',
      sessionMinutes: 60,
      place: '',
      experienceYears: null,
      injuries: '',
    },
    training: {
      plateStepKg: 2.5,    // 重量の刻み幅(両側の合計)
      restSeconds: 180,    // 休憩時間の初期値
      deloadEveryWeeks: 5, // 軽めの週を入れる間隔
      weeklyGoalMinutes: null, // 今週の目標の時間(null なら頻度から決める)
    },
    backup: {
      lastBackupAt: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// 設定を読む。まだ初回設定をしていなければ undefined が返る
export function loadSettings() {
  return get('settings', SETTINGS_ID);
}

export function saveSettings(settings) {
  return put('settings', { ...settings, updatedAt: new Date().toISOString() });
}

// 入力フォームの値を設定に反映した、新しい設定を返す
export function applyProfileValues(settings, values) {
  return {
    ...settings,
    goal: { ...settings.goal, ...values.goal },
    benchBaseline: { ...settings.benchBaseline, records: values.benchRecords },
    profile: { ...settings.profile, ...values.profile },
  };
}

// 今週の目標(分)。決めていなければ「頻度 × 1回の時間」
export function weeklyGoalMinutes(settings) {
  if (settings.training.weeklyGoalMinutes) return settings.training.weeklyGoalMinutes;
  const perWeek = { 1: 1, '1-2': 2, 2: 2, 3: 3 }[settings.profile.frequency] ?? 2;
  return perWeek * (settings.profile.sessionMinutes || 60);
}

export const FREQUENCY_OPTIONS = [
  ['1', '週1回'],
  ['1-2', '週1〜2回'],
  ['2', '週2回'],
  ['3', '週3回以上'],
];

export function frequencyLabel(value) {
  return FREQUENCY_OPTIONS.find(([v]) => v === value)?.[1] ?? '-';
}
