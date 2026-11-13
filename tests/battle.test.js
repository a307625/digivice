#!/usr/bin/env node
/**
 * Official 1997 battle table (same stage) + documented cross-stage clamp to UPSET.
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Battle = require('../js/battle.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}
function approx(a, b, msg) {
  ok(Math.abs(a - b) < 1e-12, msg + ' (got ' + a + ', expected ' + b + ')');
}

console.log('1997 battle table + stage-gap clamp');
console.log('===================================\n');

console.log('1) Official table cells (initiator wins / 16)');
eq(Battle.initiatorWinsOutOf16('A', 'I', 0), 2, 'Agumon initiating vs Numemon = 2/16');
eq(Battle.initiatorWinsOutOf16('C', 'C', 0), 9, 'Adult vs Adult (Greymon) = 9/16');
eq(Battle.initiatorWinsOutOf16('D', 'E', 0), 9, 'Adult Tyranomon vs Devimon = 9/16');
eq(Battle.initiatorWinsOutOf16('J', 'J', 0), 5, 'Perfect vs Perfect (MetalGreymon) = 5/16');
eq(Battle.initiatorWinsOutOf16('K', 'L', 0), 5, 'Mamemon vs Monzaemon = 5/16');
eq(Battle.initiatorWinsOutOf16('I', 'I', 0), 3, 'Numemon vs Numemon = 3/16');
eq(Battle.initiatorWinsOutOf16('A', 'A', 0), 8, 'Child vs Child same slot = 8/16');
eq(Battle.initiatorWinsOutOf16('B', 'B', 0), 8, 'Betamon vs Betamon = 8/16');

console.log('2) Boost +1 raises initiator chance by 1/16, clamped 1–16');
eq(Battle.initiatorWinsOutOf16('A', 'I', 1), 3, 'Agumon vs Numemon with boost +1 = 3/16');
eq(Battle.initiatorWinsOutOf16('J', 'A', 2), 16, 'Perfect vs Child 15+2 clamped to 16/16');
eq(Battle.initiatorWinsOutOf16('A', 'J', -5), 1, 'Child vs Perfect 1−5 clamped to 1/16');

console.log('3) Asymmetry: Agumon initiating vs Numemon is not the complement of Numemon initiating');
eq(Battle.initiatorWinsOutOf16('A', 'I', 0), 2, 'Agumon→Numemon 2/16');
eq(Battle.initiatorWinsOutOf16('I', 'A', 0), 9, 'Numemon→Agumon 9/16');
ok(2 + 9 !== 16, '2/16 + 9/16 ≠ 16/16 (asymmetric table)');
const agumon = global.EvolutionData.MONSTERS.agumon;
const numemon = global.EvolutionData.MONSTERS.numemon;
// Numemon is Champion, Agumon is Rookie: SAME-STAGE table cells still apply, then
// the cross-stage UPSET clamp (user decision). Official 2/16 is capped at 8%;
// official Numemon-initiating 9/16 is raised so the higher stage is at least 92%.
ok(agumon.stage === 'rookie' && numemon.stage === 'champion', 'precondition: Numemon is a higher stage than Agumon');
approx(Battle.selfWinChance(agumon, numemon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), Battle.UPSET[1],
  'Agumon initiating vs Numemon: official 2/16 clamped to 8% (cross-stage)');
approx(Battle.selfWinChance(numemon, agumon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 1 - Battle.UPSET[1],
  'Numemon initiating vs Agumon: official 9/16 raised to 92% (higher-stage floor)');
approx(Battle.selfWinChance(agumon, numemon, { initiator: false, enhancement: 0 }, { enhancement: 0 }), Battle.UPSET[1],
  'Agumon as opponent when Numemon initiates: official 7/16 clamped to 8%');

console.log('4) Same-stage uses the table only (no UPSET, no tribe triangle)');
const gabumon = global.EvolutionData.MONSTERS.gabumon;
approx(Battle.selfWinChance(agumon, gabumon, { initiator: true }, {}), 8 / 16, 'Agumon vs Gabumon (both Child, slot A) 8/16');
const greymon = global.EvolutionData.MONSTERS.greymon;
const tyranomon = global.EvolutionData.MONSTERS.tyranomon;
approx(Battle.selfWinChance(greymon, tyranomon, { initiator: true }, {}), 9 / 16, 'Greymon vs Tyranomon 9/16');

console.log('5) Cross-stage: official chance CLAMPED so the lower stage wins at most UPSET[gap]');
// Agumon vs Greymon, initiator Agumon: table A vs C = 2/16 = 12.5%, 1-stage UPSET 8%
const officialAC = 2 / 16;
ok(officialAC > Battle.UPSET[1], 'precondition: official 2/16 exceeds 8% UPSET');
approx(Battle.selfWinChance(agumon, greymon, { initiator: true }, {}), Battle.UPSET[1],
  'Child vs Adult clamped to 8% (chose CLAMP of official 2/16, not raw gap-odds alone)');
// Greymon initiating vs Agumon: C vs A = 14/16 = 87.5%; higher stage must have >= 92%
approx(Battle.selfWinChance(greymon, agumon, { initiator: true }, {}), 1 - Battle.UPSET[1],
  'Adult vs Child clamped so Adult wins at least 92%');
// 2-stage: Agumon vs MetalGreymon A vs J = 1/16 = 6.25% → clamp to 2%
const metal = global.EvolutionData.MONSTERS.metalgreymon;
approx(Battle.selfWinChance(agumon, metal, { initiator: true }, {}), Battle.UPSET[2],
  'Child vs Perfect (2-stage) clamped to 2%');
approx(Battle.selfWinChance(metal, agumon, { initiator: true }, {}), 1 - Battle.UPSET[2],
  'Perfect vs Child at least 98%');
// 3-stage: Child vs Mega, no shared official cell needed; gap odds 0.5%
const blitz = global.EvolutionData.MONSTERS.blitzgreymon;
approx(Battle.selfWinChance(agumon, blitz, { initiator: true }, {}), Battle.UPSET[3],
  'Child vs Mega (3-stage, no 1997 mega slot) uses gap odds 0.5%');

console.log('6) Same-stage without slots is a labelled 0.5 placeholder');
const wargreymon = global.EvolutionData.MONSTERS.wargreymon;
const jesmon = global.EvolutionData.MONSTERS.jesmon;
ok(!wargreymon.slot && !jesmon.slot, 'precondition: 20th megas have no 1997 slot');
approx(Battle.selfWinChance(wargreymon, jesmon, { initiator: true }, {}), 0.5,
  'same-stage megas without slots: 0.5 placeholder');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
