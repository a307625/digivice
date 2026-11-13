/**
 * Physical-feel shell-button feedback for every device.
 * Visual only — never vibrates (no navigator.vibrate, no haptic APIs).
 *
 * iOS 15 does not reliably fire :active on <button>, so we toggle
 * `.is-pressed` from pointerdown and clear it on pointerup / pointercancel
 * / pointerleave / lostpointercapture. The visual change is instant
 * (no CSS transition). touch-action: manipulation is set in CSS.
 *
 * Per-device look is CSS on `.device[data-model=…] .pad.is-pressed`.
 */
(function (root) {
  'use strict';

  var PRESSED = 'is-pressed';

  function setPressed(el, on) {
    if (!el || !el.classList) return false;
    if (on) el.classList.add(PRESSED);
    else el.classList.remove(PRESSED);
    return !!on;
  }

  function isPressed(el) {
    return !!(el && el.classList && el.classList.contains(PRESSED));
  }

  /**
   * Attach press visuals + optional beep to a pad element.
   * opts:
   *   onDown(ev)  — existing chord / clock-hold logic; called after visual
   *   onUp(ev)
   *   beep()      — already-gated by sound-on / device mute; we just call it
   *   unlock()    — DeviceAudio.unlock, always on first down (even if muted)
   *   shouldBeep() — returns boolean; device mute is authoritative
   */
  function attach(el, opts) {
    opts = opts || {};
    if (!el || typeof el.addEventListener !== 'function') return { detach: function () {} };
    var pointerId = null;

    function down(ev) {
      if (ev && ev.pointerType === 'mouse' && ev.button !== 0 && ev.button != null) return;
      if (typeof opts.unlock === 'function') opts.unlock();
      setPressed(el, true);
      if (ev && ev.pointerId != null && el.setPointerCapture) {
        try { el.setPointerCapture(ev.pointerId); pointerId = ev.pointerId; } catch (e) {}
      }
      var allowBeep = typeof opts.shouldBeep === 'function' ? !!opts.shouldBeep() : true;
      if (allowBeep && typeof opts.beep === 'function') opts.beep();
      if (typeof opts.onDown === 'function') opts.onDown(ev);
    }
    function up(ev) {
      setPressed(el, false);
      if (pointerId != null && el.releasePointerCapture) {
        try { el.releasePointerCapture(pointerId); } catch (e) {}
        pointerId = null;
      }
      if (typeof opts.onUp === 'function') opts.onUp(ev);
    }
    function cancel(ev) {
      setPressed(el, false);
      pointerId = null;
      if (typeof opts.onUp === 'function') opts.onUp(ev);
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('lostpointercapture', cancel);
    // Do not use touchstart/click for the visual — pointer events cover iOS 15
    // when the page is a served PWA (not file://). touch-action is CSS.

    return {
      detach: function () {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('pointerleave', cancel);
        el.removeEventListener('lostpointercapture', cancel);
      },
      down: down,
      up: up,
      cancel: cancel,
      setPressed: function (on) { return setPressed(el, on); }
    };
  }

  // Intentionally no vibrate(), no navigator.vibrate, no haptic feedback.
  function neverVibrate() { return false; }

  var api = {
    PRESSED: PRESSED,
    setPressed: setPressed,
    isPressed: isPressed,
    attach: attach,
    neverVibrate: neverVibrate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DeviceButtons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
