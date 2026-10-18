// 種目の説明画面(#exercise/bench-press など)
import { getExercise, recordType, RECORD_TYPES } from '../data/exercises.js';
import { GUIDES } from '../data/exercise-guides.js';
import { getAllSets, formatSet, formatSetList } from '../workout-data.js';
import { deleteCustomExercise } from '../exercise-data.js';
import { openExerciseForm } from '../exercise-form.js';
import { bestEstimate } from '../logic/e1rm.js';
import {
  formatDateJa, parseDateString, toast, escapeHtml, ICONS,
} from '../ui.js';
import {
  youtubeSearchUrl, savedVideoUrl, normalizeVideoUrl, saveVideoUrl,
} from '../video.js';

// あなたのこれまでの記録(前回と自己ベスト)
function myRecordHtml(exercise, sets) {
  const mine = sets.filter((s) => s.exerciseId === exercise.id && !s.isWarmup);
  if (mine.length === 0) return '<p class="sub">まだ記録がありません</p>';
  const lastDate = mine[mine.length - 1].date;
  const last = mine.filter((s) => s.date === lastDate);
  const rows = [
    `<div><dt>前回(${formatDateJa(parseDateString(lastDate))})</dt><dd>${formatSetList(last, exercise)}</dd></div>`,
  ];
  const record = recordType(exercise);
  if (record === 'weight') {
    const heaviest = mine.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best));
    rows.push(`<div><dt>一番重い記録</dt><dd>${formatSet(heaviest, exercise)}</dd></div>`);
    const best = bestEstimate(mine);
    if (best) rows.push(`<div><dt>推定MAXの最高</dt><dd>${best.value.toFixed(1)}kg</dd></div>`);
  } else if (record === 'cardio') {
    const longest = mine.reduce((best, s) => ((s.distanceKm ?? 0) > (best.distanceKm ?? 0) ? s : best));
    if (longest.distanceKm) rows.push(`<div><dt>一番長い距離</dt><dd>${formatSet(longest, exercise)}</dd></div>`);
  } else if (record === 'time') {
    const longest = mine.reduce((best, s) => ((s.durationSec ?? 0) > (best.durationSec ?? 0) ? s : best));
    rows.push(`<div><dt>一番長い時間</dt><dd>${formatSet(longest, exercise)}</dd></div>`);
  }
  return `<dl class="summary stacked">${rows.join('')}</dl>`;
}

// やり方の動画:保存した動画があればそれを大きく、無ければ YouTube でさがすボタンを大きく
function videoCardHtml(exercise, settings) {
  const saved = savedVideoUrl(exercise, settings);
  const form = `
    <form class="video-form" novalidate>
      <label class="field">
        <span class="field-label">${saved ? '別の動画に変える' : 'わかりやすい動画が見つかったら、URLを保存できます'}</span>
        <input name="url" type="url" inputmode="url" placeholder="https://youtu.be/..." autocomplete="off">
      </label>
      <button type="submit" class="btn btn-secondary">この動画を保存</button>
    </form>
  `;
  return `
    <section class="card video-card">
      <h2>やり方を動画で見る</h2>
      ${saved ? `
        <a class="btn video-btn" href="${escapeHtml(saved)}" target="_blank" rel="noopener">${ICONS.play}保存した動画を見る</a>
        <a class="btn btn-secondary" href="${youtubeSearchUrl(exercise)}" target="_blank" rel="noopener">YouTubeでほかの動画をさがす</a>
        <div class="video-actions">
          <button type="button" class="link-button" data-action="change-video">動画を変える</button>
          <button type="button" class="link-button danger" data-action="remove-video">保存した動画を外す</button>
        </div>
        <div class="video-change" hidden>${form}</div>
      ` : `
        <a class="btn video-btn" href="${youtubeSearchUrl(exercise)}" target="_blank" rel="noopener">${ICONS.play}YouTubeでやり方をさがす</a>
        <details class="video-help">
          <summary>見つけた動画を保存するには</summary>
          <ol class="steps">
            <li>上のボタンで YouTube を開き、わかりやすい動画を選ぶ</li>
            <li>動画の下の <strong>「共有」</strong> →<strong>「コピー」</strong> を押す</li>
            <li>このアプリに戻り、下の欄に貼り付けて <strong>「この動画を保存」</strong></li>
          </ol>
          <p class="sub">次からは、ボタン1つでその動画が開きます。</p>
        </details>
        ${form}
      `}
      <p class="sub video-note">動画を見るには電波が必要です。</p>
    </section>
  `;
}

export default {
  title: '種目の説明',
  tab: 'exercises',
  async render(container, { settings, params, refresh }) {
    const exercise = getExercise(params[0]);
    const guide = GUIDES[exercise.id];
    const muscles = guide?.muscles ?? exercise.muscles;
    const sets = await getAllSets();
    const recordLabel = RECORD_TYPES.find(([r]) => r === recordType(exercise))?.[1];

    const sections = (guide?.sections ?? []).map((section) => `
      <section class="card guide-section">
        <h2>${section.title}</h2>
        <ul>${section.items.map((item) => `<li>${item}</li>`).join('')}</ul>
      </section>
    `).join('');

    container.innerHTML = `
      <button type="button" class="back-link link-button" data-action="back">‹ 戻る</button>
      <section class="card">
        <h2 class="guide-title">${escapeHtml(exercise.name)}${exercise.custom ? '<span class="custom-tag">自作</span>' : ''}</h2>
        ${muscles ? `
          <p class="field-label">効く部位</p>
          <ul class="tag-list">${muscles.map((m) => `<li>${m}</li>`).join('')}</ul>
        ` : ''}
        <p class="sub" style="margin-top:8px">記録のしかた:${recordLabel}</p>
      </section>
      ${videoCardHtml(exercise, settings)}
      ${sections || '<section class="card"><p class="sub">この種目の文章の説明はまだありません。上の動画で確かめてください。</p></section>'}
      <section class="card">
        <h2>あなたの記録</h2>
        ${myRecordHtml(exercise, sets)}
      </section>
      ${exercise.custom ? `
        <div class="button-stack">
          <button type="button" class="btn btn-secondary" data-action="edit">この種目を直す</button>
          <button type="button" class="btn btn-danger" data-action="delete">この種目を消す</button>
        </div>
      ` : ''}
      <section class="card notice" style="margin-top:12px">
        <p>痛みが出たら中止してください。痛みが続くときは、医療機関に相談しましょう。</p>
      </section>
    `;

    // 前の画面(トレーニング中なら、トレーニング画面)に戻る
    container.querySelector('[data-action="back"]').addEventListener('click', () => {
      if (history.length > 1) {
        history.back();
      } else {
        location.hash = '#exercises';
      }
    });

    // 動画の URL を保存する・消す
    const videoForm = container.querySelector('.video-form');
    videoForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const url = normalizeVideoUrl(videoForm.elements.url.value);
      if (!url) {
        toast('https:// で始まる動画のURLを貼り付けてください');
        return;
      }
      await saveVideoUrl(settings, exercise, url);
      toast('動画を保存しました');
      refresh();
    });
    container.querySelector('[data-action="change-video"]')?.addEventListener('click', () => {
      container.querySelector('.video-change').hidden = false;
      container.querySelector('.video-change input').focus();
    });
    container.querySelector('[data-action="remove-video"]')?.addEventListener('click', async () => {
      if (!confirm('保存した動画を外します。よろしいですか?')) return;
      await saveVideoUrl(settings, exercise, null);
      toast('外しました');
      refresh();
    });

    container.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      openExerciseForm({ exercise, onSaved: () => { toast('保存しました'); refresh(); } });
    });

    container.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm(`「${exercise.name}」を消します。よろしいですか?\n(記録がある場合、記録はそのまま残ります)`)) return;
      await deleteCustomExercise(exercise);
      toast('消しました');
      location.hash = '#exercises';
    });
  },
};
