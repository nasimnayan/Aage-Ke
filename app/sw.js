// Service worker: caches every app file and the model on first load, then serves them offline.
// Network first when online (so a new version shows at once), cache when offline.
var VERSION = 'aageke-v27';
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
  // 'no-cache' revalidates with the server, so the browser's HTTP cache never serves an old file.
  var sameOrigin = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(fetch(e.request, sameOrigin ? { cache: 'no-cache' } : undefined).then(function (res) {
    // Keep the offline copy fresh with whatever the network just returned.
    if (res.ok && new URL(e.request.url).origin === self.location.origin) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined);
    });
  }));
});
