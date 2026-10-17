// オフライン用の仕組み(Service Worker)
// ・電波があるとき:毎回サーバーに最新のファイルを確かめに行く(更新がすぐ反映される)
// ・電波がないとき:前回保存しておいたファイルを使う(オフラインでも開ける)

const CACHE_NAME = 'training-app-files';

self.addEventListener('install', () => {
  self.skipWaiting(); // 新しい版をすぐ使い始める
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 「次に使うときも必ず確かめてね」という印をつけて返す
// (これが無いと、再読み込みしてもブラウザが手元の古いファイルを使い回すことがある)
function withNoCache(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // このアプリ自身のファイルの読み込みだけを扱う
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // ブラウザに残っている古いファイルを使わず、サーバーに確かめる
      const response = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
      if (!response.ok) return response;
      cache.put(request.url, response.clone());
      return withNoCache(response);
    } catch {
      // 電波がないときは保存しておいたファイルを返す
      const cached = await cache.match(request.url, { ignoreSearch: true });
      if (cached) return cached;
      // 画面そのもの(index.html)が見つからないときは、アプリの入口を返す
      if (request.mode === 'navigate') {
        const entry = await cache.match(new URL('./', self.location).href);
        if (entry) return entry;
      }
      return Response.error();
    }
  })());
});

// 初めて開いたときは、この仕組みが動き出す前にファイルを読み込んでいるので保存できていない。
// そこで、画面から「読み込んだファイルの一覧」を受け取って保存しておく(オフラインに備える)
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of event.data.urls) {
      if (new URL(url).origin !== self.location.origin) continue;
      if (await cache.match(url)) continue;
      try {
        const response = await fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
        if (response.ok) await cache.put(url, response);
      } catch { /* 電波がないときは次の機会に */ }
    }
  })());
});
