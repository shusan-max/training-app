// 「進捗」画面
import { placeholderCard, todayString, parseDateString } from '../ui.js';
import { getAllBodyLogs, latestValue } from '../body-data.js';
import { createLineChart } from '../chart.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// グラフの期間(名前, ボタンの文字, 日数)
const PERIODS = [
  ['1m', '1か月', 30],
  ['3m', '3か月', 90],
  ['all', '全部', null],
];
let selectedPeriod = '3m'; // 前に選んだ期間を覚えておく

// グラフにする項目
const METRICS = [
  { field: 'weightKg', label: '体重', unit: 'kg' },
  { field: 'bodyFatPct', label: '体脂肪率', unit: '%' },
];

function formatChange(diff, unit) {
  if (Math.abs(diff) < 0.05) return `±0${unit}`;
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}${unit}`;
}

export default {
  title: '進捗',
  async render(container) {
    const logs = await getAllBodyLogs();

    const periodButtons = PERIODS.map(([key, label]) => `
      <button type="button" data-period="${key}" aria-pressed="${key === selectedPeriod}">${label}</button>
    `).join('');

    const metricBlocks = METRICS.map(({ field, label }) => `
      <div class="metric" data-field="${field}">
        <div class="metric-head">
          <span class="metric-label">${label}</span>
          <span class="metric-value"></span>
        </div>
        <p class="sub metric-change"></p>
        <div class="chart-host"></div>
      </div>
    `).join('');

    container.innerHTML = `
      ${placeholderCard('ベンチプレス80kgへの進捗', '⑥', [
        '推定MAXと実際の最高重量のグラフ',
        '80kgまでの残りと達成率',
        '3月31日に間に合いそうかの判定',
        '体重の何倍を挙げたか',
      ])}
      <section class="card">
        <h2>体の変化</h2>
        <div class="period-tabs">${periodButtons}</div>
        ${metricBlocks}
      </section>
    `;

    function draw() {
      const [, periodLabel, days] = PERIODS.find(([key]) => key === selectedPeriod);
      const today = parseDateString(todayString());
      const start = days ? new Date(today.getTime() - days * DAY_MS) : null;

      for (const { field, label, unit } of METRICS) {
        const block = container.querySelector(`.metric[data-field="${field}"]`);
        const latest = latestValue(logs, field);
        block.querySelector('.metric-value').textContent = latest != null ? `${latest.toFixed(1)}${unit}` : '—';

        const points = logs
          .filter((log) => log[field] != null)
          .map((log) => ({ date: parseDateString(log.date), value: log[field] }))
          .filter((p) => !start || p.date >= start);

        const changeText = block.querySelector('.metric-change');
        const host = block.querySelector('.chart-host');
        if (points.length < 2) {
          changeText.textContent = '';
          host.innerHTML = `<p class="sub chart-empty">${label}を2日分以上記録するとグラフが出ます</p>`;
          continue;
        }
        const diff = points[points.length - 1].value - points[0].value;
        const span = days ? `この${periodLabel}` : '記録を始めてから';
        changeText.textContent = `${span}で ${formatChange(diff, unit)}`;
        createLineChart(host, {
          points,
          unit,
          label,
          xMin: start ?? points[0].date,
          xMax: today,
        });
      }
    }

    container.querySelector('.period-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      selectedPeriod = button.dataset.period;
      container.querySelectorAll('.period-tabs button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === button));
      });
      draw();
    });

    draw();
  },
};
