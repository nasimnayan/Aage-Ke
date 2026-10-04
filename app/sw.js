// Service worker: caches every app file and the model on first load, then serves them offline.
// Bump VERSION whenever any cached file changes.
var VERSION = 'aageke-v2';
var FILES = [
  './', 'index.html', 'app.js', 'model.js', 'rules.js', 'i18n.js', 'store.js',
  'templates.json', 'facilities.json', 'demo_data.json', 'model_dengue.json', 'labels_dengue.json',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).catch(function () {
      if (e.request.mode === 'navigate') return caches.match('index.html');
    });
  }));
});
