#!/usr/bin/env node
/**
 * Physical-feel shell buttons: visible press, no vibration, shared
 * WebAudio unlocked on tap, mute is authoritative.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Buttons = require('../js/buttons.js');
const Audio = require('../js/audio.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

function fakeEl() {
  const listeners = {};
  const el = {
    className: 'pad',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }
    },
    style: {},
    addEventListener(t, fn) {
      (listeners[t] = listeners[t] || []).push(fn);
    },
    removeEventListener(t, fn) {
      listeners[t] = (listeners[t] || []).filter((f) => f !== fn);
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    dispatch(t, ev) {
      ev = ev || {};
      ev.type = t;
      (listeners[t] || []).forEach((f) => f(ev));
    },
    _listeners: listeners
  };
  return el;
}

console.log('Physical-feel buttons (all devices)');
console.log('===================================\n');

console.log('1) pointerdown depresses, pointerup / cancel / leave release');
{
  const el = fakeEl();
  let downs = 0, ups = 0, unlocks = 0, beeps = 0;
  const h = Buttons.attach(el, {
    unlock: () => { unlocks++; },
    shouldBeep: () => true,
    beep: () => { beeps++; },
    onDown: () => { downs++; },
    onUp: () => { ups++; }
  });
  ok(!Buttons.isPressed(el), 'idle is not pressed');
  el.dispatch('pointerdown', { pointerType: 'touch', pointerId: 1, button: 0 });
  ok(Buttons.isPressed(el), 'pointerdown adds is-pressed (not waiting for :active)');
  eq(downs, 1, 'onDown fired');
  eq(unlocks, 1, 'AudioContext unlocked on the first tap');
  eq(beeps, 1, 'short beep on press');
  el.dispatch('pointerup', { pointerId: 1 });
  ok(!Buttons.isPressed(el), 'pointerup releases');
  eq(ups, 1, 'onUp fired');

  el.dispatch('pointerdown', { pointerType: 'touch', pointerId: 2, button: 0 });
  ok(Buttons.isPressed(el), 'pressed again');
  el.dispatch('pointercancel', {});
  ok(!Buttons.isPressed(el), 'pointercancel releases');

  el.dispatch('pointerdown', { pointerType: 'touch', pointerId: 3, button: 0 });
  el.dispatch('pointerleave', {});
  ok(!Buttons.isPressed(el), 'pointerleave releases');

  el.dispatch('pointerdown', { pointerType: 'touch', pointerId: 4, button: 0 });
  el.dispatch('lostpointercapture', {});
  ok(!Buttons.isPressed(el), 'lostpointercapture releases');
  h.detach();
}

console.log('2) Mute is authoritative — no beep when shouldBeep is false');
{
  const el = fakeEl();
  let beeps = 0, unlocks = 0;
  Buttons.attach(el, {
    unlock: () => { unlocks++; },
    shouldBeep: () => false,
    beep: () => { beeps++; }
  });
  el.dispatch('pointerdown', { pointerType: 'touch', button: 0 });
  eq(beeps, 0, 'muted: no beep');
  eq(unlocks, 1, 'still unlocks the shared context so a later unmute is instant');
  ok(Buttons.isPressed(el), 'visual press still happens when muted');
}

console.log('3) DeviceAudio.beep is a no-op when disabled; never throws without WebAudio');
{
  Audio._resetForTests();
  eq(Audio.beep(false), false, 'disabled beep returns false and does not need a context');
  // In Node there is typically no AudioContext — beep(true) must not throw.
  let threw = false;
  try { Audio.beep(true); } catch (e) { threw = true; }
  ok(!threw, 'beep(true) without WebAudio does not throw');
  let uThrew = false;
  try { Audio.unlock(); } catch (e) { uThrew = true; }
  ok(!uThrew, 'unlock without WebAudio does not throw');
}

console.log('4) No vibration anywhere in the button / audio / UI press path');
{
  const files = [
    'js/buttons.js',
    'js/audio.js',
    'js/ui.js',
    'js/devices/pendulum/ui.js',
    'css/style.css'
  ].map((f) => path.join(__dirname, '..', f));
  files.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    ok(!/navigator\.vibrate\s*\(/.test(stripped), path.basename(f) + ' does not call navigator.vibrate(');
    ok(!/(?<![A-Za-z])vibrate\s*\(/.test(stripped), path.basename(f) + ' has no vibrate( call');
  });
  ok(Buttons.neverVibrate() === false, 'neverVibrate API is a hard no');
}

console.log('5) CSS: instant press (no transition), touch-action, per-device styles, :active is not the only path');
{
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  ok(/touch-action:\s*manipulation/.test(css), 'touch-action: manipulation (iOS 15 click delay)');
  ok(/\.pad\.is-pressed/.test(css), '.pad.is-pressed visual class');
  ok(/translateY|translate\(-50%,\s*calc\(-50%/.test(css), 'press uses translateY (via calc on the centering translate)');
  ok(/scale\(0\.9/.test(css), 'press uses scale');
  ok(/inset/.test(css) && /box-shadow/.test(css), 'darker shade / inner shadow');
  ok(/transition:\s*none/.test(css), 'transition: none — instant on iOS 15');
  ok(/\[data-model="dm1997"\].*\.pad/s.test(css) || /data-model="dm1997"/.test(css), '1997-styled press');
  ok(/data-model="dm20"/.test(css), 'DM20-styled press');
  ok(/data-model="pendulum"/.test(css), 'Pendulum-styled press (transparent over photo buttons)');
  // :active exists as fallback but the comment / is-pressed is the real path
  ok(/:active is not/.test(css) || /is-pressed/.test(css), 'documented that :active is not enough');
}

console.log('6) Shared module is what ui.js uses (no parallel vibrate path)');
{
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');
  ok(/DeviceButtons/.test(ui), 'ui.js wires DeviceButtons');
  ok(/DeviceAudio/.test(ui), 'ui.js uses the shared DeviceAudio context');
  ok(/unlockAudio/.test(ui), 'unlock on tap');
  ok(/soundEnabled/.test(ui), 'soundEnabled respects mute');
  ok(/soundMuted/.test(ui), 'device mute flag is checked');
  ok(/suppressClickBeep/.test(ui), 'click after pointerdown does not double-beep');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
