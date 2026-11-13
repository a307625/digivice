/* Offline cache for 數碼怪獸對打機 */
var CACHE = 'digivice-v27';
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
  './icons/shell/dm1997-v1.png',
  './icons/shell/dm1997-v2.png',
  './icons/shell/dm1997-v3.png',
  './icons/shell/dm1997-v4.png',
  './icons/shell/dm1997-v5.png',
  './icons/shell/dm20-zuba.png',
  './icons/shell/dm20-omega.png',
  './icons/shell/dm20-alpha.png',
  './icons/shell/dm20-brown.png',
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
  './js/engine.js',
  './js/ui.js',
  './icons/shell/pen-1-0.png',
  './icons/shell/pen-1-5.png',
  './icons/shell/pen-2-0.png',
  './icons/shell/pen-2-5.png',
  './icons/shell/pen-3-0.png',
  './icons/shell/pen-3-5.png',
  './icons/shell/pen-4-0.png',
  './icons/shell/pen-4-5.png',
  './icons/shell/pen-5-0.png',
  './icons/shell/pen-5-5.png',
  './icons/shell/pen-zero.png',
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
