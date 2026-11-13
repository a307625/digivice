#!/usr/bin/env node
/**
 * Food submenu cursor: after feeding a pill, the cursor stays on
 * protein (the last-chosen item) and the menu comes back so the next
 * B feeds another pill. Official manuals we found do not spell this
 * out; this is the original-device pattern and the v27 fallback.
 * Applies to 1997, DM20, and Pendulum (same two-item meat/protein menu).
 */
'use strict';

const fs = require('fs');
const path = require('path');

global.PendulumData = require('../js/devices/pendulum/data.js');
const Eng = require('../js/devices/pendulum/engine.js');
global.PendulumEngine = Eng;
const UI = require('../js/devices/pendulum/ui.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

console.log('Food submenu cursor');
console.log('===================\n');

console.log('1) 1997 / DM20 ui.js: openFood no longer resets to meat; eat returns to food');
{
  const src = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
  // The openFood body must not assign foodSel = 0 (init and applyShot may).
  const openIdx = src.indexOf('function openFood');
  ok(openIdx > 0, 'openFood exists');
  const openBody = src.slice(openIdx, src.indexOf('function doFeed', openIdx));
  ok(!/foodSel\s*=\s*0/.test(openBody), 'openFood does not reset foodSel to meat');
  ok(/Keep the last-chosen/.test(openBody) || /last-chosen item/.test(openBody), 'openFood documents keep-last policy');
  ok(/returnToFood:\s*true/.test(src), 'successful feed sets returnToFood');
  ok(/eatAnim\.returnToFood/.test(src), 'eat-anim end checks returnToFood');
  const endIdx = src.indexOf('eatAnim.t >= maxT');
  const endBody = src.slice(endIdx, endIdx + 600);
  ok(/view = 'food'/.test(endBody), 'after the eat animation, view returns to food');
  ok(!/playPose\('happy'/.test(endBody.split('returnToFood')[1].split('else')[0] || ''), 'no happy pose on the return-to-food path that would leave the menu');
}

console.log('2) Pendulum: opening FEED keeps subSel; feeding protein leaves it on protein');
{
  const s = Eng.defaultState('pen_1_0');
  s.clockInitialized = true;
  s.mon = 'tentomon';
  s.hunger = 2;
  s.strength = 1;
  s.weight = 20;
  s.dpMaxQ = 16;
  s.dpQ = 8;
  s.dead = false;
  let view = 'play';
  const eatAnim = { on: false, t: 0, kind: 'meat', refused: false };
  const host = {
    state: s,
    view: 'play',
    profile: global.PendulumData.PROFILE,
    getSel: () => 1, // FEED is selectable[1]
    setSel: () => {},
    setView: (v) => { view = v; host.view = v; },
    persist: () => {},
    playPose: () => {},
    eatAnim: eatAnim,
    returnToFoodSoon: () => { view = 'food'; host.view = 'food'; }
  };
  // Open food — subSel must stay wherever it was (default 0 = meat, first open).
  eq(UI.getSubSel(), 0, 'fresh session starts on meat');
  ok(UI.pressB(host), 'open FEED');
  eq(view, 'food', 'food menu is open');
  eq(UI.getSubSel(), 0, 'first open is still meat (never yet chosen protein)');

  // Cycle to protein and feed.
  host.view = 'food';
  view = 'food';
  UI.pressA(host);
  eq(UI.getSubSel(), 1, 'A moves the cursor to protein');
  UI.pressB(host);
  eq(eatAnim.kind, 'protein', 'fed a pill');
  eq(eatAnim.returnToFood, true, 'Pendulum asks to return to the food menu');
  eq(UI.getSubSel(), 1, 'cursor is still on protein after feeding');

  // Re-open FEED (as if the user left and came back, or after anim).
  // subSel must NOT be forced to 0.
  host.view = 'play';
  host.setView('play');
  UI.pressB(host);
  eq(view, 'food', 'FEED re-opens the food menu');
  eq(UI.getSubSel(), 1, 're-opening FEED keeps the cursor on protein');

  // Feed again without pressing A.
  UI.pressB(host);
  eq(eatAnim.kind, 'protein', 'B again feeds another pill, no extra A');
  eq(UI.getSubSel(), 1, 'still on protein');
}

console.log('3) Cycling wraps meat ↔ protein; meat stays meat when that was last');
{
  UI.setSubSel(0);
  eq(UI.getSubSel(), 0, 'forced to meat');
  const host = { view: 'food', state: Eng.defaultState('pen_1_0'), profile: global.PendulumData.PROFILE };
  host.state.clockInitialized = true;
  host.state.mon = 'tentomon';
  UI.pressA(host);
  eq(UI.getSubSel(), 1, 'meat → protein');
  UI.pressA(host);
  eq(UI.getSubSel(), 0, 'protein → meat');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
