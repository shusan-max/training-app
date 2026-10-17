// アプリの入口。画面の切り替えだけを担当する。
// 各画面の中身は js/screens/ の中のファイルに分けて書く。

import { loadSettings } from './settings-data.js';
import setup from './screens/setup.js';
import today from './screens/today.js';
import historyScreen from './screens/history.js';
import progress from './screens/progress.js';
import exercises from './screens/exercises.js';
import settingsScreen from './screens/settings.js';
import profile from './screens/profile.js';

// 画面の一覧。新しい画面を足すときはここに1行追加する。
// (#の後ろの名前: 画面のファイル)
const screens = {
  today,
  history: historyScreen,
  progress,
  exercises,
  settings: settingsScreen,
  profile,
};
const DEFAULT_SCREEN = 'today';

// タブを素早く続けて押したとき、古い画面が後から表示されないようにするための番号
let renderCount = 0;

async function showScreen() {
  const myRender = ++renderCount;
  const container = document.getElementById('screen');

  try {
    const settings = await loadSettings();
    if (myRender !== renderCount) return;

    // 初回設定がまだなら、初回設定の画面だけを出す
    let id;
    let screen;
    if (!settings) {
      id = 'setup';
      screen = setup;
    } else {
      // URL の「#」より後ろ(例: #progress)で、どの画面を出すか決める
      const requested = location.hash.slice(1);
      id = screens[requested] ? requested : DEFAULT_SCREEN;
      screen = screens[id];
    }
    document.body.classList.toggle('setup-mode', !settings);
    document.getElementById('screen-title').textContent = screen.title;

    container.replaceChildren();
    await screen.render(container, { settings, refresh: showScreen });

    // 今開いているタブに印をつける
    const activeTab = screen.tab ?? id;
    document.querySelectorAll('.tabbar a').forEach((tab) => {
      if (tab.dataset.tab === activeTab) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });

    window.scrollTo(0, 0);
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <section class="card notice">
        <h2>データを読み込めませんでした</h2>
        <p>プライベートブラウズでは使えません。通常のSafariか、ホーム画面のアイコンから開いてください。</p>
      </section>
    `;
  }
}

window.addEventListener('hashchange', showScreen);
showScreen();
