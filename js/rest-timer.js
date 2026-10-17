// セット間の休憩タイマー
// 「終わる時刻」を覚えておく方式なので、画面を消したり開き直したりしても正しい残り時間が出る。
// iPhone はアプリを閉じている間は音を鳴らせないので、開いているときに音と画面で知らせる。

const STORAGE_KEY = 'restTimerEndAt';
const DONE_DISPLAY_MS = 6000; // 「休憩おわり」を出しておく時間

let endAt = null;
let totalMs = 0;
let intervalId = null;
let doneTimeoutId = null;
let audioContext = null;
let bar = null;

// 保存できない環境(プライベートブラウズなど)でも止まらないようにする
function storageSet(value) {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* 何もしない */ }
}
function storageRemove() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* 何もしない */ }
}
function storageGet() {
  try { return Number(localStorage.getItem(STORAGE_KEY)); } catch { return 0; }
}

// アプリ起動時に1回だけ呼ぶ。画面の下にタイマーの帯を用意する
export function initRestTimer() {
  bar = document.createElement('div');
  bar.className = 'rest-timer';
  bar.hidden = true;
  bar.innerHTML = `
    <div class="rest-progress"></div>
    <div class="rest-row">
      <span class="rest-label">休憩</span>
      <span class="rest-time"></span>
      <button type="button" data-rest="-30">−30秒</button>
      <button type="button" data-rest="30">+30秒</button>
      <button type="button" data-rest="stop">終了</button>
    </div>
  `;
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rest]');
    if (!button) return;
    if (button.dataset.rest === 'stop') {
      stopRest();
    } else {
      adjust(Number(button.dataset.rest));
    }
  });
  document.body.append(bar);

  // 開き直したとき、休憩中だったら続きから
  const saved = storageGet();
  if (saved > Date.now()) {
    endAt = saved;
    totalMs = saved - Date.now();
    run();
  } else {
    storageRemove();
  }

  // 画面を消して戻ってきたら、すぐに残り時間を直す
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && endAt) tick();
  });
}

// 音を鳴らす準備。iPhone はボタンを押した瞬間にしか準備させてくれないので、
// 「記録する」ボタンを押したときに呼ぶ
export function unlockAudio() {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch { /* 音が使えない環境 */ }
}

export function startRest(seconds) {
  endAt = Date.now() + seconds * 1000;
  totalMs = seconds * 1000;
  storageSet(endAt);
  run();
}

export function stopRest() {
  clearInterval(intervalId);
  clearTimeout(doneTimeoutId);
  endAt = null;
  storageRemove();
  hideBar();
}

function run() {
  clearTimeout(doneTimeoutId);
  bar.hidden = false;
  bar.classList.remove('rest-done');
  bar.querySelector('.rest-label').textContent = '休憩';
  document.body.classList.add('rest-on');
  clearInterval(intervalId);
  intervalId = setInterval(tick, 250);
  tick();
}

function tick() {
  const remaining = endAt - Date.now();
  if (remaining <= 0) {
    finish();
    return;
  }
  const sec = Math.ceil(remaining / 1000);
  bar.querySelector('.rest-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  bar.querySelector('.rest-progress').style.transform = `scaleX(${remaining / totalMs})`;
}

function adjust(seconds) {
  if (!endAt) return;
  endAt = Math.max(Date.now() + 1000, endAt + seconds * 1000);
  totalMs = Math.max(totalMs, endAt - Date.now());
  storageSet(endAt);
  tick();
}

function finish() {
  clearInterval(intervalId);
  endAt = null;
  storageRemove();
  beep();
  navigator.vibrate?.([200, 100, 200]); // Android 用(iPhone は振動できない)
  bar.classList.add('rest-done');
  bar.querySelector('.rest-label').textContent = '休憩おわり';
  bar.querySelector('.rest-time').textContent = '次のセットへ';
  bar.querySelector('.rest-progress').style.transform = 'scaleX(0)';
  doneTimeoutId = setTimeout(hideBar, DONE_DISPLAY_MS);
}

function hideBar() {
  bar.hidden = true;
  document.body.classList.remove('rest-on');
}

// 「ピッ・ピッ・ピッ」と3回鳴らす
function beep() {
  if (!audioContext) return;
  const start = audioContext.currentTime;
  for (let i = 0; i < 3; i += 1) {
    const t = start + i * 0.4;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(t);
    oscillator.stop(t + 0.3);
  }
}
