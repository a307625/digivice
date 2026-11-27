#!/usr/bin/env node
/**
 * v36 Ver.1 (1997) audit: rules changed or pinned in this pass.
 * Sources: NHOKO 初代 page, Humulos DM guide, DMComm vpet notes, Wikimon Ver.1.
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Engine = require('../js/engine.js');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

function form(id) {
  const s = Engine.defaultState(1);
  s.mon = id;
  Engine.applySpeciesCare(s, { setWeight: true });
  s.hunger = 4; s.strength = 4;
  return s;
}
function protein(s, n) { for (let i = 0; i < n; i++) Engine.feedProtein(s); }

console.log('1) Ver.1 energy wraps at default+10 (DMComm "Wrapping": JP V1)');
{
  const s = form('agumon');
  eq(s.dpMax, 20, 'Agumon default energy 20 (NHOKO たいりょく)');
  s.dp = 20;
  protein(s, 4);  eq(s.dp, 21, '4 protein at default → default+1 (overfill allowed on Ver.1)');
  protein(s, 32); eq(s.dp, 29, '36 protein → default+9');
  protein(s, 4);  eq(s.dp, 20, '40 protein → would be default+10, resets to default');
  protein(s, 4);  eq(s.dp, 21, 'counting restarts after the wrap');
  s.dp = 5; protein(s, 4); eq(s.dp, 6, 'below default: +1 per 4 protein');
  s.dp = 29; Engine.recordBattle(s, 'win', () => 0.99);
  eq(s.dp, 28, 'battle from default+9 costs 1 (still above default)');

  const n = form('numemon');
  n.dp = n.dpMax; protein(n, 40); eq(n.dp, n.dpMax, 'Numemon (10) also wraps at +10');
}

console.log('2) Other bricks keep "no overfill" (one device at a time)');
{
  const s = Engine.defaultState(2);
  const v2 = Object.keys(global.EvolutionData.MONSTERS).find((id) => {
    const m = global.EvolutionData.MONSTERS[id];
    return Number(m.version) === 2 && m.dpMax > 0 && m.stage !== 'egg';
  });
  ok(!!v2, 'found a Ver.2 Child/Adult with energy');
  if (v2) {
    s.mon = v2; Engine.applySpeciesCare(s, { setWeight: true });
    s.dp = s.dpMax; protein(s, 8);
    eq(s.dp, s.dpMax, 'Ver.2 energy unchanged by protein at default (not changed in v36)');
  }
}

console.log('3) Sleeping 8 h resets overfill to the default (DMComm)');
{
  const src = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  ok(/state\.dp = state\.dpMax \|\| 0;/.test(src), '8 h sleep sets energy to the default, which also clears overfill');
}

console.log('4) 1997 energy meter: たいりょく + 14-bar segmented bar (manual + BladeSabre)');
{
  const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  const m = ui.match(/function energyBars\(dp, dpMax\) \{[\s\S]*?\n  \}/);
  ok(!!m, 'energyBars exists in ui.js');
  ok(/drawEnergyBar\(energyBars\(s\.dp, s\.dpMax\)\)/.test(ui), '1997 status energy page draws the bar meter');
  ok(/statusLabel\('たいりょく'\)/.test(ui), 'energy page is labelled たいりょく');
  ok(!/Math\.min\(4, s\.dp \|\| 0\)/.test(ui), 'old min(4, dp) gauge is gone');
  // eslint-disable-next-line no-new-func
  const energyBars = new Function('var ENERGY_BARS = 14;' + m[0] + '; return energyBars;')();
  eq(energyBars(20, 20), 14, 'default → full (14 bars)');
  eq(energyBars(29, 20), 14, 'Ver.1 overfill still reads full');
  eq(energyBars(19, 20), 13, 'one battle from default loses the rightmost bar (DMComm test)');
  eq(energyBars(10, 20), 7, 'half energy → 7 bars');
  eq(energyBars(0, 20), 0, 'no energy → empty frame (カラ)');
  eq(energyBars(4, 50), 1, 'Monzaemon 4/50 → 1 bar');
  eq(energyBars(0, 0), 0, 'Baby stages have no energy');
}

console.log('5) Ver.1 numbers pinned against NHOKO');
{
  const M = global.EvolutionData.MONSTERS;
  const want = { agumon: 20, betamon: 20, greymon: 30, tyranomon: 20, devimon: 40, meramon: 30,
    airdramon: 30, seadramon: 20, numemon: 10, metalgreymon: 40, mamemon: 45, monzaemon: 50 };
  for (const id in want) eq(M[id].dpMax, want[id], id + ' default energy (NHOKO たいりょく)');
  const s = form('agumon'); s.weight = 30; s.dp = 20;
  Engine.recordBattle(s, 'loss', () => 0.99);
  eq(s.weight, 28, 'Ver.1 battle −2 g (NHOKO: Ver.1 only 2 g)');
  eq(s.winScore, 0, 'win score floors at 0');
  const t = form('agumon'); t.weight = 30; t.strength = 2;
  Engine.noteTrainingOpened(t);
  eq(t.train, 1, 'Ver.1 training counts when the command is chosen (NHOKO)');
}

console.log('6) Cross-checked rules (v36 round 2): Perfect roll, starvation, Meramon, Mega, lights-off');
{
  // Perfect: firmware 0x0D67 (disassembly, measured), Humulos FAQ.
  const dieHits = (score) => { let n = 0; for (let d = 0; d < 16; d++) if (Engine.rollPerfect(score, () => (d + 0.5) / 16)) n++; return n; };
  eq(dieHits(0), 2, 'win score 0–4 → 2/16 (1/8)');
  eq(dieHits(4), 2, 'win score 4 → 1/8');
  eq(dieHits(5), 4, 'win score 5–8 → 4/16 (1/4)');
  eq(dieHits(8), 4, 'win score 8 → 1/4');
  eq(dieHits(9), 8, 'win score 9–15 → 8/16 (1/2)');
  eq(dieHits(15), 8, 'win score 15 → 1/2');

  // Starvation: firmware 0x08BD, emulated Agumon died at exactly 720 min.
  eq(Engine.STARVE_DEATH, 12 * 3600, 'unanswered hunger/strength call kills at 12 h (ROM measured), not 6 h');
  eq(Engine.INJURY_DEATH, 6 * 3600, 'untreated injury kills at 6 h (ROM measured)');

  // Meramon: firmware injury base 1 → (1+1)/16 = 2/16.
  const M = global.EvolutionData.MONSTERS;
  eq(M.meramon.injuryBase, 1, 'Meramon injury base 1 = 2/16 (ROM 0x01EC table)');
  const bases = { agumon: 2, betamon: 3, greymon: 1, tyranomon: 2, devimon: 1, meramon: 1, airdramon: 1,
    seadramon: 2, numemon: 3, metalgreymon: 1, mamemon: 0, monzaemon: 0 };
  for (const id in bases) eq(M[id].injuryBase, bases[id], id + ' injury base matches the ROM table');

  // Mega: Eric's choice keeps BlitzGreymon / BanchoMamemon on Ver.1
  // (deliberate deviation; the ROM ends at Perfect). Monzaemon has none.
  for (const [id, to] of [['metalgreymon', 'blitzgreymon'], ['mamemon', 'banchomamemon']]) {
    const s = form(id);
    s.calls = 0; s.awakeInStage = 48 * 3600; s.gameTime = 48 * 3600; s.stageEnteredGame = 0;
    s.evoDueAt = 108 * 60; s.clockInitialized = true; s.megaChecked = false;
    const ev = Engine.tryEvolve(s, () => 0);
    ok(ev && s.mon === to, 'Ver.1 ' + id + ' keeps its Mega ' + to + ' (Eric\'s choice; got ' + s.mon + ')');
  }
  {
    const s = form('monzaemon');
    s.calls = 0; s.awakeInStage = 300 * 3600; s.gameTime = 300 * 3600; s.stageEnteredGame = 0;
    s.evoDueAt = 104 * 60; s.clockInitialized = true;
    const ev = Engine.tryEvolve(s, () => 0);
    ok(!ev && s.mon === 'monzaemon', 'Ver.1 Monzaemon has no Mega');
  }

  // Lights-off: no sleep disturbance, no wake, no action.
  const d = form('agumon');
  d.sleeping = true; d.lights = false; d.sleepDist = 0; d.train = 0; d.dp = 20;
  const w0 = d.weight, h0 = d.hunger;
  eq(Engine.disturbSleep(d, 'food').woken, false, 'lights off: food does not wake');
  eq(Engine.feedMeat(d).ok, false, 'lights off: meat is not eaten');
  eq(Engine.feedProtein(d).ok, false, 'lights off: protein is not eaten');
  eq(Engine.noteTrainingOpened(d).ok, false, 'lights off: training does not start');
  eq(Engine.recordBattle(d, 'win').ok, false, 'lights off: no battle');
  eq(d.sleepDist, 0, 'lights off: no sleep disturbance counted');
  eq(d.sleeping, true, 'lights off: keeps sleeping');
  eq(d.train, 0, 'lights off: no training counted');
  ok(d.weight === w0 && d.hunger === h0, 'lights off: weight and hunger unchanged');

  const l = form('agumon');
  l.sleeping = true; l.lights = true; l.sleepDist = 0;
  const fr = Engine.feedMeat(l);
  ok(fr.ok, 'lights on: food is eaten');
  eq(l.sleepDist, 1, 'lights on: sleep disturbance +1 (NHOKO, Wikimon, FileIsland)');
  eq(l.sleeping, false, 'lights on: it wakes up');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
