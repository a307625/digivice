#!/usr/bin/env node
'use strict';
/**
 * v31 hotfix: offline play (service worker coverage) and a device clock
 * that follows real time across relaunches / long absences, every family.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

/* ---------------- 1) Service worker covers everything offline ---------------- */
console.log('1) sw.js precaches every file the app loads, all shells, v32');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const block = sw.slice(sw.indexOf('var ASSETS = ['), sw.indexOf('];', sw.indexOf('var ASSETS = [')));
const assets = new Set((block.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)));
eq((sw.match(/var CACHE = '([^']+)'/) || [])[1], 'digivice-v32', 'cache name bumped to digivice-v32');
const refs = [];
html.replace(/(?:src|href)="(\.\/[^"#?]+)"/g, (m, u) => { refs.push(u); return m; });
ok(refs.length > 40, 'index.html local refs parsed (' + refs.length + ')');
refs.forEach((u) => ok(assets.has(u), 'precached: ' + u));
assets.forEach((u) => {
  const f = u === './' ? 'index.html' : u.replace(/^\.\//, '');
  ok(fs.existsSync(path.join(ROOT, f)), 'asset exists on disk: ' + u);
});
ok(assets.has('./') && assets.has('./index.html'), "both './' and './index.html' cached");
const start = './' + String(manifest.start_url || '').replace(/^\.\//, '');
ok(assets.has(start), 'manifest start_url is precached (' + manifest.start_url + ')');
eq(manifest.scope, './', 'manifest scope ./ matches sw.js location');
fs.readdirSync(path.join(ROOT, 'icons/shell')).filter((n) => /\.webp$/.test(n) && n !== 'digivice-neutral.webp')
  .forEach((n) => ok(assets.has('./icons/shell/' + n), 'shell precached: ' + n));
// Every shell the UI can request exists and is precached.
const ui = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
const partner = (ui.match(/var DV_PARTNER_SHELL = \{([\s\S]*?)\};/) || [])[1] || '';
(partner.match(/'(digivice-[a-z0-9]+)'/g) || []).forEach((s) => ok(assets.has('./icons/shell/' + s.slice(1, -1) + '.webp'), 'partner shell precached: ' + s));
ok(/ignoreSearch:\s*true/.test(sw), 'cache lookups ignore query strings (?source=pwa, ?steps=)');
ok(/mode === 'navigate'/.test(sw) && /appShell\(\)/.test(sw), 'navigations fall back to the cached app shell');
ok(/cache: 'reload'/.test(sw), 'precache bypasses the HTTP cache (no stale files on update)');
ok(/!res\.redirected/.test(sw) && /res\.type === 'basic'/.test(sw), 'never caches opaque or redirected responses');
ok(!/Shell WebPs are NOT precached/.test(sw), 'no lazy-only shell caching');
ok(/status: 504/.test(sw), 'offline miss returns a Response (not undefined)');

/* ---------------- 2) Clock follows real time ---------------- */
console.log('2) Clock = SET value + real elapsed time (not the phone clock), every family');
global.window = global;
['js/evolution-data.js', 'js/evolution.js', 'js/sprites.js', 'js/items.js', 'js/save.js', 'js/battle.js', 'js/steps.js',
  'js/devices/registry.js', 'js/devices/pendulum/data.js', 'js/devices/pendulum/versions.js', 'js/devices/pendulum/sprites.js',
  'js/devices/pendulum/sprites-extra.js', 'js/devices/pendulum/shake.js', 'js/devices/pendulum/engine.js',
  'js/devices/pen20/data.js', 'js/devices/pen20/sprites.js', 'js/devices/pen20/engine.js', 'js/devices/pen20/profiles.js',
  'js/devices/digivice/data.js', 'js/devices/digivice/sprites.js', 'js/devices/digivice/engine.js',
  'js/devices/digivice/profiles.js', 'js/engine.js'].forEach((f) => require(path.join(ROOT, f)));
const D = global.Devices;
ok(typeof D.tick === 'function' && typeof D.clockSeconds === 'function' && typeof D.syncClock === 'function', 'Devices.tick / clockSeconds / syncClock exported');

const FAMS = [['1997', 1, null], ['dm20', 1, 'zuba'], ['pendulum', 1, 'pen_1_0'], ['pen20', 1, 'pen_20th_sk'], ['digivice', 1, 'dv1999_v1']];
function fresh(v, sp, t0) {
  const s = D.hatchEgg(null, v, false, sp);
  s.clockInitialized = true;
  if (s.clockSet) s.clockSet.on = false;
  if (s.family === 'digivice') {
    global.DigiviceEngine.pickPartner(s, 0);
    s.clock = { h12: 10, min: 0, pm: false, field: 'h' };
    global.DigiviceEngine.confirmClock(s);
  }
  s.gameTime = s.gameTime || 0;
  s.clockOffset = 10 * 3600 - s.gameTime;
  s.lastReal = t0;
  return s;
}
const mins = (sec) => Math.floor((((sec % 86400) + 86400) % 86400) / 60);
FAMS.forEach(([name, v, sp]) => {
  const t0 = 1.8e12;
  let s = fresh(v, sp, t0);
  // Open: per-frame ticks for 90 s.
  let t = t0;
  for (let i = 0; i < 90 * 4; i++) { t += 250; D.tick(s, t); }
  eq(mins(D.clockSeconds(s)), 10 * 60 + 1, name + ': clock advances while open (10:01 after 90 s)');
  // Save → relaunch 2 h later (lastReal kept from save).
  s = JSON.parse(JSON.stringify(s));
  const gt = s.gameTime;
  t += 2 * 3600 * 1000;
  D.tick(s, t);
  eq(mins(D.clockSeconds(s)), 12 * 60 + 1, name + ': relaunch after 2 h shows 12:01');
  ok(Math.abs((s.gameTime - gt) - 7200) < 2 || s.dead, name + ': simulation caught up the 2 h');
  // Closed 30 h (beyond 13 h / 6 h simulation cap): clock still on wall time.
  t += 30 * 3600 * 1000;
  D.tick(s, t);
  eq(mins(D.clockSeconds(s)), (18 * 60 + 1) % 1440, name + ': after 30 h away the clock still matches real time (18:01)');
  // Debug speed > 1 keeps game-time clock (not anchored).
});

// The clock is the player's SET value + real elapsed time, never the phone's clock.
{
  // Device defaults when never set: not phone time, and still running.
  const realDate = Date;
  global.Date = class extends realDate { getHours() { return 17; } getMinutes() { return 42; } };
  global.Date.now = realDate.now;
  const s97 = global.Engine.defaultState(1);
  const sPen = global.PendulumEngine.defaultState('pen_1_0');
  global.Date = realDate;
  eq(s97.clockOffset, 0, '1997 reset default is AM 12:00, not the phone time (phone said 17:42)');
  eq(sPen.clockOffset, 0, 'Pendulum reset default is AM 12:00, not the phone time');
  const t0 = 1.8e12;
  FAMS.forEach(([name, v, sp]) => {
    const s = D.hatchEgg(null, v, false, sp);
    s.lastReal = t0;
    const c0 = D.clockSeconds(s);
    D.tick(s, t0 + 1000);
    D.tick(s, t0 + 10 * 60 * 1000);
    eq(Math.round(D.clockSeconds(s) - c0), 600, name + ': never-set clock still runs at real speed (+10 min)');
  });
}
// SET: the new value runs from the moment of confirm (1997 SET flow).
{
  const t0 = 1.8e12;
  const s = fresh(1, null, t0);
  for (let t = t0; t <= t0 + 60000; t += 1000) D.tick(s, t);
  global.Engine.beginClockSet(s);
  s.clockSet.h24 = 21; s.clockSet.min = 15;
  D.tick(s, t0 + 120000);
  eq(mins(D.clockSeconds(s)), 21 * 60 + 15, '1997: SET open shows the value being edited');
  global.Engine.confirmClockSet(s);
  D.tick(s, t0 + 120000);
  D.tick(s, t0 + 120000 + 5 * 60 * 1000);
  eq(mins(D.clockSeconds(s)), 21 * 60 + 20, '1997: after SET 21:15, five real minutes later shows 21:20');
  eq(s.clockAnchor.value, 21 * 3600 + 15 * 60, '1997: anchor stores the SET value');
  const saved = JSON.parse(JSON.stringify(s));
  D.tick(saved, t0 + 120000 + 3 * 3600 * 1000 + 5 * 60 * 1000);
  eq(mins(D.clockSeconds(saved)), (21 * 60 + 15 + 185) % 1440, '1997: closed 3 h after SET → 00:20');
}
// Pen20 / Digivice / Pendulum SET flows.
{
  const t0 = 1.8e12;
  const p = fresh(1, 'pen_20th_sk', t0);
  D.tick(p, t0 + 1000);
  global.Pen20Engine.beginClockSet(p); p.clockSet.h24 = 6; p.clockSet.min = 0;
  global.Pen20Engine.confirmClock(p);
  D.tick(p, t0 + 2000); D.tick(p, t0 + 2000 + 3600 * 1000);
  eq(mins(D.clockSeconds(p)), 7 * 60, 'pen20: SET 06:00 then 1 h real → 07:00');
  const d = fresh(1, 'dv1999_v1', t0);
  D.tick(d, t0 + 1000);
  d.clock = { h12: 8, min: 30, pm: true, field: 'h' }; global.DigiviceEngine.confirmClock(d);
  D.tick(d, t0 + 2000); D.tick(d, t0 + 2000 + 45 * 60 * 1000);
  eq(mins(D.clockSeconds(d)), 21 * 60 + 15, 'digivice: SET 8:30 PM then 45 min → 21:15');
  const q = fresh(1, 'pen_1_0', t0);
  D.tick(q, t0 + 1000);
  if (global.PendulumEngine.beginClockSet) {
    global.PendulumEngine.beginClockSet(q);
    q.clockSet.h24 = 23; q.clockSet.min = 50;
    D.tick(q, t0 + 30000);
    (global.PendulumEngine.confirmClockSet || global.PendulumEngine.confirmClock)(q);
    D.tick(q, t0 + 30000); D.tick(q, t0 + 30000 + 20 * 60 * 1000);
    eq(mins(D.clockSeconds(q)), 10, 'pendulum: SET 23:50 then 20 min → 00:10');
  }
}
// Old v30 saves (no anchor, frozen-at-close clock) migrate and run.
{
  const t0 = 1.8e12;
  FAMS.forEach(([name, v, sp]) => {
    const s = fresh(1 && v, sp, t0);
    delete s.clockAnchor; delete s.clockSyncOffset;
    const old = JSON.parse(JSON.stringify(s));    // as saved by v30 at t0, clock 10:00
    D.tick(old, t0 + 90 * 60 * 1000);              // relaunched 90 min later
    eq(mins(D.clockSeconds(old)), 11 * 60 + 30, name + ': v30 save migrates; clock continues from its saved time (11:30)');
    ok(old.clockAnchor && old.clockAnchor.value === 36000 && old.clockAnchor.at === t0, name + ': anchor = saved clock at saved lastReal');
  });
}
// Dead pets / debug speed do not corrupt the clock.
{
  const t0 = 1.8e12;
  const s = fresh(1, null, t0);
  s.dead = true;
  D.tick(s, t0 + 5000); D.tick(s, t0 + 65000);
  eq(mins(D.clockSeconds(s)), 10 * 60 + 1, '1997 dead: clock keeps its own time, no runaway');
  const f = fresh(1, null, t0);
  f.speed = 60;
  D.tick(f, t0 + 60000);
  eq(mins(D.clockSeconds(f)), 11 * 60, 'debug speed 60: one real minute = one game hour');
}

/* ---------------- 3) UI wiring ---------------- */
console.log('3) UI keeps lastReal on load, catches up on resume, saves on hide');
const load = ui.slice(ui.indexOf('function loadGame'), ui.indexOf('function newEgg'));
ok(!/state\.lastReal = Date\.now\(\);\s*\n\s*view = state\.dead/.test(load), 'loadGame no longer resets lastReal to now (that froze the clock at close time)');
ok(/state\.lastReal > nowLoad/.test(load), 'loadGame only resets a missing/future lastReal');
ok(/visibilitychange[\s\S]{0,200}catchUpNow\(\)[\s\S]{0,80}persist\(\)/.test(ui), 'visibilitychange: catch up when visible, save when hidden');
ok(/addEventListener\('pageshow', function \(\) \{ catchUpNow\(\); ingestUrl\(\); \}\)/.test(ui), 'pageshow catches up');
ok(/addEventListener\('pagehide', function \(\) \{ persist\(\); \}\)/.test(ui), 'pagehide saves');
ok(/setInterval\(function \(\) \{[\s\S]{0,160}frameStep\(\)/.test(ui), '1 s watchdog redraws if rAF stalls');
ok(/window\.Devices\.tick/.test(ui), 'UI ticks through Devices.tick (clock anchoring)');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
