/**
 * Original Pendulum OG rules engine (Ver.1.0–5.5 + ZERO).
 * Isolated from the 1997 Engine — does not call 1997 care / battle /
 * evolution formulas. Shared infrastructure only: save format conventions,
 * clock second arithmetic, and the step-counter ledger (ungated).
 *
 * See pendulum/data.js for sources and conflict resolutions.
 */
(function (root) {
  'use strict';

  function data() {
    return root.PendulumData;
  }

  var MAX_CATCHUP = 13 * 3600;

  function now() { return Date.now(); }

  function mon(state) {
    var D = data();
    return (D && D.monster(state && state.mon, state && state.version)) || null;
  }

  function rules() { return data().RULES; }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function verMeta(eggKind) {
    var D = data();
    if (D && D.versionForEgg) return D.versionForEgg(eggKind || 'pen_1_0');
    return { key: '1.0', id: 'pen-1-0', eggKind: eggKind || 'pen_1_0', baby1: 'babumon', baby2: 'motimon' };
  }

  function defaultState(eggKind) {
    var clock = new Date();
    var D = data();
    var meta = verMeta(eggKind);
    var egg = (D && D.monster && D.monster('pen_egg', meta.key)) || (D && D.MONSTERS && D.MONSTERS.pen_egg) || {};
    return {
      family: 'pendulum',
      deviceId: meta.id || 'pen-1-0',
      version: meta.key || '1.0',
      eggKind: meta.eggKind || eggKind || 'pen_1_0',
      mon: 'pen_egg',
      bornAt: now(),
      stageEnteredAt: now(),
      stageEnteredGame: 0,
      gameTime: 0,
      lastReal: now(),
      clockOffset: clock.getHours() * 3600 + clock.getMinutes() * 60 + clock.getSeconds(),
      speed: 1,
      speedMigrated: true,
      clockInitialized: false,
      clockSet: { on: false, h24: 0, min: 0 },
      clock24h: false,
      ageDays: 0,
      weight: egg.minWeight || 5,
      hunger: 0,
      hungerCap: egg.stomach || 4,
      strength: 0,
      strengthCap: 4,
      // DP is stored in quarter-units (1.0 DP = 4). Train 0.5 = 2, protein 0.25 = 1.
      dpQ: 0,
      dpMaxQ: 0,
      poop: 0,
      lastPoopAt: 0,
      lastHungerAt: 0,
      lights: true,
      sleeping: false,
      tired: false,
      sick: false,
      injured: false,
      sickCount: 0,
      injureCount: 0,
      sickSince: null,
      injuredSince: null,
      careMistakes: 0,
      effort: 0,
      trainSuccess: 0,
      battles: 0,
      wins: 0,
      losses: 0,
      wrFlag: false,
      eggShakes: 0,
      traitedEgg: false,
      dead: false,
      dying: false,
      dyingShakes: 0,
      dyingStartedAt: null,
      proteinPills: 0,
      sleepDistStreak: 0,
      wakeDelayHours: 0,
      evoDueAt: null,           // game-hours in this stage when the window fires
      callAt: null,
      callKind: null,
      callResolved: false,
      emptyCallSince: null,
      sleepCalledTonight: false,
      sleptSince: null,
      lastClockSec: null,
      soundMuted: false,
      windowMissed: false
    };
  }

  function migrateState(state) {
    if (!state) return defaultState('pen_1_0');
    if (state.family !== 'pendulum') return state;
    if (!state.speedMigrated) {
      if (state.speed == null || state.speed === 60) state.speed = 1;
      state.speedMigrated = true;
    }
    if (state.clockInitialized == null) state.clockInitialized = true;
    if (!state.clockSet) state.clockSet = { on: false, h24: 0, min: 0 };
    if (state.dpQ == null) state.dpQ = Math.round((state.dp || 0) * 4);
    if (state.dpMaxQ == null) {
      var m = mon(state);
      state.dpMaxQ = m ? Math.round((m.dpMax || 0) * 4) : 0;
    }
    if (!state.version || !state.deviceId) {
      var meta = verMeta(state.eggKind || 'pen_1_0');
      if (!state.version) state.version = meta.key;
      if (!state.deviceId) state.deviceId = meta.id;
    }
    return state;
  }

  function runningClockSeconds(state) {
    if (state.clockSet && state.clockSet.on) {
      return (state.clockSet.h24 * 3600 + state.clockSet.min * 60) % 86400;
    }
    return ((state.clockOffset || 0) + (state.gameTime || 0)) % 86400;
  }

  function isClockSet(state) {
    return !!(state && state.clockSet && state.clockSet.on);
  }

  function beginClockSet(state) {
    var sec = runningClockSeconds(state);
    state.clockSet = {
      on: true,
      h24: Math.floor(sec / 3600) % 24,
      min: Math.floor((sec % 3600) / 60)
    };
    return state;
  }

  function adjustClockSet(state, part, dir) {
    if (!isClockSet(state)) return state;
    dir = dir || 1;
    if (part === 'h') {
      state.clockSet.h24 = (state.clockSet.h24 + dir + 24) % 24;
    } else {
      state.clockSet.min = (state.clockSet.min + dir + 60) % 60;
    }
    return state;
  }

  function confirmClockSet(state) {
    if (!isClockSet(state)) return state;
    var want = (state.clockSet.h24 * 3600 + state.clockSet.min * 60) % 86400;
    // Align clockOffset so runningClockSeconds equals the set time, WITHOUT
    // changing gameTime (SET must not fast-forward growth).
    state.clockOffset = (want - (state.gameTime || 0) % 86400 + 86400) % 86400;
    state.clockSet.on = false;
    var first = !state.clockInitialized;
    state.clockInitialized = true;
    if (first && state.mon === 'pen_egg') {
      // Hatch is 1 minute of growth after the first SET (Bandai / Humulos).
      state.evoDueAt = rules().hatchMinutes / 60;
      state.stageEnteredGame = state.gameTime;
    }
    return state;
  }

  function dp(state) { return (state.dpQ || 0) / 4; }
  function dpMax(state) { return (state.dpMaxQ || 0) / 4; }

  function fillDp(state) {
    state.dpQ = state.dpMaxQ || 0;
  }

  function spendDp(state, amount) {
    var q = Math.round(amount * 4);
    if ((state.dpQ || 0) < q) return false;
    state.dpQ -= q;
    return true;
  }

  function addDp(state, amount) {
    var q = Math.round(amount * 4);
    state.dpQ = clamp((state.dpQ || 0) + q, 0, state.dpMaxQ || 0);
  }

  function applyWeight(state, d) {
    var m = mon(state);
    var min = (m && m.minWeight) || 5;
    state.weight = clamp((state.weight || min) + d, min, 99);
    if (state.weight >= 99) makeSick(state, 'weight');
  }

  function makeSick(state, reason) {
    if (state.dead || state.sick) return;
    state.sick = true;
    state.sickSince = state.gameTime;
    state.sickCount = (state.sickCount || 0) + 1;
    state.sickReason = reason || 'unknown';
  }

  function makeInjured(state, reason) {
    if (state.dead || state.injured) return;
    state.injured = true;
    state.injuredSince = state.gameTime;
    state.injureCount = (state.injureCount || 0) + 1;
    state.injureReason = reason || 'unknown';
  }

  function healSick(state) {
    if (!state.sick) return { ok: false };
    state.sick = false;
    state.sickSince = null;
    return { ok: true, kind: 'sick' };
  }

  function healInjury(state) {
    if (!state.injured) return { ok: false };
    state.injured = false;
    state.injuredSince = null;
    return { ok: true, kind: 'injury' };
  }

  function addCareMistake(state, reason) {
    state.careMistakes = (state.careMistakes || 0) + 1;
    state.lastCmReason = reason || 'unknown';
    checkDeath(state);
  }

  function checkDeath(state) {
    if (state.dead) return true;
    var R = rules();
    var m = mon(state);
    var inWindow = false;
    if (m && (m.stage === 'adult' || m.stage === 'perfect') && state.evoDueAt != null) {
      var hours = timeInStage(state) / 3600;
      if (hours >= (m.lifespanMin || 0)) inWindow = true;
    }
    if ((state.sickCount || 0) >= R.deathSickInForm) return die(state, 'sick-20');
    if ((state.injureCount || 0) >= R.deathInjuryInForm) return die(state, 'injury-20');
    if ((state.careMistakes || 0) >= R.deathCmInForm) return die(state, 'cm-20');
    if (inWindow && (state.careMistakes || 0) >= R.deathCmAtWindow) return die(state, 'cm-window');
    if (state.sick && state.sickSince != null && state.gameTime - state.sickSince >= R.sickDeathHours * 3600) {
      return die(state, 'sick-6h');
    }
    if (state.injured && state.injuredSince != null && state.gameTime - state.injuredSince >= R.sickDeathHours * 3600) {
      return die(state, 'injury-6h');
    }
    return false;
  }

  function die(state, reason) {
    state.dead = true;
    state.dying = false;
    state.deathReason = reason;
    state.callAt = null;
    return true;
  }

  function beginDyingSave(state) {
    // Shake ~100 times in one minute to avoid death (Humulos).
    state.dying = true;
    state.dyingShakes = 0;
    state.dyingStartedAt = state.gameTime;
    return state;
  }

  function timeInStage(state) {
    return Math.max(0, (state.gameTime || 0) - (state.stageEnteredGame || 0));
  }

  function isSleepHours(state) {
    var m = mon(state);
    if (!m || m.sleepHour == null) return false;
    var sec = runningClockSeconds(state);
    var h = Math.floor(sec / 3600);
    var wake = (rules().wakeHour + (state.wakeDelayHours || 0));
    if (wake > rules().wakeDelayCapHour) wake = rules().wakeDelayCapHour;
    var bed = m.sleepHour;
    // Sleep from bedtime through midnight to wake.
    if (bed > wake) return h >= bed || h < wake;
    return h >= bed && h < wake;
  }

  function isCallLit(state) {
    return !!(state && state.callAt != null && !state.callResolved && !state.dead);
  }

  function startCall(state, kind) {
    if (state.callAt != null && !state.callResolved) return;
    state.callAt = state.gameTime;
    state.callKind = kind;
    state.callResolved = false;
  }

  function resolveCall(state, asMistake) {
    if (state.callAt == null || state.callResolved) return;
    state.callResolved = true;
    if (asMistake) addCareMistake(state, 'call-' + (state.callKind || 'unknown'));
  }

  function callTimeoutSec(kind) {
    var R = rules();
    if (kind === 'bedtime') return R.callBedtimeMin * 60;
    return R.callHungerMin * 60;
  }

  function feedMeat(state) {
    if (state.dead || state.mon === 'pen_egg') return { ok: false, refused: true };
    var m = mon(state);
    var cap = (m && m.stomach) || 4;
    if ((state.hunger || 0) >= cap) return { ok: true, refused: true, full: true };
    state.hunger = (state.hunger || 0) + rules().meatHunger;
    if (state.hunger > cap) state.hunger = cap;
    applyWeight(state, rules().meatWeight);
    disturbSleep(state, 'food');
    clearHungerCall(state);
    return { ok: true, refused: false };
  }

  function feedProtein(state) {
    if (state.dead || state.mon === 'pen_egg') return { ok: false, refused: true };
    // Protein is unlimited (NHOKO) but 99 g makes them sick.
    state.strength = clamp((state.strength || 0) + rules().proteinStrength, 0, 4);
    applyWeight(state, rules().proteinWeight);
    addDp(state, rules().proteinDp);
    state.proteinPills = (state.proteinPills || 0) + 1;
    disturbSleep(state, 'food');
    clearStrengthCall(state);
    return { ok: true, refused: false };
  }

  function clearHungerCall(state) {
    if (state.callKind === 'hunger' || (state.hunger > 0 && state.strength > 0 && state.callKind !== 'bedtime')) {
      if (state.callKind === 'hunger' || state.callKind === 'hunger-strength') {
        resolveCall(state, false);
        state.callAt = null;
        state.callResolved = false;
        state.callKind = null;
      }
    }
  }
  function clearStrengthCall(state) {
    if (state.callKind === 'strength' || state.callKind === 'hunger-strength') {
      resolveCall(state, false);
      state.callAt = null;
      state.callResolved = false;
      state.callKind = null;
    }
  }

  function canTrain(state) {
    var m = mon(state);
    if (!state || state.dead || !m || m.stage === 'egg') return false;
    if (state.sick || state.injured) return false;
    return (state.dpQ || 0) >= Math.round(rules().trainDp * 4);
  }

  function canBattle(state) {
    var m = mon(state);
    if (!state || state.dead || !m || !m.canBattle) return false;
    if (state.sick || state.injured) return false;
    return (state.dpQ || 0) >= Math.round(rules().battleDp * 4);
  }

  function canJogress(state) {
    var m = mon(state);
    if (!state || state.dead || !m || !m.canJogress) return false;
    if (state.sick || state.injured) return false;
    return (state.dpQ || 0) >= (state.dpMaxQ || 0) && state.dpMaxQ > 0;
  }

  // Training: 0 Super = fail, still −1 g; ≥1 Super = success +1 Strength,
  // Effort +1, −1 g; 5/5 Megahit = Strength fills, −8 g. Costs 0.5 DP.
  // 1.0 has no MEGAHIT result screen (caller hides it). Cancel before COUNT
  // ends spends no DP (NHOKO).
  function finishTraining(state, supers) {
    if (!canTrain(state)) return { ok: false };
    spendDp(state, rules().trainDp);
    supers = supers || 0;
    var megahit = supers >= 5;
    var success = supers >= 1;
    if (megahit) {
      state.strength = 4;
      applyWeight(state, rules().megahitWeight);
    } else {
      applyWeight(state, rules().trainWeight);
      if (success) state.strength = clamp((state.strength || 0) + 1, 0, 4);
    }
    if (success) {
      state.effort = clamp((state.effort || 0) + 1, 0, rules().effortMax);
      state.trainSuccess = (state.trainSuccess || 0) + 1;
    } else if (rules().trainCountsOnFail) {
      state.trainSuccess = (state.trainSuccess || 0) + 1;
    }
    disturbSleep(state, 'train');
    return { ok: true, success: success, megahit: megahit, supers: supers };
  }

  function supersFromShakes(shakes, target) {
    target = target || rules().megahitDefault;
    shakes = shakes || 0;
    if (shakes <= 0) return 0;
    if (shakes >= target) return 5;
    // Unpublished official mapping — linear interpolation, labelled.
    return Math.max(1, Math.floor(shakes / target * 5));
  }

  function recordBattle(state, result, opts) {
    opts = opts || {};
    if (!canBattle(state) && !opts.free) return { ok: false };
    if (!opts.free) spendDp(state, rules().battleDp);
    applyWeight(state, rules().battleWeight);
    state.battles = (state.battles || 0) + 1;
    if (result === 'win') state.wins = (state.wins || 0) + 1;
    else state.losses = (state.losses || 0) + 1;
    // wrFlag: 30 battles BEFORE the Perfect window. Once set, it stays
    // through Ultimate (Humulos / plan).
    maybeSetWrFlag(state);
    disturbSleep(state, 'battle');
    return { ok: true, result: result, battles: state.battles, wr: data().winRate(state) };
  }

  function maybeSetWrFlag(state) {
    if (state.wrFlag) return;
    var m = mon(state);
    if (!m) return;
    // "Before the window" — only Adult (the stage that waits for Perfect).
    if (m.stage !== 'adult') return;
    var hours = timeInStage(state) / 3600;
    if (m.lifespanMin != null && hours >= m.lifespanMin) return;
    if ((state.battles || 0) >= rules().perfectBattlesRequired) state.wrFlag = true;
  }

  /**
   * Best-of / 3-HP battle (NHOKO): single hit = 1, super = 2, dodge possible.
   * Strength comes from stage, Effort (0–40), and attribute — not hunger
   * or weight. Exact dodge / hit tables were not published; the rates
   * below are labelled placeholders so the 3-HP system is testable.
   * Source: 'placeholder-unverified-hit-table'.
   */
  function battlePower(state) {
    var m = mon(state);
    var stagePts = { child: 0, adult: 2, perfect: 4, ultimate: 6 };
    var s = (m && stagePts[m.stage]) || 0;
    var e = Math.floor((state.effort || 0) / 10); // 0–4
    return s + e;
  }

  function resolveShot(atkState, defState, superHit, rng) {
    rng = rng || Math.random;
    var atk = battlePower(atkState);
    var def = battlePower(defState);
    var attr = data().attrAdvantage(
      (mon(atkState) && mon(atkState).attribute) || 'free',
      (mon(defState) && mon(defState).attribute) || 'free'
    );
    // Base 12/16 hit, ± power/attr. PLACEHOLDER rates.
    var hit = 12 + (atk - def) + (attr * 2);
    if (hit < 4) hit = 4;
    if (hit > 15) hit = 15;
    var roll = Math.floor(rng() * 16);
    if (roll >= hit) return { hit: false, dmg: 0, source: 'placeholder-unverified-hit-table' };
    return { hit: true, dmg: superHit ? 2 : 1, source: 'placeholder-unverified-hit-table' };
  }

  function resolvePracticeBattle(state, foe, shotsSelf, shotsFoe, rng) {
    // shots: array of { super: bool } length 3–many until one HP is 0.
    var hpS = rules().battleHp, hpF = rules().battleHp;
    var i;
    var log = [];
    shotsSelf = shotsSelf || [];
    shotsFoe = shotsFoe || [];
    for (i = 0; i < Math.max(shotsSelf.length, shotsFoe.length, 8); i++) {
      var a = shotsSelf[i] || { super: false };
      var b = shotsFoe[i] || { super: false };
      var rA = resolveShot(state, foe, !!a.super, rng);
      var rB = resolveShot(foe, state, !!b.super, rng);
      if (rA.hit) hpF -= rA.dmg;
      if (rB.hit) hpS -= rB.dmg;
      log.push({ a: rA, b: rB, hpS: hpS, hpF: hpF });
      if (hpS <= 0 || hpF <= 0) break;
    }
    var result = hpF <= 0 && hpS > 0 ? 'win' : (hpS <= 0 && hpF > 0 ? 'lose' : (hpF <= 0 && hpS <= 0 ? 'lose' : 'lose'));
    // simultaneous 0 = lose for the player (unverified; conservative).
    recordBattle(state, result);
    return { result: result, hpS: Math.max(0, hpS), hpF: Math.max(0, hpF), log: log, appOnly: true };
  }

  function doJogress(state, otherMonId) {
    if (!canJogress(state)) return { ok: false, error: 'dp-or-stage' };
    var otherVer = (typeof arguments[2] === 'string' ? arguments[2] : (arguments[2] && arguments[2].otherVersion)) || state.version;
    var r = data().jogressResult(state.mon, otherMonId, state.version, otherVer);
    if (!r.ok) return r;
    spendDp(state, dp(state)); // consume all
    evolveTo(state, r.to, { jogress: true });
    return { ok: true, to: r.to, kind: r.kind };
  }

  function flush(state) {
    var n = state.poop || 0;
    state.poop = 0;
    disturbSleep(state, 'flush');
    return { ok: true, flushed: n };
  }

  function setLights(state, on) {
    state.lights = !!on;
    if (on) {
      // Pendulum: lights ON does NOT force a wake (plan: do not copy DM20).
    } else if (state.tired || isSleepHours(state)) {
      state.sleeping = true;
      state.tired = true;
      if (!state.sleptSince) state.sleptSince = state.gameTime;
      // Turning off at bedtime cancels the bedtime call (NHOKO).
      if (state.callKind === 'bedtime') {
        resolveCall(state, false);
        state.callAt = null;
        state.callResolved = false;
        state.callKind = null;
        state.sleepCalledTonight = true;
      }
    }
    return { ok: true, lights: state.lights };
  }

  function disturbSleep(state, reason) {
    if (!state.sleeping && !state.tired) return;
    if (!state.sleeping) return;
    // Care mistake, +1 h wake, cap 14:00, 10 in a row → sick (plan / Humulos).
    addCareMistake(state, 'sleep-disturb-' + (reason || ''));
    state.wakeDelayHours = clamp((state.wakeDelayHours || 0) + 1, 0, 6);
    state.sleepDistStreak = (state.sleepDistStreak || 0) + 1;
    if (state.sleepDistStreak >= rules().disturbSickStreak) makeSick(state, 'disturb-10');
    state.sleeping = false;
    state.sleptSince = null;
    state.tired = false;
  }

  function addShake(state, n) {
    n = n == null ? 1 : n;
    if (state.dying) {
      state.dyingShakes = (state.dyingShakes || 0) + n;
      if (state.dyingShakes >= rules().dyingSaveShakes) {
        state.dying = false;
        state.dyingShakes = 0;
        return { saved: true };
      }
      return { saved: false, shakes: state.dyingShakes };
    }
    if (state.mon === 'pen_egg' && !state.dead) {
      state.eggShakes = (state.eggShakes || 0) + n;
      if (state.eggShakes >= rules().eggShakeBonusAt) state.traitedEgg = true;
      return { egg: true, shakes: state.eggShakes, traited: state.traitedEgg };
    }
    return { shakes: n };
  }

  function evolveTo(state, toId, opts) {
    opts = opts || {};
    var next = data().monster(toId, state.version);
    if (!next) return false;
    state.mon = toId;
    state.stageEnteredAt = now();
    state.stageEnteredGame = state.gameTime;
    // Care mistakes and Effort reset on evo (Humulos). wrFlag and battles stay.
    state.careMistakes = 0;
    state.effort = 0;
    state.trainSuccess = 0;
    state.sickCount = 0;
    state.injureCount = 0;
    state.proteinPills = 0;
    state.windowMissed = false;
    state.weight = next.minWeight;
    state.hungerCap = next.stomach;
    state.hunger = Math.min(state.hunger || 0, next.stomach || 4);
    state.dpMaxQ = Math.round((next.dpMax || 0) * 4);
    if (state.dpQ > state.dpMaxQ) state.dpQ = state.dpMaxQ;
    // Roll the next window.
    rollEvoDue(state);
    return true;
  }

  function rollEvoDue(state) {
    var m = mon(state);
    if (!m) { state.evoDueAt = null; return; }
    if (m.stage === 'egg') {
      state.evoDueAt = rules().hatchMinutes / 60;
      return;
    }
    if (m.stage === 'baby1') {
      state.evoDueAt = rules().babyIHours;
      return;
    }
    var lo = m.lifespanMin != null ? m.lifespanMin : m.lifespanHours;
    var hi = m.lifespanMax != null ? m.lifespanMax : m.lifespanHours;
    if (lo == null && hi == null) { state.evoDueAt = null; return; }
    if (lo == null) lo = hi;
    if (hi == null) hi = lo;
    // Deterministic midpoint when no rng is supplied; tests may set evoDueAt.
    state.evoDueAt = (lo + hi) / 2;
    if (lo === hi) state.evoDueAt = lo;
  }

  function tryEvolve(state, rng) {
    rng = rng || Math.random;
    var m = mon(state);
    if (!m || state.dead || isClockSet(state)) return null;
    if (!state.clockInitialized && m.stage === 'egg') return null;
    var hours = timeInStage(state) / 3600;
    if (m.stage === 'egg') {
      if (hours >= rules().hatchMinutes / 60 && state.clockInitialized) {
        var baby1 = (data().verData(state.version) || {}).baby1 || 'babumon';
        evolveTo(state, baby1);
        return { from: 'pen_egg', to: baby1 };
      }
      return null;
    }
    if (state.evoDueAt == null) rollEvoDue(state);
    if (state.evoDueAt == null) return null;
    if (hours < state.evoDueAt) return null;
    if (state.windowMissed) return null;

    var cm = state.careMistakes || 0;
    var tr = state.trainSuccess || 0;
    var wr = data().winRate(state);
    var to = null, info = null;

    if (m.stage === 'baby1') {
      to = (data().verData(state.version) || {}).baby2 || 'motimon';
    } else if (m.stage === 'baby2') {
      to = data().naturalChild(cm, state.version);
    } else if (m.stage === 'child') {
      to = data().naturalAdult(state.mon, cm, tr, state.version);
    } else if (m.stage === 'adult') {
      info = data().naturalPerfect(state.mon, cm, tr, state.battles || 0, wr, state.wrFlag, state.version);
      if (info && info.to) {
        var bonus = state.traitedEgg ? rules().eggShakeBonus : 0;
        var odds = (info.odds || 0) + bonus;
        if (odds > 0.70) odds = 0.70; // Humulos: bonuses do not stack past 70 %
        if (rng() < odds) to = info.to;
        else state.windowMissed = true; // missed — never returns
      } else {
        state.windowMissed = true;
      }
    } else if (m.stage === 'perfect') {
      info = data().naturalUltimate(state.mon, cm, wr, state.version);
      if (info && info.to) to = info.to;
      else state.windowMissed = true;
    }

    if (to) {
      var from = state.mon;
      evolveTo(state, to);
      return { from: from, to: to };
    }
    return null;
  }

  function tickHungerPoop(state, dt) {
    var m = mon(state);
    if (!m || m.stage === 'egg' || state.dead) return;
    var R = rules();
    // Hunger cycle — PLACEHOLDER minutes.
    state.lastHungerAt = (state.lastHungerAt || 0) + dt;
    var cycle = (R.hungerCycleMin || 60) * 60;
    // NHOKO: stuffing slows hunger drain. Simple: cycle * (1 + extra/stomach).
    var extra = Math.max(0, (state.hunger || 0) - 4);
    var stomach = m.stomach || 4;
    var adj = cycle * (1 + extra / Math.max(1, stomach));
    while (state.lastHungerAt >= adj && adj > 0) {
      state.lastHungerAt -= adj;
      if ((state.hunger || 0) > 0) state.hunger -= 1;
    }
    // Poop every 3 h, −1 g, 8 → sick (NHOKO).
    state.lastPoopAt = (state.lastPoopAt || 0) + dt;
    while (state.lastPoopAt >= R.poopHours * 3600) {
      state.lastPoopAt -= R.poopHours * 3600;
      if ((state.poop || 0) < R.poopCap) {
        state.poop = (state.poop || 0) + 1;
        applyWeight(state, R.poopWeight);
      }
      if (state.poop >= R.poopCap) makeSick(state, 'poop-8');
    }
  }

  function tickCalls(state) {
    var m = mon(state);
    if (!m || m.stage === 'egg' || state.dead) return;
    // Hunger / strength call (Humulos 10 min). One call if either is empty.
    var empty = (state.hunger || 0) <= 0 || (state.strength || 0) <= 0;
    if (empty && !state.sleeping) {
      if (state.emptyCallSince == null) state.emptyCallSince = state.gameTime;
      var kind = (state.hunger || 0) <= 0 && (state.strength || 0) <= 0 ? 'hunger-strength'
        : (state.hunger || 0) <= 0 ? 'hunger' : 'strength';
      if (state.callAt == null) startCall(state, kind);
    } else {
      state.emptyCallSince = null;
      if (state.callKind === 'hunger' || state.callKind === 'strength' || state.callKind === 'hunger-strength') {
        if ((state.hunger || 0) > 0 && (state.strength || 0) > 0) {
          resolveCall(state, false);
          state.callAt = null;
          state.callResolved = false;
          state.callKind = null;
        }
      }
    }
    // Bedtime call: 30 min (Humulos). Skipped if lights already off (NHOKO).
    if (isSleepHours(state) && !state.sleeping) {
      state.tired = true;
      if (state.lights && !state.sleepCalledTonight) {
        if (state.callKind !== 'bedtime') startCall(state, 'bedtime');
      } else if (!state.lights) {
        state.sleeping = true;
        if (!state.sleptSince) state.sleptSince = state.gameTime;
        state.sleepCalledTonight = true;
      }
    }
    if (state.callAt != null && !state.callResolved) {
      var limit = callTimeoutSec(state.callKind);
      if (state.gameTime - state.callAt >= limit) {
        resolveCall(state, true);
        if (state.callKind === 'bedtime') {
          state.sleepCalledTonight = true;
          state.tired = true;
        }
      }
    }
  }

  function tickSleep(state, dt) {
    var R = rules();
    var sec = runningClockSeconds(state);
    var h = Math.floor(sec / 3600);
    var wake = R.wakeHour + (state.wakeDelayHours || 0);
    if (wake > R.wakeDelayCapHour) wake = R.wakeDelayCapHour;
    if (state.sleeping) {
      if (!state.sleptSince) state.sleptSince = state.gameTime - dt;
      if (state.gameTime - state.sleptSince >= R.dpSleepHours * 3600) fillDp(state);
      // Wake at 08:00 (+ delay).
      if (!isSleepHours(state) && h >= wake && h < 12) {
        state.sleeping = false;
        state.tired = false;
        state.sleptSince = null;
        state.wakeDelayHours = 0;
        state.sleepDistStreak = 0;
        state.sleepCalledTonight = false;
      }
    } else if (!isSleepHours(state)) {
      state.tired = false;
      if (h >= wake && h < (wake + 1)) {
        state.sleepCalledTonight = false;
      }
    }
  }

  function tickAge(state, prevClock, nextClock, dt) {
    // NHOKO: age increments when the device clock hits AM 12:00 (midnight).
    if (prevClock == null) return;
    var crossed = 0;
    if (dt >= 86400) crossed += Math.floor(dt / 86400);
    if (nextClock < prevClock) crossed += 1; // wrapped past 00:00
    if (crossed > 0) state.ageDays = (state.ageDays || 0) + crossed;
  }

  function tick(state, realNow) {
    state = migrateState(state);
    var result = { ok: true, evolved: false, died: false, paused: false };
    if (!state || state.dead) return result;
    realNow = realNow || now();
    var speed = state.speed || 1;
    var elapsed = (realNow - (state.lastReal || realNow)) / 1000;
    if (elapsed < 0) elapsed = 0;
    if (elapsed > MAX_CATCHUP) elapsed = MAX_CATCHUP;
    var dt = elapsed * speed;
    state.lastReal = realNow;

    // SET pauses the growth timer (Humulos) and freezes the running clock.
    if (isClockSet(state)) {
      result.paused = true;
      return result;
    }
    if (!state.clockInitialized && state.mon === 'pen_egg') {
      // Waiting for first SET — no hatch, no growth.
      return result;
    }

    var prevClock = runningClockSeconds(state);
    state.gameTime = (state.gameTime || 0) + dt;
    var nextClock = runningClockSeconds(state);
    tickAge(state, prevClock, nextClock, dt);

    // Capture wrFlag before the Perfect window opens.
    maybeSetWrFlag(state);

    tickHungerPoop(state, dt);
    tickSleep(state, dt);
    tickCalls(state);

    if (state.dying && state.dyingStartedAt != null &&
        state.gameTime - state.dyingStartedAt >= rules().dyingSaveSec) {
      if ((state.dyingShakes || 0) < rules().dyingSaveShakes) die(state, 'dying-fail');
      else { state.dying = false; }
    }

    if (checkDeath(state)) {
      result.died = true;
      return result;
    }

    var ev = tryEvolve(state);
    if (ev) {
      result.evolved = true;
      result.from = ev.from;
      result.to = ev.to;
    }
    return result;
  }

  function toggleClock12_24(state) {
    state.clock24h = !state.clock24h;
    return state.clock24h;
  }

  function lightsOffScreen(state) {
    // 'black-z' if sleeping/tired and lights off; 'black' if awake and off.
    if (!state || state.lights) return 'paper';
    if (state.sleeping || state.tired) return 'black-z';
    return 'black';
  }

  var api = {
    defaultState: defaultState,
    migrateState: migrateState,
    tick: tick,
    mon: mon,
    rules: rules,
    runningClockSeconds: runningClockSeconds,
    isClockSet: isClockSet,
    beginClockSet: beginClockSet,
    adjustClockSet: adjustClockSet,
    confirmClockSet: confirmClockSet,
    toggleClock12_24: toggleClock12_24,
    feedMeat: feedMeat,
    feedProtein: feedProtein,
    finishTraining: finishTraining,
    supersFromShakes: supersFromShakes,
    canTrain: canTrain,
    canBattle: canBattle,
    canJogress: canJogress,
    recordBattle: recordBattle,
    resolveShot: resolveShot,
    resolvePracticeBattle: resolvePracticeBattle,
    battlePower: battlePower,
    doJogress: doJogress,
    flush: flush,
    setLights: setLights,
    healSick: healSick,
    healInjury: healInjury,
    disturbSleep: disturbSleep,
    addShake: addShake,
    evolveTo: evolveTo,
    tryEvolve: tryEvolve,
    rollEvoDue: rollEvoDue,
    timeInStage: timeInStage,
    isSleepHours: isSleepHours,
    isCallLit: isCallLit,
    dp: dp,
    dpMax: dpMax,
    fillDp: fillDp,
    spendDp: spendDp,
    addDp: addDp,
    applyWeight: applyWeight,
    makeSick: makeSick,
    makeInjured: makeInjured,
    checkDeath: checkDeath,
    die: die,
    beginDyingSave: beginDyingSave,
    lightsOffScreen: lightsOffScreen,
    addCareMistake: addCareMistake
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PendulumEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
