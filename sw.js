/* Offline cache for 數碼怪獸對打機 — v99 (only 一般版 Ver.1–5 and 20 週年版 can be picked; other lines hidden, saves kept)
 * - Precaches every file index.html loads plus ALL device shells (WebP,
 *   ~2.4 MB), so any device works on an offline first launch.
 * - Precache requests bypass the HTTP cache (cache: 'reload'), so a new
 *   version never stores stale files from GitHub Pages' 10-minute cache.
 * - Lookups ignore query strings (?source=pwa, ?steps=…, ?egg=…).
 * - Navigations fall back to the cached app shell when the network fails,
 *   whatever the URL (start_url ./index.html, ./, or with a query).
 * - Only same-origin, non-redirected, 200 'basic' responses are cached.
 * - Old caches are deleted only after the new one is complete.
 */
var CACHE = 'digivice-v99'; // v99 hide all lines except dm1997 + dm20 (live was v98)
var APP_SHELL = './index.html';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/evolution-data.js',
  './js/evolution.js',
  './js/sprites.js',
  './js/user-sprites.js',
  './assets/user-sprites/manifest.json',
  './js/items.js',
  './js/attack-dots.js',
  './js/lcd-kana.js',
  './js/save.js',
  './icons/bezel/status.png',
  './icons/bezel/feed.png',
  './icons/bezel/train.png',
  './icons/bezel/battle.png',
  './icons/bezel/arrows.png',
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
  './icons/splash-1290x2796.png',
  './icons/shell/digivice-jou.webp',
  './icons/shell/digivice-koushiro.webp',
  './icons/shell/digivice-mimi.webp',
  './icons/shell/digivice-sora.webp',
  './icons/shell/digivice-takeru.webp',
  './icons/shell/digivice-v1.webp',
  './icons/shell/digivice-v2.webp',
  './icons/shell/digivice-yamato.webp',
  './icons/shell/dm1997-v1.webp',
  './icons/shell/dm1997-v2.webp',
  './icons/shell/dm1997-v3.webp',
  './icons/shell/dm1997-v4.webp',
  './icons/shell/dm1997-v5.webp',
  './icons/shell/dm20-alpha.webp',
  './icons/shell/dm20-brown.webp',
  './icons/shell/dm20-omega.webp',
  './icons/shell/dm20-zuba.webp',
  './icons/shell/pen-1-0.webp',
  './icons/shell/pen-1-5.webp',
  './icons/shell/pen-2-0.webp',
  './icons/shell/pen-2-5.webp',
  './icons/shell/pen-20th-sb.webp',
  './icons/shell/pen-20th-sk.webp',
  './icons/shell/pen-3-0.webp',
  './icons/shell/pen-3-5.webp',
  './icons/shell/pen-4-0.webp',
  './icons/shell/pen-4-5.webp',
  './icons/shell/pen-5-0.webp',
  './icons/shell/pen-5-5.webp',
  './icons/shell/pen-zero.webp'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        var req = new Request(url, { cache: 'reload' });
        return fetch(req).then(function (res) {
          if (!res || !res.ok) throw new Error('precache ' + url + ' ' + (res && res.status));
          return Promise.resolve(cleanResponse(res)).then(function (clean) { return cache.put(url, clean); });
        });
      })).then(function () { return precacheUserSprites(cache); });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE && k.indexOf('digivice-') === 0;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// iOS Safari refuses to serve a redirected response to a navigation
// ("Response served by service worker has redirections"). Re-wrap it.
function cleanResponse(res) {
  if (!res.redirected) return res;
  return res.blob().then(function (body) {
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

function cacheable(res) {
  return res && res.status === 200 && res.type === 'basic' && !res.redirected;
}

// v35: user-supplied sprite PNGs (assets/user-sprites/, listed in its
// manifest.json). Best effort: a missing or broken file never blocks install.
var USER_SPRITES_DIR = './assets/user-sprites/';
function userSpriteUrls(manifest) {
  var files = (manifest && Array.isArray(manifest.files)) ? manifest.files : [];
  return files.filter(function (f) {
    return typeof f === 'string' && /^[a-z0-9_-]+\/[a-z0-9_-]+_[a-z0-9]+\.png$/i.test(f);
  }).map(function (f) { return USER_SPRITES_DIR + f; });
}
function precacheUserSprites(cache) {
  return fetch(new Request(USER_SPRITES_DIR + 'manifest.json', { cache: 'reload' })).then(function (res) {
    return res.ok ? res.json() : null;
  }).then(function (m) {
    return Promise.all(userSpriteUrls(m).map(function (url) {
      return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
        if (cacheable(res)) return cache.put(url, res);
      }).catch(function () {});
    }));
  }).catch(function () {});
}
function isUserSprite(url) {
  return url.pathname.indexOf('/assets/user-sprites/') !== -1;
}

function appShell() {
  return caches.match(APP_SHELL, { ignoreSearch: true }).then(function (r) {
    return r || caches.match('./', { ignoreSearch: true });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var isNav = req.mode === 'navigate' || (req.destination === 'document');
  if (isNav) {
    // Cached app shell first (works offline with any query string). The
    // HTML only changes with a new sw.js version, which re-precaches it
    // together with matching JS, so HTML and JS never mix versions.
    event.respondWith(
      appShell().then(function (cached) {
        if (cached) return cached;
        return fetch(req).catch(function () {
          return new Response('<h1>Offline</h1>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
      })
    );
    return;
  }
  if (isUserSprite(url)) {
    // Network first so a newly uploaded PNG or manifest shows up on the next
    // online launch; the cached copy serves offline.
    event.respondWith(
      fetch(new Request(req, { cache: 'no-cache' })).then(function (res) {
        if (cacheable(res)) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (cached) {
          return cached || new Response('', { status: 504, statusText: 'offline' });
        });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (cacheable(res)) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
