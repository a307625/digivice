#!/usr/bin/env node
/**
 * Second-level screens: A must not move the icon selection behind them,
 * and must not close the screen. A choice list may still move its own
 * cursor (Humulos: A selects a menu item, B confirms).
 */
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

console.log('Second-level A does not move the icon');
console.log('=====================================\n');

console.log('1) 1997 / DM20 cycleSel');
{
  const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  const start = src.indexOf('function cycleSel()');
  const end = src.indexOf('function disturb', start);
  const fn = src.slice(start, end);
  ok(start > 0 && end > start, 'cycleSel exists');
  ok(/if \(view !== 'play'\)/.test(fn), 'non-play returns before the icon moves');
  ok(!/view = 'play'/.test(fn), 'A does not close a second-level screen');
  ok(!/leaving a submenu/.test(fn), 'the leave-and-advance path is gone');
  const nonPlay = fn.split("if (view !== 'play')")[1].split('var list = selectable()')[0];
  ok(/return;/.test(nonPlay), 'the non-play branch returns');
  ok(!/sel = \(sel \+ 1\)/.test(nonPlay), 'the non-play branch does not touch sel');
  ok(/foodSel = \(foodSel \+ 1\) % 2/.test(nonPlay), 'food still moves only its own cursor');
  ok(/battleSel = \(battleSel \+ 1\)/.test(nonPlay), 'DM20 battle list still moves only its own cursor');
  ok(/!is1997Brick\(\)/.test(nonPlay), '1997 does not walk a battle list');
  const icon = fn.split('var list = selectable()')[1] || '';
  ok(/sel = \(sel \+ 1\)/.test(icon), 'home screen A still advances the icon');
  ok(/indexOf\('STATUS'\)/.test(icon), 'the icon row still wraps to STATUS');
}

function track(start) {
  const box = { sel: start, sets: 0 };
  return {
    box: box,
    getSel: function () { return box.sel; },
    setSel: function (n) { box.sets++; box.sel = n; }
  };
}

console.log('2) Pendulum: A on a second-level screen leaves the icon index');
{
  global.PendulumData = require('../js/devices/pendulum/data.js');
  global.PendulumEngine = require('../js/devices/pendulum/engine.js');
  const UI = require('../js/devices/pendulum/ui.js');
  const s = global.PendulumEngine.defaultState('pen_1_0');
  s.clockInitialized = true;
  s.mon = 'tentomon';
  const t = track(3);
  function host(view) {
    return {
      state: s,
      view: view,
      profile: global.PendulumData.PROFILE,
      getSel: t.getSel,
      setSel: t.setSel,
      setView: function () { throw new Error('A must not change the view'); },
      persist: function () {}
    };
  }
  UI.setSubSel(0);
  ok(UI.pressA(host('food')) === true, 'food A is handled by the device');
  eq(t.box.sel, 3, 'food A does not move the icon');
  eq(t.box.sets, 0, 'food A does not write the icon index');
  eq(UI.getSubSel(), 1, 'food A still moves the meat / protein cursor');
  UI.pressA(host('healMenu'));
  eq(t.box.sel, 3, 'heal A does not move the icon');
  UI.pressA(host('lightMenu'));
  eq(t.box.sel, 3, 'light A does not move the icon');
  UI.pressA(host('connect'));
  eq(t.box.sel, 3, 'connect A does not move the icon');
  UI.pressA(host('status'));
  eq(t.box.sel, 3, 'status A does not move the icon');
  eq(UI.pressA(host('evo')), false, 'evolution A is not a menu cycle');
  eq(t.box.sets, 0, 'evolution A does not write the icon index');
}

console.log('3) Pen20: A cycles icons only on the home screen');
{
  const UI = require('../js/devices/pen20/ui.js');
  const s = { screenOff: false, pets: [], unlockedEggs: ['digitama_nsp'], album: [], copymon: [] };
  const t = track(4);
  function host(view) {
    return {
      state: s,
      view: view,
      getSel: t.getSel,
      setSel: t.setSel,
      setView: function () { throw new Error('A must not change the view'); }
    };
  }
  UI.setSubSel(0);
  UI.pressA(host('food'));
  eq(t.box.sel, 4, 'food A does not move the icon');
  eq(UI.getSubSel(), 1, 'food A still moves the meat / protein cursor');
  UI.pressA(host('healMenu'));
  eq(t.box.sel, 4, 'heal A does not move the icon');
  UI.pressA(host('coloMenu'));
  eq(t.box.sel, 4, 'colosseum A does not move the icon');
  UI.pressA(host('status'));
  eq(t.box.sel, 4, 'status A does not move the icon');
  UI.pressA(host('evo'));
  eq(t.box.sel, 4, 'evolution A does not move the icon in the background');
  eq(t.box.sets, 0, 'no second-level A wrote the icon index');
  UI.pressA(host('play'));
  eq(t.box.sel, 5, 'home screen A still advances the icon');
  t.box.sel = UI.SELECTABLE.length - 1;
  UI.pressA(host('play'));
  eq(t.box.sel, 0, 'the icon row still wraps to STATUS, album and connect included');
}

console.log('4) Digivice: A inside a screen does not move the menu row');
{
  global.window = global;
  const UI = require('../js/devices/digivice/ui.js');
  const U = UI.getUi();
  UI.resetUi();
  U.screen = 'status';
  U.menuI = 2;
  U.statusI = 0;
  UI.pressA({ state: { party: [{}], active: 0 } });
  eq(U.menuI, 2, 'status A does not move the menu row');
  eq(U.screen, 'status', 'status A stays on status');
  U.screen = 'map';
  UI.pressA({ state: {} });
  eq(U.menuI, 2, 'map A does not move the menu row');
  eq(U.screen, 'map', 'map A stays on map');
  U.screen = 'vs';
  U.vsI = 0;
  UI.pressA({ state: {}, persist: function () {} });
  eq(U.vsI, 0, 'vs A does not switch the vs row');
  eq(U.menuI, 2, 'vs A does not move the menu row');
}

console.log('5) Finishing a fight does not send the cursor to the first item');
{
  const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  const fx = src.slice(src.indexOf('function finishBattleFx'), src.indexOf('function confirmSel'));
  ok(!/battleSel\s*=/.test(fx), 'battle end does not reset the battle row');
  ok(!/\bsel\s*=/.test(fx), 'battle end does not move the icon');
  const open = src.slice(src.indexOf('function openBattleMenu'), src.indexOf('function fillJogress'));
  ok(!/battleSel\s*=/.test(open), 'opening the battle list does not jump to the first row');
  const pen = fs.readFileSync(path.join(__dirname, '../js/devices/pendulum/ui.js'), 'utf8');
  const tick = pen.slice(pen.indexOf('function tickMinigame'), pen.indexOf('function onShake'));
  const result = tick.split("battle.phase === 'result'")[1].split('}')[0];
  ok(!/setSel\(/.test(result), 'pendulum battle end does not move the icon');
  const UI = require('../js/devices/pen20/ui.js');
  UI.setSubSel(1);
  let sel = 3;
  let sets = 0;
  UI.pressB({
    state: { screenOff: false },
    view: 'colo',
    getSel: function () { return sel; },
    setSel: function (n) { sets++; sel = n; },
    setView: function () {}
  });
  eq(sel, 3, 'pen20 colo end stays on the colosseum icon');
  eq(sets, 0, 'pen20 colo end does not write the icon index');
  eq(UI.getSubSel(), 1, 'pen20 colo end keeps the list row');
  const Dv = require('../js/devices/digivice/ui.js');
  Dv.resetUi();
  const U = Dv.getUi();
  U.menuI = 4;
  U.screen = 'main';
  Dv.pressA({ state: { party: [{}], active: 0 } });
  eq(U.screen, 'menu', 'digivice A opens the menu');
  eq(U.menuI, 4, 'digivice A reopens the menu on the same row');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach(function (f) { console.log('  · ' + f); });
process.exit(failed ? 1 : 0);
