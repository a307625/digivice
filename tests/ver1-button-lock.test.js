#!/usr/bin/env node
/**
 * v90 button audit (1997 brick). Runs the real pressA / pressB / pressC,
 * cycleSel, confirmSel and goHome from js/ui.js in a sandbox with stub
 * screens, then checks:
 *  - while a feed, a refusal, a flush or an action's reaction pose plays,
 *    A does not move the icon, B does not start another action and C does
 *    not cut it short (disassembly §9: the icon cursor is the mode; Humulos
 *    DMC: no animation skip on Ver.1/Ver.2; NHOKO: training C only before
 *    the attack);
 *  - on the egg only the clock works: A and C do nothing, B shows the clock
 *    (Bandai Ver.1 JP manual p1, US manual "Setting the Timer");
 *  - C in clock SET locks the time in and leaves the running clock up; B
 *    then goes home (both manuals). DM20 still goes straight home.
 *  - idle, status, food, lights and clock keys are unchanged.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
function fn(name) {
  const start = src.indexOf('  function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  // Functions in ui.js are two-space indented; the body ends at "\n  }\n".
  const end = src.indexOf('\n  }\n', start);
  return src.slice(start, end + 4);
}
function block(name) {
  const start = src.indexOf('  var ' + name);
  return src.slice(start, src.indexOf('\n', start) + 1);
}

console.log('1997 Ver.1 buttons during actions, on the egg, and in clock SET');
console.log('================================================================\n');

const NAMES = ['goHome', 'isMenuView', 'cycleSel', 'confirmSel', 'pressA', 'pressB', 'pressC',
  'v1ActionBusy', 'v1EggLocked', 'v1IdleHome', 'maybeNewEggCombo', 'playPose', 'notePoop'];
const code = block('feedReturnPending') + block('poopSeen') + NAMES.map(fn).join('\n') + `
  this.api = { pressA: pressA, pressB: pressB, pressC: pressC,
    busy: v1ActionBusy, eggLocked: v1EggLocked, idleHome: v1IdleHome, eggCombo: maybeNewEggCombo, notePoop: notePoop,
    setFeedPending: function (v) { feedReturnPending = v; },
    getPose: function () { return poseFx; } };`;

function makeWorld(family) {
  const w = {
    family: family || 'dm1997',
    now: 1000,
    calls: [],
    egg: false,
    setMode: false
  };
  const ctx = {
    Date: { now: () => 100000 + w.now * 10 },
    performance: { now: () => w.now },
    window: { Engine: { cancelTraining() { w.calls.push('cancelTraining'); } } },
    view: 'play', sel: -1, statusPage: 0, foodSel: 0, lightSel: 0, battleSel: 0,
    albumSel: 0, albumPose: 0, connectSel: 0, chordAt: 0, lastKeyAt: 0,
    keyA: false, keyB: false, keyC: false,
    eatAnim: { on: false }, flushAnim: { on: false }, poseFx: { name: null, until: 0 },
    train: {}, charge: {},
    state: { mon: 'agumon', dead: false },
    beep() {}, anyOverlay: () => false, hideAllOverlays() {},
    maybeClockSetCombo: () => false,
    isClockSetView: () => w.setMode,
    getClockHold: () => ({ shouldIgnoreClick: () => false }),
    clockSetAdjust(part) { w.calls.push('adjust:' + part); },
    engine: () => ({ confirmClockSet() { w.calls.push('confirmSet'); w.setMode = false; } }),
    persist() {},
    isDigivice: () => false, isPen20: () => false, isPendulum: () => false,
    currentDevice: () => ({ family: w.family }),
    is1997Brick: () => w.family === 'dm1997',
    isEggStage: () => w.egg,
    statusPages: () => [0, 1, 2, 3, 4],
    battleMenuItems: () => ['SINGLE'],
    selectable: () => ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'],
    trainInput(k) { w.calls.push('train:' + k); },
    ver1CancelLocked: () => false,
    openStatus() { ctx.statusPage = 0; ctx.view = 'status'; },
    openFood() { ctx.view = 'food'; w.calls.push('openFood'); },
    startTrain() { w.calls.push('startTrain'); ctx.view = 'train'; },
    openBattleMenu() { w.calls.push('battle'); ctx.view = 'battle'; },
    doFlush() { w.calls.push('flush'); },
    doLights() { ctx.view = 'lightMenu'; },
    doHeal() { w.calls.push('heal'); },
    doFeed() { w.calls.push('feed'); ctx.view = 'play'; ctx.eatAnim.on = true; },
    confirmLight() { ctx.view = 'play'; },
    confirmAlbum() {}, confirmConnect() {}, cpuBattle() { w.calls.push('cpuBattle'); },
    stopTagMeter() {}, fillJogress() {}, showOverlay(id) { w.calls.push('overlay:' + id); },
    fillEggGrid() {}
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  w.ctx = ctx;
  w.api = ctx.api;
  w.press = function (k) {
    w.now += 1000; // past the 900 ms chord guard
    w.api['press' + k]();
  };
  return w;
}

console.log('1) Feeding: A / B / C are ignored until the meal ends');
{
  const w = makeWorld();
  const c = w.ctx;
  c.view = 'play'; c.sel = 1; c.eatAnim.on = true;
  ok(w.api.busy(), 'eating counts as busy');
  w.press('A'); eq(c.sel, 1, 'A during eating keeps the FEED icon');
  eq(c.view, 'play', 'A during eating keeps the eating screen');
  w.press('B'); eq(c.view, 'play', 'B during eating does not reopen the food menu');
  ok(w.calls.indexOf('openFood') < 0 && w.calls.indexOf('feed') < 0, 'B during eating does not feed again');
  w.press('C'); eq(c.sel, 1, 'C during eating does not clear the icon');
  eq(c.view, 'play', 'C during eating does not leave');
  c.eatAnim.on = false; c.view = 'food';
  w.press('A'); eq(c.foodSel, 1, 'after the meal A moves the meat / protein arrow again');
}

console.log('2) Refusal: the head-shake and the way back to the menu are locked');
{
  const w = makeWorld();
  const c = w.ctx;
  c.view = 'play'; c.sel = 1;
  c.poseFx = { name: 'refuse', until: w.now + 5000 };
  w.api.setFeedPending(true);
  w.press('A'); eq(c.sel, 1, 'A during the refusal keeps FEED');
  w.press('B'); ok(w.calls.length === 0, 'B during the refusal starts nothing');
  c.poseFx = { name: null, until: 0 };
  ok(w.api.busy(), 'still busy until the screen goes back to the food menu');
  w.api.setFeedPending(false);
  ok(!w.api.busy(), 'free once the food menu is back');
}

console.log('3) Flush, heal, training and battle reaction poses');
{
  const w = makeWorld();
  const c = w.ctx;
  c.view = 'play'; c.sel = 4; c.flushAnim.on = true;
  w.press('A'); eq(c.sel, 4, 'A during the flush keeps FLUSH');
  w.press('B'); ok(w.calls.indexOf('flush') < 0, 'B during the flush does not flush again');
  w.press('C'); eq(c.sel, 4, 'C during the flush keeps FLUSH');
  c.flushAnim.on = false;
  c.poseFx = { name: 'happy', until: w.now + 1500 };
  c.sel = 6;
  w.press('A'); // +1000 ms, still inside the pose
  eq(c.sel, 6, 'A during the heal pose keeps MEDIC (no wrap to home)');
  c.poseFx = { name: 'happy', until: w.now + 1500 };
  w.press('B'); eq(c.view, 'play', 'B during the heal pose does not open the clock');
  ok(w.calls.indexOf('heal') < 0, 'B during the heal pose does not heal again');
  c.poseFx = { name: 'happy', until: w.now + 500 }; // ends before the next press
  w.press('A'); eq(c.sel, -1, 'after the pose, A on MEDIC wraps home as before');
  c.sel = 2; c.poseFx = { name: 'angry', until: w.now + 4000, extra: 'train' };
  w.press('A'); w.press('B');
  eq(c.sel, 2, 'training result pose: A keeps TRAIN');
  ok(w.calls.indexOf('battle') < 0 && w.calls.indexOf('startTrain') < 0, 'training result pose: B starts nothing');
}

console.log('4) Free states are unchanged');
{
  const w = makeWorld();
  const c = w.ctx;
  w.press('C'); eq(c.sel, -1, 'idle: C keeps no icon');
  w.press('A'); eq(c.sel, 0, 'idle: A selects STATUS');
  w.press('C'); eq(c.sel, -1, 'icon: C clears it');
  w.press('B'); eq(c.view, 'clock', 'idle: B opens the clock');
  w.press('A'); eq(c.view, 'clock', 'clock: A does nothing');
  w.press('B'); eq(c.view, 'play', 'clock: B goes home');
  c.sel = 0; w.press('B'); eq(c.view, 'status', 'B on STATUS opens status');
  w.press('A'); eq(c.statusPage, 1, 'status: A turns the page');
  w.press('B'); eq(c.statusPage, 2, 'status: B turns the page');
  w.press('C'); eq(c.view, 'play', 'status: C goes home'); eq(c.sel, -1, 'status: C clears the icon');
  c.sel = 5; w.press('B'); eq(c.view, 'lightMenu', 'B on LIGHT opens on / off');
  w.press('A'); eq(c.lightSel, 1, 'lights: A moves the arrow');
  w.press('C'); eq(c.view, 'play', 'lights: C goes home');
  c.sel = 6; w.press('A'); eq(c.sel, -1, 'A after MEDIC wraps home');
  ok(!w.api.busy(), 'nothing busy on an idle screen');
}

console.log('5) Egg: only the clock works before the hatch');
{
  const w = makeWorld();
  const c = w.ctx;
  w.egg = true;
  ok(w.api.eggLocked(), 'egg locked on the 1997 play screen');
  w.press('A'); eq(c.sel, -1, 'egg: A selects no icon');
  w.press('C'); eq(c.sel, -1, 'egg: C does nothing');
  c.sel = 1; w.press('B'); eq(c.view, 'clock', 'egg: B shows the clock even if an icon was left lit');
  eq(c.sel, -1, 'egg: the icon is cleared');
  ok(w.calls.length === 0, 'egg: no care action ran');
  w.press('B'); eq(c.view, 'play', 'egg clock: B goes back to the egg');
  const d = makeWorld('dm20');
  d.egg = true;
  ok(!d.api.eggLocked(), 'DM20 egg keeps its own rules');
}

console.log('6) Clock SET: C locks the time in, the clock stays up, B goes home');
{
  const w = makeWorld();
  const c = w.ctx;
  c.view = 'clock'; w.setMode = true;
  w.press('A'); w.press('B');
  ok(w.calls[0] === 'adjust:h' && w.calls[1] === 'adjust:m', 'SET: A = hour, B = minute');
  w.press('C');
  ok(w.calls.indexOf('confirmSet') >= 0, 'SET: C confirms');
  eq(c.view, 'clock', 'SET: after C the running clock is still shown');
  w.press('B'); eq(c.view, 'play', 'clock: B returns to the main screen');
  const d = makeWorld('dm20');
  d.ctx.view = 'clock'; d.setMode = true;
  d.press('C'); eq(d.ctx.view, 'play', 'DM20: C confirm still returns to the pet');
}

console.log('7) Other devices are not locked');
{
  const w = makeWorld('dm20');
  const c = w.ctx;
  c.view = 'play'; c.sel = 1; c.eatAnim.on = true;
  ok(!w.api.busy(), 'DM20 eating is not covered by the 1997 lock');
}

console.log('8) Idle count closes any open 1997 menu (disassembly 0x0866)');
{
  ['status', 'food', 'lightMenu'].forEach(function (v) {
    const w = makeWorld();
    w.ctx.view = v; w.ctx.sel = 1;
    ok(w.api.idleHome() === true, v + ': idle timeout acts');
    eq(w.ctx.view, 'play', v + ': back home'); eq(w.ctx.sel, -1, v + ': no icon lit');
  });
  const t = makeWorld();
  t.ctx.view = 'train'; t.ctx.sel = 2;
  t.ctx.train = { mode: 'highlow', phase: 'standoff', done: false, decided: false };
  ok(t.api.idleHome() === true, 'training stand-off times out');
  eq(t.ctx.view, 'play', 'training stand-off: home'); eq(t.ctx.sel, -1, 'training stand-off: no icon');
  ok(t.calls.indexOf('cancelTraining') >= 0, 'training stand-off: counted like a C cancel');
  const a = makeWorld();
  a.ctx.view = 'train'; a.ctx.train = { mode: 'highlow', phase: 'attack', done: false };
  ok(!a.api.idleHome() && a.ctx.view === 'train', 'a shot in flight is not cut by the timeout');
  ['clock', 'play', 'evo', 'battle', 'grave'].forEach(function (v) {
    const x = makeWorld(); x.ctx.view = v;
    ok(!x.api.idleHome() && x.ctx.view === v, v + ': not closed by the menu timeout');
  });
  const d = makeWorld('dm20'); d.ctx.view = 'status';
  ok(!d.api.idleHome() && d.ctx.view === 'status', 'DM20 menus unchanged');
  ok(/v1IdleHome\(\)/.test(src) && /lastKeyAt > 60000\) v1IdleHome/.test(src), 'frame loop calls the menu timeout with the 60 s idle count');
}

console.log('9) Grave: 1997 takes only A+C (ROM 0x0CEF); DM20 still A+B');
{
  const w = makeWorld();
  w.ctx.view = 'grave'; w.ctx.state.dead = true;
  w.ctx.keyA = true; w.ctx.keyB = true;
  ok(!w.api.eggCombo(), '1997 grave: A+B does nothing');
  w.ctx.keyB = false; w.ctx.keyC = true;
  ok(w.api.eggCombo(), '1997 grave: A+C opens the egg picker');
  const d = makeWorld('dm20');
  d.ctx.view = 'grave'; d.ctx.state.dead = true; d.ctx.keyA = true; d.ctx.keyB = true;
  ok(d.api.eggCombo(), 'DM20 grave: A+B still works');
}

console.log('10) Eric\'s poop squat (refuse cell, then happy) locks the keys (ROM mode A)');
{
  const w = makeWorld();
  w.ctx.view = 'play'; w.ctx.sel = -1;
  w.ctx.poseFx = { name: 'poop', until: w.now + 5000, started: w.now };
  ok(w.api.busy(), 'the poop pose counts as busy');
  w.press('A'); eq(w.ctx.sel, -1, 'A during the squat lights no icon');
  w.press('B'); eq(w.ctx.view, 'play', 'B during the squat opens no clock');
  w.press('C'); eq(w.ctx.view, 'play', 'C during the squat changes nothing');
  w.now += 5000;
  ok(!w.api.busy(), 'free once the squat and sit are over');
  w.press('A'); eq(w.ctx.sel, 0, 'A works again afterwards');
  ok(/function notePoop\(\)/.test(src) && /playPose\('poop', 2000\)/.test(src), 'Eric\'s notePoop squat is the only squat path');
  ok(!/_toilet|'toilet'/.test(src), 'the old <id>_toilet.png hook is gone');
  ok(/poseFx\.name === 'poop'/.test(src) && /'refuse' : 'happy'/.test(src), 'squat draws refuse, then happy');
  const t = makeWorld();
  t.ctx.view = 'status';
  ok(t.api.idleHome() && t.ctx.view === 'play', 'menu timeout lands on play, where a later pile can squat');
}

console.log('10b) v93: 1997 squat only from the plain home screen (ROM mode 0)');
{
  function pile(family, view, sel, extra) {
    const w = makeWorld(family);
    w.ctx.state = Object.assign({ mon: 'agumon', dead: false, sleeping: false, poop: 0 }, extra || {});
    w.ctx.view = view; w.ctx.sel = sel;
    w.api.notePoop();                 // first tick only records the count
    w.ctx.state.poop = 1;
    w.api.notePoop();
    return w;
  }
  let w = pile('dm1997', 'play', -1);
  eq(w.api.getPose().name, 'poop', '1997 home screen, no icon lit: squat plays');
  eq(w.ctx.state.poop, 1, 'and the pile is there');
  ok(w.api.busy(), 'keys locked while it plays');
  for (const s of [0, 3, 5]) {
    w = pile('dm1997', 'play', s);
    eq(w.api.getPose().name, null, '1997 icon ' + s + ' lit: no squat');
    eq(w.ctx.state.poop, 1, '1997 icon ' + s + ' lit: pile still added');
    w.press('A'); eq(w.ctx.sel, s + 1, '1997 icon ' + s + ' lit: A still moves the cursor (not locked)');
  }
  for (const v of ['status', 'food', 'lightMenu', 'clock', 'train']) {
    w = pile('dm1997', v, -1);
    eq(w.api.getPose().name, null, '1997 ' + v + ' open: no squat');
    eq(w.ctx.state.poop, 1, '1997 ' + v + ' open: pile still added');
  }
  // Later pile after going back home with no icon lit squats again.
  w = pile('dm1997', 'play', 2);
  w.ctx.sel = -1; w.ctx.state.poop = 2; w.api.notePoop();
  eq(w.api.getPose().name, 'poop', '1997: next pile after returning to the plain home screen squats');
  w = pile('dm1997', 'play', -1, { sleeping: true });
  eq(w.api.getPose().name, null, '1997 asleep: no squat (unchanged)');
  // Other families keep Eric's b00ed93 behaviour (ROM rule only known for Ver.1).
  for (const f of ['dmc', 'dm20', 'pen20', 'pendulum']) {
    w = pile(f, 'play', 2);
    eq(w.api.getPose().name, 'poop', f + ' with an icon lit: squat unchanged (Eric b00ed93)');
    w = pile(f, 'status', -1);
    eq(w.api.getPose().name, null, f + ' on a menu: no squat (unchanged)');
  }
  ok(/var v1Quiet = is1997Brick\(\) && sel >= 0;/.test(src), 'notePoop carries the 1997 icon-lit check');
}

console.log('11) Source wiring');
{
  ['pressA', 'pressB', 'pressC'].forEach(function (n) {
    const f = fn(n);
    const lock = f.indexOf('v1ActionBusy()');
    ok(lock > 0, n + ' checks the action lock');
    ok(lock < f.indexOf('isClockSetView()'), n + ' checks it before the clock and device paths');
    ok(f.indexOf('v1EggLocked()') > 0, n + ' checks the egg lock');
  });
  ok(/is1997Brick\(\)/.test(fn('v1ActionBusy')), 'the action lock is 1997 only');
  ok(/feedReturnPending = false;/.test(fn('doFeed')), 'the refusal clears its pending flag when the food menu returns');
  ok(/uiState: function/.test(src), 'VpetDebug.uiState test hook present');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) { console.log(failures.join('\n')); process.exit(1); }
