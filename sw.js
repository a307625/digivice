/* Offline cache for 數碼怪獸對打機 */
var CACHE = 'digivice-v30';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/evolution-data.js',
  './js/evolution.js',
  './js/sprites.js',
  './js/items.js',
  './js/save.js',
  './icons/bezel/status.png',
  './icons/bezel/feed.png',
  './icons/bezel/train.png',
  './icons/bezel/battle.png',
  './icons/bezel/flush.png',
  './icons/bezel/light.png',
  './icons/bezel/medic.png',
  './icons/bezel/call.png',
  './js/battle.js',
  './js/steps.js',
  './js/audio.js',
  './js/buttons.js',
  './js/devices/registry.js',
  './js/clock-hold.js',
  './js/lights-off.js',
  './js/devices/pendulum/data.js',
  './js/devices/pendulum/versions.js',
  './js/devices/pendulum/sprites.js',
  './js/devices/pendulum/sprites-extra.js',
  './js/devices/pendulum/shake.js',
  './js/devices/pendulum/engine.js',
  './js/devices/pendulum/ui.js',
  './js/devices/pen20/data.js',
  './js/devices/pen20/sprites.js',
  './js/devices/pen20/engine.js',
  './js/devices/pen20/profiles.js',
  './js/devices/pen20/ui.js',
  './js/devices/digivice/data.js',
  './js/devices/digivice/sprites.js',
  './js/devices/digivice/engine.js',
  './js/devices/digivice/profiles.js',
  './js/devices/digivice/ui.js',
  './js/engine.js',
  './js/ui.js',
  './vendor/lz-string.min.js',
  './vendor/qrcode.min.js',
  './vendor/jsQR.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './icons/splash-1280x800.png',
  './icons/splash-1290x2796.png'
];

// Shell WebPs are NOT precached (too heavy for iPhone 7). The fetch
// handler lazy-caches the current device's shell on first use.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
