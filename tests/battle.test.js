#!/usr/bin/env node
/**
 * Official 1997 battle table for every slotted pairing, including cross-stage.
 * Forms with no 1997 slot keep a labelled fallback.
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

console.log('1997 battle table (slotted fights, any stage)');
console.log('============================================\n');

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
// Numemon is Champion slot I, Agumon is Rookie slot A. The table already
// covers that cross-stage pairing. No stage-gap cap.
ok(agumon.stage === 'rookie' && numemon.stage === 'champion', 'precondition: Numemon is a higher stage than Agumon');
approx(Battle.selfWinChance(agumon, numemon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 2 / 16,
  'Agumon initiating vs Numemon: table A vs I = 2/16');
approx(Battle.selfWinChance(numemon, agumon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 9 / 16,
  'Numemon initiating vs Agumon: table I vs A = 9/16');
approx(Battle.selfWinChance(agumon, numemon, { initiator: false, enhancement: 0 }, { enhancement: 0 }), 1 - 9 / 16,
  'Agumon when Numemon initiates: 1 − 9/16 = 7/16');

console.log('4) Same-stage uses the table only (no tribe triangle)');
const gabumon = global.EvolutionData.MONSTERS.gabumon;
approx(Battle.selfWinChance(agumon, gabumon, { initiator: true }, {}), 8 / 16, 'Agumon vs Gabumon (both Child, slot A) 8/16');
const greymon = global.EvolutionData.MONSTERS.greymon;
const tyranomon = global.EvolutionData.MONSTERS.tyranomon;
approx(Battle.selfWinChance(greymon, tyranomon, { initiator: true }, {}), 9 / 16, 'Greymon vs Tyranomon 9/16');

console.log('5) Cross-stage slotted fights use the table plus boost difference');
approx(Battle.selfWinChance(agumon, greymon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 2 / 16,
  'Child vs Adult: table A vs C = 2/16');
approx(Battle.selfWinChance(greymon, agumon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 14 / 16,
  'Adult vs Child: table C vs A = 14/16');
const metal = global.EvolutionData.MONSTERS.metalgreymon;
approx(Battle.selfWinChance(agumon, metal, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 1 / 16,
  'Child vs Perfect: table A vs J = 1/16');
approx(Battle.selfWinChance(metal, agumon, { initiator: true, enhancement: 0 }, { enhancement: 0 }), 15 / 16,
  'Perfect vs Child: table J vs A = 15/16');
approx(Battle.selfWinChance(agumon, greymon, { initiator: true, enhancement: 4 }, { enhancement: 1 }), 5 / 16,
  'Boost difference +3 raises A vs C from 2/16 to 5/16');
approx(Battle.selfWinChance(greymon, agumon, { initiator: true, enhancement: 0 }, { enhancement: 4 }), 10 / 16,
  'Defender boost 4 lowers C vs A from 14/16 to 10/16');
// Mega has no 1997 slot, so the table cannot apply.
const blitz = global.EvolutionData.MONSTERS.blitzgreymon;
ok(!blitz.slot, 'precondition: Mega has no 1997 slot');
approx(Battle.selfWinChance(agumon, blitz, { initiator: true }, {}), Battle.UPSET[3],
  'Child vs Mega (no slot) uses the labelled 0.5% stage-gap fallback');

console.log('6) Same-stage without slots is a labelled 0.5 placeholder');
const wargreymon = global.EvolutionData.MONSTERS.wargreymon;
const jesmon = global.EvolutionData.MONSTERS.jesmon;
ok(!wargreymon.slot && !jesmon.slot, 'precondition: 20th megas have no 1997 slot');
approx(Battle.selfWinChance(wargreymon, jesmon, { initiator: true }, {}), 0.5,
  'same-stage megas without slots: 0.5 placeholder');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
