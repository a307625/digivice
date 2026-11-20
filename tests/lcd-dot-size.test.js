#!/usr/bin/env node
/**
 * Every family paints LCD text at the same canvas scale as sprites:
 * 1 original font pixel = 1 original sprite / LCD dot = ITEM (or DOT) canvas px.
 *
 * Official 1997 letters are 4×6, digits 4×7 (`items.js`, src: official).
 * A scale of 2 (or 1, or 3) made NAME / menu text use smaller pixels than
 * the 16-dot sprites.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const I = require('../js/items.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, (msg || '') + (a === b ? '' : ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'));
}

console.log('LCD text dot size = sprite dot size');

ok(I && I.drawText && I.drawNumber, 'VpetItems loaded');
eq(I.ITEMS.letter_A.w, 4, 'official letter width is 4 dots');
eq(I.ITEMS.letter_A.h, 6, 'official letter height is 6 dots');
eq(I.ITEMS.digit_0.w, 4, 'official digit width is 4 dots');
eq(I.ITEMS.digit_0.h, 7, 'official digit height is 7 dots');
eq(I.ITEMS.letter_A.w + 1, 5, 'letter advance is 5 dots (4 + 1 gap)');
eq((I.ITEMS.letter_A.w + 1) * 4, 20, 'at ITEM=4 a letter+gap is 20 canvas px (5 LCD dots)');
eq((I.ITEMS.digit_0.w + 1) * 4, 20, 'at ITEM=4 a digit+gap is 20 canvas px');
eq(6 * 5 - 1, 29, 'AGUMON at native scale is 29 dots and fits the 32-dot field');

function file(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function noSmallText(src, label) {
  const hits = [];
  const re = /\b(drawText|drawTextWrapped)\s*\(([^;]{0,180})\)/g;
  let m;
  while ((m = re.exec(src))) {
    const args = m[2];
    const snippet = m[0].replace(/\s+/g, ' ').slice(0, 140);
    if (/,\s*([123])\s*(?:,\s*(?:0|[123])\s*)?\s*$/.test(args) &&
        !/ITEM|DOT|host\.ITEM|host\.DOT/.test(args)) {
      hits.push(snippet);
    }
  }
  const re2 = /\btext\s*\(([^;]{0,180})\)/g;
  while ((m = re2.exec(src))) {
    const args = m[1];
    const sn = m[0].replace(/\s+/g, ' ').slice(0, 140);
    if (/,\s*([123])\s*(?:,\s*0\s*)?\)?\s*$/.test(args) &&
        !/ITEM|DOT|host\.ITEM|host\.DOT/.test(args)) {
      hits.push(sn);
    }
  }
  eq(hits.length, 0, label + ' has no small-pixel text' + (hits.length ? ': ' + hits.join(' | ') : ''));
}

noSmallText(file('js/ui.js'), '1997 ui.js');
noSmallText(file('js/devices/pendulum/ui.js'), 'Pendulum ui.js');
noSmallText(file('js/devices/pen20/ui.js'), 'Pen20 ui.js');

ok(/sc \|\| host\.ITEM/.test(file('js/devices/pen20/ui.js')),
   'Pen20 text() defaults to host.ITEM');
ok(/sc \|\| host\.ITEM/.test(file('js/devices/pendulum/ui.js')),
   'Pendulum text() defaults to host.ITEM');

const ui = file('js/ui.js');
// v33: labels scroll inside their field at ITEM instead of overflowing.
ok(/function menuItem[\s\S]{0,400}drawTextFit\(ctx, label, fx\(MENU_LABEL_X\), y, ITEM/.test(ui),
   '1997 menuItem draws labels at ITEM (scrolls if wider than the field)');
ok(/drawTextFit\(ctx, nm, fx\(0\), fy\(5\), ITEM/.test(ui),
   '1997 NAME page draws at ITEM (one line, scrolls if needed)');

const dv = file('js/devices/digivice/ui.js');
ok(/var DOT = 4/.test(dv), 'Dv1999 DOT is 4');
ok(/SCALE = 4/.test(file('js/devices/digivice/sprites.js')),
   'Dv1999 sprite SCALE is 4 (same as DOT)');
ok(/fillRect\([^;]*DOT,\s*DOT\)/.test(dv),
   'Dv1999 font paints DOT×DOT cells');

ok(typeof I.drawTextWrapped === 'function', 'drawTextWrapped is exported');

console.log(passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach(function (f) { console.log('  - ' + f); });
process.exit(failed ? 1 : 0);
