#!/usr/bin/env node
/**
 * Real-time (1x) is the official default. Old builds used 60x, which starved
 * pets in minutes. Existing saves with speed 60 or missing are migrated
 * once, then a speedMigrated flag leaves later debug rates alone.
 */
'use strict';

global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Engine = require('../js/engine.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

console.log('Speed default and migration tests');

// --- new games are 1x ---
{
  const s = Engine.defaultState(1);
  eq(s.speed, 1, 'defaultState speed is 1 (real time)');
  eq(s.speedMigrated, true, 'new games are already speedMigrated');
}
{
  const s = Engine.defaultState(1, 'zuba');
  eq(s.speed, 1, 'DM20 defaultState is also 1x');
}

// --- hatchIfEggSelect fallback ---
{
  const s = Engine.hatchIfEggSelect(null, 1, false, null);
  eq(s.speed, 1, 'hatchIfEggSelect with no prior state is 1x');
  eq(s.speedMigrated, true, 'hatchIfEggSelect flags the new egg');
}
{
  const prev = Engine.defaultState(2);
  prev.speed = 60;
  delete prev.speedMigrated;
  const s = Engine.hatchIfEggSelect(prev, 1, false, null);
  eq(s.speed, 1, 'unmigrated 60x parent does not carry 60 onto a new egg');
  eq(s.speedMigrated, true, 'new egg is flagged');
}
{
  const prev = Engine.defaultState(2);
  prev.speed = 10;
  prev.speedMigrated = true;
  const s = Engine.hatchIfEggSelect(prev, 1, false, 'zuba');
  eq(s.speed, 10, 'a deliberate debug rate carries onto a new egg');
  eq(s.speedMigrated, true, 'carried debug egg stays flagged');
}
{
  const prev = Engine.defaultState(2);
  prev.speed = 60;
  prev.speedMigrated = true;
  const s = Engine.hatchIfEggSelect(prev, 3, false, null);
  eq(s.speed, 60, 'after migration, an explicit debug 60x is kept on a new egg');
}

// --- migrate: 60 or missing → 1, once ---
{
  const s = Engine.defaultState(1);
  s.speed = 60;
  delete s.speedMigrated;
  const out = Engine.migrateState(s);
  eq(out.speed, 1, 'unmigrated 60 → 1');
  eq(out.speedMigrated, true, 'unmigrated 60 sets speedMigrated');
}
{
  const s = Engine.defaultState(1);
  s.speed = 60;
  delete s.speedMigrated;
  Engine.migrateState(s);
  Engine.migrateState(s);
  eq(s.speed, 1, 'second migrate on a former-60 save stays at 1 (idempotent)');
  eq(s.speedMigrated, true, 'flag still set after second migrate');
}
{
  const s = Engine.defaultState(1);
  delete s.speed;
  delete s.speedMigrated;
  Engine.migrateState(s);
  eq(s.speed, 1, 'missing speed → 1');
  eq(s.speedMigrated, true, 'missing speed sets the flag');
}
{
  const s = Engine.defaultState(1);
  s.speed = 10;
  delete s.speedMigrated;
  Engine.migrateState(s);
  eq(s.speed, 10, 'a non-default 10x (user chose it) is left alone');
  eq(s.speedMigrated, true, 'non-default still gets the flag');
}
{
  const s = Engine.defaultState(1);
  s.speed = 60;
  s.speedMigrated = true;
  Engine.migrateState(s);
  eq(s.speed, 60, 'already-migrated 60x (debug) is not reset');
  eq(s.speedMigrated, true, 'already-migrated flag stays');
}
{
  const s = Engine.defaultState(1);
  s.speed = 1;
  s.speedMigrated = true;
  Engine.migrateState(s);
  eq(s.speed, 1, 'already-migrated 1x stays 1');
}

// --- tick migrates before applying dt, so a leftover 60x does not run 60x ---
{
  const s = Engine.defaultState(1);
  s.mon = 'agumon';
  s.speed = 60;
  delete s.speedMigrated;
  s.gameTime = 1000;
  s.hunger = 4;
  s.sleeping = false;
  const now = Date.now();
  s.lastReal = now - 5000; // 5 real seconds
  Engine.tick(s, now);
  eq(s.speed, 1, 'tick migrates 60 → 1 before applying dt');
  eq(s.speedMigrated, true, 'tick sets the flag');
  // 5 real seconds at 1x → 5 game seconds (allow a little slack)
  ok(s.gameTime >= 1004 && s.gameTime <= 1006,
    '5 real seconds at a migrated 60x save advance ~5 game seconds, not ~300 (got ' + s.gameTime + ')');
}
{
  const s = Engine.defaultState(1);
  s.mon = 'agumon';
  s.gameTime = 1000;
  const now = Date.now();
  s.lastReal = now - 4000;
  Engine.tick(s, now);
  ok(s.gameTime >= 1003 && s.gameTime <= 1005,
    'default 1x: 4 real seconds advance ~4 game seconds (got ' + s.gameTime + ')');
}
{
  const s = Engine.defaultState(1);
  s.mon = 'agumon';
  s.speed = 10;
  s.speedMigrated = true;
  s.gameTime = 1000;
  const now = Date.now();
  s.lastReal = now - 2000;
  Engine.tick(s, now);
  ok(s.gameTime >= 1019 && s.gameTime <= 1021,
    'debug 10x: 2 real seconds advance ~20 game seconds (got ' + s.gameTime + ')');
}


// --- settings UI: speed is debug-only, 1x selected ---
{
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  ok(/id="speed-debug"[^>]*\bhidden\b/.test(html) || /id="speed-debug" hidden/.test(html),
    'speed-debug wrapper is hidden by default in the markup');
  ok(!/預設 60 倍/.test(html), 'settings copy no longer says the default is 60x');
  const sel = html.slice(html.indexOf('id="speed"'), html.indexOf('id="speed"') + 500);
  ok(/value="1"\s+selected/.test(sel), '×1 is the selected option');
  ok(!/value="60"\s+selected/.test(sel), '×60 is not the selected option');
  const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  ok(/get\('debug'\) === '1'/.test(ui), 'speed menu is gated on ?debug=1');
  ok(/applyDebugUi/.test(ui), 'applyDebugUi hides or shows the selector');
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  ok(!/預設時間速度 60/.test(readme), 'README no longer advertises a 60x default');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
