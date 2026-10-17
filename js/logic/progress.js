// ベンチプレスの目標に対する進み具合の計算
// 計算だけのファイル。画面のことは何も知らない。
import { bestEstimate } from './e1rm.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RECENT_DAYS = 21;          // 「最近の推定MAX」を見る期間(3週間)
export const FORECAST_WINDOW_DAYS = 56; // 伸び方を見る期間(8週間)
export const MIN_FORECAST_POINTS = 4;   // 判定に必要な記録の数
export const CLOSE_MARGIN_KG = 2;       // 予想が目標より2kg以内なら「ぎりぎり」

function toDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * ベンチプレスのセットを日ごとにまとめる。
 * 初回設定の記録(baseline)も1日分として入れる。
 * 返す値:[{ date, estimate(その日の推定MAX), actual(その日に挙げた一番重い重さ) }] 古い順
 */
export function benchSessions(benchSets, baseline) {
  const byDate = new Map();
  const add = (dateText, set) => {
    if (!byDate.has(dateText)) byDate.set(dateText, []);
    byDate.get(dateText).push(set);
  };
  benchSets.forEach((set) => add(set.date, set));
  baseline?.records?.forEach((record) => add(baseline.date, { ...record, isWarmup: false }));

  return [...byDate.entries()]
    .map(([dateText, sets]) => {
      const work = sets.filter((s) => !s.isWarmup && s.reps >= 1);
      return {
        date: toDate(dateText),
        estimate: bestEstimate(sets)?.value ?? null,
        actual: work.length ? Math.max(...work.map((s) => s.weight)) : null,
      };
    })
    .sort((a, b) => a.date - b.date);
}

// メニューや必要なペースの基準にする重さ(基準MAX)
// 推定MAXは実際より高く出やすいので、「推定MAX」と「実際の最高 + 2.5kg」の低いほうを使う
export const BASE_MAX_MARGIN_KG = 2.5;
export function baseMax(currentEstimate, bestActual) {
  if (currentEstimate == null) return bestActual;
  if (bestActual == null) return currentEstimate;
  return Math.min(currentEstimate, bestActual + BASE_MAX_MARGIN_KG);
}

/**
 * 目標に対する進み具合
 * goal: { weight, date }  today: 今日の0時の Date
 */
export function benchProgress(sessions, goal, today) {
  const actuals = sessions.filter((s) => s.actual != null);
  const start = actuals[0]?.actual ?? null;
  const bestActual = actuals.length ? Math.max(...actuals.map((s) => s.actual)) : null;

  // 最近3週間で一番高い推定MAX(無ければ一番新しい推定MAX)
  const withEstimate = sessions.filter((s) => s.estimate != null);
  const recent = withEstimate.filter((s) => s.date >= new Date(today.getTime() - RECENT_DAYS * DAY_MS));
  const currentEstimate = recent.length
    ? Math.max(...recent.map((s) => s.estimate))
    : withEstimate[withEstimate.length - 1]?.estimate ?? null;

  const remaining = bestActual != null ? Math.max(0, goal.weight - bestActual) : null;

  // 達成率:スタートの重さから目標までのうち、どこまで進んだか
  let rate = null;
  if (bestActual != null) {
    if (bestActual >= goal.weight) {
      rate = 1;
    } else if (goal.weight > start) {
      rate = Math.min(1, Math.max(0, (bestActual - start) / (goal.weight - start)));
    } else {
      rate = 0;
    }
  }

  const base = baseMax(currentEstimate, bestActual);

  return {
    start,
    bestActual,
    currentEstimate,
    baseMax: base,
    remaining,
    rate,
    forecast: forecast(withEstimate, goal, today, base),
  };
}

// 最近8週間の推定MAXに直線を引き、目標日の値を予想する
function forecast(sessions, goal, today, base) {
  const goalDate = toDate(goal.date);
  const daysLeft = (goalDate - today) / DAY_MS;
  if (daysLeft < 0) return { status: 'past' };

  const weeksLeft = daysLeft / 7;
  const neededPerWeek = base != null && weeksLeft > 0
    ? (goal.weight - base) / weeksLeft
    : null;

  const windowStart = new Date(today.getTime() - FORECAST_WINDOW_DAYS * DAY_MS);
  const points = sessions.filter((s) => s.date >= windowStart);
  if (points.length < MIN_FORECAST_POINTS) {
    return { status: 'not-enough', count: points.length, weeksLeft, neededPerWeek, base };
  }

  // 一番よく当てはまる直線(最小二乗法)
  const x0 = points[0].date.getTime();
  const xs = points.map((p) => (p.date.getTime() - x0) / DAY_MS);
  const ys = points.map((p) => p.estimate);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  xs.forEach((x, i) => {
    numerator += (x - mx) * (ys[i] - my);
    denominator += (x - mx) ** 2;
  });
  const slope = denominator === 0 ? 0 : numerator / denominator; // 1日あたりの伸び
  const valueAt = (date) => my + slope * ((date.getTime() - x0) / DAY_MS - mx);

  const predicted = valueAt(goalDate);
  let status = 'behind';
  if (predicted >= goal.weight) status = 'on-track';
  else if (predicted >= goal.weight - CLOSE_MARGIN_KG) status = 'close';

  return {
    status,
    predicted,
    perWeek: slope * 7,
    neededPerWeek,
    weeksLeft,
    base,
    projection: [
      { date: points[0].date, value: valueAt(points[0].date) },
      { date: goalDate, value: predicted },
    ],
  };
}
