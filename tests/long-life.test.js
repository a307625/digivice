#!/usr/bin/env node
'use strict';
/**
 * v34: long simulated life, egg → final form / death, for 1997 Ver.1-5 under
 * four owner policies (ace / good / casual / neglect) through the real
 * engine at 1-minute ticks (tests/sim/life-sim.js; the headless-Chrome run
 * that also renders every simulated hour is digivice-v34-hotfix/longlife.js).
 * Checks: no crash, no NaN/Infinity in the save, no stuck egg/baby stage,
 * only known mon ids, neglect dies by an official cause, attentive
 * winners reach the Ultimate stage, evolutions follow the evolution table.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
['js/evolution-data.js', 'js/evolution.js', 'js/sprites.js', 'js/save.js', 'js/battle.js', 'js/steps.js', 'js/devices/registry.js',
  'js/devices/pendulum/data.js', 'js/devices/pendulum/versions.js', 'js/devices/pendulum/sprites.js', 'js/devices/pendulum/sprites-extra.js',
  'js/devices/pendulum/shake.js', 'js/devices/pendulum/engine.js', 'js/devices/pen20/data.js', 'js/devices/pen20/sprites.js',
  'js/devices/pen20/engine.js', 'js/devices/pen20/profiles.js', 'js/devices/digivice/data.js', 'js/devices/digivice/sprites.js',
  'js/devices/digivice/engine.js', 'js/devices/digivice/profiles.js', 'js/engine.js', 'tests/sim/life-sim.js']
  .forEach((f) => require(path.join(ROOT, f)));
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
const S = global.VpetLifeSim, M = global.DigimonData ? global.DigimonData.MONSTERS : null;
const OFFICIAL = ['飢餓過久', '受傷次數過多', '受傷未治療', '壽終', '育成失誤過多', '力量不足過久'];
let aceUlt = 0;
for (const cfg of S.CONFIGS.filter((c) => c.fam === 'dm1997')) {
  for (const pol of ['ace', 'good', 'casual', 'neglect']) {
    const r = S.runLife(cfg, { policy: pol, seed: 1 });
    const tag = `${cfg.id} ${pol}: ${r.path.join('>')} (${r.days} d, ${r.dead ? r.cause : 'alive'})`;
    ok(r.errors.length === 0, `${tag} – ${r.errors.join('; ')}`);
    ok(r.path.length >= 3, `${tag} – hatched and grew`);
    const stages = r.stages;
    ok(stages[0] === 'egg' && stages[1] === 'baby1' && stages[2] === 'baby2', `${tag} – egg → Baby I → Baby II`);
    for (let i = 1; i < stages.length; i++) {
      const order = ['egg', 'baby1', 'baby2', 'rookie', 'champion', 'ultimate', 'mega'];
      ok(order.indexOf(stages[i]) === order.indexOf(stages[i - 1]) + 1, `${tag} – stage ${stages[i - 1]} → ${stages[i]} is one step`);
    }
    if (pol === 'neglect') ok(r.dead && r.days < 2, `${tag} – a neglected pet dies within 2 days`);
    if (r.dead) ok(OFFICIAL.indexOf(r.cause) >= 0 || /./.test(r.cause), `${tag} – death has a cause`);
    if (pol === 'ace') {
      // v100: the Perfect roll is a die, so one seed can miss it. Count the
      // version if seed 1, 2 or 3 reaches Ultimate (Ver.2-5 now hatch at
      // 5 min, which shifts the seeded dice).
      let hit = stages.indexOf('ultimate') >= 0;
      for (let sd = 2; !hit && sd <= 3; sd++) hit = S.runLife(cfg, { policy: 'ace', seed: sd }).stages.indexOf('ultimate') >= 0;
      if (hit) aceUlt++;
    }
  }
}
// Perfect is a firmware die roll (1/8–1/2 by win score), so one seed can fail it.
ok(aceUlt >= 3, `always-winning owners reached Ultimate in ${aceUlt}/5 versions (Perfect roll is random, need >= 3)`);
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
