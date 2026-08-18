/* 오프라인 캐시: stale-while-revalidate.
 * 배포 시 코드가 바뀌면 VERSION을 올려야 이전 캐시가 정리된다. */
const VERSION = 'mst-v3';
const CORE = [
  './', './index.html', './css/style.css',
  './js/data.js', './js/store.js', './js/charts.js', './js/app.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(e.request).then(cached => {
        const fetched = fetch(e.request)
          .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
          .catch(() => cached);
        return cached || fetched;
      })
    )
  );
});
