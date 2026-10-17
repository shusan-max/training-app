// 今日のメニューを決めるルール
// 計算だけのファイル。画面のことは何も知らない。
// 第3段階でAIに置き換えるときは、このファイルの planToday() を差し替える。
import { benchSessions, benchProgress } from './progress.js';
import { getExercise, weightStep } from '../data/exercises.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BAR_KG = 20;

export const DAY_TYPES = {
  heavy: '重い日',
  volume: '量の日',
  light: '軽め',
  deload: '軽めの週',
  test: 'MAX挑戦',
};
// 「今日」の画面で自分で選べる種類
export const SELECTABLE_TYPES = ['heavy', 'volume', 'light', 'test'];

// ベンチプレスの重さの決め方(基準MAXに対する割合)
const RULES = {
  heavy: { pct: 0.90, min: 0.85, max: 0.95, reps: 2, sets: 3 },
  volume: { pct: 0.75, min: 0.70, max: 0.82, reps: 6, sets: 4 },
};
const BACKOFF = { pct: 0.80, reps: 5, sets: 3 }; // 重い日のあとの少し軽いセット
const LIGHT_FACTOR = 0.9;                          // 軽めの日・軽めの週は重さを10%下げる

// 補助種目:[種目, セット数, 回数の下限, 回数の上限]
const ACCESSORIES = {
  heavy: [
    ['incline-dumbbell-press', 3, 8, 10],
    ['dumbbell-row', 3, 8, 12],
    ['triceps-pushdown', 3, 10, 15],
  ],
  volume: [
    ['dumbbell-press', 3, 8, 12],
    ['lat-pulldown', 3, 8, 12],
    ['face-pull', 3, 12, 15],
    ['push-up', 2, 10, 20],
  ],
  test: [
    ['lat-pulldown', 2, 8, 12],
  ],
  // 肩・肘・手首・胸が痛い日(押す種目をやめて、引く種目だけ)
  painSafe: [
    ['lat-pulldown', 3, 8, 12],
    ['seated-row', 3, 8, 12],
  ],
};

// この部位が痛い日はベンチプレスをお休みにする
const BENCH_STOP_PAIN = ['shoulder', 'elbow', 'wrist', 'chest'];

// ===== 日付の道具 =====
function toDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}
// その週の月曜日
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const weeksBetween = (a, b) => Math.round((mondayOf(b) - mondayOf(a)) / (7 * DAY_MS));

// 刻み幅に合わせて切り下げる(バーより軽くはしない)
function roundDown(weight, step) {
  return Math.max(BAR_KG, Math.floor(weight / step + 1e-9) * step);
}
const kg = (n) => String(Number(n.toFixed(2)));

// ===== 今週の予定(テスト週・調整期間・軽めの週) =====
function weekInfo(settings, today) {
  const start = toDate(settings.benchBaseline.date ?? settings.createdAt.slice(0, 10));
  const goalDate = toDate(settings.goal.date);
  const weekIndex = weeksBetween(start, today);
  const goalWeek = weeksBetween(start, goalDate);
  const totalWeeks = goalWeek;
  const midWeek = totalWeeks >= 8 ? Math.round(totalWeeks / 2) : null;

  const isFinalTestWeek = weekIndex === goalWeek && today <= goalDate;
  const isMidTestWeek = midWeek !== null && weekIndex === midWeek;
  const isTaper = weekIndex >= goalWeek - 2 && weekIndex < goalWeek;
  const every = settings.training.deloadEveryWeeks;
  const isDeload = weekIndex > 0 && (weekIndex + 1) % every === 0
    && !isTaper && !isFinalTestWeek && !isMidTestWeek;

  return { weekIndex, isFinalTestWeek, isMidTestWeek, isTaper, isDeload };
}

// トレーニングの種類(記録に無ければ、1〜3回のセットがあれば重い日とみなす)
export function workoutKind(workout, benchSets) {
  if (workout.type) return workout.type;
  return benchSets.some((s) => !s.isWarmup && s.reps <= 3) ? 'heavy' : 'volume';
}

// ===== 前回の結果から重さを決める =====
// 予定どおり:予定のセット数を、予定の重さ・回数でこなし、最後のセットに余裕が1回以上あった
function judge(target, sets) {
  const done = sets.filter((s) => !s.isWarmup && s.weight >= target.weight - 1e-9 && s.reps >= target.reps);
  if (done.length < target.sets) return 'fail';
  const last = done[done.length - 1];
  return last.rir == null || last.rir >= 1 ? 'success' : 'fail';
}

function progressionWeight(type, base, step, history) {
  const rule = RULES[type];
  const label = DAY_TYPES[type];
  const low = roundDown(base * rule.min, step);
  const high = roundDown(base * rule.max, step);
  const reasons = [];
  let weight;

  const last = history[history.length - 1];
  if (!last) {
    weight = roundDown(base * rule.pct, step);
    reasons.push(`基準MAX ${base.toFixed(1)}kg の${Math.round(rule.pct * 100)}%から始めます`);
  } else {
    const results = history.slice(-2).map((h) => judge(h.plan.bench, h.sets));
    if (results[results.length - 1] === 'success') {
      weight = last.plan.bench.weight + step;
      reasons.push(`前回の${label}は予定どおりできたので +${kg(step)}kg`);
    } else if (results.length === 2 && results.every((r) => r === 'fail')) {
      weight = roundDown(last.plan.bench.weight * 0.95, step);
      reasons.push(`${label}で2回続けて予定に届かなかったので、5%下げてやり直します`);
    } else {
      weight = last.plan.bench.weight;
      reasons.push(`前回の${label}は予定に届かなかったので、同じ重さでもう一度`);
    }
  }
  if (weight > high) {
    weight = high;
    reasons.push(`重くなりすぎないよう、基準MAXの${Math.round(rule.max * 100)}%までにしています`);
  } else if (weight < low) {
    weight = low;
    reasons.push(`軽くなりすぎないよう、基準MAXの${Math.round(rule.min * 100)}%からにしています`);
  }
  return { weight, reasons };
}

// ウォームアップ(本番の重さより軽いものだけ)
function warmups(top, base, step, heavyScheme) {
  const ladder = heavyScheme
    ? [[0.4, 5], [0.6, 3], [0.75, 2], [0.85, 1]]
    : [[0.5, 5], [0.65, 3]];
  const list = [{ weight: BAR_KG, reps: 10 }];
  for (const [pct, reps] of ladder) {
    const weight = roundDown(base * pct, step);
    if (weight > list[list.length - 1].weight && weight < top) list.push({ weight, reps });
  }
  return list.filter((w) => w.weight < top);
}

// 補助種目の重さ:前回、上限の回数まで全セットできていたら少し重く
function accessoryPlan([exerciseId, sets, repsMin, repsMax], allSets, settings) {
  const exercise = getExercise(exerciseId);
  if (exercise.equipment === 'bodyweight') {
    return { exerciseId, sets, repsMin, repsMax, weight: 0, note: '自重で' };
  }
  const mine = allSets.filter((s) => s.exerciseId === exerciseId && !s.isWarmup);
  if (mine.length === 0) {
    return { exerciseId, sets, repsMin, repsMax, weight: null, note: '初めてなので、余裕のある重さから' };
  }
  const lastDate = mine[mine.length - 1].date;
  const last = mine.filter((s) => s.date === lastDate);
  const top = Math.max(...last.map((s) => s.weight));
  const atTop = last.filter((s) => s.weight === top);
  const step = weightStep(exercise, settings);
  if (atTop.length >= sets && atTop.every((s) => s.reps >= repsMax)) {
    return { exerciseId, sets, repsMin, repsMax, weight: top + step, note: `前回${repsMax}回できたので +${kg(step)}kg` };
  }
  return { exerciseId, sets, repsMin, repsMax, weight: top, note: '前回と同じ重さ' };
}

/**
 * 今日のメニューを作る
 * today: 今日の0時の Date / bodyLog: 今日の体の記録(無ければ null)
 * workouts, sets, plans: これまでの記録すべて / forceType: 自分で選んだ種類(無ければ null)
 */
export function planToday({ settings, today, bodyLog, workouts, sets, plans, forceType = null }) {
  const step = settings.training.plateStepKg;
  const reasons = [];
  const notes = [];

  // 基準MAX
  const benchSets = sets.filter((s) => s.exerciseId === 'bench-press');
  const progress = benchProgress(benchSessions(benchSets, settings.benchBaseline), settings.goal, today);
  const base = progress.baseMax;

  // 今週すでにやった練習
  const monday = mondayOf(today);
  const setsByWorkout = new Map();
  sets.forEach((s) => {
    if (!setsByWorkout.has(s.workoutId)) setsByWorkout.set(s.workoutId, []);
    setsByWorkout.get(s.workoutId).push(s);
  });
  const thisWeek = workouts.filter((w) => {
    const d = toDate(w.date);
    return d >= monday && d < today && setsByWorkout.has(w.id);
  });
  const kindsThisWeek = thisWeek.map((w) => workoutKind(w, (setsByWorkout.get(w.id) ?? []).filter((s) => s.exerciseId === 'bench-press')));

  // ----- 種類を決める -----
  const week = weekInfo(settings, today);
  let type;
  if (forceType) {
    type = forceType;
    reasons.push(`自分で「${DAY_TYPES[type]}」を選びました`);
  } else if ((week.isFinalTestWeek || week.isMidTestWeek) && !kindsThisWeek.includes('test')) {
    type = 'test';
    reasons.push(week.isFinalTestWeek ? '目標日の週なので、80kgに挑戦する日です' : '目標までの折り返しなので、今の実力を確かめる日です');
  } else if (week.isDeload) {
    type = 'deload';
    reasons.push(`${settings.training.deloadEveryWeeks}週に1回の軽めの週です。疲れを抜いて次に備えます`);
  } else if (!kindsThisWeek.includes('heavy') && !kindsThisWeek.includes('test')) {
    type = 'heavy';
    reasons.push(thisWeek.length === 0 ? '今週1回目なので、重い日です' : '今週はまだ重い日をしていないので、重い日です');
  } else {
    type = 'volume';
    reasons.push('今週は重い日が済んでいるので、量の日です');
  }

  // ----- 体調 -----
  const pain = bodyLog?.painAreas ?? [];
  const benchStop = pain.some((p) => BENCH_STOP_PAIN.includes(p));
  const tired = (bodyLog?.fatigue ?? 0) >= 4 || (bodyLog?.sleepHours != null && bodyLog.sleepHours < 5);
  if (tired && !forceType && type !== 'deload') {
    const why = bodyLog.fatigue >= 4 ? `疲労度が${bodyLog.fatigue}` : `睡眠が${bodyLog.sleepHours}時間`;
    reasons.push(`${why}なので、軽めのメニューにしました`);
    type = 'light';
  } else if (tired && forceType) {
    notes.push('体調の記録では疲れ気味です。無理せず、きつければ途中でやめましょう');
  }
  if (!bodyLog) notes.push('今日の体の記録(疲労度・睡眠・痛み)をつけると、体調に合わせて調整します');

  // ----- ベンチプレス -----
  let bench = null;
  let benchSteps = [];
  let accessoryKey = type === 'heavy' ? 'heavy' : type === 'test' ? 'test' : 'volume';
  let accessorySets = (n) => n;

  if (benchStop) {
    type = 'light';
    reasons.push('痛みのある部位があるので、ベンチプレスと押す種目はお休みです');
    notes.push('痛みが強い・続くときは、無理せず休み、医療機関に相談しましょう');
    accessoryKey = 'painSafe';
  } else if (base == null) {
    notes.push('ベンチプレスの記録がまだないので、重さは自分で決めてください');
  } else if (type === 'test') {
    const isFinal = week.isFinalTestWeek;
    const opener = roundDown(base * 0.92, step);
    const second = roundDown(base * 0.97, step);
    const third = isFinal
      ? Math.max(settings.goal.weight, second + step)
      : Math.max(second + step, (progress.bestActual ?? 0) + step);
    const attempts = [...new Set([opener, second, third])].sort((a, b) => a - b);
    bench = { weight: attempts[attempts.length - 1], reps: 1, sets: attempts.length, attempts, backoff: null };
    benchSteps = [
      ...warmups(opener, base, step, true).map((w) => ({ ...w, isWarmup: true, label: 'ウォームアップ' })),
      ...attempts.map((weight, i) => ({ weight, reps: 1, isWarmup: false, label: `${i + 1}本目` })),
    ];
    notes.push('1本ごとに3〜5分休みます。フォームが崩れたら、そこで終わりにしましょう');
  } else {
    // 重い日・量の日の進め方を基準にして、軽めの日・軽めの週は割り引く
    const baseType = type === 'heavy' ? 'heavy' : 'volume';
    const history = plans
      .filter((p) => p.type === baseType && p.bench && p.workoutId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map((p) => ({ plan: p, sets: (setsByWorkout.get(p.workoutId) ?? []).filter((s) => s.exerciseId === 'bench-press') }))
      .filter((h) => h.sets.length > 0);
    const rule = RULES[baseType];
    const decided = progressionWeight(baseType, base, step, history);
    let weight = decided.weight;
    let setsCount = rule.sets;
    let backoff = type === 'heavy'
      ? { weight: roundDown(base * BACKOFF.pct, step), reps: BACKOFF.reps, sets: BACKOFF.sets }
      : null;

    if (type === 'heavy' || type === 'volume') {
      reasons.push(...decided.reasons);
    }
    if (type === 'light') {
      weight = roundDown(weight * LIGHT_FACTOR, step);
      setsCount = Math.max(2, setsCount - 1);
      accessorySets = (n) => Math.max(2, n - 1);
    }
    if (type === 'deload') {
      weight = roundDown(weight * LIGHT_FACTOR, step);
      setsCount = 2;
      accessorySets = () => 2;
    }
    if (week.isTaper && (type === 'heavy' || type === 'volume')) {
      setsCount -= 1;
      if (backoff) backoff = { ...backoff, sets: 2 };
      accessorySets = () => 2;
      reasons.push('目標日前の調整期間なので、量を少し減らしています');
    }

    bench = { weight, reps: rule.reps, sets: setsCount, attempts: null, backoff };
    benchSteps = [
      ...warmups(weight, base, step, type === 'heavy').map((w) => ({ ...w, isWarmup: true, label: 'ウォームアップ' })),
      ...Array.from({ length: setsCount }, () => ({ weight, reps: rule.reps, isWarmup: false, label: '本番' })),
      ...(backoff ? Array.from({ length: backoff.sets }, () => ({ weight: backoff.weight, reps: backoff.reps, isWarmup: false, label: '追加' })) : []),
    ];
  }

  // ----- 補助種目 -----
  const accessories = ACCESSORIES[accessoryKey].map(([id, n, min, max]) => accessoryPlan([id, accessorySets(n), min, max], sets, settings));

  const otherPain = pain.filter((p) => !BENCH_STOP_PAIN.includes(p));
  if (otherPain.length) notes.push('痛みのある部位に負担がかかる種目は、やめるか軽くしましょう');

  const steps = [
    ...benchSteps.map((s) => ({ exerciseId: 'bench-press', ...s })),
    ...accessories.flatMap((a) => Array.from({ length: a.sets }, () => ({
      exerciseId: a.exerciseId, weight: a.weight, reps: a.repsMax, isWarmup: false, label: '本番',
    }))),
  ];

  return {
    type,
    typeLabel: DAY_TYPES[type],
    base,
    reasons,
    notes,
    safety: bench != null && (type === 'heavy' || type === 'test'),
    bench,
    accessories,
    steps,
    exerciseIds: [...(bench ? ['bench-press'] : []), ...accessories.map((a) => a.exerciseId)],
  };
}

// 予定のセットを「20kg×10回 → 30kg×5回」「67.5kg×2回 ×3セット」の形にする
export function describeSteps(steps) {
  const groups = [];
  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (last && last.label === step.label && last.weight === step.weight && last.reps === step.reps) {
      last.count += 1;
    } else {
      groups.push({ ...step, count: 1 });
    }
  }
  return groups;
}
