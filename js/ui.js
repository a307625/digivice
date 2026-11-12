/**
 * Color pixel-art device UI: care, battle, save QR, PWA install hint.
 */
(function () {
  'use strict';
  var W = 256, H = 160;
  var MENU = [
    { id: 'status', label: '狀態', icon: 'icon_status' },
    { id: 'food', label: '食物', icon: 'icon_food' },
    { id: 'train', label: '訓練', icon: 'icon_train' },
    { id: 'battle', label: '對戰', icon: 'icon_battle' },
    { id: 'flush', label: '清掃', icon: 'icon_flush' },
    { id: 'lights', label: '燈光', icon: 'icon_lights' },
    { id: 'medicine', label: '治療', icon: 'icon_medicine' },
    { id: 'settings', label: '設定', icon: 'icon_settings' }
  ];
  var SPEEDS = [1, 10, 60, 120, 600];

  var canvas, ctx;
  var state = null;
  var view = 'boot'; // boot | play | train | evo | dead
  var menuIdx = 0;
  var frame = 0;
  var lastSave = 0;
  var toastMsg = '';
  var toastUntil = 0;
  var cache = {};
  var scanTimer = null;
  var scanStream = null;
  var train = { t: 0, pos: 0, dir: 1, done: false, success: false };
  var evoFx = { t: 0, from: '', to: '' };
  var battleFx = { t: 0, foe: '', result: '', active: false };
  var poseFx = { name: null, until: 0 };

  function playPose(name, ms, extra) {
    poseFx.name = name;
    poseFx.until = performance.now() + (ms || 1200);
    poseFx.extra = extra || null;
    poseFx.started = performance.now();
  }

  function monFrame() {
    if (!state) return 'idle0';
    if (state.dead) return 'idle0';
    if (state.sleeping) return (Math.floor(frame / 18) % 2) ? 'sleep1' : 'sleep0';
    if (poseFx.name && performance.now() < poseFx.until) {
      if (poseFx.name === 'eat') return (Math.floor(frame / 8) % 2) ? 'eat1' : 'eat0';
      if (poseFx.name === 'sleep') return (Math.floor(frame / 18) % 2) ? 'sleep1' : 'sleep0';
      if (poseFx.name === 'hurt') return (Math.floor(frame / 10) % 2) ? 'hurt1' : 'hurt0';
      return poseFx.name;
    }
    poseFx.name = null;
    poseFx.extra = null;
    return idleFrame();
  }

  function blitFlip(id, x, y, scale, frameName) {
    var c = spriteCanvas(id, frameName, scale || 1);
    if (!c) return;
    ctx.save();
    ctx.translate(Math.round(x) + c.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  }

  function blitOverlay(id, x, y, scale) {
    blit(id, x, y, scale || 1, 'idle0');
  }

  function $(id) { return document.getElementById(id); }
  function showOverlay(id, on) {
    var el = $(id);
    if (!el) return;
    if (on) el.classList.add('show');
    else el.classList.remove('show');
  }
  function hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach(function (el) { el.classList.remove('show'); });
  }
  function toast(msg, ms) {
    toastMsg = msg;
    toastUntil = performance.now() + (ms || 1800);
    var b = $('banner');
    if (b) {
      b.textContent = msg;
      b.classList.remove('hidden');
      setTimeout(function () { if (b.textContent === msg) b.classList.add('hidden'); }, ms || 1800);
    }
  }

  function mon() { return (window.EvolutionData.MONSTERS[state && state.mon]) || null; }

  function renderSafe(sprite, frameName, scale) {
    scale = scale || 1;
    var rows = (sprite.frames && (sprite.frames[frameName] || sprite.frames.idle0)) || [];
    var h = rows.length;
    var w = (rows[0] && rows[0].length) || sprite.w || 32;
    var cw = document.createElement('canvas');
    cw.width = w; cw.height = h;
    var c = cw.getContext('2d');
    var img = c.createImageData(w, h);
    var pal = sprite.pal || [];
    var dec = window.SpriteAtlas.decodeIndex;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = dec(rows[y][x] || '0');
        var hex = pal[i] || '#00000000';
        var p = (y * w + x) * 4;
        if (!hex || hex.length < 7 || hex.slice(0, 9) === '#00000000') { img.data[p + 3] = 0; continue; }
        img.data[p] = parseInt(hex.slice(1, 3), 16);
        img.data[p + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[p + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[p + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    if (scale === 1) return cw;
    var out = document.createElement('canvas');
    out.width = w * scale; out.height = h * scale;
    var o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(cw, 0, 0, out.width, out.height);
    return out;
  }

  function spriteCanvas(id, frameName, scale) {
    var key = id + ':' + (frameName || 'idle0') + ':' + scale;
    if (cache[key]) return cache[key];
    var sp = window.SpriteAtlas.SPRITES[id];
    if (!sp) return null;
    cache[key] = renderSafe(sp, frameName || 'idle0', scale);
    return cache[key];
  }

  function blit(id, x, y, scale, frameName) {
    var c = spriteCanvas(id, frameName, scale || 1);
    if (c) ctx.drawImage(c, Math.round(x), Math.round(y));
  }

  function idleFrame() {
    return (Math.floor(frame / 24) % 2) ? 'idle1' : 'idle0';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function clockStr() {
    if (!state) return '00:00';
    var s = window.Engine.clockSeconds(state);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return pad2(h) + ':' + pad2(m);
  }

  function isCalling() {
    if (!state || state.dead) return false;
    if (state.hunger <= 0 || state.strength <= 0) return true;
    if (state.sleeping && state.lights) return true;
    return false;
  }

  function drawBg() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#245c52');
    g.addColorStop(0.55, '#1b4a42');
    g.addColorStop(1, '#123830');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // floor
    ctx.fillStyle = '#0e2a24';
    ctx.fillRect(0, 124, W, 36);
    ctx.fillStyle = '#2e7a68';
    ctx.fillRect(0, 124, W, 2);
    // pixel dither
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (var y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    if (state && !state.lights) {
      ctx.fillStyle = 'rgba(4,8,16,0.55)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMenu() {
    ctx.fillStyle = '#0c201c';
    ctx.fillRect(0, 0, W, 22);
    var x = 4;
    for (var i = 0; i < MENU.length; i++) {
      var sel = i === menuIdx && view === 'play';
      if (sel) {
        ctx.fillStyle = '#e8c45c';
        ctx.fillRect(x - 1, 1, 18, 18);
      }
      blit(MENU[i].icon, x, 3, 1, 'idle0');
      x += 20;
    }
    ctx.fillStyle = '#d7f0c8';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(clockStr(), W - 4, 14);
    if (state && state.speed && state.speed !== 1) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8c45c';
      ctx.fillText('×' + state.speed, 166, 14);
    }
    if (isCalling() && Math.floor(frame / 12) % 2 === 0) {
      blit('icon_call', 148, 3, 1, 'idle0');
    }
  }

  function drawHearts(x, y, val, max, icon) {
    max = max || 4;
    for (var i = 0; i < max; i++) {
      blit(i < val ? 'icon_heart' : 'icon_heart_empty', x + i * 10, y, 1, 'idle0');
    }
  }

  function drawPlay() {
    drawBg();
    drawMenu();
    if (!state) return;
    var m = mon();
    var scale = 3;
    var sw = 32 * scale;
    var sh = 32 * scale;
    var mx = Math.floor((W - sw) / 2);
    var my = 28;
    var fr = monFrame();
    var walking = !state.dead && !state.sleeping && !poseFx.name && (fr === 'idle0' || fr === 'idle1');
    if (walking) {
      var span = 48;
      var period = span * 2;
      var t = Math.floor(frame / 3) % period;
      var dx = t <= span ? t : (period - t);
      mx = Math.floor((W - sw) / 2) - Math.floor(span / 2) + dx;
    }
    if (state.sleeping) my += 8;

    if (state.dead) {
      ctx.globalAlpha = 0.55;
      if (m) blit(state.mon, mx, my, scale, 'idle0');
      ctx.globalAlpha = 1;
      blitOverlay('overlay_zz', mx + sw - 8, my - 4, 1);
    } else if (m) {
      var flip = (poseFx.name === 'refuse' && Math.floor(frame / 6) % 2 === 1);
      if (flip) blitFlip(state.mon, mx, my, scale, 'refuse');
      else blit(state.mon, mx, my, scale, fr);
    }

    // food item shrinks toward the mouth (left side, left-facing)
    if (poseFx.name === 'eat' && poseFx.extra) {
      var dur = Math.max(200, poseFx.until - poseFx.started);
      var k = Math.min(1, Math.max(0, (performance.now() - poseFx.started) / dur));
      var foodId = poseFx.extra === 'protein' ? 'overlay_protein' : 'overlay_meat';
      if (!window.SpriteAtlas.SPRITES[foodId]) foodId = poseFx.extra === 'protein' ? 'icon_protein' : 'icon_food';
      var scF = Math.max(0.4, 1 - k * 0.7);
      var fx = mx - 8 + k * 18;
      var fy = my + 40 + k * 10;
      blitOverlay(foodId, fx, fy, scF < 0.7 ? 1 : 1);
    }

    // poop piles (shared overlay)
    var poopN = Math.min(4, state.poop || 0);
    for (var p = 0; p < poopN; p++) {
      blit('icon_poop', 208 + (p % 2) * 20, 100 + Math.floor(p / 2) * 18, 1, 'idle0');
    }
    // skull floats beside an injured Digimon
    if (state.injured) {
      var bob = Math.floor(frame / 10) % 2 === 0 ? 0 : 2;
      blitOverlay('overlay_skull', mx + sw - 6, my + 8 + bob, 1);
    }
    // Z's above the head when sleeping or tired-sleep pose
    if (state.sleeping) {
      var zbob = Math.floor(frame / 12) % 2 === 0 ? 0 : 3;
      blitOverlay('overlay_zz', mx + sw - 4, my - 2 + zbob, 1);
    }

    // name plate
    ctx.fillStyle = 'rgba(8,20,16,0.72)';
    ctx.fillRect(0, 142, W, 18);
    ctx.fillStyle = '#e8e0d0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    var label = m ? (m.nameZh + '  ' + m.nameEn) : '';
    var st = m && window.EvolutionData.STAGES[m.stage];
    if (st) label += '  ·  ' + st.zh;
    ctx.fillText(label, 6, 154);
    if (state.dead) {
      ctx.fillStyle = '#e05656';
      ctx.textAlign = 'right';
      ctx.fillText(state.deadReason || '死亡', W - 6, 154);
    }
  }

  function drawTrain() {
    drawBg();
    drawMenu();
    ctx.fillStyle = 'rgba(8,20,16,0.55)';
    ctx.fillRect(16, 30, W - 32, 100);
    ctx.strokeStyle = '#e8c45c';
    ctx.strokeRect(16, 30, W - 32, 100);
    ctx.fillStyle = '#e8c45c';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('訓練！在黃區按下確定', W / 2, 48);
    // bar
    var bx = 32, by = 70, bw = W - 64, bh = 16;
    ctx.fillStyle = '#0a1814';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#5dcc7a';
    var zone = 28;
    var zx = bx + Math.floor(bw / 2) - zone / 2;
    ctx.fillRect(zx, by, zone, bh);
    ctx.fillStyle = '#e8c45c';
    ctx.fillRect(zx + 8, by, zone - 16, bh);
    var px = bx + Math.floor(train.pos * (bw - 4));
    ctx.fillStyle = '#f0f4f0';
    ctx.fillRect(px, by - 2, 4, bh + 4);
    ctx.fillStyle = '#d7f0c8';
    ctx.font = '10px sans-serif';
    if (train.done) ctx.fillText(train.success ? '成功！' : '失敗…', W / 2, 108);
    else ctx.fillText('按 C / 確定', W / 2, 108);
    if (state && state.mon) {
      var fr = train.done ? (train.success ? 'happy' : 'angry') : (Math.floor(frame / 8) % 2 ? 'train1' : 'train0');
      if (!window.SpriteAtlas.SPRITES[state.mon] ||
          (fr.indexOf('train') === 0 && !window.SpriteAtlas.SPRITES[state.mon].frames[fr])) {
        fr = train.done ? (train.success ? 'happy' : 'angry') : 'attack';
      }
      blit(state.mon, (W - 96) / 2, 36, 3, fr);
      blitOverlay('overlay_wall', (W - 96) / 2 + 96 - 4, 52, 1);
    }
  }

  function drawEvo() {
    drawBg();
    var t = evoFx.t;
    ctx.fillStyle = '#fff8d0';
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t / 4);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    var id = t < 40 ? evoFx.from : evoFx.to;
    var efr = 'idle0';
    if (id && id.indexOf && id.indexOf('egg_') === 0 && t < 40) efr = (t > 16) ? 'hatch' : idleFrame();
    else efr = idleFrame();
    if (id) blit(id, (W - 96) / 2, 32, 3, efr);
    ctx.fillStyle = '#1a2418';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('進化！', W / 2, 148);
  }

  function drawBattleFx() {
    drawBg();
    var self = state && state.mon;
    var t = battleFx.t;
    var selfFr = 'idle0';
    var foeFr = 'idle0';
    if (t < 40) {
      selfFr = idleFrame();
      foeFr = idleFrame();
    } else if (t < 70) {
      if (battleFx.result === 'win') { selfFr = 'attack'; foeFr = 'hurt'; }
      else { selfFr = 'hurt'; foeFr = 'attack'; }
    } else {
      if (battleFx.result === 'win') { selfFr = 'happy'; foeFr = 'angry'; }
      else { selfFr = 'angry'; foeFr = 'happy'; }
    }
    blit(self, 20, 40, 3, selfFr);
    blit(battleFx.foe, W - 20 - 96, 40, 3, foeFr);
    if (t >= 40 && t < 70) {
      var goingRight = battleFx.result === 'win';
      var u = (t - 40) / 30;
      var sx = goingRight ? 20 + 96 : W - 20 - 96;
      var ex = goingRight ? W - 20 - 96 : 20 + 96;
      var px = sx + (ex - sx) * u;
      blitOverlay('overlay_shot', px, 70, 1);
      if (u > 0.75) blitOverlay('overlay_hit', ex - 8, 64, 1);
    }
    ctx.fillStyle = '#e8c45c';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    if (t < 50) ctx.fillText('VS', W / 2, 80);
    else {
      var txt = battleFx.result === 'win' ? '勝利！' : '敗北…';
      ctx.fillStyle = battleFx.result === 'win' ? '#5dcc7a' : '#e05656';
      ctx.fillText(txt, W / 2, 80);
    }
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    if (view === 'train') drawTrain();
    else if (view === 'evo') drawEvo();
    else if (view === 'battle') drawBattleFx();
    else drawPlay();
  }

  function persist() {
    if (!state) return;
    try { window.SaveIO.saveLocal(state); lastSave = Date.now(); } catch (e) {}
  }

  function loadGame(s) {
    state = s;
    state.lastReal = Date.now();
    if (state.dead) view = 'play';
    else view = 'play';
    persist();
  }

  function newEgg(version, special, randomize) {
    var prevSpeed = (state && state.speed) || 60;
    state = window.Engine.hatchIfEggSelect(state, version, !!randomize, special || null);
    state.speed = prevSpeed;
    view = 'play';
    hideAllOverlays();
    persist();
    var m = mon();
    toast((m ? m.nameZh : '數碼蛋') + ' 開始育成');
  }

  function confirmOverwrite(msg, fn) {
    if (state && !state.dead && window.SaveIO.hasLocal()) {
      if (!window.confirm(msg || '將覆蓋目前的育成進度，確定嗎？')) return;
    }
    fn();
  }

  function cycleMenu(dir) {
    if (view !== 'play') return;
    menuIdx = (menuIdx + dir + MENU.length) % MENU.length;
  }

  function openStatus() {
    if (!state) return;
    var s = window.Engine.status(state);
    var wr = function (r) { return (Math.round(r * 1000) / 10).toFixed(1) + '%'; };
    $('status-body').innerHTML =
      '<div class="status-grid">' +
      '<div>名稱 <b>' + s.nameZh + '</b></div><div>' + s.nameEn + '</div>' +
      '<div>時期 <b>' + s.stageZh + '</b></div><div>' + s.stageEn + '</div>' +
      '<div>版本 <b>Ver.' + s.version + '</b></div><div>年齡 <b>' + s.age + '</b> 日</div>' +
      '<div>體重 <b>' + s.weight + '</b> g</div><div>階段時間 <b>' + s.timeInStageMin + '</b> 分</div>' +
      '<div>飢餓 <b>' + s.hunger + '</b> / 4</div><div>體力 <b>' + s.strength + '</b> / 4</div>' +
      '<div>DP <b>' + s.dp + '</b> / ' + s.dpMax + '</div><div>育成失誤 <b>' + s.calls + '</b></div>' +
      '<div>訓練 <b>' + s.train + '</b></div><div>過食 <b>' + s.overfeed + '</b></div>' +
      '<div>睡眠打擾 <b>' + s.sleepDist + '</b></div><div>標籤勝 <b>' + s.tagWins + '</b></div>' +
      '</div>' +
      '<h3>本階段對戰（進化用）</h3>' +
      '<p>對戰 <b>' + s.battles + '</b>　勝 <b>' + s.wins + '</b>　敗 <b>' + s.losses +
      '</b>　勝率 <b>' + wr(s.winRate) + '</b></p>' +
      '<p style="font-size:12px;color:#8a9aaa">完全體條件：本階段對戰 15 場以上且勝率 80% 以上。進化時此紀錄會重置。</p>' +
      '<h3>生涯對戰（顯示用）</h3>' +
      '<p>對戰 <b>' + s.lifeBattles + '</b>　勝 <b>' + s.lifeWins + '</b>　敗 <b>' + s.lifeLosses +
      '</b>　勝率 <b>' + wr(s.lifeWinRate) + '</b></p>';
    showOverlay('overlay-status', true);
  }

  function openFood() {
    showOverlay('overlay-food', true);
  }

  function startTrain() {
    var m = mon();
    if (!m || m.stage === 'egg' || m.stage === 'baby1' || m.stage === 'baby2') {
      toast('還太小，無法訓練');
      return;
    }
    if (state.dead) return;
    hideAllOverlays();
    train = { t: 0, pos: 0, dir: 1, done: false, success: false };
    view = 'train';
  }

  function resolveTrain() {
    if (train.done) return;
    var mid = 0.5;
    train.success = Math.abs(train.pos - mid) < 0.12;
    train.done = true;
    window.Engine.finishTraining(state, train.success, true);
    persist();
    toast(train.success ? '訓練成功' : '訓練失敗');
    setTimeout(function () {
      if (view === 'train') view = 'play';
      playPose(train.success ? 'happy' : 'angry', 1400);
    }, 700);
  }

  function doFlush() {
    window.Engine.flush(state);
    persist();
    toast('清掃完成');
  }
  function doLights() {
    var r = window.Engine.toggleLights(state);
    persist();
    toast(r.lights ? '開燈' : '關燈');
  }
  function doHeal() {
    var r = window.Engine.heal(state);
    persist();
    toast(r.ok ? '治療完成' : (r.reason === 'healthy' ? '沒有受傷' : '無法治療'));
  }

  function openBattle() {
    if (!state || state.dead) return;
    var m = mon();
    if (!m || !m.canBattle) { toast('現在還不能對戰'); return; }
    if (state.dp <= 0) { toast('DP 不足，請先睡覺補充'); return; }
    var partners = window.Engine.jogressPartners(state);
    var box = $('jogress-box');
    if (partners.length) {
      box.classList.remove('hidden');
      box.innerHTML = partners.map(function (p) {
        var pm = window.EvolutionData.MONSTERS[p.partner] || {};
        return '<p>合體對象：' + (pm.nameZh || p.partner) + ' → ' + p.nameZh +
          '（標籤勝 ' + p.have + ' / ' + p.tagWins + '）</p>' +
          '<button class="btn" data-jogress="' + p.partner + '">標籤對戰（對 CPU）</button> ' +
          '<button class="btn primary" data-jogress-evolve="' + p.partner + '">合體進化</button>';
      }).join('');
    } else {
      box.classList.add('hidden');
      box.innerHTML = '';
    }
    showOverlay('overlay-battle', true);
  }

  function cpuBattle(isTag) {
    if (!window.Engine.canBattle(state)) { toast('現在不能對戰'); return; }
    var foe = window.Battle.pickCpuFoe(state.mon);
    var result = window.Battle.resolveBattle(state.mon, foe, Date.now() >>> 0, window.Battle.snapshot(state), { mon: foe, strength: 2, weight: 20 });
    hideAllOverlays();
    battleFx = { t: 0, foe: foe, result: result, active: true };
    view = 'battle';
    window.Engine.recordBattle(state, result);
    if (isTag && result === 'win') window.Engine.addTagWin(state);
    persist();
  }

  function finishBattleFx() {
    view = 'play';
    var foe = window.EvolutionData.MONSTERS[battleFx.foe];
    toast((battleFx.result === 'win' ? '戰勝了 ' : '敗給了 ') + ((foe && foe.nameZh) || ''));
    battleFx.active = false;
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
    if (!state) return;
    var code = window.SaveIO.encode(state);
    $('export-code').value = code;
    drawQr('qrbox', code);
    showOverlay('overlay-export', true);
  }

  function openImport() {
    $('import-code').value = '';
    stopScan();
    showOverlay('overlay-import', true);
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
                $('pvp-in').value = r.data;
                hideAllOverlays();
                openBattle();
                toast('已讀取對戰碼，請按對應按鈕');
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

  function openSettings() {
    var sel = $('speed');
    if (sel && state) sel.value = String(state.speed || 60);
    showOverlay('overlay-settings', true);
  }

  function openInstall() { showOverlay('overlay-install', true); }

  function confirmMenu() {
    if (view === 'train') { resolveTrain(); return; }
    if (view === 'evo' || view === 'battle') return;
    if (!state || view !== 'play') return;
    var id = MENU[menuIdx].id;
    if (id === 'status') openStatus();
    else if (id === 'food') openFood();
    else if (id === 'train') startTrain();
    else if (id === 'battle') openBattle();
    else if (id === 'flush') doFlush();
    else if (id === 'lights') doLights();
    else if (id === 'medicine') doHeal();
    else if (id === 'settings') openSettings();
  }

  function loop(ts) {
    frame++;
    if (state && (view === 'play' || view === 'train')) {
      var r = window.Engine.tick(state, Date.now());
      if (r.evolved) {
        var ev = (state.events || []).slice(-1)[0];
        evoFx = { t: 0, from: '', to: state.mon };
        view = 'evo';
        toast((ev && ev.text) || '進化！', 2000);
      }
      if (r.died) toast('數碼寶貝死亡：' + (state.deadReason || ''), 3000);
      if (Date.now() - lastSave > 2500) persist();
    }
    if (view === 'train' && !train.done) {
      train.pos += train.dir * 0.018;
      if (train.pos >= 1) { train.pos = 1; train.dir = -1; }
      if (train.pos <= 0) { train.pos = 0; train.dir = 1; }
    }
    if (view === 'evo') {
      evoFx.t++;
      if (evoFx.t > 90) view = 'play';
    }
    if (view === 'battle') {
      battleFx.t++;
      if (battleFx.t > 110) finishBattleFx();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function bind() {
    canvas = $('screen');
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function pressA() {
      if (document.querySelector('.overlay.show')) { hideAllOverlays(); stopScan(); return; }
      if (view === 'train') { view = 'play'; return; }
      cycleMenu(-1);
    }
    function pressB() { cycleMenu(1); }
    function pressC() { confirmMenu(); }

    $('btn-a').addEventListener('click', pressA);
    $('btn-b').addEventListener('click', pressB);
    $('btn-c').addEventListener('click', pressC);
    canvas.addEventListener('click', function (ev) {
      if (view !== 'play' || !state) return;
      var rect = canvas.getBoundingClientRect();
      var x = (ev.clientX - rect.left) * (W / rect.width);
      var y = (ev.clientY - rect.top) * (H / rect.height);
      if (y < 24) {
        var i = Math.floor((x - 4) / 20);
        if (i >= 0 && i < MENU.length) { menuIdx = i; confirmMenu(); }
      }
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { pressA(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'b' || e.key === 'B') { pressB(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'c' || e.key === 'C') {
        if (document.querySelector('.overlay.show')) return;
        pressC(); e.preventDefault();
      } else if (e.key === 'Escape') { hideAllOverlays(); stopScan(); if (view === 'train') view = 'play'; }
    });

    document.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { hideAllOverlays(); stopScan(); });
    });

    $('boot-continue').addEventListener('click', function () {
      var s = window.SaveIO.loadLocal();
      if (!s) { toast('沒有找到存檔'); return; }
      loadGame(s);
      hideAllOverlays();
    });
    $('boot-new').addEventListener('click', function () {
      if (window.SaveIO.hasLocal() && !window.confirm('開始新育成會覆蓋現有存檔，確定嗎？')) return;
      hideAllOverlays();
      showOverlay('overlay-egg', true);
    });
    $('boot-import').addEventListener('click', function () { hideAllOverlays(); openImport(); });
    $('boot-install').addEventListener('click', function () { openInstall(); });

    document.querySelectorAll('[data-egg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-egg');
        if (v === 'random') newEgg(1, null, true);
        else if (v === 'random_all') newEgg(1, null, true);
        else if (/^[1-5]$/.test(v)) newEgg(parseInt(v, 10), null, false);
        else newEgg(1, v, false);
      });
    });

    $('feed-meat').addEventListener('click', function () {
      var r = window.Engine.feedMeat(state);
      persist();
      if (r.overfeed) { toast('吃太飽，過食 +1'); hideAllOverlays(); playPose('refuse', 1400); }
      else if (r.ok) { toast('吃了肉'); hideAllOverlays(); playPose('eat', 1400, 'meat'); }
      else toast(r.reason === 'full' ? '已經吃飽了' : '現在不能吃');
    });
    $('feed-protein').addEventListener('click', function () {
      var r = window.Engine.feedProtein(state);
      persist();
      if (r.ok) { toast('吃了蛋白質'); hideAllOverlays(); playPose('eat', 1400, 'protein'); }
      else toast('現在不能吃');
    });

    $('cpu-battle').addEventListener('click', function () { cpuBattle(false); });
    $('pvp-offer').addEventListener('click', showOffer);
    $('pvp-accept').addEventListener('click', acceptOffer);
    $('pvp-result').addEventListener('click', applyPvpResult);

    $('jogress-box').addEventListener('click', function (e) {
      var ev = e.target.getAttribute && e.target.getAttribute('data-jogress');
      var ev2 = e.target.getAttribute && e.target.getAttribute('data-jogress-evolve');
      if (ev) cpuBattle(true);
      if (ev2) {
        var r = window.Engine.tryJogress(state, ev2);
        persist();
        if (r.ok) { hideAllOverlays(); toast('合體進化成 ' + r.nameZh); evoFx = { t: 0, from: '', to: state.mon }; view = 'evo'; }
        else if (r.reason === 'need-tags') toast('還需要標籤勝 ' + r.have + ' / ' + r.need);
        else toast('現在無法合體');
      }
    });

    $('btn-export').addEventListener('click', openExport);
    $('btn-import').addEventListener('click', function () { hideAllOverlays(); openImport(); });
    $('btn-install').addEventListener('click', openInstall);
    $('copy-export').addEventListener('click', function () {
      var t = $('export-code').value;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('已複製存檔碼'); });
      else { $('export-code').select(); document.execCommand('copy'); toast('已複製存檔碼'); }
    });
    $('do-import').addEventListener('click', function () { doImportText($('import-code').value); });
    $('start-scan').addEventListener('click', startScan);
    $('stop-scan').addEventListener('click', stopScan);

    $('speed').addEventListener('change', function () {
      if (!state) return;
      state.speed = parseInt($('speed').value, 10) || 60;
      persist();
      toast('時間速度 ×' + state.speed);
    });
    $('btn-newgame').addEventListener('click', function () {
      if (!window.confirm('確定放棄目前進度、重新選蛋？')) return;
      hideAllOverlays();
      showOverlay('overlay-egg', true);
    });

    if (window.SaveIO.hasLocal()) $('boot-continue').disabled = false;
    else $('boot-continue').disabled = true;
    showOverlay('overlay-boot', true);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }

    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
