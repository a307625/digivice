/* User sprite overrides (v35).
 *
 * The owner places his own PNG files in assets/user-sprites/<family>/ and
 * lists them in assets/user-sprites/manifest.json:
 *   { "files": ["dm1997/agumon_idle0.png", "pendulum/tentomon_eat1.png"] }
 * File name = <speciesId>_<frame>.png (the species id may contain "_"; the
 * frame is the part after the LAST "_").
 *
 * A listed file replaces that one built-in frame on that device family. It
 * is drawn at the device's uniform dot size: the PNG is read at its native
 * dot resolution (one PNG pixel = one LCD dot, e.g. 16x16 or 32x16) and
 * scaled by an integer so it lands on exactly the box the built-in sprite
 * uses. Anything that cannot do that (missing file, not a PNG, wrong size)
 * is logged and the built-in sprite is used instead.
 *
 * Offline: sw.js precaches the manifest and every listed PNG, and refreshes
 * them network-first, so the files keep working with no connection.
 * Check: open user-sprites-check.html, or run UserSprites.report() in the
 * console.
 */
(function (root) {
  'use strict';

  var DIR = './assets/user-sprites/';
  var NAME_RE = /^([a-z0-9-]+)\/([a-z0-9_-]+)_([a-z0-9]+)\.png$/i;
  var ALPHA_CUT = 128; // below = transparent; at/above = solid dot

  var store = {};      // family -> id -> frame -> { w, h, data: Uint8ClampedArray RGBA }
  var log = [];        // { file, status: 'loaded'|'error'|'skipped', reason }
  var warned = {};
  var listeners = [];
  var state = { manifest: null, done: false, error: null };

  function parseName(file) {
    var m = NAME_RE.exec(String(file || ''));
    if (!m) return null;
    return { family: m[1].toLowerCase(), id: m[2].toLowerCase(), frame: m[3] };
  }

  /* Integer scale k so that (w*k, h*k) == (targetW, targetH); 0 if none. */
  function fitScale(w, h, targetW, targetH) {
    if (!(w > 0 && h > 0 && targetW > 0 && targetH > 0)) return 0;
    if (targetW % w || targetH % h) return 0;
    var kx = targetW / w, ky = targetH / h;
    return (kx === ky && kx >= 1) ? kx : 0;
  }

  /* Make every pixel either fully transparent or fully opaque. */
  function binarize(data) {
    for (var i = 3; i < data.length; i += 4) data[i] = data[i] >= ALPHA_CUT ? 255 : 0;
    return data;
  }

  function record(file, status, reason) {
    log.push({ file: file, status: status, reason: reason || '' });
    if (status === 'error' && root.console) console.warn('[user-sprites] ' + file + ': ' + reason + ' (built-in sprite used)');
    if (status === 'loaded' && root.console && console.info) console.info('[user-sprites] loaded ' + file);
  }

  function put(file, w, h, data) {
    var p = parseName(file);
    if (!p) { record(file, 'error', 'bad file name (want <family>/<speciesId>_<frame>.png)'); return false; }
    if (!(w >= 1 && h >= 1 && w <= 64 && h <= 64)) { record(file, 'error', 'size ' + w + 'x' + h + ' is not a native dot size (1-64 px per side)'); return false; }
    if (!data || data.length !== w * h * 4) { record(file, 'error', 'unreadable pixel data'); return false; }
    store[p.family] = store[p.family] || {};
    store[p.family][p.id] = store[p.family][p.id] || {};
    store[p.family][p.id][p.frame] = { w: w, h: h, data: binarize(new Uint8ClampedArray(data)) };
    record(file, 'loaded');
    return true;
  }

  // When a species has user files but not the requested frame, use the
  // nearest user frame (same idea as the built-in fallbacks) so user art and
  // built-in art are never mixed on one monster. idle0 is the last resort.
  var FALLBACK = {
    eat: 'eat1', eat1: 'eat0', eat0: 'idle0',
    sleep: 'sleep0', sleep1: 'sleep0', sleep0: 'idle0',
    train1: 'train0', train0: 'attack', attack0: 'attack', attack: 'idle0',
    hurt0: 'hurt', hurt1: 'hurt', hurt: 'lose', sick: 'hurt', lose: 'angry',
    angry: 'refuse', refuse: 'idle0', happy: 'idle0',
    hatch: 'idle1', walk: 'idle0', idle1: 'idle0'
  };
  function get(family, id, frame) {
    var f = store[family]; var s = f && f[String(id || '').toLowerCase()];
    if (!s) return null;
    var fr = frame || 'idle0', seen = {};
    while (fr && !seen[fr]) {
      if (s[fr]) return s[fr];
      seen[fr] = true;
      fr = FALLBACK[fr];
    }
    return s.idle0 || null;
  }
  function getExact(family, id, frame) {
    var f = store[family]; var s = f && f[String(id || '').toLowerCase()];
    return (s && s[frame]) || null;
  }

  function has(family, id) {
    var f = store[family];
    return !!(f && f[String(id || '').toLowerCase()]);
  }

  /* Canvas of exactly targetW x targetH (the built-in sprite's box at the
   * device dot size), or null when there is no usable override. */
  /* First user frame on the fallback chain that fits the box exactly. */
  function fitting(family, id, frame, targetW, targetH) {
    var f = store[family]; var s = f && f[String(id || '').toLowerCase()];
    if (!s) return null;
    var fr = frame || 'idle0', seen = {};
    while (fr && !seen[fr]) {
      seen[fr] = true;
      var e = s[fr];
      if (e) {
        var k = fitScale(e.w, e.h, targetW, targetH);
        if (k) return { e: e, k: k };
        var key = family + '/' + id + '_' + fr + '@' + targetW + 'x' + targetH;
        if (!warned[key]) {
          warned[key] = true;
          record(family + '/' + id + '_' + fr + '.png', 'error',
            'size ' + e.w + 'x' + e.h + ' does not scale evenly to the ' + targetW + 'x' + targetH + ' sprite box on this device');
        }
      }
      fr = FALLBACK[fr] || (fr !== 'idle0' ? 'idle0' : null);
    }
    return null;
  }

  function canvasFor(family, id, frame, targetW, targetH, flip) {
    var hit = fitting(family, id, frame, targetW, targetH);
    if (!hit) return null;
    var e = hit.e, k = hit.k;
    if (typeof document === 'undefined') return { width: targetW, height: targetH, scale: k, entry: e };
    var src = document.createElement('canvas');
    src.width = e.w; src.height = e.h;
    var sctx = src.getContext('2d');
    var img = sctx.createImageData(e.w, e.h);
    img.data.set(e.data);
    sctx.putImageData(img, 0, 0);
    var out = document.createElement('canvas');
    out.width = targetW; out.height = targetH;
    var o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    if (flip) { o.translate(targetW, 0); o.scale(-1, 1); }
    o.drawImage(src, 0, 0, targetW, targetH);
    return out;
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  function changed() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('missing or not a PNG')); };
      im.src = url;
    });
  }

  function pixelsOf(im) {
    var c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data;
  }

  /* opts: { fetchJson(url) -> Promise<obj>, loadPixels(url) -> Promise<{w,h,data}> }
   * (injectable for tests; browser defaults otherwise). */
  function load(opts) {
    opts = opts || {};
    var fetchJson = opts.fetchJson || function (url) {
      return fetch(url, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    };
    var loadPixels = opts.loadPixels || function (url) {
      return loadImage(url).then(function (im) {
        return { w: im.naturalWidth, h: im.naturalHeight, data: pixelsOf(im) };
      });
    };
    return fetchJson(DIR + 'manifest.json').then(function (m) {
      state.manifest = m;
      var files = (m && Array.isArray(m.files)) ? m.files : [];
      return Promise.all(files.map(function (file) {
        if (!parseName(file)) { record(String(file), 'error', 'bad file name (want <family>/<speciesId>_<frame>.png)'); return null; }
        return loadPixels(DIR + file).then(function (px) {
          put(file, px.w, px.h, px.data);
        }, function (err) {
          record(file, 'error', (err && err.message) || 'could not load');
        });
      }));
    }, function (err) {
      state.error = 'manifest: ' + ((err && err.message) || err);
      if (root.console) console.info('[user-sprites] no manifest (' + state.error + '); built-in sprites only');
    }).then(function () {
      state.done = true;
      changed();
      return report();
    });
  }

  function report() {
    var loaded = log.filter(function (l) { return l.status === 'loaded'; }).map(function (l) { return l.file; });
    var errors = log.filter(function (l) { return l.status === 'error'; });
    return { done: state.done, manifestError: state.error, loaded: loaded, errors: errors };
  }

  function reset() {
    store = {}; log = []; warned = {}; state = { manifest: null, done: false, error: null };
  }

  var api = {
    DIR: DIR, parseName: parseName, fitScale: fitScale, put: put, get: get, has: has,
    canvasFor: canvasFor, load: load, getExact: getExact, FALLBACK: FALLBACK, report: report, onChange: onChange, reset: reset,
    log: function () { return log.slice(); },
    manifest: function () { var m = state.manifest; return (m && Array.isArray(m.files)) ? m.files.slice() : []; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UserSprites = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
