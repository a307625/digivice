/**
 * Pendulum Ver.1.0 screens and input. Does not reuse 1997 menus,
 * status pages, training minigame, battle table, or lights-off art.
 * Shared: pixel helpers (fx/fy, blit, digits) passed in via `host`.
 *
 * Animation rate is the official 2 Hz (host.ANIM_MS, 500 ms) unless a
 * source specifies otherwise (COUNT window is 3 real seconds, NHOKO).
 */
(function (root) {
  'use strict';

  var Eng = function () { return root.PendulumEngine; };
  var Data = function () { return root.PendulumData; };
  var Shake = function () { return root.PendulumShake; };

  var train = {
    phase: 'idle',     // ready | count | shots | result
    startedAt: 0,
    shakes: 0,
    supers: 0,
    shot: 0,
    result: null,
    off: null
  };
  var battle = { phase: 'idle', shakes: 0, shot: 0, hpS: 3, hpF: 3, foe: null, result: null, shots: [], startedAt: 0 };
  var subSel = 0;          // food / light / heal / connect / sound
  var statusPage = 0;
  var swipe = { on: false, y0: 0, last: 0 };

  function resetTrain() {
    train = { phase: 'idle', startedAt: 0, shakes: 0, supers: 0, shot: 0, result: null, off: null };
  }
  function resetBattle() {
    battle = { phase: 'idle', shakes: 0, shot: 0, hpS: 3, hpF: 3, foe: null, result: null, shots: [], startedAt: 0 };
  }

  function engine(host) {
    return Eng();
  }

  function lcdPaper(host, night) {
    var ctx = host.ctx;
    ctx.fillStyle = night ? host.NIGHT : host.PAPER;
    ctx.fillRect(0, 0, host.LCD_W, host.LCD_H);
    if (!night) {
      ctx.fillStyle = 'rgba(80, 86, 70, 0.07)';
      for (var y = 0; y < host.LCD_H; y += 2) ctx.fillRect(0, y, host.LCD_W, 1);
      ctx.fillStyle = 'rgba(70, 80, 55, 0.18)';
      ctx.fillRect(0, host.LCD_H - 3, host.LCD_W, 3);
    }
  }

  function blitMon(host, id, x, y, frame, flip) {
    var A = root.SpriteAtlas;
    if (!A || !id) return;
    var c = null;
    try {
      var sp = (root.PendulumSprites && root.PendulumSprites.SPRITES[id]) || (root.PendulumSpritesExtra && root.PendulumSpritesExtra.SPRITES[id]) || (A.SPRITES && A.SPRITES[id]);
      if (!sp) return;
      // v35: user PNG override (assets/user-sprites/pendulum/<id>_<frame>.png)
      // in the built-in sprite's box at the same dot size; else built-in.
      var sc = host.MON || 2;
      var US = root.UserSprites;
      // The egg on screen is 'pen_egg'; a user file for this version's egg
      // (egg_<eggKind>, e.g. egg_pen_1_0) wins over a shared pen_egg file.
      var eggUser = (id === 'pen_egg' && host.state && host.state.eggKind) ? 'egg_' + host.state.eggKind : null;
      var img = (US && eggUser && US.canvasFor('pendulum', eggUser, frame || 'idle0', sp.w * sc, sp.h * sc, false)) ||
        (US && US.canvasFor('pendulum', id, frame || 'idle0', sp.w * sc, sp.h * sc, false)) ||
        A.renderToImageData(sp, frame || 'idle0', sc);
      if (!img) return;
      if (flip) {
        var w = img.width, h = img.height;
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        var tctx = tmp.getContext('2d');
        tctx.translate(w, 0);
        tctx.scale(-1, 1);
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0);
        host.ctx.drawImage(tmp, Math.round(x), Math.round(y));
      } else {
        host.ctx.drawImage(img, Math.round(x), Math.round(y));
      }
    } catch (e) {}
  }

  function text(host, s, x, y, sc, tracking) {
    var I = host.items();
    if (I && I.drawText) I.drawText(host.ctx, s, x, y, sc || host.ITEM, tracking);
  }
  /* Native dot size always; text wider than maxDots scrolls inside it. */
  function fitText(host, s, x, y, maxDots, tracking, still) {
    var I = host.items();
    if (I && I.drawTextFit) I.drawTextFit(host.ctx, s, x, y, host.ITEM, maxDots, tracking, still ? 0 : undefined);
    else text(host, s, x, y, host.ITEM, tracking);
  }
  function num(host, n, x, y, sc, pad) {
    var I = host.items();
    if (I && I.drawNumber) I.drawNumber(host.ctx, n, x, y, sc || host.ITEM, pad);
  }
  function item(host, name, x, y) {
    host.blitItem(name, x, y, host.ITEM);
  }

  function monFrame(host) {
    var s = host.state, tick = host.animTick();
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!s) return 'idle0';
    if (s.dead) return 'lose';
    if (s.sleeping || s.tired) return (tick % 2) ? 'sleep1' : 'sleep0';
    if (s.sick) return (tick % 2) ? 'sick' : 'idle0';
    if (host.eatAnim && host.eatAnim.on && !host.eatAnim.refused) {
      return (host.eatAnim.t % 2) ? 'eat1' : 'eat0';
    }
    if (host.poseFx && host.poseFx.name) {
      if (host.poseFx.until && now >= host.poseFx.until) {
        host.poseFx.name = null;
        host.poseFx.until = 0;
      } else {
        var n = host.poseFx.name;
        if (n === 'happy') return 'happy';
        if (n === 'refuse') return 'refuse';
        if (n === 'angry') return 'angry';
      }
    }
    return (tick % 2) ? 'idle1' : 'idle0';
  }

  function paintZ(ctx, x, y, s, color) {
    // 5×5 official-style Z in a chosen ink (paper-green on a black LCD).
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5 * s, s);
    ctx.fillRect(x + 4 * s, y + s, s, s);
    ctx.fillRect(x + 3 * s, y + 2 * s, s, s);
    ctx.fillRect(x + 2 * s, y + 3 * s, s, s);
    ctx.fillRect(x + s, y + 4 * s, s, s);
    ctx.fillRect(x, y + 5 * s, 5 * s, s);
  }
  function drawFloatingZ(host, night) {
    var tick = host.animTick();
    var bob = (tick % 2) ? host.DOT : 0;
    var x = host.fx(18);
    var y = night ? host.fy(4) + bob : host.fy(0) + bob;
    var color = night ? host.PAPER : host.INK;
    paintZ(host.ctx, x, y, host.DOT, color);
    paintZ(host.ctx, x + 10, y + (night ? -12 : 8), Math.max(2, host.DOT - 1), color);
  }

  function drawPlay(host) {
    var s = host.state;
    var EngE = Eng();
    var screen;
    var LO = root.LightsOff;
    if (LO && LO.playfieldMode) {
      var mode = LO.playfieldMode(s, 'play', 'pendulum');
      screen = (mode === 'black-z' || mode === 'black') ? mode : 'paper';
    } else {
      screen = EngE && EngE.lightsOffScreen(s);
    }
    if (screen === 'black-z') {
      lcdPaper(host, true);
      drawFloatingZ(host, true);
      return;
    }
    if (screen === 'black') {
      lcdPaper(host, true);
      return;
    }
    lcdPaper(host, false);
    if (!s) return;
    if (s.dead) { drawComputer(host); return; }
    var fr = monFrame(host);
    if (s.dying) {
      // Dying cry (Humulos): stops moving and cries for one minute — shake!
      blitMon(host, s.mon, host.fx(8), host.fy(0), (host.animTick() % 2) ? 'lose' : 'angry', false);
      return;
    }
    var mx = host.fx(host.walk ? host.walk.x : 8);
    var my = host.fy(0);
    var flip = host.walk && host.walk.dir > 0;
    var eating = host.eatAnim && host.eatAnim.on && !host.eatAnim.refused;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var poseLive = host.poseFx && host.poseFx.name && (!host.poseFx.until || now < host.poseFx.until);
    if (s.sleeping || s.tired) {
      mx = host.fx(8);
      flip = false;
    } else if (eating) {
      // Official: Digimon at x=8, facing the food at x=24 (same as 1997).
      mx = host.fx(8);
      flip = true;
    } else if (poseLive && host.poseFx.name === 'refuse') {
      // Head-shake: refuse cell mirrored on the 2 Hz clock.
      flip = (host.animTick() % 2) === 1;
      mx = host.fx(8);
    } else if (poseLive) {
      mx = host.fx(8);
      flip = false;
    }
    blitMon(host, s.mon, mx, my, fr, flip);
    if (eating && host.eatFoodSprite) {
      var food = host.eatFoodSprite();
      if (food) host.blitItem(food.food, host.fx(food.xDots), host.fy(food.yDots), host.ITEM, false);
    }
    // Poop piles — same 8-cap field as official, 8×8 items at ITEM=4.
    var n = s.poop || 0;
    var i;
    for (i = 0; i < n && i < 8; i++) {
      var col = Math.floor(i / 2);
      var row = i % 2;
      var px = host.fx(24 - col * 8);
      var py = host.fy(row === 0 ? 8 : 0);
      item(host, 'poop', px, py);
    }
    if ((s.sleeping || s.tired) && s.lights) drawFloatingZ(host, false);
    if (s.injured) item(host, 'skull', mx + 8 * host.DOT, my);
    if (s.sick && !s.injured) {
      // "dots" disease — four ink dots over the head (official sick mark).
      var ctx = host.ctx;
      ctx.fillStyle = host.INK;
      var d = host.DOT;
      ctx.fillRect(mx + 10 * d, my + d, d, d);
      ctx.fillRect(mx + 13 * d, my + 2 * d, d, d);
      ctx.fillRect(mx + 11 * d, my + 4 * d, d, d);
      ctx.fillRect(mx + 14 * d, my, d, d);
    }
  }

  function drawComputer(host) {
    lcdPaper(host, false);
    blitMon(host, 'pen_computer', host.fx(8), host.fy(0), 'idle0', false);
  }

  function hearts(host, filled, x, y) {
    // Display is always 4 hearts (NHOKO); fill is min(4, value).
    var i;
    for (i = 0; i < 4; i++) {
      // v33: 8-dot pitch (7-dot heart + 1 gap) so 4 hearts end at col 31
      item(host, i < filled ? 'heart' : 'heart_empty', x + i * 8 * host.DOT, y);
    }
  }

  function drawStatus(host) {
    lcdPaper(host, false);
    var s = host.state;
    var D = Data();
    var m = D && D.monster(s.mon);
    var pages = (host.profile && host.profile.statusPages) ||
      ['age', 'hunger', 'strength', 'win', 'dp', 'type', 'bj'];
    var page = pages[statusPage % pages.length];
    var I = host.items();
    if (page === 'age') {
      text(host, 'AGE', host.fx(0), host.fy(0), host.ITEM);
      num(host, s.ageDays || 0, host.fx(14), host.fy(0), host.ITEM, 2);
      text(host, 'WT', host.fx(0), host.fy(8), host.ITEM);
      num(host, s.weight || 0, host.fx(12), host.fy(8), host.ITEM, 2);
      text(host, 'G', host.fx(24), host.fy(8), host.ITEM);
    } else if (page === 'hunger') {
      text(host, 'HUNGRY', host.fx(1), host.fy(1), host.ITEM);
      hearts(host, Math.min(4, s.hunger || 0), host.fx(1), host.fy(8));
    } else if (page === 'strength') {
      fitText(host, 'STRENGTH', host.fx(0), host.fy(1), 32, 0); // 35 dots: scrolls (v33)
      hearts(host, Math.min(4, s.strength || 0), host.fx(1), host.fy(8));
    } else if (page === 'win') {
      var w = s.wins || 0, l = s.losses || 0, b = s.battles || 0;
      var pct = b ? Math.round(100 * w / b) : 0;
      text(host, 'W', host.fx(0), host.fy(0), host.ITEM);
      // v33: W/L (2 digits, cols 6-14) + percent (3 digits, cols 18-31) fit
      // 32 dots; 3-digit counts collided with the percent. Shown capped at 99.
      num(host, Math.min(99, w), host.fx(6), host.fy(0), host.ITEM, 2);
      text(host, 'L', host.fx(0), host.fy(8), host.ITEM);
      num(host, Math.min(99, l), host.fx(6), host.fy(8), host.ITEM, 2);
      num(host, pct, host.fx(18), host.fy(4), host.ITEM, 3); // 3 digits = cols 18-31
    } else if (page === 'dp') {
      text(host, 'DP', host.fx(1), host.fy(1), host.ITEM);
      var dp = Eng().dp(s);
      var mx = Eng().dpMax(s);
      // v35: values up to 2 digits fit at the native dot size. Fields
      // (5-col digit pitch): DP cols 4-12 (right-aligned), '.' (half) col 13,
      // '/' cols 16-18, max cols 22-30 (right-aligned). 1 digit sits in the
      // right half of its field. Values are capped at 99 for display.
      var dpi = Math.min(99, Math.floor(dp)), mxi = Math.min(99, Math.floor(mx));
      if (dpi >= 10) num(host, dpi, host.fx(4), host.fy(8), host.ITEM, 2);
      else num(host, dpi, host.fx(9), host.fy(8), host.ITEM, 1);
      if (dp - Math.floor(dp) >= 0.5) text(host, '.', host.fx(13), host.fy(8), host.ITEM);
      text(host, '/', host.fx(16), host.fy(8), host.ITEM);
      if (mxi >= 10) num(host, mxi, host.fx(22), host.fy(8), host.ITEM, 2);
      else num(host, mxi, host.fx(27), host.fy(8), host.ITEM, 1);
    } else if (page === 'type') {
      var attr = (m && m.attribute) || 'free';
      var label = attr === 'vaccine' ? 'VAC' : attr === 'data' ? 'DATA' : attr === 'virus' ? 'VIR' : 'FREE';
      text(host, 'TYPE', host.fx(1), host.fy(1), host.ITEM);
      text(host, label, host.fx(8), host.fy(8), host.ITEM);
    } else if (page === 'bj') {
      // B-J-  Battle / Jogress O or X
      var canB = !!(m && m.canBattle);
      var canJ = !!(m && m.canJogress);
      text(host, 'B', host.fx(2), host.fy(2), host.ITEM);
      text(host, canB ? 'O' : 'X', host.fx(8), host.fy(2), host.ITEM);
      text(host, 'J', host.fx(2), host.fy(10), host.ITEM);
      text(host, canJ ? 'O' : 'X', host.fx(8), host.fy(10), host.ITEM);
    }
  }

  function menuRow(host, selected, y, label, maxDots) {
    item(host, selected ? 'triangle' : 'empty_triangle', host.fx(0), y);
    // v33: cursor ink is cols 0-3, label owns cols 5-31 at the native dot
    // size; a longer word (JOGRESS) scrolls while selected.
    // v35: rows with an 8-dot icon at cols 24-31 pass maxDots 18 (cols 5-22)
    // so the label never runs under the icon (it scrolls inside cols 5-22).
    fitText(host, label, host.fx(5), y, maxDots || 27, 0, !selected);
  }

  function drawFood(host) {
    lcdPaper(host, false);
    menuRow(host, subSel === 0, host.fy(2), 'MEAT');
    item(host, 'meat', host.fx(24), host.fy(0)); // v33: 8-row icons on rows 0-7 / 8-15
    // "PROT" + pill: "PROTEIN" at any comfortable scale collides with the icon.
    menuRow(host, subSel === 1, host.fy(10), 'PROT');
    item(host, 'pill', host.fx(24), host.fy(8));
  }

  function drawLight(host) {
    lcdPaper(host, false);
    menuRow(host, subSel === 0, host.fy(2), 'ON');
    menuRow(host, subSel === 1, host.fy(10), 'OFF');
  }

  function drawHeal(host) {
    lcdPaper(host, false);
    // Official: top = sick (dots), bottom = injury (skull)
    menuRow(host, subSel === 0, host.fy(2), 'SICK');
    menuRow(host, subSel === 1, host.fy(10), 'INJURY', 18); // v35: was under the skull
    item(host, 'skull', host.fx(24), host.fy(8));
  }

  function drawConnect(host) {
    lcdPaper(host, false);
    menuRow(host, subSel === 0, host.fy(2), 'BATTLE');
    menuRow(host, subSel === 1, host.fy(10), 'JOGRESS');
  }

  function drawSound(host) {
    lcdPaper(host, false);
    // v33: three 6-row lines cannot fit 16 rows (OFF ran off the LCD).
    text(host, 'SOUND', host.fx(1), host.fy(1), host.ITEM);
    menuRow(host, true, host.fy(9), subSel === 0 ? 'ON' : 'OFF'); // A toggles
  }

  function drawClock(host) {
    lcdPaper(host, false);
    var s = host.state;
    var EngE = Eng();
    var setting = EngE.isClockSet(s);
    var sec = EngE.runningClockSeconds(s);
    var h24 = Math.floor(sec / 3600);
    var min = Math.floor((sec % 3600) / 60);
    var I = host.items();
    var blinkOn = !setting || host.shotMode || (host.animTick() % 2) === 0;
    if (setting) text(host, 'SET', host.fx(14), host.fy(10), host.ITEM);
    var dx = host.fx(8);
    var dy = host.fy(2);
    var show24 = !!s.clock24h;
    if (show24) {
      if (blinkOn) I.drawNumber(host.ctx, h24, dx, dy, host.ITEM, 2);
    } else {
      var isAM = h24 < 12;
      var h = h24 % 12;
      if (h === 0) h = 12;
      if (blinkOn) item(host, isAM ? 'am' : 'pm', host.fx(0), host.fy(8));
      if (blinkOn) I.drawNumber(host.ctx, h, dx, dy, host.ITEM, 2);
    }
    dx += 5 * host.ITEM * 2;
    host.ctx.fillStyle = host.INK;
    host.ctx.fillRect(dx, dy + 1 * host.ITEM, host.DOT, host.DOT);
    host.ctx.fillRect(dx, dy + 5 * host.ITEM, host.DOT, host.DOT);
    dx += 2 * host.ITEM;
    if (blinkOn) I.drawNumber(host.ctx, min, dx, dy, host.ITEM, 2);
    // Seconds triangles only when not SET, 12h or 24h, official 1 Hz five-triangle row.
    if (!setting) {
      var ss = Math.floor(sec % 60);
      var filled = Math.floor(ss / 12) + (ss % 12 >= 0 && ss > 0 ? 1 : 0);
      if (ss === 0) filled = 0;
      // 5 triangles: 0–11 empty? Official 1997: one triangle per 12 seconds? 
      // Existing 1997 uses 5 triangles for 60s. Mirror that.
      var tri = Math.min(5, Math.floor(ss / 12));
      if (ss % 12 === 0 && ss > 0) tri = Math.min(5, ss / 12);
      // Use the same as 1997: 5 indicators, one per 12 seconds, current one at 1 Hz?
      // We'll fill floor(ss/12) triangles (0 at 0s, 5 at 60 which wraps). Plus
      // a blinking current. Keep it simple: fill Math.ceil(ss/12) but 0 at 0.
      var n = Math.floor((ss % 60) / 12);
      var i;
      for (i = 0; i < 5; i++) {
        var on = i < n || (i === n && ss % 12 !== 0 && (host.animTick() % 2) === 0 && i === Math.floor(ss / 12));
        // Simpler: filled triangles = how many 12-s blocks have completed,
        // and the current block's triangle is solid (1997 uses five 1 Hz).
        on = i < Math.floor(ss / 12) + ((ss % 12 > 0) ? 1 : 0);
        if (ss === 0) on = false;
        item(host, on ? 'triangle' : 'empty_triangle', host.fx(2 + i * 5), host.fy(11)); // v33: rows 11-15
      }
    }
  }

  function drawTrain(host) {
    lcdPaper(host, false);
    var s = host.state;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (train.phase === 'ready') {
      text(host, 'READY', host.fx(4), host.fy(5), host.ITEM);
    } else if (train.phase === 'count') {
      text(host, 'COUNT', host.fx(4), host.fy(2), host.ITEM);
      num(host, train.shakes, host.fx(12), host.fy(9), host.ITEM, 2); // v33: rows 9-15
    } else if (train.phase === 'shots') {
      // 5 shots; Super = double projectile (Humulos).
      var i;
      for (i = 0; i < 5; i++) {
        var fired = i <= train.shot;
        if (!fired) continue;
        var isSuper = i < train.supers;
        // v33: 7-row shot icons on rows 1-7 / 9-15 (super) or 5-11 (normal).
        item(host, 'shot', host.fx(4 + i * 5), host.fy(isSuper ? 1 : 5));
        if (isSuper) item(host, 'shot', host.fx(4 + i * 5), host.fy(9));
      }
    } else if (train.phase === 'result') {
      if (train.result && train.result.success) text(host, 'GREAT', host.fx(4), host.fy(5), host.ITEM);
      else text(host, 'FAIL', host.fx(8), host.fy(5), host.ITEM);
      // 1.0: no MEGAHIT result screen (even if megahit landed).
    }
  }

  function drawBattle(host) {
    lcdPaper(host, false);
    if (battle.phase === 'ready') text(host, 'READY', host.fx(4), host.fy(5), host.ITEM);
    else if (battle.phase === 'count') {
      text(host, 'COUNT', host.fx(4), host.fy(2), host.ITEM);
      num(host, battle.shakes, host.fx(12), host.fy(9), host.ITEM, 2);
    } else if (battle.phase === 'shots') {
      text(host, 'HP', host.fx(0), host.fy(0), host.ITEM);
      num(host, battle.hpS, host.fx(8), host.fy(0), host.ITEM, 1);
      num(host, battle.hpF, host.fx(22), host.fy(0), host.ITEM, 1);
      blitMon(host, host.state.mon, host.fx(0), host.fy(4), 'attack', false);
      blitMon(host, battle.foe, host.fx(16), host.fy(4), 'attack', true);
    } else if (battle.phase === 'result') {
      text(host, battle.result === 'win' ? 'WIN' : 'LOSE', host.fx(8), host.fy(5), host.ITEM);
    }
  }

  function drawEvo(host) {
    lcdPaper(host, false);
    var t = host.evoFx || { t: 0, from: '', to: '' };
    var id = (t.t % 2) ? t.to : t.from;
    blitMon(host, id, host.fx(8), host.fy(0), 'idle0', false);
  }

  function draw(host) {
    if (!host || !host.ctx) return false;
    var v = host.view;
    if (v === 'clock') drawClock(host);
    else if (v === 'status') drawStatus(host);
    else if (v === 'food') drawFood(host);
    else if (v === 'lightMenu') drawLight(host);
    else if (v === 'healMenu') drawHeal(host);
    else if (v === 'connect') drawConnect(host);
    else if (v === 'soundMenu') drawSound(host);
    else if (v === 'train') drawTrain(host);
    else if (v === 'battle') drawBattle(host);
    else if (v === 'evo') drawEvo(host);
    else if (v === 'grave' || (host.state && host.state.dead && v !== 'dying')) drawComputer(host);
    else if (v === 'dying') {
      lcdPaper(host, false);
      blitMon(host, host.state.mon, host.fx(8), host.fy(0), 'lose', false);
    } else drawPlay(host);
    return true;
  }

  function startTrain(host) {
    var s = host.state;
    if (!Eng().canTrain(s)) {
      host.playPose('refuse', 900);
      return false;
    }
    // Permission on this user tap (iOS 15).
    var Sh = Shake();
    if (Sh) Sh.requestPermission(function () {});
    resetTrain();
    train.phase = 'ready';
    train.startedAt = nowMs();
    host.setView('train');
    return true;
  }

  function startBattle(host) {
    var s = host.state;
    if (!Eng().canBattle(s)) {
      host.playPose('refuse', 900);
      return false;
    }
    var Sh = Shake();
    if (Sh) Sh.requestPermission(function () {});
    resetBattle();
    // App-only practice foe: same-stage default (documented compromise).
    var m = Data().monster(s.mon);
    battle.foe = pickPracticeFoe(s.mon, m && m.stage);
    battle.phase = 'ready';
    battle.startedAt = nowMs();
    battle.hpS = Eng().rules().battleHp;
    battle.hpF = Eng().rules().battleHp;
    host.setView('battle');
    return true;
  }

  function pickPracticeFoe(self, stage) {
    var all = Data().MONSTERS;
    var ids = Object.keys(all).filter(function (id) {
      return all[id].stage === stage && id !== self;
    });
    return ids[0] || self;
  }

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function tickMinigame(host) {
    var t = nowMs();
    if (host.view === 'train' && train.phase !== 'idle') {
      if (train.phase === 'ready' && t - train.startedAt >= 1500) {
        train.phase = 'count';
        train.startedAt = t;
        train.shakes = 0;
      } else if (train.phase === 'count' && t - train.startedAt >= 3000) {
        var m = Data().monster(host.state.mon);
        var target = (m && m.megahit) || Eng().rules().megahitDefault;
        train.supers = Eng().supersFromShakes(train.shakes, target);
        train.phase = 'shots';
        train.shot = 0;
        train.startedAt = t;
      } else if (train.phase === 'shots') {
        var step = Math.floor((t - train.startedAt) / (host.ANIM_MS || 500));
        train.shot = Math.min(4, step);
        if (step >= 5) {
          train.result = Eng().finishTraining(host.state, train.supers);
          train.phase = 'result';
          train.startedAt = t;
          if (host.persist) host.persist();
        }
      } else if (train.phase === 'result' && t - train.startedAt >= 1500) {
        resetTrain();
        host.setView('play');
        host.setSel(-1);
      }
    }
    if (host.view === 'battle' && battle.phase !== 'idle') {
      if (battle.phase === 'ready' && t - battle.startedAt >= 1500) {
        battle.phase = 'count';
        battle.startedAt = t;
        battle.shakes = 0;
      } else if (battle.phase === 'count' && t - battle.startedAt >= 3000) {
        battle.phase = 'shots';
        battle.startedAt = t;
        // Three shots, shake quality → super chance (placeholder mapping).
        var m = Data().monster(host.state.mon);
        var target = (m && m.megahit) || 8;
        var sup = Eng().supersFromShakes(battle.shakes, target);
        var shotsS = [];
        var shotsF = [];
        var i;
        for (i = 0; i < 6; i++) {
          shotsS.push({ super: i < sup });
          shotsF.push({ super: i < 2 });
        }
        var foeState = {
          mon: battle.foe, effort: 10, family: 'pendulum', dpQ: 16, dpMaxQ: 16,
          dead: false, sick: false, injured: false
        };
        var r = Eng().resolvePracticeBattle(host.state, foeState, shotsS, shotsF);
        battle.result = r.result;
        battle.hpS = r.hpS;
        battle.hpF = r.hpF;
        battle.phase = 'shots';
        battle.shot = 0;
        if (host.persist) host.persist();
      } else if (battle.phase === 'shots' && t - battle.startedAt >= 2000) {
        battle.phase = 'result';
        battle.startedAt = t;
      } else if (battle.phase === 'result' && t - battle.startedAt >= 1500) {
        resetBattle();
        host.setView('play');
        host.setSel(-1);
      }
    }
  }

  function onShake(n) {
    n = n || 1;
    if (train.phase === 'count') train.shakes += n;
    if (battle.phase === 'count') battle.shakes += n;
    if (root.PendulumEngine && arguments[1] && arguments[1].state) {
      root.PendulumEngine.addShake(arguments[1].state, n);
    }
  }

  // Wire shake once.
  if (root.PendulumShake) {
    root.PendulumShake.onShake(function (n, src) { onShake(n); });
  }

  function pressA(host) {
    var v = host.view;
    var EngE = Eng();
    var s = host.state;
    if (EngE.isClockSet(s)) return false; // host handles hold
    if (v === 'clock') {
      EngE.toggleClock12_24(s);
      if (host.persist) host.persist();
      return true;
    }
    if (v === 'status') {
      var pages = (host.profile && host.profile.statusPages) || [];
      statusPage = (statusPage + 1) % Math.max(1, pages.length);
      return true;
    }
    if (v === 'food' || v === 'lightMenu' || v === 'healMenu' || v === 'connect' || v === 'soundMenu') {
      var n = (v === 'connect' || v === 'soundMenu' || v === 'healMenu' || v === 'lightMenu' || v === 'food') ? 2 : 2;
      subSel = (subSel + 1) % n;
      return true;
    }
    if (v === 'train' || v === 'battle') return true; // ignore during COUNT
    return false; // host cycles icons
  }

  function pressB(host) {
    var v = host.view;
    var EngE = Eng();
    var s = host.state;
    if (EngE.isClockSet(s)) return false;
    if (v === 'clock') return true; // B does not close the clock; C / already on clock
    if (v === 'status') {
      statusPage = 0;
      host.setView('play');
      return true;
    }
    if (v === 'food') {
      var r = subSel === 1 ? EngE.feedProtein(s) : EngE.feedMeat(s);
      if (host.persist) host.persist();
      host.setView('play');
      if (!r.ok || r.refused) {
        host.playPose('refuse', 1100);
        // Host loop will not auto-return on refuse; come back with cursor kept.
        if (host.returnToFoodSoon) host.returnToFoodSoon(1100);
      } else {
        host.eatAnim.on = true;
        host.eatAnim.t = 0;
        host.eatAnim.kind = subSel === 1 ? 'protein' : 'meat';
        host.eatAnim.refused = false;
        host.eatAnim.returnToFood = true;
      }
      return true;
    }
    if (v === 'lightMenu') {
      EngE.setLights(s, subSel === 0);
      if (host.persist) host.persist();
      host.setView('play');
      host.setSel(-1);
      return true;
    }
    if (v === 'healMenu') {
      var h = subSel === 0 ? EngE.healSick(s) : EngE.healInjury(s);
      if (host.persist) host.persist();
      host.setView('play');
      if (!h.ok) host.playPose('refuse', 900);
      else host.playPose('happy', 1200);
      return true;
    }
    if (v === 'connect') {
      if (subSel === 0) startBattle(host);
      else {
        if (!EngE.canJogress(s)) { host.playPose('refuse', 900); return true; }
        // Jogress uses the existing QR / code overlay, labels stay on-device.
        if (host.openJogressOverlay) host.openJogressOverlay();
        else if (host.toast) host.toast('需要另一台搖擺機連線');
      }
      return true;
    }
    if (v === 'soundMenu') {
      // Device mute is authoritative — same flag the beep checks.
      if (host.setSoundOn) host.setSoundOn(subSel === 0);
      s.soundMuted = subSel === 1;
      if (host.persist) host.persist();
      host.setView('play');
      host.setSel(-1);
      return true;
    }
    if (v === 'train' || v === 'battle' || v === 'evo' || v === 'dying' || v === 'grave') return true;
    // Play: confirm selection or open clock.
    if (v === 'play') {
      var sel = host.getSel();
      if (sel < 0) { host.setView('clock'); return true; }
      var id = (host.profile && host.profile.selectable || [])[sel];
      if (id === 'STATUS') { statusPage = 0; host.setView('status'); return true; }
      if (id === 'FEED') {
        if (s.mon === 'pen_egg') { host.playPose('refuse', 900); return true; }
        EngE.disturbSleep(s, 'food');
        // Keep last-chosen item (meat / protein). Do not reset to meat.
        host.setView('food'); return true;
      }
      if (id === 'TRAIN') return startTrain(host) || true;
      if (id === 'CONNECT') { subSel = 0; host.setView('connect'); return true; }
      if (id === 'FLUSH') {
        var n = s.poop || 0;
        EngE.flush(s);
        if (host.persist) host.persist();
        if (n > 0 && host.startFlush) host.startFlush(n);
        host.setView('play');
        host.setSel(-1);
        return true;
      }
      if (id === 'LIGHT') { subSel = s.lights ? 0 : 1; host.setView('lightMenu'); return true; }
      if (id === 'MEDIC') { subSel = 0; host.setView('healMenu'); return true; }
    }
    return false;
  }

  function pressC(host) {
    var EngE = Eng();
    var s = host.state;
    if (EngE.isClockSet(s)) {
      EngE.confirmClockSet(s);
      if (host.persist) host.persist();
      host.setView('play');
      host.setSel(-1);
      return true;
    }
    if (host.view === 'train' && (train.phase === 'ready' || train.phase === 'count')) {
      // Cancel before COUNT ends: no DP (NHOKO).
      resetTrain();
      host.setView('play');
      host.setSel(-1);
      return true;
    }
    if (host.view === 'battle' && (battle.phase === 'ready' || battle.phase === 'count')) {
      resetBattle();
      host.setView('play');
      host.setSel(-1);
      return true;
    }
    if (host.view === 'grave' || (s && s.dead)) return false; // A+C new egg in host
    if (host.view !== 'play') {
      host.setView('play');
      host.setSel(-1);
      return true;
    }
    host.setSel(-1);
    return true;
  }

  /** A+C on the home screen: official sound On/Off menu. */
  function openSoundMenu(host) {
    if (host.view !== 'play') return false;
    subSel = host.isSoundOn && host.isSoundOn() ? 0 : 1;
    host.setView('soundMenu');
    return true;
  }

  function maybeChord(host, keyA, keyC) {
    if (keyA && keyC && host.view === 'play') return openSoundMenu(host);
    return false;
  }

  function noteShakeOnState(host, n) {
    if (host && host.state) Eng().addShake(host.state, n || 1);
    onShake(n || 1);
    animateBall(host, n);
  }

  function animateBall(host, n) {
    var el = typeof document !== 'undefined' && document.getElementById('pendulum-ball');
    if (!el) return;
    el.classList.remove('swing');
    // reflow
    void el.offsetWidth;
    el.classList.add('swing');
  }

  // Canvas swipe fallback during COUNT.
  function onCanvasPointerDown(host, ev) {
    if (train.phase !== 'count' && battle.phase !== 'count') return;
    swipe.on = true;
    swipe.y0 = ev.clientY || 0;
    swipe.last = swipe.y0;
  }
  function onCanvasPointerMove(host, ev) {
    if (!swipe.on) return;
    var y = ev.clientY || 0;
    if (Math.abs(y - swipe.last) >= 28) {
      noteShakeOnState(host, 1);
      swipe.last = y;
    }
  }
  function onCanvasPointerUp() { swipe.on = false; }

  function statusPageIndex() { return statusPage; }
  function setStatusPage(n) { statusPage = n; }
  function getTrain() { return train; }
  function getBattle() { return battle; }
  function setTrainForShot(phase, extra) {
    train.phase = phase;
    if (extra) for (var k in extra) train[k] = extra[k];
  }

  var api = {
    draw: draw,
    pressA: pressA,
    pressB: pressB,
    pressC: pressC,
    startTrain: startTrain,
    startBattle: startBattle,
    tickMinigame: tickMinigame,
    onShake: onShake,
    noteShakeOnState: noteShakeOnState,
    maybeChord: maybeChord,
    openSoundMenu: openSoundMenu,
    onCanvasPointerDown: onCanvasPointerDown,
    onCanvasPointerMove: onCanvasPointerMove,
    onCanvasPointerUp: onCanvasPointerUp,
    statusPageIndex: statusPageIndex,
    setStatusPage: setStatusPage,
    getTrain: getTrain,
    getBattle: getBattle,
    setTrainForShot: setTrainForShot,
    resetTrain: resetTrain,
    resetBattle: resetBattle,
    getSubSel: function () { return subSel; },
    setSubSel: function (n) { subSel = n ? 1 : 0; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PendulumUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
