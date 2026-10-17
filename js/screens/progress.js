// 「進捗」画面
import { todayString, parseDateString, formatKg, formatFullDateJa } from '../ui.js';
import { getAllBodyLogs, latestValue } from '../body-data.js';
import { getAllSets } from '../workout-data.js';
import { benchSessions, benchProgress, MIN_FORECAST_POINTS } from '../logic/progress.js';
import { createLineChart } from '../chart.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// 体の変化のグラフの期間(名前, ボタンの文字, 日数)
const PERIODS = [
  ['1m', '1か月', 30],
  ['3m', '3か月', 90],
  ['all', '全部', null],
];
let selectedPeriod = '3m'; // 前に選んだ期間を覚えておく

// 体の変化でグラフにする項目
const METRICS = [
  { field: 'weightKg', label: '体重', unit: 'kg' },
  { field: 'bodyFatPct', label: '体脂肪率', unit: '%' },
];

const signed = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`;

function formatChange(diff, unit) {
  if (Math.abs(diff) < 0.05) return `±0${unit}`;
  return `${signed(diff)}${unit}`;
}

// 「間に合いそうか」の表示
const FORECAST_TEXT = {
  'on-track': ['✅', '間に合いそう'],
  close: ['⚠️', 'ぎりぎり'],
  behind: ['❌', '今のペースでは届かない'],
};

function forecastHtml(forecast, goal) {
  if (forecast.status === 'past') {
    return '<div class="forecast"><p>目標日を過ぎました。設定で新しい目標日を決めましょう。</p></div>';
  }
  const needed = forecast.neededPerWeek != null
    ? `<p class="sub">目標までに必要なペース:<strong>${signed(Math.max(0, forecast.neededPerWeek))}kg/週</strong>(あと${Math.ceil(forecast.weeksLeft)}週・基準MAX ${forecast.base.toFixed(1)}kgから)</p>`
    : '';
  if (forecast.status === 'not-enough') {
    return `
      <div class="forecast">
        <p class="forecast-title">間に合いそうか</p>
        <p class="sub">判定にはもう少し記録が必要です(最近8週間で${MIN_FORECAST_POINTS}回分。今 ${forecast.count}回分)</p>
        ${needed}
      </div>
    `;
  }
  const [icon, text] = FORECAST_TEXT[forecast.status];
  return `
    <div class="forecast">
      <p class="forecast-title">${icon} ${text}</p>
      <p class="sub">今のペース:<strong>${signed(forecast.perWeek)}kg/週</strong> → ${formatFullDateJa(goal.date)}の予想 <strong>${forecast.predicted.toFixed(1)}kg</strong></p>
      ${needed}
      <p class="sub note">※最近8週間の推定MAXの伸びを、そのまま延ばした目安です。実際は伸びがだんだんゆるやかになりやすいです。</p>
    </div>
  `;
}

function benchSectionHtml(progress, goal, bodyWeight) {
  if (progress.bestActual == null) {
    return `
      <section class="card">
        <h2>ベンチプレス${formatKg(goal.weight)}kgへの進捗</h2>
        <p class="sub">ベンチプレスを記録すると、ここに進み具合が出ます。</p>
      </section>
    `;
  }
  const ratio = bodyWeight ? `体重の${(progress.bestActual / bodyWeight).toFixed(2)}倍` : '';
  const goalRatio = bodyWeight ? `(目標は${(goal.weight / bodyWeight).toFixed(2)}倍)` : '';
  const percent = Math.floor(progress.rate * 100);
  const remaining = progress.remaining > 0
    ? `${formatKg(goal.weight)}kgまで あと <strong>${formatKg(progress.remaining)}kg</strong>`
    : '<strong>目標達成!</strong>';

  return `
    <section class="card">
      <h2>ベンチプレス${formatKg(goal.weight)}kgへの進捗</h2>
      <div class="stat-row">
        <div class="stat">
          <span class="stat-label">実際に挙げた最高</span>
          <span class="stat-value">${formatKg(progress.bestActual)}kg</span>
          <span class="sub">${ratio}${goalRatio}</span>
        </div>
        <div class="stat">
          <span class="stat-label">最近の推定MAX</span>
          <span class="stat-value">${progress.currentEstimate != null ? `${progress.currentEstimate.toFixed(1)}kg` : '—'}</span>
          <span class="sub">3週間で一番高い値</span>
        </div>
      </div>

      <div class="goal-progress">
        <div class="goal-progress-head">
          <span>${remaining}</span>
          <span>達成率 <strong>${percent}%</strong></span>
        </div>
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="達成率">
          <div class="meter-fill" style="width:${percent}%"></div>
        </div>
        <div class="meter-scale">
          <span>スタート ${formatKg(progress.start)}kg</span>
          <span>目標 ${formatKg(goal.weight)}kg</span>
        </div>
      </div>

      ${forecastHtml(progress.forecast, goal)}

      <div class="chart-host bench-chart"></div>
      <p class="sub note">推定MAXは回数からの計算値です。実際の1回との差は、重い日の練習で縮めていきましょう。</p>
    </section>
  `;
}

export default {
  title: '進捗',
  async render(container, { settings }) {
    const { goal } = settings;
    const [logs, allSets] = await Promise.all([getAllBodyLogs(), getAllSets()]);
    const today = parseDateString(todayString());

    const sessions = benchSessions(
      allSets.filter((s) => s.exerciseId === 'bench-press'),
      settings.benchBaseline,
    );
    const progress = benchProgress(sessions, goal, today);
    const bodyWeight = latestValue(logs, 'weightKg') ?? settings.profile.bodyWeightKg;

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
      ${benchSectionHtml(progress, goal, bodyWeight)}
      <section class="card">
        <h2>体の変化</h2>
        <div class="period-tabs">${periodButtons}</div>
        ${metricBlocks}
      </section>
    `;

    // ベンチプレスのグラフ:記録の初日から目標日まで
    const benchHost = container.querySelector('.bench-chart');
    if (benchHost) {
      const series = [
        {
          label: '実際に挙げた最高',
          variant: 'main',
          points: sessions.filter((s) => s.actual != null).map((s) => ({ date: s.date, value: s.actual })),
        },
        {
          label: '推定MAX',
          variant: 'alt',
          points: sessions.filter((s) => s.estimate != null).map((s) => ({ date: s.date, value: s.estimate })),
        },
      ];
      if (progress.forecast.projection) {
        series.push({ label: '今のペースの予想', variant: 'projection', points: progress.forecast.projection });
      }
      const goalDate = parseDateString(goal.date);
      createLineChart(benchHost, {
        series,
        unit: 'kg',
        label: 'ベンチプレス',
        xMin: sessions[0].date,
        xMax: goalDate > today ? goalDate : today,
        references: [{ label: `目標 ${formatKg(goal.weight)}kg`, value: goal.weight }],
      });
    }

    function drawBody() {
      const [, periodLabel, days] = PERIODS.find(([key]) => key === selectedPeriod);
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
          series: [{ label, points }],
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
      drawBody();
    });

    drawBody();
  },
};
