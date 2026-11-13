#!/usr/bin/env node
/**
 * Official 1997 care / call / Perfect / injury / lifespan engine rules.
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Engine = require('../js/engine.js');
const data = global.EvolutionData;

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

function form(id, extra) {
  const s = Engine.defaultState(1);
  s.mon = id;
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
  s.calls = 0;
  s.evoDueAt = (data.MONSTERS[id] && data.MONSTERS[id].lifespanMax) || 999999;
  if (extra) Object.assign(s, extra);
  return s;
}

function die16() {
  // Sequential 0..15 dice: floor(rng()*16) cycles through every face equally.
  let i = 0;
  return function () {
    const v = (i % 16) / 16;
    i++;
    return v;
  };
}

console.log('Engine official-rules tests');
console.log('===========================\n');

console.log('1) Calls: 20 min, one CM per empty period, hunger+strength is one call, no retrigger');
{
  const s = form('agumon', { hunger: 0, strength: 4, clockOffset: 10 * 3600 });
  advance(s, 1);
  ok(s.callAt != null, 'hunger call started');
  ok(Engine.isCallLit(s), 'call icon on while the call is open');
  eq(s.calls, 0, 'not yet a mistake');
  advance(s, 19 * 60);
  eq(s.calls, 0, 'still open just under 20 min');
  ok(Engine.isCallLit(s), 'icon still on just under 20 min');
  advance(s, 2 * 60);
  eq(s.calls, 1, 'one care mistake at 20 min');
  ok(s.callResolved, 'call resolved');
  ok(!Engine.isCallLit(s), 'icon off after the 20 min timeout');
  advance(s, 40 * 60);
  eq(s.calls, 1, 'no retrigger while still empty');
  // Fill hunger, empty again → new call
  s.hunger = 2;
  Engine.feedMeat(s); // clear
  s.hunger = 0;
  s.callAt = null; s.callResolved = false; s.emptyCallSince = null;
  advance(s, 21 * 60);
  eq(s.calls, 2, 'a new call starts only after the meter was filled');
}

{
  const s = form('agumon', { hunger: 0, strength: 0, clockOffset: 10 * 3600 });
  advance(s, 21 * 60);
  eq(s.calls, 1, 'hunger and strength empty together = one care mistake');
}

{
  const s = form('agumon', { hunger: 0, strength: 4, clockOffset: 10 * 3600, calls: 14 });
  advance(s, 21 * 60);
  eq(s.calls, 15, 'calls cap at 15');
  s.callResolved = false; s.callAt = null; s.hunger = 2; s.strength = 0;
  // force another: must stay at 15. Need to fill first then empty? already resolved at 15.
  // Start a fresh empty after fill:
  s.hunger = 2; s.strength = 2;
  advance(s, 1);
  s.hunger = 0;
  s.callAt = null; s.callResolved = false;
  advance(s, 21 * 60);
  eq(s.calls, 15, 'calls stay capped at 15');
}

console.log('2) 12 h starve from the call (hunger or strength), 13 h catch-up can fire it');
{
  const s = form('agumon', { hunger: 0, strength: 4, clockOffset: 10 * 3600 });
  advance(s, 12 * 3600 + 60);
  ok(s.dead && s.deadReason === '飢餓過久', '12 h unanswered hunger call starves (got ' + s.deadReason + ')');
}
{
  const s = form('agumon', { hunger: 4, strength: 0, clockOffset: 10 * 3600 });
  advance(s, 12 * 3600 + 60);
  ok(s.dead && s.deadReason === '飢餓過久', '12 h unanswered strength call also starves');
}
eq(Engine.MAX_CATCHUP, 13 * 3600, 'catch-up cap is 13 h so 12 h death can fire in one tick');
eq(Engine.DISTURB_AWAKE_SEC, 600, 'DISTURB_AWAKE_SEC stays the 10 min unverified placeholder');

console.log('3) Hunger / protein / weight');
{
  const s = form('agumon', { hunger: 2, weight: 20, clockOffset: 10 * 3600 });
  const r = Engine.feedMeat(s);
  ok(r.ok && !r.refused, 'meat accepted below 4 hearts');
  eq(s.hunger, 3, 'hunger +1');
  eq(s.weight, 21, 'meat +1 g');
}
{
  const s = form('agumon', { hunger: 4, satietyFilled: 4, weight: 20, clockOffset: 10 * 3600 });
  // Agumon satiety 24: hearts full, satietyFilled 4 < 24, further meats accepted, not OF
  const r = Engine.feedMeat(s);
  ok(r.ok && r.satiety && !r.refused, 'meat toward 満腹 (24) is accepted while hearts are full');
  eq(s.overfeed, 0, 'not an overfeed yet');
  eq(s.weight, 21, '満腹 meat still +1 g');
  s.satietyFilled = 24;
  const r2 = Engine.feedMeat(s);
  ok(r2.ok && r2.refused && r2.overfeed, 'refuse + overfeed once 満腹 is reached');
  eq(s.overfeed, 1, 'overfeed +1');
  const r3 = Engine.feedMeat(s);
  ok(!r3.ok && r3.reason === 'full', '1 h overfeed lock');
  s.gameTime += 3600;
  const r4 = Engine.feedMeat(s);
  ok(r4.ok && r4.overfeed, 'after the 1 h lock, another OF is allowed while still full');
}
{
  const s = form('botamon', { hunger: 4, satietyFilled: 4, weight: 5, clockOffset: 10 * 3600 });
  const r = Engine.feedMeat(s);
  ok(r.ok && r.refused, 'Baby I satiety 4: refuses once hearts are full');
}
{
  const s = form('agumon', { strength: 2, weight: 20, dp: 0, dpMax: 20, clockOffset: 10 * 3600 });
  Engine.feedProtein(s);
  eq(s.strength, 3, 'protein +1 strength');
  eq(s.weight, 22, 'protein +2 g');
  eq(s.proteinRemainder, 1, 'remainder 1');
  eq(s.dp, 0, 'no Energy yet');
  Engine.feedProtein(s);
  Engine.feedProtein(s);
  Engine.feedProtein(s);
  eq(s.proteinRemainder, 0, 'wraps every 4');
  eq(s.overdose, 1, 'overdose +1');
  eq(s.proteinPowerUp, 1, 'power-up +1');
  eq(s.dp, 1, 'Energy +1');
  eq(Engine.enhancement(s), Math.floor(Math.max(1 + s.strength - 0, 0) / 2), 'boost formula');
  // remainder carries across evolution
  s.proteinRemainder = 2;
  s.proteinPowerUp = 3;
  s.overdose = 5;
  Engine.evolveTo(s, 'greymon', 'test');
  eq(s.proteinRemainder, 2, 'proteinRemainder carries across evolution');
  eq(s.proteinPowerUp, 0, 'power-up resets');
  eq(s.overdose, 0, 'overdose resets');
  eq(s.calls, 0, 'calls reset');
}

console.log('4) Injury / heal / death clocks');
{
  const s = form('agumon', { clockOffset: 10 * 3600, injuries: 0 });
  // Forced injury
  s.injured = false;
  // Use a die that always hits: Agumon base 2 → t=3, die 0 succeeds
  s.dp = 5;
  const r = Engine.recordBattle(s, 'win', () => 0);
  ok(r.ok, 'battle recorded');
  ok(s.injured, 'injury roll after every battle (die 0, base 2 → 3/16, hits)');
  const t0 = s.injuredAt;
  s.dp = 5;
  const refused = Engine.recordBattle(s, 'loss', () => 0);
  ok(refused && refused.ok === false && refused.reason === 'injured', 'cannot start a new battle while injured');
  eq(s.injuredAt, t0, 'refused battle does not touch the 6 h clock');
  // Official set_injured while already injured: injuries increment, clock stays.
  Engine.injure(s, 'poop');
  eq(s.injuredAt, t0, 'already-injured: 6 h clock is not reset');
  ok(s.injuries >= 2, 'injuries still increment');
  // 6 h untreated
  advance(s, 6 * 3600 + 10);
  ok(s.dead && s.deadReason === '受傷未治療', '6 h untreated injury death');
}
{
  const s = form('agumon', { clockOffset: 10 * 3600 });
  s.injured = true; s.injuredAt = 0; s.healProgress = 0; s.gameTime = 10;
  // Agumon healDoses = 2
  const h1 = Engine.heal(s);
  ok(h1.ok && h1.needMore && h1.remaining === 1, 'first dose is not enough (Agumon 2 doses)');
  ok(s.injured, 'still injured');
  const h2 = Engine.heal(s);
  ok(h2.ok && !h2.remaining, 'second dose heals');
  ok(!s.injured, 'cleared');
}
{
  const s = form('mamemon', { clockOffset: 10 * 3600, dp: 5 });
  // Mamemon base 0, overdose 0: 1/16. die 15 never? die 0 hits (0 < 1).
  // Hole at s===15: never
  ok(!Engine.rollBattleInjury(0, 15, () => 0), 'firmware hole at s===15: never injured');
  ok(Engine.rollBattleInjury(0, 0, () => 0), 'Mamemon 1/16: die 0 hits');
  ok(!Engine.rollBattleInjury(0, 0, () => 15 / 16), 'Mamemon 1/16: die 15 misses');
}
{
  const s = form('agumon', { clockOffset: 10 * 3600, injuries: 19, injured: false });
  // injure once more via poop path: set injuries 19 and force injure by 8 piles over time is slow.
  // Direct: recordBattle that hits
  s.dp = 2;
  Engine.recordBattle(s, 'win', () => 0);
  advance(s, 2);
  ok(s.dead && s.deadReason === '受傷次數過多', '20 injuries in a form is death (got ' + s.deadReason + ', injuries=' + s.injuries + ')');
}

console.log('5) Perfect evolution rolls and Child→Adult carry');
{
  // Distribution: 16 equally likely dice
  let hit = 0;
  const rng = die16();
  for (let i = 0; i < 16; i++) if (Engine.rollPerfect(0, rng)) hit++;
  eq(hit, 2, 'winScore 0–4: 2/16 = 1/8');
  hit = 0;
  const rng2 = die16();
  for (let i = 0; i < 16; i++) if (Engine.rollPerfect(5, rng2)) hit++;
  eq(hit, 4, 'winScore 5–8: 4/16 = 1/4');
  hit = 0;
  const rng3 = die16();
  for (let i = 0; i < 16; i++) if (Engine.rollPerfect(9, rng3)) hit++;
  eq(hit, 8, 'winScore 9–15: 8/16 = 1/2');
  hit = 0;
  const rng4 = die16();
  for (let i = 0; i < 16; i++) if (Engine.rollPerfect(4, rng4)) hit++;
  eq(hit, 2, 'winScore 4 is still the 1/8 band');
  hit = 0;
  const rng5 = die16();
  for (let i = 0; i < 16; i++) if (Engine.rollPerfect(8, rng5)) hit++;
  eq(hit, 4, 'winScore 8 is still the 1/4 band');
  hit = 0;
  const rng6 = die16();
  for (let i = 0; i < 16; i++) if (Engine.rollPerfect(15, rng6)) hit++;
  eq(hit, 8, 'winScore 15 is the 1/2 band');
}

{
  const s = form('greymon', {
    battles: 14, wins: 14, winScore: 15, perfectQualified: false,
    gameTime: 128 * 3600, evoDueAt: 120 * 60, stageEnteredGame: 0,
    clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s, () => 0);
  ok(!ev && s.mon === 'greymon', '14 battles: Adult never becomes Perfect');
  ok(s.lifespanElapsed, 'failed Perfect starts old-age');
}

{
  const s = form('greymon', {
    battles: 15, wins: 10, winScore: 10, perfectQualified: false,
    gameTime: 128 * 3600, evoDueAt: 120 * 60, stageEnteredGame: 0,
    clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s, () => 0); // die 0 < 8, success
  ok(ev && s.mon === 'metalgreymon', '15 battles + successful Adult roll → MetalGreymon (got ' + s.mon + ')');
}

{
  const s = form('greymon', {
    battles: 15, wins: 10, winScore: 10, perfectQualified: false,
    gameTime: 128 * 3600, evoDueAt: 120 * 60, stageEnteredGame: 0,
    clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s, () => 0.99); // die 15, fail
  ok(!ev && s.mon === 'greymon', 'failed Adult roll stays Champion');
  // Second tick must not re-roll into a success
  const ev2 = Engine.tryEvolve(s, () => 0);
  ok(!ev2 && s.mon === 'greymon', 'failed roll is not retried every tick');
}

{
  // Child success carries; Adult does not need a second success
  const s = form('agumon', {
    battles: 15, wins: 12, winScore: 12, train: 40, calls: 0,
    perfectQualified: false,
    gameTime: 80 * 3600, evoDueAt: 72 * 60, stageEnteredGame: 0,
    clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s, () => 0);
  ok(ev && s.mon === 'greymon', 'Child with 32+ train evolves to Greymon (got ' + s.mon + ')');
  eq(s.battles, 15, 'battles carry Child→Adult');
  eq(s.winScore, 12, 'winScore carries');
  eq(s.calls, 0, 'calls reset on evolution');
  eq(s.train, 0, 'train resets on evolution');
  ok(s.perfectQualified, 'Child-stage success sets perfectQualified');
  // Jump to Greymon window
  s.gameTime = s.stageEnteredGame + 128 * 3600;
  s.evoDueAt = 120 * 60;
  // Even a failing Adult die would still evolve because the Child bit is enough
  const ev2 = Engine.tryEvolve(s, () => 0.99);
  ok(ev2 && s.mon === 'metalgreymon', 'Child success is enough at Adult, no second success required (got ' + s.mon + ')');
}

{
  // Child fail, Adult success still evolves
  const s = form('agumon', {
    battles: 15, wins: 12, winScore: 12, train: 40, calls: 0,
    perfectQualified: false,
    gameTime: 80 * 3600, evoDueAt: 72 * 60, stageEnteredGame: 0,
    clockOffset: 10 * 3600
  });
  Engine.tryEvolve(s, () => 0.99); // Child fail
  ok(s.mon === 'greymon' && !s.perfectQualified, 'Child fail still evolves to Adult, bit is off');
  s.gameTime = s.stageEnteredGame + 128 * 3600;
  s.evoDueAt = 120 * 60;
  const ev2 = Engine.tryEvolve(s, () => 0);
  ok(ev2 && s.mon === 'metalgreymon', 'Adult success after Child fail still evolves (got ' + s.mon + ')');
}

{
  // Both fail → stay
  const s = form('agumon', {
    battles: 15, wins: 12, winScore: 12, train: 40, calls: 0,
    gameTime: 80 * 3600, evoDueAt: 72 * 60, stageEnteredGame: 0,
    clockOffset: 10 * 3600
  });
  Engine.tryEvolve(s, () => 0.99);
  s.gameTime = s.stageEnteredGame + 128 * 3600;
  s.evoDueAt = 120 * 60;
  Engine.tryEvolve(s, () => 0.99);
  ok(s.mon === 'greymon' && s.lifespanElapsed, 'both rolls fail: stays Champion, old-age begins');
}

console.log('6) Sleep hours, lifespan windows, DP refill, no hunger gift, 5-CM old-age');
{
  const dues = [];
  for (let i = 0; i < 40; i++) {
    const s = form('greymon');
    Engine.rollEvoDueAt(s, Math.random);
    dues.push(s.evoDueAt);
  }
  ok(dues.every((d) => d >= 7200 && d <= 7680), 'Greymon evoDueAt is inside 120–128 h (got ' + Math.min(...dues) + '–' + Math.max(...dues) + ')');
  ok(dues.every((d) => d !== 72 * 60), 'never the old flat 72 h');
}
{
  const dues = [];
  for (let i = 0; i < 40; i++) {
    const s = form('koromon');
    Engine.rollEvoDueAt(s, Math.random);
    dues.push(s.evoDueAt);
  }
  ok(dues.every((d) => d >= 2400 && d <= 2880), 'Koromon evoDueAt is 40–48 h, not 24 (got ' + Math.min(...dues) + '–' + Math.max(...dues) + ')');
}
{
  const s = form('betamon', { clockOffset: 21 * 3600, gameTime: 0 });
  // Betamon sleeps 20:00–09:00
  ok(Engine.isSleepHours(s), 'Betamon is in sleep hours at 21:00');
  s.clockOffset = 10 * 3600;
  ok(!Engine.isSleepHours(s), 'Betamon is awake at 10:00');
}
{
  const s = form('agumon', { clockOffset: 22 * 3600, dp: 0, dpMax: 20, hunger: 1, strength: 1 });
  advance(s, 5);
  ok(s.sleeping, 'asleep at 22:00 (default 21–08 still covers this if care not forcing 19:00)');
  // 8 h 0 min of continuous sleep ending at morning: 22:00 + 10 h = 08:00
  advance(s, 8 * 3600);
  // still before 08:00? 22+8=06:00, still sleeping
  ok(s.sleeping, 'still asleep at 06:00');
  eq(s.dp, 0, 'DP not refilled mid-sleep');
  advance(s, 2 * 3600);
  ok(!s.sleeping, 'natural morning wake');
  eq(s.dp, 20, '≥8 h continuous natural morning refills DP to dpMax');
  eq(s.hunger, 1, 'no invented hunger gift on morning wake');
  eq(s.strength, 1, 'no invented strength gift on morning wake');
}
{
  // 5 CM after lifespanElapsed
  const s = form('greymon', {
    lifespanElapsed: true, oldAgeMistakes: 4, calls: 4,
    hunger: 0, strength: 4, clockOffset: 10 * 3600, gameTime: 0
  });
  advance(s, 21 * 60);
  eq(s.oldAgeMistakes, 5, 'fifth CM after the window');
  ok(s.dead && s.deadReason === '壽終', '5th CM after lifespan elapsed is old-age death (got ' + s.deadReason + ')');
}
{
  // no 1.6× death
  const s = form('greymon', {
    gameTime: 128 * 3600 * 3, stageEnteredGame: 0, evoDueAt: 120 * 60,
    battles: 0, lifespanElapsed: true, oldAgeMistakes: 0,
    clockOffset: 10 * 3600, hunger: 4, strength: 4
  });
  // a short tick — should not die of 1.6×
  advance(s, 60);
  ok(!s.dead, 'no lifespan×1.6 death (still alive after long time with 0 old-age CM)');
}

console.log('7) Jogress: 5 wins, wrong partner refused');
{
  const s = form('blitzgreymon', { tagWins: 5, clockOffset: 10 * 3600 });
  const bad = Engine.tryJogress(s, 'wargreymon');
  ok(!bad.ok && bad.reason === 'not-pair', 'wrong partner refused');
  const good = Engine.tryJogress(s, 'cresgarurumon');
  ok(good.ok && s.mon === 'omegamon_alters', 'BlitzGreymon + CresGarurumon, 5 tag wins → Omegamon Alter-S (got ' + s.mon + ')');
  eq(s.tagWins, 0, 'tag wins reset');
}
{
  const s = form('blitzgreymon', { tagWins: 4, clockOffset: 10 * 3600 });
  const r = Engine.tryJogress(s, 'cresgarurumon');
  ok(!r.ok && r.reason === 'need-tags', '4 tag wins is not enough');
}

console.log('8) Save migration');
{
  const old = {
    mon: 'agumon', hunger: 3, strength: 2, train: 5, battles: 8, wins: 5, losses: 3,
    gameTime: 50 * 3600, stageEnteredGame: 0, lastReal: Date.now(),
    calls: 1, weight: 22, dp: 1, dpMax: 3, speed: 1, lights: true, sleeping: false, dead: false
  };
  const s = Engine.migrateState(old);
  eq(s.winScore, 2, 'winScore migrated from wins−losses (5−3=2)');
  ok(s.evoDueAt >= 4320 && s.evoDueAt <= 4800, 'Agumon still inside window at 50 h: evoDueAt rolled in 72–80 h (got ' + s.evoDueAt + ')');
  eq(s.dpMax, 20, 'dpMax raised to NHOKO Energy without a free refill');
  eq(s.dp, 1, 'existing DP not gifted up to the new max');
  ok(s.proteinRemainder === 0 && s.perfectQualified === false, 'new fields defaulted');
}
{
  const old = {
    mon: 'greymon', hunger: 4, strength: 4,
    gameTime: 200 * 3600, stageEnteredGame: 0, lastReal: Date.now(),
    battles: 15, wins: 15, losses: 0, dp: 2, dpMax: 4, speed: 1, dead: false, lights: true
  };
  const s = Engine.migrateState(old);
  eq(s.evoDueAt, 200 * 60, 'already past the 128 h max: evoDueAt is "due now" (stage minutes)');
  s.perfectQualified = true;
  s.winScore = 15;
  const ev = Engine.tryEvolve(s, () => 0);
  ok(ev && s.mon === 'metalgreymon', 'migrated overdue Greymon evolves on the next check (got ' + s.mon + ')');
}

console.log('9) Mega: 48 h awake, 0–2 calls; 3 stays; Monzaemon has no mega');
{
  const s = form('metalgreymon', {
    calls: 1, awakeInStage: 48 * 3600, megaChecked: false,
    gameTime: 48 * 3600, evoDueAt: 108 * 60, clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s);
  ok(ev && s.mon === 'blitzgreymon', 'MetalGreymon, 0–2 CM, 48 h awake → BlitzGreymon (got ' + s.mon + ')');
}
{
  const s = form('metalgreymon', {
    calls: 3, awakeInStage: 48 * 3600, megaChecked: false,
    gameTime: 48 * 3600, evoDueAt: 108 * 60, clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s);
  ok(!ev && s.mon === 'metalgreymon', '3 care mistakes: stays Ultimate');
}
{
  const s = form('monzaemon', {
    calls: 0, awakeInStage: 200 * 3600, gameTime: 200 * 3600,
    evoDueAt: 104 * 60, clockOffset: 10 * 3600
  });
  const ev = Engine.tryEvolve(s);
  ok(!ev && s.mon === 'monzaemon', 'Monzaemon has no Mega');
  ok(s.lifespanElapsed, 'no-mega Perfect starts old-age after its window');
}

console.log('10) Ver.1 training open counts; cancel does not double-count');
{
  const s = form('agumon', { train: 0, weight: 20, clockOffset: 10 * 3600 });
  Engine.noteTrainingOpened(s);
  eq(s.train, 1, 'Ver.1: opening the training menu counts');
  Engine.cancelTraining(s);
  eq(s.train, 1, 'cancel does not count twice');
  eq(s.weight, 20, 'cancel does not change weight');
  Engine.finishTraining(s, true, true);
  eq(s.train, 2, 'a direct finishTraining (no prior open) still counts, as tests/engine use');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
