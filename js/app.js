// アプリの入口。画面の切り替えだけを担当する。
// 各画面の中身は js/screens/ の中のファイルに分けて書く。

import today from './screens/today.js';
import history from './screens/history.js';
import progress from './screens/progress.js';
import exercises from './screens/exercises.js';
import settings from './screens/settings.js';

// 画面の一覧。新しい画面を足すときはここに1行追加する。
const screens = { today, history, progress, exercises, settings };
const DEFAULT_SCREEN = 'today';

function showScreen() {
  // URL の「#」より後ろ(例: #progress)で、どの画面を出すか決める
  const requested = location.hash.slice(1);
  const id = screens[requested] ? requested : DEFAULT_SCREEN;
  const screen = screens[id];

  document.getElementById('screen-title').textContent = screen.title;

  const container = document.getElementById('screen');
  container.replaceChildren();
  screen.render(container);

  // 今開いているタブに印をつける
  document.querySelectorAll('.tabbar a').forEach((tab) => {
    if (tab.dataset.tab === id) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  });

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showScreen);
showScreen();
