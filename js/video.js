// 種目のやり方動画
// ・保存した動画があれば、その動画
// ・無ければ YouTube の検索結果(「種目名 フォーム やり方」)
// 保存した動画の URL は設定(settings.videos)に入れておく(バックアップにも入る)
import { saveSettings } from './settings-data.js';

// YouTube で「種目名 フォーム やり方」をさがす URL
export function youtubeSearchUrl(exercise) {
  const name = exercise.name.replace(/[((].*?[))]/g, '').trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} フォーム やり方`)}`;
}

export function savedVideoUrl(exercise, settings) {
  return settings.videos?.[exercise.id] ?? null;
}

// 動画を見るボタンの行き先(保存した動画 → 無ければ検索)
export function videoUrlFor(exercise, settings) {
  return savedVideoUrl(exercise, settings) ?? youtubeSearchUrl(exercise);
}

// 貼り付けられた文字が、開いてよい URL か確かめる(https:// で始まるものだけ)
export function normalizeVideoUrl(text) {
  const trimmed = text.trim();
  // 共有ボタンでコピーすると、前に文字がつくことがあるので URL の部分だけ取り出す
  const match = trimmed.match(/https:\/\/\S+/);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export async function saveVideoUrl(settings, exercise, url) {
  const videos = { ...(settings.videos ?? {}) };
  if (url) {
    videos[exercise.id] = url;
  } else {
    delete videos[exercise.id];
  }
  settings.videos = videos;
  await saveSettings(settings);
}
