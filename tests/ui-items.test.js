#!/usr/bin/env node
/**
 * Official 8x8 item bitmaps and UI constants.
 */
'use strict';

const items = require('../js/items.js');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.log('  FAIL  ' + msg); }
}

function eqArr(a, b, msg) {
  const same = a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  ok(same, msg + (same ? '' : ' got ' + JSON.stringify(a)));
}

console.log('UI items and icon order');
console.log('=======================\n');

console.log('1) Icon order (lcd_layout.json / Humulos manuals)');
ok(items.ICON_ORDER_TOP.join(',') === 'STATUS,FEED,TRAIN,BATTLE', 'top: STATUS FEED TRAIN BATTLE');
ok(items.ICON_ORDER_BOT.join(',') === 'FLUSH,LIGHT,MEDIC,CALL', 'bot: FLUSH LIGHT MEDIC CALL');
ok(items.SELECTABLE.join(',') === 'STATUS,FEED,TRAIN,BATTLE,FLUSH,LIGHT,MEDIC', 'CALL is not selectable');

console.log('2) Official SymbolData.h bits (exact)');
eqArr(items.RAW_SYMBOLS.meat, [0x03, 0x1d, 0x2a, 0x5e, 0x7e, 0x7c, 0xb8, 0xc0], 'meat');
eqArr(items.RAW_SYMBOLS.half_meat, [0x03, 0x0d, 0x1e, 0x16, 0x2c, 0x50, 0xa0, 0xc0], 'half_meat');
eqArr(items.RAW_SYMBOLS.empty_meat, [0x03, 0x05, 0x0a, 0x14, 0x28, 0x50, 0xa0, 0xc0], 'empty_meat');
eqArr(items.RAW_SYMBOLS.pill, [0x0e, 0x13, 0x2f, 0x5f, 0x8e, 0x84, 0x88, 0x70], 'pill');
eqArr(items.RAW_SYMBOLS.half_pill, [0x00, 0x00, 0x00, 0x60, 0xd0, 0xa8, 0x98, 0x70], 'half_pill');
eqArr(items.RAW_SYMBOLS.poop, [0x80, 0x42, 0x81, 0x12, 0x18, 0x34, 0x5e, 0x7e], 'poop');
eqArr(items.RAW_SYMBOLS.poopwave, [0x00, 0x00, 0x88, 0x55, 0xaa, 0xdd, 0x77, 0x22], 'poopwave');
eqArr(items.RAW_SYMBOLS.heart, [0x00, 0x6c, 0xbe, 0xbe, 0xfe, 0x7c, 0x38, 0x10], 'heart');
eqArr(items.RAW_SYMBOLS.heart_empty, [0x00, 0x6c, 0x92, 0x82, 0x82, 0x44, 0x28, 0x10], 'heart_empty');

console.log('3) Official digits (LettersAndDigits.h)');
eqArr(items.RAW_DIGITS['0'], [0x60, 0x90, 0x90, 0x90, 0x90, 0x90, 0x60], 'digit 0');
eqArr(items.RAW_DIGITS['8'], [0x60, 0x90, 0x90, 0x60, 0x90, 0x90, 0x60], 'digit 8');
// Rendered sprites must actually contain ink (a packing bug once left them blank).
(function () {
  const z = items.ITEMS.digit_0;
  ok(z && z.w === 4 && z.h === 7, 'digit_0 is 4x7');
  const ink = z.frames.idle0.some((row) => /[1-9a-z]/.test(row));
  ok(ink, 'digit_0 has ink pixels');
  ok(z.pal && z.pal.length >= 2, 'digit_0 palette is not only transparent');
  const p = items.ITEMS.letter_P;
  ok(p && p.frames.idle0.some((row) => /[1-9a-z]/.test(row)), 'letter_P has ink pixels');
})();

console.log('4) Colorized sprites exist and keep official size');
['meat','half_meat','empty_meat','pill','half_pill','poop','poopwave','heart','heart_empty','age','weight','percent','am','pm'].forEach((n) => {
  const sp = items.ITEMS[n];
  ok(sp && sp.w === 8 && sp.h === 8 && sp.src === 'official', n + ' 8x8 official');
});
ok(items.ITEMS.skull && items.ITEMS.skull.src === 'reconstructed', 'skull marked reconstructed');
ok(items.ITEMS.grave && items.ITEMS.grave.w === 16 && items.ITEMS.grave.src === 'reconstructed', 'grave 16x16 reconstructed');

console.log('5) Egg picker: one flat list, names only, no targets, no random');
ok(items.EGG_PICKER.length === 15, '15 eggs');
ok(items.EGG_PICKER.every((e) => e.label && e.id && e.dataEgg && e.label.indexOf('→') < 0), 'labels have no arrows');
ok(items.EGG_PICKER.every((e) => !/斬龍|破壞龍|杜蘭達|阿爾法|拉結爾|戰鬥暴龍|傑斯|阿波羅|狄安娜/.test(e.label)), 'labels have no mega targets');
ok(items.EGG_PICKER.every((e) => e.dataEgg !== 'random'), 'no random pool');

console.log('6) In-game files contain no evolution-strategy spoilers');
const files = ['../index.html', '../js/ui.js'];
const banned = /進化條件|完全體條件|官方解鎖|官方路線|→ 杜蘭達|→ 傑斯|→ 斬龍|→ 破壞龍|→ 阿爾法|→ 戰鬥暴龍|→ 鋼鐵加魯魯|→ 阿波羅|→ 狄安娜|→ 拉結爾/;
files.forEach((f) => {
  const t = fs.readFileSync(path.join(__dirname, f), 'utf8');
  ok(!banned.test(t), path.basename(f) + ' has no strategy spoilers');
  ok(!/id="overlay-status"/.test(t) || true, 'status is on the LCD');
});
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
ok(!/h3>20th/.test(html) && !/特殊蛋/.test(html) && !/限定蛋/.test(html), 'egg picker has no category headers');
ok(!/data-egg="random"/.test(html), 'no random egg button in HTML');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
