#!/usr/bin/env node
/**
 * v96 expression / animation audit fixes (1997 bricks, Ver.1–5 share this
 * code). Runs the real drawPlay, walkUpdate, drawPoop, drawFlushSweep97,
 * drawEvo / evo97Pick and drawBattle1997 from js/ui.js in a sandbox whose
 * blit calls are recorded, then checks:
 *  1  poop on screen: the Digimon keeps walking, left of the piles
 *  2  injury skull: DMC dark skull, top-right corner, blinking, not on the pet
 *  3  sun: DMC sprite 540 verbatim; training / heal / flush blink it
 *  4  flush: one upright wave sweeps right → left in 1.2 s, then a 3 s
 *     centred cheer with the sun; keys stay locked (action lock)
 *  7  battle loss: four DMC dark skulls; hit burst uses DMC skulls
 *  8  refuse: head-shake where it stands
 *  9  calling: icon only, no centring / hop, walk continues
 * 10  evolution: no cream wash; old / new alternate, then new
 *  5  hatch: user crack / burst frames are used only if present
 * DM20 keeps its old behaviour.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
function fn(name) {
  const start = src.indexOf('  function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  const end = src.indexOf('\n  }\n', start);
  return src.slice(start, end + 4);
}
function varBlock(name, endMark) {
  const start = src.indexOf('  var ' + name);
  if (start < 0) throw new Error('missing var ' + name);
  return src.slice(start, src.indexOf(endMark, start) + endMark.length);
}
const NAMES = ['walkMaxX', 'walkUpdate', 'drawMonAt', 'drawPlay', 'flush97WaveCol', 'drawFlushSweep97',
  'poopCount', 'poopCols', 'drawPoop', 'glyph97', 'blitGlyph97', 'v1HatchFrame', 'evo97Pick', 'drawEvo',
  'battle97Phase', 'zig', 'drawHitBurst', 'drawBattle1997'];
const code = varBlock('GLYPHS97', '\n  };\n') +
  varBlock('SUN97_COL', '\n') + varBlock('SKULL97_COL', '\n') + varBlock('FLUSH97_MS', '\n') +
  varBlock('FLUSH97_STEPS', '\n') + varBlock('FLUSH97_HAPPY_MS', '\n') +
  NAMES.map(fn).join('\n') + `
  this.api = { drawPlay: drawPlay, walkUpdate: walkUpdate, drawEvo: drawEvo, evo97Pick: evo97Pick,
    drawBattle1997: drawBattle1997, walkMaxX: walkMaxX, G: GLYPHS97 };`;

function world(opts) {
  opts = opts || {};
  const w = { log: [], tick: 0, family: opts.family || 'dm1997', calling: false, user: {} };
  const ITEMS = { skull: { frames: { idle0: ['0110'] } } };
  const ctx = {
    fillStyle: '', fillRect() {}, save() {}, restore() {}, beginPath() {}, clip() {},
    rect(x, y, ww, hh) { w.log.push({ k: 'clip', x: x / 10 }); }
  };
  const sb = {
    Math, JSON, String, ctx, DOT: 10, FW: 32, FH: 16, LCD_W: 320, LCD_H: 160, MON: 10, ITEM: 10, INK: '#000', LCD_LIGHT: '#fff',
    shotMode: false, view: 'play', state: { mon: 'agumon', poop: 0, dead: false, sleeping: false, injured: false },
    walk: { x: 4, dir: -1 }, poseFx: { name: null, until: 0, extra: null }, eatAnim: { on: false }, flushAnim: { on: false, n: 0, off: 0 },
    evoFx: { t: 0, from: 'agumon', to: 'greymon' }, battleFx: { t: 0, foe: 'betamon', result: 'win' },
    fx: (c) => c * 10, fy: (r) => r * 10,
    animTick: () => w.tick, is1997Brick: () => w.family === 'dm1997', isCalling: () => w.calling,
    isEggStage: () => false, monFrame: () => 'idle0', idleFrame: () => 'idle0', lcdBg() { w.log.push({ k: 'bg' }); },
    is1997PlayDark: () => false, drawGrave() {}, drawSleepZ() {}, drawDarkSleepZ() {}, eatFoodSprite: () => null,
    draw1997Backdrop() { w.log.push({ k: 'backdrop' }); }, drawDots(rows, c, r) { w.log.push({ k: 'dots', c, r }); },
    drawBattleBanner() {}, attackItem: () => 'shot',
    items: () => ({ ITEMS, drawText() {}, drawNumber() {} }),
    blitItem(name, x, y) { w.log.push({ k: 'item', name, c: x / 10, r: y / 10 }); },
    blitMon(id, x, y, s, fr, flip) { w.log.push({ k: 'mon', id, c: x / 10, r: y / 10, fr, flip: !!flip }); },
    playPose(name, ms, extra) { sb.poseFx = { name, until: 1e12, extra: extra || null }; w.log.push({ k: 'pose', name, ms, extra }); },
    performance: { now: () => 0 },
    window: { UserSprites: { getExact: (f, id, fr) => w.user[id + '_' + fr] || null } }
  };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  w.sb = sb; w.api = sb.api; w.ITEMS = ITEMS; w.G = sb.api.G;
  w.draw = function () { w.log = []; sb.api.drawPlay(); return w.log; };
  w.mon = function (log) { return log.filter((e) => e.k === 'mon')[0]; };
  w.items = function (log, name) { return log.filter((e) => e.k === 'item' && e.name === name); };
  return w;
}

console.log('1/9) Poop and calls: the Digimon keeps walking, left of the piles');
{
  const w = world();
  w.sb.state.poop = 3; // two columns: x 16..31
  eq(w.api.walkMaxX(), 0, '3 piles leave columns 0..15, so the walk stops at x 0');
  w.sb.state.poop = 1; w.sb.walk = { x: 8, dir: 1 };
  w.calling = true;
  for (let i = 0; i < 20; i++) w.api.walkUpdate();
  ok(w.sb.walk.x <= 8, 'walk never passes the pile column (x ' + w.sb.walk.x + ' ≤ 8)');
  const before = w.sb.walk.x; w.api.walkUpdate();
  ok(w.sb.walk.x !== before, 'a lit call does not stop the walk on 1997');
  w.sb.walk = { x: 3, dir: 1 }; w.tick = 1;
  const m = w.mon(w.draw());
  eq([m.c, m.r], [3, 0], 'calling: drawn at its walk spot, no centring, no 1-dot hop');
  eq(m.flip, true, 'calling: faces its walk direction');
  // DM20 unchanged
  const d = world({ family: 'dm20' }); d.calling = true; d.sb.walk = { x: 3, dir: 1 }; d.tick = 1;
  const dm = d.mon(d.draw());
  eq([dm.c, dm.r], [8, -1], 'DM20 keeps the centred attention hop');
  const before2 = d.sb.walk.x; d.api.walkUpdate(); eq(d.sb.walk.x, before2, 'DM20 call still stops the walk');
}

console.log('2) Injury skull: DMC dark skull, top right, blinking');
{
  const w = world();
  w.sb.state.injured = true;
  w.tick = 0;
  let log = w.draw();
  const sk = w.items(log, 'skull97');
  eq(sk.length, 1, 'skull drawn on the even tick');
  eq([sk[0].c, sk[0].r], [24, 1], 'skull in the top-right corner (cols 24-31)');
  const m = w.mon(log);
  ok(m.c + 16 <= 24, 'skull is apart from the Digimon (pet ends at col ' + (m.c + 16) + ')');
  eq(w.items(log, 'skull').length, 0, 'old white skull over the head is gone');
  w.tick = 1; log = w.draw();
  eq(w.items(log, 'skull97').length, 0, 'odd tick: skull off (blink, not bob)');
  eq(w.mon(log).r, 0, 'the Digimon does not hop');
  eq(w.G.skull97.pal[1], '#101042ff', 'skull colours are DMC sprite 543 (dark navy)');
  w.sb.state.poop = 3; w.tick = 0; log = w.draw();
  eq(w.mon(log).c, 0, 'injured with 3 piles: kept left of the piles');
  const d = world({ family: 'dm20' }); d.sb.state.injured = true; d.tick = 1;
  const dl = d.draw();
  eq(d.items(dl, 'skull').length, 1, 'DM20 keeps its own skull');
}

console.log('3) Sun: DMC 540 verbatim, blinking');
{
  const w = world();
  const g = w.G.sun97;
  const rows = g.frames.idle0;
  const DMC540 = ['00001000', '01000010', '00021000', '10231101', '00111400', '00044000', '01000001', '00010100'];
  eq(rows, DMC540, 'sun is DMC sprite 540 verbatim (filled centre, Eric v96)');
  eq(g.src, 'dmc-color-540', 'source tag');
  const outer = [[0, 4], [1, 1], [1, 6], [3, 0], [3, 7], [6, 1], [6, 7], [7, 3], [7, 5]].filter(([r, c]) => rows[r].charAt(c) !== '0').length;
  ok(outer >= 8, 'eight separate dots around the centre (same as the Ver.1 manual sun)');
  ok(!w.G.sun97_dmc, 'no second competing sun glyph');
  eq(g.pal[1], '#ff6900ff', 'DMC orange');
  for (const extra of ['train', 'heal', 'flush']) {
    w.sb.poseFx = { name: 'happy', until: 1e12, extra };
    w.tick = 1; let s1 = w.items(w.draw(), 'sun97');
    w.tick = 0; let s0 = w.items(w.draw(), 'sun97');
    eq([s1.length, s0.length], [1, 0], extra + ': sun blinks at 2 Hz');
    eq(s1[0].c, 24, extra + ': sun at the right edge');
  }
  eq(w.log.filter((e) => e.k === 'dots').length, 0, 'old solid star (SUN_DOTS) is no longer drawn on the play screen');
}

console.log('4) Flush: wave sweeps right → left, then a 3 s cheer with the sun');
{
  ok(/var FLUSH97_MS = 30;/.test(src) && /var FLUSH97_STEPS = 40;/.test(src), '40 steps × 30 ms = 1.2 s');
  ok(/playPose\('happy', FLUSH97_HAPPY_MS, 'flush'\)/.test(src) && /var FLUSH97_HAPPY_MS = 3000;/.test(src), 'then about 3 s happy with the sun');
  const w = world();
  w.sb.state.poop = 0; w.sb.walk = { x: 0, dir: 1 };
  const cols = [];
  for (const off of [1, 10, 20, 30, 39]) {
    w.sb.flushAnim = { on: true, n: 2, off };
    const log = w.draw();
    const wave = w.items(log, 'wave97');
    cols.push(wave.length ? wave[0].c : null);
    eq(wave.length ? wave[0].r : null, 0, 'off ' + off + ': one upright column from the top row');
    eq(w.items(log, 'poopwave').length, 0, 'off ' + off + ': no old per-pile scroll');
  }
  ok(cols.every((c, i) => i === 0 || c < cols[i - 1]), 'wave moves right → left: ' + cols.join(' > '));
  eq(cols[0], 31, 'enters at the right edge');
  // Behind the wave the glass is wiped (backdrop redrawn right of it).
  w.sb.flushAnim = { on: true, n: 2, off: 20 };
  const log = w.draw();
  const clip = log.filter((e) => e.k === 'clip')[0];
  eq(clip && clip.x, 20, 'everything right of the wave (cols 20..31) is wiped');
  ok(log.findIndex((e) => e.k === 'backdrop') > log.findIndex((e) => e.k === 'mon'), 'wipe happens after the Digimon is drawn, so it is swept too');
  const piles = w.items(log, 'poop');
  ok(piles.every((p) => p.r === 0 || p.r === 8), 'piles do not slide down on 1997');
  ok(/if \(eatAnim\.on \|\| flushAnim\.on \|\| feedReturnPending\) return true;/.test(src), 'keys stay locked during the sweep (v90 action lock)');
  ok(/return !!\(poseFx\.name && performance\.now\(\) < poseFx\.until\);/.test(src), 'and during the cheer');
  w.sb.flushAnim = { on: false, n: 0, off: 0 };
  w.sb.poseFx = { name: 'happy', until: 1e12, extra: 'flush' };
  w.tick = 1; const m = w.mon(w.draw());
  eq([m.c, m.r], [8, 0], 'cheer is centred, no hop (sun blinks instead)');
  const d = world({ family: 'dm20' }); d.sb.state.poop = 2; d.sb.flushAnim = { on: true, n: 2, off: 4 };
  const dl = d.draw();
  ok(d.items(dl, 'poopwave').length > 0 && d.items(dl, 'wave97').length === 0, 'DM20 keeps the old scroll');
}

console.log('7) Battle: loss skulls and hit burst in DMC colours, win suns');
{
  const w = world();
  w.sb.battleFx = { t: 12, foe: 'betamon', result: 'lose' };
  w.log = []; w.api.drawBattle1997();
  const sk = w.items(w.log, 'skull97').map((e) => [e.c, e.r]);
  eq(sk, [[0, 0], [24, 0], [0, 8], [24, 8]], 'four DMC dark skulls in the corners');
  eq(w.items(w.log, 'skull').length, 0, 'no white skulls');
  w.sb.battleFx = { t: 12, foe: 'betamon', result: 'win' };
  w.log = []; w.api.drawBattle1997();
  eq(w.items(w.log, 'sun97').map((e) => [e.c, e.r]), [[0, 4], [24, 4]], 'win: two suns');
  w.sb.battleFx = { t: 8, foe: 'betamon', result: 'win' }; w.tick = 0;
  w.log = []; w.api.drawBattle1997();
  eq(w.items(w.log, 'skull97_light').length, 1, 'dark burst (win): light DMC skull 544');
  w.sb.battleFx = { t: 8, foe: 'betamon', result: 'lose' };
  w.log = []; w.api.drawBattle1997();
  eq(w.items(w.log, 'skull97').length, 1, 'light burst (loss): dark DMC skull 543');
}

console.log('8) Refuse: head-shake where it stands');
{
  const w = world();
  w.sb.walk = { x: 2, dir: -1 };
  w.sb.poseFx = { name: 'refuse', until: 1e12, extra: null };
  w.tick = 0; const a = w.mon(w.draw());
  w.tick = 1; const b = w.mon(w.draw());
  eq([a.c, b.c], [2, 2], 'stays at its spot (x 2), not forced to the centre');
  ok(a.flip !== b.flip, 'turns left / right at 2 Hz');
  w.sb.walk = { x: 14, dir: -1 }; w.sb.state.poop = 3;
  eq(w.mon(w.draw()).c, 0, 'never over the piles');
  const d = world({ family: 'dm20' }); d.sb.walk = { x: 2, dir: -1 }; d.sb.poseFx = { name: 'refuse', until: 1e12 };
  eq(d.mon(d.draw()).c, 8, 'DM20 unchanged (centre)');
}

console.log('10) Evolution: no cream wash, old / new alternate, then new');
{
  ok(/if \(is1997Brick\(\)\) \{\s*var pk = evo97Pick\(t\);[\s\S]{0,120}return;\s*\}\s*if \(t % 2 === 0\)/.test(src), '1997 path returns before the wash (DM20 keeps it)');
  const w = world();
  w.sb.evoFx = { t: 0, from: 'agumon', to: 'greymon' };
  const seq = [];
  for (let t = 0; t <= 8; t++) seq.push(w.api.evo97Pick(t).id);
  eq(seq, ['agumon', 'greymon', 'agumon', 'greymon', 'agumon', 'greymon', 'greymon', 'greymon', 'greymon'], '2 Hz alternation, ends on the new form');
  let wash = false;
  w.sb.ctx.fillRect = () => { wash = true; };
  for (let t = 0; t <= 8; t++) { w.sb.evoFx.t = t; w.api.drawEvo(); }
  ok(!wash, 'no translucent fill on any evolution tick');
}

console.log('5) Hatch: user crack / burst frames only when present');
{
  const w = world();
  w.sb.evoFx = { t: 0, from: 'egg_v1', to: 'botamon' };
  const plain = [0, 1, 2, 3, 4, 5, 6].map((t) => { const p = w.api.evo97Pick(t); return p.id + ':' + p.fr; });
  eq(plain, ['egg_v1:idle0', 'egg_v1:idle0', 'egg_v1:hatch', 'egg_v1:hatch', 'botamon:idle0', 'botamon:idle0', 'botamon:idle0'], 'no user frames: same as before');
  w.user = { egg_v1_crack: {}, egg_v1_burst0: {}, egg_v1_burst1: {} };
  const art = [0, 1, 2, 3, 4, 5, 6].map((t) => { const p = w.api.evo97Pick(t); return p.id + ':' + p.fr; });
  eq(art, ['egg_v1:idle0', 'egg_v1:idle0', 'egg_v1:crack', 'egg_v1:hatch', 'egg_v1:burst0', 'egg_v1:burst1', 'botamon:idle0'], 'with crack + burst frames: egg → crack → burst → baby');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
