#!/usr/bin/env node
/**
 * DM20 light-bulb menu: official On / Off (Humulos DM20 manual).
 * On any device the lamp can always be turned back on.
 * Sources: https://humulos.com/digimon/dm20/manual/
 *          Bandai English manual: "LIGHTS (wake up/put to sleep)"
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Engine = require('../js/engine.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + a + ', expected ' + b + ')');
}

function advance(s, gameSec) {
  s.lastReal = Date.now() - gameSec * 1000 / (s.speed || 1);
  return Engine.tick(s, Date.now());
}

function dm20(extra) {
  const s = Engine.defaultState(1, 'zuba');
  s.mon = 'zubamon';
  Engine.applySpeciesCare(s, { setWeight: true });
  s.stageEnteredGame = 0;
  s.gameTime = 0;
  s.lastReal = Date.now();
  s.speed = 1;
  s.sleeping = false;
  s.lights = true;
  s.hunger = 4;
  s.strength = 4;
  s.dead = false;
  s.dp = s.dpMax || 14;
  s.clockOffset = 10 * 3600; // 10:00, daytime
  if (extra) Object.assign(s, extra);
  return s;
}

console.log('1) Official options are On (sel 0) and Off (sel 1)');
{
  ok(typeof Engine.confirmDm20Light === 'function', 'confirmDm20Light is exported');
  ok(Engine.isDm20(dm20()), 'zuba egg is DM20');
  ok(!Engine.isDm20(Engine.defaultState(1)), 'Ver.1 egg is not DM20');
}

console.log('2) Off while awake (not bedtime) starts a 3-hour nap and turns lights off');
{
  const s = dm20();
  const r = Engine.confirmDm20Light(s, 1);
  ok(r.ok && r.nap && r.sleeping, 'Off starts a nap');
  eq(s.lights, false, 'Off turns the lamp off');
  eq(s.sleeping, true, 'pet is sleeping (nap)');
  ok(s.napUntil === Engine.DM20_NAP_SEC, 'napUntil is +3 h (got ' + s.napUntil + ')');
  eq(s.sleepDist || 0, 0, 'nap is not a sleep disturbance');
}

console.log('3) THE BUG: On after Off always turns the lamp back on (awake or asleep)');
{
  // Awake, lights already off (the stuck-off case: Off used, then they woke, or Off without sleep)
  const a = dm20({ lights: false, sleeping: false });
  const r0 = Engine.confirmDm20Light(a, 0);
  ok(r0.ok && r0.lights === true, 'On while already awake turns lights on');
  eq(a.lights, true, 'lamp is on');
  eq(a.sleeping, false, 'On while awake does not change sleep (Humulos: On — Nothing!)');

  // After a nap (sleeping, lights off)
  const s = dm20();
  Engine.confirmDm20Light(s, 1); // Off: nap, lights off
  eq(s.lights, false, 'precondition: lights off');
  eq(s.sleeping, true, 'precondition: sleeping');
  const r = Engine.confirmDm20Light(s, 0);
  ok(r.ok && r.woken, 'On wakes a sleeping pet');
  eq(s.lights, true, 'On turns the lamp back on');
  eq(s.sleeping, false, 'pet is awake');
  eq(s.sleepDist || 0, 0, 'DM20 Wake is not a sleep disturbance');
  eq(s.calls || 0, 0, 'DM20 Wake is not a care mistake');
}

console.log('4) Off while already sleeping is a no-op (Humulos: Sleep — Nothing!)');
{
  const s = dm20({ sleeping: true, lights: false, napUntil: 999 });
  const r = Engine.confirmDm20Light(s, 1);
  ok(r.ok && r.noop, 'Off is a no-op while sleeping');
  eq(s.sleeping, true, 'still sleeping');
  eq(s.lights, false, 'lamp unchanged');
  // And On can still recover
  Engine.confirmDm20Light(s, 0);
  eq(s.lights, true, 'On still recovers the lamp after a no-op Off');
}

console.log('5) Nap ends after 3 h and restores the lamp + DP (unless bedtime)');
{
  const s = dm20({ dp: 0, dpMax: 14 });
  Engine.confirmDm20Light(s, 1);
  advance(s, 2 * 3600);
  eq(s.sleeping, true, 'still napping at 2 h');
  eq(s.lights, false, 'lamp still off during nap');
  advance(s, 3600 + 5);
  eq(s.sleeping, false, 'woke after 3 h nap');
  eq(s.lights, true, 'lamp on after nap');
  eq(s.dp, 14, '3 h nap recovers stamina (DP)');
}

console.log('6) 1997 Light is a two-way toggle: always able to turn lights back on');
{
  const s = Engine.defaultState(1);
  s.mon = 'agumon';
  s.lights = true;
  s.sleeping = false;
  s.dead = false;
  Engine.toggleLights(s);
  eq(s.lights, false, '1997 first toggle: off');
  Engine.toggleLights(s);
  eq(s.lights, true, '1997 second toggle: on again');
  Engine.setLights(s, false);
  eq(s.lights, false, 'setLights(false)');
  Engine.setLights(s, true);
  eq(s.lights, true, 'setLights(true) always works');
  // Toggling lights does not wake a 1997 sleeper
  s.sleeping = true;
  Engine.toggleLights(s);
  eq(s.sleeping, true, '1997 lights do not wake');
  Engine.toggleLights(s);
  eq(s.lights, true, '1997 can turn lights on while sleeping');
  eq(s.sleeping, true, 'still sleeping');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
