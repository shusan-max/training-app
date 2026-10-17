// バックアップの書き出し・読み込み
import { exportAll, importAll, DB_VERSION } from './db.js';
import { loadSettings, saveSettings } from './settings-data.js';
import { todayString } from './ui.js';

const APP_ID = 'training-app';

// 全データを1つのファイルにする
export async function createBackupFile() {
  const backup = {
    app: APP_ID,
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data: await exportAll(),
  };
  const name = `training-backup-${todayString()}.json`;
  return new File([JSON.stringify(backup)], name, { type: 'application/json' });
}

// ファイルを保存する。
// iPhone では共有シートを出し、「"ファイル"に保存」を選んでもらう。
// 結果は 'saved'(保存した)/ 'cancelled'(やめた)/ 'needs-tap'(もう一度ボタンを押す必要あり)
export async function saveBackupFile(file) {
  const isTouchDevice = navigator.maxTouchPoints > 0;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'saved';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      // 準備に時間がかかると、iPhone は「ボタンを押した直後ではない」として共有を断る
      if (error.name === 'NotAllowedError') return 'needs-tap';
      throw error;
    }
  }
  downloadFile(file);
  return 'saved';
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// 「最後にバックアップした日」を今にする
export async function markBackedUp() {
  const settings = await loadSettings();
  settings.backup = { ...settings.backup, lastBackupAt: new Date().toISOString() };
  await saveSettings(settings);
}

// バックアップファイルを読んで、中身が正しいか確かめる
export async function readBackupFile(file) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('ファイルを読めませんでした。このアプリで書き出したファイルを選んでください。');
  }
  if (backup?.app !== APP_ID || typeof backup.data !== 'object') {
    throw new Error('このアプリのバックアップファイルではありません。');
  }
  if (backup.schemaVersion > DB_VERSION) {
    throw new Error('新しい版のアプリで作られたファイルです。アプリを最新にしてから読み込んでください。');
  }
  return backup;
}

// バックアップの中身で、今のデータを置き換える
export async function restoreBackup(backup) {
  await importAll(backup.data);
  // 読み込んだファイルを作った日を「最後のバックアップ」にする
  const settings = await loadSettings();
  if (settings) {
    settings.backup = { ...settings.backup, lastBackupAt: backup.exportedAt };
    await saveSettings(settings);
  }
}

// 確認のための、中身の件数
export function describeBackup(backup) {
  const count = (name) => backup.data[name]?.length ?? 0;
  return `トレーニング ${count('workouts')}回、体の記録 ${count('bodyLogs')}日分`;
}
