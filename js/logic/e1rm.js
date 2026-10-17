// 推定MAX(1回だけ挙げられる重さ)の計算
// 計算だけのファイル。画面のことは何も知らない。

// これより多い回数のセットは、推定がずれやすいので使わない
export const MAX_REPS_FOR_ESTIMATE = 10;

/**
 * 1つのセットから推定MAXを計算する。使えないセットなら null。
 * rir:「あと何回できたか」(3は「3回以上」の意味。計算では3として扱う)
 */
export function estimate1RM({ weight, reps, rir }) {
  if (!(weight > 0) || !(reps >= 1) || reps > MAX_REPS_FOR_ESTIMATE) return null;
  const extra = rir ?? 0;
  const usedReps = reps + extra; // 余裕があった分を回数に足す
  if (usedReps === 1) {
    return { value: weight, method: 'actual', weight, reps, extra, usedReps };
  }
  const epley = weight * (1 + usedReps / 30);
  const brzycki = (weight * 36) / (37 - usedReps);
  return {
    value: (epley + brzycki) / 2,
    method: 'formula',
    epley,
    brzycki,
    weight,
    reps,
    extra,
    usedReps,
  };
}

// いくつかのセットの中で一番高い推定MAX(ウォームアップは使わない)
export function bestEstimate(sets) {
  let best = null;
  for (const set of sets) {
    if (set.isWarmup) continue;
    const estimate = estimate1RM(set);
    if (estimate && (!best || estimate.value > best.value)) best = estimate;
  }
  return best;
}

// どう計算したかの説明文
export function describeEstimate(estimate) {
  const kg = (n) => Number(n.toFixed(2));
  const base = `${kg(estimate.weight)}kg×${estimate.reps}回`;
  if (estimate.method === 'actual') return `${base}で実際に挙げた重さ`;
  const extra = estimate.extra
    ? `(余裕${estimate.extra}回を足して${estimate.usedReps}回として計算)`
    : '';
  return `${base}${extra}から、Epley式 ${estimate.epley.toFixed(1)}kg と Brzycki式 ${estimate.brzycki.toFixed(1)}kg の平均`;
}
