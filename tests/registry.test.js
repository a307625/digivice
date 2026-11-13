#!/usr/bin/env node
/**
 * Step 0 architecture: each egg maps to its own device profile.
 * 1997 Ver.1–5 and DM20 must be bit-identical to v25 for UI lists,
 * shells, orientation, and engine routing.
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
global.Engine = require('../js/engine.js');
const Devices = require('../js/devices/registry.js');
global.Devices = Devices;
global.PendulumData = require('../js/devices/pendulum/data.js');
require('../js/devices/pendulum/versions.js');
// data.js registers 1.0; versions.js registers 1.5–ZERO
const PendulumEngine = require('../js/devices/pendulum/engine.js');
global.PendulumEngine = PendulumEngine;

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}
function eqArr(a, b, msg) {
  const same = a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  ok(same, msg + (same ? '' : ' got ' + JSON.stringify(a)));
}

console.log('Device registry (Step 0)');
console.log('========================\n');

console.log('1) 1997 profiles match v25 exactly');
for (let v = 1; v <= 5; v++) {
  const s = Engine.defaultState(v);
  const p = Devices.profileFor(s);
  eq(p.family, 'dm1997', 'v' + v + ' family');
  eq(p.shell, 'dm1997-v' + v, 'v' + v + ' shell');
  eq(p.orient, 'landscape', 'v' + v + ' orient');
  eq(p.version, v, 'v' + v + ' version');
  eqArr(p.selectable, Devices.SELECTABLE_1997, 'v' + v + ' selectable');
  eqArr(p.statusPages, Devices.STATUS_1997, 'v' + v + ' status');
  eq(p.layout.lcd.left, 12.249, 'v' + v + ' lcd.left');
  eq(p.layout.lcd.top, 39.634, 'v' + v + ' lcd.top');
  eq(p.layout.lcd.width, 33.4, 'v' + v + ' lcd.w');
  eq(p.layout.lcd.height, 23.819, 'v' + v + ' lcd.h');
  eq(p.engine, 'Engine', 'v' + v + ' uses existing Engine');
  ok(p.steps === true, 'v' + v + ' steps ungated');
  ok(!Devices.isPendulum(s), 'v' + v + ' is not pendulum');
}

console.log('2) DM20 profiles match v25 exactly');
const dm20 = [
  ['zuba', 'dm20-zuba'], ['meicoo', 'dm20-zuba'],
  ['corona', 'dm20-omega'], ['luna', 'dm20-alpha'], ['doru', 'dm20-alpha'],
  ['hack', 'dm20-brown'], ['dra_blue', 'dm20-brown'], ['dra_green', 'dm20-brown'],
  ['anime_agumon', 'dm20-brown'], ['anime_gabumon', 'dm20-brown']
];
dm20.forEach(function ([kind, shell]) {
  const s = Engine.defaultState(1, kind);
  const p = Devices.profileFor(s);
  eq(p.family, 'dm20', kind + ' family');
  eq(p.shell, shell, kind + ' shell');
  eq(p.orient, 'landscape', kind + ' orient');
  eq(p.version, 20, kind + ' version');
  eqArr(p.selectable, Devices.SELECTABLE_DM20, kind + ' selectable');
  eqArr(p.statusPages, Devices.STATUS_DM20, kind + ' status');
  eq(p.layout.lcd.left, 12.249, kind + ' same 1997 lcd numbers');
  ok(p.steps === true, kind + ' steps ungated');
  eq(Devices.engineFor(s), global.Engine, kind + ' engine is 1997 Engine');
});

console.log('3) Pendulum Ver.1.0 is its own device');
{
  const s = PendulumEngine.defaultState('pen_1_0');
  const p = Devices.profileFor(s);
  eq(p.family, 'pendulum', 'pen family');
  eq(p.shell, 'pen-1-0', 'pen shell');
  eq(p.orient, 'landscape', 'pen landscape (not the old portrait comment)');
  eq(p.id, 'pen-1-0', 'pen id');
  eqArr(p.selectable, ['STATUS', 'FEED', 'TRAIN', 'CONNECT', 'FLUSH', 'LIGHT', 'MEDIC'], 'pen selectable (Connect, not Battle figures)');
  eqArr(p.statusPages, ['age', 'hunger', 'strength', 'win', 'dp', 'type', 'bj'], 'pen status includes type and B-J-');
  eqArr(p.iconsTop, ['STATUS', 'FEED', 'TRAIN', 'CONNECT'], 'pen top icons');
  eq(p.lightsOff, 'black-z', 'pen lights-off is black+Z');
  eq(p.clockSet, 'pendulum', 'pen has its own SET');
  ok(p.setPausesGrowth, 'SET pauses growth');
  eq(p.hatchMinutes, 1, '1 minute hatch');
  ok(p.steps === true, 'pen steps ungated');
  ok(Devices.isPendulum(s), 'isPendulum');
  ok(Devices.isPendulumEgg('pen_1_0'), 'isPendulumEgg');
  ok(!Devices.isPendulumEgg('zuba'), 'DM20 egg is not pendulum');
  ok(!Devices.isPendulumEgg('ver1'), '1997 egg is not pendulum');
  eq(Devices.engineFor(s), PendulumEngine, 'engine is PendulumEngine, not 1997');
  ok(p.layout.lcd.left !== 12.249, 'pen LCD is not the 1997 window');
  ok(p.layout.chamber && p.layout.chamber.r > 0, 'pendulum chamber in layout');
  eq(p.hasMegahitScreen, false, '1.0 has no MEGAHIT result screen');
}

console.log('4) Hatch routing does not feed a Pendulum egg to the 1997 engine');
{
  const prev = Engine.defaultState(1);
  const s = Devices.hatchEgg(prev, 1, false, 'pen_1_0');
  eq(s.family, 'pendulum', 'hatched family');
  eq(s.mon, 'pen_egg', 'starts as Digitama');
  eq(s.speed, 1, '1× real time');
  ok(s.speedMigrated, 'speedMigrated');
  const v1 = Devices.hatchEgg(null, 1, false, null);
  eq(v1.eggKind, 'ver1', '1997 hatch still works');
  eq(v1.family, undefined, '1997 state has no pendulum family');
}

console.log('5) 1997 Engine.tick ignores (delegates) a pendulum save');
{
  const s = PendulumEngine.defaultState('pen_1_0');
  s.clockInitialized = true;
  s.clockSet.on = false;
  const before = s.mon;
  const r = Engine.tick(s, Date.now());
  eq(s.mon, before, '1997 tick did not mutate pendulum mon via 1997 formulas');
  ok(r && (r.ok === true || r.paused === true || r.evolved === false), 'delegated result shape');
}

console.log('6) Egg picker is still one flat list with no spoilers (items)');
{
  const items = require('../js/items.js');
  ok(items.EGG_PICKER.length === 26, '26 eggs');
  const last = items.EGG_PICKER[items.EGG_PICKER.length - 1];
  eq(last.dataEgg, 'pen_zero', 'Pendulum ZERO egg is last');
  ok(items.EGG_PICKER.some((e) => e.dataEgg === 'pen_1_0'), '1.0 egg still present');
  ok(items.EGG_PICKER.some((e) => e.dataEgg === 'pen_1_5'), '1.5 egg present');
  ok(last.label.indexOf('→') < 0, 'no arrow spoilers');
  ok(!/甲蟲|比多|大力神|炸薯|三角龍|Heracles|Atlur/.test(last.label), 'no roster spoilers in the label');
  ok(items.EGG_PICKER.every((e) => e.label && e.id && e.dataEgg), 'every egg has sprite id + name');
}


console.log('7) All Pendulum OG versions 1.0–5.5 + ZERO are registered');
{
  const expect = [
    ['pen_1_0', 'pen-1-0', false],
    ['pen_1_5', 'pen-1-5', false],
    ['pen_2_0', 'pen-2-0', true],
    ['pen_2_5', 'pen-2-5', true],
    ['pen_3_0', 'pen-3-0', true],
    ['pen_3_5', 'pen-3-5', true],
    ['pen_4_0', 'pen-4-0', true],
    ['pen_4_5', 'pen-4-5', true],
    ['pen_5_0', 'pen-5-0', true],
    ['pen_5_5', 'pen-5-5', true],
    ['pen_zero', 'pen-zero', true]
  ];
  expect.forEach(([egg, id, mega]) => {
    const p = Devices.profileByEgg(egg);
    ok(p && p.family === 'pendulum', egg + ' is a Pendulum profile');
    eq(p && p.id, id, egg + ' device id');
    eq(p && p.shell, id, egg + ' own shell');
    eq(!!(p && p.hasMegahitScreen), mega, egg + ' hasMegahitScreen=' + mega);
    eqArr(p.selectable, ['STATUS', 'FEED', 'TRAIN', 'CONNECT', 'FLUSH', 'LIGHT', 'MEDIC'], egg + ' shared PenOG menus');
    ok(Devices.isPendulumEgg(egg), egg + ' isPendulumEgg');
    const s = PendulumEngine.defaultState(egg);
    eq(s.family, 'pendulum', egg + ' default family');
    eq(s.deviceId, id, egg + ' default deviceId');
    const V = global.PendulumData.versionForEgg(egg);
    eq(s.version, V.key, egg + ' default version');
    const hatched = (function () {
      s.clockInitialized = true;
      s.clockSet.on = false;
      s.evoDueAt = 1 / 60;
      s.gameTime = 0;
      s.lastReal = Date.now() - 70 * 1000;
      PendulumEngine.tick(s, Date.now());
      return s.mon;
    })();
    eq(hatched, V.baby1, egg + ' hatches to ' + V.baby1);
  });
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
