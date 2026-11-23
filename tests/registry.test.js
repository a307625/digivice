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
global.Pen20Data = require('../js/devices/pen20/data.js');
global.Pen20Engine = require('../js/devices/pen20/engine.js');
require('../js/devices/pen20/profiles.js');
global.DigiviceData = require('../js/devices/digivice/data.js');
global.DigiviceEngine = require('../js/devices/digivice/engine.js');
require('../js/devices/digivice/profiles.js');

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
  eq(p.layout.chamber, null, 'OG Pendulum has no front chamber window (clacker is internal)');
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
  ok(items.EGG_PICKER.length === 30, '30 eggs');
  ok(items.EGG_PICKER.some((e) => e.dataEgg === 'pen_zero'), 'Pendulum ZERO egg still present');
  ok(items.EGG_PICKER.some((e) => e.dataEgg === 'pen_1_0'), '1.0 egg still present');
  ok(items.EGG_PICKER.some((e) => e.dataEgg === 'pen_1_5'), '1.5 egg present');
  const sk = items.EGG_PICKER.find((e) => e.dataEgg === 'pen_20th_sk');
  const sb = items.EGG_PICKER.find((e) => e.dataEgg === 'pen_20th_sb');
  eq(sk && sk.label, '新超代 銀黑數碼蛋', 'SK no-spoiler label');
  eq(sb && sb.label, '新超代 銀藍數碼蛋', 'SB no-spoiler label');
  ok(items.EGG_PICKER.every((e) => e.label && e.label.indexOf('→') < 0), 'no arrow spoilers');
  ok(items.EGG_PICKER.every((e) => e.label && e.id && e.dataEgg), 'every egg has sprite id + name');
  ok(!items.EGG_PICKER.some((e) => /pen_20th_dc|pen_20th_bc/.test(e.dataEgg)), 'DC/BC omitted from picker');
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

console.log('8) Pendulum Ver.20th is its own family, not pendulum / 1997');
{
  const p = Devices.profileByEgg('pen_20th_sk');
  ok(p, 'SK profile registered');
  eq(p && p.family, 'pen20', 'family is pen20 (not pendulum)');
  eq(p && p.id, 'pen-20th-sk', 'device id');
  eq(p && p.shell, 'pen-20th-sk', 'own shell');
  eq(p && p.orient, 'landscape', 'landscape');
  eq(p && p.clockSet, 'pen20', 'own clock-SET');
  eq(p && !!p.layout.chamber, false, 'no left chamber');
  eqArr(p.selectable, ['STATUS', 'FEED', 'TRAIN', 'COLOSSEUM', 'FLUSH', 'LIGHT', 'MEDIC', 'ALBUM', 'CONNECT'], '9 selectables, Call is an indicator');
  ok(p.statusPages.indexOf('bj') >= 0 && p.statusPages.indexOf('weight') >= 0, 'BJ and Weight status pages');
  ok(!Devices.isPendulumEgg('pen_20th_sk'), 'isPendulumEgg is false');
  ok(Devices.isPen20Egg('pen_20th_sk'), 'isPen20Egg is true');
  const s = Pen20Engine.defaultState('pen_20th_sk');
  eq(s.family, 'pen20', 'default family');
  eq(Devices.engineFor(s), Pen20Engine, 'engineFor returns Pen20Engine');
  ok(Devices.isPen20(s), 'isPen20');
  ok(!Devices.isPendulum(s), 'isPendulum is false');
  const sb = Devices.profileByEgg('pen_20th_sb');
  eq(sb && sb.shell, 'pen-20th-sb', 'SB own shell');
  // hatch 70s
  s.clockInitialized = true;
  s.clockSet.on = false;
  s.lastReal = Date.now() - 70 * 1000;
  Pen20Engine.tick(s, Date.now());
  eq(s.pets[0].mon, 'bubb', 'SK hatches Bubbmon');
  // 1997 Engine.tick delegates and does not apply 1997 formulas
  const before = s.pets[0].mon;
  const Engine = require('../js/engine.js');
  Engine.tick(s, Date.now());
  eq(s.pets[0].mon, before, '1997 tick did not mutate Pen20 mon');
}


console.log('9) 神聖計畫 (Digivice 1999) is its own family, portrait, not 1997 / pendulum / pen20');
{
  const p = Devices.profileByEgg('dv1999_v1');
  ok(p, 'Ver.1 profile registered');
  eq(p && p.family, 'digivice', 'family is digivice');
  eq(p && p.id, 'digivice-v1', 'device id');
  eq(p && p.shell, 'digivice-v1', 'own orange shell');
  eq(p && p.orient, 'portrait', 'portrait / round');
  eq(p && p.clockSet, 'digivice', 'own clock-SET');
  eqArr(p.selectable, ['STATUS', 'MAP', 'SLOT', 'CARD', 'VS', 'MEDICAL'], '6 Digivice menus; Medical is last so the next press is Status');
  ok(Devices.isDigiviceEgg('dv1999_v1'), 'isDigiviceEgg is true');
  ok(!Devices.isPendulumEgg('dv1999_v1'), 'isPendulumEgg is false');
  ok(!Devices.isPen20Egg('dv1999_v1'), 'isPen20Egg is false');
  const s = DigiviceEngine.defaultState('dv1999_v1');
  eq(s.family, 'digivice', 'default family');
  eq(Devices.engineFor(s), DigiviceEngine, 'engineFor returns DigiviceEngine');
  ok(Devices.isDigivice(s), 'isDigivice');
  ok(!Devices.isPen20(s), 'isPen20 is false');
  ok(!Devices.isPendulum(s), 'isPendulum is false');
  const v2 = Devices.profileByEgg('dv1999_v2');
  eq(v2 && v2.shell, 'digivice-v2', 'Ver.2 own pink shell');
  eq(v2 && v2.orient, 'portrait', 'Ver.2 also portrait');
  // 1997 Engine.tick delegates and does not apply 1997 formulas
  const Engine = require('../js/engine.js');
  const before = s.phase;
  Engine.tick(s, Date.now());
  eq(s.phase, before, '1997 tick did not mutate Digivice phase');
  eq(s.family, 'digivice', 'family stays digivice after 1997 tick');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
