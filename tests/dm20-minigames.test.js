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
[[0, 0, 0, 0, 0, false], [3, 0, 0, 0, 0, false], [4, 1, 1, 0, 1, false], [8, 1, 1, 0, 1, false],
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

console.log('5) DM20 care timers for the Dracomon line');
{
  const s = draco();
  eq(s.sleepEnd, 7, 'wakes at 7:00 AM (Humulos)');
  eq(s.sleepStart, 21, 'Dracomon bedtime 9:00 PM (Humulos guide)');
  s.mon = 'breakdramon'; E.applySpeciesCare(s, {});
  eq(s.sleepStart, 0, 'Breakdramon bedtime 0:00 AM (Humulos guide)');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
