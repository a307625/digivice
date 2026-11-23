/**
 * v34 long simulated life (egg → final form / death) for every built device.
 * Runs in node (tests/long-life.test.js) and in headless Chrome
 * (digivice-v34-hotfix/longlife.js injects this file and also renders every
 * simulated hour through the real UI). Drives the real engines through the
 * public care APIs with a seeded RNG and a mocked clock; reports crashes,
 * NaN/Infinity in the save, stuck stages, unknown mon ids, the evolution
 * path, the death cause and day count.
 */
(function (root) {
  'use strict';
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function scanBad(o, path, out, depth) {
    if (depth > 6 || out.length > 5) return;
    if (typeof o === 'number') { if (!isFinite(o)) out.push(path + '=' + o); return; }
    if (!o || typeof o !== 'object') return;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) {
      if (k === 'events' || k === 'steps') continue;
      // Infinity is the documented "never" sentinel for a few timers.
      if (o[k] === Infinity && /Until|At$|Due/.test(k)) continue;
      scanBad(o[k], path + '.' + k, out, depth + 1);
    }
  }
  var CONFIGS = [];
  [1, 2, 3, 4, 5].forEach(function (v) { CONFIGS.push({ id: '1997-v' + v, fam: 'dm1997', v: v, sp: null }); });
  ['zuba', 'meicoo', 'corona', 'luna', 'doru', 'hack', 'dra_blue', 'dra_green', 'anime_agumon', 'anime_gabumon']
    .forEach(function (e) { CONFIGS.push({ id: 'dm20-' + e, fam: 'dm20', v: 1, sp: e }); });
  ['1_0', '1_5', '2_0', '2_5', '3_0', '3_5', '4_0', '4_5', '5_0', '5_5', 'zero']
    .forEach(function (v) { CONFIGS.push({ id: 'pen-' + v, fam: 'pendulum', v: 1, sp: 'pen_' + v }); });
  ['sk', 'sb'].forEach(function (c) { CONFIGS.push({ id: 'pen20-' + c, fam: 'pen20', v: 1, sp: 'pen_20th_' + c }); });
  [1, 2].forEach(function (v) { for (var k = 0; k < (v === 1 ? 7 : 7); k++) CONFIGS.push({ id: 'digivice-v' + v + '-p' + k, fam: 'digivice', v: 1, sp: 'dv1999_v' + v, partner: k }); });

  function monOf(cfg, s) {
    if (cfg.fam === 'pen20') { var p = s.pets && s.pets[0]; return p ? p.mon : null; }
    if (cfg.fam === 'digivice') { var a = root.DigiviceEngine.active(s); return a ? a.mon : null; }
    return s.mon;
  }
  function stageOf(cfg, s) {
    if (cfg.fam === 'pen20') { var p = s.pets && s.pets[0]; return p ? p.level : null; }
    if (cfg.fam === 'digivice') { var a = root.DigiviceEngine.active(s); return a ? String(a.stage) : null; }
    if (cfg.fam === 'pendulum') { var m = root.PendulumEngine.mon(s); return m ? m.stage : null; }
    var mm = root.Engine.mon(s); return mm ? mm.stage : null;
  }
  function deadOf(cfg, s) {
    if (cfg.fam === 'pen20') return !!(s.pets[0] && s.pets[0].dead);
    if (cfg.fam === 'digivice') return false;
    return !!s.dead;
  }
  function knownMon(cfg, s, id) {
    if (!id) return false;
    if (cfg.fam === 'pen20') return !!(root.Pen20Data.monster(id) || id === 'egg');
    if (cfg.fam === 'digivice') return !!root.DigiviceSprites.get(id);
    if (cfg.fam === 'pendulum') return !!root.PendulumEngine.mon(s);
    return !!root.Engine.mon(s);
  }

  /* policy: 'good' = attentive owner; 'casual' = checks every 1-3 h by day,
     never at night; 'neglect' = never cares (must die by the official rules). */
  function care(cfg, s, P, rnd) {
    var E;
    if (cfg.fam === 'dm1997' || cfg.fam === 'dm20') {
      E = root.Engine; var m = E.mon(s); if (!m || m.stage === 'egg' || s.dead) return;
      if (s.sleeping) { if (s.lights) E.setLights(s, false); return; }
      if (!s.lights) E.setLights(s, true);
      var n = 0; while (s.hunger < 4 && n++ < 6) E.feedMeat(s);
      if (s.strength < 4) {
        if (E.canTrain(s) && rnd() < 0.7) {
          if (E.isDm20(s)) { E.noteTrainingOpened(s); E.finishDm20Training(s, 6 + Math.floor(rnd() * 20)); }
          else { E.noteTrainingOpened(s); E.finishTraining(s, rnd() < 0.7, true); }
        } else { n = 0; while (s.strength < 4 && n++ < 6) E.feedProtein(s); }
      }
      if (s.poop > 0) E.flush(s);
      n = 0; while (s.injured && n++ < 5) E.heal(s);
      if (E.canBattle(s) && rnd() < P.battle) E.recordBattle(s, rnd() < P.win ? 'win' : 'lose');
    } else if (cfg.fam === 'pendulum') {
      E = root.PendulumEngine; var pm = E.mon(s); if (!pm || pm.stage === 'egg' || s.dead) return;
      if (s.dying) { if (P.every === 1) E.addShake(s, 40); return; }
      if (s.sleeping || s.tired) { if (s.lights) E.setLights(s, false); return; }
      if (!s.lights) E.setLights(s, true);
      var k = 0; while (s.hunger < (s.hungerCap || 4) && k++ < 6) { var r = E.feedMeat(s); if (r && r.refused) break; }
      if (s.strength < 4) {
        if (E.canTrain(s) && rnd() < 0.6) E.finishTraining(s, Math.floor(rnd() * 6));
        else { k = 0; while (s.strength < 4 && k++ < 6) E.feedProtein(s); }
      }
      if (s.poop > 0) E.flush(s);
      k = 0; while (s.sick && k++ < 8) E.healSick(s);
      k = 0; while (s.injured && k++ < 10) E.healInjury(s);
      if (E.canBattle(s) && rnd() < P.battle) E.recordBattle(s, rnd() < P.win ? 'win' : 'lose');
    } else if (cfg.fam === 'pen20') {
      E = root.Pen20Engine; var p = s.pets[0]; if (!p || p.dead || p.level === 'egg') return;
      if (p.dying) { if (P.every === 1) E.shakeSave(s, 0); return; }
      s.display = 'pet0'; s.active = 0;
      if (p.tired) { E.confirmLight(s, false); return; }
      if (p.sleeping) return;
      if (p.frozen) E.confirmLight(s, true);
      var j = 0; while (p.hunger < 4 && j++ < 6) E.feed(s, 'meat');
      if (p.strength < 4) { if (rnd() < 0.6) E.train(s, rnd() < 0.15 ? 'megahit' : (rnd() < 0.7 ? 'success' : 'fail')); else E.feed(s, 'protein'); }
      if (s.trash > 0 || p.poop > 0) E.clean(s);
      if (p.sick) E.heal(s, 'dots');
      if (p.injured) E.heal(s, 'skull');
      if (rnd() < P.battle && (p.dpQ || 0) >= 4 && !p.sick && !p.injured) {
        var mon = root.Pen20Data.monster(p.mon);
        if (mon && mon.canBattle) E.doBattle(s, p, { id: 'agu', attr: 'vaccine', power: 10 + Math.floor(rnd() * 60) }, rnd);
      }
    } else if (cfg.fam === 'digivice') {
      E = root.DigiviceEngine;
      var a = E.active(s); if (!a) return;
      if (s.battle) { if (s.battle.phase === 'result' || s.battle.phase === 'quick' || s.battle.result) E.dismissBattle(s); else { E.setBattleOption(s, rnd() < 0.3 ? 'QUICK' : 'USE'); E.confirmUse(s, Math.floor(rnd() * 25)); E.dismissBattle(s); } return; }
      if (a.injured) { E.treatMedical(s); }
      if (s.help && s.help.active) { E.applyHelpShake(s, 30); if (s.help.catchReady) E.catchHelp(s); return; }
      if (s.encounter) {
        if (s.encounter.optional && rnd() < 0.1) E.declineEncounter(s);
        else if (!E.startBattle(s, { encounter: s.encounter })) { if (s.encounter.optional) E.declineEncounter(s); }
        return;
      }
      E.noteShake(s, P.walk);
    }
  }

  function runLife(cfg, opts) {
    opts = opts || {};
    var policy = opts.policy || 'good';
    var P = { ace: { every: 1, battle: 0.01, walk: 80, win: 1 }, good: { every: 1, battle: 0.004, walk: 60, win: 0.6 }, casual: { every: 0, battle: 0.15, walk: 40, win: 0.6 }, neglect: { every: -1, battle: 0, walk: 0 } }[policy];
    var stepSec = opts.stepSec || 60;
    var maxDays = opts.maxDays || (cfg.fam === 'digivice' ? 40 : 60);
    var rnd = mulberry32((opts.seed || 1) * 7919 + cfg.id.length * 131);
    var realRandom = Math.random, realNow = Date.now;
    var T = new Date(2026, 10, 1, 8, 0, 0).getTime(); // device clock set to 08:00
    var out = { id: cfg.id, policy: policy, errors: [], path: [], stages: [], days: 0, dead: false, cause: null, final: null, ticks: 0, renders: 0 };
    Math.random = rnd; Date.now = function () { return T; };
    var s;
    try {
      s = root.Devices.hatchEgg(null, cfg.v, false, cfg.sp);
      if (cfg.fam === 'digivice') {
        root.DigiviceEngine.pickPartner(s, cfg.partner || 0);
        s.clock = { h12: 8, min: 0, pm: false, field: 'h' }; root.DigiviceEngine.confirmClock(s);
      } else {
        s.clockInitialized = true; if (s.clockSet) s.clockSet.on = false;
        s.clockOffset = 8 * 3600 - (s.gameTime || 0); s.clockAnchor = { value: 8 * 3600, at: T }; s.clockSyncOffset = s.clockOffset;
      }
      s.lastReal = T;
      var lastMon = null, monSince = 0, nextCare = 0, steps = Math.floor(maxDays * 86400 / stepSec);
      for (var i = 0; i < steps; i++) {
        T += stepSec * 1000;
        root.Devices.tick(s, T);
        out.ticks++;
        var simH = (T - out.t0 || 0);
        var hour = Math.floor((root.Devices.clockSeconds(s) || 0) / 3600);
        var night = hour >= 21 || hour < 8;
        if (P.every === 1) care(cfg, s, P, rnd);
        else if (P.every === 0 && i >= nextCare) { if (!night || cfg.fam === 'pen20' || rnd() < 0.15) care(cfg, s, P, rnd); nextCare = i + Math.floor((60 + rnd() * 120) * 60 / stepSec); }
        if (opts.onStep && i % Math.round(3600 / stepSec) === 0) { opts.onStep(s, cfg, out); out.renders++; }
        var id = monOf(cfg, s);
        if (id !== lastMon) {
          if (!knownMon(cfg, s, id)) out.errors.push('unknown mon id "' + id + '" at day ' + (i * stepSec / 86400).toFixed(2));
          out.path.push(id); out.stages.push(stageOf(cfg, s)); lastMon = id; monSince = i;
        }
        var stg = stageOf(cfg, s), held = (i - monSince) * stepSec / 86400;
        var limit = { egg: 1, baby1: 1, baby2: 2, Egg: 1, 'I': 1, 'II': 2, egg_: 1 }[stg];
        if (limit && held > limit && !deadOf(cfg, s)) { out.errors.push('stuck in ' + stg + ' (' + id + ') for ' + held.toFixed(1) + ' days'); break; }
        if (i % 120 === 0) { var bad = []; scanBad(s, 'state', bad, 0); if (bad.length) { out.errors.push('non-finite: ' + bad.join(', ')); break; } }
        if (deadOf(cfg, s)) {
          out.dead = true;
          out.cause = cfg.fam === 'pendulum' ? (s.deathReason || 'dead') : (cfg.fam === 'pen20' ? (s.pets[0].deathReason || s.pets[0].dyingReason || 'dead') : (s.deadReason || 'dead'));
          // a few more ticks after death must not crash
          for (var d = 0; d < 30; d++) { T += stepSec * 1000; root.Devices.tick(s, T); }
          break;
        }
        if (cfg.fam === 'digivice' && root.DigiviceEngine.mapComplete(s)) { out.mapComplete = true; break; }
      }
      out.days = +(out.ticks * stepSec / 86400).toFixed(2);
      out.final = monOf(cfg, s);
      out.finalStage = stageOf(cfg, s);
      if (cfg.fam === 'digivice') { out.party = (s.party || []).map(function (p) { return p.mon; }); out.areas = s.areasCleared || 0; }
    } catch (e) {
      out.errors.push('crash: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    } finally {
      Math.random = realRandom; Date.now = realNow;
    }
    out.state = s;
    return out;
  }
  var api = { CONFIGS: CONFIGS, runLife: runLife };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VpetLifeSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
