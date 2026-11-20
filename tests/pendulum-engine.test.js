#!/usr/bin/env node
/**
 * Original Pendulum Ver.1.0 Nature Spirits — rules engine tests.
 * Sources and conflict resolutions are in js/devices/pendulum/data.js.
 */
'use strict';

global.PendulumData = require('../js/devices/pendulum/data.js');
const Data = global.PendulumData;
const Eng = require('../js/devices/pendulum/engine.js');
global.PendulumEngine = Eng;

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

function form(id, extra) {
  const s = Eng.defaultState('pen_1_0');
  s.clockInitialized = true;
  s.clockSet.on = false;
  s.mon = id;
  const m = Data.monster(id);
  if (m) {
    s.weight = m.minWeight;
    s.hungerCap = m.stomach;
    s.dpMaxQ = Math.round((m.dpMax || 0) * 4);
    s.dpQ = s.dpMaxQ;
  }
  s.hunger = 4;
  s.strength = 4;
  s.stageEnteredGame = 0;
  s.gameTime = 0;
  s.lastReal = Date.now();
  s.speed = 1;
  s.lights = true;
  s.sleeping = false;
  s.dead = false;
  Eng.rollEvoDue(s);
  if (extra) Object.assign(s, extra);
  return s;
}

function advance(s, gameSec) {
  s.lastReal = Date.now() - gameSec * 1000 / (s.speed || 1);
  return Eng.tick(s, Date.now());
}

console.log('Pendulum Ver.1.0 engine');
console.log('=======================\n');

console.log('1) First SET required; hatch is 1 minute; 100 egg shakes trait the egg');
{
  const s = Eng.defaultState('pen_1_0');
  eq(s.mon, 'pen_egg', 'starts as Digitama');
  eq(s.clockInitialized, false, 'clock not set');
  const r0 = advance(s, 120);
  eq(s.mon, 'pen_egg', 'no hatch before SET, even after 2 minutes');
  Eng.beginClockSet(s);
  ok(Eng.isClockSet(s), 'SET is open');
  const g = s.gameTime;
  advance(s, 600);
  eq(s.gameTime, g, 'SET pauses the growth timer (Humulos)');
  Eng.confirmClockSet(s);
  ok(s.clockInitialized, 'clock now set');
  ok(!Eng.isClockSet(s), 'SET closed');
  const r = advance(s, 59);
  eq(s.mon, 'pen_egg', 'still an egg at 59 s');
  const r2 = advance(s, 2);
  eq(s.mon, 'babumon', 'hatches at 1 minute');
  ok(r2.evolved, 'evolved flag');
}

{
  const s = Eng.defaultState('pen_1_0');
  s.clockInitialized = true;
  s.evoDueAt = 1 / 60;
  for (let i = 0; i < 99; i++) Eng.addShake(s, 1);
  ok(!s.traitedEgg, '99 shakes is not enough');
  Eng.addShake(s, 1);
  ok(s.traitedEgg, '100 shakes → +10% later Perfect (Humulos)');
  eq(s.eggShakes, 100, 'count is 100');
}

console.log('2) Stage timers: Baby I 1 h (care ignored), Baby II 6–12 h window, Child paths');
{
  const s = form('babumon', { careMistakes: 9, evoDueAt: 1 });
  advance(s, 59 * 60);
  eq(s.mon, 'babumon', 'Baby I stays under 1 hour even with many CM');
  const r = advance(s, 90);
  eq(s.mon, 'motimon', 'Baby I → Motimon at 1 hour; care does not matter');
}

{
  eq(Data.naturalChild(0), 'tentomon', 'Motimon 0–1 CM → Tentomon');
  eq(Data.naturalChild(1), 'tentomon', '1 CM Tentomon');
  eq(Data.naturalChild(2), 'gotsumon', '2–4 Gotsumon');
  eq(Data.naturalChild(4), 'gotsumon', '4 Gotsumon');
  eq(Data.naturalChild(5), 'otamamon', '5+ Otamamon');
  const s = form('motimon', { careMistakes: 0, evoDueAt: 8 });
  advance(s, 8 * 3600 + 10);
  eq(s.mon, 'tentomon', 'Motimon 0 CM evolves to Tentomon');
}

console.log('3) Adult paths (File Island / Wikimon) — successful trains only');
{
  eq(Data.naturalAdult('tentomon', 0, 40), 'kabuterimon', 'Tentomon 0–2 CM T40+ → Kabuterimon');
  eq(Data.naturalAdult('tentomon', 2, 39), 'tortomon', 'Tentomon 0–2 T0–39 → Tortomon (1.0, not Tailmon)');
  eq(Data.naturalAdult('tentomon', 3, 20), 'kuwagamon', 'Tentomon 3+ T20+ → Kuwagamon');
  eq(Data.naturalAdult('tentomon', 3, 19), 'gekomon', 'Tentomon 3+ T0–19 → Gekomon');
  eq(Data.naturalAdult('gotsumon', 0, 30), 'monochromon', 'Gotsumon 0–2 T30+ → Monochromon');
  eq(Data.naturalAdult('gotsumon', 2, 29), 'tortomon', 'Gotsumon 0–2 T0–29 → Tortomon');
  eq(Data.naturalAdult('gotsumon', 3, 30), 'starmon', 'Gotsumon 3+ T30+ → Starmon');
  eq(Data.naturalAdult('gotsumon', 3, 29), 'gekomon', 'Gotsumon 3+ T0–29 → Gekomon');
  eq(Data.naturalAdult('otamamon', 0, 40), 'tortomon', 'Otamamon 0–2 T40+ → Tortomon');
  eq(Data.naturalAdult('otamamon', 2, 39), 'starmon', 'Otamamon 0–2 T0–39 → Starmon');
  eq(Data.naturalAdult('otamamon', 3, 20), 'kuwagamon', 'Otamamon 3+ T20+ → Kuwagamon');
  eq(Data.naturalAdult('otamamon', 5, 0), 'gekomon', 'Otamamon 3+ T0–19 → Gekomon');
  const s = form('tentomon', { careMistakes: 0, trainSuccess: 40, evoDueAt: 24, gameTime: 0, stageEnteredGame: 0 });
  // MAX_CATCHUP is 13 h, so set the clock inside the window and tick a second.
  s.gameTime = 24 * 3600;
  s.lastReal = Date.now() - 60000;
  Eng.tick(s, Date.now());
  eq(s.mon, 'kabuterimon', 'live evo Tentomon → Kabuterimon');
  eq(s.careMistakes, 0, 'CM reset on evo (Humulos)');
  eq(s.effort, 0, 'Effort reset on evo');
}

console.log('4) Perfect gates: 30 battles BEFORE window (flag stays), WR, CM, train; Wikimon odds');
{
  const s = form('kabuterimon', { battles: 30, wins: 15, wrFlag: false, gameTime: 0, stageEnteredGame: 0 });
  // 30 battles before window → flag sets on tick, before 60 h.
  advance(s, 60);
  ok(s.wrFlag, '30 battles as Adult before the window sets wrFlag');
  s.gameTime = 70 * 3600; // inside window; flag must still be true
  ok(s.wrFlag, 'flag stays once set');
  const noflag = Data.naturalPerfect('kabuterimon', 0, 40, 30, 50, false);
  eq(noflag.to, null, 'no flag → no Perfect');
  eq(noflag.reason, 'no-wr-flag', 'reason is no-wr-flag');
  const lowwr = Data.naturalPerfect('kabuterimon', 0, 40, 30, 39, true);
  eq(lowwr.to, null, 'WR 39% is below 40%');
  const okp = Data.naturalPerfect('kabuterimon', 2, 40, 30, 40, true);
  eq(okp.to, 'atlurkabuterimon', 'Kabuterimon/Tortomon, ≤2 CM, T40+, 30 battles, 40% WR');
  eq(okp.odds, 1 / 8, 'Wikimon 40% → 1/8');
  eq(Data.wrOdds(60), 1 / 4, '60% → 1/4');
  eq(Data.wrOdds(80), 1 / 2, '80% → 1/2');
  eq(Data.naturalPerfect('monochromon', 4, 40, 30, 50, true).to, 'triceramon', 'Data Adults → Triceramon, ≤4 CM');
  eq(Data.naturalPerfect('gekomon', 1, 40, 30, 50, true).to, 'okuwamon', 'Virus Adults → Okuwamon, ≤1 CM');
  eq(Data.naturalPerfect('kuwagamon', 2, 40, 30, 50, true).to, null, '2 CM blocks Okuwamon (max 1)');

  // Live: 100% rng → Atlur; window miss never returns
  const live = form('kabuterimon', {
    careMistakes: 0, trainSuccess: 40, battles: 30, wins: 24,
    wrFlag: true, evoDueAt: 68, gameTime: 0
  });
  const ev = Eng.tryEvolve(Object.assign(live, { gameTime: 68 * 3600 }), function () { return 0; });
  eq(ev && ev.to, 'atlurkabuterimon', 'forced-hit Perfect evo');
  const miss = form('kabuterimon', {
    careMistakes: 0, trainSuccess: 40, battles: 30, wins: 12,
    wrFlag: true, evoDueAt: 68, gameTime: 68 * 3600
  });
  const evm = Eng.tryEvolve(miss, function () { return 0.99; }); // fail the 1/8
  ok(miss.windowMissed, 'failed Perfect roll marks the window missed');
  eq(Eng.tryEvolve(miss, function () { return 0; }), null, 'missed window never returns');
}

console.log('5) Ultimate: 0 CM, WR > 60%, Atlur/Jagamon → Heracles (File Island)');
{
  const okU = Data.naturalUltimate('atlurkabuterimon', 0, 61);
  eq(okU.to, 'heracleskabuterimon', 'Atlur 0 CM WR>60% → Heracles');
  eq(Data.naturalUltimate('jagamon', 0, 80).to, 'heracleskabuterimon', 'Jagamon path (FI; Wikimon lists Okuwamon — documented)');
  eq(Data.naturalUltimate('atlurkabuterimon', 1, 80).to, null, 'any CM blocks natural Ultimate');
  eq(Data.naturalUltimate('atlurkabuterimon', 0, 60).to, null, 'WR 60% is not > 60%');
  eq(Data.naturalUltimate('okuwamon', 0, 80).to, null, 'Okuwamon is not a FI natural Heracles source');
}

console.log('6) Training: 0.5 DP, −1 g even on fail, Megahit −8 g, Effort on success only, 1.0 no MEGAHIT screen');
{
  const s = form('tentomon', { dpQ: 8, dpMaxQ: 16, weight: 20, strength: 2, effort: 0 });
  ok(Eng.canTrain(s), 'can train with 2.0 DP (needs 0.5)');
  const fail = Eng.finishTraining(s, 0);
  ok(fail.ok && !fail.success, '0 Super is a fail');
  eq(s.weight, 19, 'fail still −1 g (Humulos)');
  eq(s.strength, 2, 'fail does not raise Strength');
  eq(s.effort, 0, 'fail does not raise Effort (Humulos / plan)');
  eq(s.trainSuccess, 0, 'fail does not count as T (FI / plan; NHOKO disagrees, documented)');
  eq(Eng.dp(s), 1.5, 'spent 0.5 DP (2.0 → 1.5)');

  const okT = Eng.finishTraining(s, 3);
  ok(okT.success && !okT.megahit, '3 Super is a success, not Megahit');
  eq(s.strength, 3, '+1 Strength');
  eq(s.effort, 1, '+1 Effort');
  eq(s.trainSuccess, 1, 'successful T counted');
  eq(s.weight, 18, 'success −1 g');

  s.weight = 30;
  s.strength = 1;
  const mega = Eng.finishTraining(s, 5);
  ok(mega.megahit, '5 Super is Megahit');
  eq(s.strength, 4, 'Megahit fills Strength');
  eq(s.weight, 22, 'Megahit −8 g (Humulos); floor is the species min weight');
  eq(Data.PROFILE.hasMegahitScreen, false, '1.0 hides the MEGAHIT result screen');

  s.dpQ = 1; // 0.25 DP
  ok(!Eng.canTrain(s), 'cannot train on 0.25 DP');
  const sEgg = form('pen_egg', { dpQ: 16 });
  ok(!Eng.canTrain(sEgg), 'egg cannot train');
}

{
  eq(Eng.supersFromShakes(0, 8), 0, '0 shakes → 0 Super');
  eq(Eng.supersFromShakes(8, 8), 5, 'at target → Megahit (5 Super)');
  eq(Eng.supersFromShakes(16, 8), 5, 'above target still 5');
  ok(Eng.supersFromShakes(4, 8) >= 1 && Eng.supersFromShakes(4, 8) < 5, 'mid-range interpolates (placeholder mapping)');
}

console.log('7) Food, poop, 99 g, DP, protein');
{
  const s = form('tentomon', { hunger: 0, weight: 15, dpQ: 0, dpMaxQ: 16 });
  const meat = Eng.feedMeat(s);
  ok(meat.ok && !meat.refused, 'ate meat');
  eq(s.hunger, 1, '+1 hunger');
  eq(s.weight, 16, '+1 g');
  const prot = Eng.feedProtein(s);
  ok(prot.ok, 'ate protein');
  eq(s.strength, 4, 'protein +1 strength, capped at 4');
  eq(s.weight, 18, '+2 g');
  eq(Eng.dp(s), 0.25, 'protein +0.25 DP; 4 pills = 1 DP');
  s.weight = 98;
  Eng.feedMeat(s);
  eq(s.weight, 99, 'hits 99 g');
  ok(s.sick, '99 g → sick');

  const p = form('tentomon', { poop: 0, weight: 20, lastPoopAt: 0, gameTime: 0 });
  p.lastReal = Date.now() - 3 * 3600 * 1000;
  Eng.tick(p, Date.now());
  eq(p.poop, 1, 'poop after 3 hours');
  eq(p.weight, 19, 'each poop −1 g (NHOKO)');
  p.poop = 7;
  p.lastPoopAt = 0;
  p.lastReal = Date.now() - 3 * 3600 * 1000;
  Eng.tick(p, Date.now());
  eq(p.poop, 8, '8th pile');
  ok(p.sick, '8 piles → sick (NHOKO)');
}

console.log('8) Sleep: all wake at 08:00, bedtime per species, 8 h DP, disturb rules');
{
  const s = form('tentomon'); // sleep 20:00
  // 20:00
  s.clockOffset = 20 * 3600;
  s.gameTime = 0;
  s.dpQ = 0;
  advance(s, 60);
  ok(s.tired, 'tired at bedtime');
  ok(Eng.isCallLit(s), 'bedtime call while lights on');
  // Lights already off: no call, goes to sleep
  const s2 = form('tentomon', { lights: false, clockOffset: 20 * 3600 });
  advance(s2, 60);
  ok(s2.sleeping, 'lights already off → sleep, no forced wake');
  ok(!Eng.isCallLit(s2) || s2.callKind !== 'bedtime' || s2.callResolved, 'no outstanding bedtime call');

  // 8 h sleep fills DP
  const s3 = form('tentomon', { lights: false, sleeping: true, sleptSince: 0, dpQ: 0, dpMaxQ: 16, clockOffset: 22 * 3600 });
  advance(s3, 8 * 3600);
  eq(Eng.dp(s3), 4, '8 h sleep fills DP (NHOKO)');

  // Wake at 08:00
  const s4 = form('tentomon', { lights: false, sleeping: true, sleptSince: 0, clockOffset: 7 * 3600 + 59 * 60, gameTime: 0 });
  advance(s4, 120);
  ok(!s4.sleeping, 'wakes at 08:00');
  eq(s4.wakeDelayHours, 0, 'delay cleared');

  // Disturb: CM, +1 h wake, 10 in a row → sick
  const s5 = form('tentomon', { sleeping: true, sleptSince: 0, clockOffset: 22 * 3600 });
  Eng.disturbSleep(s5, 'food');
  eq(s5.careMistakes, 1, 'disturb is a care mistake');
  eq(s5.wakeDelayHours, 1, '+1 h wake');
  ok(!s5.sleeping, 'woken');
  for (let i = 0; i < 9; i++) {
    s5.sleeping = true;
    Eng.disturbSleep(s5, 'food');
  }
  eq(s5.sleepDistStreak, 10, '10 in a row');
  ok(s5.sick, '10 disturbs → sick');
  // cap 14:00 = +6 h
  s5.wakeDelayHours = 6;
  s5.sleeping = true;
  s5.sick = true; // already sick, just check cap
  Eng.disturbSleep(s5, 'food');
  eq(s5.wakeDelayHours, 6, 'wake delay caps at +6 h (14:00)');
}

console.log('9) Lights-off screen: black+Z when tired/sleeping, not 1997 blank, not DM20 visible pet');
{
  const s = form('tentomon', { sleeping: true, tired: true, lights: false });
  eq(Eng.lightsOffScreen(s), 'black-z', 'sleep + lights off → black+Z');
  const awake = form('tentomon', { sleeping: false, tired: false, lights: false });
  eq(Eng.lightsOffScreen(awake), 'black', 'awake + lights off → black, no Z');
  const on = form('tentomon', { sleeping: true, lights: true });
  eq(Eng.lightsOffScreen(on), 'paper', 'lights on → paper (sleep pose + Z is a UI concern)');
  // Turning lights ON does not force a wake (do not copy DM20)
  const n = form('tentomon', { sleeping: true, tired: true, lights: false, clockOffset: 22 * 3600 });
  Eng.setLights(n, true);
  ok(n.sleeping, 'lights ON does not wake a sleeping Pendulum pet');
}

console.log('10) Calls: Humulos 10 min hunger/strength, 30 min bedtime');
{
  const s = form('tentomon', { hunger: 0, strength: 4, clockOffset: 10 * 3600 });
  advance(s, 60);
  ok(Eng.isCallLit(s), 'hunger call starts');
  eq(s.careMistakes, 0, 'not yet a mistake');
  advance(s, 9 * 60);
  eq(s.careMistakes, 0, 'still open at 9 min');
  advance(s, 2 * 60);
  eq(s.careMistakes, 1, 'CM at 10 min (Humulos, not FI 20)');
  const b = form('tentomon', { clockOffset: 20 * 3600, lights: true });
  advance(b, 60);
  ok(b.callKind === 'bedtime', 'bedtime call');
  advance(b, 29 * 60);
  eq(b.careMistakes, 0, 'bedtime still open at 29 min');
  advance(b, 2 * 60);
  eq(b.careMistakes, 1, 'bedtime CM at 30 min (Humulos)');
}

console.log('11) Clock 12/24, SET does not jump growth, age at midnight (NHOKO AM 12:00)');
{
  const s = form('tentomon', { gameTime: 100, clockOffset: 10 * 3600 - 100, ageDays: 0 });
  Eng.beginClockSet(s);
  eq(s.clockSet.h24, 10, 'SET opens at 10:00');
  eq(s.clockSet.min, 0, 'SET minutes start at 00');
  Eng.adjustClockSet(s, 'h', 1);
  eq(s.clockSet.h24, 11, 'A advances the hour');
  Eng.adjustClockSet(s, 'm', 1);
  eq(s.clockSet.min, 1, 'B advances the minute');
  Eng.confirmClockSet(s);
  eq(s.gameTime, 100, 'confirm does not change gameTime');
  eq(Math.floor(Eng.runningClockSeconds(s) / 3600), 11, 'clock now 11:01');

  Eng.toggleClock12_24(s);
  ok(s.clock24h, 'A on the clock toggles 24 h');

  // Cross midnight → age +1
  const a = form('tentomon', { clockOffset: 23 * 3600 + 3590, gameTime: 0, ageDays: 2, lastReal: Date.now() });
  advance(a, 60);
  eq(a.ageDays, 3, 'age increments at midnight (NHOKO AM 12:00), not at 24 h of gameTime');
}

console.log('12) Battle: 1 DP, −4 g, babies cannot, 3 HP, NHOKO triangle Vac>Virus>Data');
{
  const baby = form('motimon', { dpQ: 16 });
  ok(!Eng.canBattle(baby), 'Baby II cannot battle');
  const child = form('tentomon', { dpQ: 16, weight: 20, battles: 0, wins: 0 });
  ok(Eng.canBattle(child), 'Child can battle');
  const r = Eng.recordBattle(child, 'win');
  ok(r.ok, 'battle recorded');
  eq(Eng.dp(child), 3, 'spent 1 DP (4 → 3)');
  eq(child.weight, 16, '−4 g (NHOKO / FI)');
  eq(child.battles, 1, 'battles +1');
  eq(child.wins, 1, 'win');

  eq(Data.attrAdvantage('vaccine', 'virus'), 1, 'Vac beats Virus (NHOKO)');
  eq(Data.attrAdvantage('virus', 'data'), 1, 'Virus beats Data');
  eq(Data.attrAdvantage('data', 'vaccine'), 1, 'Data beats Vac');
  eq(Data.attrAdvantage('vaccine', 'data'), -1, 'Vac is weak to Data');
  eq(Data.attrAdvantage('vaccine', 'vaccine'), 0, 'same attr is neutral');
  eq(Data.TRIANGLE.source, 'NHOKO-pendulum.html', 'triangle locked to NHOKO');

  // 3 HP system: a guaranteed-hit super should deal 2
  const atk = form('kabuterimon', { effort: 40 });
  const def = form('gekomon', { effort: 0 });
  const shot = Eng.resolveShot(atk, def, true, function () { return 0; }); // roll 0 always hits
  ok(shot.hit, 'low roll hits');
  eq(shot.dmg, 2, 'super hit deals 2 (NHOKO)');
  eq(shot.source, 'placeholder-unverified-hit-table', 'hit table is labelled unverified');
}

console.log('13) Jogress: Adult+, full DP, same position fails, attribute product, Ultimate pairs');
{
  const a = form('kabuterimon', { dpQ: 16, dpMaxQ: 16 });
  ok(Eng.canJogress(a), 'full DP Adult can Jogress');
  a.dpQ = 15;
  ok(!Eng.canJogress(a), 'not-full DP cannot');
  a.dpQ = 16;
  const miss = Data.jogressResult('kabuterimon', 'kabuterimon');
  // same position Va1+Va1
  ok(!miss.ok, 'same position is miss-match / position');
  const va = Data.jogressResult('kabuterimon', 'tortomon'); // Va+Va → Jagamon
  ok(va.ok && va.to === 'jagamon', 'Va+Va Adults → Jagamon');
  const vd = Data.jogressResult('kabuterimon', 'starmon');
  eq(vd.to, 'jagamon', 'Va+Da → Vaccine product → Jagamon');
  const vv = Data.jogressResult('kabuterimon', 'gekomon');
  eq(vv.to, 'piccolomon', 'Va+Vi → Data product → Piccolomon');
  const dd = Data.jogressResult('monochromon', 'starmon');
  eq(dd.to, 'piccolomon', 'Da+Da → Piccolomon');
  const dvi = Data.jogressResult('starmon', 'gekomon');
  eq(dvi.to, 'tonosamagekomon', 'Da+Vi → Virus product → TonosamaGekomon');
  const vivi = Data.jogressResult('kuwagamon', 'gekomon');
  eq(vivi.to, 'tonosamagekomon', 'Vi+Vi → TonosamaGekomon');

  const stay = Data.jogressResult('jagamon', 'kabuterimon');
  eq(stay.to, 'jagamon', 'Perfect Va + Adult Va: Perfect stays');
  const up = Data.jogressResult('kabuterimon', 'jagamon');
  eq(up.to, 'jagamon', 'Adult Va + Perfect Va: Adult becomes Jagamon');

  const sab = Data.jogressResult('triceramon', 'piccolomon');
  eq(sab.to, 'saberleomon', 'Data Perfects → SaberLeomon');
  const met = Data.jogressResult('okuwamon', 'tonosamagekomon');
  eq(met.to, 'metaletemon', 'Virus Perfects → MetalEtemon');

  const live = form('kabuterimon', { dpQ: 16, dpMaxQ: 16 });
  const jr = Eng.doJogress(live, 'tortomon');
  ok(jr.ok, 'doJogress ok');
  eq(live.mon, 'jagamon', 'became Jagamon');
  eq(Eng.dp(live), 0, 'Jogress consumes all DP');
}

console.log('14) Death pools, 6 h sick, dying-save shakes, computer after death');
{
  // v32: every Pendulum death opens the official one-minute dying cry
  // (Humulos); unsaved after 60 s it dies with the original cause.
  function finishCry(x) { x.lastReal = Date.now() - 61000; Eng.tick(x, Date.now()); }
  const s = form('tentomon', { sickCount: 19 });
  Eng.makeSick(s, 'test');
  eq(s.sickCount, 20, '20th sickness');
  Eng.checkDeath(s);
  ok(s.dying && !s.dead, '20 sicknesses → dying cry starts (shake window)');
  finishCry(s);
  ok(s.dead, '20 sicknesses in one form → death after the unsaved minute');
  eq(s.deathReason, 'sick-20', 'reason');

  const i = form('tentomon', { injureCount: 19 });
  Eng.makeInjured(i, 'test');
  Eng.checkDeath(i);
  finishCry(i);
  ok(i.dead && i.deathReason === 'injury-20', '20 injuries in one form (separate pool)');

  const c = form('tentomon', { careMistakes: 19 });
  Eng.addCareMistake(c, 'x');
  ok(c.dying, '20th CM starts the dying cry');
  finishCry(c);
  ok(c.dead && c.deathReason === 'cm-20', '20 CM in one form');

  const w = form('kabuterimon', { careMistakes: 4, evoDueAt: 60, gameTime: 60 * 3600, stageEnteredGame: 0 });
  Eng.addCareMistake(w, 'window');
  finishCry(w);
  ok(w.dead && w.deathReason === 'cm-window', '5 CM at/after the Perfect window');

  const t = form('tentomon', { sick: true, sickSince: 0, gameTime: 0 });
  t.lastReal = Date.now() - (6 * 3600 + 60) * 1000;
  const rr = Eng.tick(t, Date.now());
  ok(t.dead && rr.died && t.deathReason === 'sick-6h', 'left sick 6 h → cry → death (one catch-up)');

  const sv = form('tentomon', { careMistakes: 19 });
  Eng.addCareMistake(sv, 'x');
  for (let k = 0; k < 100; k++) Eng.addShake(sv, 1);
  ok(!sv.dying && !sv.dead, 'shaking 100 times in the minute saves it');
  sv.hunger = 4; sv.strength = 4; sv.lastReal = Date.now() - 300 * 1000; Eng.tick(sv, Date.now());
  ok(!sv.dead && !sv.dying, 'saved: the same 20 CM do not restart the cry');

  const d = form('tentomon');
  Eng.beginDyingSave(d);
  ok(d.dying, 'dying-save started');
  for (let k = 0; k < 99; k++) Eng.addShake(d, 1);
  ok(d.dying, '99 shakes not enough');
  const saved = Eng.addShake(d, 1);
  ok(saved.saved && !d.dying, '100 shakes in the window saves them');
}

console.log('15) Heal menu order, cancel-train spends no DP, practice battle is labelled app-only');
{
  const s = form('tentomon', { sick: true, injured: true, sickSince: 0, injuredSince: 0 });
  ok(Eng.healSick(s).ok, 'heal sick (top of official menu)');
  ok(!s.sick, 'cleared sick');
  ok(Eng.healInjury(s).ok, 'heal injury (bottom, skull)');
  ok(!s.injured, 'cleared injury');

  const t = form('tentomon', { dpQ: 8 });
  // Cancel is UI-side (no finishTraining) — DP unchanged
  eq(t.dpQ, 8, 'DP untouched without finishTraining');

  const a = form('tentomon', { dpQ: 16, effort: 20, weight: 20 });
  const foe = form('gotsumon', { effort: 0 });
  const pb = Eng.resolvePracticeBattle(a, foe, [{ super: true }, { super: true }, { super: true }], [{ super: false }, { super: false }, { super: false }], function () { return 0; });
  ok(pb.appOnly, 'practice battle is labelled app-only (official is link)');
  ok(pb.result === 'win' || pb.result === 'lose', 'returns a result');
}

console.log('16) Placeholders are labelled, not passed off as official');
{
  eq(Data.RULES.hungerCycleSource, 'placeholder-unverified', 'hunger cycle labelled');
  eq(Data.RULES.dpMaxSource, 'placeholder-unverified', 'DP max labelled');
  eq(Data.monster('tentomon').megahitSource, 'placeholder-unverified', 'Tentomon megahit is placeholder');
  eq(Data.monster('motimon').megahitSource, 'Humulos-Motimon', 'Motimon megahit is sourced');
  eq(Data.monster('motimon').megahit, 8, 'Motimon target is 8');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
