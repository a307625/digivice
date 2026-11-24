/**
 * 神聖計畫 / Digivice (1999) circular-LCD UI.
 * Own screens: partner pick, clock SET, Status / Map / Slot / Card /
 * Medical / VS, 7-dot map, battle options + mash-A-to-go-first, HELP CATCH.
 * No 4+4 hunger icons, no 1997 lights/poop/feed.
 *
 * Canvas is 144×144 (36 logical dots × 4 px). Official sprites are 26×34
 * at 1 original LCD dot = 4 canvas px. The window is circular.
 */
(function (root) {
  'use strict';

  var DOT = 4;
  var LW = 36, LH = 36;
  var CW = LW * DOT, CH = LH * DOT; // 144
  var PAPER = '#c6cbb8';
  var INK = '#1a1c16';
  var ANIM_MS = 500;

  // 3×5 caps + digits for a 36-dot circular field.
  var FONT = {
    '0': ['111','101','101','101','111'],
    '1': ['010','110','010','010','111'],
    '2': ['111','001','111','100','111'],
    '3': ['111','001','111','001','111'],
    '4': ['101','101','111','001','001'],
    '5': ['111','100','111','001','111'],
    '6': ['111','100','111','101','111'],
    '7': ['111','001','001','001','001'],
    '8': ['111','101','111','101','111'],
    '9': ['111','101','111','001','111'],
    A: ['010','101','111','101','101'],
    B: ['110','101','110','101','110'],
    C: ['011','100','100','100','011'],
    D: ['110','101','101','101','110'],
    E: ['111','100','110','100','111'],
    F: ['111','100','110','100','100'],
    G: ['011','100','101','101','011'],
    H: ['101','101','111','101','101'],
    I: ['111','010','010','010','111'],
    J: ['001','001','001','101','010'],
    K: ['101','101','110','101','101'],
    L: ['100','100','100','100','111'],
    M: ['101','111','111','101','101'],
    N: ['110','101','101','101','101'],
    O: ['010','101','101','101','010'],
    P: ['110','101','110','100','100'],
    Q: ['010','101','101','111','001'],
    R: ['110','101','110','101','101'],
    S: ['011','100','010','001','110'],
    T: ['111','010','010','010','010'],
    U: ['101','101','101','101','111'],
    V: ['101','101','101','101','010'],
    W: ['101','101','111','111','101'],
    X: ['101','101','010','101','101'],
    Y: ['101','101','010','010','010'],
    Z: ['111','001','010','100','111'],
    ':': ['000','010','000','010','000'],
    '/': ['001','001','010','100','100'],
    '-': ['000','000','111','000','000'],
    '.': ['000','000','000','000','010'],
    '+': ['000','010','111','010','000'],
    '?': ['010','101','001','010','010'],
    '!': ['010','010','010','000','010'],
    ' ': ['000','000','000','000','000'],
    '*': ['101','010','111','010','101']
  };

  var U = {
    screen: 'main',
    menuI: 0,
    statusI: 0,
    partyI: 0,
    battleI: 0,
    switchI: 0,
    vsI: 0,
    mash: 0,
    countBeat: 0,
    countAt: 0,
    mashAt: 0,
    toast: null,
    toastUntil: 0
  };

  function Eng() { return root.DigiviceEngine; }
  function Data() { return root.DigiviceData; }
  function Spr() { return root.DigiviceSprites; }

  function ensureCanvas(host) {
    var c = (host && host.ctx && host.ctx.canvas) || null;
    if (!c) return;
    if (c.width !== CW || c.height !== CH) {
      c.width = CW;
      c.height = CH;
    }
  }

  function paper(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CW / 2, CH / 2, CW / 2 - 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, CW, CH);
    // Subtle 2-px scan (LCD rows)
    ctx.fillStyle = 'rgba(80, 86, 70, 0.07)';
    for (var y = 0; y < CH; y += 2) ctx.fillRect(0, y, CW, 1);
    return ctx;
  }

  function endPaper(ctx) { ctx.restore(); }

  function fillDot(ctx, x, y, on) {
    if (!on) return;
    ctx.fillStyle = INK;
    ctx.fillRect(x * DOT, y * DOT, DOT, DOT);
  }

  function glyph(ctx, ch, dx, dy, s) {
    s = s || 1;
    var g = FONT[String(ch).toUpperCase()] || FONT['?'];
    ctx.fillStyle = INK;
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 3; x++) {
        if (g[y].charAt(x) === '1') {
          ctx.fillRect((dx + x * s) * DOT, (dy + y * s) * DOT, s * DOT, s * DOT);
        }
      }
    }
  }

  function text(ctx, str, dx, dy, s) {
    s = s || 1;
    str = String(str == null ? '' : str).toUpperCase();
    var adv = 3 * s + 1;
    for (var i = 0; i < str.length; i++) glyph(ctx, str.charAt(i), dx + i * adv, dy, s);
    var A = root.VpetLcdAudit;
    if (A && A.on && str.length) A.rec({ kind: 'dv', text: str, x: dx * DOT, y: dy * DOT, w: textWidth(str, s) * DOT, h: 5 * s * DOT, scale: s * DOT });
  }

  function textWidth(str, s) {
    s = s || 1;
    var n = String(str || '').length;
    return n ? n * (3 * s + 1) - 1 : 0;
  }

  /* v33: one dot size for all text (s is always 1) and every line stays
     inside the round window. chordSpan(dy) is the widest run of whole dots
     that is inside the circle on all 5 rows of a line starting at dy. */
  var R_DOT = LW / 2;
  function chordSpan(dy) {
    var half = Infinity;
    for (var r = dy; r < dy + 5; r++) {
      var top = r, bot = r + 1;
      var far = Math.max(Math.abs(top - R_DOT), Math.abs(bot - R_DOT));
      var h = far >= R_DOT ? 0 : Math.sqrt(R_DOT * R_DOT - far * far);
      if (h < half) half = h;
    }
    var x0 = Math.ceil(R_DOT - half), x1 = Math.floor(R_DOT + half);
    return { x0: x0, x1: x1, w: Math.max(0, x1 - x0) };
  }
  var TEXT_TOP = 4, TEXT_BOTTOM = 27;   // lines that keep >= 22 dots of chord
  function clampLine(dy) { return Math.max(TEXT_TOP, Math.min(TEXT_BOTTOM, dy)); }
  var SCROLL_HOLD = 900, SCROLL_STEP = 160;
  function scrollText(ctx, str, x0, dy, maxW, still) {
    str = String(str == null ? '' : str).toUpperCase();
    var w = textWidth(str, 1);
    if (w <= maxW) { text(ctx, str, x0, dy, 1); return; }
    var over = w - maxW;
    var period = SCROLL_HOLD * 2 + over * SCROLL_STEP;
    var t = still ? 0 : (Date.now() % period);
    var off = t < SCROLL_HOLD ? 0 : Math.min(over, Math.floor((t - SCROLL_HOLD) / SCROLL_STEP));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 * DOT, dy * DOT, maxW * DOT, 5 * DOT);
    ctx.clip();
    var A = root.VpetLcdAudit, was = A && A.on;
    if (A) A.on = false;
    try { text(ctx, str, x0 - off, dy, 1); } finally { if (A) A.on = was; }
    ctx.restore();
    if (A && A.on) A.rec({ kind: 'dv-scroll', text: str, x: x0 * DOT, y: dy * DOT, w: maxW * DOT, h: 5 * DOT, scale: DOT });
  }
  function textC(ctx, str, cy) {
    cy = clampLine(cy);
    var c = chordSpan(cy);
    var w = textWidth(str, 1);
    if (w <= c.w) text(ctx, str, Math.max(c.x0, Math.floor((LW - w) / 2)), cy, 1);
    else scrollText(ctx, str, c.x0, cy, c.w);
  }
  /* Menu line: cursor at the chord's left edge, label in the rest. */
  function rowText(ctx, str, dy, selected) {
    dy = clampLine(dy);
    var c = chordSpan(dy);
    if (selected) text(ctx, '>', c.x0, dy, 1);
    scrollText(ctx, str, c.x0 + 4, dy, c.w - 4, !selected);
  }

  // Official 26×34 sprites cannot sit at 1:1 in a 36-dot circle together
  // with the clock (y=3–8) without overflowing the bottom of the window.
  // FIT_S scales each original sprite pixel; 0.70 keeps the body inside a
  // r≈17.5 circle under the clock, matching how the real 1999 screen frames
  // the mon with a margin.
  var FIT_S = 0.70;

  function blitMon(ctx, id, cxDot, baselineDot) {
    var S = Spr();
    if (!S || !id) return;
    var px = DOT * FIT_S;               // canvas px per original sprite pixel
    var destW = 26 * px, destH = 34 * px;
    var x = cxDot * DOT - destW / 2;
    // Prefer a vertical centre that sits below the clock and inside the
    // circle. baselineDot is kept as a mild bias for battle/map layouts.
    var cy = 20;                        // default centre in dots (below clock)
    if (typeof baselineDot === 'number' && baselineDot < 32) {
      // Callers pass a baseline (feet). Convert to a fitted centre, then
      // clamp so the sprite's AABB stays in the safe circle.
      cy = baselineDot - 17 * FIT_S;
    }
    var top = cy - 17 * FIT_S;
    if (top < 8.2) cy = 8.2 + 17 * FIT_S;   // keep under the clock
    var bot = cy + 17 * FIT_S;
    if (bot > 33.2) cy = 33.2 - 17 * FIT_S;
    var y = cy * DOT - destH / 2;
    S.blit(ctx, id, x, y, px, INK);
  }

  function currentScreen(state) {
    if (!state) return 'main';
    if (state.phase === 'pickPartner') return 'pick';
    if (state.phase === 'setClock') return 'setClock';
    if (state.help && state.help.active && U.screen !== 'helpCatch' && U.screen !== 'battle') {
      // Interrupt to HELP unless already in a fight.
      if (U.screen !== 'help') return 'help';
    }
    if (state.encounter && U.screen !== 'battle') return 'encounter';
    if (state.battle && state.battle.phase === 'result') return 'battleResult';
    if (state.battle) return 'battle';
    return U.screen || 'main';
  }

  function draw(host) {
    if (!host || !host.ctx) return;
    ensureCanvas(host);
    var ctx = host.ctx;
    var state = host.state;
    ctx.imageSmoothingEnabled = false;
    paper(ctx);
    var scr = currentScreen(state);
    if (scr === 'pick') drawPick(ctx, state);
    else if (scr === 'setClock') drawSetClock(ctx, state);
    else if (scr === 'menu') drawMenu(ctx, state);
    else if (scr === 'status') drawStatus(ctx, state);
    else if (scr === 'map') drawMap(ctx, state);
    else if (scr === 'slot') drawStub(ctx, 'SLOT');
    else if (scr === 'card') drawStub(ctx, 'CARD');
    else if (scr === 'medical') drawMedical(ctx, state);
    else if (scr === 'vs') drawVs(ctx, state);
    else if (scr === 'encounter') drawEncounter(ctx, state);
    else if (scr === 'help') drawHelp(ctx, state);
    else if (scr === 'battle' || scr === 'battleResult') drawBattle(ctx, state, host);
    else drawMain(ctx, state, host);
    if (U.toast && Date.now() < U.toastUntil) {
      // small toast at the bottom of the circle
      textC(ctx, U.toast, 30);
    }
    endPaper(ctx);
  }

  function drawMain(ctx, state, host) {
    var E = Eng();
    var p = E && E.active(state);
    var clk = E ? E.clockH24(state) : { h24: 12, min: 0 };
    var h = clk.h24 % 12; if (h === 0) h = 12;
    var am = clk.h24 < 12;
    var hh = (h < 10 ? '0' : '') + h;
    var mm = (clk.min < 10 ? '0' : '') + clk.min;
    // "10:34" is 5 glyphs; at y=4 the circle is wide enough. Full "10:34 AM"
    // was clipped by the circular window.
    textC(ctx, hh + ':' + mm, 3);
    if (p) {
      // Fitted sprite (see blitMon); baseline 35 is clamped inside the circle.
      blitMon(ctx, p.mon, 18, 35);
      // Markers sit inside the circle on rows 9-13 (v33: '!' at col 2 was cut off).
      if (p.injured) text(ctx, 'X', 27, 9, 1);
      if (p.unhappy) text(ctx, '!', 6, 9, 1);
    }
    if (state && E && !E.mapComplete(state)) {
      textC(ctx, String(state.areaRemaining || 0), 31);
    }
  }

  function drawPick(ctx, state) {
    var Da = Data();
    var E = Eng();
    textC(ctx, 'PARTNER', 2);
    var i = state.partnerPick || 0;
    var id = Da.STARTERS[i];
    // Show the Child form (the 7 Chosen) — authentic on-device pick.
    var mon = Da.monAt(id, 1);
    blitMon(ctx, mon, 18, 27);
    textC(ctx, (i + 1) + '/' + Da.STARTERS.length, 31);
  }

  function drawSetClock(ctx, state) {
    var c = state.clock || { h12: 12, min: 0, pm: false, field: 'h' };
    textC(ctx, 'SET TIME', 3);
    var hh = (c.h12 < 10 ? ' ' : '') + c.h12;
    var mm = (c.min < 10 ? '0' : '') + c.min;
    var ap = c.pm ? 'PM' : 'AM';
    textC(ctx, hh + ':' + mm, 12);
    textC(ctx, ap, 24);
    // Field marker
    var label = c.field === 'h' ? 'HOUR' : (c.field === 'm' ? 'MIN' : 'AMPM');
    textC(ctx, label, 31);
  }

  function drawMenu(ctx, state) {
    var Da = Data();
    var names = Da.MENUS;
    textC(ctx, 'MENU', 2);
    // Four lines fit the round window (rows 8-27); the list follows the cursor.
    var rows = 4;
    var start = Math.max(0, Math.min(U.menuI - 1, names.length - rows));
    for (var i = 0; i < Math.min(rows, names.length); i++) {
      var idx = start + i;
      rowText(ctx, names[idx], 8 + i * 5, idx === U.menuI);
    }
  }

  function drawStatus(ctx, state) {
    var E = Eng();
    var p = state.party && state.party[U.partyI];
    if (!p) p = E && E.active(state);
    if (!p) { textC(ctx, 'STATUS', 16); return; }
    var pages = ['MON', 'HP', 'ATK', 'DP', 'WIN'];
    var pg = pages[U.statusI % pages.length];
    textC(ctx, pg, 2);
    if (pg === 'MON') {
      blitMon(ctx, p.mon, 18, 26);
      textC(ctx, p.stage + (p.injured ? ' X' : ''), 31);
    } else if (pg === 'HP') {
      blitMon(ctx, p.mon, 18, 22);
      textC(ctx, String(p.maxHp), 28);
    } else if (pg === 'ATK') {
      blitMon(ctx, p.mon, 18, 22);
      textC(ctx, String(p.atk), 28);
    } else if (pg === 'DP') {
      textC(ctx, 'DP', 12);
      textC(ctx, String(state.dp || 0), 20);
    } else if (pg === 'WIN') {
      textC(ctx, 'WIN', 10);
      textC(ctx, String(p.wins || 0), 18);
      textC(ctx, 'B ' + (p.battles || 0), 30);
    }
  }

  function drawMap(ctx, state) {
    var E = Eng();
    textC(ctx, 'MAP', 2);
    // 7 dots in a loose hex-ish / oval ring, current blinks.
    // Positions in dots, inside the circle.
    var pts = [
      [18, 9],  [25, 13], [27, 20], [22, 26],
      [14, 26], [9, 20],  [11, 13]
    ];
    var cur = state.area || 0;
    var cleared = state.areasCleared || 0;
    var blink = Math.floor(Date.now() / ANIM_MS) % 2 === 0;
    ctx.fillStyle = INK;
    for (var i = 0; i < 7; i++) {
      var x = pts[i][0], y = pts[i][1];
      var on = true;
      if (i === cur && !E.mapComplete(state)) on = blink; // current blinks
      if (i < cleared) {
        // cleared: a small plus / filled 3x3
        ctx.fillRect((x - 1) * DOT, (y - 1) * DOT, 3 * DOT, 3 * DOT);
      } else if (on) {
        ctx.fillRect(x * DOT, y * DOT, 2 * DOT, 2 * DOT);
      } else {
        // empty frame
        ctx.fillRect(x * DOT, y * DOT, 2 * DOT, DOT);
        ctx.fillRect(x * DOT, (y + 1) * DOT, DOT, DOT);
        ctx.fillRect((x + 1) * DOT, (y + 1) * DOT, DOT, DOT);
        ctx.fillRect(x * DOT, (y + 1) * DOT, 2 * DOT, DOT);
      }
    }
    if (!E.mapComplete(state)) textC(ctx, String(state.areaRemaining || 0), 30);
    else textC(ctx, 'CLEAR', 30);
  }

  function drawStub(ctx, title) {
    // JP Slot / Card procedures are unpublished (US Interactive is a
    // different product and is not copied). Menu is present and labelled.
    textC(ctx, title, 10);
    textC(ctx, '---', 18);
  }

  function drawMedical(ctx, state) {
    var injured = (state.party || []).filter(function (p) { return p.injured; });
    textC(ctx, 'MEDICAL', 3);
    if (!injured.length) {
      textC(ctx, 'OK', 16);
    } else {
      blitMon(ctx, injured[0].mon, 18, 24);
      textC(ctx, 'KIT', 30);
    }
  }

  function drawVs(ctx, state) {
    var opts = ['LINK', 'ANALYZER'];
    textC(ctx, 'VS', 3);
    for (var i = 0; i < opts.length; i++) {
      rowText(ctx, opts[i], 12 + i * 7, i === U.vsI);
    }
  }

  function drawEncounter(ctx, state) {
    var enc = state.encounter;
    if (!enc) return;
    textC(ctx, enc.isBoss ? 'BOSS' : 'ENEMY', 2);
    blitMon(ctx, enc.id, 18, 26);
    textC(ctx, enc.optional ? 'A FIGHT  C RUN' : 'A FIGHT', 31);
  }

  function drawHelp(ctx, state) {
    var h = state.help;
    textC(ctx, 'HELP', 2);
    // Signal bar (fills 0..1). 16-dot wide.
    var w = 16;
    var filled = Math.round((h.fill || 0) * w);
    var x0 = Math.floor((LW - w) / 2);
    var y = 10;
    ctx.fillStyle = INK;
    // frame
    ctx.fillRect((x0 - 1) * DOT, (y - 1) * DOT, (w + 2) * DOT, DOT);
    ctx.fillRect((x0 - 1) * DOT, (y + 3) * DOT, (w + 2) * DOT, DOT);
    ctx.fillRect((x0 - 1) * DOT, (y - 1) * DOT, DOT, 5 * DOT);
    ctx.fillRect((x0 + w) * DOT, (y - 1) * DOT, DOT, 5 * DOT);
    ctx.fillRect(x0 * DOT, y * DOT, filled * DOT, 3 * DOT);
    if (h.catchReady) textC(ctx, 'CATCH', 20);
    else textC(ctx, 'WAVE', 22);
    if (h.target) {
      var Da = Data();
      var mon = (Da.lineOf(h.target) && Da.monAt(h.target, 1)) || h.target;
      blitMon(ctx, mon, 18, 34);
    }
  }

  function drawBattle(ctx, state, host) {
    var b = state.battle;
    if (!b) return;
    var E = Eng();
    var p = E.active(state);
    var Da = Data();
    if (b.phase === 'result' || b.phase === 'quick') {
      textC(ctx, b.result === 'win' ? 'WIN' : 'LOSE', 6);
      if (b.result === 'lose') textC(ctx, 'X', 16);
      blitMon(ctx, b.result === 'win' ? (p && p.mon) : b.enemyId, 18, 30);
      if (b.dropped) textC(ctx, b.dropped === 'powerUp' ? 'POWER' : b.dropped, 32);
      return;
    }
    // Official 26×34 sprites nearly fill the 36-dot circle, so we show
    // one mon at a time (the foe during options/countdown; the partner
    // during our attack exchange). HP and the command sit in the padding.
    textC(ctx, 'HP ' + b.selfHp + '/' + b.enemyHp, 2);
    var show = b.phase === 'exchange' && (b.exchanges || []).length &&
               b.exchanges[b.exchanges.length - 1].who === 'player'
      ? (p && p.mon) : b.enemyId;
    blitMon(ctx, show, 18, 32);

    if (b.phase === 'countdown') {
      var beat = U.countBeat;
      var n = (Data().COUNTDOWN_BEATS - beat);
      if (n < 1) n = 1;
      textC(ctx, String(n), 31);
    } else if (b.phase === 'mash') {
      textC(ctx, 'A', 31);
    } else if (b.phase === 'options' || b.phase === 'exchange') {
      var opts = battleOpts();
      var i = U.battleI % opts.length;
      textC(ctx, opts[i], 31);
    }
  }

  /* ---------- input ---------- */

  function flash(msg, ms) {
    U.toast = msg;
    U.toastUntil = Date.now() + (ms || 900);
  }

  function pressA(host) {
    var state = host.state;
    var E = Eng();
    var Da = Data();
    if (!state) return true;
    var scr = currentScreen(state);

    if (scr === 'pick') {
      E.pickPartner(state, state.partnerPick || 0);
      U.screen = 'setClock';
      if (host.applyShell) host.applyShell();
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'setClock') {
      var c = state.clock;
      if (c.field === 'h') c.field = 'm';
      else if (c.field === 'm') c.field = 'ampm';
      else {
        E.confirmClock(state);
        U.screen = 'main';
        if (host.persist) host.persist();
      }
      return true;
    }
    if (scr === 'encounter') {
      var enc = state.encounter;
      if (enc) {
        var b = E.startBattle(state, { encounter: enc });
        if (b) {
          U.screen = 'battle';
          b.phase = 'options';
        }
      }
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'help') {
      if (state.help && state.help.catchReady) {
        if (E.catchHelp(state)) {
          U.screen = 'battle';
        }
      }
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'battleResult') {
      E.dismissBattle(state);
      U.screen = 'main';
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'battle') {
      var b = state.battle;
      if (!b) return true;
      if (b.phase === 'mash') {
        b.mash = (b.mash || 0) + 1;
        U.mash = b.mash;
        return true;
      }
      if (b.phase === 'options') {
        var opts = battleOpts();
        var name = opts[U.battleI % opts.length];
        if (!battleOptOk(state, name)) { flash('NO', 700); return true; }
        if (name === 'SW') {
          // Cycle to next uninjured ally and throw them in.
          var n = state.party.length;
          for (var k = 1; k <= n; k++) {
            var j = (state.active + k) % n;
            if (!state.party[j].injured) {
              E.switchTo(state, j);
              break;
            }
          }
          if (host.persist) host.persist();
          return true;
        }
        if (name === 'EVO') E.setBattleOption(state, 'EVOLVE');
        else if (name === 'QCK') E.setBattleOption(state, 'QUICK');
        else E.setBattleOption(state, 'USE');
        if (b.option === 'QUICK') {
          E.confirmUse(state, 0);
          U.screen = 'battleResult';
        } else {
          // Countdown then mash (FI / Wikimon: after countdown, mash A).
          b.phase = 'countdown';
          U.countBeat = 0;
          U.countAt = Date.now();
        }
        if (host.persist) host.persist();
        return true;
      }
      return true;
    }
    if (scr === 'menu') {
      var m = Da.MENUS[U.menuI];
      if (m === 'STATUS') { U.screen = 'status'; U.partyI = state.active || 0; }
      else if (m === 'MAP') U.screen = 'map';
      else if (m === 'SLOT') U.screen = 'slot';
      else if (m === 'CARD') U.screen = 'card';
      else if (m === 'MEDICAL') U.screen = 'medical';
      else if (m === 'VS') U.screen = 'vs';
      return true;
    }
    if (scr === 'status') {
      U.statusI = (U.statusI + 1) % 5;
      return true;
    }
    if (scr === 'medical') {
      if (E.treatMedical(state)) flash('OK', 800);
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'vs') {
      if (U.vsI === 1) {
        // Analyzer (physical link substitute).
        if (E.connectAnalyzer(state)) flash('EVO', 900);
        else flash('NO', 700);
      } else {
        // Link vs another Digivice — overlay with this device's labels.
        flash('LINK', 900);
        if (host.openJogressOverlay) { /* not jogress; show a VS toast only */ }
      }
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'map' || scr === 'slot' || scr === 'card') {
      // A on these screens is a no-op confirm (back is C).
      return true;
    }
    // Main: A opens the command menu (Revival has this; 1999 procedure
    // unpublished — FI says "Paging through the Menus". Left button is
    // the A-equivalent used to confirm / enter.)
    U.screen = 'menu';
    return true;
  }

  function battleOpts() {
    // Fixed order. Dropping EVO or SW after a fight used to shift the row
    // under the cursor, so the battle menu looked different.
    return ['USE', 'EVO', 'SW', 'QCK'];
  }

  function battleOptOk(state, name) {
    var E = Eng();
    var Da = Data();
    var p = E.active(state);
    var b = state.battle;
    if (name === 'EVO') {
      return !!(p && E.canEvolve(p) && b && !b.evolvedThisRound && (state.dp || 0) >= Da.DP_EVOLVE_COST);
    }
    if (name === 'SW') return !!(state.party && state.party.length > 1);
    return name === 'USE' || name === 'QCK';
  }

  function pressB(host) {
    var state = host.state;
    var Da = Data();
    if (!state) return true;
    var scr = currentScreen(state);
    // Right-upper: cycle / select next.
    if (scr === 'pick') {
      state.partnerPick = ((state.partnerPick || 0) + 1) % Da.STARTERS.length;
      return true;
    }
    if (scr === 'setClock') {
      var c = state.clock;
      if (c.field === 'h') c.h12 = c.h12 >= 12 ? 1 : c.h12 + 1;
      else if (c.field === 'm') c.min = (c.min + 1) % 60;
      else c.pm = !c.pm;
      return true;
    }
    if (scr === 'menu') {
      U.menuI = (U.menuI + 1) % Da.MENUS.length;
      return true;
    }
    if (scr === 'status') {
      if (state.party && state.party.length) {
        U.partyI = (U.partyI + 1) % state.party.length;
      }
      return true;
    }
    if (scr === 'vs') {
      U.vsI = (U.vsI + 1) % 2;
      return true;
    }
    if (scr === 'battle' && state.battle && state.battle.phase === 'options') {
      var opts = battleOpts();
      U.battleI = (U.battleI + 1) % opts.length;
      return true;
    }
    if (scr === 'main') {
      // Cycle is unused on main; B still does not open 1997 menus.
      return true;
    }
    return true;
  }

  function pressC(host) {
    var state = host.state;
    var E = Eng();
    var Da = Data();
    if (!state) return true;
    var scr = currentScreen(state);
    if (scr === 'pick') {
      // wrap backwards
      state.partnerPick = ((state.partnerPick || 0) + Da.STARTERS.length - 1) % Da.STARTERS.length;
      return true;
    }
    if (scr === 'setClock') {
      var c = state.clock;
      // Decrement current field, or step the field backward if we want
      // cancel to mean "previous field". Use decrement.
      if (c.field === 'h') c.h12 = c.h12 <= 1 ? 12 : c.h12 - 1;
      else if (c.field === 'm') c.min = (c.min + 59) % 60;
      else c.pm = !c.pm;
      return true;
    }
    if (scr === 'encounter') {
      if (state.encounter && state.encounter.optional) {
        E.declineEncounter(state);
        U.screen = 'main';
      }
      if (host.persist) host.persist();
      return true;
    }
    if (scr === 'help') {
      // Back out: window keeps running until it expires (FI doesn't say
      // you can cancel). C just returns the view to main; HELP stays active.
      U.screen = 'main';
      return true;
    }
    if (scr === 'battle' || scr === 'battleResult') {
      // Cannot cancel a forced fight. Result dismisses.
      if (scr === 'battleResult') {
        E.dismissBattle(state);
        U.screen = 'main';
        if (host.persist) host.persist();
      }
      return true;
    }
    if (scr === 'menu' || scr === 'status' || scr === 'map' ||
        scr === 'slot' || scr === 'card' || scr === 'medical' || scr === 'vs') {
      U.screen = 'main';
      return true;
    }
    return true;
  }

  function afterTick(host) {
    var state = host && host.state;
    if (!state || !state.battle) return;
    var b = state.battle;
    var now = Date.now();
    if (b.phase === 'countdown') {
      if (now - (U.countAt || 0) >= ANIM_MS) {
        U.countBeat += 1;
        U.countAt = now;
        if (U.countBeat >= Data().COUNTDOWN_BEATS) {
          b.phase = 'mash';
          b.mash = 0;
          U.mashAt = now;
        }
      }
    } else if (b.phase === 'mash') {
      if (now - (U.mashAt || 0) >= Data().MASH_WINDOW_MS) {
        Eng().confirmUse(state, b.mash || 0);
        U.screen = 'battleResult';
        if (host.persist) host.persist();
      }
    }
  }

  function noteShakeOnState(host, n) {
    var state = host && host.state;
    if (!state) return;
    Eng().noteShake(state, n || 1);
    if (host.persist) host.persist();
  }

  function maybeChord() { return false; }

  function onCanvasPointerDown() {}
  function onCanvasPointerMove() {}
  function onCanvasPointerUp() {}

  // For screenshots / tests.
  function setScreen(name) { U.screen = name; }
  function getUi() { return U; }
  function resetUi() {
    U.screen = 'main';
    U.menuI = 0;
    U.statusI = 0;
    U.partyI = 0;
    U.battleI = 0;
    U.switchI = 0;
    U.vsI = 0;
    U.mash = 0;
    U.countBeat = 0;
    U.toast = null;
  }

  var api = {
    DOT: DOT, LW: LW, LH: LH, CW: CW, CH: CH,
    PAPER: PAPER, INK: INK,
    draw: draw,
    pressA: pressA,
    pressB: pressB,
    pressC: pressC,
    afterTick: afterTick,
    noteShakeOnState: noteShakeOnState,
    maybeChord: maybeChord,
    onCanvasPointerDown: onCanvasPointerDown,
    onCanvasPointerMove: onCanvasPointerMove,
    onCanvasPointerUp: onCanvasPointerUp,
    setScreen: setScreen,
    getUi: getUi,
    resetUi: resetUi,
    ensureCanvas: ensureCanvas,
    currentScreen: currentScreen
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Dv1999UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
