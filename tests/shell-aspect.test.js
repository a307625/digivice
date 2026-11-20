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
  const err = Math.abs((sz.w / sz.h) / FAM[fam] - 1);
  ok(err < 0.01, `${f}: natural ${sz.w}x${sz.h} (${(sz.w / sz.h).toFixed(4)}) vs layout ${FAM[fam].toFixed(4)} → ${(err * 100).toFixed(2)}% (< 1%)`);
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
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
