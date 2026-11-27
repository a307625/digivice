#!/usr/bin/env node
/**
 * v36 turn 3: 1997 Ver.1 bugs, Eric's decisions, and screen fidelity
 * against the Bandai Ver.1 manual (refs/ver1-manual-jp.pdf).
 */
'use strict';

const fs = require('fs');
const path = require('path');
global.EvolutionData = require('../js/evolution-data.js');
global.Evolution = require('../js/evolution.js');
const Engine = require('../js/engine.js');
const Steps = require('../js/steps.js');
const Kana = require('../js/lcd-kana.js');
const Audio = require('../js/audio.js');
const LO = require('../js/lights-off.js');
const ui = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const items = fs.readFileSync(path.join(__dirname, '../js/items.js'), 'utf8');
const mainItems = path.join(__dirname, '../../digivice-main/js/items.js');

let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }
function fn(name, prelude) {
  const m = ui.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'));
  if (!m) return null;
  // eslint-disable-next-line no-new-func
  return new Function((prelude || '') + m[0] + '; return ' + name + ';')();
}

console.log('1) draw1997Backdrop never reads DM1997_BG[NaN] (crash fix)');
{
  ok(/function backdropVersion\(\)/.test(ui), 'backdropVersion fallback exists');
  ok(/var bg = DM1997_BG\[ver\] \|\| DM1997_BG\[1\];/.test(ui), 'backdrop falls back to Ver.1 art');
  ok(!/if \(ver < 1 \|\| ver > 5\) ver = 1;/.test(ui), 'old NaN-blind clamp is gone');
  const mk = (st, dev) => fn('backdropVersion', 'var state = ' + JSON.stringify(st) + '; var window = { Engine: { mon: function (s) { return s.mon === "agumon" ? { version: 1 } : (s.mon === "elecmon" ? { version: 2 } : null); } } }; function currentDevice() { return ' + JSON.stringify(dev) + '; }');
  eq(mk(null, null)(), 1, 'no state, no device → Ver.1');
  eq(mk({}, { version: 3 })(), 3, 'save without version → device version');
  eq(mk({ version: 'special' }, null)(), 1, 'non-numeric version → Ver.1');
  eq(mk({ version: 4 }, { version: 1 })(), 4, 'a valid save version wins');
  eq(mk({ mon: 'elecmon' }, null)(), 2, 'falls back to the monster version');
  eq(mk({ version: 9 }, null)(), 1, 'out of range → Ver.1');
}

console.log('2) per-frame loop survives a throw');
{
  ok(/function loop\(\) \{\s*requestAnimationFrame\(loop\);\s*safeFrameStep\(\);\s*\}/.test(ui), 'loop reschedules first, then runs the guarded frame');
  ok(/function safeFrameStep\(\) \{\s*try \{\s*frameStep\(\);\s*\} catch \(err\)/.test(ui), 'frameStep is wrapped in try/catch');
  ok(/frameErrors === 1/.test(ui), 'a frame error is logged once, not every frame');
}

console.log('3) step-sync overlay never shows on the 1997 bricks');
{
  const base = { coldLaunch: true, isIOS: true };
  eq(Steps.shouldShowLaunchPrompt(Object.assign({ family: 'dm1997' }, base)), false, '1997: no launch overlay');
  eq(Steps.shouldShowLaunchPrompt(Object.assign({ family: 'pendulum' }, base)), true, 'Pendulum still offers it');
  eq(Steps.shouldShowLaunchPrompt(Object.assign({ family: 'pen20', deviceSteps: false }, base)), false, 'a device with steps:false never shows it');
  ok(/family: currentDevice\(\) && currentDevice\(\)\.family/.test(ui), 'UI passes the device family');
}

console.log('4) Eric: hatch 5 min, lights 20 min, wake 10 min then sleep, sound on');
{
  eq(Engine.eggHatchMinutes(Engine.defaultState(1)), 5, 'Ver.1 hatch 5 minutes');
  eq(Engine.lightsCallTimeout(Object.assign(Engine.defaultState(1), { mon: 'agumon' })), 20 * 60, 'Ver.1 lights call 20 min');
  eq(Engine.lightsCallTimeout(Object.assign(Engine.defaultState(2), { mon: 'elecmon' })), 60 * 60, 'Ver.2 keeps 60 min');
  const s = Engine.defaultState(1);
  s.mon = 'agumon'; s.clockOffset = 22 * 3600; s.gameTime = 0; s.speed = 1; s.lastReal = Date.now();
  s.clockInitialized = true; s.hunger = 4; s.strength = 4; s.lights = true; s.sleeping = true; s.sleepCalledTonight = true;
  const r = Engine.disturbSleep(s, 'food');
  ok(r.woken && !s.sleeping, 'a feed at night wakes the Digimon');
  eq(s.awakeUntil - s.gameTime, 600, 'awake window is 10 minutes');
  const adv = (sec) => { s.lastReal = Date.now() - sec * 1000; Engine.tick(s, Date.now()); };
  adv(9 * 60);
  ok(!s.sleeping, 'still awake at 9 min');
  adv(2 * 60);
  ok(s.sleeping, 'back asleep after 10 min');
  ok(/var soundOn = true;/.test(ui), 'sound is on by default');
  ok(/getItem\('digivice-sound'\) !== '0'/.test(ui), 'a stored "off" is still respected');
  ok(typeof Audio.callAlarm === 'function' && Audio.CALL_BEEPS.length === 3, 'call alarm: three beeps');
  eq(Audio.callAlarm(false), false, 'call alarm is silent when muted');
  ok(/lit && !callWasLit && fam === 'dm1997' && soundEnabled\(\)/.test(ui), 'a new call beeps once on the 1997 brick, only when sound is on');
}

console.log('5) kana words from the manual fit the 32-dot glass at one dot per pixel');
{
  for (const w of ['おなか', 'きんりょく', 'たいりょく', 'しょうりつ', 'おん', 'おふ']) {
    for (const ch of w) ok(Kana.has(ch), 'glyph ' + ch + ' exists');
    ok(Kana.kanaDots(w) <= 30, w + ' fits from col 1 (' + Kana.kanaDots(w) + ' dots)');
  }
  for (const w of ['エサ', 'プロテイン']) {
    for (const ch of w) ok(Kana.has(ch), 'glyph ' + ch + ' exists');
    ok(5 + Kana.kanaDots(w) <= 32, '→ + ' + w + ' fits (' + (5 + Kana.kanaDots(w)) + ' dots)');
  }
  ok(Kana.has('才') && Kana.has('→'), '才 and → exist');
  for (const ch in Kana.GLYPHS) {
    const g = Kana.GLYPHS[ch];
    eq(g.h, 7, ch + ' is 7 rows');
    ok(g.rows.every((r) => r.length === g.w && /^[01]+$/.test(r)), ch + ' rows are uniform bit rows');
  }
  ok(!/kana_|RAW_KANA/.test(items), 'items.js (HUD art) is untouched by the kana');
  if (fs.existsSync(mainItems)) ok(fs.readFileSync(mainItems, 'utf8') === items, 'items.js is byte-identical to live main');
}

console.log('6) status pages: labels, units, no leading zeros, A pages');
{
  ok(/statusLabel\('おなか'\)/.test(ui) && /statusLabel\('きんりょく'\)/.test(ui) && /statusLabel\('しょうりつ'\)/.test(ui), 'hunger / strength / win labels');
  ok(/drawKana\(ctx, '才'/.test(ui) && /drawText\(ctx, 'G', fx\(27\)/.test(ui), 'age 才 and weight G units');
  const drn = ui.match(/function drawRightNumber[\s\S]*?\n  \}/)[0];
  ok(/drawNumber\(ctx, n, fx\(x0\), fy\(row\), ITEM, 0\)/.test(drn), 'right-aligned numbers are not zero-padded');
  ok(/view === 'status' && is1997Brick\(\)\) \{\s*statusPage = \(statusPage \+ 1\) % statusPages\(\)\.length;/.test(ui), 'A also turns the status page');
}

console.log('7) clock: 0:00 at midnight / noon, no leading zero (1997)');
{
  ok(/if \(h === 0 && !jpHour\) h = 12;/.test(ui), '1997 keeps 0 for the 12 o\'clock hour');
  ok(/if \(jpHour\) I\.drawNumber\(ctx, h, h < 10 \? dx \+ 5 \* ITEM : dx, dy, ITEM, 0\);/.test(ui), 'single-digit hour, right-aligned to the colon');
}

console.log('8) feed / lights menus and eating layout');
{
  ok(/drawKanaMenu\(\['エサ', 'プロテイン'\], foodSel\)/.test(ui), 'feed menu → エサ / プロテイン');
  ok(/drawKanaMenu\(\['おん', 'おふ'\], lightSel\)/.test(ui), 'lights menu → おん / おふ');
  ok(/if \(is1997Brick\(\)\) \{\s*lightSel = state\.lights === false \? 1 : 0;\s*view = 'lightMenu';/.test(ui), '1997 B on the lamp opens the menu at the current state');
  ok(/window\.Engine\.setLights\(state, lightSel === 0\);/.test(ui), 'B sets the lamp from the menu');
  ok(/if \(is1997Brick\(\)\) return \{ food: piece, xDots: 3, yDots: 8 \};/.test(ui), 'food on the left');
  ok(/eatAnim\.on && is1997Brick\(\)\) \{[\s\S]{0,120}mx = fx\(14\);\s*flip = false;/.test(ui), 'Digimon on the right, facing the food');
}

console.log('9) Ver.1 training: hidden shield, shot, 3 VS 2');
{
  const hit = fn('ver1RoundHit');
  eq(hit(1, 0), true, 'high attack vs low shield hits');
  eq(hit(0, 1), true, 'low attack vs high shield hits');
  eq(hit(1, 1), false, 'same height is blocked');
  const body = ui.match(/function drawVer1Train[\s\S]*?\n  \}/)[0];
  ok(/if \(!a\) return;\s*var top/.test(body), 'nothing about the shield is drawn before the press');
  ok(body.indexOf('if (!a) return;') < body.indexOf('drawDots(V1_SHIELD, 12'), 'shield only after the press');
  ok(/'VS'/.test(body), 'result screen shows hits VS misses');
  ok(!/fillRect\(fx\(14\), fy\(high \? 1 : 13\)/.test(ui), 'old answer mark is gone');
  ok(/if \(train\.anim \|\| train\.resultAt\) return;/.test(ui), 'one press per round');
}

console.log('10) 1997 battle: banner, shots, burst, suns / skulls');
{
  const ph = fn('battle97Phase');
  eq(ph(0), 'banner', 't0 banner'); eq(ph(4), 'shot', 't4 your shot'); eq(ph(6), 'incoming', 't6 foe shot');
  eq(ph(8), 'hit', 't8 hit burst'); eq(ph(12), 'result', 't12 result');
  ok(/var battleEnd = is1997Brick\(\) \? BATTLE97_END : 8;/.test(ui), 'battle runs to the end of the result');
  ok(/drawText\(ctx, 'BATTLE', fx\(0\), fy\(5\), ITEM\)/.test(ui), 'BATTLE banner at native dot size');
  ok(/drawDots\(SUN_DOTS, 0, 4\);\s*drawDots\(SUN_DOTS, 25, 4\);/.test(ui), 'win: suns on both sides');
  ok((ui.match(/blitItem\('skull', fx\((0|24)\), fy\((0|8)\), ITEM\);/g) || []).length >= 4, 'loss: four corner skulls');
}

console.log('11) lights off, heal sun, grave number, integer dots');
{
  eq(LO.playfieldMode({ lights: false, sleeping: true }, 'play', 'dm1997'), 'blank-dark', 'lamp off → dark');
  eq(LO.playfieldMode({ lights: false, dead: true }, 'play', 'dm1997'), 'paper', 'the grave is never hidden');
  eq(LO.playfieldMode({ lights: false }, 'food', 'dm1997'), 'paper', 'menus still paint');
  ok(/if \(is1997PlayDark\(\)\) \{ drawDarkSleepZ\(\); return; \}/.test(ui), 'dark screen shows only the zZ');
  ok(!/rgba\(16, 20, 28, 0\.28\)/.test(ui), 'old half-dim overlay is gone');
  ok(/playPose\('happy', 1600, 'heal'\)/.test(ui) && /extra === 'heal' && is1997Brick\(\)\) drawDots\(SUN_DOTS/.test(ui), 'heal: happy + sun');
  ok(/drawRightNumber\(I, age, 29, 5\)/.test(ui), 'grave shows the survival number');
  const sz = fn('lcdIntegerSize');
  for (const [w, h, dpr] of [[300, 150, 2], [347, 171, 3], [181, 90, 1], [520, 262, 2.625]]) {
    const r = sz(w, h, 32, 16, dpr);
    ok(r && Number.isInteger(r.k) && r.w <= w + 1e-9 && r.h <= h + 1e-9, `integer dot ${w}x${h}@${dpr}: k=${r && r.k}`);
    ok(r && Math.abs(r.w * dpr / 32 - r.k) < 1e-9, 'every dot is k whole device pixels');
  }
  eq((ui.match(/function sizeLcd\(\)/g) || []).length, 1, 'one sizeLcd (no dead duplicate)');
}

console.log('12) 1997 clock: small seconds digits like the manual SET mock-up');
{
  const body = ui.match(/function drawClock1997[\s\S]*?\n  \}/)[0];
  ok(/drawSmallNumber\(ctx, shownSec, fx\(L\.secX\), fy\(L\.secY\), ITEM, 2\)/.test(body), 'seconds are 2 small digits at ITEM scale (same dot size)');
  ok(!/triangle/.test(body), 'no triangles on the 1997 clock');
  ok(/var shownSec = setting \? 0 : s;/.test(body), 'SET screen reads 00, as in the manual');
  ok(/if \(jpHour\) \{ drawClock1997\(I, setting, blinkOn, isAM, h, min, s\); return; \}/.test(ui), '1997 uses its own clock face; other devices keep theirs');
  const L = fn('clock1997Layout')();
  ok(L.hourX + 9 < L.colonX && L.colonX < L.minX, 'hour, colon, minutes do not overlap');
  ok(L.minX + 9 < L.secX, 'seconds start right of the minutes');
  ok(L.secX + 4 + 3 <= 32, 'two 3-wide seconds digits fit in 32 columns');
  ok(L.bigY + 7 <= L.amY, 'big digits (7 rows) end above AM/PM');
  ok(L.secY + 5 === L.bigY + 7, 'seconds bottom-align with the big digits');
  ok(L.amY + 8 <= 16 && L.setY + 6 <= 16, 'AM/PM and SET stay inside 16 rows');
}

console.log('13) 1997: A after the last icon goes home with no icon (firmware §9)');
{
  const m = ui.match(/function cycleSel\(\) \{[\s\S]*?\n  \}/);
  ok(!!m, 'cycleSel found');
  const mk = (fam) => new Function('var view = "play", sel = 6, statusPage = 0, foodSel = 0, battleSel = 0, lightSel = 0, albumSel = 0, albumPose = 0, connectSel = 0;' +
    'function is1997Brick() { return ' + JSON.stringify(fam === 'dm1997') + '; }' +
    'function selectable() { return ["STATUS","FEED","TRAIN","BATTLE","FLUSH","LIGHT","MEDIC"]; }' +
    'function statusPages() { return [1,2,3,4,5]; } function battleMenuItems() { return []; }' +
    m[0] + '; return { a: function () { cycleSel(); return sel; } };')();
  const b = mk('dm1997');
  eq(b.a(), -1, '1997: A on MEDIC → home, no icon');
  eq(b.a(), 0, '1997: next A → STATUS');
  const d = mk('dm20');
  eq(d.a(), 0, 'DM20 unchanged: wraps to STATUS');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
