#!/usr/bin/env node
'use strict';
/**
 * v32: offline catch-up has NO cap. A closed period (2 h, 13 h, 30 h, 3 days)
 * simulated in ONE tick must equal the same period run with the app open
 * (many small ticks), for every family. Death rules are exercised through
 * the same catch-up path.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

global.window = global;
['js/evolution-data.js', 'js/evolution.js', 'js/sprites.js', 'js/items.js', 'js/save.js', 'js/battle.js', 'js/steps.js',
  'js/devices/registry.js', 'js/devices/pendulum/data.js', 'js/devices/pendulum/versions.js', 'js/devices/pendulum/sprites.js',
  'js/devices/pendulum/sprites-extra.js', 'js/devices/pendulum/shake.js', 'js/devices/pendulum/engine.js',
  'js/devices/pen20/data.js', 'js/devices/pen20/sprites.js', 'js/devices/pen20/engine.js', 'js/devices/pen20/profiles.js',
  'js/devices/digivice/data.js', 'js/devices/digivice/sprites.js', 'js/devices/digivice/engine.js',
  'js/devices/digivice/profiles.js', 'js/engine.js'].forEach((f) => require(path.join(ROOT, f)));
const D = global.Devices, E = global.Engine, P = global.PendulumEngine, P20 = global.Pen20Engine, DV = global.DigiviceEngine;

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
function withSeed(seed, fn) { Math.random = seeded(seed); try { return fn(); } finally { Math.random = realRandom; } }
function canon(o) {
  if (Array.isArray(o)) return o.map(canon);
  if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = canon(o[k]); }); return r; }
  return o;
}
// Fields stamped with the wall clock of the machine running the code
// (not game state) are left out; lastReal stops moving once a pet is dead.
function strip(s) {
  const o = JSON.parse(JSON.stringify(s));
  delete o.stageEnteredAt; delete o.bornAt;
  if (o.dead || (o.pets && o.pets.every((p) => !p || p.dead))) delete o.lastReal;
  return o;
}
const same = (a, b) => JSON.stringify(canon(strip(a))) === JSON.stringify(canon(strip(b)));
function firstDiff(a, b, p) {
  p = p || '';
  if (!p) { a = strip(a); b = strip(b); }
  if (JSON.stringify(canon(a)) === JSON.stringify(canon(b))) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    for (const k of keys) { const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d; }
  }
  return p + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b);
}

const T0 = 1.8e12;
// Child-stage pets at 10:00 game clock, meters full, then left alone.
function make(fam) {
  let s;
  if (fam === '1997') {
    s = D.hatchEgg(null, 1, false, null);
    s.mon = 'agumon'; E.applySpeciesCare(s, { setWeight: true });
  } else if (fam === 'dm20') {
    s = D.hatchEgg(null, 1, false, 'dra_blue');
    s.mon = 'dracomon'; E.applySpeciesCare(s, { setWeight: true });
  } else if (fam === 'pendulum') {
    s = P.defaultState('pen_1_0');
    s.mon = 'tentomon';
    const m = global.PendulumData.monster('tentomon');
    s.weight = m.minWeight; s.hungerCap = m.stomach; s.dpMaxQ = Math.round((m.dpMax || 0) * 4); s.dpQ = s.dpMaxQ;
  } else if (fam === 'pen20') {
    s = P20.defaultState('pen_20th_sk');
  } else {
    s = DV.defaultState('dv1999_v1');
    DV.pickPartner(s, 0);
    s.clock = { h12: 10, min: 0, pm: false, field: 'h' };
    DV.confirmClock(s);
  }
  s.clockInitialized = true;
  if (s.clockSet) s.clockSet.on = false;
  s.gameTime = 0; s.stageEnteredGame = 0;
  s.hunger = 4; s.strength = 4; s.sleeping = false; s.lights = true; s.dead = false;
  s.clockOffset = 10 * 3600;
  s.lastReal = T0;
  s.speed = 1;
  if (fam === 'pendulum') P.rollEvoDue(s);
  if (fam === 'pen20') {
    s.lastReal = T0; D.tick(s, T0 + 70 * 1000); // hatch
    P20.applyMon(s.pets[0], 'tento', s.gameTime);
    s.pets[0].stageEnteredGame = s.gameTime;
    s.lastReal = T0;
    s.gameTime = 0; s.simAt = 0; s.pets[0].stageEnteredGame = 0; s.pets[0].lifeGame = 0;
  }
  return s;
}
const clone = (s) => JSON.parse(JSON.stringify(s));
function alive(fam, s) {
  if (fam === 'pen20') return !!(s.pets[0] && !s.pets[0].dead);
  return !s.dead;
}

console.log('1) Closed for 2 h / 13 h / 30 h / 3 days == app left open (every family, identical state)');
const FAMS = ['1997', 'dm20', 'pendulum', 'pen20', 'digivice'];
const SPANS = [['2h', 2 * 3600], ['13h', 13 * 3600], ['30h', 30 * 3600], ['3d', 72 * 3600]];
FAMS.forEach((fam) => {
  SPANS.forEach(([label, sec], k) => {
    const base = make(fam);
    const seed = 1234 + k;
    const closed = clone(base);
    const tEnd = T0 + sec * 1000;
    const t0c = Date.now();
    withSeed(seed, () => D.tick(closed, tEnd));
    const ms = Date.now() - t0c;
    const open = clone(base);
    withSeed(seed, () => {
      const r = seeded(99 + k);
      let t = T0;
      while (t < tEnd) {
        // frames (16 ms) bursts, 1–90 s gaps, background throttling
        const pick = r();
        const dtMs = pick < 0.3 ? 16 : pick < 0.6 ? 1000 * (1 + Math.floor(r() * 20)) : pick < 0.95 ? 1000 * (30 + Math.floor(r() * 60)) : 1000 * 600;
        t = Math.min(tEnd, t + dtMs);
        D.tick(open, t);
      }
    });
    const d = firstDiff(closed, open);
    ok(!d, fam + ' closed ' + label + ' equals always-open' + (d ? ' — first diff ' + d : ''));
    ok(ms < 1500, fam + ' ' + label + ' catch-up is fast (' + ms + ' ms)');
    if (fam !== 'digivice' && sec >= 72 * 3600) ok(!alive(fam, closed), fam + ' neglected ' + label + ': died by the device rules during the closed time');
    if (fam === 'digivice') ok(!closed.dead, 'digivice has no death (Wikimon Digivice V1/V2)');
  });
});

console.log('2) No cap: game time covers the whole closed period');
FAMS.forEach((fam) => {
  const s = make(fam);
  if (fam === 'digivice') {
    D.tick(s, T0 + 10 * 24 * 3600 * 1000);
    ok(Math.abs(s.gameTime - 10 * 86400) < 1, 'digivice: 10 days closed = 10 days of game time (was 6 h cap)');
    return;
  }
  // Keep it alive for this check: hunger/strength refills not possible while closed,
  // so just measure the first 12 h (before any 12 h death).
  D.tick(s, T0 + 11 * 3600 * 1000);
  ok(Math.abs(s.gameTime - 11 * 3600) < 1 || !alive(fam, s), fam + ': 11 h closed = 11 h of game time');
});

console.log('3) Death rules through the offline catch-up path');
function deathTime(fam, s, spanSec) {
  // Always-open reference: 60 s ticks until death, return game time of death.
  const o = clone(s);
  for (let t = T0; t <= T0 + spanSec * 1000; t += 60000) {
    D.tick(o, t);
    if (!alive(fam, o)) return o;
  }
  return o;
}
// 1997: empty hunger call → 12 h → starve (Humulos/NHOKO; firmware 12 h).
{
  const s = make('1997'); s.hunger = 0;
  const c = clone(s); D.tick(c, T0 + 14 * 3600 * 1000);
  ok(c.dead && c.deadReason === '飢餓過久', '1997: hunger left empty → starves during the closed time');
  const o = deathTime('1997', s, 14 * 3600);
  eq(c.gameTime, o.gameTime, '1997: starvation at the same minute as always-open');
  ok(c.gameTime >= 12 * 3600 && c.gameTime <= 12 * 3600 + 120, '1997: death 12 h after the call (' + (c.gameTime / 3600).toFixed(3) + ' h)');
}
{
  const s = make('1997'); s.injured = true; s.injuredAt = 0; s.injuries = 1;
  D.tick(s, T0 + 7 * 3600 * 1000);
  ok(s.dead && s.deadReason === '受傷未治療', '1997: injury untreated 6 h → death while closed');
}
{
  const s = make('1997'); s.mon = 'greymon'; E.applySpeciesCare(s, { setWeight: true });
  s.lifespanElapsed = true; s.oldAgeMistakes = 4; s.hunger = 0;
  D.tick(s, T0 + 2 * 3600 * 1000);
  ok(s.dead && s.deadReason === '壽終', '1997: old age — 5th mistake after the lifespan window kills (offline)');
}
// DM20 / Dracomon egg
{
  const s = make('dm20'); s.hunger = 0; s.strength = 4;
  const c = clone(s); D.tick(c, T0 + 13 * 3600 * 1000);
  ok(c.dead && c.deadReason === '飢餓過久', 'DM20: empty hunger 12 h → death (offline)');
  ok(c.calls >= 1, 'DM20: unanswered hunger call became a care mistake while closed');
}
{
  const s = make('dm20'); s.hunger = 0; s.strength = 0;
  D.tick(s, T0 + 11 * 60 * 1000);
  eq(s.cmForm, 2, 'DM20: hunger+strength empty together → 2 mistakes after the 10 min call (Wikimon)');
}
{
  const s = make('dm20'); s.hunger = 4; s.strength = 0;
  D.tick(s, T0 + 10 * 60 * 1000 + 60000);
  eq(s.calls, 1, 'DM20: call times out after 10 min (not 1997 20 min)');
}
{
  const s = make('dm20'); s.cmForm = 19; s.calls = 15; s.strength = 0;
  D.tick(s, T0 + 12 * 60 * 1000);
  ok(s.dead && s.deadReason === '育成失誤過多', 'DM20: 20 care mistakes in one form → death (offline)');
}
{
  const s = make('dm20'); s.mon = 'coredramon_blue'; E.applySpeciesCare(s, { setWeight: true });
  s.awakeInStage = 48 * 3600 - 120; s.cmForm = 5; s.calls = 5;
  D.tick(s, T0 + 5 * 60 * 1000);
  ok(s.dead && s.deadReason === '壽終', 'DM20: 5 mistakes upon reaching 48 h awake in the stage → death (Humulos)');
}
{
  const s = make('dm20'); s.injured = true; s.injuredAt = 0; s.injuries = 1;
  D.tick(s, T0 + 6 * 3600 * 1000 + 60000);
  ok(s.dead && s.deadReason === '受傷未治療', 'DM20: injured 6 h → death (offline)');
}
{
  const s = make('dm20'); s.injuries = 19;
  s.poop = 3; s.lastPoopAt = -3 * 3600; // next poop = 4th pile → injury #20
  D.tick(s, T0 + 2 * 60 * 1000);
  ok(s.dead && s.deadReason === '受傷次數過多', 'DM20: 20th injury (4th poop pile) → death (offline)');
}
{
  // Dracomon evolution timer runs only while awake (Humulos): 24 h awake → Adult.
  const s = make('dm20');
  s.awakeInStage = 24 * 3600 - 120;
  D.tick(s, T0 + 3 * 60 * 1000);
  eq(s.mon, 'coredramon_blue', 'DM20: Dracomon → Coredramon (Blue) after 24 h awake (Humulos), during catch-up');
  const z = make('dm20'); z.clockOffset = 23 * 3600; z.sleeping = true; z.lights = false; z.awakeInStage = 24 * 3600 - 120;
  D.tick(z, T0 + 3 * 3600 * 1000);
  eq(z.mon, 'dracomon', 'DM20: asleep time does not advance evolution');
}
// Pendulum OG
{
  const s = make('pendulum'); s.sick = true; s.sickSince = 0; s.sickCount = 1;
  const c = clone(s); D.tick(c, T0 + 7 * 3600 * 1000);
  ok(c.dead && c.deathReason === 'sick-6h', 'Pendulum: sick 6 h → dying cry → death (offline)');
  const o = deathTime('pendulum', s, 7 * 3600);
  eq(c.gameTime, o.gameTime, 'Pendulum: same death minute as always-open');
  ok(c.gameTime >= 6 * 3600 + 60, 'Pendulum: death only after the one-minute shake window');
}
{
  const s = make('pendulum'); s.careMistakes = 19; s.hunger = 0;
  D.tick(s, T0 + 30 * 60 * 1000);
  ok(s.dead && s.deathReason === 'cm-20', 'Pendulum: 20 care mistakes in one form → death (offline)');
}
{
  const s = make('pendulum'); s.injured = true; s.injuredSince = 0; s.injureCount = 1;
  D.tick(s, T0 + 7 * 3600 * 1000);
  ok(s.dead && s.deathReason === 'injury-6h', 'Pendulum: injured 6 h → death (offline)');
}
// Pen20
{
  const s = make('pen20'); s.pets[0].injured = true; s.pets[0].injuredSince = 0; s.pets[0].injuryCount = 1;
  const c = clone(s); D.tick(c, T0 + 7 * 3600 * 1000);
  ok(c.pets[0].dead && c.pets[0].mon === 'computer', 'Pen20: injured 6 h → dying → computer (offline)');
  const o = deathTime('pen20', s, 7 * 3600);
  ok(same(c.pets[0], o.pets[0]), 'Pen20: same result as always-open');
}
{
  const s = make('pen20'); s.pets[0].cm = 19; s.pets[0].hunger = 0; s.pets[0].calling = true; s.pets[0].callKind = 'hunger'; s.pets[0].callStartedGame = 0;
  D.tick(s, T0 + 15 * 60 * 1000);
  ok(s.pets[0].dead, 'Pen20: 20 care mistakes in one form → death (offline)');
}
// Digivice: no death, child evolution still on time
{
  const s = make('digivice');
  D.tick(s, T0 + 3 * 86400 * 1000);
  ok(!s.dead && s.party[0].stage === 'III', 'Digivice: 3 days closed → Child evolution happened, no death');
}

console.log('4) Very long closes finish quickly (iPhone 7 budget)');
FAMS.forEach((fam) => {
  const s = make(fam);
  const t = Date.now();
  D.tick(s, T0 + 30 * 86400 * 1000);
  const ms = Date.now() - t;
  ok(ms < 1500, fam + ': 30 days closed simulated in ' + ms + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
