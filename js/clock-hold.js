/**
 * Clock-SET hold-to-repeat and one-tap = +1.
 *
 * The v26 bug: a single tap fired +1 on pointerdown AND started a hold
 * timer, then pointerup cleared the "fromPad" flag, then the iOS 15
 * ghost click ran pressA again: a second +1 and a NEW hold interval
 * with no pointerup to stop it, so the digits raced.
 *
 * Policy, per family:
 *   1997 and DM20 — official manuals say "Hold A/B for rapid advance"
 *     (clock-rules.md, Bandai DM20 English CLOCK SETTING). Exact delay
 *     and rate are unpublished; we use a 400 ms delay then 100 ms
 *     (10 Hz), the v25 figures, labelled unverified. Repeat starts
 *     ONLY after the delay — never on the tap itself.
 *   Pendulum OG — no sourced hold-to-repeat; one tap = +1, no repeat.
 *
 * One tap always produces exactly one adjust, done by the caller on
 * pointerdown or keydown. This helper only starts the delayed repeat
 * (when the family allows it) and suppresses the ghost click.
 *
 * Timers are cleared on pointerup / pointercancel / pointerleave /
 * lostpointercapture (caller wires those) and on visibilitychange
 * (we listen ourselves).
 */
(function (root) {
  'use strict';

  var SUPPRESS_MS = 500; // iOS 15 ghost click after pointerup
  var DELAY_MS = 400;
  var RATE_MS = 100;
  var DELAY_SOURCE = 'unverified-typical-400ms';
  var RATE_SOURCE = 'unverified-typical-100ms';

  function specFor(family) {
    if (family === 'pendulum') {
      return {
        hold: false,
        delayMs: 0,
        rateMs: 0,
        source: 'no-sourced-pen-og-hold'
      };
    }
    // dm1997, dm20, and unknown brick-family defaults.
    return {
      hold: true,
      delayMs: DELAY_MS,
      rateMs: RATE_MS,
      delaySource: DELAY_SOURCE,
      rateSource: RATE_SOURCE,
      source: 'clock-rules.md Hold A/B for rapid advance; delay/rate unpublished'
    };
  }

  function create(opts) {
    opts = opts || {};
    var now = opts.now || function () { return Date.now(); };
    var setT = opts.setTimeout || (typeof setTimeout === 'function' ? setTimeout : function () { return 0; });
    var clearT = opts.clearTimeout || (typeof clearTimeout === 'function' ? clearTimeout : function () {});
    var setI = opts.setInterval || (typeof setInterval === 'function' ? setInterval : function () { return 0; });
    var clearI = opts.clearInterval || (typeof clearInterval === 'function' ? clearInterval : function () {});
    var familyOf = opts.family || function () { return 'dm1997'; };
    var adjust = opts.adjust || function () {};

    var timer = null;
    var interval = null;
    var part = null;
    var suppressUntil = 0;
    var held = false;
    var visBound = false;

    function clearTimers() {
      if (timer != null) { clearT(timer); timer = null; }
      if (interval != null) { clearI(interval); interval = null; }
      part = null;
      held = false;
    }

    function suppressClicks() {
      var t = now() + SUPPRESS_MS;
      if (t > suppressUntil) suppressUntil = t;
    }

    function shouldIgnoreClick() {
      return now() < suppressUntil;
    }

    function startRepeat(which) {
      clearTimers();
      var spec = specFor(familyOf());
      if (!spec.hold) return;
      part = which;
      held = true;
      timer = setT(function () {
        timer = null;
        if (!held) return;
        adjust(which);
        interval = setI(function () {
          if (!held) return;
          adjust(which);
        }, spec.rateMs);
      }, spec.delayMs);
    }

    function stop() {
      clearTimers();
    }

    function onPointerDown(which) {
      suppressClicks();
      adjust(which);
      startRepeat(which);
    }

    function onPointerUp() {
      stop();
      suppressClicks();
    }

    function onKeyDown(which) {
      // Keyboard: one +1, delayed repeat while the key is held.
      // Caller must ignore e.repeat.
      adjust(which);
      startRepeat(which);
    }

    function onKeyUp() {
      stop();
    }

    function onVisibilityChange() {
      if (typeof document !== 'undefined' && document.visibilityState &&
          document.visibilityState !== 'visible') {
        stop();
      } else {
        // Hidden OR we got the event — always stop; a hold across
        // backgrounding must not keep firing.
        stop();
      }
    }

    if (typeof document !== 'undefined' && document.addEventListener && !opts.noVis) {
      document.addEventListener('visibilitychange', onVisibilityChange);
      visBound = true;
    }

    return {
      SUPPRESS_MS: SUPPRESS_MS,
      specFor: specFor,
      startRepeat: startRepeat,
      stop: stop,
      onPointerDown: onPointerDown,
      onPointerUp: onPointerUp,
      onKeyDown: onKeyDown,
      onKeyUp: onKeyUp,
      onVisibilityChange: onVisibilityChange,
      shouldIgnoreClick: shouldIgnoreClick,
      suppressClicks: suppressClicks,
      isHeld: function () { return held; },
      destroy: function () {
        stop();
        if (visBound && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisibilityChange);
          visBound = false;
        }
      }
    };
  }

  var api = {
    SUPPRESS_MS: SUPPRESS_MS,
    DELAY_MS: DELAY_MS,
    RATE_MS: RATE_MS,
    DELAY_SOURCE: DELAY_SOURCE,
    RATE_SOURCE: RATE_SOURCE,
    specFor: specFor,
    create: create
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ClockHold = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
