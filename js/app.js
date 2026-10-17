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
import body from './screens/body.js';
import workout from './screens/workout.js';
import exerciseDetail from './screens/exercise-detail.js';
import { initRestTimer } from './rest-timer.js';

// 画面の一覧。新しい画面を足すときはここに1行追加する。
// (#の後ろの名前: 画面のファイル)
const screens = {
  today,
  history: historyScreen,
  progress,
  exercises,
  settings: settingsScreen,
  profile,
  body,
  workout,
  exercise: exerciseDetail,
};
const DEFAULT_SCREEN = 'today';

// タブを素早く続けて押したとき、古い画面が後から表示されないようにするための番号
let renderCount = 0;
// 今出している画面(ほかの画面に移るとき、後片付け leave() を呼ぶため)
let currentScreen = null;

async function showScreen() {
  const myRender = ++renderCount;
  const container = document.getElementById('screen');

  try {
    const settings = await loadSettings();
    if (myRender !== renderCount) return;

    // 初回設定がまだなら、初回設定の画面だけを出す
    let id;
    let screen;
    let params = [];
    if (!settings) {
      id = 'setup';
      screen = setup;
    } else {
      // URL の「#」より後ろで、どの画面を出すか決める
      // 例: #progress → 進捗画面、#body/2026-10-15 → 体の記録画面に「2026-10-15」を渡す
      const [requested, ...rest] = location.hash.slice(1).split('/');
      id = screens[requested] ? requested : DEFAULT_SCREEN;
      screen = screens[id];
      params = screens[requested] ? rest : [];
    }
    document.body.classList.toggle('setup-mode', !settings);
    document.getElementById('screen-title').textContent = screen.title;

    currentScreen?.leave?.();
    currentScreen = screen;
    container.replaceChildren();
    await screen.render(container, { settings, params, refresh: showScreen });

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

initRestTimer();
window.addEventListener('hashchange', showScreen);
showScreen();

// オフライン用の仕組み(sw.js)を登録し、読み込んだファイルを保存してもらう
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.error(error));
  navigator.serviceWorker.ready.then((registration) => {
    const page = new URL('./', location.href).href;
    const files = performance.getEntriesByType('resource')
      .map((entry) => entry.name.split('#')[0])
      .filter((url) => url.startsWith(page));
    // アイコンなど、画面の表示には使わないファイルも足しておく
    const extras = ['manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png']
      .map((path) => new URL(path, page).href);
    registration.active?.postMessage({ type: 'cache-urls', urls: [...new Set([page, ...files, ...extras])] });
  });
}
