#!/usr/bin/env node
/**
 * Clock SET: one tap = exactly +1; hold-to-repeat only after the
 * family's delay, and only if the original device has it. Ghost
 * clicks after pointer events are ignored. Timers clear on
 * pointerup / cancel / visibilitychange.
 */
'use strict';

const CH = require('../js/clock-hold.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

console.log('Clock SET hold / one-tap');
console.log('========================\n');

console.log('1) Family policy: 1997 and DM20 hold after a delay; Pendulum does not');
{
  const a = CH.specFor('dm1997');
  ok(a.hold, '1997 has hold-to-repeat (clock-rules.md / Bandai "Hold A/B")');
  eq(a.delayMs, 400, '1997 delay 400 ms (unverified typical, labelled)');
  eq(a.rateMs, 100, '1997 rate 100 ms (unverified typical, labelled)');
  ok(a.delayMs > 0, 'delay is not zero — repeat does not start on the tap');
  const b = CH.specFor('dm20');
  ok(b.hold && b.delayMs === 400, 'DM20 same official "hold to advance"');
  const p = CH.specFor('pendulum');
  ok(!p.hold, 'Pendulum OG: no sourced hold-to-repeat, no auto-repeat');
  eq(p.delayMs, 0, 'Pendulum delay is 0 (unused)');
}

function harness(family) {
  let now = 1000000;
  const timeouts = []; // {id, at, fn, interval}
  let nextId = 1;
  let count = 0;
  const parts = [];
  function setTimeoutFn(fn, ms) {
    const id = nextId++;
    timeouts.push({ id, at: now + ms, fn, interval: false, ms });
    return id;
  }
  function setIntervalFn(fn, ms) {
    const id = nextId++;
    timeouts.push({ id, at: now + ms, fn, interval: true, ms });
    return id;
  }
  function clearFn(id) {
    const i = timeouts.findIndex((t) => t.id === id);
    if (i >= 0) timeouts.splice(i, 1);
  }
  function fireDue() {
    let guard = 0;
    while (guard++ < 1000) {
      const due = timeouts.filter((t) => t.at <= now).sort((a, b) => a.at - b.at);
      if (!due.length) break;
      for (const t of due) {
        if (t.interval) t.at = now + t.ms;
        else {
          const i = timeouts.indexOf(t);
          if (i >= 0) timeouts.splice(i, 1);
        }
        t.fn();
      }
    }
  }
  function advance(ms) {
    now += ms;
    fireDue();
  }
  const ctl = CH.create({
    now: () => now,
    setTimeout: setTimeoutFn,
    clearTimeout: clearFn,
    setInterval: setIntervalFn,
    clearInterval: clearFn,
    family: () => family,
    adjust: (part) => { count++; parts.push(part); },
    noVis: true
  });
  return { ctl, advance, getCount: () => count, getParts: () => parts, getNow: () => now };
}

console.log('2) 1997: one short tap is exactly +1; no repeat starts');
{
  const h = harness('dm1997');
  h.ctl.onPointerDown('h');
  eq(h.getCount(), 1, 'pointerdown adjusts once');
  h.advance(200); // release well before 400 ms
  eq(h.getCount(), 1, 'still 1 after 200 ms of hold');
  h.ctl.onPointerUp();
  h.advance(2000);
  eq(h.getCount(), 1, 'after release, no further adjusts — no runaway interval');
}

console.log('3) 1997: hold past the delay then repeats at the rate; up stops it');
{
  const h = harness('dm1997');
  h.ctl.onPointerDown('m');
  eq(h.getCount(), 1, 'initial +1 on down');
  h.advance(399);
  eq(h.getCount(), 1, 'still 1 just before the 400 ms delay');
  h.advance(1);
  eq(h.getCount(), 2, 'first repeat fires at the delay, not sooner');
  h.advance(100);
  eq(h.getCount(), 3, 'next at 100 ms');
  h.advance(100);
  eq(h.getCount(), 4, 'and again');
  h.ctl.onPointerUp();
  h.advance(1000);
  eq(h.getCount(), 4, 'pointerup clears the interval');
  eq(h.getParts().every((p) => p === 'm'), true, 'all adjusts were minutes');
}

console.log('4) Ghost click after pointer is ignored (iOS 15)');
{
  const h = harness('dm1997');
  h.ctl.onPointerDown('h');
  h.advance(80);
  h.ctl.onPointerUp();
  eq(h.getCount(), 1, 'tap is +1');
  ok(h.ctl.shouldIgnoreClick(), 'ghost-click window is open after pointerup');
  // Simulate pressA click path: must NOT add another +1 and must NOT start hold.
  if (!h.ctl.shouldIgnoreClick()) h.ctl.onKeyDown('h');
  eq(h.getCount(), 1, 'ignored click does not adjust');
  h.advance(2000);
  eq(h.getCount(), 1, 'ignored click did not start a runaway hold');
  h.advance(400); // past SUPPRESS_MS (500 from up, we already advanced some)
  // After the window, a real keyboard press works.
}

console.log('5) Suppress window lasts SUPPRESS_MS after pointerup');
{
  const h = harness('dm1997');
  h.ctl.onPointerDown('h');
  h.ctl.onPointerUp();
  h.advance(499);
  ok(h.ctl.shouldIgnoreClick(), 'still suppressed at 499 ms');
  h.advance(2);
  ok(!h.ctl.shouldIgnoreClick(), 'open again after 500 ms');
}

console.log('6) Pendulum: tap is +1, holding never repeats');
{
  const h = harness('pendulum');
  h.ctl.onPointerDown('h');
  eq(h.getCount(), 1, 'Pendulum pointerdown +1');
  h.advance(5000);
  eq(h.getCount(), 1, 'no auto-repeat even after 5 s held');
  h.ctl.onPointerUp();
  h.advance(2000);
  eq(h.getCount(), 1, 'still 1 after release');
}

console.log('7) visibilitychange and pointercancel clear a running repeat');
{
  const h = harness('dm20');
  h.ctl.onPointerDown('h');
  h.advance(400);
  ok(h.getCount() >= 2, 'repeat has started');
  const n = h.getCount();
  h.ctl.onVisibilityChange();
  h.advance(1000);
  eq(h.getCount(), n, 'visibilitychange stops the interval');

  const h2 = harness('dm20');
  h2.ctl.onPointerDown('m');
  h2.advance(400);
  const n2 = h2.getCount();
  h2.ctl.onPointerUp(); // cancel / leave / lostpointercapture all call this
  h2.advance(1000);
  eq(h2.getCount(), n2, 'pointerup/cancel stops the interval');
}

console.log('8) Keyboard: keydown +1, keyup stops; caller ignores e.repeat');
{
  const h = harness('dm1997');
  h.ctl.onKeyDown('h');
  eq(h.getCount(), 1, 'keydown +1');
  h.advance(400);
  ok(h.getCount() >= 2, 'keyboard hold repeats after delay');
  const n = h.getCount();
  h.ctl.onKeyUp();
  h.advance(1000);
  eq(h.getCount(), n, 'keyup stops repeat');
}

console.log('9) ui.js no longer starts a hold from the click handler (source)');
{
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  ok(!/startClockHold/.test(src), 'startClockHold is gone');
  ok(!/clockHold\.fromPad/.test(src), 'fromPad flag is gone (it was cleared before the ghost click)');
  ok(/shouldIgnoreClick/.test(src), 'click path consults shouldIgnoreClick');
  ok(/onPointerDown/.test(src), 'pointerdown uses onPointerDown');
  ok(/onPointerUp/.test(src), 'pointerup uses onPointerUp');
  ok(/onKeyUp/.test(src), 'keyup stops the hold');
  // The click path must not start a repeat — only +1 or ignore.
  const clickBlock = src.split('if (isClockSetView())')[2] || src;
  // pressA SET block: shouldIgnoreClick then clockSetAdjust, no onKeyDown / startRepeat
  ok(/shouldIgnoreClick\(\)\) return/.test(src), 'pressA returns on a ghost click');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
