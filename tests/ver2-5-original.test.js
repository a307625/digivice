#!/usr/bin/env node
/**
 * v100 (Eric 「改 Ver.2 到 Ver.5」): 1997 一般版 Ver.2-Ver.5 follow the original
 * devices and Ver.1's decided rules. Per version (2, 3, 4, 5):
 *  1  engine: hatch 5 min after SET, lights care mistake after 20 min,
 *     hunger/strength call 20 min, woken pet re-sleeps after 10 min,
 *     baby I is Punimon / Poyomon / Yuramon / Zurumon, Megas kept
 *  2  egg hatch: Eric's official crack / hatch cells (sprites.js) for every
 *     version; the user egg idle PNGs must not hide them (v101 guard);
 *     user egg_v<N>_crack / _burst0 / _burst1 still win when present
 *  3  training: real ver25 scene code in a sandbox (Power meter / NN% in
 *     10 % steps, only full wins, shot from the right at the target on the
 *     left, burst, broken target, happy + sun; miss = angry; C locked
 *     during the scene; 60 s idle goes home)
 *  4  UI rules shared by the whole 1997 line (key lock, grave A+C, idle home,
 *     squat, clock hold) are keyed on the family, not on Ver.1
 * DM20 keeps its own rules.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
['js/evolution-data.js', 'js/evolution.js', 'js/sprites.js', 'js/save.js', 'js/battle.js', 'js/steps.js', 'js/devices/registry.js', 'js/engine.js']
  .forEach((f) => require(path.join(ROOT, f)));
const Engine = global.Engine;
const D = global.EvolutionData;

let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

const BABY = { 1: 'botamon', 2: 'punimon', 3: 'poyomon', 4: 'yuramon', 5: 'zurumon' };
const ROOKIE = { 1: 'agumon', 2: 'gabumon', 3: 'patamon', 4: 'piyomon', 5: 'gazimon' };
const MODE = { 2: 'meter', 3: 'mash', 4: 'number', 5: 'meter_slow' };

console.log('1) engine rules per version');
for (const v of [1, 2, 3, 4, 5]) {
  const egg = Engine.defaultState(v);
  ok(Engine.is1997Brick(egg), `Ver.${v}: egg is a 1997 brick`);
  eq(Engine.eggHatchMinutes(egg), 5, `Ver.${v}: hatch 5 minutes after SET`);
  const rk = Object.assign(Engine.defaultState(v), { mon: ROOKIE[v] });
  eq(Engine.lightsCallTimeout(rk), 20 * 60, `Ver.${v}: lights care mistake after 20 min`);
  eq(Engine.CALL_TIMEOUT, 20 * 60, `Ver.${v}: hunger / strength call 20 min`);
  const babies = Object.keys(D.MONSTERS).filter((k) => D.MONSTERS[k].version === v && D.MONSTERS[k].stage === 'baby1');
  eq(babies, [BABY[v]], `Ver.${v}: Baby I is ${BABY[v]}`);
  const megas = Object.keys(D.MONSTERS).filter((k) => D.MONSTERS[k].version === v && D.MONSTERS[k].stage === 'mega');
  ok(megas.length === 2, `Ver.${v}: both Megas kept (${megas.join(', ')})`);
  // Egg really hatches at 5 min, not 1.
  const s = Engine.defaultState(v);
  s.clockInitialized = true; s.evoDueAt = Engine.eggHatchMinutes(s);
  ok(Engine.mon(s).stage === 'egg', `Ver.${v}: still an egg right after SET`);
}
{
  const src = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
  ok(/var DISTURB_AWAKE_SEC = 10 \* 60;/.test(src), 'all 1997 versions: a woken pet stays awake 10 min, then sleeps again');
  ok(/return is1997Brick\(state\) \? BRICK97_LIGHTS_CALL_TIMEOUT : LIGHTS_CALL_TIMEOUT;/.test(src), 'lights timer keyed on the 1997 line');
  const dm = Engine.defaultState(1, 'zuba');
  ok(!Engine.is1997Brick(dm), 'a special / DM20 egg is not a 1997 brick');
  eq(Engine.eggHatchMinutes(dm), 1, 'special / DM20 egg keeps its 1-minute hatch');
}
{
  // Ver.2 protein energy wraps like Ver.1 (DMComm JP V2); Ver.3-5 stop at the default.
  for (const v of [2, 3]) {
    const s = Object.assign(Engine.defaultState(v), { mon: ROOKIE[v] });
    s.clockInitialized = true; s.dp = s.dpMax = 3; s.proteinRemainder = 3; s.strength = 0; s.hunger = 4;
    const before = s.dp;
    Engine.feedProtein(s);
    if (v === 2) eq(s.dp, before + 1, 'Ver.2: 4th protein raises energy past the default (wrap rule)');
    else eq(s.dp, before, 'Ver.3: energy stops at the default');
  }
}

{
  // v101 Eric decisions: lifespans follow Humulos; Ver.5 Gizamon split stays 8-15 / 16+.
  const C = D.CARE;
  for (const [id, h] of [['palmon', 76], ['gizamon', 76], ['digitamamon', 108], ['extyranomon', 108]]) {
    eq([C[id].lifespanMin, C[id].lifespanMax], [(h - 4) * 60, (h + 4) * 60], `${id}: lifespan ${h} h (Humulos) ±4 h window`);
  }
  const gz = D.BRANCHES.gizamon;
  eq(gz.find((b) => b.to === 'tuskmon').train, [8, 15], 'Ver.5 Gizamon → Tuskmon 8-15 training (kept)');
  eq(gz.find((b) => b.to === 'deltamon').train, [16, null], 'Ver.5 Gizamon → Deltamon 16+ training (kept)');
}

console.log('2) hatch crack / burst art per egg');
const ui = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
function fn(name) {
  const start = ui.indexOf('  function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  const end = ui.indexOf('\n  }\n', start);
  return ui.slice(start, end + 4);
}
function varBlock(name, endMark) {
  const start = ui.indexOf('  var ' + name);
  if (start < 0) throw new Error('missing var ' + name);
  return ui.slice(start, ui.indexOf(endMark, start) + endMark.length);
}
{
  const user = {};
  const sb = { window: { UserSprites: { getExact: (f, id, fr) => (f === 'dm1997' && user[id + '_' + fr]) || null } },
    evoFx: { from: 'egg_v3', to: 'poyomon' }, idleFrame: () => 'idle0' };
  vm.createContext(sb);
  vm.runInContext(fn('v1HatchFrame') + fn('evo97Pick') + '\nthis.pick = evo97Pick;', sb);
  for (const v of [2, 3, 4, 5]) {
    sb.evoFx = { from: 'egg_v' + v, to: BABY[v] };
    for (const k of Object.keys(user)) delete user[k];
    const plain = [0, 1, 2, 3, 4, 5, 6, 7].map((t) => sb.pick(t).fr + (sb.pick(t).id === BABY[v] ? '*' : ''));
    // Eric v100 cells; v101 (Eric): the hatch cell stays ~2 s (t 3-6 at 2 Hz) like the Ver.1 video.
    eq(plain, ['idle0', 'idle0', 'crack', 'hatch', 'hatch', 'hatch', 'hatch', 'idle0*'], `Ver.${v}: egg 1 s → crack 0.5 s → hatch 2 s → baby`);
    user['egg_v' + v + '_crack'] = 1; user['egg_v' + v + '_burst0'] = 1; user['egg_v' + v + '_burst1'] = 1;
    const art = [0, 1, 2, 3, 4, 5, 6, 7].map((t) => sb.pick(t).fr);
    eq(art, ['idle0', 'idle0', 'crack', 'hatch', 'hatch', 'burst0', 'burst1', 'idle0'], `Ver.${v}: egg_v${v}_crack / burst0 / burst1 used when present (inside the 2 s)`);
    eq(sb.pick(7).id, BABY[v], `Ver.${v}: hatches into ${BABY[v]}`);
  }
}

{
  // The official cells exist in sprites.js for every version.
  require(path.join(ROOT, 'js/sprites.js'));
  const SP = global.SpriteAtlas.SPRITES;
  for (const v of [1, 2, 3, 4, 5]) {
    const e = SP['egg_v' + v];
    ok(e && e.frames.crack && e.frames.hatch && e.frames.crack.length === e.h && e.frames.hatch.length === e.h,
      `Ver.${v}: egg_v${v} has official crack + hatch cells (${e && e.w}x${e && e.h})`);
  }
  // v101 guard in spriteCanvas: user fallback never replaces those cells.
  ok(/keepOfficialEggCell\(US, famU, id, sp, frameName\) \? null/.test(ui), 'spriteCanvas uses the guard');
  {
    const sbx = {};
    vm.createContext(sbx);
    vm.runInContext(fn('keepOfficialEggCell') + '\nthis.k = keepOfficialEggCell;', sbx);
    const sp = { frames: { idle0: 1, idle1: 1, crack: 1, hatch: 1 } };
    const none = { getExact: () => null }, has = { getExact: (f, id, fr) => (fr === 'crack' ? {} : null) };
    ok(sbx.k(none, 'dm1997', 'egg_v2', sp, 'crack') && sbx.k(none, 'dm1997', 'egg_v2', sp, 'hatch'), 'no user crack PNG: official cells kept');
    ok(!sbx.k(has, 'dm1997', 'egg_v2', sp, 'crack'), 'a user egg_v2_crack.png still wins');
    ok(!sbx.k(none, 'dm1997', 'egg_v2', sp, 'idle0') && !sbx.k(none, 'dm1997', 'agumon', sp, 'hatch'), 'idle frames and non-eggs unchanged');
    ok(!sbx.k(none, 'dm20', 'egg_x', { frames: { idle0: 1 } }, 'hatch'), 'egg without a built-in hatch cell keeps the user fallback');
  }
  ok(true, 'user egg idle PNGs do not hide the official crack / hatch cells');
}

console.log('3) Ver.2-5 training scene');
const T = (() => {
  const code = varBlock('V25_MODES', '\n') + varBlock('V25 =', '};\n') + varBlock('V25_BAG', '];\n') +
    varBlock('V25_MASH_BY_STAGE', '\n') +
    ['v25MashNeed', 'v25Level', 'ver25TrainScene', 'ver25PhaseMs', 'ver25NextPhase', 'beginVer25Shot', 'ver25TrainTick', 'ver1CancelLocked', 'resolveTrain', 'trainInput', 'v1IdleHome']
      .map(fn).join('\n') + `
  this.api = { scene: ver25TrainScene, tick: ver25TrainTick, resolve: resolveTrain, input: trainInput,
    cancelLocked: ver1CancelLocked, idle: v1IdleHome, V25: V25, need: v25MashNeed };
  this.getTrain = function () { return train; };
  this.setTrain = function (t) { train = t; };`;
  const w = { log: [], finished: [], cancelled: 0 };
  const sb = {
    Math, JSON, String, Date: { now: () => w.now }, view: 'train', sel: 0, state: { mon: 'gabumon' }, train: null,
    is1997Brick: () => true, persist() {}, finishTrainRound() { w.log.push('old-finish'); },
    playPose(name, ms, extra) { w.log.push({ pose: name, ms, extra }); },
    window: { Engine: { finishTraining(st, success, att) { w.finished.push([success, att]); }, cancelTraining() { w.cancelled++; } } },
    decideVer1Train() {}, setVer1Phase() {}, ver1RoundHit() { return false; }
  };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  w.sb = sb; w.now = 1000;
  return w;
})();
const A = T.sb.api;
function freshTrain(mode) {
  T.now = 1000; T.log = []; T.finished = []; T.cancelled = 0;
  T.sb.view = 'train';
  T.sb.setTrain({ mode, done: false, success: false, mash: 0, level: 0, num: 0, pos: 0, phase: null, startAt: 1000, lastMs: 1000, acc: 0 });
  return T.sb.getTrain();
}
function run(ms, step) { const end = T.now + ms; while (T.now < end) { T.now += step || 10; A.tick(T.now); T.sb.getTrain().lastMs = T.now; } }
const STEP = { meter: 150, number: 250, meter_slow: 300 };
for (const v of [2, 3, 4, 5]) {
  const mode = MODE[v];
  // Running screen.
  const sc = A.scene(mode, null, 0, 6, false);
  ok(sc.some((e) => e.kind === 'text' && e.s === 'POWER'), `Ver.${v}: "POWER" on the meter screen`);
  if (mode === 'number') {
    ok(sc.some((e) => e.kind === 'number' && e.n === 60) && sc.some((e) => e.kind === 'icon' && e.name === 'percent'), 'Ver.4: shows "60%" at level 6');
    const full = A.scene(mode, null, 0, 10, false);
    ok(full.some((e) => e.kind === 'number' && e.n === 100 && e.col === 9), 'Ver.4: "100%" fits the 32-dot glass (digits from col 9, % at col 24)');
  } else {
    ok(sc.some((e) => e.kind === 'bar' && e.level === 6), `Ver.${v}: segmented Power bar at level 6`);
  }
  // Scene layout.
  const shot = A.scene(mode, 'shot', 0, 10, true);
  ok(shot.some((e) => e.kind === 'target' && e.col === 0) && shot.some((e) => e.kind === 'mon' && e.x === 16 && e.frame === 'attack' && e.flip === false),
    `Ver.${v}: target on the LEFT, Digimon on the RIGHT facing left (Ver.2 manual)`);
  eq([A.scene(mode, 'shot', 0).find((e) => e.kind === 'shot').col, A.scene(mode, 'shot', 600).find((e) => e.kind === 'shot').col], [12, 8], `Ver.${v}: shot flies right → left`);
  eq([A.scene(mode, 'burst', 0)[0].dark, A.scene(mode, 'burst', 600)[0].dark], [false, true], `Ver.${v}: hit mark light, then dark`);
  ok(A.scene(mode, 'broken', 0).some((e) => e.kind === 'target' && e.frame === 'broken'), `Ver.${v}: success breaks the target`);
  ok(A.scene(mode, 'miss', 0).some((e) => e.kind === 'target' && e.frame === 'idle0') && A.scene(mode, 'miss', 0).some((e) => e.kind === 'mon' && e.frame === 'angry'), `Ver.${v}: miss leaves the target, Digimon angry`);

  if (mode !== 'mash') {
    // Timing: one 10 % step per STEP ms; wraps after full.
    let t = freshTrain(mode);
    run(STEP[mode] * 3 + 5, 5);
    eq(T.sb.getTrain().level, 3, `Ver.${v}: 3 steps after ${STEP[mode] * 3} ms (${STEP[mode]} ms a step)`);
    run(STEP[mode] * 8, 5);
    eq(T.sb.getTrain().level, 0, `Ver.${v}: after full it starts again from empty`);
    if (mode === 'number') eq(T.sb.getTrain().num, 0, 'Ver.4: number follows the level × 10');
    // Stop not full → miss.
    t = freshTrain(mode); t.level = 9;
    A.input('B');
    eq([t.done, t.success, t.phase], [true, false, 'shot'], `Ver.${v}: stop at 90 % → miss`);
    eq(T.finished, [[false, true]], `Ver.${v}: miss is reported to the engine as an attempt`);
    ok(A.cancelLocked(), `Ver.${v}: C is ignored during the scene`);
    run(1000 + 1000 + 20);
    ok(T.log.some((e) => e.pose === 'angry' && e.extra === 'train') && T.sb.view === 'play', `Ver.${v}: miss → angry pose, back home`);
    // Stop full → win.
    t = freshTrain(mode); t.level = 10;
    A.input(v === 4 ? 'A' : 'B');
    eq([t.success, t.phase], [true, 'shot'], `Ver.${v}: stop at full → success`);
    const seen = [];
    for (let i = 0; i < 400 && T.sb.view === 'train'; i++) { T.now += 10; A.tick(T.now); if (seen[seen.length - 1] !== t.phase) seen.push(t.phase); }
    eq(seen, ['shot', 'burst', 'broken', 'end'], `Ver.${v}: success plays shot → burst → broken target`);
    ok(T.log.some((e) => e.pose === 'happy' && e.extra === 'train' && e.ms === 4000), `Ver.${v}: then Ver.1's happy + sun pose`);
  } else {
    // v101 (Eric: colour-version rule): 5 s, presses by stage (NHOKO DMC: baby 7, Mega ~20).
    eq(['baby1', 'baby2', 'rookie', 'champion', 'ultimate', 'mega'].map(A.need), [7, 7, 10, 13, 16, 20], 'Ver.3: presses needed by stage 7/7/10/13/16/20');
    eq(A.V25.mashMs, 5000, 'Ver.3: 5 s limit');
    for (const [stage, need] of [['rookie', 10], ['champion', 13], ['ultimate', 16], ['mega', 20]]) {
      let t = freshTrain(mode); t.mashNeed = A.need(stage);
      A.input('A');
      eq(t.mash, 0, `Ver.3 ${stage}: A does nothing (B only)`);
      for (let i = 0; i < need - 1; i++) A.input('B');
      ok(!t.done, `Ver.3 ${stage}: ${need - 1} B is not full yet`);
      ok(A.scene(mode, null, 0, Math.floor((need - 1) * 10 / need)).find((e) => e.kind === 'bar').level === 9, `Ver.3 ${stage}: bar at 9 of 10 one press short`);
      A.input('B');
      eq([t.done, t.success, t.phase], [true, true, 'shot'], `Ver.3 ${stage}: B #${need} fills the bar → success scene`);
    }
    let t = freshTrain(mode); t.mashNeed = 10;
    for (let i = 0; i < 9; i++) A.input('B');
    run(4900, 50);
    ok(!t.done, 'Ver.3: still running at 4.9 s');
    run(200, 50);
    eq([t.done, t.success], [true, false], 'Ver.3: time out after 5 s → miss');
  }
  // 60 s idle while the meter runs: home, session cancelled.
  const t2 = freshTrain(mode);
  ok(A.idle() === true && T.sb.view === 'play' && T.sb.sel === -1, `Ver.${v}: 60 s idle on the running meter goes home`);
  t2.done = true;
}

console.log('4) the rest of Ver.1\'s rules are family-wide');
{
  ok(/function v1ActionBusy\(\) \{\s*if \(!is1997Brick\(\)/.test(ui), 'action key lock keyed on the 1997 family');
  ok(/function v1EggLocked\(\) \{\s*return is1997Brick\(\)/.test(ui), 'egg key lock keyed on the 1997 family');
  ok(/function v1IdleHome\(\) \{\s*if \(!is1997Brick\(\)/.test(ui), '60 s menu idle keyed on the 1997 family');
  ok(/d\.version === 1\) mode = 'highlow'/.test(ui) && /d\.version === 3\) mode = 'mash'/.test(ui) &&
    /d\.version === 4\) mode = 'number'/.test(ui) && /d\.version === 5\) mode = 'meter_slow'/.test(ui), 'training mode per version');
  const ch = fs.readFileSync(path.join(ROOT, 'js/clock-hold.js'), 'utf8');
  ok(/dm1997/.test(ch) && /hold: true/.test(ch), 'clock SET hold-repeat for the 1997 family');
  ok(!/#5a8a38|#c8b040/.test(ui), 'old non-DMC green / yellow meter colours removed');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
