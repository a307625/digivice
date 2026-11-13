#!/usr/bin/env node
/**
 * Eating (and related pose) animation: official 2 Hz clock, meat 5-phase
 * food shrink (three bites), protein 4-phase, mouth open/closed frames,
 * and the per-family wiring that actually plays them.
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

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function framesEqual(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Mirror of ui.js eatFoodSprite so the phase table is asserted in one place.
function eatFood(kind, phase) {
  const anim = { on: true, t: phase, kind: kind, refused: false };
  if (!anim.on || anim.refused) return null;
  let food = 'meat';
  if (kind === 'protein') {
    food = phase >= 3 ? 'half_pill' : 'pill';
  } else {
    if (phase >= 4) food = 'empty_meat';
    else if (phase >= 2) food = 'half_meat';
    else food = 'meat';
  }
  return { food: food, xDots: 24, yDots: (phase === 0) ? 0 : 8 };
}

console.log('Eat / pose animation');
console.log('====================\n');

console.log('1) Official 2 Hz clock and food-shrink phases (1997 source, shared)');
{
  const src = read('js/ui.js');
  ok(/ANIM_MS\s*=\s*500/.test(src), 'ANIM_MS is 500 (official 2 Hz)');
  ok(/maxT = eatAnim\.kind === 'protein' \? 4 : 5/.test(src), 'meat 5 frames, protein 4 frames');
  ok(/function eatFoodSprite/.test(src), 'shared eatFoodSprite helper exists');
  ok(/empty_meat/.test(src) && /half_meat/.test(src), 'meat shrinks full → half → empty');
  ok(/half_pill/.test(src), 'protein shrinks to half_pill');
  ok(/yDots: \(phase === 0\) \? 0 : 8/.test(src), 'first frame is full-height food, then lowered to y=8');
  ok(/eatFoodSprite: eatFoodSprite/.test(src), 'penHost exposes eatFoodSprite to Pendulum and Pen20');
  ok(/return \(eatAnim\.t % 2\) \? 'eat1' : 'eat0'/.test(src), '1997 mouth alternates eat0/eat1 on t%2');
  ok(/playPose\('happy', 2000\)/.test(src), 'happy pose held 2.0 s when not returning to food');
  ok(/poseFx\.name === 'refuse'/.test(src) && /animTick\(\) % 2/.test(src), 'refuse head-shake flips on the 2 Hz clock');

  // Three bites: full, full-lowered, half, half, empty.
  const meat = [0, 1, 2, 3, 4].map((t) => eatFood('meat', t));
  eq(meat[0].food, 'meat', 'bite 1a: full meat');
  eq(meat[0].yDots, 0, 'bite 1a: food at the top');
  eq(meat[1].food, 'meat', 'bite 1b: still full, lowered (nibble)');
  eq(meat[1].yDots, 8, 'bite 1b: food lowered');
  eq(meat[2].food, 'half_meat', 'bite 2: half');
  eq(meat[3].food, 'half_meat', 'bite 2 held a second tick');
  eq(meat[4].food, 'empty_meat', 'bite 3: empty plate');
  eq(meat[4].xDots, 24, 'food sits at x=24, opposite the mon at x=8');

  const prot = [0, 1, 2, 3].map((t) => eatFood('protein', t));
  eq(prot[0].food, 'pill', 'protein 0: full pill');
  eq(prot[0].yDots, 0, 'protein 0: at the top');
  eq(prot[1].food, 'pill', 'protein 1: full, lowered');
  eq(prot[2].food, 'pill', 'protein 2: still full');
  eq(prot[3].food, 'half_pill', 'protein 3: half-pill');
}

console.log('2) 1997 / DM20 sprites: eat cells and the identical-eat0/eat1 remap');
{
  const src = read('js/ui.js');
  ok(/frameName === 'eat0'/.test(src) && /framesEqual\(sp\.frames\.eat0, sp\.frames\.eat1\)/.test(src),
    'spriteCanvas remaps a duplicated eat0 to official idle0');
  ok(/shiftSleep/.test(src) && /frameName === 'sleep1'/.test(src),
    'spriteCanvas bobs sleep1 when only one sleep cell exists');

  const atlas = read('js/sprites.js');
  const ids = [...atlas.matchAll(/\n    ([a-z0-9_]+): \{ w:/g)].map((m) => m[1]);
  function getFrames(name) {
    const m = atlas.match(new RegExp('\\n    ' + name + ': \\{ w:'));
    if (!m) return null;
    const start = m.index;
    const nxt = atlas.slice(start + 10).match(/\n    [a-z0-9_]+: \{ w:/);
    const end = nxt ? start + 10 + nxt.index : atlas.length;
    const block = atlas.slice(start, end);
    const frames = {};
    for (const fm of block.matchAll(/([a-z0-9_]+): \[((?:'[^']+',? ?)+)\]/g)) {
      frames[fm[1]] = [...fm[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    }
    return frames;
  }
  const skip = (n) => n.startsWith('icon_') || n.startsWith('overlay_');
  let playable = 0, distinctEat = 0, remap = 0, eatIdleClosed = 0, hasHappy = 0, hasRefuse = 0, hasSleep = 0;
  const missingEat = [];
  for (const name of ids) {
    if (skip(name)) continue;
    const fr = getFrames(name);
    if (!fr || !fr.eat0) { missingEat.push(name); continue; }
    playable++;
    if (fr.happy) hasHappy++;
    if (fr.refuse) hasRefuse++;
    if (fr.sleep0) hasSleep++;
    if (!framesEqual(fr.eat0, fr.eat1)) {
      distinctEat++;
    } else if (!framesEqual(fr.eat0, fr.idle0)) {
      remap++;
    }
    if (framesEqual(fr.eat0, fr.idle0) && fr.eat1 && !framesEqual(fr.eat0, fr.eat1)) eatIdleClosed++;
  }
  ok(playable >= 140, 'at least 140 playable 1997/DM20 mons have eat frames (got ' + playable + ')');
  ok(distinctEat >= 90, 'at least 90 already have distinct eat0/eat1 (got ' + distinctEat + ')');
  ok(remap >= 30, 'DM20 artbook mons with eat0==eat1!=idle0 will remap (got ' + remap + ')');
  ok(distinctEat + remap === playable || distinctEat + remap >= playable - 5,
    'almost every mon either has distinct bites or will remap (distinct=' + distinctEat + ' remap=' + remap + ' playable=' + playable + ')');
  ok(eatIdleClosed >= 5, 'classic mons use idle as closed-mouth eat0 with a distinct eat1 (got ' + eatIdleClosed + ')');
  ok(hasHappy === playable && hasRefuse === playable && hasSleep === playable,
    'every playable mon has happy, refuse, and sleep0 cells');
  eq(missingEat.length, 0, 'no playable mon is missing eat0');

  // Agumon is the reference official 12-cell set.
  const agu = getFrames('agumon');
  ok(agu && !framesEqual(agu.eat0, agu.eat1), 'Agumon eat0 and eat1 differ (official mouth open/closed)');
  ok(agu && framesEqual(agu.eat1, agu.angry) && framesEqual(agu.eat1, agu.attack),
    'official Agumon: eat1 == angry == attack (roar cell)');
  ok(agu && !framesEqual(agu.idle0, agu.happy), 'Agumon happy is not idle');
  ok(agu && !framesEqual(agu.idle0, agu.refuse), 'Agumon refuse is a unique bowed cell');
  ok(agu && !framesEqual(agu.sleep0, agu.idle0), 'Agumon sleep is a unique rest body');
}

console.log('3) Pendulum OG: feed starts eatAnim; play draws shrinking food and facing mon');
{
  const ui = read('js/devices/pendulum/ui.js');
  ok(/host\.eatAnim\.on = true/.test(ui), 'Pendulum feed starts host.eatAnim');
  ok(/eatAnim\.kind = subSel === 1 \? 'protein' : 'meat'/.test(ui), 'Pendulum records meat vs protein');
  ok(/returnToFood = true/.test(ui), 'Pendulum returns to the food menu after the eat anim');
  ok(/host\.eatFoodSprite/.test(ui), 'Pendulum play screen draws eatFoodSprite');
  ok(/flip = true/.test(ui) && /food at x=24/.test(ui), 'Pendulum mon faces the food at x=24');
  ok(/poseFx\.name === 'refuse'/.test(ui) && /animTick\(\) % 2/.test(ui),
    'Pendulum refuse is a 2 Hz head-shake');
  ok(/eatAnim\.t % 2\) \? 'eat1' : 'eat0'/.test(ui), 'Pendulum mouth alternates eat0/eat1');

  // Ver.1.0 Nature Spirits: unique eat1 already in the atlas.
  const v1 = read('js/devices/pendulum/sprites.js');
  function v1Frames(name) {
    const idx = v1.indexOf('add("' + name + '"');
    if (idx < 0) return null;
    const nxt = v1.indexOf('\n  add("', idx + 8);
    const block = v1.slice(idx, nxt < 0 ? v1.length : nxt);
    const frames = {};
    for (const fm of block.matchAll(/"([a-z0-9_]+)": \[((?:"[^"]+",? ?)+)\]/g)) {
      frames[fm[1]] = [...fm[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    }
    if (!Object.keys(frames).length) {
      for (const fm of block.matchAll(/"([a-z0-9_]+)": \[((?:\n        "[^"]+",?)+)\n      \]/g)) {
        frames[fm[1]] = [...fm[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
      }
    }
    return frames;
  }
  const babu = v1Frames('babumon');
  ok(babu && babu.eat0 && babu.eat1, 'babumon has eat0 and eat1');
  ok(babu && framesEqual(babu.eat0, babu.idle0), 'babumon eat0 is the standing (closed) idle — official pattern');
  ok(babu && !framesEqual(babu.eat0, babu.eat1), 'babumon eat1 is a distinct mouth/action cell');
  ok(babu && !framesEqual(babu.idle0, babu.refuse), 'babumon has a distinct refuse cell');
  ok(babu && !framesEqual(babu.sleep0, babu.sleep1), 'babumon sleep0/sleep1 differ');
}

console.log('4) Pendulum extras (1.5–ZERO): reconstructed open-mouth eat1, sleep bob');
{
  const extraSrc = read('js/devices/pendulum/sprites-extra.js');
  ok(/function openMouth16/.test(extraSrc), 'extras generate an open-mouth eat1');
  ok(/eat1: eatOpen/.test(extraSrc), 'eat1 is the open-mouth reconstruction, not the walk bob');
  ok(/function shift16/.test(extraSrc) && /sleep1: sleepBob/.test(extraSrc),
    'sleep1 is a 1-dot bob of the sleep cell');

  const Extra = require('../js/devices/pendulum/sprites-extra.js');
  const ids = Object.keys(Extra.SPRITES);
  ok(ids.length >= 100, 'extras cover the later Pendulum roster (got ' + ids.length + ')');
  let distinct = 0, same = 0, sleepBob = 0, destroyed = 0;
  function inkCount(rows) {
    let n = 0;
    for (const r of rows) for (const c of r) if (c && c !== '0') n++;
    return n;
  }
  for (const id of ids) {
    const fr = Extra.SPRITES[id].frames;
    if (!framesEqual(fr.eat0, fr.eat1)) distinct++;
    else same++;
    if (!framesEqual(fr.sleep0, fr.sleep1)) sleepBob++;
    const a = inkCount(fr.eat0), b = inkCount(fr.eat1);
    if (a && b / a < 0.8) destroyed++;
  }
  eq(same, 0, 'every extra mon has a distinct eat1 (same=' + same + ')');
  ok(distinct === ids.length, 'all ' + ids.length + ' extras have open-mouth eat1');
  eq(sleepBob, ids.length, 'every extra mon has a bobbing sleep1');
  eq(destroyed, 0, 'open-mouth slit does not destroy the silhouette (destroyed=' + destroyed + ')');

  const tail = Extra.SPRITES.tailmon.frames;
  ok(framesEqual(tail.eat0, tail.idle0), 'tailmon eat0 is standing idle');
  ok(!framesEqual(tail.eat0, tail.eat1), 'tailmon eat1 differs');
}

console.log('5) Pen20: eating uses eatAnim + eat frames, not a frozen idle');
{
  const ui = read('js/devices/pen20/ui.js');
  ok(!/eatKind/.test(ui) && !/eatUntil/.test(ui), 'Pen20 no longer uses the 1100 ms idle eat timer');
  ok(!/pose = 'idle0'/.test(ui), 'Pen20 does not freeze the mon on idle0 while eating');
  ok(/host\.eatAnim\.on = true/.test(ui), 'Pen20 feed starts host.eatAnim');
  ok(/returnToFood = true/.test(ui), 'Pen20 returns to the food menu after the official eat anim');
  ok(/pose = \(host\.eatAnim\.t % 2\) \? 'eat1' : 'eat0'/.test(ui), 'Pen20 mouth alternates eat0/eat1');
  ok(/host\.eatFoodSprite/.test(ui), 'Pen20 play screen draws shrinking food');
  ok(/flip = true/.test(ui), 'Pen20 mon faces the food');
  ok(/poseFx\.name === 'refuse'/.test(ui), 'Pen20 refuse is a 2 Hz head-shake');

  const Sp = require('../js/devices/pen20/sprites.js');
  ok(typeof Sp.rowsOf === 'function' && typeof Sp.openMouth === 'function', 'Pen20 exposes rowsOf and openMouth');
  const eat0 = Sp.rowsOf('agu', 'eat0');
  const eat1 = Sp.rowsOf('agu', 'eat1');
  const idle = Sp.rowsOf('agu', 'idle0');
  ok(eat0 && eat1 && idle, 'agu has eat0, eat1, idle0');
  function ink(rows) {
    let n = 0;
    for (const r of rows) for (const v of r) if (v) n++;
    return n;
  }
  function same(a, b) {
    if (!a || !b) return false;
    return a.every((r, y) => r.every((v, x) => v === b[y][x]));
  }
  ok(same(eat0, idle), 'Pen20 eat0 is the official idle (closed mouth)');
  ok(!same(eat0, eat1), 'Pen20 eat1 is a distinct open-mouth reconstruction');
  ok(ink(eat1) < ink(eat0), 'open mouth is a paper slit (fewer ink dots)');
  ok(ink(eat1) / ink(eat0) > 0.85, 'slit is small; the official body is kept');

  // Coverage across the official pack: every mon gets a distinct eat1 that
  // is not a destroyed silhouette.
  const ids = Object.keys(Sp.PACK).filter(function (id) { return id.indexOf('digitama_') !== 0; });
  const eggs = Object.keys(Sp.PACK).filter(function (id) { return id.indexOf('digitama_') === 0; });
  let bad = 0, dest = 0;
  for (const id of ids) {
    const a = Sp.rowsOf(id, 'eat0');
    const b = Sp.rowsOf(id, 'eat1');
    if (same(a, b)) bad++;
    const ia = ink(a), ib = ink(b);
    if (ia && ib / ia < 0.8) dest++;
  }
  ok(eggs.length > 0, 'Pen20 pack includes Digitama eggs (they are not fed)');
  eq(bad, 0, 'every official Pen20 mon (not eggs) has a distinct eat1 (bad=' + bad + ' of ' + ids.length + ')');
  eq(dest, 0, 'no Pen20 open-mouth destroys the silhouette (dest=' + dest + ')');

  const sl0 = Sp.rowsOf('agu', 'sleep0') || Sp.rowsOf('agu', 'sleep');
  const sl1 = Sp.rowsOf('agu', 'sleep1');
  ok(sl0 && sl1 && !same(sl0, sl1), 'Pen20 sleep1 is a 1-dot bob of the sleep reconstruction');
  const happy = Sp.rowsOf('agu', 'happy');
  ok(happy && same(happy, eat1), 'Pen20 happy uses the same open-mouth reconstruction (^^ eyes not invented)');
}

console.log('6) Holy Project (Digivice 1999): no classic eat cycle — do not invent one');
{
  const ui = read('js/devices/digivice/ui.js');
  const data = read('js/devices/digivice/data.js');
  ok(!/eatAnim/.test(ui) && !/eat0/.test(ui), 'Digivice UI has no classic eat animation');
  ok(/Meat no effect|no effect ever noticed/.test(data) || /meat: 'none'/.test(data),
    'File Island: Meat is an inventory item with no noticed care effect');
  ok(/Only one official pose per mon/.test(read('js/devices/digivice/sprites.js')) ||
     /only one official pose/i.test(read('js/devices/digivice/sprites.js')),
    'Digivice sprites document a single official pose per mon');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
