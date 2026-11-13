#!/usr/bin/env node
'use strict';
/**
 * 神聖計畫 / Digivice (1999) Ver.1 then Ver.2.
 * Sources: File Island Intro + Guide 1/2, Wikimon Toy + Version 1/2.
 */
global.DigiviceData = require('../js/devices/digivice/data.js');
const Data = global.DigiviceData;
const Eng = require('../js/devices/digivice/engine.js');
global.DigiviceEngine = Eng;
const Spr = require('../js/devices/digivice/sprites.js');
global.DigiviceSprites = Spr;
const Devices = require('../js/devices/registry.js');
global.Devices = Devices;
require('../js/devices/digivice/profiles.js');
const items = require('../js/items.js');
const Steps = require('../js/steps.js');
global.Steps = Steps;
const LO = require('../js/lights-off.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

function v1() { return Eng.defaultState('dv1999_v1'); }
function v2() { return Eng.defaultState('dv1999_v2'); }
function boot(s, starterIndex) {
  Eng.pickPartner(s, starterIndex == null ? 0 : starterIndex);
  Eng.confirmClock(s);
  return s;
}
function toChild(s) {
  s.childEvolveAt = 0;
  Eng.tick(s, Date.now());
  return s;
}

console.log('神聖計畫 / Digivice 1999');
console.log('========================\n');

console.log('1) Family, hatch, portraits, no 1997/pen20 capture');
{
  const s = v1();
  eq(s.family, 'digivice', 'family');
  eq(s.version, 1, 'Ver.1');
  eq(s.deviceId, 'digivice-v1', 'deviceId');
  eq(s.phase, 'pickPartner', 'starts at partner pick');
  ok(!Eng.isClockSet(s), 'isClockSet is false (own SET, not 1997)');
  const p = Devices.profileByEgg('dv1999_v1');
  eq(p && p.orient, 'portrait', 'portrait');
  eq(Devices.engineFor(s), Eng, 'engineFor');
  ok(Devices.isDigivice(s) && !Devices.isPen20(s) && !Devices.isPendulum(s), 'family guards');
  const hatched = Devices.hatchEgg({ speed: 4, speedMigrated: true }, 1, false, 'dv1999_v1');
  eq(hatched.family, 'digivice', 'hatchEgg family');
  eq(hatched.speed, 4, 'speed carried');
  const s2 = v2();
  eq(s2.version, 2, 'Ver.2');
  eq(s2.deviceId, 'digivice-v2', 'Ver.2 deviceId');
}

console.log('2) Partner pick: 7 Chosen, no Hikari/Tailmon on Ver.1, In-Training then Child');
{
  const s = v1();
  eq(Data.STARTERS.length, 7, '7 starters');
  ok(Data.STARTERS.indexOf('tailmon') < 0, 'no Tailmon starter');
  ok(Data.STARTERS.indexOf('agumon') >= 0 && Data.STARTERS.indexOf('gabumon') >= 0, 'Agumon and Gabumon');
  Eng.pickPartner(s, 0);
  eq(s.party.length, 1, 'one partner');
  eq(s.party[0].starter, 'agumon', 'picked Agumon line');
  eq(s.party[0].mon, 'koromon', 'starts In-Training (Koromon)');
  eq(s.party[0].stage, 'II', 'stage II');
  eq(s.phase, 'setClock', 'then SET time');
  Eng.confirmClock(s);
  eq(s.phase, 'play', 'game begins');
  ok(s.clockInitialized, 'clock initialized');
  // PLACEHOLDER "shortly": after CHILD_EVOLVE_SEC
  eq(Data.CHILD_EVOLVE_SEC, 300, 'placeholder 5 min labelled');
  s.gameTime = Data.CHILD_EVOLVE_SEC + 1;
  Eng.tick(s, Date.now());
  eq(s.party[0].mon, 'agumon', 'evolves to Child shortly');
  eq(s.party[0].stage, 'III', 'stage III');
}

console.log('3) Clock SET: hour, minute, AM/PM, then play');
{
  const s = v1();
  Eng.pickPartner(s, 3);
  eq(s.clock.h12, 12, 'default 12');
  s.clock.h12 = 6;
  s.clock.min = 15;
  s.clock.pm = true;
  Eng.confirmClock(s);
  const c = Eng.clockH24(s);
  eq(c.h24, 18, '6 PM → 18');
  eq(c.min, 15, 'minute 15');
}

console.log('4) Evolution: 10 victories → Adult, 15 battles as Adult → Perfect (FI)');
{
  const s = boot(v1(), 0);
  toChild(s);
  const p = s.party[0];
  eq(Eng.canEvolve(p), false, 'cannot evo at 0 wins');
  p.wins = 9;
  eq(Eng.canEvolve(p), false, '9 wins not enough');
  p.wins = 10;
  ok(Eng.canEvolve(p), '10 victories → can Adult');
  s.dp = 10;
  ok(Eng.evolvePartner(s, p), 'evolve to Adult');
  eq(p.mon, 'greymon', 'Greymon');
  eq(p.stage, 'IV', 'Adult');
  eq(s.dp, 10 - Data.DP_EVOLVE_COST, 'consumed 3 DP (Wikimon)');
  eq(Eng.canEvolve(p), false, 'needs 15 Adult battles');
  p.stageBattles = 14;
  eq(Eng.canEvolve(p), false, '14 not enough');
  p.stageBattles = 15;
  ok(Eng.canEvolve(p), '15 battles as Adult');
  ok(Eng.evolvePartner(s, p), 'evolve to Perfect');
  eq(p.mon, 'metalgreymon', 'MetalGreymon');
  eq(p.stage, 'V', 'Perfect');
  eq(Eng.canEvolve(p), false, 'no further evo');
}

console.log('5) Map: 7 areas, Wikimon V1 step counts, phone Steps drive countdown');
{
  const s = boot(v1(), 0);
  toChild(s);
  eq(Data.AREA_STEPS.join(','), '10000,12000,14000,16000,18000,20000,22000', 'Wikimon V1 steps');
  eq(s.area, 0, 'area 1 (index 0)');
  eq(s.areaRemaining, 10000, '10,000 remaining');
  // Direct applySteps
  Eng.applySteps(s, 250);
  eq(s.totalSteps, 250, 'total');
  eq(s.areaRemaining, 9750, 'countdown');
  // Phone Steps.applyEffects must also drive the map and grant no effort
  const before = s.areaRemaining;
  const r = Steps.applyEffects(s, 100, new Date());
  eq(s.areaRemaining, before - 100, 'phone steps decrement remaining');
  eq(s.totalSteps, 350, 'total includes phone steps');
  eq(r.effort, 0, 'no 1997 Effort');
  eq(r.strength, 0, 'no 1997 strength');
  // Shake also counts (FI: walk or shake)
  Eng.noteShake(s, 5);
  eq(s.totalSteps, 355, 'shake counts');
  eq(s.areaRemaining, before - 105, 'shake decrements remaining');
}

console.log('6) Boss at 0 remaining, optional fights, unhappy if backing out');
{
  const s = boot(v1(), 0);
  toChild(s);
  s.nextEncounterAt = 999999; // suppress optional
  s.encounter = null;
  Eng.applySteps(s, 10000);
  ok(s.encounter && s.encounter.isBoss, 'boss at 0');
  eq(s.encounter.id, 'kuwagamon', 'Area 1 boss Kuwagamon (FI Guide 1)');
  eq(s.encounter.optional, false, 'boss is forced');
  // Optional encounter
  const s2 = boot(v1(), 0);
  toChild(s2);
  s2.nextEncounterAt = 10;
  s2.stepsInArea = 0;
  s2.encounter = null;
  Eng.applySteps(s2, 10);
  // May or may not, because applySteps triggers when stepsInArea >= nextEncounterAt
  // We set nextEncounterAt=10 and apply 10, so it should fire (if remaining > 0).
  ok(s2.encounter && !s2.encounter.isBoss, 'optional enemy after ENCOUNTER_EVERY');
  ok(s2.encounter.optional, 'optional');
  const mon = s2.party[0];
  Eng.declineEncounter(s2);
  ok(mon.unhappy, 'backing out makes partner unhappy (FI)');
  ok(!s2.encounter, 'encounter cleared');
}

console.log('7) Battle: 3 attacks, evolve consumes DP, switch, Quick Fight, mash first');
{
  const s = boot(v1(), 0);
  toChild(s);
  s.party[0].wins = 10;
  s.dp = 6;
  s.encounter = { id: 'gizamon', isBoss: false, optional: true };
  const b = Eng.startBattle(s);
  ok(b, 'battle started');
  eq(b.attacks, 0, '0 attacks');
  ok(Eng.setBattleOption(s, 'USE'), 'USE ok');
  // Mash above threshold → player first
  eq(Eng.resolveFirst(Data.MASH_THRESHOLD), true, 'mash threshold goes first');
  eq(Eng.resolveFirst(0), false, 'no mash does not guarantee first');
  const result = Eng.confirmUse(s, Data.MASH_THRESHOLD);
  ok(result === 'win' || result === 'lose', 'resolved');
  eq(b.phase, 'result', 'result phase');
  ok(b.attacks >= 1 && b.attacks <= 3, 'at most 3 exchanges');
  if (result === 'lose') ok(s.party[0].injured, 'skull / injured on loss');
  if (result === 'win') ok(s.party[0].wins >= 11, 'win counted');

  // Evolve option + DP
  const s3 = boot(v1(), 0);
  toChild(s3);
  s3.party[0].wins = 10;
  s3.dp = Data.DP_EVOLVE_COST;
  s3.encounter = { id: 'gizamon', isBoss: false, optional: true };
  Eng.startBattle(s3);
  ok(Eng.canEvolve(s3.party[0]), 'can evo');
  ok(Eng.setBattleOption(s3, 'EVOLVE'), 'EVOLVE option');
  Eng.confirmUse(s3, Data.MASH_THRESHOLD);
  eq(s3.party[0].mon, 'greymon', 'evolved in battle');
  eq(s3.battle.evolvedThisRound, true, 'once per round');

  // Quick Fight
  const s4 = boot(v1(), 0);
  toChild(s4);
  s4.encounter = { id: 'gizamon', isBoss: false, optional: true };
  Eng.startBattle(s4);
  Eng.setBattleOption(s4, 'QUICK');
  const q = Eng.confirmUse(s4, 0);
  ok(q === 'win' || q === 'lose', 'quick resolved');
  eq(s4.battle.phase, 'result', 'quick shows result');

  // Switch
  const s5 = boot(v1(), 0);
  toChild(s5);
  Eng.joinPartner(s5, 'gabumon');
  eq(s5.party.length, 2, 'two in party');
  s5.encounter = { id: 'gizamon', isBoss: false, optional: true };
  Eng.startBattle(s5);
  ok(Eng.setBattleOption(s5, 'SWITCH'), 'SWITCH available');
  ok(Eng.switchTo(s5, 1), 'switched');
  eq(s5.active, 1, 'active is second');
  eq(s5.party[1].starter, 'gabumon', 'Gabumon in');
}

console.log('8) Medical Kit treats skull; items (FI effects)');
{
  const s = boot(v1(), 0);
  toChild(s);
  s.party[0].injured = true;
  ok(Eng.treatMedical(s), 'treated');
  eq(s.party[0].injured, false, 'cleared');
  s.items.protein = 1;
  s.items.meat = 1;
  s.items.powerUp = 1;
  ok(Eng.useItem(s, 'protein'), 'protein used');
  eq(s.nextBattleBuff.protein, true, 'double HP next fight (FI)');
  ok(Eng.useItem(s, 'meat'), 'meat consumed');
  eq(s.nextBattleBuff.protein, true, 'meat has no effect (FI)');
  eq(s.items.meat, 0, 'meat gone');
  ok(Eng.useItem(s, 'powerUp'), 'power up');
  eq(s.nextBattleBuff.powerUp, true, 'double all stats next fight (FI)');
}

console.log('9) HELP wave: one successful per area (V1), 3-minute window, CATCH, recruit');
{
  const s = boot(v1(), 0);
  toChild(s);
  // Force a help wave by stubbing Math.random
  const real = Math.random;
  Math.random = () => 0; // always fire (HELP_CHANCE=0.25)
  const started = Eng.maybeStartHelp(s, 'battle');
  Math.random = real;
  ok(started, 'HELP started');
  ok(s.help.active, 'active');
  eq(s.help.fill, 0, 'starts empty');
  ok(s.help.target && s.help.target !== 'agumon', 'rescues a missing starter');
  // 3 minute window, auto-fill by half window (compromise)
  s.gameTime += Data.HELP_WINDOW_SEC / 2;
  Eng.tick(s, Date.now());
  ok(s.help.catchReady, 'CATCH after fill');
  eq(s.help.fill >= 1, true, 'full');
  ok(Eng.catchHelp(s), 'CATCH starts guardian fight');
  ok(s.battle && s.battle.helpRecruit, 'guardian battle');
  // Force a win
  s.battle.enemyHp = 0;
  s.battle.selfHp = 5;
  s.battle.result = 'win';
  s.battle.phase = 'result';
  const target = s.battle.helpTarget;
  Eng.finishBattle(s);
  ok(Eng.inParty(s, target), 'rescued partner joined');
  eq(s.help.areaUsed[0], true, 'area marked used');
  // Second HELP in same area must not start (successful already)
  Math.random = () => 0;
  const again = Eng.maybeStartHelp(s, 'battle');
  Math.random = real;
  eq(again, false, 'only one successful HELP per area (V1)');
}

console.log('10) Ver.2: 130,000-step recruit, own enemy table, Analyzer Adult');
{
  const s = boot(v2(), 0);
  toChild(s);
  eq(s.version, 2, 'v2');
  const areas = Data.areasFor(2);
  eq(areas[0].boss, 'devimon', 'V2 area 1 boss Devimon (Guide 2)');
  eq(areas[6].boss, 'piemon', 'V2 area 7 boss Piemon');
  eq(Data.V2_RECRUIT_MAX_STEPS, 130000, 'official 130,000');
  // Simulate a full clear under 130k
  s.totalSteps = 112000;
  s.areasCleared = 6;
  s.area = 6;
  s.areaRemaining = 0;
  s.encounter = { id: 'piemon', isBoss: true, optional: false };
  const b = Eng.startBattle(s);
  s.battle.enemyHp = 0;
  s.battle.selfHp = 10;
  s.battle.result = 'win';
  Eng.finishBattle(s);
  eq(s.areasCleared, 7, 'map complete');
  eq(s.mapClearSteps, 112000, 'recorded clear steps');
  eq(s.v2RecruitUnlocked, true, '130k recruit unlocked (112k <= 130k)');
  // Over 130k: not unlocked
  const sOver = boot(v2(), 0);
  toChild(sOver);
  sOver.totalSteps = 130001;
  sOver.areasCleared = 6;
  sOver.area = 6;
  sOver.encounter = { id: 'piemon', isBoss: true, optional: false };
  Eng.startBattle(sOver);
  sOver.battle.enemyHp = 0;
  sOver.battle.selfHp = 10;
  sOver.battle.result = 'win';
  Eng.finishBattle(sOver);
  eq(sOver.v2RecruitUnlocked, false, 'over 130k does not unlock');

  // Analyzer: V2 → Adult, V1 → Perfect, no battle requirement
  const a1 = boot(v1(), 0);
  toChild(a1);
  eq(a1.party[0].stage, 'III', 'still Child');
  ok(Eng.connectAnalyzer(a1), 'V1 Analyzer');
  eq(a1.party[0].stage, 'V', 'V1 Analyzer → Perfect (FI)');
  eq(a1.party[0].mon, 'metalgreymon', 'MetalGreymon');
  const a2 = boot(v2(), 0);
  toChild(a2);
  ok(Eng.connectAnalyzer(a2), 'V2 Analyzer');
  eq(a2.party[0].stage, 'IV', 'V2 Analyzer → Adult (FI)');
  eq(a2.party[0].mon, 'greymon', 'Greymon');
}

console.log('11) V-Dramon unlock (all 7 Perfect + map), Ver.1 Help');
{
  const s = boot(v1(), 0);
  toChild(s);
  // Build a full Perfect party
  Data.STARTERS.forEach((id, i) => {
    if (i === 0) {
      s.party[0].index = 3;
      s.party[0].mon = Data.monAt('agumon', 3);
      s.party[0].stage = 'V';
      Eng.refreshStats(s.party[0]);
    } else {
      Eng.joinPartner(s, id);
      const p = s.party[s.party.length - 1];
      p.index = 3;
      p.mon = Data.monAt(id, 3);
      p.stage = 'V';
      Eng.refreshStats(p);
    }
  });
  eq(s.party.length, 7, 'seven partners');
  ok(Eng.allSevenPerfect(s), 'all Perfect');
  eq(Eng.maybeUnlockVDramon(s), false, 'map not yet complete');
  s.areasCleared = 7;
  ok(Eng.maybeUnlockVDramon(s), 'unlocked after map + 7 Perfect (FI Guide 1)');
  ok(s.vdramonUnlocked, 'flag');
}

console.log('12) Sprites: 62 official 26×34 1-bit, scale 4, known partners present');
{
  eq(Spr.W, 26, '26 wide');
  eq(Spr.H, 34, '34 tall');
  eq(Spr.SCALE, 4, '1 original dot = 4 px');
  const ids = Spr.ids();
  eq(ids.length, 62, '62 File Island mons');
  ['koromon','agumon','greymon','metalgreymon','pukamon','gomamon','mugendramon',
   'tailmon','angewomon','holydramon','vdramon','piemon'].forEach((id) => {
    ok(!!Spr.get(id), id + ' present');
    const bits = Spr.get(id);
    eq(bits.length, 34, id + ' 34 rows');
    eq(bits[0].length, 26, id + ' 26 cols');
    // at least some ink
    ok(bits.some((row) => row.some((b) => b)), id + ' has ink');
  });
}

console.log('13) Lights-off is paper; no 1997 blank-dark');
{
  const s = boot(v1(), 0);
  eq(LO.playfieldMode(s, 'play', 'digivice'), 'paper', 'play is paper');
  s.lights = false;
  eq(LO.playfieldMode(s, 'play', 'digivice'), 'paper', 'even with lights=false, paper');
  eq(LO.playfieldMode({ lights: false }, 'play', 'dm1997'), 'blank-dark', '1997 still blank-dark');
}

console.log('14) Picker labels, no spoilers');
{
  const e1 = items.EGG_PICKER.find((e) => e.dataEgg === 'dv1999_v1');
  const e2 = items.EGG_PICKER.find((e) => e.dataEgg === 'dv1999_v2');
  eq(e1 && e1.label, '神聖計畫 Ver.1', 'Ver.1 label');
  eq(e2 && e2.label, '神聖計畫 Ver.2', 'Ver.2 label');
  ok(!/Agumon|Gabumon|Tailmon/.test(e1.label + e2.label), 'no partner names');
}

console.log('15) Area enemy tables (FI Guide 1 / 2)');
{
  eq(Data.AREAS_V1[0].enemies.join(','), 'gizamon,gazimon,kunemon', 'V1 a1');
  eq(Data.AREAS_V1[6].boss, 'mugendramon', 'V1 a7 Machinedramon sprite id');
  eq(Data.AREAS_V2[3].boss, 'tailmon', 'V2 a4 Tailmon');
  eq(Data.AREAS_V2[5].boss, 'venomvamdemon', 'V2 a6 VenomVamdemon');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
