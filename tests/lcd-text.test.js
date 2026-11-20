#!/usr/bin/env node
'use strict';
/**
 * v33: LCD text must fit the device's LCD and use the device's single dot
 * size (user rule: never shrink or re-scale text to make it fit; scroll,
 * page or re-lay-out instead, like the real units).
 *
 *  1) Static: every literal text / number / fitted-text call in the
 *     1997/DM20, Pendulum and Pen20 UIs is inside the 32x16 LCD field,
 *     and every call uses the device dot size (ITEM). Digivice text is size 1.
 *  2) Runtime: Pendulum, Pen20 and Digivice UIs are drawn in node for every
 *     view and sub-state; each text/icon draw is recorded by the
 *     VpetLcdAudit hook and must be inside the LCD (Digivice: inside the
 *     round window) at 4 canvas px per dot.
 *  (The 1997/DM20 screens are rendered the same way in a real browser by
 *   /workspace/digivice-v33-hotfix/lcdscreens.js; ui.js needs the DOM.)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
global.window = global;
require(path.join(ROOT, 'js/items.js'));
const I = global.VpetItems;
const FW = 32, FH = 16, DOT = 4;

function dotsOf(text, tracking) { return I.textDots(text, tracking); }
function rowsOf(text) { return /[0-9]/.test(text) ? 7 : 6; }

console.log('1) Static check of text call sites');
const files = {
  'js/ui.js': { fx: /fx\(([^()]+)\)/, fy: /fy\(([^()]+)\)/ },
  'js/devices/pendulum/ui.js': {}, 'js/devices/pen20/ui.js': {},
};
const CONST = { FW: 32, MENU_LABEL_X: 6, MENU_LABEL_DOTS: 26 };
function val(expr) { expr = expr.trim(); if (/^\d+$/.test(expr)) return +expr; if (expr in CONST) return CONST[expr]; return null; }
let checkedLit = 0, checkedFit = 0, checkedNum = 0;
for (const f of Object.keys(files)) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lines = src.split('\n');
  lines.forEach((ln, i) => {
    const at = f + ':' + (i + 1);
    let m;
    // literal text: text(host, 'LIT', host.fx(X), host.fy(Y), host.ITEM[, T]) / I.drawText(ctx, 'LIT', fx(X), fy(Y), ITEM[, T])
    const reLit = /(?:\btext\(host|\.drawText\(ctx), '([^']*)', (?:host\.)?fx\(([^()]+)\), (?:host\.)?fy\(([^()]+)\), (?:host\.)?ITEM(?:, (\d))?\)/g;
    while ((m = reLit.exec(ln))) {
      const x = val(m[2]), y = val(m[3]); if (x == null || y == null) continue;
      const w = dotsOf(m[1], m[4] != null ? +m[4] : 1), h = rowsOf(m[1]);
      checkedLit++;
      ok(x >= 0 && y >= 0 && x + w <= FW && y + h <= FH, `${at} "${m[1]}" at (${x},${y}) is ${w}x${h} dots → must fit 32x16`);
    }
    const reFit = /(?:fitText\(host, [^;]*?, |drawTextFit\(ctx, [^;]*?, )(?:host\.)?fx\(([^()]+)\), (?:host\.)?fy\(([^()]+)\), (?:(?:host\.)?ITEM, )?([A-Z_0-9]+)/g;
    while ((m = reFit.exec(ln))) {
      const x = val(m[1]), y = val(m[2]), w = val(m[3]); if (x == null || y == null || w == null) continue;
      checkedFit++;
      ok(x + w <= FW && y + 7 <= FH, `${at} scrolling field at (${x},${y}) ${w} dots wide must fit 32x16`);
    }
    const reNum = /(?:\bnum\(host|\.drawNumber\(ctx), [^;]*?, (?:host\.)?fx\(([^()]+)\), (?:host\.)?fy\(([^()]+)\), (?:host\.)?ITEM(?:, (\d))?\)/g;
    while ((m = reNum.exec(ln))) {
      const x = val(m[1]), y = val(m[2]); if (x == null || y == null) continue;
      const digits = m[3] != null ? Math.max(1, +m[3]) : 2;
      checkedNum++;
      ok(y + 7 <= FH, `${at} number at row ${y} is 7 rows → must end by row 15`);
      ok(x + digits * 5 - 1 <= FW, `${at} ${digits}-digit number at col ${x} must end by col 31`);
    }
    // dot-size rule: no text/number drawn at any scale other than the device ITEM
    const reScale = /(?:\.drawText|\.drawNumber|\.drawSmallNumber|\.drawTextWrapped)\(ctx, [^;]*?, (?:host\.)?fx\([^()]+\)(?: \+ [^,]+)?, (?:host\.)?fy\([^()]+\), ([^,)]+)/g;
    while ((m = reScale.exec(ln))) ok(/^(host\.)?ITEM$/.test(m[1].trim()), `${at} text scale "${m[1].trim()}" must be the device dot size (ITEM)`);
    if (/drawTextWrapped\(/.test(ln) && !/function drawTextWrapped/.test(ln)) ok(false, `${at} wrapped text spills to a 3rd line on a 16-row LCD; use drawTextFit (scroll)`);
  });
}
ok(checkedLit > 40 && checkedFit > 15 && checkedNum > 20, `static checker saw the call sites (${checkedLit} literals, ${checkedFit} scrolling fields, ${checkedNum} numbers)`);
{
  const dv = fs.readFileSync(path.join(ROOT, 'js/devices/digivice/ui.js'), 'utf8');
  ok(!/textC\(ctx, [^;]*, \d+, 2\)/.test(dv) && !/\btext\(ctx, [^;]*, 2\);/.test(dv), 'Digivice: no double-size (2x dot) text left');
  ok(/function chordSpan\(/.test(dv) && /function scrollText\(/.test(dv), 'Digivice: lines are fitted to the round window (chord) and scroll when longer');
}

console.log('2) Runtime render of every Pendulum / Pen20 / Digivice screen');
['js/evolution-data.js', 'js/evolution.js', 'js/sprites.js', 'js/save.js', 'js/battle.js', 'js/steps.js',
  'js/devices/registry.js', 'js/devices/pendulum/data.js', 'js/devices/pendulum/versions.js', 'js/devices/pendulum/sprites.js',
  'js/devices/pendulum/sprites-extra.js', 'js/devices/pendulum/shake.js', 'js/devices/pendulum/engine.js', 'js/devices/pendulum/ui.js',
  'js/devices/pen20/data.js', 'js/devices/pen20/sprites.js', 'js/devices/pen20/engine.js', 'js/devices/pen20/profiles.js', 'js/devices/pen20/ui.js',
  'js/devices/digivice/data.js', 'js/devices/digivice/sprites.js', 'js/devices/digivice/engine.js', 'js/devices/digivice/profiles.js',
  'js/devices/digivice/ui.js', 'js/engine.js'].forEach((f) => require(path.join(ROOT, f)));
const D = global.Devices;
const stubCtx = new Proxy({ canvas: { width: 160, height: 96 } }, {
  get(t, k) { if (k in t) return t[k]; return () => ({ data: new Uint8ClampedArray(4) }); },
  set(t, k, v) { t[k] = v; return true; },
});
let recs = [];
global.VpetLcdAudit = { on: true, rec: (r) => recs.push(r) };
function host(state, view) {
  const h = {
    ctx: stubCtx, state, view, profile: D.deviceFor ? D.deviceFor(state) : null,
    setView() {}, getSel: () => -1, setSel() {},
    fx: (d) => 16 + d * DOT, fy: (d) => 16 + d * DOT,
    blitItem: (n, x, y, s, fl) => I.blit(stubCtx, n, x, y, s, fl), blitMon() {},
    items: () => I, animTick: () => 0,
    PAPER: '#c6cbb8', NIGHT: '#10141c', INK: '#1a1c16', DOT, ITEM: 4, OX: 16, OY: 16, FW, FH, LCD_W: 160, LCD_H: 96, MON: 2, ANIM_MS: 500,
    walk: { x: 8, dir: -1 }, eatAnim: { on: false }, poseFx: {}, evoFx: { t: 0 }, shotMode: true, persist() {},
  };
  return new Proxy(h, { get(t, k) { return k in t ? t[k] : () => null; } });
}
function audit(fam, label, fn) {
  recs = [];
  try { fn(); } catch (e) { ok(false, `${label}: render threw ${e.message}`); return; }
  for (const t of recs) {
    const dv = fam === 'digivice';
    const F = dv ? { x0: 0, y0: 0, x1: 144, y1: 144 } : { x0: 16, y0: 16, x1: 144, y1: 80 };
    let good = t.scale === DOT && t.x >= F.x0 && t.y >= F.y0 && t.x + t.w <= F.x1 && t.y + t.h <= F.y1;
    if (dv) for (const [cx, cy] of [[t.x, t.y], [t.x + t.w, t.y], [t.x, t.y + t.h], [t.x + t.w, t.y + t.h]]) if (Math.hypot(cx - 72, cy - 72) > 72.01) good = false;
    ok(good, `${label}: ${t.kind} "${t.text}" @${t.x},${t.y} ${t.w}x${t.h} dot=${t.scale}px`);
  }
  return recs.length;
}
let drawn = 0, screens = 0;
// Pendulum OG / ZERO
for (const v of ['1_0', '1_5', '2_0', '2_5', '3_0', '3_5', '4_0', '4_5', '5_0', '5_5', 'zero']) {
  const s = global.PendulumEngine.defaultState('pen_' + v);
  s.clockInitialized = true; s.clockSet = { on: false, h24: 10, min: 34 };
  s.mon = (global.PendulumData.versionForEgg('pen_' + v) || {}).idleMon || 'tentomon';
  Object.assign(s, { ageDays: 99, weight: 99, wins: 999, losses: 999, battles: 999, hunger: 4, strength: 4, dpQ: 16, dpMaxQ: 16 });
  const UI = global.PendulumUI, F = 'pendulum';
  for (let p = 0; p < 7; p++) { screens++; drawn += audit(F, `pen ${v} status ${p}`, () => { UI.setStatusPage(p); UI.draw(host(s, 'status')); }) || 0; }
  for (const view of ['clock', 'play', 'food', 'lightMenu', 'healMenu', 'connect', 'soundMenu', 'evo', 'grave']) for (let i = 0; i < 2; i++) {
    screens++; drawn += audit(F, `pen ${v} ${view} ${i}`, () => { UI.setSubSel(i); UI.draw(host(s, view)); }) || 0;
  }
  for (const ph of ['ready', 'count', 'shots', 'result']) { screens++; drawn += audit(F, `pen ${v} train ${ph}`, () => { UI.setTrainForShot(ph, { shakes: 99, shot: 4, supers: 2, result: { success: ph === 'result' } }); UI.draw(host(s, 'train')); }) || 0; }
  for (const ph of ['ready', 'count', 'shots', 'result']) { screens++; drawn += audit(F, `pen ${v} battle ${ph}`, () => { const b = UI.getBattle(); Object.assign(b, { phase: ph, shakes: 99, hpS: 3, hpF: 3, result: 'lose' }); UI.draw(host(s, 'battle')); }) || 0; }
}
// Pen20 SK / SB
for (const egg of ['pen_20th_sk', 'pen_20th_sb']) {
  const s = global.Pen20Engine.defaultState(egg);
  s.clockInitialized = true; s.clockSet = { on: false, h24: 10, min: 34 }; s.gameTime = 70; s.clockOffset = 10 * 3600;
  global.Pen20Engine.tick(s, Date.now());
  const p0 = s.pets[0]; global.Pen20Engine.applyMon(p0, 'tento', 70);
  Object.assign(p0, { ageDays: 99, weight: 99, wins: 999, losses: 999, hunger: 4, strength: 4, dpQ: 64, dpMaxQ: 64 });
  Object.assign(s, { recordWins: 999, recordBattles: 999, champion: true, coloSingle: 101, coloTag: 101, album: ['tento', 'metalgreymon_vi'] });
  const UI = global.Pen20UI, F = 'pen20';
  for (let p = 0; p < UI.STATUS_PAGES.length; p++) { screens++; drawn += audit(F, `pen20 ${egg} status ${UI.STATUS_PAGES[p]}`, () => { UI.setStatusPage(p); UI.draw(host(s, 'status')); }) || 0; }
  for (const view of ['clock', 'play', 'food', 'lightMenu', 'healMenu', 'connect', 'coloMenu']) for (let i = 0; i < 3; i++) {
    screens++; drawn += audit(F, `pen20 ${egg} ${view} ${i}`, () => { UI.setSubSel(i); UI.draw(host(s, view)); }) || 0;
  }
  for (const ph of ['pick-div', 'pick-act']) for (let i = 0; i < 2; i++) { screens++; drawn += audit(F, `pen20 colo menu ${ph} ${i}`, () => { UI.setAuditState({ battle: { on: true, phase: ph } }); UI.setSubSel(i); UI.draw(host(s, 'coloMenu')); }) || 0; }
  for (const ph of ['fight', 'result']) { screens++; drawn += audit(F, `pen20 colo ${ph}`, () => { UI.setAuditState({ battle: { phase: ph, foe: 'METALGARURUMON', won: false, injured: true } }); UI.draw(host(s, 'colo')); }) || 0; }
  for (const r of ['gigahit', 'megahit', 'success', 'fail']) { screens++; drawn += audit(F, `pen20 train ${r}`, () => { UI.setAuditState({ train: { phase: 'result', result: r } }); UI.draw(host(s, 'train')); }) || 0; }
  for (let t = 0; t < 4; t++) for (const idx of [0, 1]) { screens++; drawn += audit(F, `pen20 album tab ${t}/${idx}`, () => { UI.setAuditState({ albumTab: t, albumIdx: idx, passPos: 5 }); UI.draw(host(s, 'album')); }) || 0; }
  screens++; drawn += audit(F, 'pen20 egg pick', () => { s.unlockedEggs = ['digitama_nsp']; UI.setAuditState({ eggPickIdx: 0 }); UI.draw(host(s, 'eggPick')); }) || 0;
  screens++; drawn += audit(F, 'pen20 computer', () => { s.display = 'computer'; UI.draw(host(s, 'play')); s.display = 'pets'; }) || 0;
}
// Digivice V1 / V2
for (const egg of ['dv1999_v1', 'dv1999_v2']) {
  const E = global.DigiviceEngine, UI = global.Dv1999UI, F = 'digivice';
  const s = E.defaultState(egg); E.pickPartner(s, 0); s.clock = { h12: 10, min: 34, pm: false, field: 'h' }; E.confirmClock(s); s.dp = 88; s.areaRemaining = 10000;
  const U = UI.getUi();
  const scr = (name, set) => () => { UI.setScreen(name); if (set) set(U); UI.draw(host(s, 'play')); };
  for (const name of ['main', 'map', 'slot', 'card', 'medical']) { screens++; drawn += audit(F, `dv ${egg} ${name}`, scr(name)) || 0; }
  for (let i = 0; i < 9; i++) { screens++; drawn += audit(F, `dv menu ${i}`, scr('menu', (u) => { u.menuI = i; })) || 0; }
  for (let i = 0; i < 5; i++) { screens++; drawn += audit(F, `dv status ${i}`, scr('status', (u) => { u.statusI = i; })) || 0; }
  for (let i = 0; i < 2; i++) { screens++; drawn += audit(F, `dv vs ${i}`, scr('vs', (u) => { u.vsI = i; })) || 0; }
  screens++; drawn += audit(F, 'dv set clock', () => { const t = JSON.parse(JSON.stringify(s)); t.phase = 'setClock'; UI.draw(host(t, 'play')); }) || 0;
  screens++; drawn += audit(F, 'dv partner pick', () => { const t = JSON.parse(JSON.stringify(s)); t.phase = 'pickPartner'; UI.draw(host(t, 'play')); }) || 0;
  screens++; drawn += audit(F, 'dv toast', () => { UI.setScreen('main'); U.toast = 'POWER UP'; U.toastUntil = Date.now() + 1e9; UI.draw(host(s, 'play')); U.toast = null; }) || 0;
}
ok(screens > 300 && drawn > 1000, `rendered ${screens} screens with ${drawn} text/icon draws`);

console.log('3) Fitting helpers keep the dot size');
{
  recs = [];
  I.drawTextFit(stubCtx, 'SLAYERDRAMON', 16, 36, 4, 32, 1, 5000);
  ok(recs.length === 1 && recs[0].kind === 'scroll' && recs[0].scale === 4 && recs[0].w === 32 * 4, 'long name scrolls in a 32-dot window at 4 px/dot (no shrink)');
  recs = [];
  I.drawTextFit(stubCtx, 'TAG', 40, 24, 4, 26, 0, 0);
  ok(recs.length === 1 && recs[0].kind === 'text' && recs[0].w === I.textDots('TAG', 0) * 4, 'short label drawn as-is');
  recs = [];
  I.drawText(stubCtx, '10:34', 16, 16, 4);
  ok(recs.length === 1 && recs[0].w === I.textDots('10:34', 1) * 4 && recs[0].h === 7 * 4, 'digits and colon are drawn by drawText (were silently dropped)');
}
const ui = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
ok(/function menuList\(I, list, selIdx\)/.test(ui) && /menuList\(I, battleMenuItems\(\), battleSel\)/.test(ui), 'DM20 SINGLE/TAG/LINK menu pages two rows at a time (was 3 overlapping rows)');
ok(/menuList\(I, \['DIGIMON', 'RECORD', 'TAMER', 'COPYMON'\], albumSel\)/.test(ui) && /menuList\(I, \['BATTLE', 'OTHER', 'COPYMON'\], connectSel\)/.test(ui), 'DM20 album / connect menus page (were 4 / 3 overlapping rows)');
ok(/drawTextFit\(ctx, nm, fx\(0\), fy\(5\), ITEM, FW/.test(ui), 'DM20 name page: one line, scrolls (SLAYERDRAMON no longer spills to a 3rd line)');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
