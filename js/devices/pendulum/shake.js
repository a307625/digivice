/**
 * Pendulum shake input.
 *
 * Official play uses the physical clacker; we use DeviceMotion.
 * iOS 15 requires DeviceMotionEvent.requestPermission() on a user
 * gesture — we call it from Training confirm (a real tap).
 *
 * When permission is denied or the API is missing, a swipe on the
 * COUNT screen (and an optional "模擬搖動" extra-menu button) is the
 * fallback. The fallback is never required when motion is granted.
 */
(function (root) {
  'use strict';

  var permission = 'unknown'; // unknown | granted | denied | unsupported
  var listening = false;
  var listeners = [];
  var lastMag = 0;
  var lastAt = 0;
  var THRESH = 14;        // m/s² peak-to-peak; conservative for a desk shake
  var COOLDOWN = 120;     // ms between counted shakes

  function status() { return permission; }

  function hasRequestPermission() {
    return !!(root.DeviceMotionEvent &&
      typeof root.DeviceMotionEvent.requestPermission === 'function');
  }

  function supported() {
    return typeof root.DeviceMotionEvent !== 'undefined';
  }

  /**
   * Must be called from a user tap. Resolves to 'granted' or 'denied'.
   * On browsers without requestPermission, granting is implicit.
   */
  function requestPermission(cb) {
    cb = cb || function () {};
    if (!supported()) {
      permission = 'unsupported';
      cb(permission);
      return;
    }
    if (hasRequestPermission()) {
      try {
        root.DeviceMotionEvent.requestPermission().then(function (r) {
          permission = (r === 'granted') ? 'granted' : 'denied';
          if (permission === 'granted') start();
          cb(permission);
        }).catch(function () {
          permission = 'denied';
          cb(permission);
        });
      } catch (e) {
        permission = 'denied';
        cb(permission);
      }
      return;
    }
    permission = 'granted';
    start();
    cb(permission);
  }

  function onMotion(ev) {
    var a = ev.accelerationIncludingGravity || ev.acceleration;
    if (!a) return;
    var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    var d = Math.abs(mag - lastMag);
    lastMag = mag;
    var t = Date.now();
    if (d >= THRESH && t - lastAt >= COOLDOWN) {
      lastAt = t;
      emit(1, 'motion');
    }
  }

  function start() {
    if (listening) return;
    if (permission !== 'granted') return;
    try {
      root.addEventListener('devicemotion', onMotion, false);
      listening = true;
    } catch (e) {}
  }

  function stop() {
    if (!listening) return;
    try { root.removeEventListener('devicemotion', onMotion, false); } catch (e) {}
    listening = false;
  }

  function emit(n, source) {
    n = n || 1;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](n, source || 'motion'); } catch (e) {}
    }
  }

  function onShake(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function off() {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  /** Fallback: one counted shake, used by swipe and the extra-menu button. */
  function simulate(n) {
    emit(n || 1, 'fallback');
  }

  function needsFallback() {
    return permission === 'denied' || permission === 'unsupported';
  }

  var api = {
    status: status,
    supported: supported,
    hasRequestPermission: hasRequestPermission,
    requestPermission: requestPermission,
    start: start,
    stop: stop,
    onShake: onShake,
    simulate: simulate,
    needsFallback: needsFallback,
    _setPermissionForTests: function (p) { permission = p; },
    _emitForTests: emit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PendulumShake = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
