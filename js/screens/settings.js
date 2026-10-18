// 「設定」画面
import { saveSettings, frequencyLabel, weeklyGoalMinutes } from '../settings-data.js';
import {
  createBackupFile, saveBackupFile, markBackedUp,
  readBackupFile, restoreBackup, describeBackup,
} from '../backup.js';
import { formatFullDateJa, daysSince, toast, isInstalledApp } from '../ui.js';

const PLATE_STEP_OPTIONS = [[1, '1kg'], [1.25, '1.25kg'], [2.5, '2.5kg(片側1.25kg)'], [5, '5kg(片側2.5kg)']];
const REST_OPTIONS = [[60, '1分'], [90, '1分30秒'], [120, '2分'], [180, '3分'], [240, '4分'], [300, '5分']];
const DELOAD_OPTIONS = [[4, '4週に1回'], [5, '5週に1回'], [6, '6週に1回']];
const WEEKLY_GOAL_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const m = (i + 1) * 30;
  const label = `${Math.floor(m / 60) ? `${Math.floor(m / 60)}時間` : ''}${m % 60 ? `${m % 60}分` : ''}`;
  return [m, label];
});

function options(list, selected) {
  return list
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

function lastBackupText(lastBackupAt) {
  if (!lastBackupAt) return 'まだしていません';
  const days = daysSince(lastBackupAt);
  const when = days === 0 ? '今日' : `${days}日前`;
  return `${formatFullDateJa(new Date(lastBackupAt))}(${when})`;
}

// ホーム画面に追加する手順と、データの引き継ぎ方
function installCardHtml() {
  if (isInstalledApp()) {
    return `
      <section class="card">
        <h2>アプリとして使う</h2>
        <p>✅ ホーム画面のアプリとして使っています。</p>
        <p class="sub" style="margin-top:6px">Safariで試しに入れたデータを使いたいときは、Safariで「書き出す」→ ここで「読み込む」で引き継げます。</p>
      </section>
    `;
  }
  return `
    <section class="card">
      <h2>アプリとして使う(ホーム画面に追加)</h2>
      <ol class="steps">
        <li>Safariの画面下の <strong>共有ボタン</strong>(四角から上向きの矢印)を押す</li>
        <li>メニューを下に動かして <strong>「ホーム画面に追加」</strong> を押す</li>
        <li>名前が「トレーニング」になっているのを確かめて <strong>「追加」</strong></li>
        <li>これからは、ホーム画面の <strong>アイコンから</strong> 開く</li>
      </ol>
      <p class="sub">Safariとホーム画面のアプリでは、データの保存場所が別です。今のデータを引き継ぐときは、先に下の「書き出す」でファイルに保存し、アプリを開いてから「読み込む」を使ってください。</p>
    </section>
  `;
}

export default {
  title: '設定',
  render(container, { settings, refresh }) {
    const { goal, profile, training, backup } = settings;

    container.innerHTML = `
      ${installCardHtml()}
      <section class="card">
        <h2>目標と自分の情報</h2>
        <dl class="summary">
          <div><dt>目標</dt><dd>ベンチプレス ${goal.weight}kg</dd></div>
          <div><dt>達成目標日</dt><dd>${formatFullDateJa(goal.date)}</dd></div>
          <div><dt>体重</dt><dd>${profile.bodyWeightKg}kg</dd></div>
          <div><dt>頻度</dt><dd>${frequencyLabel(profile.frequency)}</dd></div>
        </dl>
        <a class="btn btn-secondary" href="#profile">編集する</a>
      </section>

      <section class="card">
        <h2>トレーニングの設定</h2>
        <label class="field">
          <span class="field-label">今週の目標(トレーニング時間)</span>
          <select name="weeklyGoalMinutes">${options(WEEKLY_GOAL_OPTIONS, weeklyGoalMinutes(settings))}</select>
        </label>
        <label class="field">
          <span class="field-label">重量の刻み幅(両側の合計)</span>
          <select name="plateStepKg">${options(PLATE_STEP_OPTIONS, training.plateStepKg)}</select>
        </label>
        <label class="field">
          <span class="field-label">休憩時間の初期値</span>
          <select name="restSeconds">${options(REST_OPTIONS, training.restSeconds)}</select>
        </label>
        <label class="field">
          <span class="field-label">軽めの週を入れる間隔</span>
          <select name="deloadEveryWeeks">${options(DELOAD_OPTIONS, training.deloadEveryWeeks)}</select>
        </label>
      </section>

      <section class="card">
        <h2>バックアップ</h2>
        <p>最後のバックアップ:<strong>${lastBackupText(backup.lastBackupAt)}</strong></p>
        <p class="sub">「書き出す」を押すと共有の画面が出ます。「"ファイル"に保存」を選んで保存してください。</p>
        <div class="button-stack">
          <button type="button" class="btn" data-action="export">書き出す</button>
          <div class="share-retry" hidden>
            <p class="sub">準備ができました。もう一度押して保存してください。</p>
            <button type="button" class="btn" data-action="share">ファイルに保存</button>
          </div>
          <label class="btn btn-secondary">
            読み込む(元に戻す)
            <input type="file" accept=".json,application/json" class="visually-hidden" data-action="import">
          </label>
        </div>
      </section>
    `;

    // トレーニングの設定は、選んだらすぐ保存する
    container.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', async () => {
        settings.training = { ...settings.training, [select.name]: Number(select.value) };
        await saveSettings(settings);
        toast('保存しました');
      });
    });

    // 書き出し
    const exportButton = container.querySelector('[data-action="export"]');
    const retryBox = container.querySelector('.share-retry');

    async function afterSave(result, file) {
      if (result === 'saved') {
        await markBackedUp();
        toast('バックアップしました');
        await refresh();
      } else if (result === 'needs-tap') {
        retryBox.hidden = false;
        container.querySelector('[data-action="share"]').onclick = async () => {
          afterSave(await saveBackupFile(file), file);
        };
      }
    }

    exportButton.addEventListener('click', async () => {
      exportButton.disabled = true;
      try {
        const file = await createBackupFile();
        await afterSave(await saveBackupFile(file), file);
      } catch (error) {
        console.error(error);
        toast('書き出しに失敗しました');
      } finally {
        exportButton.disabled = false;
      }
    });

    // 読み込み
    const fileInput = container.querySelector('[data-action="import"]');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = ''; // 同じファイルをもう一度選べるようにする
      if (!file) return;
      try {
        const backup = await readBackupFile(file);
        const ok = confirm(
          `${formatFullDateJa(new Date(backup.exportedAt))}のバックアップで、今のデータを置き換えます。\n`
          + `(${describeBackup(backup)})\n\n今のデータは消えます。よろしいですか?`,
        );
        if (!ok) return;
        await restoreBackup(backup);
        toast('バックアップから元に戻しました');
        history.replaceState(null, '', '#today');
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    });
  },
};
