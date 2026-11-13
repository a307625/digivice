#!/usr/bin/env node
/**
 * Lights-off playfield per family, including Baby I/II and the
 * Babydmon (DM20 20th) line the user was playing.
 *
 * Official:
 *   1997  — blank dark LCD whenever the lamp is off, any stage,
 *           awake or asleep (clock-rules.md).
 *   DM20  — does NOT go dark. Off starts a 3-hour nap (day) or puts a
 *           tired pet to bed; visible change is the sleep pose + Z.
 *           Babydmon is Baby II on dra_blue / dra_green; Baby I is Petitmon.
 *   Pendulum — black + Z if tired/asleep and off; solid black if awake
 *           and off, including Baby I (no bedtime).
 * Menus and the clock always paint on paper.
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Engine = require('../js/engine.js');
global.PendulumData = require('../js/devices/pendulum/data.js');
const PenEng = require('../js/devices/pendulum/engine.js');
global.PendulumEngine = PenEng;
const LO = require('../js/lights-off.js');
const Devices = require('../js/devices/registry.js');
global.Pen20Data = require('../js/devices/pen20/data.js');
global.Pen20Engine = require('../js/devices/pen20/engine.js');
require('../js/devices/pen20/profiles.js');
// data.js already registered pen-1-0 if Devices was loaded first — in node,
// PendulumData was required before Devices. Re-register.
if (Devices && PendulumData.PROFILE) Devices.register(PendulumData.PROFILE);

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

console.log('Lights-off playfield');
console.log('====================\n');

console.log('0) Babydmon line identity');
{
  eq(LO.BABYDMON_LINE.family, 'dm20', 'Babydmon line is DM20 (20th special)');
  eq(LO.BABYDMON_LINE.baby1, 'petitmon', 'Baby I is Petitmon, not Babydmon');
  eq(LO.BABYDMON_LINE.baby2, 'babydmon', 'Babydmon is Baby II');
  ok(LO.BABYDMON_LINE.eggs.indexOf('dra_blue') >= 0, 'dra_blue (斬龍) egg');
  ok(LO.BABYDMON_LINE.eggs.indexOf('dra_green') >= 0, 'dra_green (破壞龍) egg');
  const Data = global.EvolutionData;
  eq(Data.MONSTERS.babydmon.stage, 'baby2', 'evolution-data agrees: Babydmon is Baby II');
  eq(Data.MONSTERS.petitmon.stage, 'baby1', 'Petitmon is Baby I');
  eq(Data.MONSTERS.petitmon.egg, 'dra_blue', 'Petitmon is on the 20th dragon egg');
}

function mode(state, view, family) {
  return LO.playfieldMode(state, view, family);
}

console.log('1) 1997: lamp off → blank-dark on the playfield, any stage, awake or asleep');
{
  const stages = [
    { mon: 'egg_v1', extra: { mon: null } },
  ];
  function s1997(mon, extra) {
    const s = Engine.defaultState(1, 'ver1');
    s.clockInitialized = true;
    if (mon) s.mon = mon;
    s.lights = false;
    s.sleeping = false;
    if (extra) Object.assign(s, extra);
    return s;
  }
  eq(mode(s1997('botamon'), 'play', 'dm1997'), 'blank-dark', '1997 Baby I (Botamon) awake, lamp off, is blank-dark');
  eq(mode(s1997('koromon'), 'play', 'dm1997'), 'blank-dark', '1997 Baby II (Koromon) awake, lamp off, is blank-dark');
  eq(mode(s1997('agumon'), 'play', 'dm1997'), 'blank-dark', '1997 Child awake, lamp off, is blank-dark');
  eq(mode(s1997('agumon', { sleeping: true }), 'play', 'dm1997'), 'blank-dark', '1997 Child asleep, lamp off, is blank-dark');
  eq(mode(s1997('botamon', { lights: true }), 'play', 'dm1997'), 'paper', '1997 lamp on is paper');
  eq(mode(s1997('agumon'), 'clock', 'dm1997'), 'paper', '1997 clock still paints on paper');
  eq(mode(s1997('agumon'), 'food', 'dm1997'), 'paper', '1997 food menu on paper');
  eq(mode(s1997('agumon'), 'status', 'dm1997'), 'paper', '1997 status on paper');
  eq(mode(s1997('agumon'), 'lightMenu', 'dm1997'), 'paper', '1997 light menu on paper');
  // Toggle actually flips the flag at every stage, including Baby I.
  const b = s1997('botamon', { lights: true });
  Engine.toggleLights(b);
  eq(b.lights, false, '1997 Baby I toggle turns the lamp off');
  eq(b.sleeping, false, '1997 lights do not force a Baby I to sleep');
  eq(mode(b, 'play', 'dm1997'), 'blank-dark', 'after the toggle, playfield is blank-dark');
  Engine.toggleLights(b);
  eq(b.lights, true, '1997 Baby I can turn the lamp back on');
}

console.log('2) DM20 Babydmon / Petitmon: playfield does NOT go dark; Off naps and sticks across a tick');
{
  function dm20mon(mon, egg, hour, extra) {
    const s = Engine.defaultState('special', egg);
    s.mon = mon;
    s.clockInitialized = true;
    s.clockSet = { on: false, h24: 0, min: 0 };
    s.lights = true;
    s.sleeping = false;
    s.gameTime = 0;
    s.lastReal = Date.now();
    s.speed = 1;
    s.clockOffset = (hour == null ? 10 : hour) * 3600;
    if (extra) Object.assign(s, extra);
    return s;
  }
  function afterTick(s, sec) {
    s.lastReal = Date.now() - sec * 1000;
    Engine.tick(s, Date.now());
    return s;
  }

  // Daytime Baby I (Petitmon) — the actual Baby I of this line.
  const p = dm20mon('petitmon', 'dra_blue', 10);
  const r = Engine.confirmDm20Light(p, 1);
  ok(r.ok && r.nap && r.sleeping, 'Petitmon (Baby I) Off in the day starts a 3 h nap');
  eq(p.lights, false, 'Petitmon lamp is off');
  eq(p.sleeping, true, 'Petitmon is napping');
  eq(mode(p, 'play', 'dm20'), 'paper-sleep', 'DM20 Baby I lamp-off playfield is paper-sleep, not dark');
  afterTick(p, 2);
  eq(p.lights, false, 'Petitmon lamp stays off after a tick (not undone by the baby1 sleep skip)');
  eq(p.sleeping, true, 'Petitmon still napping after a tick');
  eq(mode(p, 'play', 'dm20'), 'paper-sleep', 'still paper-sleep after a tick');

  // Daytime Baby II — Babydmon, the form the user named.
  const b = dm20mon('babydmon', 'dra_blue', 10);
  const rb = Engine.confirmDm20Light(b, 1);
  ok(rb.ok && rb.nap, 'Babydmon (Baby II) Off in the day starts a nap');
  eq(b.lights, false, 'Babydmon lamp is off');
  eq(b.sleeping, true, 'Babydmon is napping');
  eq(mode(b, 'play', 'dm20'), 'paper-sleep', 'DM20 Babydmon lamp-off is paper-sleep, NEVER blank-dark (official: screen does not go dark like the old ones)');
  ok(!LO.isDarkPlayfield(mode(b, 'play', 'dm20')), 'isDarkPlayfield is false for DM20');
  afterTick(b, 2);
  eq(b.lights, false, 'Babydmon lamp stays off after a tick');
  eq(b.sleeping, true, 'Babydmon still napping after a tick');

  // Night Baby II — put to bed, not a nap.
  const n = dm20mon('babydmon', 'dra_blue', 22);
  const rn = Engine.confirmDm20Light(n, 1);
  ok(rn.ok && rn.sleeping && !rn.nap, 'Babydmon Off at bedtime puts it to bed (not a nap)');
  eq(n.lights, false, 'lamp off at bedtime');
  eq(mode(n, 'play', 'dm20'), 'paper-sleep', 'still paper-sleep at night, not dark');
  afterTick(n, 2);
  eq(n.sleeping, true, 'still in bed after a tick');
  eq(n.lights, false, 'lamp stays off at night');

  // Egg / dra_green Baby I
  const g = dm20mon('petitmon', 'dra_green', 10);
  Engine.confirmDm20Light(g, 1);
  eq(g.lights, false, 'dra_green Petitmon Off works the same');
  eq(mode(g, 'play', 'dm20'), 'paper-sleep', 'dra_green also paper-sleep');

  // Awake with lamp off (unusual: woke without On) — still not dark.
  const a = dm20mon('babydmon', 'dra_blue', 10, { lights: false, sleeping: false });
  eq(mode(a, 'play', 'dm20'), 'paper', 'DM20 awake + lamp off is paper (no dark panel)');

  // Menus
  eq(mode(b, 'lightMenu', 'dm20'), 'paper', 'DM20 light menu on paper');
  eq(mode(b, 'clock', 'dm20'), 'paper', 'DM20 clock on paper');

  // On always recovers the lamp, including Baby I.
  const o = dm20mon('petitmon', 'dra_blue', 10, { lights: false, sleeping: true, napUntil: 9999 });
  const ro = Engine.confirmDm20Light(o, 0);
  ok(ro.ok && ro.lights === true, 'On turns Baby I lamp back on');
  eq(o.sleeping, false, 'On wakes the napping Baby I (no care mistake — confirmDm20Light does not disturbSleep)');
}

console.log('3) Pendulum: black when awake and off (incl. Baby I); black-z when tired/asleep');
{
  function pen(mon, extra) {
    const s = PenEng.defaultState('pen_1_0');
    s.clockInitialized = true;
    s.mon = mon;
    s.lights = true;
    s.sleeping = false;
    s.tired = false;
    if (extra) Object.assign(s, extra);
    return s;
  }
  // Baby I (Babumon) — no bedtime, Off while awake → black (no Z).
  const b1 = pen('babumon');
  PenEng.setLights(b1, false);
  eq(b1.lights, false, 'Pendulum Baby I lamp off');
  eq(PenEng.lightsOffScreen(b1), 'black', 'engine: awake Baby I is solid black');
  eq(mode(b1, 'play', 'pendulum'), 'black', 'playfield: Baby I awake + off is black (not paper)');
  ok(LO.isDarkPlayfield('black'), 'black is a dark playfield');

  const b2 = pen('motimon');
  PenEng.setLights(b2, false);
  eq(mode(b2, 'play', 'pendulum'), 'black', 'Baby II Motimon awake + off is black');

  const ch = pen('tentomon', { tired: true });
  PenEng.setLights(ch, false);
  eq(PenEng.lightsOffScreen(ch), 'black-z', 'tired + off is black-z');
  eq(mode(ch, 'play', 'pendulum'), 'black-z', 'playfield black-z');
  eq(ch.sleeping, true, 'turning off while tired puts a Pendulum pet to bed');

  const sl = pen('tentomon', { sleeping: true, tired: true, lights: false });
  eq(mode(sl, 'play', 'pendulum'), 'black-z', 'asleep + off is black-z');

  eq(mode(pen('tentomon', { lights: true }), 'play', 'pendulum'), 'paper', 'lamp on is paper');
  eq(mode(pen('tentomon', { lights: false }), 'clock', 'pendulum'), 'paper', 'Pendulum clock on paper');
  eq(mode(pen('tentomon', { lights: false }), 'lightMenu', 'pendulum'), 'paper', 'Pendulum light menu on paper');
  eq(mode(pen('pen_egg', { lights: false }), 'play', 'pendulum'), 'black', 'egg + lamp off is black');
}

console.log('4) After a menu / clock SET / reload, the mode still follows the lamp flag');
{
  // The flag lives on the save object (persist writes the whole state).
  const s = Engine.defaultState(1, 'ver1');
  s.mon = 'agumon';
  s.lights = false;
  s.clockSet = { on: true, h24: 10, min: 34 };
  // While SET is open the view is clock — paper. After confirm, play is dark.
  eq(mode(s, 'clock', 'dm1997'), 'paper', 'during SET the clock is on paper');
  s.clockSet.on = false;
  eq(mode(s, 'play', 'dm1997'), 'blank-dark', 'after SET confirm, play is dark if the lamp is still off');
  // Simulate a reload: the same serialized lights:false must still darken.
  const reloaded = JSON.parse(JSON.stringify(s));
  eq(reloaded.lights, false, 'lights:false survives JSON round-trip (save/reload)');
  eq(mode(reloaded, 'play', 'dm1997'), 'blank-dark', 'reloaded 1997 save with lights off is still blank-dark');

  const d = Engine.defaultState('special', 'dra_blue');
  d.mon = 'babydmon';
  d.lights = false;
  d.sleeping = true;
  const d2 = JSON.parse(JSON.stringify(d));
  eq(mode(d2, 'play', 'dm20'), 'paper-sleep', 'reloaded DM20 Babydmon nap is still paper-sleep, not dark');
}

console.log('5) Pendulum Ver.20th: Off is freeze (fridge on paper) or sleep on paper; never blank-dark or black-z');
{
  const Eng = global.Pen20Engine;
  function p20(extra) {
    const s = Eng.defaultState('pen_20th_sk');
    s.clockInitialized = true;
    s.pets[0].mon = 'bubb';
    s.pets[0].level = 'I';
    Object.assign(s.pets[0], extra || {});
    return s;
  }
  const frozen = p20({ frozen: true, sleeping: false, tired: false });
  eq(mode(frozen, 'play', 'pen20'), 'paper-fridge', 'frozen pet is paper-fridge');
  const sleep = p20({ frozen: false, sleeping: true, tired: false });
  eq(mode(sleep, 'play', 'pen20'), 'paper-sleep', 'sleeping pet is paper-sleep');
  const idle = p20({ frozen: false, sleeping: false });
  eq(mode(idle, 'play', 'pen20'), 'paper', 'idle (lamp not a darkener) is paper');
  eq(mode(frozen, 'clock', 'pen20'), 'paper', 'clock is paper');
  eq(mode(frozen, 'lightMenu', 'pen20'), 'paper', 'On/Off menu is paper');
  eq(mode(frozen, 'food', 'pen20'), 'paper', 'food is paper');
  eq(LO.isDarkPlayfield('paper-fridge'), false, 'fridge is not a dark playfield');
  eq(LO.isDarkPlayfield('paper-sleep'), false, 'pen20 sleep is not a dark playfield');
  // Must never regress other families
  eq(mode({ mon: 'botamon', lights: false, sleeping: false }, 'play', 'dm1997'), 'blank-dark', '1997 still blank-dark');
  eq(mode({ mon: 'babumon', lights: false, sleeping: false, family: 'pendulum' }, 'play', 'pendulum'), 'black', 'PenOG still black');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
