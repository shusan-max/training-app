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
      return cached ?? Response.error();
    }
  })());
});
