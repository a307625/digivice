#!/usr/bin/env node
'use strict';
/**
 * v33: shells keep their true aspect ratio.
 *  - every shell WebP's natural size (read from the file header) matches its
 *    family's layout aspect within 1% (screen/buttons are % of the art);
 *  - the shell box takes the art's natural size at load and the <img> never
 *    stretches (object-fit: contain);
 *  - Pendulum OG/ZERO art uses the v33 clean silhouette (no v30 cut-out).
 * The rendered-size check (box vs natural within 1% on iPhone 7 / SE /
 * 8 Plus / desktop) is /workspace/digivice-v33-hotfix/distort.js.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}
global.window = global;
['js/devices/registry.js', 'js/devices/pendulum/data.js', 'js/devices/pendulum/versions.js',
  'js/devices/pen20/data.js', 'js/devices/pen20/profiles.js', 'js/devices/digivice/data.js', 'js/devices/digivice/profiles.js']
  .forEach((f) => { try { require(path.join(ROOT, f)); } catch (e) {} });
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function aspectFrom(file, re) { const m = src(file).match(re); return m ? (+m[1]) / (+m[2]) : null; }
const FAM = {
  dm: aspectFrom('js/devices/registry.js', /aspectW:\s*(\d+),\s*aspectH:\s*(\d+)/),
  pen: aspectFrom('js/devices/pendulum/data.js', /aspectW:\s*(\d+),\s*aspectH:\s*(\d+)/),
  pen20: aspectFrom('js/devices/pen20/profiles.js', /aspectW:\s*(\d+),\s*aspectH:\s*(\d+)/),
  dv: aspectFrom('js/devices/digivice/profiles.js', /aspectW:\s*(\d+),\s*aspectH:\s*(\d+)/),
};
const dir = path.join(ROOT, 'icons/shell');
const shells = fs.readdirSync(dir).filter((f) => /\.webp$/.test(f) && !/^d3-/.test(f));
ok(shells.length >= 30, shells.length + ' shell WebPs found');
for (const f of shells) {
  const sz = webpSize(path.join(dir, f));
  ok(!!sz, f + ': readable WebP header');
  if (!sz) continue;
  const fam = /^pen-20th/.test(f) ? 'pen20' : /^pen-/.test(f) ? 'pen' : /^digivice/.test(f) ? 'dv' : 'dm';
  // v35: Pendulum versions on the round-4 shell use their own layout.
  const verKey = (f.match(/^pen-(\d)-(\d)\.webp$/) || []).slice(1).join('.');
  const PL = global.PendulumData && verKey && global.PendulumData.layoutFor ? global.PendulumData.layoutFor(verKey) : null;
  const want = PL ? PL.aspectW / PL.aspectH : FAM[fam];
  const err = Math.abs((sz.w / sz.h) / want - 1);
  ok(err < 0.01, `${f}: natural ${sz.w}x${sz.h} (${(sz.w / sz.h).toFixed(4)}) vs layout ${want.toFixed(4)} → ${(err * 100).toFixed(2)}% (< 1%)`);
}
const css = src('css/style.css'), ui = src('js/ui.js');
ok(/\.shell-art\s*\{[^}]*object-fit:\s*contain/.test(css), '.shell-art never stretches (object-fit: contain)');
ok(/\.device\s*\{[^}]*aspect-ratio:\s*var\(--shell-aw/.test(css) && /height:\s*auto/.test(css), '.device box is sized by aspect-ratio (one dimension auto)');
ok(/function syncShellAspect\(\)[\s\S]{0,400}naturalWidth[\s\S]{0,300}--shell-aw/.test(ui) && /addEventListener\('load', syncShellAspect\)/.test(ui), 'shell box takes the art’s natural size when it loads');
// Pendulum OG/ZERO: clean silhouette (v33) – file size dropped well below the v30 smeared cut-outs.
for (const f of shells.filter((s) => /^pen-(\d-\d|zero)\.webp$/.test(s))) {
  const n = fs.statSync(path.join(dir, f)).size;
  ok(n < 95000, `${f}: v33 clean-silhouette art (${n} bytes; v30 cut-out was ~100 KB)`);
}
// v35: round-4 shell (README coords) for Pendulum 1.0 and 1.5 only; 2.0+ keep v34.
{
  const D = global.PendulumData;
  ok(!!(D && D.LAYOUT_10 && D.layoutFor), 'PendulumData exports LAYOUT_10 / layoutFor');
  if (D && D.LAYOUT_10) {
    const L = D.LAYOUT_10, near = (a, b) => Math.abs(a - b) < 1e-9;
    ok(L.aspectW === 1329 && L.aspectH === 921, 'round-4 aspect 1329x921');
    ok(near(L.lcd.left, 17.908) && near(L.lcd.top, 36.265) && near(L.lcd.width, 31.076) && near(L.lcd.height, 29.425), 'round-4 LCD rect');
    ['a', 'b', 'c'].forEach((k, i) => ok(near(L.buttons[k].cx, 82.553) && near(L.buttons[k].cy, [28.282, 51.189, 74.096][i]) && near(L.buttons[k].w, 11.227) && near(L.buttons[k].h, 16.2), 'round-4 button ' + k));
    ok(near(L.buttons.reset.cx, 75.024) && near(L.buttons.reset.cy, 62.603) && near(L.buttons.reset.w, 5.957) && near(L.buttons.reset.h, 8.596), 'round-4 reset button');
    [17.908, 25.959, 34.011, 42.062].forEach((l, i) => {
      ok(near(L.icons_top[i].left, l) && near(L.icons_top[i].top, 30.51) && near(L.icons_top[i].width, 6.922) && near(L.icons_top[i].height, 5.646), 'round-4 top icon slot ' + i);
      ok(near(L.icons_bot[i].left, l) && near(L.icons_bot[i].top, 65.907) && near(L.icons_bot[i].width, 6.922) && near(L.icons_bot[i].height, 5.646), 'round-4 bottom icon slot ' + i);
    });
    ok(L.iconArt && L.iconArt.bgTop === '#badccc' && L.iconArt.bgBot === '#80a577', 'icon masks #badccc / #80a577');
    const names = L.names_top.concat(L.names_bot);
    ok(names.every((n) => L.iconArt.src[n] && fs.existsSync(path.join(ROOT, 'icons/bezel', L.iconArt.src[n] + '.png'))), 'every slot has v34 icon art in icons/bezel');
    ok(D.layoutFor('1.5') === L, '1.5 keeps the round-4 layout');
    const N = D.LAYOUT_NS;
    ok(D.layoutFor('1.0') === N, '1.0 uses the redrawn Nature Spirits shell');
    if (N) {
      ok(N.aspectW === 1260 && N.aspectH === 860, '1.0 shell is 1260x860');
      ok(near(N.lcd.left, 15.556) && near(N.lcd.top, 34.884) && near(N.lcd.width, 34.762) && near(N.lcd.height, 23.256), '1.0 LCD sits in the drawn glass');
      ok(near(N.buttons.a.cx, 81.746) && near(N.buttons.b.cy, 50) && near(N.buttons.c.cy, 68.837), '1.0 buttons sit on the three drawn buttons');
      ok(N.iconArt && N.iconArt.bgTop === '#c4d6c4' && N.iconArt.bgBot === '#7a9e70', '1.0 icon masks match the painted bands');
    }
    ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', 'zero'].forEach((k) => ok(D.layoutFor(k) === D.LAYOUT, k + ' keeps the v34 layout'));
    const R = global.Devices;
    if (R && R.profileById) {
      ok(R.profileById('pen-1-0') && R.profileById('pen-1-0').layout === D.LAYOUT_NS, 'registered pen-1-0 profile uses the redrawn shell');
      ok(R.profileById('pen-1-5') && R.profileById('pen-1-5').layout === L, 'registered pen-1-5 profile uses round-4 layout');
      ok(R.profileById('pen-2-0') && R.profileById('pen-2-0').layout === D.LAYOUT, 'registered pen-2-0 profile keeps v34 layout');
    }
  }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
