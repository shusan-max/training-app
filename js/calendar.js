// 月ごとのカレンダー。練習した日に印をつける。‹ › で月を切り替える。

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

// 重い日・MAX挑戦はオレンジ、それ以外は青
const kindClass = (kind) => (kind === 'heavy' || kind === 'test' ? 'strong' : 'normal');

/**
 * host: カレンダーを入れる場所
 * days: Map('2026-10-17' → 'heavy' など)
 * today: 今日の0時の Date
 */
export function createCalendar(host, { days, today }) {
  let year = today.getFullYear();
  let month = today.getMonth(); // 0 = 1月

  function draw() {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // 月曜始まり
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

    let count = 0;
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push('<span class="cal-cell"></span>');
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = `${prefix}${String(d).padStart(2, '0')}`;
      const kind = days.get(key);
      if (kind) count += 1;
      const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
      cells.push(`
        <span class="cal-cell${isToday ? ' today' : ''}">
          <span class="cal-num">${d}</span>
          ${kind ? `<span class="cal-dot ${kindClass(kind)}"></span>` : ''}
        </span>
      `);
    }

    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    host.innerHTML = `
      <div class="cal-head">
        <button type="button" class="icon-btn" data-move="-1" aria-label="前の月">‹</button>
        <span class="cal-title">${year}年${month + 1}月 <span class="sub">${count}回</span></span>
        <button type="button" class="icon-btn" data-move="1" aria-label="次の月" ${isCurrentMonth ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid">
        ${WEEKDAYS.map((w) => `<span class="cal-weekday">${w}</span>`).join('')}
        ${cells.join('')}
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="cal-dot strong"></span>重い日・MAX挑戦</span>
        <span class="legend-item"><span class="cal-dot normal"></span>量の日・軽め など</span>
      </div>
    `;
  }

  host.addEventListener('click', (event) => {
    const button = event.target.closest('[data-move]');
    if (!button || button.disabled) return;
    month += Number(button.dataset.move);
    if (month < 0) { month = 11; year -= 1; }
    if (month > 11) { month = 0; year += 1; }
    draw();
  });

  draw();
}
