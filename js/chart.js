// 折れ線グラフを作る部品。
// 同じ単位の線だけを1つのグラフに描く(単位の違う値は、別々のグラフにする)。
// 画面を指でなぞると、その日の値が出る。

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 190;
const PAD = { top: 26, right: 18, bottom: 26, left: 40 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MARKER_MIN_GAP = 14; // 点と点がこれ(px)以上離れていれば、すべての点に印をつける

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

// 目盛りの間隔を、きりのいい数(0.1, 0.2, 0.5, 1, 2, 5 …)から選ぶ
function niceStep(span) {
  const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  return candidates.find((step) => span / step <= 4) ?? 100;
}

const shortDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
const longDate = (date) => new Intl.DateTimeFormat('ja-JP', {
  month: 'long', day: 'numeric', weekday: 'short',
}).format(date);

// 線の種類ごとの見た目(css の .chart-line, .chart-line.alt などと対応)
const VARIANT_CLASS = {
  main: '',          // 実線(オレンジ)
  alt: ' alt',       // 点線(青)
  projection: ' projection', // 予想の線(灰色の細い点線)
};

/**
 * host: グラフを入れる場所(div)
 * series: [{ label, points: [{ date, value }], variant: 'main' | 'alt' | 'projection' }]
 * references: [{ label, value }] 目標などの横線
 * xMin, xMax: 横軸の始まりと終わり(Date)
 */
export function createLineChart(host, {
  series, unit, label, xMin, xMax, references = [], decimals = 1,
}) {
  host.replaceChildren();
  host.classList.add('chart');

  const width = Math.max(260, host.clientWidth);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  // 縦軸の範囲:値と目標線が入るように、上下に少し余白をとって、きりのいい数にそろえる
  // (予想の線は範囲に入れず、はみ出した分は切る)
  const values = [
    ...series.filter((s) => s.variant !== 'projection').flatMap((s) => s.points.map((p) => p.value)),
    ...references.map((r) => r.value),
  ];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.15, 0.5);
  const step = niceStep(hi - lo + margin * 2);
  const yMin = Math.floor((lo - margin) / step) * step;
  const yMax = Math.ceil((hi + margin) / step) * step;
  const tickDecimals = step < 1 ? 1 : 0;

  const x0 = xMin.getTime();
  const x1 = Math.max(xMax.getTime(), x0 + DAY_MS);
  const xOf = (date) => PAD.left + ((date.getTime() - x0) / (x1 - x0)) * plotW;
  const yOf = (value) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${HEIGHT}`,
    width,
    height: HEIGHT,
    role: 'img',
    'aria-label': `${label}のグラフ`,
  });

  // 横線と縦軸の数字
  for (let v = yMin; v <= yMax + step / 2; v += step) {
    const y = yOf(v);
    svg.append(svgEl('line', { x1: PAD.left, x2: width - PAD.right, y1: y, y2: y, class: 'chart-grid' }));
    const text = svgEl('text', { x: PAD.left - 6, y: y + 4, class: 'chart-axis', 'text-anchor': 'end' });
    text.textContent = v.toFixed(tickDecimals);
    svg.append(text);
  }

  // 横軸の日付(始まりと終わり)
  [[xMin, 'start', PAD.left], [xMax, 'end', width - PAD.right]].forEach(([date, anchor, x]) => {
    const text = svgEl('text', { x, y: HEIGHT - 6, class: 'chart-axis', 'text-anchor': anchor });
    text.textContent = shortDate(date);
    svg.append(text);
  });

  // 目標などの横線
  references.forEach((ref) => {
    const y = yOf(ref.value);
    svg.append(svgEl('line', { x1: PAD.left, x2: width - PAD.right, y1: y, y2: y, class: 'chart-ref' }));
    const text = svgEl('text', { x: width - PAD.right, y: y - 5, class: 'chart-ref-label', 'text-anchor': 'end' });
    text.textContent = ref.label;
    svg.append(text);
  });

  // グラフの枠からはみ出した部分を切るための形
  const clipId = `clip-${Math.random().toString(36).slice(2)}`;
  const clip = svgEl('clipPath', { id: clipId });
  clip.append(svgEl('rect', { x: PAD.left, y: PAD.top, width: plotW, height: plotH }));
  svg.append(clip);

  // 線と点
  series.forEach((s) => {
    const variant = VARIANT_CLASS[s.variant ?? 'main'];
    if (s.points.length >= 2) {
      const d = s.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`)
        .join(' ');
      svg.append(svgEl('path', { d, class: `chart-line${variant}`, 'clip-path': `url(#${clipId})` }));
    }
    if (s.variant === 'projection') return;
    // 点が混み合っていると線が隠れるので、そのときは最新の点だけに印をつける
    const xs = s.points.map((p) => xOf(p.date));
    const roomy = xs.every((x, i) => i === 0 || x - xs[i - 1] >= MARKER_MIN_GAP);
    const marked = roomy ? s.points : s.points.slice(-1);
    marked.forEach((p) => {
      svg.append(svgEl('circle', { cx: xOf(p.date), cy: yOf(p.value), r: 4, class: `chart-dot${variant}` }));
    });
  });

  // 指でなぞったときの縦線と印
  const tipSeries = series.filter((s) => s.variant !== 'projection');
  const cross = svgEl('line', { y1: PAD.top, y2: PAD.top + plotH, class: 'chart-cross', visibility: 'hidden' });
  svg.append(cross);
  const focusDots = tipSeries.map((s) => {
    const dot = svgEl('circle', { r: 5, class: `chart-dot${VARIANT_CLASS[s.variant ?? 'main']}`, visibility: 'hidden' });
    svg.append(dot);
    return dot;
  });

  const tipDates = [...new Set(tipSeries.flatMap((s) => s.points.map((p) => p.date.getTime())))];

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;

  function showAt(clientX) {
    if (tipDates.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    // 指の位置に一番近い日を探す
    let nearest = tipDates[0];
    for (const t of tipDates) {
      if (Math.abs(xOf(new Date(t)) - x) < Math.abs(xOf(new Date(nearest)) - x)) nearest = t;
    }
    const px = xOf(new Date(nearest));
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('visibility', 'visible');

    const lines = [];
    tipSeries.forEach((s, i) => {
      const point = s.points.find((p) => p.date.getTime() === nearest);
      const dot = focusDots[i];
      if (!point) {
        dot.setAttribute('visibility', 'hidden');
        return;
      }
      dot.setAttribute('cx', px);
      dot.setAttribute('cy', yOf(point.value));
      dot.setAttribute('visibility', 'visible');
      const value = `${point.value.toFixed(decimals)}${unit}`;
      lines.push(tipSeries.length > 1 ? `<span>${s.label} <strong>${value}</strong></span>` : `<strong>${value}</strong>`);
    });

    tooltip.innerHTML = `<span>${longDate(new Date(nearest))}</span>${lines.join('')}`;
    tooltip.hidden = false;
    const left = (px / width) * rect.width;
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.min(rect.width - half, Math.max(half, left))}px`;
  }

  function hide() {
    cross.setAttribute('visibility', 'hidden');
    focusDots.forEach((dot) => dot.setAttribute('visibility', 'hidden'));
    tooltip.hidden = true;
  }

  svg.addEventListener('pointerdown', (e) => showAt(e.clientX));
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons > 0) showAt(e.clientX);
  });
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hide();
  });

  host.append(svg, tooltip);

  // 線が2本以上・目標線があるときは、何の線かの説明(凡例)をつける
  if (series.length > 1 || references.length) {
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    const item = (cls, text) => `
      <span class="legend-item">
        <svg viewBox="0 0 24 10" aria-hidden="true"><line x1="1" x2="23" y1="5" y2="5" class="${cls}"/></svg>${text}
      </span>
    `;
    legend.innerHTML = [
      ...series.map((s) => item(`chart-line${VARIANT_CLASS[s.variant ?? 'main']}`, s.label)),
      ...references.map((r) => item('chart-ref', r.label)),
    ].join('');
    host.append(legend);
  }

  return { hide };
}
