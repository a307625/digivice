#!/usr/bin/env node
/**
 * Official clock-SET operation (1997 Ver.1 and DM20) and its side effects.
 * Sources: Bandai DM20 manual, Wikimon Ver.1 / Pause, FileIsland, NHOKO.
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
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

function advance(s, gameSec) {
  s.lastReal = Date.now() - gameSec * 1000 / (s.speed || 1);
  return Engine.tick(s, Date.now());
}

function setRunningClock(s, h, min) {
  var want = ((h * 3600 + min * 60) % 86400 + 86400) % 86400;
  s.clockOffset = ((want - s.gameTime) % 86400 + 86400) % 86400;
}

function agumonAt(h, min, extra) {
  var s = Engine.defaultState(1);
  s.mon = 'agumon';
  s.clockInitialized = true;
  s.speed = 1;
  s.hunger = 4;
  s.strength = 4;
  s.sleeping = false;
  s.lights = true;
  s.dead = false;
  s.poop = 0;
  s.dp = 0;
  s.dpMax = 4;
  s.sleepStart = 21;
  s.sleepEnd = 8;
  s.gameTime = 1000;
  s.lastHungerTick = 1000;
  s.lastStrTick = 1000;
  s.lastPoopAt = 1000;
  s.sleptContinuously = 0;
  s.sleepDist = 0;
  s.stageEnteredGame = 0;
  setRunningClock(s, h, min);
  if (extra) for (var k in extra) s[k] = extra[k];
  return s;
}

console.log('Clock-SET operation tests');

// --- enter, adjust hour/minute, AM/PM wrap, confirm ---
{
  const s = agumonAt(10, 34);
  const b = Engine.beginClockSet(s);
  ok(b.ok && Engine.isClockSet(s), 'beginClockSet opens SET');
  eq(b.h24, 10, 'SET default hour is the current (phone-based) hour');
  eq(b.min, 34, 'SET default minute is the current minute');
  // A = hour
  let r = Engine.adjustClockSet(s, 'h', 1);
  eq(r.h24, 11, 'A increments the hour');
  eq(r.isAM, true, '11 is still AM');
  r = Engine.adjustClockSet(s, 'h', 1);
  eq(r.h24, 12, '12 noon');
  eq(r.isAM, false, 'hour wrap 11 AM → 12 PM flips AM/PM');
  // wrap 11 PM → 12 AM
  s.clockSet.h24 = 23;
  r = Engine.adjustClockSet(s, 'h', 1);
  eq(r.h24, 0, '24 wraps to 0');
  eq(r.isAM, true, '11 PM → 12 AM');
  // B = minutes
  s.clockSet.min = 59;
  r = Engine.adjustClockSet(s, 'm', 1);
  eq(r.min, 0, 'B wraps minutes 59 → 00');
  eq(r.h24, 0, 'minute wrap does not by itself increment the hour (official A/B are independent)');
}

{
  const s = agumonAt(15, 20);
  Engine.beginClockSet(s);
  Engine.adjustClockSet(s, 'h', 1); // 16:20
  const c = Engine.confirmClockSet(s);
  ok(c.ok, 'C confirms');
  ok(!Engine.isClockSet(s), 'SET closes on confirm');
  eq(Math.floor(Engine.clockSeconds(s) / 3600), 16, 'confirmed hour is applied');
  eq(Math.floor((Engine.clockSeconds(s) % 3600) / 60), 20, 'confirmed minute is applied');
  eq(Engine.clockSeconds(s) % 60, 0, 'seconds reset to 00 on confirm');
  eq(s.clockInitialized, true, 'confirm flags clockInitialized');
}

{
  const s = Engine.defaultState(1);
  // Phone time is whatever defaultState seeded from the Date()
  const phone = Engine.runningClockSeconds(s);
  const b = Engine.beginClockSet(s);
  eq(b.h24 * 3600 + b.min * 60, phone - (phone % 60), 'SET opens on the current phone-based time (seconds dropped)');
}

// --- timers pause (time of day frozen); age / evo continue ---
{
  const s = agumonAt(22, 0, { sleeping: true, lights: false, gameTime: 1000 });
  const age0 = Engine.ageDays(s);
  Engine.beginClockSet(s);
  // Advance 10 game hours while left on SET (the Pause trick)
  s.gameTime += 10 * 3600;
  eq(Math.floor(Engine.clockSeconds(s) / 3600), 22, 'time of day stays frozen at 22:00 while SET is open');
  eq(Engine.runningClockSeconds(s) !== Engine.clockSeconds(s), true, 'the running clock would have moved; display is frozen');
  ok(s.sleeping, 'still treated as night (sleep schedule uses the frozen clock)');
  // Age is 24h of gameTime, independent of the wall clock
  s.gameTime += 14 * 3600; // 24 h total from 1000
  // 1000 + 24h = 87400, ageDays = floor(87400/86400) = 1
  eq(Engine.ageDays(s), 1, 'age advances on gameTime (24 h = 1 year) while SET is open');
  ok(Engine.ageDays(s) !== age0, 'age changed');
  // Hunger is paused while sleeping (existing rule), not jumped by SET
  const hunger = s.hunger;
  Engine.confirmClockSet(s); // same 22:00
  eq(s.hunger, hunger, 'confirm does not change hunger');
}

// --- jump to daytime wakes, no sleep disturbance, lights on ---
{
  const s = agumonAt(22, 0, { sleeping: true, lights: false, sleepDist: 0, sleptContinuously: 4 * 3600, dp: 0, dpMax: 4 });
  Engine.beginClockSet(s);
  s.clockSet.h24 = 10;
  s.clockSet.min = 0;
  const gt = s.gameTime;
  const hung = s.hunger;
  const poop = s.poop;
  const sleepDist = s.sleepDist;
  const slept = s.sleptContinuously;
  const c = Engine.confirmClockSet(s);
  ok(c.jump.woke, 'jump to 10:00 AM wakes the pet');
  eq(s.sleeping, false, 'awake after daytime jump');
  eq(s.sleepDist, sleepDist, 'daytime jump is NOT a sleep disturbance (Wikimon Ver.1)');
  eq(s.lights, true, 'daytime jump turns the lights on (same effect as Light on)');
  eq(s.gameTime, gt, 'clock jump does not advance gameTime');
  eq(s.hunger, hung, 'clock jump does not tick hunger');
  eq(s.poop, poop, 'clock jump does not add poop');
  eq(s.sleptContinuously, slept, 'clock jump does not fake continuous sleep');
  eq(s.dp, 0, 'clock jump does not grant DP');
}

// --- set-and-restore: jumping back to night puts a woken pet to sleep (NHOKO) ---
{
  const s = agumonAt(22, 0, { sleeping: true, lights: false, sleepDist: 0, sleepCalledTonight: true });
  Engine.beginClockSet(s);
  s.clockSet.h24 = 10;
  Engine.confirmClockSet(s);
  eq(s.sleeping, false, 'woken by the day jump');
  eq(s.sleepDist, 0, 'still no disturbance');
  // Set back to 22:00
  Engine.beginClockSet(s);
  s.clockSet.h24 = 22;
  s.clockSet.min = 0;
  const c = Engine.confirmClockSet(s);
  ok(c.jump.slept, 'set-and-restore puts them back to sleep');
  eq(s.sleeping, true, 'asleep again at 22:00');
  eq(s.sleepDist, 0, 'set-and-restore is not a sleep disturbance');
}

// --- jump into night with lights on starts a lights call (first time that night) ---
{
  const s = agumonAt(10, 0, { sleeping: false, lights: true, sleepCalledTonight: false, callLightsAt: null });
  Engine.beginClockSet(s);
  s.clockSet.h24 = 22;
  Engine.confirmClockSet(s);
  eq(s.sleeping, true, 'jump into night puts them to sleep');
  ok(s.callLightsAt != null, 'lights still on: a lights-out call starts');
  eq(s.sleepCalledTonight, true, 'one call reserved for the night');
}

// --- baby1 / egg are not put to sleep by a jump ---
{
  const s = Engine.defaultState(1);
  s.mon = 'botamon';
  s.clockInitialized = true;
  s.sleeping = false;
  setRunningClock(s, 10, 0);
  Engine.beginClockSet(s);
  s.clockSet.h24 = 22;
  Engine.confirmClockSet(s);
  eq(s.sleeping, false, 'Baby I is not put to sleep by a clock jump');
}

// --- egg hatch: 10 min (1997) / 1 min (DM20) after first SET, not before ---
{
  const s = Engine.defaultState(1);
  eq(s.clockInitialized, false, 'a new 1997 egg has not had its clock set');
  eq(Engine.eggHatchMinutes(s), 10, '1997 hatch is 10 minutes after SET');
  s.speed = 1;
  advance(s, 12 * 60);
  ok(s.mon === 'egg_v1' || (Engine.mon(s) && Engine.mon(s).stage === 'egg'),
    'egg does not hatch before the clock is set (even after 12 min) (mon=' + s.mon + ')');
}
{
  const s = Engine.defaultState(1);
  s.speed = 1;
  Engine.beginClockSet(s);
  const c = Engine.confirmClockSet(s);
  ok(c.first && c.hatchStarted, 'first confirm starts the 1997 hatch timer');
  eq(s.evoDueAt, 10, 'hatch due is 10 minutes');
  eq(s.stageEnteredGame, s.gameTime, 'hatch timer starts at the moment of SET');
  advance(s, 9 * 60);
  ok(Engine.mon(s).stage === 'egg', 'still an egg at 9 minutes');
  advance(s, 2 * 60);
  ok(Engine.mon(s).stage !== 'egg', '1997 egg hatches 10 minutes after the clock is set (mon=' + s.mon + ')');
}
{
  const s = Engine.defaultState(1, 'zuba');
  s.speed = 1;
  eq(Engine.eggHatchMinutes(s), 1, 'DM20 hatch is 1 minute after SET (Bandai / Humulos)');
  Engine.beginClockSet(s);
  Engine.confirmClockSet(s);
  eq(s.evoDueAt, 1, 'DM20 evoDueAt is 1 minute');
  advance(s, 50);
  ok(Engine.mon(s).stage === 'egg', 'DM20 still an egg at 50 seconds (mon=' + s.mon + ')');
  advance(s, 20);
  ok(Engine.mon(s).stage !== 'egg', 'DM20 egg hatches 1 minute after SET (mon=' + s.mon + ')');
}

// --- migrate: existing saves do not get stuck waiting for SET ---
{
  const s = Engine.defaultState(1);
  s.mon = 'agumon';
  delete s.clockInitialized;
  delete s.clockSet;
  Engine.migrateState(s);
  eq(s.clockInitialized, true, 'existing saves are treated as already SET');
  ok(s.clockSet && s.clockSet.on === false, 'migrate fills a clockSet object');
}

// --- FileIsland Pause: evo while on SET unpauses ---
{
  const s = agumonAt(22, 0, { sleeping: true, lights: false, mon: 'koromon', stageEnteredGame: 0, gameTime: 70 * 60, evoDueAt: 60, clockInitialized: true });
  // koromon lifespan is around 60-69? We'll force via evolveTo path:
  Engine.beginClockSet(s);
  ok(Engine.isClockSet(s), 'SET open before evolve');
  Engine.evolveTo(s, 'agumon', 'test-unpause');
  ok(!Engine.isClockSet(s), 'evolving while on SET unpauses the clock (FileIsland)');
  eq(s.mon, 'agumon', 'evolution happened');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
