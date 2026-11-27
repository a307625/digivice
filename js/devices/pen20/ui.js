/**
 * Pendulum Ver.20th (新超代) device UI.
 * Own menus, buttons, clock-SET, lights (freeze/sleep/fridge), dual-pet,
 * training COUNT, Colosseum, album, connect — not PenOG, not DM20-brick.
 * Animation is official 2 Hz (host.ANIM_MS = 500) unless a source says otherwise.
 */
(function (root) {
  'use strict';

  var Eng = function () { return root.Pen20Engine; };
  var Data = function () { return root.Pen20Data; };
  var Spr = function () { return root.Pen20Sprites; };
  var Prof = function () { return root.Pen20Profiles; };

  var STATUS_PAGES = ['name', 'age', 'weight', 'hunger', 'strength', 'effort', 'dp', 'attr', 'bj', 'record'];
  var SELECTABLE = ['STATUS', 'FEED', 'TRAIN', 'COLOSSEUM', 'FLUSH', 'LIGHT', 'MEDIC', 'ALBUM', 'CONNECT'];

  var subSel = 0;          // food / light / heal / connect / colo — keep-last for food
  var statusPage = 0;
  var albumTab = 0;        // 0 Digimon, 1 Copymon, 2 Record, 3 Pass
  var albumOpen = false;   // false = the four-option list; true = inside the chosen one
  var albumIdx = 0;
  var passDigits = [0, 0, 0, 0, 0, 0];
  var passPos = 0;
  var eggPickIdx = 0;
  var train = { on: false, shakes: 0, startedAt: 0, phase: 'idle', result: null, tag: false };
  var battle = { on: false, phase: 'idle', won: false, foe: '', startedAt: 0, injured: false };
  var lastInputAt = 0;
  function E() { return Eng(); }
  function D() { return Data(); }

  function lcdPaper(host) {
    var ctx = host.ctx;
    ctx.fillStyle = host.PAPER;
    ctx.fillRect(0, 0, host.LCD_W, host.LCD_H);
  }

  function text(host, s, x, y, sc, tracking) {
    if (root.VpetItems && root.VpetItems.drawText) {
      root.VpetItems.drawText(host.ctx, String(s), x, y, sc || host.ITEM, tracking);
    }
  }
  /* v33: native dot size always; wider text scrolls inside maxDots. */
  function fitText(host, s, x, y, maxDots, tracking, still) {
    var I = root.VpetItems;
    if (I && I.drawTextFit) I.drawTextFit(host.ctx, String(s), x, y, host.ITEM, maxDots, tracking, still ? 0 : undefined);
    else text(host, s, x, y, host.ITEM, tracking);
  }
  function num(host, n, x, y, sc, pad) {
    var s = String(n);
    if (pad) while (s.length < pad) s = '0' + s;
    if (root.VpetItems && root.VpetItems.drawNumber) {
      root.VpetItems.drawNumber(host.ctx, s, x, y, sc || host.ITEM, pad);
    } else text(host, s, x, y, sc);
  }
  function hearts(host, filled, x, y) {
    if (root.VpetItems && root.VpetItems.drawHearts) {
      root.VpetItems.drawHearts(host.ctx, x, y, filled, 4, host.ITEM);
    } else {
      var i, s = '';
      for (i = 0; i < 4; i++) s += i < filled ? '*' : '-';
      text(host, s, x, y, host.ITEM);
    }
  }

  function monFrame(host) {
    var p = host.poseFx;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (p && p.name === 'poop' && p.until && now < p.until) {
      var span = (p.until - (p.started || p.until)) || 1;
      return (now - (p.started || 0) < span / 2) ? 'refuse' : 'happy';
    }
    return (host.animTick() % 2 === 0) ? 'idle0' : 'idle1';
  }

  function blitPet(host, pet, x, y, pose, flip) {
    var Sp = Spr();
    if (!Sp || !pet) return;
    var id = pet.mon;
    if (pet.frozen) { Sp.blit(host.ctx, 'fridge', x, y, 'idle0', false, host.INK, 4); return; }
    if (pet.dead || id === 'computer') { Sp.blit(host.ctx, 'computer', x, y, 'idle0', false, host.INK, 4); return; }
    if (id === 'egg') {
      Sp.blit(host.ctx, pet.eggId || 'digitama_nsp', x, y, pose || 'idle0', flip, host.INK, 4);
      return;
    }
    if (pet.dying) { Sp.blit(host.ctx, 'skull', x, y, 'idle0', false, host.INK, 4); return; }
    if (pet.sleeping || (pet.tired && (host.animTick() % 2))) {
      Sp.blit(host.ctx, id, x, y, 'sleep', flip, host.INK, 4);
      return;
    }
    if (!Sp.has(id)) {
      // missing official sprite: empty cell, do not fall back to 1997 color
      return;
    }
    Sp.blit(host.ctx, id, x, y, pose || monFrame(host), flip, host.INK, 4);
  }

  function visibleList(host) {
    var s = host.state, Eapi = E();
    if (!s || !Eapi) return [];
    var idxs = Eapi.visiblePets(s) || [];
    return idxs.map(function (i) { return s.pets[i]; }).filter(Boolean);
  }

  function drawPlay(host) {
    var s = host.state;
    var Eapi = E();
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    // Screen-off after ~1 min idle (Humulos). Distinct from the Light menu.
    var idle = D() && D().IDLE_OFF_SEC ? D().IDLE_OFF_SEC : 60;
    if (!host.shotMode && lastInputAt && (now - lastInputAt) > idle * 1000) {
      s.screenOff = true;
    }
    if (s.screenOff && !host.shotMode) {
      host.ctx.fillStyle = '#000000';
      host.ctx.fillRect(0, 0, host.LCD_W, host.LCD_H);
      return;
    }

    lcdPaper(host);

    if (s.display === 'computer' || (s.deadComputer && s.display === 'computer')) {
      blitPet(host, { mon: 'computer', dead: true }, host.fx(8), host.fy(0));
      fitText(host, 'COMPUTER', host.fx(0), host.fy(9), 32, 0);
      return;
    }
    if (s.display === 'egg' && s.pendingEgg) {
      var eId = (s.unlockedEggs && s.unlockedEggs[0]) || 'digitama_nsp';
      blitPet(host, { mon: 'egg', eggId: eId }, host.fx(8), host.fy(0));
      text(host, 'EGG', host.fx(10), host.fy(9), host.ITEM);
      return;
    }

    var pets = visibleList(host);
    if (!pets.length) {
      var ap = Eapi && Eapi.activePet(s);
      if (ap) pets = [ap];
    }
    if (!pets.length) return;

    // Dual: two 16-dot cells side by side on the 32-dot field (64+64=128 px).
    var eating = host.eatAnim && host.eatAnim.on && !host.eatAnim.refused;
    var poseFx = host.poseFx;
    var poseLive = poseFx && poseFx.name && (!poseFx.until || now < poseFx.until);
    if (pets.length >= 2 && !eating) {
      blitPet(host, pets[0], host.fx(0), host.fy(0), null, false);
      blitPet(host, pets[1], host.fx(16), host.fy(0), null, true);
    } else {
      var walkX = (host.walk && host.walk.x != null) ? host.walk.x : 8;
      var flip = host.walk && host.walk.dir > 0;
      var pose = monFrame(host);
      if (eating) {
        // Mouth closed/open on the official 2 Hz clock; face the food at x=24.
        pose = (host.eatAnim.t % 2) ? 'eat1' : 'eat0';
        walkX = 8;
        flip = true;
      } else if (poseLive && poseFx.name === 'refuse') {
        pose = 'refuse';
        walkX = 8;
        flip = (host.animTick() % 2) === 1;
      } else if (poseLive && (poseFx.name === 'happy' || poseFx.name === 'angry')) {
        pose = poseFx.name;
        walkX = 8;
        flip = false;
      }
      blitPet(host, pets[0], host.fx(walkX), host.fy(0), pose, flip);
      if (eating && host.eatFoodSprite) {
        var food = host.eatFoodSprite();
        if (food) host.blitItem(food.food, host.fx(food.xDots), host.fy(food.yDots), host.ITEM, false);
      }
    }

    // Shared poop piles (4 → sick). Draw small squares on the right.
    var piles = s.trash || 0;
    if (piles > 0) {
      var i;
      host.ctx.fillStyle = host.INK;
      for (i = 0; i < Math.min(piles, 8); i++) {
        var px = host.fx(28 - (i % 2) * 3);
        var py = host.fy(12 - Math.floor(i / 2) * 3);
        host.ctx.fillRect(px, py, 8, 8);
      }
    }
  }

  function menuRow(host, selected, y, label, maxDots) {
    if (root.VpetItems && root.VpetItems.blit) {
      try { root.VpetItems.blit(host.ctx, selected ? 'triangle' : 'empty_triangle', host.fx(1), y, host.ITEM || 4); } catch (e) {}
    }
    // Cursor ink cols 1-4; label owns cols 6-31 (v33). A row with an icon
    // at cols 24-31 passes a shorter field so the word stays clear of it.
    fitText(host, label, host.fx(6), y, maxDots || 26, 0, !selected);
  }

  function drawSickDots(host, x, y) {
    var d = host.DOT;
    host.ctx.fillStyle = host.INK;
    var i, j;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
      host.ctx.fillRect(x + i * 4 * d, y + j * 4 * d, 2 * d, 2 * d);
    }
  }

  function drawStatus(host) {
    lcdPaper(host);
    var Eapi = E();
    var pet = Eapi && Eapi.activePet(host.state);
    if (!pet) { fitText(host, 'NO DATA', host.fx(0), host.fy(5), 32, 0); return; }
    var m = D() && D().monster(pet.mon);
    var page = STATUS_PAGES[statusPage] || 'name';
    if (page === 'name') {
      // One line, native dots; long names scroll sideways (v33).
      fitText(host, (m && m.name) ? m.name : (pet.mon || '?'), host.fx(0), host.fy(5), 32, 1);
    } else if (page === 'age') {
      // Humulos 20th: age is how many days. The years mark belongs to the 1998 LCD.
      fitText(host, 'AGE', host.fx(2), host.fy(3), 30, 1);
      num(host, pet.ageDays || 0, host.fx(2), host.fy(9), host.ITEM);
    } else if (page === 'weight') {
      fitText(host, 'WEIGHT', host.fx(2), host.fy(3), 30, 0);
      num(host, pet.weight || 0, host.fx(2), host.fy(9), host.ITEM);
      text(host, 'G', host.fx(16), host.fy(9), host.ITEM);
    } else if (page === 'hunger') {
      fitText(host, 'HUNGER', host.fx(2), host.fy(3), 30, 1);
      hearts(host, pet.hunger || 0, host.fx(1), host.fy(8)); // v33: cols 1-31, rows 9-15
    } else if (page === 'strength') {
      fitText(host, 'STRENGTH', host.fx(2), host.fy(3), 30, 0);
      hearts(host, pet.strength || 0, host.fx(1), host.fy(8));
    } else if (page === 'effort') {
      fitText(host, 'EFFORT', host.fx(2), host.fy(3), 30, 1);
      hearts(host, Eapi.effortHearts(pet), host.fx(1), host.fy(8));
    } else if (page === 'dp') {
      fitText(host, 'DP', host.fx(2), host.fy(3), 30, 1);
      var cur = Math.floor((pet.dpQ || 0) / 4);
      var mx = Math.floor((pet.dpMaxQ || 0) / 4);
      num(host, cur, host.fx(2), host.fy(9), host.ITEM);
      text(host, '/', host.fx(12), host.fy(9), host.ITEM);
      num(host, mx, host.fx(16), host.fy(9), host.ITEM);
    } else if (page === 'attr') {
      fitText(host, 'ATTR', host.fx(2), host.fy(3), 30, 1);
      var a = (m && m.attr) || 'free';
      // Free: "there will be nothing listed"
      if (a !== 'free') fitText(host, String(a).toUpperCase(), host.fx(2), host.fy(9), 30, 1);
    } else if (page === 'bj') {
      // B = Battle, J = Jogress; O can, X cannot.
      var canB = !!(m && m.canBattle) && (pet.dpQ || 0) > 0;
      var canJ = !!(m && m.canJogress) && (pet.dpQ || 0) >= (pet.dpMaxQ || 0) && (pet.dpMaxQ || 0) > 0;
      text(host, 'B ' + (canB ? 'O' : 'X'), host.fx(2), host.fy(4), host.ITEM);
      text(host, 'J ' + (canJ ? 'O' : 'X'), host.fx(2), host.fy(10), host.ITEM);
    } else if (page === 'record') {
      // v33: 7-row digits on rows 1-7 and 9-15 (row 16 was off the LCD).
      text(host, 'W', host.fx(2), host.fy(1), host.ITEM);
      num(host, Math.min(999, pet.wins || 0), host.fx(10), host.fy(1), host.ITEM);
      text(host, 'L', host.fx(2), host.fy(9), host.ITEM);
      num(host, Math.min(999, pet.losses || 0), host.fx(10), host.fy(9), host.ITEM);
    }
  }

  function drawFood(host) {
    lcdPaper(host);
    // Meat and Protein, with the same food marks as the original menu.
    menuRow(host, subSel === 0, host.fy(2), 'MEAT', 16);
    menuRow(host, subSel === 1, host.fy(10), 'PROT', 16);
    if (root.VpetItems && root.VpetItems.blit) {
      root.VpetItems.blit(host.ctx, 'meat', host.fx(24), host.fy(0), host.ITEM || 4);
      root.VpetItems.blit(host.ctx, 'pill', host.fx(24), host.fy(8), host.ITEM || 4);
    }
  }
  function drawLight(host) {
    lcdPaper(host);
    menuRow(host, subSel === 0, host.fy(2), 'ON');
    menuRow(host, subSel === 1, host.fy(10), 'OFF');
  }
  function drawHeal(host) {
    lcdPaper(host);
    // Humulos: the two choices are the marks. Top = Dots (sick), bottom = Skull (injury).
    if (root.VpetItems && root.VpetItems.blit) {
      root.VpetItems.blit(host.ctx, subSel === 0 ? 'triangle' : 'empty_triangle', host.fx(1), host.fy(2), host.ITEM || 4);
      root.VpetItems.blit(host.ctx, subSel === 1 ? 'triangle' : 'empty_triangle', host.fx(1), host.fy(10), host.ITEM || 4);
      root.VpetItems.blit(host.ctx, 'skull', host.fx(10), host.fy(8), host.ITEM || 4);
    }
    drawSickDots(host, host.fx(10), host.fy(3));
  }
  function drawConnect(host) {
    lcdPaper(host);
    // Two 6-dot rows fit the 16-row LCD; the third item is on page 2 (v33).
    var rows = ['BATTLE', 'JOGRESS', 'COPYMON'];
    var pg = Math.floor(subSel / 2) * 2;
    for (var r = 0; r < 2 && pg + r < rows.length; r++) {
      menuRow(host, subSel === pg + r, host.fy(r ? 10 : 2), rows[pg + r]);
    }
  }
  function drawColoMenu(host) {
    lcdPaper(host);
    var s = host.state;
    // A cleared division reads "... CLEAR" on its own row (scrolls when
    // selected) instead of a CLEAR word drawn past the LCD edge (v33).
    var sClr = (s.coloSingle > 100) ? ' CLEAR' : '', tClr = (s.coloTag > 100) ? ' CLEAR' : '';
    if (battle.on && battle.phase === 'pick-act') {
      menuRow(host, subSel === 0, host.fy(2), 'START');
      menuRow(host, subSel === 1, host.fy(10), 'CONTINUE');
    } else {
      menuRow(host, subSel === 0, host.fy(2), 'SINGLE' + sClr);
      menuRow(host, subSel === 1, host.fy(10), 'TAG' + tClr);
    }
  }
  function drawColo(host) {
    lcdPaper(host);
    var pet = E() && E().activePet(host.state);
    if (battle.phase === 'fight') {
      if (pet) blitPet(host, pet, host.fx(0), host.fy(0));
      text(host, 'VS', host.fx(14), host.fy(6), host.ITEM);
      fitText(host, String(battle.foe || '?').toUpperCase(), host.fx(18), host.fy(6), 14, 0);
    } else if (battle.phase === 'result') {
      text(host, battle.won ? 'WIN' : 'LOSE', host.fx(8), host.fy(4), host.ITEM);
      if (battle.injured) text(host, 'INJURY', host.fx(6), host.fy(10), host.ITEM, 0);
    }
  }
  function drawTrain(host) {
    lcdPaper(host);
    var pet = E() && E().activePet(host.state);
    if (train.phase === 'count') {
      text(host, 'COUNT', host.fx(6), host.fy(2), host.ITEM);
      if (pet) blitPet(host, pet, host.fx(8), host.fy(4), monFrame(host));
      num(host, train.shakes || 0, host.fx(12), host.fy(9), host.ITEM);
    } else if (train.phase === 'result') {
      var lab = train.result === 'gigahit' ? 'GIGAHIT' : train.result === 'megahit' ? 'MEGAHIT' : train.result === 'success' ? 'GREAT' : 'FAIL';
      fitText(host, lab, host.fx(2), host.fy(6), 30, 0);
    }
  }
  function drawAlbum(host) {
    lcdPaper(host);
    var tabs = ['DIGIMON', 'COPYMON', 'RECORD', 'PASS'];
    var s = host.state;
    // Humulos: four options you choose between, then the chosen page.
    if (!albumOpen) {
      var pg = Math.floor(albumTab / 2) * 2;
      var r;
      for (r = 0; r < 2 && pg + r < tabs.length; r++) {
        menuRow(host, albumTab === pg + r, host.fy(r ? 10 : 2), tabs[pg + r]);
      }
      return;
    }
    // v33 layout: two rows (1-7, 9-15) at the native dot size.
    if (albumTab === 2) {
      // Record: W and B rows; CHAMPION alternates with the W row.
      if (s.champion && host.animTick() % 4 >= 2) fitText(host, 'CHAMPION', host.fx(0), host.fy(1), 32, 0);
      else {
        text(host, 'W', host.fx(2), host.fy(1), host.ITEM);
        num(host, Math.min(999, s.recordWins || 0), host.fx(10), host.fy(1), host.ITEM);
      }
      text(host, 'B', host.fx(2), host.fy(9), host.ITEM);
      num(host, Math.min(999, s.recordBattles || 0), host.fx(10), host.fy(9), host.ITEM);
      return;
    }
    fitText(host, tabs[albumTab], host.fx(1), host.fy(1), 31, 0);
    if (albumTab === 0) {
      var list = s.album || [];
      var id = list[albumIdx] || '';
      var m = id && D() && D().monster(id);
      var nm = (m && m.name) ? m.name : (id || '----');
      fitText(host, (list.length ? (albumIdx + 1) + ' ' : '') + nm, host.fx(0), host.fy(9), 32, 1);
    } else if (albumTab === 1) {
      var cm = (s.copymon || [])[albumIdx];
      fitText(host, cm ? String(cm.id).toUpperCase() : '----', host.fx(0), host.fy(9), 32, 1);
    } else {
      var i;
      for (i = 0; i < 6; i++) num(host, passDigits[i], host.fx(2 + i * 5), host.fy(8), host.ITEM);
      // caret under passPos: one dot tall, 4 dots wide (same dot size)
      host.ctx.fillStyle = host.INK;
      host.ctx.fillRect(host.fx(2 + passPos * 5), host.fy(15), 4 * host.DOT, host.DOT);
    }
  }
  function drawEggPick(host) {
    lcdPaper(host);
    var eggs = (host.state.unlockedEggs || []);
    var id = eggs[eggPickIdx] || '';
    var e = D() && D().EGGS && D().EGGS[id];
    // Left half text, right half egg (16 dots wide at cols 16-31) (v33).
    text(host, 'EGG', host.fx(1), host.fy(1), host.ITEM);
    fitText(host, (e && e.name) ? e.name : id, host.fx(0), host.fy(9), 15, 1);
    if (Spr() && Spr().has(id)) Spr().blit(host.ctx, id, host.fx(16), host.fy(0), 'idle0', false, host.INK, 4);
  }
  function drawClock(host) {
    lcdPaper(host);
    var s = host.state;
    var set = s.clockSet && s.clockSet.on;
    var h24, min;
    if (set) {
      h24 = s.clockSet.h24; min = s.clockSet.min;
    } else {
      var t = ((s.clockOffset || 0) + (s.gameTime || 0)) % 86400;
      if (t < 0) t += 86400;
      h24 = Math.floor(t / 3600);
      min = Math.floor((t % 3600) / 60);
    }
    var show24 = !!s.clock24h;
    var h = h24;
    var ap = '';
    if (!show24) {
      ap = h24 >= 12 ? 'PM' : 'AM';
      h = h24 % 12;
      if (h === 0) h = 12;
    }
    var hh = (h < 10 ? '0' : '') + h;
    var mm = (min < 10 ? '0' : '') + min;
    // v33: HH:MM = 21 dots (cols 1-21, rows 7-13), AM/PM cols 23-31,
    // SET on rows 0-5; digits now actually render (drawText dropped them).
    text(host, hh + ':' + mm, host.fx(1), host.fy(7), host.ITEM);
    if (ap) text(host, ap, host.fx(23), host.fy(8), host.ITEM, 0);
    if (set) text(host, 'SET', host.fx(1), host.fy(0), host.ITEM);
  }
  function drawDying(host) {
    lcdPaper(host);
    var pet = E() && E().activePet(host.state);
    if (pet && pet.dying) {
      blitPet(host, pet, host.fx(8), host.fy(0));
      if (host.animTick() % 2 === 0) text(host, '!!!!', host.fx(10), host.fy(9), host.ITEM);
    }
  }

  function draw(host) {
    if (!host || !host.ctx) return;
    host.ctx.imageSmoothingEnabled = false;
    var v = host.view;
    var s = host.state;
    var pet = E() && E().activePet(s);
    if (v === 'clock') drawClock(host);
    else if (v === 'status') drawStatus(host);
    else if (v === 'food') drawFood(host);
    else if (v === 'lightMenu') drawLight(host);
    else if (v === 'healMenu') drawHeal(host);
    else if (v === 'connect') drawConnect(host);
    else if (v === 'coloMenu') drawColoMenu(host);
    else if (v === 'colo') drawColo(host);
    else if (v === 'train') drawTrain(host);
    else if (v === 'album') drawAlbum(host);
    else if (v === 'eggPick') drawEggPick(host);
    else if (pet && pet.dying) drawDying(host);
    else drawPlay(host);
  }

  function noteInput(host) {
    lastInputAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (host.state && host.state.screenOff) {
      host.state.screenOff = false;
      return 'wake';
    }
    return '';
  }

  function attrMatch(attrs, attr) {
    if (!attrs || !attr) return false;
    var a = String(attr).toLowerCase();
    var map = { vaccine: 'Va', virus: 'Vi', data: 'Da', free: 'Fr' };
    var code = map[a] || '';
    return code && String(attrs).indexOf(code) >= 0;
  }

  function resolveTrain(host) {
    var s = host.state;
    var pet = E().activePet(s);
    if (!pet) { train.phase = 'idle'; host.setView('play'); return; }
    var m = D().monster(pet.mon);
    var parsed = D().parseShakes(m && m.shakes);
    var n = train.shakes || 0;
    var result = 'fail';
    if (n > 0) result = 'success';
    var gigaList = parsed.gigahit || [];
    if (!Array.isArray(gigaList)) gigaList = gigaList ? [gigaList] : [];
    var i, g, copymonAttr = null;
    if (s.copymon && s.copymon.length) {
      var cm = D().monster(s.copymon[0].id);
      copymonAttr = cm && cm.attr;
    }
    for (i = 0; i < gigaList.length; i++) {
      g = gigaList[i];
      if (g && g.count === n && attrMatch(g.attrs, copymonAttr)) { result = 'gigahit'; break; }
    }
    if (result !== 'gigahit' && parsed.megahit && parsed.megahit.indexOf(n) >= 0) result = 'megahit';
    E().train(s, result);
    train.result = result;
    train.phase = 'result';
    if (host.persist) host.persist();
  }

  function startTrain(host) {
    var pet = E().activePet(host.state);
    // Humulos: train the hatched Digimon, including Stage I. The egg has no training.
    if (!pet || pet.dead || pet.level === 'egg') {
      if (host.playPose) host.playPose('refuse', 900);
      return false;
    }
    train = { on: true, shakes: 0, startedAt: (typeof performance !== 'undefined' ? performance.now() : Date.now()), phase: 'count', result: null, tag: false };
    host.setView('train');
    if (root.PendulumShake && root.PendulumShake.requestPermission) {
      root.PendulumShake.requestPermission(function () {});
    }
  }

  function pressA(host) {
    if (noteInput(host) === 'wake') return true;
    var v = host.view;
    var s = host.state;
    if (v === 'clock') {
      if (s.clockSet && s.clockSet.on) { E().bumpClockHour(s); return true; }
      return true;
    }
    if (v === 'food' || v === 'lightMenu' || v === 'healMenu') {
      subSel = subSel ? 0 : 1;
      return true;
    }
    if (v === 'connect') { subSel = (subSel + 1) % 3; return true; }
    if (v === 'coloMenu') { subSel = subSel ? 0 : 1; return true; }
    if (v === 'album') {
      if (!albumOpen) { albumTab = (albumTab + 1) % 4; return true; }
      if (albumTab === 3) {
        passDigits[passPos] = (passDigits[passPos] + 1) % 10;
        return true;
      }
      if (albumTab === 0) {
        var n = (s.album || []).length;
        if (n) albumIdx = (albumIdx + 1) % n;
      } else if (albumTab === 1) {
        var c = (s.copymon || []).length;
        if (c) albumIdx = (albumIdx + 1) % c;
      }
      return true;
    }
    if (v === 'eggPick') {
      var eggs = s.unlockedEggs || [];
      if (eggs.length) eggPickIdx = (eggPickIdx + 1) % eggs.length;
      return true;
    }
    if (v === 'status') {
      statusPage = (statusPage + 1) % STATUS_PAGES.length;
      return true;
    }
    if (v === 'train' || v === 'colo') return true;
    // Only the icon row moves. Any other screen keeps the icon index.
    if (v !== 'play') return true;
    var sel = host.getSel();
    sel = sel < 0 ? 0 : (sel + 1) % SELECTABLE.length;
    host.setSel(sel);
    return true;
  }

  function pressB(host) {
    if (noteInput(host) === 'wake') return true;
    var v = host.view;
    var s = host.state;
    var Eapi = E();
    if (v === 'clock') {
      if (s.clockSet && s.clockSet.on) { Eapi.bumpClockMin(s); return true; }
      return true; // B does not close the clock
    }
    if (v === 'food') {
      var kind = subSel === 1 ? 'protein' : 'meat';
      var fed = Eapi.feed(s, kind);
      host.setView('play');
      if (!fed || !fed.ok) {
        if (host.playPose) host.playPose('refuse', 1100);
        if (host.returnToFoodSoon) host.returnToFoodSoon(1100);
      } else if (host.eatAnim) {
        // Same official 2 Hz eat as 1997 / Pendulum: 5 meat / 4 protein
        // frames, then return to the food menu (main loop, returnToFood).
        host.eatAnim.on = true;
        host.eatAnim.t = 0;
        host.eatAnim.kind = kind;
        host.eatAnim.refused = false;
        host.eatAnim.returnToFood = true;
      }
      if (host.persist) host.persist();
      // keep-last: do not reset subSel
      return true;
    }
    if (v === 'lightMenu') {
      var on = subSel === 0;
      Eapi.confirmLight(s, on);
      host.setView('play');
      if (host.persist) host.persist();
      return true;
    }
    if (v === 'healMenu') {
      Eapi.heal(s, subSel === 1 ? 'skull' : 'dots');
      host.setView('play');
      if (host.persist) host.persist();
      return true;
    }
    if (v === 'connect') {
      if (subSel === 1) {
        // Jogress on-device: left = active, right = the other pet
        var left = s.active || 0;
        var right = left === 0 ? 1 : 0;
        var r = Eapi.jogressOnDevice(s, left, 'pet', right);
        if (host.toast) host.toast(r.ok ? ('JOGRESS ' + (r.to || '')) : (r.error || 'NO'));
        host.setView('play');
        if (host.persist) host.persist();
      } else if (subSel === 2) {
        albumTab = 1; albumIdx = 0; albumOpen = true; host.setView('album');
      } else {
        // Connect Battle is not the Colosseum (that menu is SINGLE / TAG).
        // One device: settle a practice bout and show the result.
        var resB = Eapi.coloBattle(s, 'single', Math.random);
        if (!resB.ok) {
          if (host.toast) host.toast(resB.error === 'no-dp' ? 'NO DP' : (resB.error || 'NO'));
          return true;
        }
        battle.on = true;
        battle.phase = 'result';
        battle.won = !!resB.won;
        battle.injured = !!resB.injured;
        battle.foe = (resB.foe && (resB.foe.name || resB.foe.id)) || '';
        host.setView('colo');
        if (host.persist) host.persist();
      }
      return true;
    }
    if (v === 'coloMenu') {
      if (battle.phase === 'pick-div' || !battle.phase || battle.phase === 'idle') {
        battle.division = subSel === 1 ? 'tag' : 'single';
        battle.phase = 'pick-act';
        return true;
      }
      if (battle.phase === 'pick-act') {
        var div = battle.division || 'single';
        if (subSel === 0) {
          if (div === 'tag') s.coloTag = 1; else s.coloSingle = 1;
        }
        var res = Eapi.coloBattle(s, div, Math.random);
        if (!res.ok) {
          if (host.toast) host.toast(res.error === 'no-dp' ? 'NO DP' : (res.error || 'NO'));
          host.setView('play');
          battle.on = false;
          return true;
        }
        battle.phase = 'result';
        battle.won = !!res.won;
        battle.injured = !!res.injured;
        battle.foe = (res.foe && (res.foe.name || res.foe.id)) || '';
        host.setView('colo');
        if (host.persist) host.persist();
        return true;
      }
      return true;
    }
    if (v === 'colo') {
      host.setView('play');
      battle.on = false;
      battle.phase = 'pick-div';
      return true;
    }
    if (v === 'album') {
      if (!albumOpen) { albumOpen = true; albumIdx = 0; passPos = 0; return true; }
      if (albumTab === 3) {
        passPos = (passPos + 1) % 6;
        if (passPos === 0) {
          var code = passDigits.map(function (d) { return String(d); }).join('');
          var pr = Eapi.enterPassword(s, code);
          if (host.toast) host.toast(pr.ok ? ('OK ' + (pr.mon || '')) : 'NO');
          if (pr.ok && host.persist) host.persist();
        }
        return true;
      }
      return true;
    }
    if (v === 'eggPick') {
      var eggs = s.unlockedEggs || [];
      var pick = eggs[eggPickIdx];
      if (pick) {
        var r = Eapi.pickEgg(s, pick);
        if (host.toast && !r.ok) host.toast(r.error || 'NO');
      }
      host.setView('play');
      if (host.persist) host.persist();
      return true;
    }
    if (v === 'status') {
      statusPage = (statusPage + 1) % STATUS_PAGES.length;
      return true;
    }
    if (v === 'train') {
      if (train.phase === 'result') { host.setView('play'); train.phase = 'idle'; }
      return true;
    }
    // Play: confirm selection or open clock.
    var sel = host.getSel();
    if (sel < 0) { host.setView('clock'); return true; }
    var id = SELECTABLE[sel];
    if (id === 'STATUS') { statusPage = 0; host.setView('status'); return true; }
    if (id === 'FEED') { host.setView('food'); return true; } // keep-last subSel
    if (id === 'TRAIN') { startTrain(host); return true; }
    if (id === 'COLOSSEUM') {
      battle = { on: true, phase: 'pick-div', won: false, foe: '', startedAt: 0, injured: false };
      host.setView('coloMenu');
      return true;
    }
    if (id === 'FLUSH') {
      var n = s.trash || 0;
      Eapi.clean(s);
      if (host.startFlush) host.startFlush(n);
      if (host.persist) host.persist();
      return true;
    }
    if (id === 'LIGHT') { host.setView('lightMenu'); return true; }
    if (id === 'MEDIC') { host.setView('healMenu'); return true; }
    if (id === 'ALBUM') { albumOpen = false; host.setView('album'); return true; }
    if (id === 'CONNECT') { host.setView('connect'); return true; }
    return true;
  }

  function pressC(host) {
    if (noteInput(host) === 'wake') return true;
    var v = host.view;
    var s = host.state;
    var Eapi = E();
    if (v === 'clock') {
      if (s.clockSet && s.clockSet.on) {
        Eapi.confirmClock(s);
        if (host.persist) host.persist();
        host.setView('play');
        return true;
      }
      host.setView('play');
      return true;
    }
    if (v === 'album' && albumOpen) {
      // C cancels back to the four options. It does not submit a password.
      albumOpen = false;
      return true;
    }
    if (v !== 'play') {
      if (v === 'train' && train.phase === 'count') {
        // cancel without awarding? official C cancel — no effort if aborted? Unpublished.
        // Safer: do not call train() so no effort from a cancelled session. User left.
      }
      host.setView('play');
      train.phase = 'idle';
      battle.on = false;
      return true;
    }
    // Play: C cycles the shown Digimon (two-pet after first Stage III),
    // including both / egg / computer.
    Eapi.switchDisplay(s);
    if (host.persist) host.persist();
    return true;
  }

  function maybeChord(host, keyA, keyC) {
    var v = host.view;
    var s = host.state;
    if (keyA && keyC) {
      if (v === 'clock') {
        E().beginClockSet(s);
        return true;
      }
      if (v === 'play') {
        // A+C home = mute
        if (host.setSoundOn && host.isSoundOn) {
          host.setSoundOn(!host.isSoundOn());
        } else {
          s.muted = !s.muted;
        }
        return true;
      }
    }
    return false;
  }

  function maybeAB(host, keyA, keyB) {
    if (!(keyA && keyB)) return false;
    var s = host.state;
    if (s.display === 'egg' || s.display === 'computer') {
      eggPickIdx = 0;
      host.setView('eggPick');
      return true;
    }
    return false;
  }

  function onShake(n) {
    if (train.phase === 'count') {
      train.shakes += n || 1;
    }
    // Dying shake-save
    return train.shakes;
  }

  function noteShakeOnState(host, n) {
    noteInput(host);
    var s = host.state;
    var Eapi = E();
    var pet = Eapi && Eapi.activePet(s);
    if (pet && pet.dying) {
      Eapi.shakeSave(s);
      if (host.persist) host.persist();
      return;
    }
    onShake(n);
  }

  function tickMinigame(host) {
    if (train.phase === 'count') {
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      // ~4 s window (labelled: exact COUNT window unpublished). 8 frames at 500 ms.
      if (now - train.startedAt >= 8 * (host.ANIM_MS || 500)) {
        resolveTrain(host);
      }
    }
  }

  function onCanvasPointerDown() {}
  function onCanvasPointerMove() {}
  function onCanvasPointerUp() {}

  function setStatusPage(n) { statusPage = n || 0; }
  function setTrainForShot(phase, extra) {
    train.phase = phase || 'count';
    if (extra) {
      if (extra.shakes != null) train.shakes = extra.shakes;
      if (extra.startedAt != null) train.startedAt = extra.startedAt;
    }
  }

  var api = {
    draw: draw,
    pressA: pressA,
    pressB: pressB,
    pressC: pressC,
    maybeChord: maybeChord,
    maybeAB: maybeAB,
    tickMinigame: tickMinigame,
    noteShakeOnState: noteShakeOnState,
    onShake: onShake,
    onCanvasPointerDown: onCanvasPointerDown,
    onCanvasPointerMove: onCanvasPointerMove,
    onCanvasPointerUp: onCanvasPointerUp,
    setStatusPage: setStatusPage,
    setTrainForShot: setTrainForShot,
    getSubSel: function () { return subSel; },
    setSubSel: function (n) { subSel = n || 0; },
    /* v33 test hook (LCD text audit): set private sub-screen state. */
    setAuditState: function (o) {
      o = o || {};
      if ('albumOpen' in o) albumOpen = !!o.albumOpen;
      if ('albumTab' in o) {
        albumTab = o.albumTab;
        if (!('albumOpen' in o)) albumOpen = true;
      }
      if ('albumIdx' in o) albumIdx = o.albumIdx;
      if ('eggPickIdx' in o) eggPickIdx = o.eggPickIdx;
      if ('passPos' in o) passPos = o.passPos;
      if (o.battle) for (var k in o.battle) battle[k] = o.battle[k];
      if (o.train) for (var t in o.train) train[t] = o.train[t];
    },
    SELECTABLE: SELECTABLE,
    STATUS_PAGES: STATUS_PAGES,
    noteInput: noteInput
  };
  if (root.PendulumShake && typeof root.PendulumShake.onShake === 'function') {
    root.PendulumShake.onShake(function (n) { onShake(n || 1); });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Pen20UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
