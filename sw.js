/* sw.js — keeps the app working offline. When the app is installed every file of it is kept in the browser's cache;
   after that each file is fetched fresh while there is a connection (so a new version arrives at once) and the kept
   copy is used without one, or when the network is too slow. The data is not here: it is in localStorage and
   IndexedDB (js/store.js, js/photos.js), and the sync API (api/…) always goes to the network (js/sync.js).
   Change VERSION when files are added or removed. */
'use strict';
const VERSION = 'v1';
const CACHE = 'inventori-' + VERSION;
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/i18n.js', 'js/calc.js', 'js/store.js', 'js/photos.js', 'js/sample-photos.js', 'js/sync.js', 'js/export.js', 'js/charts.js', 'js/app.js',
  'img/logo.svg', 'img/apple-touch-icon.png', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-maskable-512.png'];
const SLOW = 4000; // ms before the kept copy is used instead

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('inventori-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const kept = () => cache.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? cache.match('index.html') : null));
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    try {
      const first = await Promise.race([net, new Promise((done) => setTimeout(done, SLOW, 'slow'))]);
      if (first !== 'slow') return first;
      return (await kept()) || net; // slow: the kept copy if there is one, else keep waiting
    } catch (err) {
      const copy = await kept(); // offline
      if (copy) return copy;
      throw err;
    }
  })());
});
