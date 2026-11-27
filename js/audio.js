/**
 * Shared low-latency Web Audio for every device shell.
 * One AudioContext, unlocked on the first user tap (required on iOS 15).
 * Beeps respect the caller's enabled flag — the original device mute
 * (and the settings sound toggle, which shares that flag) is authoritative.
 * No vibration is used anywhere.
 */
(function (root) {
  'use strict';
  var ctx = null;

  function audioContext() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
    }
    return ctx;
  }

  function unlock() {
    var c = audioContext();
    if (!c) return false;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      try { c.resume(); } catch (e) {}
    }
    // A silent one-sample buffer is the reliable iOS 15 unlock.
    try {
      var buf = c.createBuffer(1, 1, c.sampleRate || 22050);
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      if (src.start) src.start(0);
      else if (src.noteOn) src.noteOn(0);
    } catch (e) {}
    return !!(c.state === 'running' || c.state === 'suspended');
  }

  /**
   * Short piezoelectric-style square beep, matching the original device's
   * brief key click (~50 ms at 880 Hz). No-ops when enabled is false.
   */
  function beep(enabled) {
    if (!enabled) return false;
    var c = audioContext();
    if (!c) return false;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      try { c.resume(); } catch (e) {}
    }
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.value = 0.045;
      o.connect(g);
      g.connect(c.destination);
      var t = c.currentTime;
      if (g.gain.setValueAtTime) {
        g.gain.setValueAtTime(0.045, t);
        if (g.gain.exponentialRampToValueAtTime) {
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        }
      }
      o.start(t);
      o.stop(t + 0.05);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * v36 call alarm: the 1997 call icon lights "with a sign sound"
   * (Bandai Ver.1 manual: サイン音と一緒に点灯). Three short beeps, the
   * same square tone as the key click. No-ops when enabled is false.
   */
  var CALL_BEEPS = [0, 0.16, 0.32];
  function callAlarm(enabled) {
    if (!enabled) return false;
    var c = audioContext();
    if (!c) return false;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      try { c.resume(); } catch (e) {}
    }
    try {
      for (var i = 0; i < CALL_BEEPS.length; i++) {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = 'square';
        o.frequency.value = 1760;
        g.gain.value = 0.045;
        o.connect(g);
        g.connect(c.destination);
        var t = c.currentTime + CALL_BEEPS[i];
        o.start(t);
        o.stop(t + 0.09);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function state() {
    return ctx ? ctx.state : 'none';
  }

  function _resetForTests() {
    ctx = null;
  }

  var api = {
    audioContext: audioContext,
    unlock: unlock,
    beep: beep,
    callAlarm: callAlarm,
    CALL_BEEPS: CALL_BEEPS,
    state: state,
    _resetForTests: _resetForTests
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DeviceAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
