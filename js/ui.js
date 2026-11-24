/**
 * Official-device Digital Monster UI.
 * Button mapping, icon order, status pages, items and sleep rules:
 * see /workspace/ui-research/ui-spec.md.
 */
(function () {
  'use strict';

  var LCD_W = 160, LCD_H = 96, MON = 2;
  /* Official 1997 playfield is 32×16 dots. A 16-dot-tall monster is a 32×32
     cell drawn at MON=2, so 1 original dot = 4 canvas px. Items and glyphs
     use the same scale (ITEM=4). The 1997 / DM20 glass is that 2:1 field
     edge to edge (128×64). Other families keep a centered field on 160×96. */
  var DOT = 4;
  var FW = 32, FH = 16;
  var OX = 16, OY = 16;
  var ITEM = 4;
  var ANIM_MS = 500;  /* official 2 Hz LCD frame (firmware heartbeat) */
  var FLUSH_MS = 50;  /* flush is 10× the walk clock (berational) */
  function fx(d) { return OX + d * DOT; }
  function fy(d) { return OY + d * DOT; }
  var shotAnimAt = 0;
  var lastAnimAt = 0;
  var flushLastAt = 0;
  function animNow() {
    if (shotMode) return shotAnimAt;
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  function animTick() { return Math.floor(animNow() / ANIM_MS); }

  var SELECTABLE = (window.VpetItems && window.VpetItems.SELECTABLE) ||
    ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'];
  var SPEEDS = [1, 10, 60, 120, 600];
  var PAPER = '#c6cbb8';
  var NIGHT = '#10141c';
  var INK = '#1a1c16';

  var canvas, ctx;
  var state = null;
  var view = 'play';
  var sel = -1;
  var statusPage = 0;
  var foodSel = 0;
  var battleSel = 0;
  var frame = 0;
  var lastSave = 0;
  var lastKeyAt = 0;
  var shotMode = false;
  var cache = {};
  var scanTimer = null;
  var scanStream = null;
  var train = { t: 0, pos: 0, dir: 1, done: false, success: false };
  /* DM20 (Ver.20th) single training + single battle charge (v32).
     Bandai manual: the Digimon shows "!" and THEN you mash A; B does not
     count. Timed in real milliseconds (v31 counted rAF frames, so the window
     doubled to ~6.7 s when iOS throttled to 30 fps). Durations are not
     published: READY / WINDOW are PLACEHOLDER; battle charge 3 s follows the
     manual's "After 3 seconds, the battle will start" (tag charge). */
  var DM20_READY_MS = 800;
  var DM20_TRAIN_WINDOW_MS = 3000;
  var DM20_CHARGE_MS = 3000;
  var DM20_RESULT_MS = 1400;
  var charge = { on: false };
  var evoFx = { t: 0, from: '', to: '' };
  var battleFx = { t: 0, foe: '', result: '', active: false };
  var poseFx = { name: null, until: 0, extra: null };
  var eatAnim = { on: false, t: 0, kind: 'meat', refused: false };
  var flushAnim = { on: false, t: 0, n: 0, off: 0 };
  var walk = { x: 8, dir: -1 };
  var dyingT = 0;
  var motionOn = false;
  var pedometer = null;
  var healthAppliedThisSession = false;
  var soundOn = false;
  var audioCtx = null;
  var suppressClickBeep = false;
  var keyA = false, keyB = false, keyC = false;
  var chordAt = 0;

  var lightSel = 0;
  var albumSel = 0;
  var connectSel = 0;
  var albumPose = 0;

  var SHELL_LAYOUT = {
    lcd: { left: 12.249, top: 39.634, width: 33.4, height: 23.819 },
    buttons: {
      a: { cx: 81.459, cy: 26.422, w: 11.379, h: 16.393 },
      b: { cx: 81.459, cy: 50.53, w: 11.379, h: 16.393 },
      c: { cx: 81.459, cy: 72.71, w: 11.379, h: 16.393 },
      reset: { cx: 75.435, cy: 61.62, w: 4.819, h: 6.943 }
    },
    icons_top: [
      { left: 14.19, top: 29.315, width: 6.493, height: 7.425 },
      { left: 21.754, top: 29.219, width: 6.627, height: 7.522 },
      { left: 30.254, top: 29.026, width: 5.154, height: 7.811 },
      { left: 37.751, top: 29.026, width: 5.288, height: 7.907 }
    ],
    icons_bot: [
      { left: 14.659, top: 66.249, width: 5.556, height: 7.811 },
      { left: 23.025, top: 66.152, width: 4.016, height: 8.004 },
      { left: 29.987, top: 66.056, width: 5.689, height: 8.1 },
      { left: 37.483, top: 66.635, width: 6.225, height: 6.461 }
    ],
    names_top: ['STATUS', 'FEED', 'TRAIN', 'BATTLE'],
    names_bot: ['FLUSH', 'LIGHT', 'MEDIC', 'CALL']
  };

  var DM20_EGGS = {
    zuba: 'dm20-zuba', meicoo: 'dm20-zuba',
    corona: 'dm20-omega',
    luna: 'dm20-alpha', doru: 'dm20-alpha',
    hack: 'dm20-brown', dra_blue: 'dm20-brown', dra_green: 'dm20-brown',
    anime_agumon: 'dm20-brown', anime_gabumon: 'dm20-brown'
  };

  function syncLcdBox() {
    var d = currentDevice();
    var fam = d && d.family;
    var fill = fam === 'dm1997' || fam === 'dm20';
    var w = fill ? FW * DOT : 160;
    var h = fill ? FH * DOT : 96;
    var ox = fill ? 0 : 16;
    var oy = fill ? 0 : 16;
    var changed = LCD_W !== w || LCD_H !== h || OX !== ox || OY !== oy;
    LCD_W = w;
    LCD_H = h;
    OX = ox;
    OY = oy;
    if (canvas && (changed || canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      if (ctx) ctx.imageSmoothingEnabled = false;
    }
    var win = $('lcd-window');
    if (win) win.classList.toggle('is-dark', lcdGlassDark());
  }

  function currentDevice() {
    if (window.Devices && window.Devices.profileFor) {
      return window.Devices.profileFor(state);
    }
    var kind = (state && state.eggKind) || '';
    var ver = parseInt((state && state.version), 10);
    if (kind && DM20_EGGS[kind]) {
      return { family: 'dm20', shell: DM20_EGGS[kind], orient: 'landscape', version: 20 };
    }
    if (kind && /^ver[1-5]$/.test(String(kind))) ver = parseInt(String(kind).charAt(3), 10);
    if (!(ver >= 1 && ver <= 5)) ver = 1;
    return { family: 'dm1997', shell: 'dm1997-v' + ver, orient: 'landscape', version: ver };
  }

  function isPendulum() {
    var d = currentDevice();
    return !!(d && d.family === 'pendulum');
  }

  function isPen20() {
    var d = currentDevice();
    return !!(d && d.family === 'pen20');
  }

  function isDigivice() {
    var d = currentDevice();
    return !!(d && d.family === 'digivice');
  }

  function engine() {
    if (window.Devices && window.Devices.engineFor) return window.Devices.engineFor(state);
    return window.Engine;
  }

  function selectable() {
    var d = currentDevice();
    if (d && d.selectable) return d.selectable;
    if (d && d.family === 'dm20') {
      // Same printed icons as 1997. Album / Connect are not on this shell;
      // leaving them in the A cycle lit the battle icon after 治療.
      return ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'];
    }
    return ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'];
  }

  function statusPages() {
    var d = currentDevice();
    if (d && d.statusPages) return d.statusPages;
    if (d && d.family === 'dm20') {
      return ['name', 'age', 'hunger', 'strength', 'effort', 'dp', 'win'];
    }
    return ['age', 'hunger', 'strength', 'dp', 'win'];
  }

  function syncShellAspect() {
    var img = $('shell-art');
    if (!img || !img.naturalWidth || !img.naturalHeight || !img.complete) return;
    var rootEl = document.documentElement;
    rootEl.style.setProperty('--shell-aw', String(img.naturalWidth));
    rootEl.style.setProperty('--shell-ah', String(img.naturalHeight));
  }

  function applyShellLayout() {
    var d = currentDevice();
    var L = (d && d.layout) ? d.layout : SHELL_LAYOUT;
    var rootEl = document.documentElement;
    if (rootEl && L.lcd) {
      rootEl.style.setProperty('--lcd-l', L.lcd.left + '%');
      rootEl.style.setProperty('--lcd-t', L.lcd.top + '%');
      rootEl.style.setProperty('--lcd-w', L.lcd.width + '%');
      rootEl.style.setProperty('--lcd-h', L.lcd.height + '%');
    }
    if (rootEl && L.aspectW && L.aspectH) {
      rootEl.style.setProperty('--shell-aw', String(L.aspectW));
      rootEl.style.setProperty('--shell-ah', String(L.aspectH));
    }
    syncShellAspect(); // the loaded art's own size wins (v33)
    // Show only this model's printed-icon highlights. CONNECT is Pendulum's
    // 4th top icon; 1997/DM20 keep BATTLE in that slot.
    var shown = {};
    (L.names_top || []).concat(L.names_bot || []).forEach(function (n) { shown[n] = true; });
    document.querySelectorAll('.face-icon').forEach(function (el) {
      var id = el.getAttribute('data-icon');
      el.style.display = shown[id] ? '' : 'none';
    });
    var chamber = document.getElementById('pendulum-chamber');
    if (chamber) {
      if (L.chamber) {
        chamber.hidden = false;
        chamber.style.left = L.chamber.cx + '%';
        chamber.style.top = L.chamber.cy + '%';
        chamber.style.width = (L.chamber.r * 2) + '%';
        chamber.style.height = (L.chamber.r * 2 * (L.aspectW || 1600) / (L.aspectH || 1024)) + '%';
        // keep a circle: width in % of shell width; height must match in px — use aspect-ratio
        chamber.style.aspectRatio = '1 / 1';
        chamber.style.height = 'auto';
        chamber.style.width = (L.chamber.r * 2) + '%';
      } else {
        chamber.hidden = true;
      }
    }
    var fake = document.getElementById('btn-shake-fallback');
    if (fake) fake.hidden = !(d && (d.family === 'pendulum' || d.family === 'pen20' || d.family === 'digivice'));
    function placeIcon(id, box) {
      var el = document.getElementById('icon-' + id);
      if (!el || !box) return;
      el.style.left = box.left + '%';
      el.style.top = box.top + '%';
      el.style.width = box.width + '%';
      el.style.height = box.height + '%';
    }
    L.names_top.forEach(function (n, i) { placeIcon(n, L.icons_top[i]); });
    L.names_bot.forEach(function (n, i) { placeIcon(n, L.icons_bot[i]); });
    renderIconArt(L);
    function placePad(id, b) {
      var el = $(id);
      if (!el || !b) return;
      el.style.left = b.cx + '%';
      el.style.top = b.cy + '%';
      el.style.width = b.w + '%';
      el.style.height = b.h + '%';
    }
    placePad('btn-a', L.buttons.a);
    placePad('btn-b', L.buttons.b);
    placePad('btn-c', L.buttons.c);
    placePad('btn-reset', L.buttons.reset);
  }

  // v35: shells whose printed icon panel is masked (layout.iconArt) get the
  // icons drawn by the app: v34's own icon art over a panel-coloured mask.
  // Idle = faint, selected (.on) = full ink, CALL blinks at 2 Hz.
  function renderIconArt(L) {
    var art = L && L.iconArt;
    var top = {};
    (L && L.names_top || []).forEach(function (n) { top[n] = true; });
    document.querySelectorAll('.face-icon').forEach(function (el) {
      var id = el.getAttribute('data-icon');
      var old = el.querySelector('.icon-art');
      var file = art && art.src && art.src[id];
      if (!file) {
        if (old) old.parentNode.removeChild(old);
        el.classList.remove('has-art');
        return;
      }
      var row = top[id] ? 'row-top' : 'row-bot';
      if (!old || old.getAttribute('data-file') !== file || !old.classList.contains(row)) {
        if (old) old.parentNode.removeChild(old);
        old = document.createElement('div');
        old.className = 'icon-art ' + row;
        old.setAttribute('data-file', file);
        var im = document.createElement('img');
        im.src = './icons/bezel/' + file + '.png';
        im.alt = '';
        im.draggable = false;
        // v34's flush/medic/call PNGs carry small detached smudges under the
        // glyph (rows 54-61 of 64); clip them off (source files untouched).
        var clipBottom = { flush: 9.4, medic: 16, call: 17.2 }[file];
        if (clipBottom) im.style.clipPath = 'inset(0 0 ' + clipBottom + '% 0)';
        // mask (panel colour) + glyph box exactly on the slot
        var mask = document.createElement('div');
        mask.className = 'icon-mask';
        var glyph = document.createElement('div');
        glyph.className = 'icon-glyph';
        glyph.appendChild(im);
        old.appendChild(mask);
        old.appendChild(glyph);
        el.appendChild(old);
      }
      old.firstChild.style.background = top[id] ? art.bgTop : art.bgBot;
      el.classList.add('has-art');
    });
  }

  function sizeLcd() {
    var c = $('screen');
    if (!c) return;
    // CSS (height:100%; width:auto; max-width:100%) fills the official
    // window with contain + letterbox. Clear any stale inline size.
    c.style.width = '';
    c.style.height = '';
  }

  function tryLockOrient(orient) {
    try {
      if (window.screen && screen.orientation && typeof screen.orientation.lock === 'function') {
        var p = screen.orientation.lock(orient || 'landscape');
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }

  function updateRotateHint(need) {
    var el = $('rotate-hint');
    if (!el) return;
    if (shotMode) { el.classList.remove('show'); el.style.display = 'none'; return; }
    need = need || currentDevice().orient || 'landscape';
    el.setAttribute('data-need', need);
    el.style.display = '';
    var land = window.innerWidth >= window.innerHeight;
    var ok = (need === 'landscape') ? land : !land;
    el.classList.toggle('show', !ok);
  }

  var DV_PARTNER_SHELL = {
    agumon: 'digivice-v1', gabumon: 'digivice-yamato',
    piyomon: 'digivice-sora', tentomon: 'digivice-koushiro',
    palmon: 'digivice-mimi', gomamon: 'digivice-jou',
    patamon: 'digivice-takeru', tailmon: 'digivice-v2'
  };

  function applyShell() {
    syncLcdBox();
    var d = currentDevice();
    var dev = $('device');
    var img = $('shell-art');
    var shellName = d.shell;
    if (d && d.family === 'digivice' && state && window.DigiviceEngine) {
      var partner = window.DigiviceEngine.active(state);
      var starter = partner && (partner.starter || partner.mon);
      if (starter && DV_PARTNER_SHELL[starter]) shellName = DV_PARTNER_SHELL[starter];
    }
    var src = './icons/shell/' + shellName + '.webp';
    if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
    // v33: the shell box always takes the art's own aspect ratio, so the
    // shell is scaled uniformly (never stretched) even if a profile's
    // aspect constants drift from the WebP; screen/buttons are % of it.
    if (img && !img.__aspectHook) {
      img.__aspectHook = true;
      img.addEventListener('load', syncShellAspect);
    }
    syncShellAspect();
    if (dev) {
      dev.setAttribute('data-model', d.family);
      dev.setAttribute('data-shell', d.shell);
      dev.setAttribute('data-orient', d.orient);
      dev.setAttribute('data-buttons', d.buttonStyle || '');
    }
    applyShellLayout();
    var c = $('screen');
    if (c) {
      if (d && d.family === 'digivice') {
        if (c.width !== 144 || c.height !== 144) { c.width = 144; c.height = 144; }
      } else if (c.width !== 160 || c.height !== 96) {
        c.width = 160; c.height = 96;
      }
    }
    var ba = $('btn-a'), bb = $('btn-b'), bc = $('btn-c');
    if (d && d.family === 'digivice') {
      if (ba) ba.setAttribute('aria-label', '左（A）決定');
      if (bb) bb.setAttribute('aria-label', '右上 選擇');
      if (bc) bc.setAttribute('aria-label', '右下 返回');
    } else {
      if (ba) ba.setAttribute('aria-label', 'A 選擇');
      if (bb) bb.setAttribute('aria-label', 'B 決定');
      if (bc) bc.setAttribute('aria-label', 'C 取消');
    }
    tryLockOrient(d.orient);
    updateRotateHint(d.orient);
    sizeLcd();
  }

  /* v33: cursor ink is 4 dots (cols 1-4); the label starts at col 6 and
     owns cols 6-31 (26 dots). Same dot size as everything else; a label that
     is wider scrolls sideways while selected (clipped at its start
     otherwise) instead of running off the 32x16 LCD. */
  var MENU_LABEL_X = 6, MENU_LABEL_DOTS = FW - 6;
  function menuItem(I, selected, y, label) {
    blitItem(selected ? 'triangle' : 'empty_triangle', fx(1), y, ITEM);
    if (!I) return;
    if (I.drawTextFit) I.drawTextFit(ctx, label, fx(MENU_LABEL_X), y, ITEM, MENU_LABEL_DOTS, 0, selected ? animNow() : 0);
    else if (I.drawText) I.drawText(ctx, label, fx(MENU_LABEL_X), y, ITEM, 0);
  }
  /* Two 6-dot rows fit the 16-dot LCD (rows 2-7 and 10-15). Longer lists
     page two at a time, following the cursor, like the real menus. */
  function menuList(I, list, selIdx) {
    var page = Math.floor(Math.max(0, selIdx) / 2) * 2;
    for (var r = 0; r < 2 && page + r < list.length; r++) {
      menuItem(I, selIdx === page + r, fy(r === 0 ? 2 : 10), list[page + r]);
    }
  }


  function $(id) { return document.getElementById(id); }
  function items() { return window.VpetItems; }
  function mon() { return (window.EvolutionData.MONSTERS[state && state.mon]) || null; }

  function toast(msg, ms) {
    var b = $('banner');
    if (!b) return;
    b.textContent = msg;
    b.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      if (b.textContent === msg) b.classList.add('hidden');
    }, ms || 1800);
  }

  function showOverlay(id, on) {
    var el = $(id);
    if (!el) return;
    if (on) el.classList.add('show');
    else el.classList.remove('show');
    if (id === 'overlay-battle') {
      if (on) startLobby();
      else stopLobby();
    }
  }
  function hideAllOverlays() {
    var battle = $('overlay-battle');
    var lobbyOpen = battle && battle.classList.contains('show');
    document.querySelectorAll('.overlay').forEach(function (el) { el.classList.remove('show'); });
    stopScan();
    if (lobbyOpen) stopLobby();
  }
  function anyOverlay() {
    return !!document.querySelector('.overlay.show');
  }

  function soundEnabled() {
    // The original device mute (Pendulum A+C sound Off, or the settings
    // toggle which shares this flag) is authoritative. Never beep over it.
    if (state && state.soundMuted) return false;
    return !!soundOn;
  }
  function unlockAudio() {
    if (window.DeviceAudio) window.DeviceAudio.unlock();
  }
  function beep() {
    if (suppressClickBeep) { suppressClickBeep = false; return; }
    if (!soundEnabled()) return;
    if (window.DeviceAudio) { window.DeviceAudio.beep(true); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.value = 0.045;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  function playPose(name, ms, extra) {
    poseFx = { name: name, until: performance.now() + (ms || 1000), extra: extra || null, started: performance.now() };
  }

  function decodeIndex(ch) {
    if (window.SpriteAtlas && window.SpriteAtlas.decodeIndex) return window.SpriteAtlas.decodeIndex(ch);
    var n = parseInt(ch, 36);
    return isNaN(n) ? 0 : n;
  }

  function spriteCanvas(id, frameName, scale, flip) {
    scale = scale || 1;
    var key = ((currentDevice() && currentDevice().family) || '') + ':' + id + ':' + (frameName || 'idle0') + ':' + scale + ':' + (flip ? 1 : 0);
    if (cache[key]) return cache[key];
    var atlas = window.SpriteAtlas;
    if (!atlas || !atlas.SPRITES[id]) return null;
    var sp = atlas.SPRITES[id];
    var fr = frameName;
    if (!sp.frames[fr]) {
      if (fr === 'sleep1') fr = 'sleep0';
      else if (fr === 'sleep0' && sp.frames.sleep) fr = 'sleep';
      else if (fr === 'eat1') fr = 'eat0';
      else if (fr === 'train1') fr = 'train0';
      else if (fr === 'train0' && sp.frames.attack) fr = 'attack';
      else if (fr === 'sick' && sp.frames.hurt) fr = 'hurt';
      else if (fr === 'lose' && sp.frames.hurt) fr = 'hurt';
      else if (fr === 'hatch' && sp.frames.idle1) fr = 'idle1';
      else fr = 'idle0';
    }
    if (!sp.frames[fr]) fr = 'idle0';
    // DM20 artbook mons store the same official action cell as eat0 and
    // eat1. Play official idle (closed) as eat0 so the 2 Hz bite alternates
    // with the official open/action cell. Official pixels are not retouched.
    if (frameName === 'eat0' && sp.frames.eat0 && sp.frames.eat1 && sp.frames.idle0 &&
        framesEqual(sp.frames.eat0, sp.frames.eat1) &&
        !framesEqual(sp.frames.eat0, sp.frames.idle0)) {
      fr = 'idle0';
    }
    var shiftSleep = false;
    if (frameName === 'sleep1' && sp.frames.sleep0 &&
        (!sp.frames.sleep1 || framesEqual(sp.frames.sleep1, sp.frames.sleep0))) {
      fr = 'sleep0';
      shiftSleep = true;
    }
    // v35: a user PNG (assets/user-sprites/<family>/<id>_<frame>.png) for the
    // requested frame, else for the resolved frame, replaces the built-in one
    // in the same box at the same dot size.
    var US = window.UserSprites;
    if (US) {
      var famU = (currentDevice() && currentDevice().family) || 'dm1997';
      var userC = US.canvasFor(famU, id, frameName || 'idle0', sp.w * scale, sp.h * scale, flip);
      if (userC) { cache[key] = userC; return userC; }
    }
    var img = atlas.renderToImageData(sp, fr, 1);
    var w = sp.w, h = sp.h;
    var out = document.createElement('canvas');
    out.width = w * scale;
    out.height = h * scale;
    var o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    if (flip) {
      o.translate(out.width, 0);
      o.scale(-1, 1);
    }
    // Official sleep1 is a 1-px shift of sleep0 when only one sleep cell exists.
    if (shiftSleep) o.drawImage(img, 0, 1 * scale, out.width, out.height);
    else o.drawImage(img, 0, 0, out.width, out.height);
    cache[key] = out;
    return out;
  }

  function blitMon(id, x, y, scale, frameName, flip) {
    var c = spriteCanvas(id, frameName, scale || MON, flip);
    if (c) ctx.drawImage(c, Math.round(x), Math.round(y));
  }

  function blitItem(name, x, y, scale, flip) {
    if (items()) items().blit(ctx, name, x, y, scale != null ? scale : ITEM, flip);
  }

  function framesEqual(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length !== b.length) return false;
    var i;
    for (i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Official 1997 eat: 5 meat frames at 2 Hz — full, full lowered, half,
  // half, empty — which is three bites. Protein is 4 frames (pill, pill
  // lowered, pill, half-pill). Shared with Pendulum and Pen20 via penHost.
  function eatFoodSprite(anim) {
    anim = anim || eatAnim;
    if (!anim || !anim.on || anim.refused) return null;
    var phase = anim.t;
    var kind = anim.kind;
    var food = 'meat';
    if (kind === 'protein') {
      food = phase >= 3 ? 'half_pill' : 'pill';
    } else {
      if (phase >= 4) food = 'empty_meat';
      else if (phase >= 2) food = 'half_meat';
      else food = 'meat';
    }
    return { food: food, xDots: 24, yDots: (phase === 0) ? 0 : 8 };
  }

  function idleFrame() {
    return (animTick() % 2) ? 'idle1' : 'idle0';
  }

  function monFrame() {
    if (!state) return 'idle0';
    if (state.dead && view !== 'dying') return 'lose';
    if (state.sleeping) return (animTick() % 2) ? 'sleep1' : 'sleep0';
    if (poseFx.name && performance.now() < poseFx.until) {
      if (poseFx.name === 'sleep') return (animTick() % 2) ? 'sleep1' : 'sleep0';
      if (poseFx.name === 'eat') return (animTick() % 2) ? 'eat1' : 'eat0';
      if (poseFx.name === 'happy') return 'happy';
      // Classic brick: angry alternates with the walk frame. A frozen roar is not the fail pose.
      if (poseFx.name === 'angry') return (animTick() % 2) ? 'angry' : 'idle0';
      if (poseFx.name === 'refuse') return 'refuse';
    } else if (poseFx.name && performance.now() >= poseFx.until) {
      poseFx = { name: null, until: 0, extra: null };
    }
    if (eatAnim.on && !eatAnim.refused) {
      return (eatAnim.t % 2) ? 'eat1' : 'eat0';
    }
    if (state.injured) {
      // Injured 1 / Injured 2. Do not cut back to the standing walk.
      return (animTick() % 2) ? 'hurt' : 'sick';
    }
    return idleFrame();
  }

  function isCalling() {
    var E = engine();
    if (E && E.isCallLit) return E.isCallLit(state);
    if (!state || state.dead) return false;
    if (state.hunger <= 0 || state.strength <= 0) return true;
    if (state.sleeping && state.lights && state.callLightsAt != null) return true;
    return false;
  }

  function sizeLcd() {
    if (!canvas) return;
    var well = document.querySelector('.lcd-well');
    if (!well) return;
    var aw = well.clientWidth, ah = well.clientHeight;
    var s = Math.max(1, Math.floor(Math.min(aw / LCD_W, ah / LCD_H)));
    canvas.style.width = (LCD_W * s) + 'px';
    canvas.style.height = (LCD_H * s) + 'px';
  }

  // 1997 lamp-off stays on the playfield. Sleep is the clock, not the lamp.
  // A dim is drawn over the scene so the lamp state is visible.
  // DM20 does not go dark; the sleep cell and a Z stay visible when sleeping.
  function lcdGlassDark() {
    var d = currentDevice();
    var fam = d && d.family;
    if (fam === 'dm1997' || fam === 'dm20') return is1997PlayDark();
    // Pendulum lamp-off paints a black LCD. The letterbox has to match.
    if (fam === 'pendulum' && view === 'play') {
      var LO = (typeof window !== 'undefined' && window.LightsOff) || null;
      if (LO && LO.playfieldMode) {
        var mode = LO.playfieldMode(state, view, 'pendulum');
        return mode === 'black' || mode === 'black-z';
      }
    }
    return false;
  }
  function is1997PlayDark() {
    var d = currentDevice();
    var fam = d && d.family;
    var LO = (typeof window !== 'undefined' && window.LightsOff) || (typeof globalThis !== 'undefined' && globalThis.LightsOff);
    if (LO && LO.playfieldMode) {
      return LO.playfieldMode(state, view, fam) === 'blank-dark';
    }
    return !!(state && !state.lights && view === 'play' && fam === 'dm1997');
  }
  function isClockSetView() {
    var E = engine();
    return !!(state && E && E.isClockSet && E.isClockSet(state));
  }
  // 1997 cardboard behind the LCD, one day scene per version.
  // Same five cards as the COLOR backgrounds: Ver.1 野原, Ver.2 荒野,
  // Ver.3 森林, Ver.4 高原, Ver.5 海岸. 32×16 dots, playfield grid.
  var DM1997_BG = {
    1: { pal: ['#87c8ee', '#f4fbff', '#6d8eb8', '#8dce6a', '#4eae45', '#2f7a32'], rows: [
      '00000011110000000000011110000000',
      '00000111111000000000111111000000',
      '00000011110000000000011110000000',
      '00000000000000000000000000000000',
      '00002222220000000022222200000000',
      '00222222222200022222222222000000',
      '22222222222222222222222222222222',
      '33333333333333333333333333333333',
      '33343333333433333334333333343333',
      '33333333333333333333333333333333',
      '44444444444444444444444444444444',
      '44454444444444544444444444454444',
      '44444444444444444444444444444444',
      '44444445444444444445444444444444',
      '55555555555555555555555555555555',
      '44444444444444444444444444444444'
    ]},
    2: { pal: ['#79c8ee', '#fff6d0', '#d2a86a', '#a07840', '#e8d7a4', '#c4a56a'], rows: [
      '00000011111000000000000000000000',
      '00000111111110000000000000000000',
      '00000011111000000000000000000000',
      '00000000000000000000000000000000',
      '22222000000000000000000000222222',
      '33322200000000000000000002222333',
      '33333220000000000000000222233333',
      '44444330000000000000003333444444',
      '44444444000000000000444444444444',
      '44444444440000000044444444444444',
      '55555555544000004455555555555555',
      '44444444444444444444444444444444',
      '44444444454444444445444444444444',
      '44444444444444444444444444444444',
      '55555555555555555555555555555555',
      '44444444444444444444444444444444'
    ]},
    3: { pal: ['#b7e4f4', '#d7ef78', '#3e9a48', '#1f5e30', '#8dce6a', '#3f8a40'], rows: [
      '00000000000000000000000000000000',
      '11122211100000000000111222111111',
      '22112211220000000000221122112222',
      '22222222222000000000222222222222',
      '33222332223000000000332223322233',
      '33333333333000000000333333333333',
      '33333333333400000043333333333333',
      '44444444444400004444444444444444',
      '44444444444444444444444444444444',
      '55544444444444444444444444455555',
      '44455544444444444444444455544444',
      '44444444444444444444444444444444',
      '44445444444444444444444445444444',
      '44444444444444444444444444444444',
      '55555555555555555555555555555555',
      '44444444444444444444444444444444'
    ]},
    4: { pal: ['#8ec8ea', '#f7fbff', '#8aa0b4', '#6a9a62', '#3e6e48', '#b7c4a4'], rows: [
      '00000000000000000000000000000000',
      '00000111000000000000111000000000',
      '00001111110000000011111100000000',
      '00111111111000011111111110000000',
      '01111222111102211112221111000000',
      '33322222221122222222222222333333',
      '33333222222222222222222233333333',
      '44444333222222222222223334444444',
      '44444444333333333333334444444444',
      '55544444444444444444444444444555',
      '55555544444444444444444444555555',
      '55555555555555555555555555555555',
      '55555555545555555554555555555555',
      '55555555555555555555555555555555',
      '55545555555555555555555555545555',
      '55555555555555555555555555555555'
    ]},
    5: { pal: ['#b7e3f6', '#f4fbff', '#3aa0d0', '#7ec8e8', '#f0e2b8', '#d7c48a'], rows: [
      '00000011110000000000111100000000',
      '00000111111000000001111110000000',
      '00000011110000000000111100000000',
      '00000000000000000000000000000000',
      '22222222222222222222222222222222',
      '33333333333333333333333333333333',
      '22222222222222222222222222222222',
      '33333333333333333333333333333333',
      '22222222222222222222222222222222',
      '44444444444444444444444444444444',
      '54444444444444444444444444444445',
      '44444444444444444444444444444444',
      '44454444444444454444444444454444',
      '44444444444444444444444444444444',
      '55555555555555555555555555555555',
      '44444444444444444444444444444444'
    ]}
  };

  function draw1997Backdrop() {
    var ver = parseInt(state && state.version, 10);
    if (ver < 1 || ver > 5) ver = 1;
    var bg = DM1997_BG[ver];
    var y, x, row;
    for (y = 0; y < 16; y++) {
      row = bg.rows[y];
      for (x = 0; x < 32; x++) {
        ctx.fillStyle = bg.pal[row.charCodeAt(x) - 48];
        ctx.fillRect(x * DOT, y * DOT, DOT, DOT);
      }
    }
    ctx.fillStyle = 'rgba(20, 30, 20, 0.05)';
    for (y = 0; y < LCD_H; y += 2) ctx.fillRect(0, y, LCD_W, 1);
  }

  function lcdBg() {
    var blank = is1997PlayDark();
    var fam = currentDevice() && currentDevice().family;
    if (blank) {
      ctx.fillStyle = NIGHT;
      ctx.fillRect(0, 0, LCD_W, LCD_H);
      return;
    }
    if (fam === 'dm1997') {
      draw1997Backdrop();
      return;
    }
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, LCD_W, LCD_H);
    ctx.fillStyle = 'rgba(80, 86, 70, 0.07)';
    for (var y = 0; y < LCD_H; y += 2) ctx.fillRect(0, y, LCD_W, 1);
    ctx.fillStyle = 'rgba(70, 80, 55, 0.18)';
    ctx.fillRect(0, LCD_H - 3, LCD_W, 3);
  }
  function drawSleepZ() {
    if (!state || !state.sleeping) return;
    var fam = currentDevice().family;
    if (fam !== 'dm20' && fam !== 'dm1997') return;
    var I = items();
    if (!I || !I.drawText) return;
    var mx = fx(Math.floor((FW - 16) / 2));
    if (fam === 'dm1997') {
      // 1997: one Z over the head. It swaps height on the 2 Hz clock (big / small).
      var big = (animTick() % 2) === 0;
      I.drawText(ctx, 'Z', mx + 14 * DOT, fy(big ? 0 : 1), ITEM);
      return;
    }
    // DM20: "A big Z will appear over the Digimon's head" (WTW / Humulos Z's).
    I.drawText(ctx, 'Z', mx + 14 * DOT, fy(0), ITEM);
    I.drawText(ctx, 'Z', mx + 18 * DOT, fy(2), ITEM); // cols 26-30: inside the 32-dot LCD
  }

  function poopCount() {
    return flushAnim.on ? flushAnim.n : Math.min(8, (state && state.poop) || 0);
  }

  function poopCols() {
    return Math.ceil(poopCount() / 2);
  }

  /* Ver.1–5 share this system graphic (not a per-version minigame).
     Piles: lower row y=8, upper row y=0, columns from the right.
     Flush: piles slide down, and a column of waves scrolls in front
     of them, 1 dot / 50 ms, until they leave the 16-dot glass. */
  function drawPoop() {
    if (!state && !flushAnim.on) return;
    var n = poopCount();
    if (n <= 0) return;
    var off = flushAnim.on ? flushAnim.off : 0;
    // Sitting poop wiggles. During a flush the scroll is the motion;
    // mirroring the wave makes the water flip instead of flow.
    var flip = !flushAnim.on && (animTick() % 2) === 1;
    var pw = 8;
    var cols = Math.ceil(n / 2);
    var i, c, t, x, y, wy;
    for (i = 0; i < n; i++) {
      c = Math.floor(i / 2);
      x = FW - pw - pw * c;
      y = ((i % 2 === 0) ? pw : 0) + off;
      if (y < FH) blitItem('poop', fx(x), fy(y), ITEM, flip);
    }
    if (!flushAnim.on) return;
    for (c = 0; c < cols; c++) {
      x = FW - pw - pw * c;
      for (t = -1; t <= 2; t++) {
        wy = t * pw + (off % pw);
        if (wy > -pw && wy < FH) blitItem('poopwave', fx(x), fy(wy), ITEM, false);
      }
    }
  }

  function isEggStage() {
    if (!state) return false;
    try {
      var E = engine();
      var m = E && E.mon && E.mon(state);
      if (m && m.stage === 'egg') return true;
    } catch (e) {}
    var id = String(state.mon || '');
    return id === 'pen_egg' || id.indexOf('egg_') === 0;
  }

  function walkUpdate() {
    if (!state || state.dead || state.sleeping || state.injured || isCalling() || poseFx.name || eatAnim.on || flushAnim.on) return;
    if (view !== 'play') return;
    // 1997 egg: two frames rock it by one dot, in the center. It does not
    // patrol the glass the way a hatched Digimon does. Same on DM20.
    if (isEggStage()) {
      walk.x = 8;
      walk.dir = -1;
      return;
    }
    var monW = 16;
    var maxX = Math.max(0, FW - monW - poopCols() * 8);
    var minX = 0;
    walk.x += walk.dir;
    if (walk.x <= minX) { walk.x = minX; walk.dir = 1; }
    if (walk.x >= maxX) { walk.x = maxX; walk.dir = -1; }
  }

  function drawMonAt(x, y, fr, flip) {
    if (!state || !state.mon) return;
    blitMon(state.mon, x, y, MON, fr, flip);
    if (state.injured && view !== 'dying' && view !== 'grave' && !state.dead) {
      var bob = (animTick() % 2) ? DOT : 0;
      blitItem('skull', x + 8 * DOT, y + bob, ITEM);
    }
  }

  function drawPlay() {
    lcdBg();
    if (!state) return;
    if (is1997PlayDark()) return; // blank dark LCD: no mon, poop, or Z
    if (state.dead && view !== 'dying') {
      drawGrave();
      return;
    }
    var fr = monFrame();
    var monW = 16;
    var my = fy(0);
    var mx = fx(walk.x);
    var flip = false;
    var calling = isCalling() && !state.sleeping && !eatAnim.on && !poseFx.name && !state.injured;
    if (isEggStage()) {
      mx = fx(8);
      flip = false;
    } else if (state.sleeping) {
      mx = fx(Math.floor((FW - monW) / 2));
      flip = false;
    } else if (eatAnim.on) {
      // Official: Digimon at 32-8-16=8, facing the food at x=24
      mx = fx(8);
      flip = true;
    } else if (poseFx.name === 'refuse') {
      flip = (animTick() % 2) === 1;
      mx = fx(Math.floor((FW - monW) / 2));
    } else if (poseFx.name) {
      mx = fx(Math.floor((FW - monW) / 2));
      flip = false;
    } else if (state.injured || calling) {
      // Sick, or the attention hop: stay put. A call lifts the sprite one dot.
      mx = fx(Math.floor((FW - monW) / 2));
      flip = false;
      if (calling && (animTick() % 2) === 1) my = fy(0) - DOT;
    } else {
      flip = walk.dir > 0;
    }
    if (view === 'dying') {
      mx = fx(Math.floor((FW - monW) / 2));
      fr = 'lose';
      flip = false;
    }
    drawMonAt(mx, my, fr, flip);

    if (eatAnim.on && !eatAnim.refused) {
      var food = eatFoodSprite(eatAnim);
      if (food) blitItem(food.food, fx(food.xDots), fy(food.yDots), ITEM, false);
    }
    drawPoop();
    drawSleepZ();
    // Lamp off: dim the glass. The pose stays whatever the clock chose.
    if (state.lights === false && currentDevice().family === 'dm1997') {
      ctx.fillStyle = 'rgba(16, 20, 28, 0.28)';
      ctx.fillRect(0, 0, LCD_W, LCD_H);
    }
  }

  function drawClock() {
    lcdBg();
    if (!state) return;
    var setting = isClockSetView();
    var sec = window.Engine.clockSeconds(state);
    var h24 = Math.floor(sec / 3600);
    var min = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    var isAM = h24 < 12;
    var h = h24 % 12;
    if (h === 0) h = 12;
    var I = items();
    // Official SET: the word SET is solid; hour, minute, and AM/PM blink
    // at 2 Hz (ANIM_MS). Triangles (running seconds) are hidden. Colon stays.
    // Screenshots force the digits visible so the frame is readable.
    var blinkOn = !setting || shotMode || (animTick() % 2) === 0;
    if (setting) I.drawText(ctx, 'SET', fx(14), fy(10), ITEM);
    if (blinkOn) blitItem(isAM ? 'am' : 'pm', fx(0), fy(8), ITEM);
    var dx = fx(8);
    var dy = fy(2);
    if (blinkOn) I.drawNumber(ctx, h, dx, dy, ITEM, 2);
    dx += 5 * ITEM * 2;
    ctx.fillStyle = INK;
    ctx.fillRect(dx, dy + 1 * ITEM, DOT, DOT);
    ctx.fillRect(dx, dy + 5 * ITEM, DOT, DOT);
    dx += 2 * ITEM;
    if (blinkOn) I.drawNumber(ctx, min, dx, dy, ITEM, 2);
    if (setting) return;
    var triY = fy(11); // v33: 5-row triangles on rows 11-15 (row 16 is off the LCD)
    var triX0 = fx(14);
    var i, j, k;
    for (i = 0; i < 5; i++) blitItem('empty_triangle', triX0 + i * 3 * DOT, triY, ITEM);
    var rem = s % 10;
    if (rem <= 5) {
      for (j = 0; j < rem; j++) blitItem('triangle', triX0 + j * 3 * DOT, triY, ITEM);
    } else {
      var dark = 10 - rem;
      for (k = 0; k < dark; k++) blitItem('triangle', triX0 + 4 * 3 * DOT - k * 3 * DOT, triY, ITEM);
    }
  }

  function drawStatus() {
    lcdBg();
    if (!state) return;
    var I = items();
    var s = window.Engine.status(state);
    var pages = statusPages();
    var page = pages[statusPage] || pages[0];
    if (page === 'name') {
      var nm = (s.nameEn || s.nameZh || '').toString();
      // One line at the native dot size; long names scroll sideways (v33).
      if (I.drawTextFit) I.drawTextFit(ctx, nm, fx(0), fy(5), ITEM, FW, 1, animNow());
      else I.drawText(ctx, nm, fx(0), fy(5), ITEM);
    } else if (page === 'age') {
      // 7-dot digits: rows 1-7 and 9-15 keep both inside the 16-row LCD.
      blitItem('age', fx(1), fy(0), ITEM);
      I.drawNumber(ctx, s.age, fx(10), fy(1), ITEM, 2);
      blitItem('weight', fx(1), fy(8), ITEM);
      I.drawNumber(ctx, s.weight, fx(10), fy(9), ITEM, 2);
    } else if (page === 'hunger') {
      I.drawHearts(ctx, fx(0), fy(4), s.hunger, 4, ITEM);
    } else if (page === 'strength') {
      I.drawHearts(ctx, fx(0), fy(4), s.strength, 4, ITEM);
    } else if (page === 'effort') {
      var effort = Math.min(4, Math.floor((s.train || 0) / 4));
      I.drawHearts(ctx, fx(0), fy(4), effort, 4, ITEM);
    } else if (page === 'dp') {
      if (is1997Brick()) {
        // Official gauge is four hearts, same size and row as hunger.
        // The words DP / MAX are wider than the 32-dot glass and are not on the brick.
        var dpHearts = Math.max(0, Math.min(4, s.dp || 0));
        I.drawHearts(ctx, fx(0), fy(4), dpHearts, 4, ITEM);
      } else {
        // DM20: label on the left, two digits on the right.
        // MAX is 16 dots (cols 1–16). A number starting at col 14 covered
        // the X, so the glass read "MA". Digits are 7 rows, letters 6;
        // the number starts one row higher so the bottoms line up.
        // Values sit in cols 22–30 (a 2-digit field).
        var shownDp = Math.max(0, Math.min(99, s.dp || 0));
        var shownMax = Math.max(0, Math.min(99, s.dpMax || 0));
        I.drawText(ctx, 'DP', fx(1), fy(2), ITEM);
        I.drawNumber(ctx, shownDp, fx(22), fy(1), ITEM, 2);
        if (shownMax) {
          I.drawText(ctx, 'MAX', fx(1), fy(10), ITEM);
          I.drawNumber(ctx, shownMax, fx(22), fy(9), ITEM, 2);
        }
      }
    } else {
      var pct = Math.round((s.winRate || 0) * 100);
      var w = I.drawNumber(ctx, pct, fx(6), fy(4), ITEM, 0);
      blitItem('percent', fx(6) + w + DOT, fy(4), ITEM);
    }
  }

  function drawFoodMenu() {
    lcdBg();
    blitItem(foodSel === 0 ? 'triangle' : 'empty_triangle', fx(1), fy(2), ITEM);
    blitItem('meat', fx(10), fy(0), ITEM);   // v33: 8-row icons on rows 0-7 / 8-15
    blitItem(foodSel === 1 ? 'triangle' : 'empty_triangle', fx(1), fy(10), ITEM);
    blitItem('pill', fx(10), fy(8), ITEM);
  }

  function is1997Brick() {
    var d = currentDevice();
    return !!(d && d.family === 'dm1997');
  }

  function battleMenuItems() {
    // 1997 has no battle list. DM20 is Single / Tag / Link.
    // Anything else that still shares this screen (should not) is not a 1997 menu.
    if (currentDevice().family === 'dm20') return ['SINGLE', 'TAG', 'LINK'];
    return ['1P', 'LINK'];
  }

  function drawBattleMenu() {
    lcdBg();
    var I = items();
    menuList(I, battleMenuItems(), battleSel);
  }

  function drawLightMenu() {
    lcdBg();
    var I = items();
    // Humulos DM20 manual: "you are given an option for On and Off".
    // Bandai English: "LIGHTS (wake up/put to sleep)". LCD labels are ON / OFF.
    menuItem(I, lightSel === 0, fy(2), 'ON');
    menuItem(I, lightSel === 1, fy(10), 'OFF');
  }

  function drawAlbumMenu() {
    lcdBg();
    var I = items();
    if (view === 'albumView') {
      if (!state) return;
      var poses = ['idle0', 'eat0', 'sleep0', 'happy'];
      var fr = poses[albumPose % poses.length];
      blitMon(state.mon, fx(8), fy(0), MON, fr, false);
      return;
    }
    menuList(I, ['DIGIMON', 'RECORD', 'TAMER', 'COPYMON'], albumSel);
  }

  function drawConnectMenu() {
    lcdBg();
    var I = items();
    menuList(I, ['BATTLE', 'OTHER', 'COPYMON'], connectSel);
  }

  function drawAlbumRecord() {
    lcdBg();
    if (!state) return;
    var I = items();
    var s = window.Engine.status(state);
    var pct = Math.round((s.winRate || 0) * 100);
    var w = I.drawNumber(ctx, pct, fx(6), fy(4), ITEM, 0);
    blitItem('percent', fx(6) + w + DOT, fy(4), ITEM);
  }

  function drawMeter(by, slow) {
    // Right half only, so the monster on the left stays visible.
    var bx = fx(17), bw = 14 * DOT, bh = 3 * DOT;
    ctx.fillStyle = 'rgba(30, 36, 28, 0.55)';
    ctx.fillRect(bx, by, bw, bh);
    // Ver.2 / Ver.5 succeed when the gauge is full, so the mark sits on the right end.
    var zone = Math.floor(bw * 0.18);
    var zx = bx + bw - zone;
    ctx.fillStyle = '#5a8a38';
    ctx.fillRect(zx, by, zone, bh);
    ctx.fillStyle = '#c8b040';
    ctx.fillRect(zx + DOT, by, zone - 2 * DOT, bh);
    var px = bx + Math.floor(train.pos * (bw - DOT));
    ctx.fillStyle = INK;
    ctx.fillRect(px, by - 1, DOT, bh + 2);
  }

  function drawTrain() {
    lcdBg();
    if (!state) return;
    var I = items();
    var mode = train.mode || 'meter';
    var fr = train.done
      ? (train.success ? 'happy' : ((animTick() % 2) ? 'angry' : 'idle0'))
      : ((animTick() % 2) ? 'train1' : 'train0');
    if (mode === 'wall') { drawDm20Wall(); return; }
    if (mode === 'tag') { drawDm20Tag(); return; }
    // Monster on the left. The minigame is drawn after it so the bar,
    // number, and HI/LO stay readable instead of disappearing under the sprite.
    blitMon(state.mon, fx(0), fy(0), MON, fr, true);
    if (mode === 'highlow') {
      // Ver.1: five attacks on your shadow. A is high, B is low, 3 hits win.
      // The guard is the mark, not a word that prints the answer.
      var high = train.target === 1;
      blitMon(state.mon, fx(16), fy(0), MON, high ? 'attack' : 'idle0', false);
      ctx.fillStyle = INK;
      ctx.fillRect(fx(14), fy(high ? 1 : 13), 2 * DOT, DOT);
      I.drawNumber(ctx, train.hits || 0, fx(26), fy(9), ITEM, 0);
    } else if (mode === 'mash') {
      var bx = fx(17), by = fy(2), bw = 14 * DOT, bh = 3 * DOT;
      ctx.fillStyle = 'rgba(30, 36, 28, 0.35)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = INK;
      ctx.fillRect(bx, by, Math.floor(bw * Math.min(1, train.pos)), bh);
      I.drawNumber(ctx, train.mash || 0, fx(22), fy(8), ITEM, 0);
    } else if (mode === 'number') {
      // Up to 3 digits (100). 3×5 dots starting at col 17 ends on col 31.
      I.drawNumber(ctx, train.num || 0, fx(17), fy(4), ITEM, 0);
    } else {
      drawMeter(fy(6), mode === 'meter_slow');
    }
  }

  function drawBang(x, y) {
    // "!" cue (3 dots wide, 7 tall): bar + dot, in LCD ink.
    ctx.fillStyle = INK;
    ctx.fillRect(x + DOT, y, DOT, 5 * DOT);
    ctx.fillRect(x + DOT, y + 6 * DOT, DOT, DOT);
  }
  function drawPowerBar(x, presses, full) {
    // Vertical power meter beside the Digimon, 14 dots tall; full = 13 presses (Humulos).
    var h = Math.min(14, Math.round(14 * (presses || 0) / full));
    ctx.fillStyle = 'rgba(30, 36, 28, 0.25)';
    ctx.fillRect(x, fy(1), 2 * DOT, 14 * DOT);
    ctx.fillStyle = INK;
    for (var i = 0; i < h; i++) if (i % 2 === 0 || i === h - 1) ctx.fillRect(x, fy(15 - i), 2 * DOT, DOT);
  }
  function drawWallTier(tier) {
    // 0 untouched, 1 half-broken, 2 wrecked, 3 destroyed (NHOKO Ver.20th table).
    if (tier >= 3) { blitItem('hit', fx(16), fy(0), ITEM); return; }
    var keepRows = tier === 2 ? 5 : tier === 1 ? 10 : 16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx(16), fy(16 - keepRows), 16 * DOT, keepRows * DOT);
    ctx.clip();
    blitItem('wall', fx(16), fy(0), ITEM);
    ctx.restore();
  }
  function drawDm20Wall() {
    var I = items();
    var now = Date.now();
    if (train.phase === 'ready') {
      blitMon(state.mon, fx(0), fy(0), MON, (animTick() % 2) ? 'idle1' : 'idle0', true);
      drawWallTier(0);
      return;
    }
    if (train.phase === 'go') {
      blitMon(state.mon, fx(0), fy(0), MON, (animTick() % 2) ? 'train1' : 'train0', true);
      drawBang(fx(13), fy(1));
      drawPowerBar(fx(17), train.presses, 13);
      drawWallTier(0);
      return;
    }
    // result: shot flies, then the wall state stays up
    var u = Math.min(1, (now - train.doneAt) / 500);
    blitMon(state.mon, fx(0), fy(0), MON, u < 1 ? 'attack' : (train.tier >= 2 ? 'happy' : 'angry'), true);
    if (u < 1 && train.tier > 0) blitItem('shot', fx(12) + (fx(20) - fx(12)) * u, fy(4), ITEM, false);
    drawWallTier(u < 1 ? 0 : train.tier);
  }
  function drawDm20Tag() {
    // Bandai: tag training is just the two Digimon already on the 32×16 glass.
    // Each cell is 16 dots, so they sit on the two halves and nothing else is
    // drawn on top. The one you fire is on the right; the other blocks.
    // A high block uses the guard's attack cell, a low block its idle cell.
    var high = (train.pattern || 'A').charAt(Math.min(4, train.shot || 0)) === 'A';
    var guardFr = train.done ? (train.success ? 'hurt' : 'happy') : (high ? 'attack' : 'idle0');
    var shotFr = train.done ? (train.success ? 'happy' : 'angry') : 'attack';
    var guardId = train.guard || state.mon;
    var shotId = train.shooter || state.mon;
    blitMon(guardId, fx(0), fy(0), MON, guardFr, false);
    blitMon(shotId, fx(16), fy(0), MON, shotFr, true);
  }

  function drawMeterStops(x, idx) {
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = i === idx ? INK : 'rgba(30, 36, 28, 0.35)';
      ctx.fillRect(x, fy(12 - i * 3), 2 * DOT, DOT);
    }
  }

  function drawCharge() {
    lcdBg();
    if (!state) return;
    var mashing = charge.phase === 'go' || charge.phase === 'meter';
    blitMon(state.mon, fx(0), fy(0), MON, mashing ? ((animTick() % 2) ? 'train1' : 'train0') : 'idle0', true);
    if (charge.tag && charge.phase === 'meter') {
      drawMeterStops(fx(17), charge.meterIdx || 0);
    } else if (charge.phase === 'go') {
      drawBang(fx(13), fy(1));
      drawPowerBar(fx(17), charge.presses, charge.tag ? 12 : 13);
    }
    if (charge.foe) blitMon(charge.foe, fx(20), fy(0), MON, 'idle0', false);
  }

  function drawEvo() {
    lcdBg();
    var t = evoFx.t;
    if (t % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 248, 210, 0.45)';
      ctx.fillRect(0, 0, LCD_W, LCD_H);
    }
    var id = t < 4 ? evoFx.from : evoFx.to;
    var efr = 'idle0';
    if (id && id.indexOf && id.indexOf('egg_') === 0 && t < 4) efr = (t > 1) ? 'hatch' : idleFrame();
    else efr = idleFrame();
    if (id) blitMon(id, fx(8), fy(0), MON, efr, false);
  }

  function drawShot(fromRight, u, yDot) {
    var start = fromRight ? fx(20) : fx(12);
    var end = fromRight ? fx(8) : fx(24);
    var px = start + (end - start) * u;
    blitItem('shot', px, fy(yDot), ITEM, fromRight);
    if (u > 0.55) blitItem('hit', end - 4 * DOT, fy(yDot - 2), ITEM);
  }

  /* 1997 battle is not a menu. The brick plays four exchanges: three
     single shots, then the winner fires twice. Both sprites stay on the
     32×16 glass (16 dots each). */
  function drawBattle1997() {
    var self = state && state.mon;
    var t = battleFx.t;
    var win = battleFx.result === 'win';
    var selfFr = 'idle0', foeFr = 'idle0';
    if (t >= 10) {
      selfFr = win ? 'happy' : ((t % 2) ? 'angry' : 'idle0');
      foeFr = win ? ((t % 2) ? 'angry' : 'idle0') : 'happy';
    } else if (t >= 7) {
      selfFr = win ? 'attack' : 'hurt';
      foeFr = win ? 'hurt' : 'attack';
    } else if (t >= 1) {
      var fromRight = (Math.floor((t - 1) / 2) % 2) === 1;
      selfFr = fromRight ? 'hurt' : 'attack';
      foeFr = fromRight ? 'attack' : 'hurt';
    }
    blitMon(self, fx(0), fy(0), MON, selfFr, true);
    blitMon(battleFx.foe, fx(16), fy(0), MON, foeFr, false);
    if (t >= 1 && t < 7) {
      var fromRight2 = (Math.floor((t - 1) / 2) % 2) === 1;
      drawShot(fromRight2, ((t - 1) % 2) * 0.55 + 0.2, 4);
    } else if (t >= 7 && t < 10) {
      var u = (t - 7) / 3;
      drawShot(!win, Math.min(1, u + 0.15), 3);
      drawShot(!win, Math.min(1, u), 8);
    }
  }

  function drawBattleFx() {
    lcdBg();
    if (is1997Brick()) { drawBattle1997(); return; }
    var self = state && state.mon;
    var t = battleFx.t;
    var selfFr = 'idle0', foeFr = 'idle0';
    if (t < 2) { selfFr = idleFrame(); foeFr = idleFrame(); }
    else if (t < 5) {
      if (battleFx.result === 'win') { selfFr = 'attack'; foeFr = 'hurt'; }
      else { selfFr = 'hurt'; foeFr = 'attack'; }
    } else {
      if (battleFx.result === 'win') { selfFr = 'happy'; foeFr = 'angry'; }
      else { selfFr = 'angry'; foeFr = 'happy'; }
    }
    blitMon(self, fx(0), fy(0), MON, selfFr, true);
    blitMon(battleFx.foe, fx(16), fy(0), MON, foeFr, false);
    if (t >= 2 && t < 5) {
      var goingRight = battleFx.result === 'win';
      drawShot(!goingRight, (t - 2) / 3, 4);
    }
    if (battleFx.shots && battleFx.shots.length && t >= 1) {
      var I2 = items();
      var si = Math.min(battleFx.shots.length - 1, Math.floor((t - 1) / 2));
      if (I2 && I2.drawNumber) I2.drawNumber(ctx, battleFx.shots[si], fx(12), fy(9), ITEM, 0);
    }
  }

  function drawGrave() {
    lcdBg();
    blitItem('grave', fx(8), fy(0), ITEM);
  }

  function penHost() {
    return {
      ctx: ctx,
      state: state,
      view: view,
      profile: currentDevice(),
      setView: function (v) { view = v; },
      getSel: function () { return sel; },
      setSel: function (v) { sel = v; },
      fx: fx, fy: fy, blitItem: blitItem, blitMon: blitMon,
      items: items, animTick: animTick,
      PAPER: PAPER, NIGHT: NIGHT, INK: INK,
      DOT: DOT, ITEM: ITEM, OX: OX, OY: OY, FW: FW, FH: FH,
      LCD_W: LCD_W, LCD_H: LCD_H, MON: MON, ANIM_MS: ANIM_MS,
      walk: walk, eatAnim: eatAnim, eatFoodSprite: eatFoodSprite, poseFx: poseFx, evoFx: evoFx,
      shotMode: shotMode,
      persist: persist,
      applyShell: applyShell,
      playPose: playPose,
      toast: toast,
      isSoundOn: function () { return soundEnabled(); },
      setSoundOn: function (on) {
        soundOn = !!on;
        if (state) state.soundMuted = !on;
        try { localStorage.setItem('digivice-sound', soundOn ? '1' : '0'); } catch (e) {}
        updateSoundBtn();
      },
      openJogressOverlay: function () {
        if (typeof fillJogress === 'function') fillJogress();
        showOverlay('overlay-battle', true);
      },
      startFlush: function (n) {
        flushAnim = { on: true, t: 0, n: n || 1, off: 0 };
        flushLastAt = 0;
      },
      returnToFoodSoon: function (ms) {
        setTimeout(function () {
          if (view === 'play' || view === 'food') {
            view = 'food';
            var fi = selectable().indexOf('FEED');
            if (fi >= 0) sel = fi;
          }
        }, ms || 1100);
      }
    };
  }

  function draw() {
    if (!ctx) return;
    syncLcdBox();
    ctx.imageSmoothingEnabled = false;
    if (isDigivice() && window.Dv1999UI) {
      window.Dv1999UI.draw(penHost());
      updateIcons();
      return;
    }
    if (isPen20() && window.Pen20UI) {
      window.Pen20UI.draw(penHost());
      updateIcons();
      return;
    }
    if (isPendulum() && window.PendulumUI) {
      window.PendulumUI.draw(penHost());
      updateIcons();
      return;
    }
    if (view === 'clock') drawClock();
    else if (view === 'status') drawStatus();
    else if (view === 'food') drawFoodMenu();
    else if (view === 'battleMenu') drawBattleMenu();
    else if (view === 'lightMenu') drawLightMenu();
    else if (view === 'album' || view === 'albumView') drawAlbumMenu();
    else if (view === 'albumRecord') drawAlbumRecord();
    else if (view === 'connect') drawConnectMenu();
    else if (view === 'train') drawTrain();
    else if (view === 'charge') drawCharge();
    else if (view === 'evo') drawEvo();
    else if (view === 'battle') drawBattleFx();
    else if (view === 'grave') drawGrave();
    else drawPlay();
    updateIcons();
  }

  function updateIcons() {
    var current = (view === 'play' || view === 'clock' || view === 'dying' || view === 'grave' ||
                   view === 'eat' || view === 'flush') ? (sel >= 0 ? selectable()[sel] : null) : (
      view === 'status' ? 'STATUS' :
      view === 'food' ? 'FEED' :
      view === 'train' ? 'TRAIN' :
      (view === 'lightMenu') ? 'LIGHT' :
      (view === 'album' || view === 'albumView' || view === 'albumRecord') ? 'ALBUM' :
      (view === 'connect') ? 'CONNECT' :
      (view === 'healMenu') ? 'MEDIC' :
      (view === 'coloMenu' || view === 'colo') ? 'COLOSSEUM' :
      (view === 'eggPick') ? 'STATUS' :
      (view === 'battle' || view === 'battleMenu') ? 'BATTLE' : (sel >= 0 ? selectable()[sel] : null)
    );
    // The pendulum shell's battle mark is CONNECT. BATTLE is not on that bezel.
    if (isPendulum() && current === 'BATTLE') current = 'CONNECT';
    document.querySelectorAll('.face-icon').forEach(function (el) {
      var id = el.getAttribute('data-icon');
      var lit = (id === current && id !== 'CALL');
      el.classList.toggle('on', lit);
      if (id === 'CALL') el.classList.toggle('call-blink', isCalling());
      else el.classList.remove('call-blink');
    });
  }

  function persist() {
    if (!state || shotMode) return;
    try {
      window.SaveIO.saveLocal(state);
      if (window.Steps) window.Steps.syncLedger(state);
      lastSave = Date.now();
    } catch (e) {}
  }

  function settlePendingSteps(s) {
    if (!s || !window.Steps) return 0;
    window.Steps.ensure(s);
    window.Steps.mergeLedgerInto(s, window.Steps.loadLedger());
    var total = 0;
    var days = s.steps.days || {};
    Object.keys(days).forEach(function (d) {
      total += (window.Steps.settleDay(s, d).delta || 0);
    });
    window.Steps.syncLedger(s);
    return total;
  }

  function openFirstClockSetIfNeeded() {
    if (!state || state.dead || state.clockInitialized) return;
    var E = engine();
    if (!E || !E.beginClockSet) return;
    E.beginClockSet(state);
    view = 'clock';
    sel = -1;
  }

  function loadGame(s) {
    state = (window.Devices && window.Devices.migrate) ? window.Devices.migrate(s)
      : ((window.Engine && window.Engine.migrateState) ? window.Engine.migrateState(s) : s);
    settlePendingSteps(state);
    // v31: keep lastReal from the save so the first tick catches up the time
    // the app was closed (was reset to now, which froze the clock and the
    // pet at the moment the app was last closed). Reset only if missing or
    // in the future (device clock moved backwards).
    var nowLoad = Date.now();
    if (typeof state.lastReal !== 'number' || !isFinite(state.lastReal) || state.lastReal > nowLoad) {
      state.lastReal = nowLoad;
    }
    view = state.dead ? 'grave' : 'play';
    sel = -1;
    openFirstClockSetIfNeeded();
    persist();
    fillStepsPanels();
    applyShell();
  }

  function newEgg(version, special, randomize) {
    if (window.Devices && window.Devices.hatchEgg) {
      state = window.Devices.hatchEgg(state, version, !!randomize, special || null);
    } else {
      state = window.Engine.hatchIfEggSelect(state, version, !!randomize, special || null);
    }
    view = 'play';
    sel = -1;
    hideAllOverlays();
    openFirstClockSetIfNeeded();
    persist();
    fillStepsPanels();
    applyShell();
  }

  function confirmOverwrite(msg, fn) {
    if (state && !state.dead && window.SaveIO.hasLocal()) {
      if (!window.confirm(msg || '將覆蓋目前的育成進度，確定嗎？')) return;
    }
    fn();
  }

  function goHome() {
    if (view === 'evo' || view === 'battle' || view === 'dying') return;
    if (view === 'grave') return;
    view = 'play';
    sel = -1;
    eatAnim.on = false;
  }

  function isMenuView() {
    return view === 'clock' || view === 'status' || view === 'food' ||
      view === 'battleMenu' || view === 'lightMenu' || view === 'album' ||
      view === 'albumView' || view === 'albumRecord' || view === 'connect';
  }

  function cycleSel() {
    if (view === 'train' || view === 'clock') return;
    if (view === 'evo' || view === 'battle' || view === 'dying' || view === 'grave') return;
    // The icon row moves only on the home screen. A second-level screen
    // stays open, and the icon index behind it stays put. A choice list
    // (meat / protein, on / off, the battle rows) moves only its own cursor.
    if (view !== 'play') {
      if (view === 'food') foodSel = (foodSel + 1) % 2;
      else if (view === 'battleMenu' && !is1997Brick()) {
        battleSel = (battleSel + 1) % battleMenuItems().length;
      } else if (view === 'lightMenu') lightSel = (lightSel + 1) % 2;
      else if (view === 'album') albumSel = (albumSel + 1) % 4;
      else if (view === 'albumView') albumPose = (albumPose + 1) % 4;
      else if (view === 'connect') connectSel = (connectSel + 1) % 3;
      return;
    }
    var list = selectable();
    sel = (sel + 1);
    if (sel < 0 || sel >= list.length) {
      // 治療 is the last icon. The next A returns to 儀表板 (STATUS)
      // on every brick and Pendulum. It must not go blank and must
      // not land on the battle icon.
      var home = list.indexOf('STATUS');
      sel = home >= 0 ? home : 0;
    }
  }

  function disturb(reason) {
    if (!state) return;
    window.Engine.disturbSleep(state, reason);
    persist();
  }

  function openStatus() {
    if (!state) return;
    statusPage = 0;
    view = 'status';
  }

  function openFood() {
    if (!state || state.dead) return;
    var m = mon();
    if (!m || m.stage === 'egg') { playPose('refuse', 900); return; }
    if (dm20Asleep()) return;
    disturb('food');
    // Keep the last-chosen item (meat or protein). Official manuals we
    // found do not spell the cursor out; the original-device pattern and
    // the v27 fallback is to keep it so several pills can be fed in a row.
    view = 'food';
  }

  function doFeed() {
    if (!state) return;
    var kind = foodSel === 1 ? 'protein' : 'meat';
    var r = kind === 'protein' ? window.Engine.feedProtein(state) : window.Engine.feedMeat(state);
    persist();
    view = 'play';
    if (!r.ok || r.refused) {
      eatAnim.on = false;
      playPose('refuse', 1100);
      setTimeout(function () {
        if (view === 'play' || view === 'food') {
          view = 'food';
          var fi = selectable().indexOf('FEED');
          if (fi >= 0) sel = fi;
        }
      }, 1100);
      return;
    }
    eatAnim = { on: true, t: 0, kind: kind, refused: false, returnToFood: true };
  }

  function dm20Asleep() {
    // DM20: a sleeping Digimon has to be woken with LIGHTS → ON first; then it
    // stays up 15 min for feeding / training (Bandai manual, NHOKO). Feed /
    // train / battle while asleep do nothing (no wake, no disturbance).
    return currentDevice().family === 'dm20' && state && state.sleeping;
  }

  function startTrain() {
    var m = mon();
    if (dm20Asleep()) { view = 'play'; return; }
    disturb('train');
    // Official: Egg / Baby I / Baby II cannot train — refuse animation.
    // Child and up, including DM20 Mega, can (Engine.canTrain).
    if (!window.Engine.canTrain(state)) {
      playPose('refuse', 2000);
      view = 'play';
      return;
    }
    if (state.dead) return;
    if (window.Engine.noteTrainingOpened) window.Engine.noteTrainingOpened(state);
    var d = currentDevice();
    var mode = 'meter';
    if (d.family === 'dm20') {
      // Bandai: one Digimon on screen is the wall. Two on screen is tag.
      // This save has one, so training is the wall.
      startDm20Wall();
      return;
    }
    if (d.version === 1) mode = 'highlow';
    else if (d.version === 3) mode = 'mash';
    else if (d.version === 4) mode = 'number';
    else if (d.version === 5) mode = 'meter_slow';
    train = {
      t: 0, pos: 0, dir: 1, done: false, success: false,
      mode: mode, mash: 0, round: 0, hits: 0,
      target: Math.random() < 0.5 ? 1 : 0,
      num: 0, startAt: Date.now(), lastMs: Date.now(), acc: 0
    };
    view = 'train';
  }

  function startDm20Wall() {
    var t0 = Date.now();
    train = { mode: 'wall', phase: 'ready', startAt: t0, goAt: t0 + DM20_READY_MS,
      endAt: t0 + DM20_READY_MS + DM20_TRAIN_WINDOW_MS, presses: 0, done: false, success: false, tier: 0 };
    view = 'train';
  }

  function startDm20Tag(guardId, shooterId) {
    var pattern = window.Engine.dm20TagPattern ? window.Engine.dm20TagPattern(state.dm20TagRound || 0) : 'ABABB';
    state.dm20TagActive = true;
    train = {
      mode: 'tag', pattern: pattern, shot: 0, hits: 0, done: false, success: false,
      guard: guardId || state.mon, shooter: shooterId || state.mon
    };
    view = 'train';
  }

  function finishDm20Wall() {
    if (train.done) return;
    var r = window.Engine.finishDm20Training(state, train.presses);
    train.done = true;
    train.phase = 'result';
    train.doneAt = Date.now();
    train.tier = (r && r.tier) || 0;
    train.success = !!(r && r.success);
    persist();
    setTimeout(function () {
      if (view === 'train') view = 'play';
      playPose(train.success ? 'happy' : 'angry', 1500);
    }, DM20_RESULT_MS);
  }

  function finishDm20Tag() {
    if (train.done) return;
    var r = window.Engine.finishDm20TagTraining(state, train.hits || 0);
    train.done = true;
    train.success = !!(r && r.success);
    persist();
    setTimeout(function () {
      if (view === 'train') view = 'play';
      playPose(train.success ? 'happy' : 'angry', 1500);
    }, DM20_RESULT_MS);
  }

  function finishTrainRound(success) {
    if (train.done) return;
    train.success = !!success;
    train.done = true;
    window.Engine.finishTraining(state, train.success, true);
    persist();
    setTimeout(function () {
      if (view === 'train') view = 'play';
      playPose(train.success ? 'happy' : 'angry', 2000);
    }, 700);
  }

  function resolveTrain() {
    if (train.done) return;
    var mode = train.mode || 'meter';
    if (mode === 'mash') {
      // Ver.3: the bar has to be full before the time runs out.
      finishTrainRound(train.mash >= 16);
      return;
    }
    if (mode === 'number') {
      // Wikimon Ver.4: stop the count on 100. 96–99 is a miss.
      finishTrainRound((train.num || 0) === 100);
      return;
    }
    if (mode === 'highlow') return;
    // Ver.2 and the slower Ver.5: press while the gauge is full (right-end mark).
    finishTrainRound(train.pos >= 0.82);
  }

  function trainInput(btn) {
    if (train.done) return;
    var mode = train.mode || 'meter';
    if (mode === 'tag') {
      // Humulos chart: A high, B low. The pattern is the shield for this round.
      if (btn !== 'A' && btn !== 'B') return;
      var want = (train.pattern || '').charAt(train.shot || 0);
      if (btn === want) train.hits = (train.hits || 0) + 1;
      train.shot = (train.shot || 0) + 1;
      if (train.shot >= 5) finishDm20Tag();
      return;
    }
    if (mode === 'wall') {
      // Only A, only after "!" (Bandai manual). B / early presses do nothing.
      if (btn === 'A' && train.phase === 'go') train.presses++;
      return;
    }
    if (mode === 'highlow') {
      var choice = (btn === 'A') ? 1 : 0;
      if (choice === train.target) train.hits++;
      train.round++;
      if (train.round >= 5) {
        finishTrainRound(train.hits >= 3);
      } else {
        train.target = Math.random() < 0.5 ? 1 : 0;
      }
      return;
    }
    if (mode === 'mash') {
      // Wikimon Ver.3: only B fills the bar. A does nothing.
      if (btn !== 'B') return;
      train.mash = (train.mash || 0) + 1;
      train.pos = Math.min(1, train.mash / 16);
      if (train.mash >= 16) finishTrainRound(true);
      return;
    }
    resolveTrain();
  }

  function doFlush() {
    if (!state || state.dead) return;
    var n = state.poop || 0;
    if (n <= 0) { playPose('refuse', 900); return; }
    flushAnim = { on: true, t: 0, n: n, off: 0 };
    window.Engine.flush(state);
    persist();
  }

  function doLights() {
    if (!state) return;
    if (currentDevice().family === 'dm20') {
      view = 'lightMenu';
      return;
    }
    window.Engine.toggleLights(state);
    persist();
  }

  function confirmLight() {
    if (!state) return;
    // Humulos DM20: On (sel 0) / Off (sel 1). Engine always turns the lamp
    // on for On, so lights can never get stuck off. 1997 uses doLights toggle.
    if (window.Engine && window.Engine.confirmDm20Light) {
      window.Engine.confirmDm20Light(state, lightSel);
      persist();
    }
    view = 'play';
  }

  function confirmAlbum() {
    if (albumSel === 0) { albumPose = 0; view = 'albumView'; return; }
    if (albumSel === 1) { view = 'albumRecord'; return; }
    // TAMER / COPYMON: no engine data — stay on the menu (LCD already lists them)
  }

  function confirmConnect() {
    if (connectSel === 0 || connectSel === 1) {
      fillJogress();
      showOverlay('overlay-battle', true);
      return;
    }
    // Copymon: no engine support
  }

  function doHeal() {
    if (!state) return;
    var r = window.Engine.heal(state);
    persist();
    // A dose that counts plays happy, including a monster that still needs
    // another shot. Healthy (nothing to treat) plays the refuse pose.
    if (r && r.ok) playPose('happy', 1600);
    else playPose('refuse', 1200);
  }

  function openBattleMenu() {
    if (!state || state.dead) return;
    if (dm20Asleep()) return;
    disturb('battle');
    // Official: Baby I/II/Egg cannot; need DP; must not be injured.
    // Engine.canBattle covers stage, DP, injury, and species.canBattle.
    if (!window.Engine.canBattle(state)) { playPose('refuse', 2000); return; }
    // 1997 has no battle menu. B on the battle icon starts the fight.
    // A does not open a second list, and LINK stays in 其他功能.
    // DM20 keeps Single / Tag / Link.
    if (is1997Brick()) { cpuBattle(false); return; }
    view = 'battleMenu';
  }

  function fillJogress() {
    var box = $('jogress-box');
    if (!box || !state || !window.Engine.jogressPartners) { if (box) box.classList.add('hidden'); return; }
    var partners = window.Engine.jogressPartners(state) || [];
    if (!partners.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = partners.map(function (p) {
      var pm = window.EvolutionData.MONSTERS[p.partner] || {};
      return '<p>' + (pm.nameZh || '') + '</p>' +
        '<button class="btn" data-jogress="' + p.partner + '">標籤對戰（對 CPU）</button> ' +
        '<button class="btn primary" data-jogress-evolve="' + p.partner + '">合體</button>';
    }).join('');
  }

  function cpuBattle(isTag, chargeTier) {
    if (!window.Engine.canBattle(state)) { playPose('refuse', 2000); view = 'play'; return; }
    if (chargeTier == null && currentDevice().family === 'dm20') {
      // Single: mash A after "!". Tag: stop the first meter, then mash A.
      var c0 = Date.now();
      charge = { on: true, tag: !!isTag, phase: 'ready', goAt: c0 + DM20_READY_MS,
        endAt: c0 + DM20_READY_MS + DM20_CHARGE_MS, presses: 0,
        foe: window.Battle.pickCpuFoe(state.mon), meterIdx: 0, meterDir: 1,
        shots: null, shotBonus: 0 };
      view = 'charge';
      return;
    }
    var foe = (chargeTier != null && charge.foe) ? charge.foe : window.Battle.pickCpuFoe(state.mon);
    var selfSnap = window.Battle.snapshot(state);
    // 1997: pressing Battle makes this device the initiator. A CPU stand-in
    // has no hearts, protein, or care mistakes, so its boost is 0 and the
    // difference is the player's boost alone.
    selfSnap.initiator = true;
    if (window.Engine.nextCpuInitiator) window.Engine.nextCpuInitiator(state);
    // Charge order and the Humulos per-shot bonus share the existing
    // sixteenths channel. DM20 has no published HP bar, so +1 (single, max
    // Strength) or +2 (tag, both max) is that many sixteenths, not a
    // reconstructed damage table. A published tag row is the strongest order.
    var boost = 0;
    if (!isTag && chargeTier != null && window.Battle.chargeBoost) boost += window.Battle.chargeBoost(chargeTier);
    if (isTag && charge.shots && window.Battle.chargeBoost) boost += window.Battle.chargeBoost(4);
    if (charge.shotBonus) boost += charge.shotBonus;
    if (boost) selfSnap.enhancement = (selfSnap.enhancement || 0) + boost;
    var result = window.Battle.resolveBattle(state.mon, foe, Date.now() >>> 0, selfSnap, { mon: foe, enhancement: 0 });
    hideAllOverlays();
    battleFx = { t: 0, foe: foe, result: result, active: true, shots: charge.shots || null };
    view = 'battle';
    window.Engine.recordBattle(state, result);
    if (isTag && result === 'win') window.Engine.addTagWin(state);
    persist();
  }

  function stopTagMeter() {
    if (!charge.on || charge.phase !== 'meter') return;
    charge.meter = (charge.meterIdx || 0) + 1;
    charge.phase = 'go';
    charge.presses = 0;
    var now = Date.now();
    charge.goAt = now;
    charge.endAt = now + DM20_CHARGE_MS;
  }

  function finishCharge() {
    if (!charge.on) return;
    var tag = !!charge.tag;
    var presses = charge.presses || 0;
    var meter = charge.meter || ((charge.meterIdx || 0) + 1);
    var shots = (tag && window.Battle.dm20TagShots) ? window.Battle.dm20TagShots(meter, presses) : null;
    var bonus = window.Battle.dm20ShotBonus ? window.Battle.dm20ShotBonus(state.strength || 0, tag, 0) : 0;
    if (shots && bonus && window.Battle.applyDm20ShotBonus) shots = window.Battle.applyDm20ShotBonus(shots, bonus);
    charge.on = false;
    charge.shots = shots;
    charge.shotBonus = bonus;
    var tier = tag ? 0 : (window.Battle.chargeTier ? window.Battle.chargeTier(presses) : 0);
    cpuBattle(tag, tier);
  }

  function finishBattleFx() {
    view = 'play';
    battleFx.active = false;
    // The icon and the battle-list row stay where the fight started.
    playPose(battleFx.result === 'win' ? 'happy' : 'angry', 2000);
  }

  function confirmSel() {
    if (view === 'charge') {
      // Tag battle: B stops the first meter. Single battle ignores B.
      if (charge.tag && charge.phase === 'meter') stopTagMeter();
      return;
    }
    if (view === 'train') { trainInput('B'); return; }
    if (view === 'clock') { view = 'play'; return; }
    if (view === 'status') { statusPage = (statusPage + 1) % statusPages().length; return; }
    if (view === 'food') { doFeed(); return; }
    if (view === 'lightMenu') { confirmLight(); return; }
    if (view === 'album') { confirmAlbum(); return; }
    if (view === 'albumView' || view === 'albumRecord') { view = 'album'; return; }
    if (view === 'connect') { confirmConnect(); return; }
    if (view === 'battleMenu') {
      if (is1997Brick()) { cpuBattle(false); return; }
      var itemsB = battleMenuItems();
      var pick = itemsB[battleSel];
      if (pick === '1P' || pick === 'SINGLE') cpuBattle(false);
      else if (pick === 'TAG') cpuBattle(true);
      else { fillJogress(); showOverlay('overlay-battle', true); }
      return;
    }
    if (view === 'evo' || view === 'battle' || view === 'dying') return;
    if (view === 'grave') return;
    if (!state || view !== 'play') return;
    if (sel < 0) { view = 'clock'; return; }
    var id = selectable()[sel];
    if (id === 'STATUS') openStatus();
    else if (id === 'FEED') openFood();
    else if (id === 'TRAIN') startTrain();
    else if (id === 'BATTLE') openBattleMenu();
    else if (id === 'FLUSH') doFlush();
    else if (id === 'LIGHT') doLights();
    else if (id === 'MEDIC') doHeal();
    else if (id === 'ALBUM') { albumSel = 0; view = 'album'; }
    else if (id === 'CONNECT') { connectSel = 0; view = 'connect'; }
  }

  function maybeNewEggCombo() {
    if (view !== 'grave' && !(state && state.dead)) return false;
    if ((keyA && keyC) || (keyA && keyB)) {
      hideAllOverlays();
      fillEggGrid();
      showOverlay('overlay-egg', true);
      chordAt = Date.now();
      return true;
    }
    return false;
  }

  // Official (1997 Ver.1 and DM20, same CLOCK SETTING): on the clock,
  // press A and C together to enter SET. (A+C on the main screen is mute
  // on the original; we do not enter SET from play.)
  function toggleSound() {
    soundOn = !soundOn;
    if (state) state.soundMuted = !soundOn;
    try { localStorage.setItem('digivice-sound', soundOn ? '1' : '0'); } catch (e) {}
    updateSoundBtn();
    toast(soundOn ? '音效：開' : '音效：關');
    if (soundOn) beep();
  }

  // Official 1997: A+C on the main screen toggles the key beep.
  // On the clock, A+C is SET instead (maybeClockSetCombo).
  function maybeMuteCombo() {
    if (!state) return false;
    if (currentDevice().family !== 'dm1997') return false;
    if (view === 'clock' || isClockSetView()) return false;
    if (view === 'grave' || view === 'dying' || state.dead) return false;
    if (!(keyA && keyC)) return false;
    toggleSound();
    chordAt = Date.now();
    return true;
  }

  function maybeClockSetCombo() {
    if (view !== 'clock') return false;
    if (!state || !engine() || !engine().beginClockSet) return false;
    if (isClockSetView()) return false;
    if (keyA && keyC) {
      engine().beginClockSet(state);
      chordAt = Date.now();
      persist();
      return true;
    }
    return false;
  }

  // Clock-SET hold. See js/clock-hold.js. One tap = exactly +1;
  // auto-repeat only after the family\'s hold delay, and never on a ghost click.
  var clockHoldCtl = null;
  function getClockHold() {
    if (clockHoldCtl) return clockHoldCtl;
    var CH = (typeof window !== 'undefined' && window.ClockHold) || (typeof globalThis !== 'undefined' && globalThis.ClockHold);
    if (!CH) {
      clockHoldCtl = {
        onPointerDown: function (part) { clockSetAdjust(part); },
        onPointerUp: function () {},
        onKeyDown: function (part) { clockSetAdjust(part); },
        onKeyUp: function () {},
        shouldIgnoreClick: function () { return false; },
        stop: function () {}
      };
      return clockHoldCtl;
    }
    clockHoldCtl = CH.create({
      adjust: function (part) { clockSetAdjust(part); },
      family: function () {
        var d = currentDevice();
        return (d && d.family) || 'dm1997';
      }
    });
    return clockHoldCtl;
  }
  function clockSetAdjust(part) {
    if (!state || !engine() || !engine().adjustClockSet) return;
    engine().adjustClockSet(state, part, 1);
    persist();
  }

  function pressA() {
    if (Date.now() - chordAt < 900) return;
    lastKeyAt = Date.now();
    beep();
    if (anyOverlay()) return;
    if (maybeNewEggCombo()) return;
    if (maybeClockSetCombo()) return;
    if (isClockSetView()) {
      // Ghost click after pointerdown (iOS 15): already counted, do nothing.
      // A real click with no pointer (shouldn't happen on the pads) is +1
      // and does NOT start a hold — there is no pointerup to stop it.
      if (getClockHold().shouldIgnoreClick()) return;
      clockSetAdjust('h');
      return;
    }
    if (isDigivice() && window.Dv1999UI) {
      if (window.Dv1999UI.pressA(penHost())) return;
    }
    if (isPen20() && window.Pen20UI) {
      if (window.Pen20UI.pressA(penHost())) return;
    }
    if (isPendulum() && window.PendulumUI) {
      if (window.PendulumUI.pressA(penHost())) return;
    }
    if (view === 'charge') { if (charge.on && charge.phase === 'go') charge.presses++; return; }
    if (view === 'train') { trainInput('A'); return; }
    cycleSel();
  }
  function pressB() {
    if (Date.now() - chordAt < 900) return;
    lastKeyAt = Date.now();
    beep();
    if (anyOverlay()) return;
    if (maybeNewEggCombo()) return;
    if (isClockSetView()) {
      if (getClockHold().shouldIgnoreClick()) return;
      clockSetAdjust('m');
      return;
    }
    if (isDigivice() && window.Dv1999UI) {
      if (window.Dv1999UI.pressB(penHost())) return;
    }
    if (isPen20() && window.Pen20UI) {
      if (window.Pen20UI.pressB(penHost())) return;
    }
    if (isPendulum() && window.PendulumUI) {
      if (window.PendulumUI.pressB(penHost())) return;
    }
    confirmSel();
  }
  function pressC() {
    if (Date.now() - chordAt < 900) return;
    lastKeyAt = Date.now();
    beep();
    if (anyOverlay()) { hideAllOverlays(); return; }
    if (maybeNewEggCombo()) return;
    if (maybeClockSetCombo()) return;
    if (isClockSetView()) {
      engine().confirmClockSet(state);
      persist();
      view = 'play';
      sel = -1;
      return;
    }
    if (isDigivice() && window.Dv1999UI) {
      if (window.Dv1999UI.pressC(penHost())) return;
    }
    if (isPen20() && window.Pen20UI) {
      if (window.Pen20UI.pressC(penHost())) return;
    }
    if (isPendulum() && window.PendulumUI) {
      if (window.PendulumUI.pressC(penHost())) return;
    }
    if (view === 'charge') { charge.on = false; view = 'play'; return; }
    if (view === 'train') {
      if (window.Engine && window.Engine.cancelTraining) window.Engine.cancelTraining(state);
      persist();
      view = 'play';
      return;
    }
    if (isMenuView()) {
      goHome();
      return;
    }
    if (view === 'play') sel = -1;
  }

  var lastFrameAt = 0;
  function loop() {
    frameStep();
    requestAnimationFrame(loop);
  }

  // Catch up simulation + clock right now (resume, pageshow, watchdog).
  function catchUpNow() {
    if (!state || shotMode) return;
    try {
      var r = (window.Devices && window.Devices.tick) ? window.Devices.tick(state, Date.now()) : window.Engine.tick(state, Date.now());
      if (r && r.died && view !== 'dying' && view !== 'grave') { dyingT = 0; view = 'dying'; }
      draw();
    } catch (e) {}
  }

  function frameStep() {
    lastFrameAt = Date.now();
    if (shotMode) {
      draw();
      return;
    }
    frame++;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (poseFx.name && now >= poseFx.until) {
      poseFx.name = null;
      poseFx.until = 0;
      poseFx.extra = null;
    }
    if (!lastAnimAt) lastAnimAt = now;
    if (now - lastAnimAt >= ANIM_MS) {
      lastAnimAt += ANIM_MS;
      if (now - lastAnimAt >= ANIM_MS * 4) lastAnimAt = now;
      walkUpdate();
      if (eatAnim.on) {
        eatAnim.t++;
        var maxT = eatAnim.kind === 'protein' ? 4 : 5;
        if (eatAnim.t >= maxT) {
          eatAnim.on = false;
          // Return to the food menu with the cursor still on the item
          // just fed, so the next B feeds another pill. No 2 s happy
          // pose that would leave the menu.
          if (eatAnim.returnToFood) {
            view = 'food';
            var fi = selectable().indexOf('FEED');
            if (fi >= 0) sel = fi;
          } else {
            playPose('happy', 2000);
          }
        }
      }
      if (view === 'evo') {
        evoFx.t++;
        if (evoFx.t > 8) view = 'play';
      }
      if (view === 'battle') {
        battleFx.t++;
        // 1997: stance + 3 exchanges + double hit + result (about 6 s).
        var battleEnd = is1997Brick() ? 12 : 8;
        if (battleFx.t > battleEnd) finishBattleFx();
      }
      if (view === 'dying') {
        dyingT++;
        if (dyingT > 6) view = 'grave';
      }
    }
    if (flushAnim.on) {
      if (!flushLastAt) flushLastAt = now;
      if (now - flushLastAt >= FLUSH_MS) {
        flushLastAt += FLUSH_MS;
        if (now - flushLastAt >= FLUSH_MS * 8) flushLastAt = now;
        flushAnim.off += 1;
        if (flushAnim.off > 24) flushAnim.on = false;
      }
    }
    if (state && (view === 'play' || view === 'train' || view === 'charge' || view === 'clock' || view === 'status' || view === 'food' || view === 'battleMenu' || view === 'lightMenu' || view === 'album' || view === 'albumView' || view === 'albumRecord' || view === 'connect' || view === 'healMenu' || view === 'soundMenu')) {
      var prevMon = state.mon;
      var r = (window.Devices && window.Devices.tick) ? window.Devices.tick(state, Date.now()) : window.Engine.tick(state, Date.now());
      if (r.evolved) {
        evoFx = { t: 0, from: prevMon, to: state.mon };
        view = 'evo';
      }
      if (r.died) {
        dyingT = 0;
        view = 'dying';
      }
      if (Date.now() - lastSave > 2500) persist();
    }
    if (isDigivice() && window.Dv1999UI && window.Dv1999UI.afterTick) {
      window.Dv1999UI.afterTick(penHost());
    }
    if (isPen20() && window.Pen20UI) {
      window.Pen20UI.tickMinigame(penHost());
    }
    if (view === 'train' && train.mode === 'wall' && !train.done) {
      var nowW = Date.now();
      if (train.phase === 'ready' && nowW >= train.goAt) train.phase = 'go';
      if (train.phase === 'go' && nowW >= train.endAt) finishDm20Wall();
    }
    if (view === 'charge' && charge.on) {
      var nowC = Date.now();
      if (charge.phase === 'ready' && nowC >= charge.goAt) {
        charge.phase = charge.tag ? 'meter' : 'go';
        charge.meterIdx = 0;
        charge.meterDir = 1;
        charge.meterAcc = 0;
        charge.meterAt = nowC;
      }
      if (charge.phase === 'meter') {
        charge.meterAcc = (charge.meterAcc || 0) + (nowC - (charge.meterAt || nowC));
        charge.meterAt = nowC;
        while (charge.meterAcc >= 350) {
          charge.meterAcc -= 350;
          var mi = charge.meterIdx || 0;
          var md = charge.meterDir || 1;
          mi += md;
          if (mi >= 3) { mi = 3; md = -1; }
          if (mi <= 0) { mi = 0; md = 1; }
          charge.meterIdx = mi;
          charge.meterDir = md;
        }
      }
      if (charge.phase === 'go' && nowC >= charge.endAt) finishCharge();
    }
    if (isPendulum() && window.PendulumUI) {
      window.PendulumUI.tickMinigame(penHost());
    } else if (view === 'train' && !train.done && train.mode !== 'wall') {
      train.t = (train.t || 0) + 1;
      var mode = train.mode || 'meter';
      var nowTr = Date.now();
      var dt = Math.min(50, nowTr - (train.lastMs || nowTr));
      train.lastMs = nowTr;
      if (mode === 'meter' || mode === 'meter_slow') {
        // About one width per second (Ver.5 half of that), independent of frame rate.
        var speed = (mode === 'meter_slow') ? 0.55 : 1.1;
        train.pos += train.dir * speed * dt / 1000;
        if (train.pos >= 1) { train.pos = 1; train.dir = -1; }
        if (train.pos <= 0) { train.pos = 0; train.dir = 1; }
      } else if (mode === 'number') {
        // One count every 50 ms, so 0–100 takes about 5 s. Success is exactly 100.
        train.acc = (train.acc || 0) + dt;
        while (train.acc >= 50) {
          train.acc -= 50;
          train.num = ((train.num || 0) + 1) % 101;
        }
      } else if (mode === 'mash') {
        if (nowTr - (train.startAt || nowTr) > 4000) resolveTrain();
      }
    }
    /* evo / battle / dying advance on the 2 Hz ANIM_MS clock above */
    // Official idle timeout: 60s returns menus 2–8 to home (disassembly 0x0866)
    if (!anyOverlay() && sel >= 0 && view === 'play' && Date.now() - lastKeyAt > 60000) sel = -1;

    draw();
  }

  /* ---- save / steps / pvp (extra functions) ---- */

  function stepsStatusHtml() {
    if (!window.Steps) return '';
    if (!state) return '<p class="steps-muted">開始育成後會顯示這隻數碼寶貝的步數。</p>';
    window.Steps.ensure(state);
    var sum = window.Steps.todaySummary(state);
    var sync = window.Steps.formatSyncTime(sum.lastHealthSyncAt);
    var dateBit = sum.lastHealthSyncDate ? '，日期 ' + sum.lastHealthSyncDate : '';
    return (
      '<p>今天入帳 <b>' + sum.credited + '</b>　累計 <b>' + sum.lifetime + '</b></p>' +
      '<p>健康 <b>' + sum.health + '</b>　走路計步 <b>' + sum.motion + '</b>（暫計）</p>' +
      '<p class="steps-muted">上次同步：' + sync + dateBit + '</p>' +
      '<p class="steps-muted">走路計步是暫計：與「健康」同步後，當天入帳取兩者較高值，只補差額，不會重複計算。每 500 步 +1 訓練（每天最多 8）並 +1 體力（每天最多 2，上限 4）；每 1000 步體重 −1 g（每天最多 3 g，不會低於基礎體重）。幼年期與蛋只累計步數。</p>'
    );
  }

  function fillStepsPanels() {
    var html = stepsStatusHtml();
    var b = $('steps-settings');
    if (b) b.innerHTML = html;
    document.querySelectorAll('.js-motion-steps').forEach(function (btn) {
      btn.textContent = motionOn ? '走路計步已開啟' : '開啟走路計步';
    });
  }

  function ingestUrl() {
    if (!window.Steps) return;
    var parsed = window.Steps.parseParams(location.search, location.hash);
    if (!parsed.present) return;
    window.Steps.stripWindowHistory();
    if (!parsed.ok) {
      toast('步數連結無效（' + (parsed.reason === 'too-large' ? '超過每天 100000 步上限' : parsed.reason === 'negative' ? '步數是負的' : parsed.reason === 'bad-date' ? '日期格式不對' : '步數不是有效數字') + '）');
      return;
    }
    var target = state;
    var fromLocal = false;
    if (!target) {
      target = window.SaveIO.loadLocal();
      fromLocal = !!target;
    }
    if (!target) {
      window.Steps.recordHealthReading(parsed, Date.now());
      healthAppliedThisSession = true;
      toast('已記下今天的健康步數 ' + parsed.steps + '，開始育成後會生效', 2400);
      return;
    }
    window.Steps.ensure(target);
    var r = window.Steps.applyHealth(target, parsed, Date.now());
    window.Steps.syncLedger(target);
    if (state) persist();
    else if (fromLocal) {
      try { window.SaveIO.saveLocal(target); } catch (e) {}
    }
    healthAppliedThisSession = true;
    fillStepsPanels();
    if (r.ok && r.delta > 0) {
      var extra = '';
      if (r.effects && r.effects.effort) extra += '，訓練 +' + r.effects.effort;
      if (r.effects && r.effects.strength) extra += '，體力 +' + r.effects.strength;
      if (r.effects && r.effects.weightLoss) extra += '，體重 −' + r.effects.weightLoss + 'g';
      toast('同步步數 +' + r.delta + '（今天共 ' + r.credited + '）' + extra, 2400);
    } else if (r.ok) {
      toast('步數已是最新（今天 ' + r.credited + '）', 2000);
    }
  }

  function isIOSDevice() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // Session-only: after the cold-launch prompt is shown or skipped, never
  // reopen it on resume / visibility / pageshow / returning from Shortcuts.
  var stepsPromptDismissed = false;

  function maybeShowStepsPrompt() {
    if (!window.Steps || !window.Steps.shouldShowLaunchPrompt) return;
    if (anyOverlay()) return;
    if (isClockSetView()) return;
    var parsed = window.Steps.parseParams(location.search || '', location.hash || '');
    if (!window.Steps.shouldShowLaunchPrompt({
      coldLaunch: true,
      shotMode: shotMode,
      healthApplied: healthAppliedThisSession,
      alreadyDismissed: stepsPromptDismissed,
      fromShortcut: !!(parsed && parsed.present),
      isIOS: isIOSDevice()
    })) return;
    stepsPromptDismissed = true;
    showOverlay('overlay-steps-prompt', true);
  }

  function runShortcut() {
    if (!window.Steps) return;
    var url = window.Steps.shortcutRunURL();
    if (!isIOSDevice()) {
      toast('請在 iPhone 的「捷徑」App 執行「數碼寶貝步數」');
      showOverlay('overlay-steps-help', true);
      return;
    }
    window.location.href = url;
  }

  function onDeviceMotion(e) {
    if (!motionOn || !state || !window.Steps) return;
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    var a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;
    if (!pedometer) pedometer = window.Steps.createPedometer();
    if (pedometer.feed(a.x, a.y, a.z, Date.now())) {
      var r = window.Steps.addMotion(state, 1);
      if (r.ok && r.delta > 0) persist();
    }
  }

  function requestMotion() {
    if (motionOn) {
      toast('走路計步已開啟。畫面開著時會計算搖晃與走路。');
      return;
    }
    function start() {
      if (motionOn) return;
      if (!pedometer && window.Steps) pedometer = window.Steps.createPedometer();
      window.addEventListener('devicemotion', onDeviceMotion, true);
      motionOn = true;
      fillStepsPanels();
      toast('走路計步已開啟。畫面開著、螢幕亮著時會計算搖晃與走路。', 2800);
    }
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(function (perm) {
        if (perm === 'granted') start();
        else toast('需要允許「動作與方向」才能計步。請再按一次，並在跳出的視窗選擇「允許」。', 2800);
      }).catch(function () { toast('無法開啟走路計步'); });
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      start();
    } else {
      toast('這個裝置沒有動作感應器');
    }
  }

  function drawQr(elId, text) {
    var box = $(elId);
    if (!box) return;
    box.innerHTML = '';
    if (!window.QRCode || !text) return;
    QRCode.toCanvas(text, { width: 192, margin: 1, errorCorrectionLevel: 'M' }, function (err, c) {
      if (err) { box.textContent = '無法產生 QR'; return; }
      c.style.width = '192px'; c.style.height = '192px';
      box.appendChild(c);
    });
  }

  function openExport() {
    if (!state) { toast('目前沒有存檔'); return; }
    var code = window.SaveIO.encode(state);
    $('export-code').value = code;
    drawQr('qrbox', code);
    showOverlay('overlay-export', true);
  }

  function doImportText(code) {
    try {
      var obj = window.SaveIO.decode(code);
      if (state && window.SaveIO.hasLocal()) {
        if (!window.confirm('匯入會覆蓋目前的育成進度，確定嗎？')) return;
      }
      loadGame(obj.state);
      hideAllOverlays();
      toast('存檔已匯入');
    } catch (e) { toast(e.message || '匯入失敗'); }
  }

  function startScan() {
    var video = $('scan');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('此瀏覽器無法使用相機，請改為貼上存檔碼');
      return;
    }
    video.classList.remove('hidden');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
      scanStream = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.play();
      var tmp = document.createElement('canvas');
      var tctx = tmp.getContext('2d');
      function tickScan() {
        if (!scanStream) return;
        if (video.readyState >= 2) {
          tmp.width = video.videoWidth;
          tmp.height = video.videoHeight;
          tctx.drawImage(video, 0, 0);
          try {
            var img = tctx.getImageData(0, 0, tmp.width, tmp.height);
            var r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
            if (r && r.data) {
              stopScan();
              $('import-code').value = r.data;
              if (/^DM20B\./.test(r.data.trim())) {
                hideAllOverlays();
                showOverlay('overlay-battle', true);
                toast('連線對戰已改成線上名單');
              } else {
                doImportText(r.data);
              }
              return;
            }
          } catch (e) {}
        }
        scanTimer = requestAnimationFrame(tickScan);
      }
      tickScan();
    }).catch(function () {
      toast('無法開啟相機（需 HTTPS，或改為貼上存檔碼）');
    });
  }

  function stopScan() {
    if (scanTimer) { cancelAnimationFrame(scanTimer); scanTimer = null; }
    if (scanStream) {
      scanStream.getTracks().forEach(function (t) { t.stop(); });
      scanStream = null;
    }
    var v = $('scan');
    if (v) { v.srcObject = null; v.classList.add('hidden'); }
  }

  function showOffer() {
    try {
      var code = window.Battle.makeOffer(state);
      $('pvp-out').value = code;
      drawQr('pvp-qr', code);
      toast('已產生邀請碼，請對方掃描或貼上');
    } catch (e) { toast(e.message); }
  }
  function acceptOffer() {
    var code = $('pvp-in').value;
    try {
      var r = window.Battle.acceptOffer(code, state);
      window.Engine.recordBattle(state, r.result);
      persist();
      $('pvp-out').value = r.code;
      drawQr('pvp-qr', r.code);
      toast(r.result === 'win' ? '你贏了！把結果碼傳回對方' : '你輸了。把結果碼傳回對方');
    } catch (e) { toast(e.message); }
  }
  function applyPvpResult() {
    var code = $('pvp-in').value;
    try {
      var r = window.Battle.applyResult(code, state);
      window.Engine.recordBattle(state, r.result);
      persist();
      toast(r.result === 'win' ? '對方確認：你贏了' : '對方確認：你輸了');
    } catch (e) { toast(e.message); }
  }

  var lobbyTimer = null;
  var lobbyApplied = {};
  var lobbyBusy = false;
  var lobbySeq = 0;

  function lobbyCode() {
    var key = 'digivice.inviteCode';
    var cur = '';
    try { cur = localStorage.getItem(key) || ''; } catch (e) {}
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(cur)) {
      var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      cur = '';
      for (var i = 0; i < 6; i++) cur += abc.charAt(Math.floor(Math.random() * abc.length));
      try { localStorage.setItem(key, cur); } catch (e2) {}
    }
    return cur;
  }
  var LOBBY_URL = 'https://script.google.com/macros/s/AKfycbzz8Ax-p29EOxsy4QVw1-HPHptCt1QWrE11zeXarYJULh0LvuGw-y4k5yRSX6dJGR3u/exec';

  function lobbySnap() {
    var m = mon() || {};
    var enh = (window.Engine && window.Engine.enhancement) ? window.Engine.enhancement(state) : 0;
    return {
      code: lobbyCode(),
      mon: (state && state.mon) || '',
      name: m.nameZh || m.nameEn || (state && state.mon) || '',
      slot: m.slot || '',
      stage: m.stage || '',
      enhancement: String(enh || 0)
    };
  }
  function lobbyCall(url, params) {
    return new Promise(function (resolve, reject) {
      var cb = 'dmLobby_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      var s = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('對戰表沒有回應')); }, 20000);
      window[cb] = function (data) { cleanup(); resolve(data); };
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      s.onerror = function () { cleanup(); reject(new Error('連不到對戰表')); };
      var q = ['callback=' + cb];
      Object.keys(params).forEach(function (k) {
        q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k] == null ? '' : params[k]));
      });
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
      document.head.appendChild(s);
    });
  }
  function lobbyEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function renderLobby(others) {
    var box = $('lobby-list');
    if (!box) return;
    if (!others || !others.length) {
      box.innerHTML = '<p class="steps-muted">目前沒有其他在線的人</p>';
      return;
    }
    box.innerHTML = others.map(function (p) {
      return '<div class="lobby-row"><div><b>' + lobbyEsc(p.code) + '</b><span>' +
        lobbyEsc(p.name || p.mon || '') + '</span></div>' +
        '<button type="button" class="btn" data-lobby-foe="' + lobbyEsc(p.code) + '">對戰</button></div>';
    }).join('');
  }
  function applyLobbyBattle(b) {
    if (!b || !b.id || lobbyApplied[b.id] || !state) return;
    var you = lobbyCode();
    var result = b.initiator === you ? b.initiatorResult : (b.initiatorResult === 'win' ? 'loss' : 'win');
    if (result !== 'win' && result !== 'loss') return;
    var rec = window.Engine.recordBattle(state, result);
    persist();
    lobbyApplied[b.id] = true;
    lobbyCall(LOBBY_URL, { action: 'ack', code: you, id: b.id }).catch(function () {});
    var foeName = b.initiator === you ? (b.defenderName || b.defender) : (b.initiatorName || b.initiator);
    if (rec && rec.ok === false) toast('勝負已定，但這隻沒記入戰績');
    else toast((result === 'win' ? '你贏了' : '你輸了') + (foeName ? '（' + foeName + '）' : ''));
    if (rec && rec.ok !== false) playPose(result === 'win' ? 'happy' : 'angry', 2000);
  }
  function lobbyOpen_() {
    var el = $('overlay-battle');
    return !!(el && el.classList.contains('show'));
  }
  function lobbyLeaveParams() {
    return { action: 'leave', code: lobbyCode(), seq: String(lobbySeq || '') };
  }
  function lobbyLeaveBeacon() {
    if (!lobbyOpen_()) return;
    var code = lobbyCode();
    var seq = String(lobbySeq || '');
    try {
      if (navigator.sendBeacon) {
        var body = new URLSearchParams();
        body.set('action', 'leave');
        body.set('code', code);
        body.set('seq', seq);
        navigator.sendBeacon(LOBBY_URL, body);
      }
    } catch (e) {}
    try {
      var q = 'action=leave&code=' + encodeURIComponent(code) + '&seq=' + encodeURIComponent(seq) + '&callback=dmLobby_0_1';
      fetch(LOBBY_URL + '?' + q, { method: 'GET', mode: 'no-cors', keepalive: true }).catch(function () {});
    } catch (e2) {}
  }
  function lobbyTick() {
    var status = $('lobby-status');
    var mine = $('lobby-mycode');
    if (mine) mine.textContent = lobbyCode();
    if (!state || state.dead) {
      if (status) status.textContent = '還沒有在育成的數碼寶貝';
      renderLobby([]);
      if (lobbySeq) lobbyCall(LOBBY_URL, lobbyLeaveParams()).catch(function () {});
      return;
    }
    if (!window.Engine.canBattle(state)) {
      if (status) status.textContent = '這隻現在不能對戰（幼年期、沒有 DP，或受傷）';
      renderLobby([]);
      lobbyCall(LOBBY_URL, lobbyLeaveParams()).catch(function () {});
      return;
    }
    var snap = lobbySnap();
    lobbyCall(LOBBY_URL, {
      action: 'sync',
      code: snap.code,
      mon: snap.mon,
      name: snap.name,
      slot: snap.slot,
      stage: snap.stage,
      enhancement: snap.enhancement
    }).then(function (data) {
      if (!lobbyOpen_()) return;
      if (!data || data.ok === false) {
        if (status) status.textContent = (data && data.error) || '登記失敗';
        return;
      }
      if (data.seq) lobbySeq = Number(data.seq) || lobbySeq;
      if (status) status.textContent = data.waiting === false ? '對戰中，暫時不會出現在名單' : '已登記。點邀請碼就和對方打。';
      renderLobby(data.others || []);
      (data.inbox || []).forEach(applyLobbyBattle);
    }).catch(function (e) {
      if (status && lobbyOpen_()) status.textContent = e.message || '連不到對戰表';
    });
  }
  function startLobby() {
    var mine = $('lobby-mycode');
    if (mine) mine.textContent = lobbyCode();
    lobbyTick();
    if (lobbyTimer) return;
    lobbyTimer = setInterval(lobbyTick, 8000);
  }
  function stopLobby() {
    if (lobbyTimer) { clearInterval(lobbyTimer); lobbyTimer = null; }
    lobbyCall(LOBBY_URL, lobbyLeaveParams()).catch(function () {});
  }
  function onLobbyClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-lobby-foe]') : null;
    if (!btn || lobbyBusy) return;
    lobbyBusy = true;
    lobbyCall(LOBBY_URL, { action: 'fight', code: lobbyCode(), foe: btn.getAttribute('data-lobby-foe') }).then(function (data) {
      lobbyBusy = false;
      if (!data || data.ok === false) { toast((data && data.error) || '對戰失敗'); return; }
      applyLobbyBattle(data.battle);
      lobbyTick();
    }).catch(function (err) {
      lobbyBusy = false;
      toast(err.message || '對戰失敗');
    });
  }

  function fillEggGrid() {
    var row = $('egg-row');
    if (!row || !items()) return;
    row.innerHTML = '';
    items().EGG_PICKER.forEach(function (egg) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'egg-card';
      btn.setAttribute('data-egg', egg.dataEgg);
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var n = document.createElement('div');
      n.className = 'n';
      n.textContent = egg.label;
      btn.appendChild(c);
      btn.appendChild(n);
      row.appendChild(btn);
      var sp = window.SpriteAtlas && window.SpriteAtlas.SPRITES[egg.id];
      if (sp) {
        var src = window.SpriteAtlas.renderToImageData(sp, 'idle0', 1);
        var cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.drawImage(src, 0, 0, 32, 32);
      } else if (/^dv1999/.test(String(egg.dataEgg))) {
        // Start-unit icon for the 神聖計畫 picker cell: a small oval
        // communicator, no partner roster (no spoilers).
        var cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.fillStyle = /v2$/.test(egg.dataEgg) ? '#e88ab0' : '#d08a28';
        cx.beginPath();
        cx.ellipse(16, 17, 11, 13, 0, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = '#1a1c16';
        cx.beginPath();
        cx.arc(16, 16, 5, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = /v2$/.test(egg.dataEgg) ? '#f4c4d6' : '#f0d090';
        cx.beginPath();
        cx.arc(16, 16, 3, 0, Math.PI * 2);
        cx.fill();
      }
    });
    row.querySelectorAll('[data-egg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-egg');
        confirmOverwrite('將覆蓋目前的育成進度，確定嗎？', function () {
          if (/^[1-5]$/.test(v)) newEgg(parseInt(v, 10), null, false);
          else newEgg(1, v, false);
        });
      });
    });
  }

  function updateSoundBtn() {
    var b = $('btn-sound');
    if (b) b.textContent = soundOn ? '音效：開' : '音效：關';
  }

  function agumonState(extra) {
    var s = window.Engine.defaultState(1);
    s.mon = 'agumon';
    s.hunger = 3;
    s.strength = 2;
    s.train = 8;
    s.battles = 10;
    s.wins = 7;
    s.losses = 3;
    s.weight = 20;
    s.gameTime = 3 * 86400 + 12 * 3600;
    s.stageEnteredGame = 2 * 86400;
    s.poop = 0;
    s.lights = true;
    s.sleeping = false;
    s.injured = false;
    s.dead = false;
    s.dp = 3;
    s.dpMax = 4;
    s.speed = 1;
    // 10:34:05 — (clockOffset + gameTime) % 86400. Mid-morning, 5 filled second-triangles.
    s.clockOffset = 10 * 3600 + 34 * 60 + 5 - 12 * 3600 + 86400;
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }

  function applyShot(name) {
    shotMode = true;
    hideAllOverlays();
    var rh = document.querySelector('.rotate-hint');
    if (rh) rh.style.display = 'none';
    state = agumonState();
    view = 'play';
    sel = -1;
    try {
      var ep = new URLSearchParams(location.search).get('egg');
      if (ep && DM20_EGGS[ep]) { state.eggKind = ep; state.version = 'special'; }
      else if (ep && /^[1-5]$/.test(ep)) { state.eggKind = 'ver' + ep; state.version = parseInt(ep, 10); }
      else if ((ep && /^dv1999/.test(String(ep))) || (name && String(name).indexOf('digivice') === 0)) {
        if (window.DigiviceEngine) {
          var eggDv = 'dv1999_v1';
          if (ep && /^dv1999/.test(ep)) eggDv = ep;
          else if (name && /digivice-v2/.test(String(name))) eggDv = 'dv1999_v2';
          state = window.DigiviceEngine.defaultState(eggDv);
          // Shot setup: pick first partner (Agumon line), SET done, Child form,
          // mid-area so map/battle shots have something to show.
          if (eggDv === 'dv1999_v2' && window.DigiviceEngine.joinSpecial) {
            // Ver.2 is Hikari's pink unit; Tailmon so the partner shell matches.
            state.party = [];
            state.recruited = {};
            window.DigiviceEngine.joinSpecial(state, 'tailmon');
            state.active = 0;
            state.phase = 'setClock';
          } else {
            window.DigiviceEngine.pickPartner(state, 0);
          }
          state.clock = { h12: 10, min: 34, pm: false, field: 'h' };
          window.DigiviceEngine.confirmClock(state);
          state.gameTime = window.DigiviceData ? window.DigiviceData.CHILD_EVOLVE_SEC + 1 : 301;
          window.DigiviceEngine.tick(state, Date.now());
          var pDv = window.DigiviceEngine.active(state);
          if (pDv && pDv.stage === 'II') {
            // Force the "shortly" Child evo for the screenshot.
            state.childEvolveAt = 0;
            window.DigiviceEngine.tick(state, Date.now() + 50);
          }
          state.clockOffset = 10 * 3600 + 34 * 60 - (state.gameTime || 0);
        }
      }
      else if ((ep && /^pen_20th/.test(String(ep))) || (name && String(name).indexOf('pen-20th') === 0)) {
        if (window.Pen20Engine) {
          var egg20 = 'pen_20th_sk';
          if (ep && /^pen_20th/.test(ep)) egg20 = ep;
          else if (name && /pen-20th-sb/.test(String(name))) egg20 = 'pen_20th_sb';
          state = window.Pen20Engine.defaultState(egg20);
          state.clockInitialized = true;
          state.clockSet = { on: false, h24: 10, min: 34 };
          state.gameTime = 70;
          state.clockOffset = 10 * 3600 + 34 * 60 + 5 - 70;
          state.lastReal = Date.now();
          window.Pen20Engine.tick(state, Date.now());
          var p0 = state.pets && state.pets[0];
          if (p0 && (p0.mon === 'egg' || p0.level === 'egg')) {
            var baby = (window.Pen20Data && window.Pen20Data.baby1ForEgg(p0.eggId)) || 'bubb';
            window.Pen20Engine.applyMon(p0, baby, state.gameTime);
            p0.hunger = 4; p0.strength = 3; p0.calling = false;
            if (window.Pen20Engine.albumAdd) window.Pen20Engine.albumAdd(state, baby);
          } else if (p0) {
            p0.hunger = 4; p0.strength = 3; p0.calling = false;
          }
          state.lights = true;
        }
      }
      else if ((ep && /^pen_/.test(String(ep))) || (name && String(name).indexOf('pen-') === 0)) {
        if (window.PendulumEngine) {
          var eggKind = 'pen_1_0';
          if (ep && /^pen_/.test(ep)) eggKind = ep;
          else if (name) {
            var mm = String(name).match(/^pen-(zero|[0-9]+-[0-9]+)/);
            if (mm) eggKind = mm[1] === 'zero' ? 'pen_zero' : 'pen_' + mm[1].replace(/-/g, '_');
          }
          state = window.PendulumEngine.defaultState(eggKind);
          state.clockInitialized = true;
          state.clockSet = { on: false, h24: 10, min: 34 };
          state.gameTime = 0;
          state.clockOffset = 10 * 3600 + 34 * 60 + 5;
          var V = window.PendulumData && window.PendulumData.versionForEgg(eggKind);
          state.mon = (V && V.idleMon) || 'tentomon';
          var pm = window.PendulumData && window.PendulumData.monster(state.mon, state.version);
          state.weight = (pm && pm.minWeight) || 15;
          state.hunger = 4;
          state.strength = 3;
          state.dpQ = 12;
          state.dpMaxQ = 16;
          state.ageDays = 3;
          state.battles = 12;
          state.wins = 8;
          state.losses = 4;
          state.effort = 16;
          state.lights = true;
          state.sleeping = false;
          state.tired = false;
        }
      }
    } catch (eEgg) {}
    applyShell();
    walk.x = 8; walk.dir = -1;
    if (isDigivice() && window.DigiviceEngine && window.Dv1999UI) {
      window.Dv1999UI.resetUi();
      var shot = String(name || '');
      if (shot === 'map' || shot === 'digivice-map' || /map/.test(shot)) {
        window.Dv1999UI.setScreen('map');
        view = 'play';
      } else if (shot === 'battle' || shot === 'digivice-battle' || /battle/.test(shot)) {
        var E = window.DigiviceEngine;
        var Da = window.DigiviceData;
        var p = E.active(state);
        if (p && p.stage === 'II') {
          state.childEvolveAt = 0;
          E.tick(state, Date.now() + 20);
        }
        state.encounter = { id: 'gizamon', isBoss: false, optional: false };
        var btl = E.startBattle(state, { encounter: state.encounter });
        if (btl) {
          btl.phase = 'options';
          window.Dv1999UI.setScreen('battle');
        }
        view = 'play';
      } else {
        window.Dv1999UI.setScreen('main');
        view = 'play';
      }
    } else if (name === 'idle' || name === 'idle1280') {
      view = 'play';
    } else if (name === 'menuicon') {
      sel = 0;
    } else if (name === 'status' || name === 'status-age') {
      view = 'status'; statusPage = 0;
    } else if (name === 'status-hunger') {
      view = 'status'; statusPage = 1;
    } else if (name === 'status-strength') {
      view = 'status'; statusPage = 2;
    } else if (name === 'status-effort') {
      view = 'status';
      var ep = statusPages().indexOf('effort');
      statusPage = ep >= 0 ? ep : 3;
    } else if (name === 'status-dp') {
      view = 'status';
      var dp = statusPages().indexOf('dp');
      statusPage = dp >= 0 ? dp : 3;
    } else if (name === 'status-win') {
      view = 'status';
      var wp = statusPages().indexOf('win');
      statusPage = wp >= 0 ? wp : statusPages().length - 1;
    } else if (name === 'light') {
      // Always show the DM20 On/Off menu for this shot (Humulos labels).
      state.eggKind = 'zuba';
      state.version = 'special';
      applyShell();
      lightSel = 0;
      view = 'lightMenu';
    } else if (name === 'album') {
      albumSel = 0; view = 'album';
    } else if (name === 'eat') {
      view = 'play';
      eatAnim = { on: true, t: 2, kind: 'meat', refused: false };
    } else if (name === 'protein') {
      view = 'play';
      eatAnim = { on: true, t: 3, kind: 'protein', refused: false };
    } else if (name === 'poop' || /^poop[1-4]$/.test(name)) {
      var pn = name === 'poop' ? 2 : parseInt(name.charAt(4), 10);
      state.poop = pn;
      // Shift the monster left of the piles, as the real device does.
      walk.x = Math.max(0, FW - 16 - Math.ceil(pn / 2) * 8);
      walk.dir = 1;
    } else if (name === 'flush') {
      state.poop = 0;
      flushAnim = { on: true, t: 8, n: 2, off: 8 };
    } else if (name === 'sleep' || name === 'night' || name === 'night-1997') {
      state.eggKind = 'ver1';
      state.version = 1;
      applyShell();
      state.sleeping = true;
      state.lights = false;
      state.poop = 2;
      view = 'play';
    } else if (name === 'night-dm20') {
      state.eggKind = 'zuba';
      state.version = 'special';
      applyShell();
      state.sleeping = true;
      state.lights = false;
      state.poop = 2;
      view = 'play';
    } else if (name === 'night-press') {
      // 1997 lights off, then B with no icon: the clock paints on paper.
      state.eggKind = 'ver1';
      state.version = 1;
      applyShell();
      state.sleeping = true;
      state.lights = false;
      view = 'clock';
    } else if (name === 'clockset') {
      view = 'clock';
      if (engine() && engine().beginClockSet) engine().beginClockSet(state);
    } else if (name === 'sick') {
      state.injured = true;
    } else if (name === 'train') {
      startTrain();
      train.t = 2;
      train.done = false;
      view = 'train';
    } else if (name === 'battle' || name === 'battle-hit') {
      battleFx = { t: 4, foe: 'gabumon', result: 'win', active: true };
      view = 'battle';
    } else if (name === 'grave') {
      state.dead = true;
      view = 'grave';
    } else if (name === 'menu') {
      showOverlay('overlay-extra', true);
    } else if (name === 'clock') {
      view = 'clock';
    } else if (name === 'food') {
      view = 'food'; foodSel = 0;
    } else if (name === 'pen-idle' || name === 'pen-shell' ||
               /^pen-(zero|[0-9]+-[0-9]+)(-idle|-shell)?$/.test(name)) {
      view = 'play';
    } else if (name === 'pen-status') {
      view = 'status';
      if (window.PendulumUI) window.PendulumUI.setStatusPage(0);
    } else if (name === 'pen-clock') {
      view = 'clock';
    } else if (name === 'pen-clockset') {
      view = 'clock';
      if (engine() && engine().beginClockSet) engine().beginClockSet(state);
    } else if (name === 'pen-train' || name === 'pen-train-count') {
      view = 'train';
      if (window.PendulumUI) window.PendulumUI.setTrainForShot('count', { shakes: 5, startedAt: 0 });
    } else if (name === 'pen-night' || name === 'night-pen') {
      state.tired = true;
      state.sleeping = true;
      state.lights = false;
      view = 'play';
    } else if (name === 'pen-night-awake' || name === 'night-pen-baby') {
      // Baby I, lamp off, awake: solid black (no Z).
      if (window.PendulumEngine && (!state || state.family !== 'pendulum')) {
        // defaultState already applied if egg=pen_*
      }
      state.tired = false;
      state.sleeping = false;
      state.lights = false;
      if (!state.mon || state.mon === 'pen_egg') state.mon = 'babumon';
      view = 'play';
    } else if (name === 'night-dm20-babydmon') {
      state = window.Engine.defaultState('special', 'dra_blue');
      state.mon = 'babydmon';
      state.clockInitialized = true;
      state.sleeping = true;
      state.lights = false;
      state.napUntil = 10800;
      applyShell();
      view = 'play';
    } else if (name === 'night-1997-baby') {
      state = agumonState();
      state.eggKind = 'ver1';
      state.version = 1;
      state.mon = 'botamon';
      state.sleeping = false;
      state.lights = false;
      applyShell();
      view = 'play';
    } else if (name === 'pen-food') {
      view = 'food';
    } else if (name === 'pen-connect') {
      view = 'connect';
    } else if (name === 'pen-grave') {
      state.dead = true;
      view = 'grave';
    } else if (name === 'pen-buttons' || name === 'buttons-pressed') {
      view = 'play';
      if (window.DeviceButtons) {
        ['btn-a', 'btn-b', 'btn-c'].forEach(function (id) {
          window.DeviceButtons.setPressed($(id), true);
        });
      }
    } else if (name === 'pen-20th-sk-shell' || name === 'pen-20th-sb-shell' ||
               name === 'pen-20th-sk-idle' || name === 'pen-20th-sb-idle') {
      view = 'play';
      sel = -1;
    } else if (name === 'pen-20th-fridge' || name === 'pen-20th-sk-fridge' || name === 'pen-20th-lights-fridge') {
      if (state && state.pets && state.pets[0] && window.Pen20Engine) {
        var fp = state.pets[0];
        fp.frozen = true;
        fp.tired = false;
        fp.sleeping = false;
        fp.calling = false;
      }
      view = 'play';
      sel = -1;
    } else if (name === 'pen-20th-sleep' || name === 'pen-20th-sk-sleep' || name === 'pen-20th-lights-sleep') {
      if (state && state.pets && state.pets[0]) {
        var sp = state.pets[0];
        sp.sleeping = true;
        sp.putToBed = true;
        sp.tired = false;
        sp.frozen = false;
        sp.calling = false;
      }
      view = 'play';
      sel = -1;
    } else if (name === 'pen-20th-light') {
      if (window.Pen20UI && window.Pen20UI.setSubSel) window.Pen20UI.setSubSel(0);
      view = 'lightMenu';
    }
  }

  function debugMode() {
    try { return new URLSearchParams(location.search).get('debug') === '1'; }
    catch (e) { return false; }
  }

  function applyDebugUi() {
    var box = $('speed-debug');
    if (box) {
      if (debugMode()) box.removeAttribute('hidden');
      else box.setAttribute('hidden', '');
    }
  }

  function bind() {
    applyDebugUi();
    canvas = $('screen');
    canvas.width = LCD_W;
    canvas.height = LCD_H;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    sizeLcd();
    window.addEventListener('resize', sizeLcd);
    window.addEventListener('orientationchange', function () { setTimeout(sizeLcd, 350); });

    try { soundOn = localStorage.getItem('digivice-sound') === '1'; } catch (e) {}
    updateSoundBtn();

    function tryChord() {
      // Mute, clock SET, and the grave's new-egg chord only count while
      // both keys are still down. A tap on A, then a tap on B or C, is
      // select then confirm/cancel — not the sound toggle.
      var r = maybeNewEggCombo() || maybeClockSetCombo() || maybeMuteCombo();
      if (!r && isPen20() && window.Pen20UI && window.Pen20UI.maybeChord(penHost(), keyA, keyC)) {
        r = true;
      }
      if (!r && isPen20() && window.Pen20UI && window.Pen20UI.maybeAB && window.Pen20UI.maybeAB(penHost(), keyA, keyB)) {
        r = true;
      }
      if (!r && isPendulum() && window.PendulumUI && window.PendulumUI.maybeChord(penHost(), keyA, keyC)) {
        r = true;
      }
      if (r) { keyA = keyB = keyC = false; }
      return r;
    }
    function downA(e) {
      keyA = true;
      if (tryChord()) return;
      if (isClockSetView()) {
        getClockHold().onPointerDown('h');
      }
    }
    function upA() { keyA = false; getClockHold().onPointerUp(); }
    function downB(e) {
      keyB = true;
      if (tryChord()) return;
      if (isClockSetView()) {
        getClockHold().onPointerDown('m');
      }
    }
    function upB() { keyB = false; getClockHold().onPointerUp(); }
    function downC(e) { keyC = true; tryChord(); }
    function upC() { keyC = false; }
    function resetTap(e) {
      if (e) e.preventDefault();
      beep();
      if (view === 'grave' || view === 'dying' || (state && state.dead)) {
        keyA = true; keyC = true; maybeNewEggCombo(); keyA = keyC = false;
        return;
      }
      // The pinhole resets a living pet too. Confirm so a stray tap
      // does not wipe the raise.
      if (!window.confirm('重置會清掉這隻數碼寶貝，重新選蛋。確定嗎？')) return;
      hideAllOverlays();
      fillEggGrid();
      showOverlay('overlay-egg', true);
    }

    // Physical-feel buttons: pointer events (iOS 15 :active is not enough).
    // Visual class is instant. Beep on pointerdown; click must not double-beep.
    // NEVER vibrate.
    function bindPad(el, onDown, onUp) {
      if (!el) return;
      if (window.DeviceButtons && window.DeviceButtons.attach) {
        window.DeviceButtons.attach(el, {
          unlock: unlockAudio,
          shouldBeep: soundEnabled,
          beep: function () {
            suppressClickBeep = true;
            if (window.DeviceAudio) window.DeviceAudio.beep(true);
          },
          onDown: onDown,
          onUp: function (ev) {
            if (onUp) onUp(ev);
            setTimeout(function () { suppressClickBeep = false; }, 400);
          }
        });
      } else {
        el.addEventListener('pointerdown', function (ev) { unlockAudio(); onDown && onDown(ev); });
        el.addEventListener('pointerup', onUp);
        ['pointercancel', 'pointerleave'].forEach(function (evn) {
          el.addEventListener(evn, onUp);
        });
      }
    }
    $('btn-a').addEventListener('click', pressA);
    $('btn-b').addEventListener('click', pressB);
    $('btn-c').addEventListener('click', pressC);
    bindPad($('btn-a'), downA, upA);
    bindPad($('btn-b'), downB, upB);
    bindPad($('btn-c'), downC, upC);
    bindPad($('btn-reset'), function (ev) {}, function (ev) {});
    $('btn-reset').addEventListener('click', resetTap);
    function keyPressVisual(id, on) {
      if (window.DeviceButtons) window.DeviceButtons.setPressed($(id), on);
    }
    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      var k = e.key;
      unlockAudio();
      if (k === 'a' || k === 'A' || k === 'ArrowLeft') {
        keyA = true; keyPressVisual('btn-a', true);
        if (isClockSetView()) { getClockHold().onKeyDown('h'); }
        else pressA();
        e.preventDefault();
      } else if (k === 'b' || k === 'B' || k === 'Enter' || k === 'ArrowRight') {
        keyB = true; keyPressVisual('btn-b', true);
        if (isClockSetView()) { getClockHold().onKeyDown('m'); }
        else pressB();
        e.preventDefault();
      } else if (k === 'c' || k === 'C' || k === 'Escape') { keyC = true; keyPressVisual('btn-c', true); pressC(); e.preventDefault(); }
    });
    document.addEventListener('keyup', function (e) {
      var k = e.key;
      if (k === 'a' || k === 'A' || k === 'ArrowLeft') { keyA = false; keyPressVisual('btn-a', false); getClockHold().onKeyUp(); }
      else if (k === 'b' || k === 'B' || k === 'Enter' || k === 'ArrowRight') { keyB = false; keyPressVisual('btn-b', false); getClockHold().onKeyUp(); }
      else if (k === 'c' || k === 'C' || k === 'Escape') { keyC = false; keyPressVisual('btn-c', false); }
    });
    // COUNT-screen swipe fallback for shake (used when DeviceMotion is denied).
    if (canvas) {
      canvas.style.touchAction = 'manipulation';
      canvas.addEventListener('pointerdown', function (ev) {
        if (isDigivice() && window.Dv1999UI) window.Dv1999UI.onCanvasPointerDown(penHost(), ev);
        if (isPen20() && window.Pen20UI) window.Pen20UI.onCanvasPointerDown(penHost(), ev);
        if (isPendulum() && window.PendulumUI) window.PendulumUI.onCanvasPointerDown(penHost(), ev);
      });
      canvas.addEventListener('pointermove', function (ev) {
        if (isDigivice() && window.Dv1999UI) window.Dv1999UI.onCanvasPointerMove(penHost(), ev);
        if (isPen20() && window.Pen20UI) window.Pen20UI.onCanvasPointerMove(penHost(), ev);
        if (isPendulum() && window.PendulumUI) window.PendulumUI.onCanvasPointerMove(penHost(), ev);
      });
      canvas.addEventListener('pointerup', function (ev) {
        if (isDigivice() && window.Dv1999UI) window.Dv1999UI.onCanvasPointerUp(ev);
        if (isPen20() && window.Pen20UI) window.Pen20UI.onCanvasPointerUp(ev);
        if (isPendulum() && window.PendulumUI) window.PendulumUI.onCanvasPointerUp(ev);
      });
      canvas.addEventListener('pointercancel', function (ev) {
        if (isDigivice() && window.Dv1999UI) window.Dv1999UI.onCanvasPointerUp(ev);
        if (isPen20() && window.Pen20UI) window.Pen20UI.onCanvasPointerUp(ev);
        if (isPendulum() && window.PendulumUI) window.PendulumUI.onCanvasPointerUp(ev);
      });
    }

    document.querySelectorAll('.face-icon').forEach(function (el) {
      el.addEventListener('click', function () {
        lastKeyAt = Date.now();
        beep();
        var id = el.getAttribute('data-icon');
        if (id === 'CALL') return;
        if (anyOverlay()) return;
        if (view === 'grave' || view === 'dying' || view === 'evo' || view === 'battle') return;
        var idx = selectable().indexOf(id);
        if (idx < 0) return;
        if (sel === idx && view === 'play') confirmSel();
        else {
          // jump to that icon (selected); second tap / B confirms
          view = 'play';
          sel = idx;
        }
      });
    });

    $('extra-btn').addEventListener('click', function () {
      if ($('overlay-extra').classList.contains('show')) hideAllOverlays();
      else { hideAllOverlays(); fillStepsPanels(); showOverlay('overlay-extra', true); }
    });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        stepsPromptDismissed = true;
        hideAllOverlays();
      });
    });
    // Tapping the dimmed backdrop also dismisses the steps prompt / help
    // (the device C button is covered by the overlay, so this is an exit).
    ['overlay-steps-prompt', 'overlay-steps-help'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('click', function (e) {
        if (e.target === el) {
          stepsPromptDismissed = true;
          hideAllOverlays();
        }
      });
    });
    $('btn-settings').addEventListener('click', function () {
      hideAllOverlays();
      if (state && $('speed')) $('speed').value = String(state.speed || 1);
      updateSoundBtn();
      showOverlay('overlay-settings', true);
    });
    $('btn-help').addEventListener('click', function () {
      hideAllOverlays();
      showOverlay('overlay-help', true);
    });
    $('btn-export').addEventListener('click', function () { hideAllOverlays(); openExport(); });
    $('btn-import').addEventListener('click', function () { hideAllOverlays(); showOverlay('overlay-import', true); });
    $('btn-newgame').addEventListener('click', function () {
      hideAllOverlays();
      fillEggGrid();
      showOverlay('overlay-egg', true);
    });
    $('btn-install').addEventListener('click', function () { hideAllOverlays(); showOverlay('overlay-install', true); });
    $('btn-pvp').addEventListener('click', function () {
      hideAllOverlays();
      fillJogress();
      showOverlay('overlay-battle', true);
    });
    $('btn-sound').addEventListener('click', function () {
      toggleSound();
    });
    if ($('speed')) {
      $('speed').addEventListener('change', function () {
        if (!state) return;
        state.speed = parseInt($('speed').value, 10) || 1;
        state.speedMigrated = true;
        persist();
        toast('時間速度 ×' + state.speed);
      });
    }
    $('copy-export').addEventListener('click', function () {
      var t = $('export-code').value;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('已複製存檔碼'); });
      else { $('export-code').select(); document.execCommand('copy'); toast('已複製存檔碼'); }
    });
    $('do-import').addEventListener('click', function () { doImportText($('import-code').value); });
    $('start-scan').addEventListener('click', startScan);
    $('stop-scan').addEventListener('click', stopScan);
    if ($('pvp-offer')) $('pvp-offer').addEventListener('click', showOffer);
    if ($('pvp-accept')) $('pvp-accept').addEventListener('click', acceptOffer);
    if ($('pvp-result')) $('pvp-result').addEventListener('click', applyPvpResult);
    if ($('lobby-list')) $('lobby-list').addEventListener('click', onLobbyClick);

    document.querySelectorAll('.js-sync-steps').forEach(function (btn) {
      btn.addEventListener('click', function () { runShortcut(); });
    });
    document.querySelectorAll('.js-motion-steps').forEach(function (btn) {
      btn.addEventListener('click', function () { requestMotion(); });
    });
    var shakeBtn = $('btn-shake-fallback');
    if (shakeBtn) {
      shakeBtn.addEventListener('click', function () {
        if (window.PendulumShake) window.PendulumShake.simulate(1);
        if (isDigivice() && window.Dv1999UI) window.Dv1999UI.noteShakeOnState(penHost(), 1);
        if (isPen20() && window.Pen20UI) window.Pen20UI.noteShakeOnState(penHost(), 1);
        if (isPendulum() && window.PendulumUI) window.PendulumUI.noteShakeOnState(penHost(), 1);
        toast('模擬搖動 +1');
      });
    }
    document.querySelectorAll('.js-steps-help').forEach(function (btn) {
      btn.addEventListener('click', function () {
        hideAllOverlays();
        showOverlay('overlay-steps-help', true);
      });
    });

    var jog = $('jogress-box');
    if (jog) {
      jog.addEventListener('click', function (e) {
        var ev = e.target.getAttribute && e.target.getAttribute('data-jogress-evolve');
        var tg = e.target.getAttribute && e.target.getAttribute('data-jogress');
        if (ev && window.Engine.tryJogress) {
          var fromId = state.mon;
          var r = window.Engine.tryJogress(state, ev);
          persist();
          hideAllOverlays();
          if (r && r.ok) {
            evoFx = { t: 0, from: fromId, to: state.mon };
            view = 'evo';
          }
        } else if (tg) {
          hideAllOverlays();
          cpuBattle(true);
        }
      });
    }

    applyShellLayout();
    applyShell();
    window.addEventListener('resize', function () { sizeLcd(); updateRotateHint(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { sizeLcd(); updateRotateHint(); tryLockOrient(currentDevice().orient); }, 300);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { sizeLcd(); });
    }
    var shellArt = $('shell-art');
    if (shellArt) shellArt.addEventListener('load', function () { sizeLcd(); });

    ingestUrl();
    // pageshow fires on iOS for the initial load, bfcache restore, coming
    // back from shortcuts://, and some resumes. Only ingest ?steps= here —
    // never reopen the launch prompt (that is cold-launch only, below).
    window.addEventListener('pageshow', function () { catchUpNow(); ingestUrl(); });
    window.addEventListener('hashchange', function () { ingestUrl(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        catchUpNow();
        ingestUrl();
        if (lobbyOpen_()) startLobby();
      } else {
        persist();
        if (lobbyOpen_()) stopLobby();
      }
    });
    // v31: iOS 15 standalone may freeze rAF/timers in the background or
    // kill the page. Save on hide, catch up immediately on resume, and keep
    // a 1 s watchdog in case rAF stalls after a resume.
    window.addEventListener('pagehide', function () {
      persist();
      lobbyLeaveBeacon();
    });
    window.addEventListener('focus', function () { catchUpNow(); });
    setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastFrameAt > 1500) frameStep();
    }, 1000);

    // v35: user sprite overrides (assets/user-sprites/manifest.json).
    if (window.UserSprites && window.UserSprites.load) {
      window.UserSprites.onChange(function () { cache = {}; });
      try { window.UserSprites.load(); } catch (e) {}
    }
    if ('serviceWorker' in navigator && !shotMode) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
      try {
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      } catch (eP) {}
    }
    window.VpetDebug = {
      clockSeconds: function () {
        return (window.Devices && window.Devices.clockSeconds) ? window.Devices.clockSeconds(state) : null;
      },
      family: function () { return state && state.family; },
      gameTime: function () { return state ? (state.gameTime || 0) : 0; },
      dead: function () { return !!(state && state.dead); },
      /* v33 test hook (LCD text audit): show one screen with the given
         sub-state and draw it once. No effect on the save. */
      renderView: function (v, o) {
        o = o || {};
        if (!state) return null;
        if (o.state) for (var k in o.state) state[k] = o.state[k];
        view = v;
        if ('sel' in o) sel = o.sel;
        if ('statusPage' in o) statusPage = o.statusPage;
        if ('foodSel' in o) foodSel = o.foodSel;
        if ('battleSel' in o) battleSel = o.battleSel;
        if ('lightSel' in o) lightSel = o.lightSel;
        if ('albumSel' in o) albumSel = o.albumSel;
        if ('connectSel' in o) connectSel = o.connectSel;
        if (o.train) { for (var t in o.train) train[t] = o.train[t]; }
        if (o.charge) { for (var c in o.charge) charge[c] = o.charge[c]; }
        if (o.evoFx) { for (var e in o.evoFx) evoFx[e] = o.evoFx[e]; }
        if (o.battleFx) { for (var b in o.battleFx) battleFx[b] = o.battleFx[b]; }
        draw();
        return view;
      },
      statusPageCount: function () { return statusPages().length; },
      walkX: function () { return walk.x; }
    };

    var params = new URLSearchParams(location.search);
    var shot = params.get('shot') || params.get('debug');
    if (shot && shot !== '1') {
      applyShot(shot);
    } else if (window.SaveIO.hasLocal()) {
      try { loadGame(window.SaveIO.loadLocal()); } catch (e) { fillEggGrid(); showOverlay('overlay-egg', true); }
    } else {
      fillEggGrid();
      var cancel = $('egg-cancel');
      if (cancel) cancel.style.display = 'none';
      showOverlay('overlay-egg', true);
    }

    maybeShowStepsPrompt();

    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', bind);

  window.DigiviceUI = {
    applyShot: applyShot,
    SELECTABLE: SELECTABLE,
    getFoodSel: function () { return foodSel; },
    setFoodSel: function (n) { foodSel = n ? 1 : 0; },
    is1997PlayDark: is1997PlayDark
  };
})();
