#!/usr/bin/env node
'use strict';
/**
 * v32: Dracomon eggs (DM20 / Ver.20th special eggs) mini-games and care,
 * against the Bandai Ver.20th manual, NHOKO Ver.20th and Humulos DM20.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }
global.window = global;
['js/evolution-data.js', 'js/evolution.js', 'js/battle.js', 'js/engine.js'].forEach((f) => require(path.join(ROOT, f)));
const E = global.Engine, B = global.Battle;
const ui = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');

function draco(extra) {
  const s = E.defaultState(1, 'dra_blue');
  s.mon = 'dracomon'; E.applySpeciesCare(s, { setWeight: true });
  s.clockInitialized = true; s.gameTime = 0; s.stageEnteredGame = 0;
  s.hunger = 4; s.strength = 0; s.weight = 30; s.train = 0; s.sleeping = false;
  s.clockOffset = 10 * 3600; s.lastReal = Date.now();
  return Object.assign(s, extra || {});
}

console.log('1) Which device: the Dracomon eggs are DM20 (Ver.20th) special eggs');
{
  const s = E.defaultState(1, 'dra_blue');
  ok(E.isDm20(s), 'dra_blue egg runs DM20 rules');
  ok(E.isDm20(E.defaultState(1, 'dra_green')), 'dra_green egg runs DM20 rules');
  ok(!E.isDm20(E.defaultState(1)), '1997 Ver.1 egg does not');
}

console.log('2) Single training: wall states (NHOKO table), 13 presses = destroyed (Humulos)');
[[0, 0, 1, 0, 0, false], [3, 0, 1, 0, 0, false], [4, 1, 1, 0, 1, false], [8, 1, 1, 0, 1, false],
  [9, 2, 2, 1, 1, true], [12, 2, 2, 1, 1, true], [13, 3, 4, 2, 1, true], [40, 3, 4, 2, 1, true]].forEach(([n, tier, loss, gain, effort, succ]) => {
  const s = draco();
  const r = E.finishDm20Training(s, n);
  eq(r.tier, tier, n + ' presses → wall state ' + ['untouched', 'half', 'wrecked', 'destroyed'][tier]);
  eq(30 - s.weight, loss, n + ' presses: weight −' + loss + ' G');
  eq(s.strength, gain, n + ' presses: strength +' + gain);
  eq(s.train, effort, n + ' presses: effort counter +' + effort);
  eq(r.success, succ, n + ' presses: success=' + succ);
});
{
  const s = draco({ weight: 20 });
  E.finishDm20Training(s, 13);
  eq(s.weight, 20, 'weight never below the species minimum');
  const t = draco({ strength: 3 });
  E.finishDm20Training(t, 13);
  eq(t.strength, 4, 'strength capped at 4 hearts');
  const c = draco({ strength: 0, hunger: 4, callAt: 0, callStrengthAt: 0 });
  E.finishDm20Training(c, 9);
  ok(c.callAt == null, 'completed training with a strength heart answers the strength call');
  const b = draco({ mon: 'babydmon' });
  eq(E.finishDm20Training(b, 13).ok, false, 'Baby II cannot train');
}
ok(/mode === 'wall'[\s\S]{0,200}btn === 'A' && train\.phase === 'go'/.test(ui), 'only A presses after "!" count (B and early presses ignored)');
ok(/DM20_READY_MS[\s\S]{0,400}DM20_TRAIN_WINDOW_MS/.test(ui) && /train\.phase === 'go' && nowW >= train\.endAt/.test(ui), 'training window is real time (ms), not frame count');
ok(/drawBang\(/.test(ui) && /drawWallTier\(/.test(ui), '"!" cue and wall damage states drawn');
ok(/view === 'train'\) \{\s*if \(window\.Engine && window\.Engine\.cancelTraining\)/.test(ui), 'C during training cancels with no benefit');

console.log('3) Single battle "!" charge (Bandai manual) before the CPU fight');
eq(B.chargeTier(0), 0, '0 presses → Weak order');
eq(B.chargeTier(10), 4, '10 presses → Critical order (Wikimon)');
ok(B.chargeBoost(4) > B.chargeBoost(0), 'more charge → better odds');
ok(/currentDevice\(\)\.family === 'dm20'\)[\s\S]{0,700}view = 'charge'/.test(ui), 'DM20 SINGLE opens the charge phase');
ok(/view === 'charge'\) \{ if \(charge\.on && charge\.phase === 'go'\) charge\.presses\+\+/.test(ui), 'A mashes the charge');
ok(/view === 'charge'\) \{ charge\.on = false; view = 'play'; return; \}/.test(ui), 'C backs out (no battle, no DP spent)');

console.log('3b) DM20 single fight uses HP, mash damage, and power');
{
  const always = function () { return 0; };
  const pat = B.dm20SinglePattern;
  eq(JSON.stringify(pat(0).shots), JSON.stringify([1]), '0 presses: 1pt weak');
  eq(JSON.stringify(pat(3).shots), JSON.stringify([2]), '3 presses: 2pt strong');
  eq(JSON.stringify(pat(5).shots), JSON.stringify([1, 2]), '5 presses: 3pt double weak');
  eq(JSON.stringify(pat(8).shots), JSON.stringify([2, 2]), '8 presses: 4pt double strong');
  eq(pat(10).firstMiss, true, '10 presses: critical, first shot may miss (Wikimon)');
  eq(JSON.stringify(pat(11).shots), JSON.stringify([4, 2]), '11 presses: first hit is the 4pt shot');
  const core = global.EvolutionData.MONSTERS.coredramon_blue;
  eq(B.dm20BattlePower(core, { strength: 4, hunger: 4, weight: 30, foeAttr: 'virus' }), 80 + 16 + 32,
    'Coredramon 80 + full Strength 16 + vaccine vs virus 32');
  eq(B.dm20BattlePower(core, { strength: 4, hunger: 0, weight: 30, foeAttr: 'virus' }), 80 + 32,
    'empty Hunger removes the Strength hearts; vaccine vs virus still adds 32');
  eq(B.dm20BattlePower(core, { strength: 4, hunger: 4, weight: 99, foeAttr: 'data' }), 80,
    '99g removes the Strength bonus');
  const mash = B.resolveDm20('coredramon_blue', 'numemon', 1, {
    presses: 11, strength: 4, hunger: 4, weight: 30, rng: always
  }, { presses: 0, strength: 0, hunger: 4, weight: 30 });
  eq(mash.result, 'win', 'full mash and full Strength knocks the foe down when every shot hits');
  eq(mash.log[0].dmg, 5, 'max Strength adds 1 to the 4pt first hit');
  eq(mash.hpMax, 10, 'single battle HP is 10');
  const stuffed = B.resolveDm20('coredramon_blue', 'numemon', 1, {
    presses: 11, strength: 4, hunger: 4, weight: 99, rng: always
  }, { presses: 0, strength: 0, hunger: 4, weight: 30 });
  eq(stuffed.log[0].dmg, 4, '99g does not add the Strength point');
  const lazy = B.resolveDm20('coredramon_blue', 'numemon', 1, {
    presses: 0, strength: 0, hunger: 4, weight: 30, rng: always
  }, { presses: 11, strength: 4, hunger: 4, weight: 30 });
  eq(lazy.result, 'loss', 'a 1pt shot loses to an 11-press foe when every shot hits');
  ok(/drawDm20Battle/.test(ui) && /drawHpTicks/.test(ui), 'DM20 battle draws the HP ticks and each shot');
}

console.log('4) While asleep / unavailable');
ok(/function dm20Asleep\(\)/.test(ui) && /startTrain\(\) \{\s*var m = mon\(\);\s*if \(dm20Asleep\(\)\)/.test(ui), 'DM20 asleep: TRAIN does nothing (wake with LIGHTS first)');
ok(/if \(dm20Asleep\(\)\) return;\s*disturb\('food'\)/.test(ui) && /if \(dm20Asleep\(\)\) return;\s*disturb\('battle'\)/.test(ui), 'DM20 asleep: FEED / BATTLE do nothing');
{
  const s = draco({ sleeping: true });
  E.disturbSleep(s, 'train');
  eq(s.sleepDist || 0, 0, 'DM20 has no sleep-disturbance counter (Wikimon)');
  const w = draco({ sleeping: true, lights: false });
  E.confirmDm20Light(w, 0);
  eq(w.awakeUntil - w.gameTime, 15 * 60, 'LIGHTS ON keeps it up 15 min (Bandai manual)');
}

console.log('5b) Tag training chart, tag damage rows, max-Strength shot bonus');
eq(E.DM20_TAG_PATTERNS.join(','), 'ABABB,BBAAB,BAABB,ABBAA,BABAB,ABABA', 'Humulos six-round chart');
eq(E.dm20TagPattern(6), 'ABABB', 'round 7 repeats round 1');
{
  const s = draco({ weight: 30, strength: 2, train: 0 });
  const r = E.finishDm20TagTraining(s, 3);
  eq(r.success, true, '3 of 5 is a successful tag training');
  eq(s.strength, 3, '3–4 hits add one strength heart');
  eq(s.weight, 28, 'a finished tag round loses 2 g (NHOKO)');
  eq(s.train, 1, 'a miss-or-hit session still counts as effort');
  eq(s.dm20TagRound, 1, 'the chart advances');
  const miss = draco({ weight: 30, strength: 2 });
  const mr = E.finishDm20TagTraining(miss, 2);
  eq(mr.success, false, '2 of 5 is a miss');
  eq(miss.strength, 2, '0–2 hits add no strength');
  eq(miss.weight, 28, 'a miss still loses 2 g');
  const five = draco({ weight: 30, strength: 2 });
  E.finishDm20TagTraining(five, 5);
  eq(five.strength, 4, '5 hits add two strength hearts');
}
ok(/function drawDm20Tag\(\)[\s\S]{0,1200}fx\(16\)/.test(ui), 'tag training puts the shooter on the right half');
ok(!/function drawDm20Tag\(\)[\s\S]{0,800}drawNumber/.test(ui), 'tag training does not print a score over the sprites');
ok(!/trainPick/.test(ui), 'no 1/2 training menu; one Digimon on screen is the wall');
eq(JSON.stringify(B.dm20TagShots(3, 9)), JSON.stringify([12, 8, 6, 8, 12]), 'tag row: 3rd stop, 9 presses');
eq(JSON.stringify(B.dm20TagShots(3, 12)), JSON.stringify([12, 6, 8, 8, 12]), 'tag row: 3rd stop, 12 presses');
eq(JSON.stringify(B.dm20TagShots(2, 12)), JSON.stringify([8, 12, 8, 8, 8]), 'tag row: 2nd stop, 12 presses');
eq(B.dm20TagShots(3, 11), null, '11 presses is not a published row');
eq(B.dm20ShotBonus(4, false, 0), 1, 'single battle, max Strength: +1 per shot');
eq(B.dm20ShotBonus(3, false, 0), 0, 'single battle below max Strength: no bonus');
eq(B.dm20ShotBonus(4, true, 4), 2, 'tag battle, both max Strength: +2 per shot');
eq(B.dm20ShotBonus(4, true, 3), 0, 'tag battle, only one at max: no bonus');
eq(JSON.stringify(B.applyDm20ShotBonus([12, 8, 6, 8, 12], 1)), JSON.stringify([13, 9, 7, 9, 13]), 'bonus is added to every shot');
{
  const s = draco({ mon: 'babydmon' });
  eq(E.cycleSec(s), 30 * 60, 'DM20 Baby II loses a heart about every 30 min');
  s.mon = 'petitmon';
  eq(E.cycleSec(s), 3 * 60, 'DM20 Baby I loses a heart about every 3 min');
  const brick = E.defaultState(1);
  brick.mon = 'koromon';
  eq(E.cycleSec(brick), 57 * 60, '1997 Baby II keeps the NHOKO 57 min cycle');
}
{
  const s = draco({ hunger: 4, satietyFilled: 99, weight: 20, clockOffset: 10 * 3600, gameTime: 0 });
  const r = E.feedMeat(s);
  ok(r.refused, 'DM20 can still refuse a meal');
  eq(s.hungerFreezeUntil || 0, 0, 'DM20 refuse does not start the 1997 one-hour hunger freeze');
}

console.log('5) DM20 care timers for the Dracomon line');
{
  const s = draco();
  eq(s.sleepEnd, 7, 'wakes at 7:00 AM (Humulos)');
  eq(s.sleepStart, 21, 'Dracomon bedtime 9:00 PM (Humulos guide)');
  s.mon = 'breakdramon'; E.applySpeciesCare(s, {});
  eq(s.sleepStart, 0, 'Breakdramon bedtime 0:00 AM (Humulos guide)');
}

console.log('6) battle shots use the species attack dot');
{
  require(path.join(ROOT, 'js/items.js'));
  require(path.join(ROOT, 'js/attack-dots.js'));
  const A = global.VpetAttack;
  eq(A.itemFor('agumon', 'dm1997'), 'atk_fire', 'Agumon fires the fire dot');
  eq(A.itemFor('elecmon', 'dm1997'), 'atk_thunder', 'Elecmon fires lightning');
  eq(A.itemFor('devimon', 'dm1997'), 'atk_punch', 'Devimon fires the fist');
  eq(A.itemFor('greymon', 'dm20'), 'atk_flame', 'Greymon on the 20th brick fires the flame');
  eq(A.itemFor('whamon', 'dm1997'), 'atk_hari', 'Whamon normal shot is the needle');
  eq(A.itemFor('whamon', 'pendulum'), 'atk_nami', 'Whamon on Pendulum fires the wave');
  eq(A.itemFor('coredramon_blue', 'dm20'), null, 'Coredramon has no published attack dot');
  ok(/function attackItem\(/.test(ui) && /drawShot\(fromRight, u, 6, shooter\)/.test(ui), '20th battle draws the shooter\'s dot');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
