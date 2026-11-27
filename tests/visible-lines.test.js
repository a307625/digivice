#!/usr/bin/env node
/**
 * v99 (Eric 2026-11-28): only the 1997 一般版 Ver.1–5 and the 20th
 * (DM20, all its eggs) can be picked or started. Every other line stays in
 * the code but is hidden. Checks the central allow-list, the picker filter,
 * the start / import / link guards, and that a hidden-line save is kept
 * (main slot untouched + a parked copy), never wiped.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

global.window = global;
const D = require('../js/devices/registry.js');
require('../js/items.js');
const PICKER = global.VpetItems.EGG_PICKER;
const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const reg = fs.readFileSync(path.join(__dirname, '../js/devices/registry.js'), 'utf8');

console.log('1) One central allow-list');
eq(D.ENABLED_FAMILIES, ['dm1997', 'dm20'], 'Devices.ENABLED_FAMILIES = 1997 + DM20');
eq((reg.match(/var ENABLED_FAMILIES = /g) || []).length, 1, 'declared once, in js/devices/registry.js');

console.log('2) Picker: only Ver.1–5 and the DM20 eggs');
const visible = PICKER.filter((e) => D.isEggEnabled(e.dataEgg)).map((e) => e.dataEgg);
eq(visible.filter((v) => /^[1-5]$/.test(v)), ['1', '2', '3', '4', '5'], 'all five 1997 versions');
const dm20 = Object.keys(D.DM20_EGGS);
eq(visible.filter((v) => !/^[1-5]$/.test(v)).sort(), PICKER.map((e) => e.dataEgg).filter((v) => dm20.indexOf(v) >= 0).sort(), 'every DM20 egg in the picker');
ok(visible.every((v) => ['dm1997', 'dm20'].indexOf(D.familyOfEgg(v)) >= 0), 'nothing else visible');
for (const hid of ['pen_1_0', 'pen_1_5', 'pen_2_0', 'pen_3_5', 'pen_5_5', 'pen_zero', 'pen_20th_sk', 'pen_20th_sb', 'dv1999_v1', 'dv1999_v2']) {
  ok(!D.isEggEnabled(hid), hid + ' hidden');
}
eq(PICKER.length, 30, 'hidden eggs are still defined (not deleted): 5 + 10 DM20 + 15 hidden');
eq(visible.length, 15, '15 visible cards (5 + 10 DM20)');
ok(/items\(\)\.EGG_PICKER\.filter\(function \(egg\) \{ return eggAllowed\(egg\.dataEgg\); \}\)/.test(ui), 'fillEggGrid draws only allowed eggs');

console.log('3) Saves: hidden lines detected, enabled ones load');
ok(D.isStateEnabled({ eggKind: 'ver3', version: 3 }), '1997 save allowed');
ok(D.isStateEnabled({ eggKind: 'zuba', version: 'special' }), 'DM20 save allowed');
ok(D.isStateEnabled({ version: 1 }), 'old 1997 save without family allowed');
ok(!D.isStateEnabled({ family: 'pendulum', eggKind: 'pen_2_0' }), 'Pendulum save hidden');
ok(!D.isStateEnabled({ family: 'pen20', eggKind: 'pen_20th_sk' }), 'Pen20 save hidden');
ok(!D.isStateEnabled({ family: 'digivice', eggKind: 'dv1999_v1' }), 'Digivice save hidden');

console.log('4) UI guards in a sandbox (hidden save kept, not loaded, not imported)');
function fn(name) {
  const start = ui.indexOf('  function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  return ui.slice(start, ui.indexOf('\n  }\n', start) + 4);
}
const KEY = 'digivice-save-v1';
const store = {};
const calls = [];
const sb = {
  JSON, String,
  window: { Devices: D, SaveIO: { hasLocal: () => !!store[KEY], loadLocal: () => (store[KEY] ? JSON.parse(store[KEY]) : null),
    decode: (c) => ({ state: JSON.parse(c) }) } },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  state: null, view: 'play', sel: -1,
  $: () => ({ style: {} }), fillEggGrid() { calls.push('picker'); }, showOverlay(id) { calls.push('overlay:' + id); },
  toast(m) { calls.push('toast:' + m); }, hideAllOverlays() {}, loadGame(s) { calls.push('load:' + s.eggKind); sb.state = s; },
  confirm: () => true, openFirstClockSetIfNeeded() {}, persist() { calls.push('persist'); }
};
sb.window.confirm = () => true;
vm.createContext(sb);
vm.runInContext(ui.match(/  var PARKED_PREFIX = '[^']+';\n/)[0] + ['eggAllowed', 'stateAllowed', 'parkHiddenSave', 'showPickerOnly', 'shotSelectsHidden', 'doImportText'].map(fn).join('\n') +
  '\nthis.api = { park: parkHiddenSave, picker: showPickerOnly, shot: shotSelectsHidden, importText: doImportText, eggAllowed: eggAllowed };', sb);
const pen = { family: 'pendulum', eggKind: 'pen_2_0', mon: 'gomamon', age: 3 };
store[KEY] = JSON.stringify(pen);
const before = store[KEY];
const k = sb.api.park(JSON.parse(store[KEY]));
eq(k, 'digivice-save-v1-parked-pendulum', 'parked under its family');
eq(store[k], before, 'parked copy is the exact save');
eq(store[KEY], before, 'main save slot untouched');
sb.api.picker('note');
ok(calls.indexOf('overlay:overlay-egg') >= 0 && calls.indexOf('picker') >= 0, 'goes to the picker');
eq(sb.state, null, 'hidden save is not loaded into the game');
ok(calls.indexOf('persist') < 0, 'nothing is written over the save');
calls.length = 0;
sb.api.importText(JSON.stringify({ family: 'digivice', eggKind: 'dv1999_v1' }));
ok(!calls.some((c) => /^load:/.test(c)), 'importing a hidden-line save code is refused');
eq(store[KEY], before, 'and the stored save is unchanged');
sb.api.importText(JSON.stringify({ eggKind: 'ver2', version: 2 }));
ok(calls.indexOf('load:ver2') >= 0, 'a 1997 save code still imports');
ok(sb.api.shot('pen-idle', null) && sb.api.shot('idle', 'pen_1_0') && sb.api.shot('digivice-map', null) && sb.api.shot('pen-20th-sk-idle', null), 'links into hidden lines are ignored');
ok(!sb.api.shot('idle', '1') && !sb.api.shot('expr', 'zuba') && !sb.api.shot('night-1997', null), '1997 / DM20 links still work');
ok(/if \(saved && !stateAllowed\(saved\)\) \{[\s\S]{0,200}parkHiddenSave\(saved\);\s*showPickerOnly\(/.test(ui), 'startup parks a hidden save and opens the picker');
ok(/function newEgg\(version, special, randomize\) \{\s*if \(!eggAllowed\(special \|\| String\(version\)\)\)/.test(ui), 'newEgg refuses a hidden egg');
ok(/if \(target && !stateAllowed\(target\)\) target = null;/.test(ui), 'step links do not edit a hidden save');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
