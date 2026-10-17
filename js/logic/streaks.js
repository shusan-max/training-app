// 継続と積み重ねの計算(連続週数・連続日数・累計・自己ベストの年表)
// 計算だけのファイル。画面のことは何も知らない。
import { workoutKind } from './planner.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// 記念になる累計回数
const SESSION_MILESTONES = [1, 10, 25, 50, 100, 150, 200, 300];

/**
 * workouts, sets, bodyLogs: これまでの記録すべて(古い順)
 * baseline: 初回設定のベンチプレスの記録 / today: 今日の0時の Date
 */
export function summarizeHistory({ workouts, sets, bodyLogs, baseline, today }) {
  const setsByWorkout = new Map();
  sets.forEach((s) => {
    if (!setsByWorkout.has(s.workoutId)) setsByWorkout.set(s.workoutId, []);
    setsByWorkout.get(s.workoutId).push(s);
  });
  // セットが1つ以上あるトレーニングだけを数える
  const sessions = workouts
    .filter((w) => setsByWorkout.has(w.id))
    .map((w) => {
      const own = setsByWorkout.get(w.id);
      return { workout: w, date: w.date, kind: workoutKind(w, own.filter((s) => s.exerciseId === 'bench-press')) };
    });

  // ----- カレンダー用:日付ごとの種類 -----
  const days = new Map();
  sessions.forEach((s) => {
    // 同じ日に2回あれば、重い日・MAX挑戦を優先して表示
    const prev = days.get(s.date);
    const strong = (k) => k === 'heavy' || k === 'test';
    if (!prev || (strong(s.kind) && !strong(prev))) days.set(s.date, s.kind);
  });

  // ----- 週ごとの回数と、連続週数(週1回以上) -----
  const perWeek = new Map();
  sessions.forEach((s) => {
    const key = toText(mondayOf(toDate(s.date)));
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  });
  let weekStreak = 0;
  let week = mondayOf(today);
  // 今週まだ練習していなくても、今週はこれからなので連続は切らさない
  if (!perWeek.has(toText(week))) week = new Date(week.getTime() - 7 * DAY_MS);
  while (perWeek.has(toText(week))) {
    weekStreak += 1;
    week = new Date(week.getTime() - 7 * DAY_MS);
  }
  const thisWeekCount = perWeek.get(toText(mondayOf(today))) ?? 0;
  const twiceWeeks = [...perWeek.values()].filter((n) => n >= 2).length;

  // ----- 体の記録の連続日数 -----
  const logDates = new Set(bodyLogs.map((l) => l.date));
  let bodyStreak = 0;
  let day = new Date(today);
  if (!logDates.has(toText(day))) day = new Date(day.getTime() - DAY_MS); // 今日はまだでもOK
  while (logDates.has(toText(day))) {
    bodyStreak += 1;
    day = new Date(day.getTime() - DAY_MS);
  }

  // ----- 累計 -----
  const counted = sets.filter((s) => !s.isWarmup && setsByWorkout.has(s.workoutId));
  const totalSets = counted.length;
  const totalVolume = counted.reduce((sum, s) => sum + s.weight * s.reps, 0);

  // ----- 自己ベストの年表 -----
  const timeline = [];
  let best = 0;
  if (baseline?.records?.length) {
    best = Math.max(...baseline.records.map((r) => r.weight));
    timeline.push({ date: baseline.date, text: `記録スタート(ベンチプレス ${fmt(best)}kg)`, kind: 'start' });
  }
  sets
    .filter((s) => s.exerciseId === 'bench-press' && !s.isWarmup && s.reps >= 1)
    .forEach((s) => {
      if (s.weight > best) {
        best = s.weight;
        timeline.push({ date: s.date, text: `ベンチプレス ${fmt(s.weight)}kg を初めて挙げた(${s.reps}回)`, kind: 'pr' });
      }
    });
  sessions.forEach((s, i) => {
    const n = i + 1;
    if (SESSION_MILESTONES.includes(n)) {
      timeline.push({ date: s.date, text: n === 1 ? '最初のトレーニング' : `${n}回目のトレーニング`, kind: 'milestone' });
    }
  });
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    weekStreak,
    thisWeekCount,
    twiceWeeks,
    bodyStreak,
    totalSessions: sessions.length,
    totalSets,
    totalVolume,
    timeline,
  };
}

function fmt(n) {
  return String(Number(n.toFixed(2)));
}
