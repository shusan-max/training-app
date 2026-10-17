// 折れ線グラフを作る部品。
// 1つのグラフには線を1本だけ描く(単位の違う値は、別々のグラフにする)。
// 画面を指でなぞると、その日の値が出る。

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 180;
const PAD = { top: 26, right: 18, bottom: 26, left: 40 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MARKER_LIMIT = 20; // 点がこれより少なければ、すべての点に印をつける

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

/**
 * host: グラフを入れる場所(div)
 * points: [{ date: Date, value: 数 }] 日付の古い順
 * xMin, xMax: 横軸の始まりと終わり(Date)
 */
export function createLineChart(host, { points, unit, label, xMin, xMax, decimals = 1 }) {
  host.replaceChildren();
  host.classList.add('chart');

  const width = Math.max(260, host.clientWidth);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  // 縦軸の範囲:値の上下に少し余白をとり、きりのいい数にそろえる
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.2, 0.5);
  const step = niceStep(hi - lo + margin * 2);
  const yMin = Math.floor((lo - margin) / step) * step;
  const yMax = Math.ceil((hi + margin) / step) * step;
  const tickDecimals = step < 1 ? 1 : 0;

  const x0 = xMin.getTime();
  const x1 = Math.max(xMax.getTime(), x0 + DAY_MS);
  const xOf = (date) => PAD.left + ((date.getTime() - x0) / (x1 - x0)) * plotW;
  const yOf = (value) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;

  const latest = points[points.length - 1];
  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${HEIGHT}`,
    width,
    height: HEIGHT,
    role: 'img',
    'aria-label': `${label}のグラフ。最新は${latest.value.toFixed(decimals)}${unit}`,
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

  // 線
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
  svg.append(svgEl('path', { d, class: 'chart-line' }));

  // 点の印(点が多いときは最新の点だけ)
  const marked = points.length <= MARKER_LIMIT ? points : [latest];
  marked.forEach((p) => {
    svg.append(svgEl('circle', { cx: xOf(p.date), cy: yOf(p.value), r: 4, class: 'chart-dot' }));
  });

  // 指でなぞったときの縦線と印
  const cross = svgEl('line', { y1: PAD.top, y2: PAD.top + plotH, class: 'chart-cross', visibility: 'hidden' });
  const focus = svgEl('circle', { r: 5, class: 'chart-dot', visibility: 'hidden' });
  svg.append(cross, focus);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;

  function showAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    // 指の位置に一番近い点を探す
    let nearest = points[0];
    for (const p of points) {
      if (Math.abs(xOf(p.date) - x) < Math.abs(xOf(nearest.date) - x)) nearest = p;
    }
    const px = xOf(nearest.date);
    const py = yOf(nearest.value);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    focus.setAttribute('cx', px);
    focus.setAttribute('cy', py);
    cross.setAttribute('visibility', 'visible');
    focus.setAttribute('visibility', 'visible');

    tooltip.innerHTML = `<span>${longDate(nearest.date)}</span><strong>${nearest.value.toFixed(decimals)}${unit}</strong>`;
    tooltip.hidden = false;
    const left = (px / width) * rect.width;
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.min(rect.width - half, Math.max(half, left))}px`;
  }

  function hide() {
    cross.setAttribute('visibility', 'hidden');
    focus.setAttribute('visibility', 'hidden');
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
  return { hide };
}
