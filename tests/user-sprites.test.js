#!/usr/bin/env node
'use strict';
/**
 * v35: user sprite overrides (js/user-sprites.js).
 *  - file names <family>/<speciesId>_<frame>.png parse (ids may contain "_");
 *  - a PNG is used only when an integer scale maps it exactly onto the
 *    built-in sprite box (uniform dot size); otherwise logged + built-in;
 *  - missing files, bad names, a missing manifest fail gracefully;
 *  - renderers, index.html and sw.js are wired (offline precache).
 * The browser render check is /workspace/v35-tools/override-check.js.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
const US = require(path.join(ROOT, 'js/user-sprites.js'));
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// names
const p1 = US.parseName('dm1997/agumon_idle0.png');
ok(p1 && p1.family === 'dm1997' && p1.id === 'agumon' && p1.frame === 'idle0', 'parse dm1997/agumon_idle0.png');
const p2 = US.parseName('pendulum/egg_pen_1_0_idle1.png');
ok(p2 && p2.id === 'egg_pen_1_0' && p2.frame === 'idle1', 'species id with "_" splits at the last "_"');
ok(US.parseName('agumon_idle0.png') === null, 'no family folder -> rejected');
ok(US.parseName('dm1997/agumon idle0.png') === null, 'space -> rejected');
ok(US.parseName('dm1997/agumon_idle0.gif') === null, 'non-PNG -> rejected');
ok(US.parseName('../x/agumon_idle0.png') === null, 'path traversal -> rejected');

// integer scale onto the built-in box
ok(US.fitScale(16, 16, 64, 64) === 4, '16x16 -> 64x64 box: x4');
ok(US.fitScale(32, 32, 64, 64) === 2, '32x32 (stored 2x) -> 64x64: x2');
ok(US.fitScale(32, 16, 128, 64) === 4, '32x16 -> 128x64: x4');
ok(US.fitScale(16, 16, 64, 32) === 0, 'non-uniform scale rejected');
ok(US.fitScale(15, 16, 64, 64) === 0, 'non-integer scale rejected');
ok(US.fitScale(128, 128, 64, 64) === 0, 'larger than the box rejected (never shrinks)');
ok(US.fitScale(0, 16, 64, 64) === 0, 'zero size rejected');

function pattern(w, h) { // synthetic test checkerboard (not character art)
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, on = (x + y) % 2 === 0;
    d[i] = on ? 200 : 10; d[i + 1] = 30; d[i + 2] = on ? 40 : 220; d[i + 3] = on ? 255 : (x === 0 ? 100 : 0);
  }
  return d;
}

(async () => {
  US.reset();
  const pngs = {
    'dm1997/testmon_idle0.png': { w: 16, h: 16, data: pattern(16, 16) },
    'dm1997/testmon_eat1.png': { w: 15, h: 16, data: pattern(15, 16) },
    'pendulum/egg_pen_1_0_idle0.png': { w: 16, h: 16, data: pattern(16, 16) },
    'dm1997/huge_idle0.png': { w: 200, h: 200, data: pattern(200, 200) },
  };
  const manifest = { files: Object.keys(pngs).concat(['dm1997/missing_idle0.png', 'bad name.png', 42]) };
  const rep = await US.load({
    fetchJson: async (url) => { ok(url === './assets/user-sprites/manifest.json', 'manifest URL ' + url); return manifest; },
    loadPixels: async (url) => {
      const k = url.replace('./assets/user-sprites/', '');
      if (!pngs[k]) throw new Error('missing or not a PNG');
      return pngs[k];
    },
  });
  ok(rep.done, 'load() resolves');
  ok(rep.loaded.includes('dm1997/testmon_idle0.png') && rep.loaded.includes('pendulum/egg_pen_1_0_idle0.png'), 'valid files load: ' + rep.loaded.join(', '));
  ok(rep.errors.some((e) => /missing_idle0/.test(e.file) && /missing/.test(e.reason)), 'missing file logged');
  ok(rep.errors.some((e) => /bad name/.test(e.file)), 'bad file name logged');
  ok(rep.errors.some((e) => /^42$/.test(e.file)), 'non-string manifest entry logged');
  ok(rep.errors.some((e) => /huge_idle0/.test(e.file) && /native dot size/.test(e.reason)), 'oversized PNG logged');
  ok(!US.get('dm1997', 'huge', 'idle0'), 'oversized PNG not used');
  const e = US.get('dm1997', 'testmon', 'idle0');
  ok(e && e.w === 16 && e.h === 16, 'override stored at native size');
  ok(e && [...e.data].filter((_, i) => i % 4 === 3).every((a) => a === 0 || a === 255), 'alpha binarised (crisp dots)');
  ok(US.get('pendulum', 'testmon', 'idle0') === null, 'override is per device family');
  const c = US.canvasFor('dm1997', 'testmon', 'idle0', 64, 64, false);
  ok(c && c.width === 64 && c.height === 64 && c.scale === 4, 'canvasFor fills the built-in 64x64 box at x4');
  ok(US.canvasFor('dm1997', 'testmon', 'idle0', 64, 48, false) === null, 'box that cannot be filled evenly -> null (built-in used)');
  ok(US.log().some((l) => /does not scale evenly/.test(l.reason)), 'uneven box logged');
  US.canvasFor('dm1997', 'testmon', 'eat1', 64, 64, false);
  ok(US.log().some((l) => /testmon_eat1/.test(l.file) && /does not scale evenly/.test(l.reason)), '15x16 frame logged');
  ok(US.canvasFor('dm1997', 'nobody', 'idle0', 64, 64, false) === null, 'no override -> null');

  // frame fallback stays inside the user's own set (never mixes art)
  ok(US.get('dm1997', 'testmon', 'sleep1') === US.get('dm1997', 'testmon', 'idle0'), 'missing user frame falls back to the user idle0');
  { const cc = US.canvasFor('dm1997', 'testmon', 'eat1', 64, 64, false); ok(cc && cc.entry === US.get('dm1997', 'testmon', 'idle0'), 'wrong-size user frame falls back to the user idle0 (no mixing)'); }
  ok(US.getExact('dm1997', 'testmon', 'sleep1') === null, 'getExact does not fall back');
  ok(Object.keys(US.FALLBACK).every((k) => { const seen = {}; let f = k; while (f && !seen[f]) { seen[f] = 1; f = US.FALLBACK[f]; } return !f; }), 'fallback chains terminate (no loops)');
  const pui0 = src('js/devices/pendulum/ui.js');
  ok(/id === 'pen_egg' && host\.state && host\.state\.eggKind\) \? 'egg_' \+ host\.state\.eggKind/.test(pui0), 'Pendulum egg uses egg_<eggKind> user file first');

  // no manifest at all
  US.reset();
  const r2 = await US.load({ fetchJson: async () => { throw new Error('HTTP 404'); }, loadPixels: async () => { throw new Error('x'); } });
  ok(r2.done && r2.loaded.length === 0 && /404/.test(r2.manifestError || ''), 'missing manifest -> built-in sprites only');
  let fired = 0; US.onChange(() => fired++);
  await US.load({ fetchJson: async () => ({ files: [] }), loadPixels: async () => { throw new Error('x'); } });
  ok(fired === 1, 'onChange fires after load (renderer caches clear)');

  // wiring
  const ui = src('js/ui.js'), pui = src('js/devices/pendulum/ui.js'), sw = src('sw.js'), html = src('index.html');
  ok(/UserSprites[\s\S]{0,400}canvasFor\(famU, id, frameName/.test(ui), '1997/DM20 spriteCanvas checks overrides first');
  ok(/var key = \(\(currentDevice\(\)/.test(ui), 'sprite cache key includes the device family');
  ok(/UserSprites\.onChange\(function \(\) \{ cache = \{\}; \}\)/.test(ui) && /UserSprites\.load\(\)/.test(ui), 'ui loads overrides at boot and clears its cache');
  ok(/canvasFor\('pendulum', id, frame \|\| 'idle0', sp\.w \* sc, sp\.h \* sc/.test(pui), 'Pendulum blitMon checks overrides in the built-in box');
  ok(html.indexOf('js/user-sprites.js') > html.indexOf('js/sprites.js') && html.indexOf('js/user-sprites.js') < html.indexOf('js/ui.js'), 'index.html loads user-sprites.js before ui.js');
  ok(sw.includes("'./js/user-sprites.js'") && sw.includes("'./assets/user-sprites/manifest.json'"), 'sw precaches loader + manifest');
  ok(/precacheUserSprites\(cache\)/.test(sw) && /isUserSprite\(url\)/.test(sw), 'sw precaches listed PNGs and serves them network-first/offline');
  const m = JSON.parse(src('assets/user-sprites/manifest.json'));
  ok(Array.isArray(m.files), 'assets/user-sprites/manifest.json is valid ({"files": [...]})');
  ok(m.files.every((f) => US.parseName(f)), 'every manifest entry is a valid name');
  ok(fs.existsSync(path.join(ROOT, 'user-sprites-check.html')), 'debug page user-sprites-check.html exists');

  // guide + list stay in sync with the renderers
  const exp = JSON.parse(src('assets/user-sprites/expected.json'));
  const csvRows = src('docs/user-sprites-list.csv').replace(/^\ufeff/, '').trim().split(/\r?\n/).slice(1);
  ok(exp.files.length === exp.count && exp.files.length === csvRows.length && csvRows.length > 1000, 'CSV rows = expected.json files (' + csvRows.length + ')');
  ok(exp.files.every((f) => US.parseName(f)) && new Set(exp.files).size === exp.files.length, 'every expected name parses and is unique');
  ok(exp.files.every((f) => /^(dm1997|pendulum)\//.test(f)), 'expected names cover dm1997/ and pendulum/ only');
  global.window = global;
  require(path.join(ROOT, 'js/sprites.js')); require(path.join(ROOT, 'js/devices/pendulum/sprites.js'));
  ok(exp.files.every((f) => { const q = US.parseName(f); const A = q.family === 'dm1997' ? global.SpriteAtlas.SPRITES : global.PendulumSprites.SPRITES; return !!A[q.id] && A[q.id].w === 32 && A[q.id].h === 32; }), 'every listed species has a built-in 16x16-dot sprite (box the PNG must fit)');
  ['dm1997', 'pendulum'].forEach((fam) => ok(exp.files.some((f) => f.startsWith(fam + '/') && /_idle0\.png$/.test(f)), fam + ' has idle0 entries'));
  ok(fs.existsSync(path.join(ROOT, 'USER-SPRITES-GUIDE.md')) && src('USER-SPRITES-GUIDE.md') === src('docs/USER-SPRITES-GUIDE.md'), 'guide at repo root and docs/ (identical)');
  ok(/16×16/.test(src('USER-SPRITES-GUIDE.md')) && /manifest\.json/.test(src('USER-SPRITES-GUIDE.md')) && /Upload files/.test(src('USER-SPRITES-GUIDE.md')), 'guide covers size, manifest and GitHub web upload');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
