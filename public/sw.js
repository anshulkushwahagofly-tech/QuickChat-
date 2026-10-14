// QuickChat Service Worker (Auto-refresh on update)
const CACHE_VERSION = 'v72';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Always fetch fresh network assets
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
