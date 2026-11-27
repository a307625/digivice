#!/usr/bin/env node
/**
 * v89: cold start already in landscape (iOS standalone PWA). The head script
 * read a stale portrait viewport, --app-h stuck at 667px and iOS sent no
 * resize, so the shell was sized too big until the phone was rotated.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
let passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.log('  FAIL  ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')'); }

console.log('1) head script: viewport vars can be re-measured');
const head = (html.match(/<script>\s*(\/\*[\s\S]*?\*\/\s*\(function \(\) \{[\s\S]*?__vpetFitViewport[\s\S]*?\}\)\(\);)\s*<\/script>/) || [])[1];
ok(!!head, 'inline viewport script found');
{
  const props = {}, listeners = {};
  const win = {
    innerWidth: 375, innerHeight: 667,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  const doc = { documentElement: { clientWidth: 0, clientHeight: 0, style: { setProperty: (k, v) => { props[k] = v; } } } };
  const timers = [];
  vm.runInNewContext(head, { window: win, document: doc, setTimeout: (f) => timers.push(f) });
  eq(props['--app-h'] + ' ' + props['--app-w'], '667px 375px', 'first read: the stale portrait size (as iOS reports it)');
  win.innerWidth = 667; win.innerHeight = 375;
  eq(win.__vpetFitViewport(), true, 're-measure sees the landscape size without any event');
  eq(props['--app-h'] + ' ' + props['--app-w'], '375px 667px', '--app-h / --app-w now landscape');
  eq(win.__vpetFitViewport(), false, 'no change → no style write');
  ok(!!listeners.resize && !!listeners.orientationchange, 'head script still listens itself (before ui.js loads)');
}

console.log('2) CSS sizes the shell from the measured viewport');
ok(/\.device \{[\s\S]*?width: min\(calc\(var\(--app-w, 100vw\) - 8px\), calc\(\(var\(--app-h, 100vh\) - 8px\)/.test(css), 'device width uses --app-w and --app-h');
ok(/#stage \{[\s\S]*?height: var\(--app-h, 100vh\);/.test(css), 'stage height uses --app-h');
ok(!/[^-]100dvh/.test(css), 'no dvh (iOS 15.0-15.3 has none)');

console.log('3) ui.js: one layout pass from every signal');
const bind = (ui.match(/function bindLayout\(\) \{[\s\S]*?\n  \}/) || [''])[0];
for (const ev of ["window.addEventListener('resize'", "window.addEventListener('orientationchange'", "window.visualViewport.addEventListener('resize'",
  "window.addEventListener('pageshow', relayoutAndSettle)", "window.addEventListener('load', relayoutAndSettle)", "document.addEventListener('visibilitychange', relayoutIfVisible)"]) {
  ok(bind.indexOf(ev) >= 0, 'listens: ' + ev);
}
ok(/new ResizeObserver/.test(bind) && /'lcd-window', 'device', 'stage'/.test(bind), 'ResizeObserver on the LCD window, device and stage');
ok(/relayout\(\);\s*settleLayout\(\);\s*\}$/.test(bind.trim().slice(0, -1).trim() + '}'), 'lays out at once and starts the settle schedule');
const settle = JSON.parse((ui.match(/var LAYOUT_SETTLE_MS = (\[[^\]]*\]);/) || [, '[]'])[1]);
ok(settle.length >= 6 && settle[0] === 0 && settle.some((v) => v >= 1000), 'settle passes over the first ~1 s and beyond: ' + settle.join(','));
const relayoutSrc = (ui.match(/function relayout\(\) \{[\s\S]*?\n  \}/) || [''])[0];
ok(/__vpetFitViewport\(\)/.test(relayoutSrc) && /sizeLcd\(\)/.test(relayoutSrc) && /updateRotateHint\(\)/.test(relayoutSrc), 'relayout = viewport vars + integer LCD fit + rotate hint');
ok(/function safeFrameStep\(\) \{[\s\S]{0,400}?\}\s*try \{ layoutWatch\(\); \} catch \(e\) \{\}\s*\}/.test(ui), 'per-frame size check runs from the frame loop');
ok(!/addEventListener\('resize', sizeLcd\)/.test(ui) && !/setTimeout\(sizeLcd, 350\)/.test(ui), 'old one-off sizeLcd listeners are gone');
ok(/bindLayout\(\);/.test(ui), 'bindLayout is called at start-up');

console.log('4) the watch re-lays out when the viewport settles with no event');
{
  const grab = (n) => (ui.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}')) || [''])[0];
  const src = ['viewportKey', 'lcdLayoutKey', 'relayout', 'layoutWatch'].map(grab).join('\n');
  const w = { innerWidth: 375, innerHeight: 667, devicePixelRatio: 2, visualViewport: { width: 375, height: 667 } };
  let fits = 0, sizes = 0, hints = 0, now = 0;
  w.__vpetFitViewport = () => { fits++; };
  const rect = { left: 10, top: 10, width: 100, height: 50 };
  const sandbox = { window: w, $: () => ({ getBoundingClientRect: () => rect }), sizeLcd: () => { sizes++; }, updateRotateHint: () => { hints++; },
    Date: { now: () => now } };
  vm.runInNewContext('var layoutRaf = 0, layoutKeyApplied = "", layoutWatchAt = 0, layoutBootAt = 0;\n' + src +
    '\nthis.relayout = relayout; this.layoutWatch = layoutWatch;', sandbox);
  sandbox.relayout();
  eq(sizes, 1, 'first pass');
  now = 16; sandbox.layoutWatch();
  eq(sizes, 1, 'nothing changed → no extra pass');
  w.innerWidth = 667; w.innerHeight = 375; w.visualViewport = { width: 667, height: 375 };
  now = 32; sandbox.layoutWatch();
  eq(sizes + '/' + fits + '/' + hints, '2/2/2', 'silent landscape settle → full relayout');
  rect.width = 120; now = 5000; sandbox.layoutWatch();
  eq(sizes, 3, 'LCD window moved later (after the first 3 s) → relayout');
  now = 5100; rect.width = 130; sandbox.layoutWatch();
  eq(sizes, 3, 'after 3 s the check is throttled to 250 ms');
  now = 5300; sandbox.layoutWatch();
  eq(sizes, 4, '…and still catches it');
}

console.log('5) the 1997 integer fit still lands whole device px at both orientations (iPhone 7)');
{
  const grab = (n) => (ui.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}')) || [''])[0];
  const sb = {}; vm.runInNewContext(grab('lcdIntegerSize') + grab('lcdPlace') + 'this.size = lcdIntegerSize; this.place = lcdPlace;', sb);
  for (const [l, t, w, h, k] of [[133.91, 149.44, 176.58, 87.41, 11], [48.95, 307.08, 122.56, 60.67, 7]]) {
    const f = sb.size(w, h, 32, 16, 2);
    const p = sb.place(l, t, w, h, f, 2);
    eq(f.k, k === 11 ? 10 : 7, 'dot = ' + (k === 11 ? 10 : 7) + ' device px (' + w + 'x' + h + ')');
    ok(Number.isInteger(+((l + p.left) * 2).toFixed(6)) && Number.isInteger(+((t + p.top) * 2).toFixed(6)), 'canvas on whole device px');
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
