// 体の記録の読み書き
import { get, getAll, put, remove } from './db.js';

// 痛む部位の選択肢(保存する名前, 画面に出す名前)
export const PAIN_AREAS = [
  ['neck', '首'],
  ['shoulder', '肩'],
  ['elbow', '肘'],
  ['wrist', '手首'],
  ['chest', '胸'],
  ['back', '背中'],
  ['lowerBack', '腰'],
  ['knee', '膝'],
  ['other', 'その他'],
];

// 疲労度(1〜5)の説明
export const FATIGUE_LABELS = {
  1: '元気',
  2: 'やや元気',
  3: 'ふつう',
  4: 'やや疲れ',
  5: '疲れた',
};

export function getBodyLog(date) {
  return get('bodyLogs', date);
}

// 全部の記録を、日付の古い順で返す
export async function getAllBodyLogs() {
  const logs = await getAll('bodyLogs');
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}

export function saveBodyLog(log) {
  return put('bodyLogs', { ...log, updatedAt: new Date().toISOString() });
}

export function deleteBodyLog(date) {
  return remove('bodyLogs', date);
}

// 記録の中から、その項目が入っている一番新しい値を探す(古い順の並びを渡す)
export function latestValue(logs, field) {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (logs[i][field] != null) return logs[i][field];
  }
  return null;
}

export function painAreaLabels(keys) {
  return PAIN_AREAS.filter(([key]) => keys.includes(key)).map(([, label]) => label);
}

// 一覧などに出す短い説明(例:['体重 58.2kg', '睡眠 7時間'])
export function summarizeBodyLog(log) {
  const parts = [];
  if (log.weightKg != null) parts.push(`体重 ${log.weightKg.toFixed(1)}kg`);
  if (log.bodyFatPct != null) parts.push(`体脂肪 ${log.bodyFatPct.toFixed(1)}%`);
  if (log.sleepHours != null) parts.push(`睡眠 ${log.sleepHours}時間`);
  if (log.fatigue != null) parts.push(`疲労 ${log.fatigue}(${FATIGUE_LABELS[log.fatigue]})`);
  if (log.painAreas?.length) parts.push(`痛み:${painAreaLabels(log.painAreas).join('・')}`);
  if (log.memo) parts.push('メモあり');
  return parts;
}
