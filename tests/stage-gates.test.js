#!/usr/bin/env node
/**
 * 1997 + DM20 stage gates for training, CPU battle, link battle, and Jogress.
 * Sources: Wikimon Digital Monster ("Baby I / Baby II cannot battle");
 *          Humulos DMC / DM20 ("Stage III or higher", "at least one DP");
 *          Wikimon: injured Digimon must be healed before battling again.
 * Documented in /workspace/ui-research/stage-gates.md.
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
  s.injured = false;
  s.dp = 5;
  s.dpMax = Math.max(5, (data.MONSTERS[id] && data.MONSTERS[id].dpMax) || 5);
  s.clockOffset = 10 * 3600;
  if (extra) Object.assign(s, extra);
  return s;
}

const CASES = [
  { id: 'botamon', stage: 'baby1', train: false, battle: false, label: 'Baby I (1997 Botamon)' },
  { id: 'koromon', stage: 'baby2', train: false, battle: false, label: 'Baby II (1997 Koromon)' },
  { id: 'agumon', stage: 'rookie', train: true, battle: true, label: 'Child / Rookie (1997 Agumon)' },
  { id: 'greymon', stage: 'champion', train: true, battle: true, label: 'Adult / Champion (1997 Greymon)' },
  { id: 'metalgreymon', stage: 'ultimate', train: true, battle: true, label: 'Perfect / Ultimate (1997 MetalGreymon)' },
  { id: 'wargreymon', stage: 'mega', train: true, battle: true, label: 'DM20 Mega (WarGreymon)', eggKind: 'anime_agumon' },
  { id: 'omegamon', stage: 'super', train: true, battle: true, label: 'DM20 Super Ultimate (Omegamon)', eggKind: 'jogress' },
];

console.log('1) Train / battle eligibility by stage');
CASES.forEach((c) => {
  const s = form(c.id, { eggKind: c.eggKind, dp: 8 });
  eq(data.MONSTERS[c.id].stage, c.stage, c.label + ' stage');
  eq(Engine.canTrain(s), c.train, c.label + ' canTrain');
  eq(Engine.canBattle(s), c.battle, c.label + ' canBattle (with DP, healthy)');
  if (!c.train) {
    const r = Engine.finishTraining(s, true, true);
    ok(r && r.ok === false && r.reason === 'too-young', c.label + ' finishTraining refuses');
    const o = Engine.noteTrainingOpened(s);
    ok(o && o.ok === false && o.reason === 'too-young', c.label + ' noteTrainingOpened refuses');
  }
  if (!c.battle) {
    const r = Engine.recordBattle(s, 'win', () => 0.99);
    ok(r && r.ok === false, c.label + ' recordBattle refuses (' + (r && r.reason) + ')');
  }
});

console.log('2) Egg cannot train or battle');
{
  const s = form('egg_v1', { dp: 8 });
  ok(!Engine.canTrain(s), 'egg canTrain false');
  ok(!Engine.canBattle(s), 'egg canBattle false');
}

console.log('3) DP = 0 and injury block battle, but not training (1997 / DM20)');
{
  const s = form('agumon', { dp: 0 });
  ok(Engine.canTrain(s), 'Child can still train at 0 DP');
  ok(!Engine.canBattle(s), 'cannot battle at 0 DP');
  const r = Engine.recordBattle(s, 'win', () => 0.99);
  eq(r.reason, 'no-dp', 'recordBattle reason no-dp');
}
{
  const s = form('agumon', { dp: 5, injured: true, injuredAt: 0 });
  ok(Engine.canTrain(s), 'injured Child can still train (heal is a separate action)');
  ok(!Engine.canBattle(s), 'cannot battle while injured (must heal first)');
  const r = Engine.recordBattle(s, 'win', () => 0.99);
  eq(r.reason, 'injured', 'recordBattle reason injured');
}
{
  const s = form('wargreymon', { eggKind: 'anime_agumon', dp: 0 });
  ok(Engine.canTrain(s), 'Mega can train');
  ok(!Engine.canBattle(s), 'Mega cannot battle at 0 DP');
}

console.log('4) Jogress: babies / 1997-too-young refused; pairs are DM20');
{
  const baby = form('botamon');
  const r = Engine.tryJogress(baby, 'agumon');
  ok(r && r.ok === false && r.reason === 'too-young', 'Baby I tryJogress too-young');
  const rookie = form('agumon');
  const r2 = Engine.tryJogress(rookie, 'gabumon');
  ok(r2 && r2.ok === false, 'Agumon (no official 1997 jogress pair) refused (reason ' + (r2 && r2.reason) + ')');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
