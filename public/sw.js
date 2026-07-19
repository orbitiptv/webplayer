const CACHE_NAME = 'orbittv-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/i18n.js',
  '/hls.min.js',
  '/manifest.json',
  '/logo-full.png',
  '/logo-mark.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first for everything: this app is live data (Xtream API, video streams,
// EPG) so we never want stale cached responses for /api/ or /stream. Static shell
// assets fall back to cache only if the network request fails (e.g. briefly offline).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/stream')) {
    return; // let these pass straight through, no caching/interception
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
