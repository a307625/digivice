#!/usr/bin/env node
/**
 * Official sleep-disturbance / wake rules (DMC + 1997).
 * The awake-window length is an unverified placeholder (see ui-spec.md).
 * See /workspace/ui-research/ui-spec.md.
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

function nightAgumon(extra) {
  const s = Engine.defaultState(1);
  s.mon = 'agumon';
  s.clockOffset = 22 * 3600; // 22:00
  s.gameTime = 0;
  s.lastReal = Date.now();
  s.speed = 1;
  s.sleeping = false;
  s.lights = true;
  s.hunger = 4;
  s.strength = 4;
  s.calls = 0;
  s.sleepDist = 0;
  if (extra) Object.assign(s, extra);
  return s;
}

function advance(s, gameSec) {
  s.lastReal = Date.now() - gameSec * 1000 / (s.speed || 1);
  return Engine.tick(s, Date.now());
}

console.log('Sleep / wake rules');
console.log('==================\n');

console.log('1) Falls asleep at night with lights on, starts one lights call');
{
  const s = nightAgumon();
  advance(s, 60);
  ok(s.sleeping, 'asleep after a few seconds of night');
  ok(s.sleepCalledTonight, 'sleepCalledTonight set');
  ok(s.callLightsAt != null, 'lights call started (lights were on)');
  ok(s.calls === 0, 'not yet a care mistake');
  ok(s.sleepDist === 0, 'no disturbance yet');
}

console.log('2) Feed / train / battle wake: sleep disturbance, not a care mistake, placeholder awake window');
{
  const s = nightAgumon();
  advance(s, 60);
  const callsBefore = s.calls;
  const r = Engine.disturbSleep(s, 'food');
  ok(r.woken, 'feed wakes');
  ok(!s.sleeping, 'no longer sleeping');
  ok(s.sleepDist === 1, 'sleepDist +1');
  ok(s.calls === callsBefore, 'calls unchanged');
  ok(s.callLightsAt == null, 'pending lights call cancelled');
  ok(s.awakeUntil === s.gameTime + Engine.DISTURB_AWAKE_SEC, 'awake for 10 min');

  advance(s, 9 * 60);
  ok(!s.sleeping, 'still awake at 9 minutes');
  advance(s, 2 * 60);
  ok(s.sleeping, 'falls back asleep after the unverified 10-minute placeholder window');
  ok(s.sleepDist === 1, 'falling back asleep is not another disturbance');
  ok(s.callLightsAt == null, 'no second lights call that night (DMC: one call for sleep)');
}

console.log('3) Train and battle also wake; lights and flush do not');
{
  const s = nightAgumon();
  advance(s, 60);
  ok(Engine.disturbSleep(s, 'train').woken, 'train wakes');
  s.sleeping = true; s.awakeUntil = 0;
  ok(Engine.disturbSleep(s, 'battle').woken, 'battle wakes');
  s.sleeping = true; s.awakeUntil = 0;
  const dist = s.sleepDist;
  ok(!Engine.disturbSleep(s, 'lights').woken, 'lights is not a wake reason');
  ok(!Engine.disturbSleep(s, 'flush').woken, 'flush is not a wake reason');
  ok(s.sleeping, 'still sleeping after lights/flush');
  ok(s.sleepDist === dist, 'sleepDist unchanged');
}

console.log('4) toggleLights does not wake and does not start a second call');
{
  const s = nightAgumon();
  advance(s, 60);
  ok(s.sleeping && s.callLightsAt != null, 'precondition: asleep, called');
  Engine.toggleLights(s); // off
  ok(s.sleeping, 'still asleep after lights off');
  ok(s.callLightsAt == null, 'turning lights off clears the call');
  ok(s.sleepDist === 0, 'not a disturbance');
  Engine.toggleLights(s); // on again
  ok(s.sleeping, 'still asleep after lights on');
  ok(s.callLightsAt == null, 'turning lights on does not start a new call');
}

console.log('5) Lights-left-on care mistake still applies on the first fall-asleep');
{
  const s = nightAgumon();
  advance(s, 60);
  const started = s.callLightsAt;
  ok(started != null, 'call running');
  advance(s, 21 * 60);
  ok(s.calls === 0, '21 min is still inside the NHOKO 60 min lights window');
  ok(Engine.isCallLit(s), 'lights call icon stays on past the 20 min hunger timeout');
  advance(s, 40 * 60);
  ok(s.calls === 1, 'unanswered lights call is a care mistake after 60 min (NHOKO)');
  ok(s.sleeping, 'still asleep');
  ok(s.sleepDist === 0, 'that is a care mistake, not a sleep disturbance');
}

console.log('6) Natural morning wake at 8:00, no sleepDist, DP refill, new night can call again');
{
  const s = nightAgumon();
  s.dp = 0;
  advance(s, 60);
  ok(s.sleeping, 'asleep at night');
  // 22:00 + 10 hours = 8:00. Catch-up cap is 8h, so two steps.
  advance(s, 7 * 3600);
  advance(s, 4 * 3600);
  ok(!s.sleeping, 'awake in the morning');
  ok(s.sleepDist === 0, 'natural wake is not a disturbance');
  ok(s.dp === (s.dpMax || 4), 'DP refilled on natural morning wake');
  ok(!s.sleepCalledTonight, 'flag cleared for the new day');
}

console.log('7) Opening-food style: feedMeat while asleep uses the same rules');
{
  const s = nightAgumon();
  s.hunger = 2;
  advance(s, 60);
  const r = Engine.feedMeat(s);
  ok(r.ok, 'feed succeeds');
  ok(!s.sleeping, 'woken by feeding');
  ok(s.sleepDist === 1, 'disturbance counted');
  ok(s.hunger === 3, 'food still applied');
}

console.log('8) Old saves without awakeUntil / sleepCalledTonight still work');
{
  const s = nightAgumon();
  delete s.awakeUntil;
  delete s.sleepCalledTonight;
  advance(s, 60);
  ok(s.sleeping, 'falls asleep from a legacy save');
  const r = Engine.disturbSleep(s, 'food');
  ok(r.woken && s.awakeUntil > 0, 'fields are created on disturbance');
}

console.log('9) DISTURB_AWAKE_SEC is a 10-minute unverified placeholder, not an official figure');
ok(Engine.DISTURB_AWAKE_SEC === 600, '600 game-seconds (unverified placeholder)');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
