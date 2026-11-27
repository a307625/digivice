/**
 * Digital Monster care / time / evolution engine.
 * 1997 Ver.1–5 firmware for care, timers, battles, and Perfect.
 * DM20 rules only for Mega, Jogress, and 20th-exclusive eggs.
 *
 * Battles, wins, losses, win score and the Perfect-qualified bit CARRY
 * from Child→Adult. Other stage counters reset on evolution.
 *
 * Sleep wake (UI worker): disturbSleep / awakeUntil / DISTURB_AWAKE_SEC
 * and sleepCalledTonight / toggleLights behaviour are kept. The 10-minute
 * DISTURB_AWAKE_SEC is Eric's rule (2026-11-28): woken, stay awake 10 min,
 * then sleep again.
 */
(function (root) {
  'use strict';
  var data = root.EvolutionData;
  var evo = root.Evolution;

  var CALL_TIMEOUT = 20 * 60;      // hunger / strength call, 20 min (1997 firmware, 0x08C3)
  // NHOKO: leaving the lamp on for 60 min after sleep starts is the lights
  // care mistake. The call icon also stays up for those 60 min. This is not
  // the 20 min hunger call.
  var LIGHTS_CALL_TIMEOUT = 60 * 60;
  // v36, Eric's decision (2026-11-28): on 1997 Ver.1 the lights call is a
  // care mistake after 20 minutes, the same ROM timer as the hunger call
  // (BladeSabre real-device test, 1997 ROM 20-min call timer). v100: Ver.2-5
  // use it too (below).
  var VER1_LIGHTS_CALL_TIMEOUT = 20 * 60;
  // v100 (Eric 「改 Ver.2 到 Ver.5」): Ver.2 runs the same program as Ver.1 with
  // another monster set (disassembly: bank0 82% shared, same routine
  // addresses), and Wikimon's Ver.2-5 pages all give 20 min for the lights
  // care mistake. So the whole 1997 Ver.1-5 line uses the 20-min ROM timer.
  // NHOKO's 60 min is kept only for lines that are not 1997 bricks.
  var BRICK97_LIGHTS_CALL_TIMEOUT = VER1_LIGHTS_CALL_TIMEOUT;
  // NHOKO: once a meal is refused (満腹), hunger hearts do not drop for about 1 h.
  var HUNGER_FREEZE_SEC = 60 * 60;
  // Awake window after a sleep disturbance. Eric's decision (2026-11-28):
  // a Digimon woken during sleep stays awake 10 minutes, then sleeps again.
  // (The exact ROM duration is not published; this is the owner's rule.)
  var DISTURB_AWAKE_SEC = 10 * 60;
  var POOP_INTERVAL = 3 * 3600;    // NHOKO ~3 h; Wikimon ~2 h — unverified vs ROM, keep current
  var INJURY_DEATH = 6 * 3600;
  var STARVE_DEATH = 12 * 3600;
  var MAX_INJURIES = 20;
  var OVERFEED_LOCK = 3600;
  // v32: no catch-up cap. The whole closed period is simulated on a fixed
  // 60-second game-time grid (SIM_GRID), so a long close gives exactly the
  // same result as leaving the app open (same calls, mistakes, poop, sleep,
  // evolution and death times). 3 days = 4320 cheap steps.
  var SIM_GRID = 60;
  // DM20 (Ver.20th) rules for the 20th-exclusive eggs (Dracomon, Huckmon, ...):
  // Humulos DM20 manual / NHOKO Ver.20th / Bandai English manual.
  var DM20_CALL_TIMEOUT = 10 * 60;   // call light goes out after 10 min → 1 mistake (Humulos, NHOKO, Wikimon)
  var DM20_WAKE_SEC = 15 * 60;       // Bandai manual: LIGHTS wake = stay up an extra 15 minutes
  var DM20_WAKE_HOUR = 7;            // Humulos: "All Digimon will wake up at 7:00 AM"
  var DM20_DEATH_CM_FORM = 20;       // Humulos: 20 care mistakes in one form
  var DM20_OLD_AGE_AWAKE = 48 * 3600;// Humulos: 5 mistakes upon/after 48 h awake in the current stage
  var DM20_OLD_AGE_CM = 5;
  // Humulos DM20 "Evolution" table, minutes, counted only while awake.
  var DM20_STAGE_MIN = { baby1: 10, baby2: 6 * 60, rookie: 24 * 60, champion: 36 * 60, ultimate: 48 * 60 };
  // Humulos DM20 evolution guide sleep times (Dracomon line). Others keep species data.
  var DM20_SLEEP_START = {
    dracomon: 21, coredramon_blue: 23, coredramon_green: 23,
    wingdramon: 23, groundramon: 23, slayerdramon: 23, breakdramon: 0
  };
  var DP_REFILL_SEC = 8 * 3600;     // 1997: 8 h continuous sleep (NHOKO / Wikimon / DMComm)
  var DM20_DP_REFILL_SEC = 3 * 3600; // DM20: 3 h sleep / nap recovers stamina (Humulos, Wikimon)
  // Humulos + namu: one cap per stage, not the 1997 per-species table.
  // Child 14, then +14 each evolution, 70 at Super Ultimate.
  var DM20_DP_BY_STAGE = {
    egg: 0, baby1: 0, baby2: 0,
    rookie: 14, champion: 28, ultimate: 42, mega: 56, super: 70
  };
  var DM20_NAP_SEC = 3 * 3600;       // Humulos DM20: nap lasts 3 hours
  var DM20_POOP_CAP = 4;             // DM20: injury at 4 piles, then no more poop (Humulos / community)
  var POOP_CAP = 8;                  // 1997 firmware: 8th pile injures (measured)
  var CALLS_CAP = 15;
  var WIN_SCORE_MAX = 15;

  function now() { return Date.now(); }

  var SPECIAL_EGG_IDS = {
    zuba: "egg_zuba", hack: "egg_hack",
    dra_blue: "egg_dra_blue", dra_green: "egg_dra_green",
    doru: "egg_doru",
    anime_agumon: "egg_anime_agumon", anime_gabumon: "egg_anime_gabumon",
    corona: "egg_corona", luna: "egg_luna", meicoo: "egg_meicoo"
  };

  function defaultState(eggVersion, specialEgg) {
    var eggId, monId, eggKind, version;
    if (specialEgg) {
      eggId = SPECIAL_EGG_IDS[specialEgg] || ("egg_" + specialEgg);
      monId = eggId;
      eggKind = specialEgg;
      version = specialEgg;
    } else {
      eggId = "egg_v" + (eggVersion || 1);
      monId = eggId;
      eggKind = "ver" + (eggVersion || 1);
      version = eggVersion || 1;
    }
    var state = {
      mon: monId,
      version: version,
      eggKind: eggKind,
      bornAt: now(),
      stageEnteredAt: now(),
      stageEnteredGame: 0,
      gameTime: 0,
      lastReal: now(),
      tagWins: 0,
      // Device reset default AM 12:00 (not the phone's clock); the player
      // sets the time with SET and it then runs at real speed.
      clockOffset: 0,
      speed: 1,
      speedMigrated: true,
      clockInitialized: false,
      clockSet: { on: false, h24: 0, min: 0 },
      hunger: 4,
      hungerCap: 4,
      strength: 4,
      dp: 0,
      dpMax: 0,
      weight: (data.MONSTERS[monId] && data.MONSTERS[monId].weight) || 5,
      calls: 0,
      train: 0,
      overfeed: 0,
      sleepDist: 0,
      injuries: 0,
      battles: 0,
      wins: 0,
      losses: 0,
      lifeBattles: 0,
      lifeWins: 0,
      lifeLosses: 0,
      poop: 0,
      stageResults: [],
      lights: true,
      sleeping: false,
      injured: false,
      dead: false,
      callHungerAt: null,
      callStrengthAt: null,
      callLightsAt: null,
      injuredAt: null,
      emptySince: null,
      lastPoopAt: 0,
      lastHungerTick: 0,
      lastStrTick: 0,
      overfeedLockUntil: 0,
      hungerFreezeUntil: 0,
      dm20TagRound: 0,
      album: monId ? [monId] : [],
      events: [],
      sleepStart: 21,
      sleepEnd: 8,
      awakeUntil: 0,
      sleepCalledTonight: false,
      // New official-rule fields
      winScore: 0,
      perfectQualified: false,
      perfectRolledThisStage: false,
      megaChecked: false,
      overdose: 0,
      proteinRemainder: 0,
      proteinPowerUp: 0,
      boostCareDown: 0,
      satietyFilled: 4,
      sleptContinuously: 0,
      lifespanElapsed: false,
      oldAgeMistakes: 0,
      evoDueAt: null,
      callAt: null,
      callResolved: false,
      lightsCallResolved: false,
      healProgress: 0,
      emptyCallSince: null,
      awakeInStage: 0,
      cpuPlayerInitiates: true,
      steps: (root.Steps && root.Steps.empty) ? root.Steps.empty() : {
        days: {}, lastHealthSyncAt: 0, lastHealthSyncDate: '', lastHealthSyncTotal: 0,
        lifetime: 0, dayEffectsDate: '', dayEffort: 0, dayStrength: 0, dayWeightLoss: 0
      }
    };
    applySpeciesCare(state, { setWeight: true });
    rollEvoDueAt(state);
    return state;
  }

  function mon(state) { return data.MONSTERS[state.mon]; }

  function runningClockSeconds(state) {
    return ((state.clockOffset + state.gameTime) % 86400 + 86400) % 86400;
  }
  function isClockSet(state) {
    return !!(state && state.clockSet && state.clockSet.on);
  }
  // While SET is open, time of day is frozen at the edited hour:minute
  // (FileIsland / Wikimon Pause). Age and evolution keep using gameTime.
  function clockSeconds(state) {
    if (isClockSet(state)) {
      var h = state.clockSet.h24 || 0;
      var min = state.clockSet.min || 0;
      return ((h * 3600 + min * 60) % 86400 + 86400) % 86400;
    }
    return runningClockSeconds(state);
  }
  function clockHour(state) {
    return Math.floor(clockSeconds(state) / 3600);
  }
  function isSleepHoursAt(state, sec) {
    var start = state.sleepStart != null ? state.sleepStart : 21;
    var end = state.sleepEnd != null ? state.sleepEnd : 8;
    var h = Math.floor((((sec % 86400) + 86400) % 86400) / 3600);
    if (start > end) return h >= start || h < end;
    return h >= start && h < end;
  }
  function isSleepHours(state) {
    return isSleepHoursAt(state, clockSeconds(state));
  }
  function clockStageMaySleep(state) {
    var m = mon(state);
    return !!(m && m.stage !== 'baby1' && m.stage !== 'egg' && !state.dead);
  }
  // The egg hatches 1 minute after the clock is first set. It does not
  // hatch at all before that SET. The old 10 was egg lifespanMin, a CARE
  // placeholder, and it left the egg sitting after a full minute.
  // v36, Eric's decision (2026-11-28): the 1997 Ver.1 egg hatches 5 minutes
  // after the clock SET, as the Bandai manual says (「約5分後」, p.1 and p.6).
  // DM20 and the special lines keep the 1-minute hatch (v100: Ver.2-5 now 5).
  var VER1_HATCH_MIN = 5;
  function isVer1Brick(state) {
    if (!state || isDm20(state)) return false;
    var m = data.MONSTERS[state.mon];
    var v = m && m.version != null ? m.version : state.version;
    return Number(v) === 1;
  }
  // v100: the 1997 一般版 Ver.1-Ver.5 (not DM20 or the special lines).
  function is1997Brick(state) {
    if (!state || isDm20(state)) return false;
    var m = data.MONSTERS[state.mon];
    var v = Number(m && m.version != null ? m.version : NaN);
    if (!(v >= 1 && v <= 5)) v = Number(state.version);
    return v >= 1 && v <= 5;
  }
  // v100: Ver.2-5 hatch 5 minutes after the clock SET too. Ver.2 Bandai
  // manual (「約5分後」, three places) + shared Ver.1/Ver.2 program; Ver.5
  // real-device video (clock set 5:05:00, hatch 5:10:00). Ver.3/4 follow the
  // same rule (no source says otherwise except NHOKO's lone 10 min).
  var BRICK97_HATCH_MIN = VER1_HATCH_MIN;
  function eggHatchMinutes(state) {
    return is1997Brick(state) ? BRICK97_HATCH_MIN : 1;
  }
  function beginClockSet(state) {
    if (!state) return { ok: false };
    var sec = runningClockSeconds(state);
    state.clockSet = {
      on: true,
      h24: Math.floor(sec / 3600),
      min: Math.floor((sec % 3600) / 60)
    };
    return { ok: true, h24: state.clockSet.h24, min: state.clockSet.min };
  }
  function adjustClockSet(state, part, dir) {
    if (!isClockSet(state)) return { ok: false };
    dir = dir == null ? 1 : dir;
    if (part === 'h' || part === 'hour') {
      state.clockSet.h24 = (state.clockSet.h24 + dir + 24) % 24;
    } else {
      state.clockSet.min = (state.clockSet.min + dir + 60) % 60;
    }
    var h24 = state.clockSet.h24;
    return { ok: true, h24: h24, min: state.clockSet.min, isAM: h24 < 12 };
  }
  // Jump to daytime: same effect as turning the lights on — wakes, no
  // sleep disturbance (Wikimon Ver.1). Jump into night / set-and-restore:
  // puts a woken pet back to sleep (NHOKO). Does not fake DP, hunger,
  // poop, evolution, or age (those are gameTime).
  function applyClockJump(state, oldSec, newSec) {
    var result = { woke: false, slept: false, sleepDist: state.sleepDist || 0 };
    if (!clockStageMaySleep(state)) return result;
    var nowNight = isSleepHoursAt(state, newSec);
    if (nowNight && !state.sleeping) {
      state.sleeping = true;
      state.awakeUntil = 0;
      state.napUntil = 0;
      result.slept = true;
      if (state.lights && !state.sleepCalledTonight) {
        state.lightsCallResolved = false;
        markCall(state, 'lights');
      }
      state.sleepCalledTonight = true;
    }
    if (!nowNight && state.sleeping) {
      state.sleeping = false;
      state.napUntil = 0;
      state.callLightsAt = null;
      state.lightsCallResolved = false;
      state.sleepCalledTonight = false;
      // "Same effects as turning the lights on" (Wikimon). No sleepDist.
      // Do not refill DP: sleptContinuously is accumulated in gameTime.
      setLights(state, true);
      result.woke = true;
    }
    result.sleepDist = state.sleepDist || 0;
    return result;
  }
  function confirmClockSet(state) {
    if (!isClockSet(state)) return { ok: false };
    var oldSec = runningClockSeconds(state);
    var newSec = ((state.clockSet.h24 * 3600 + state.clockSet.min * 60) % 86400 + 86400) % 86400;
    var first = !state.clockInitialized;
    state.clockOffset = ((newSec - state.gameTime) % 86400 + 86400) % 86400;
    state.clockSet = { on: false, h24: 0, min: 0 };
    state.clockInitialized = true;
    var hatchStarted = false;
    if (first) {
      var egg = mon(state);
      if (egg && egg.stage === 'egg') {
        state.stageEnteredGame = state.gameTime;
        state.evoDueAt = eggHatchMinutes(state);
        hatchStarted = true;
      }
    }
    var jump = applyClockJump(state, oldSec, newSec);
    return {
      ok: true,
      first: first,
      hatchStarted: hatchStarted,
      oldSec: oldSec,
      newSec: newSec,
      jump: jump
    };
  }
  function ageDays(state) {
    return Math.floor(state.gameTime / 86400);
  }
  function timeInStage(state) {
    return Math.max(0, state.gameTime - (state.stageEnteredGame || 0));
  }
  function winRate(battles, wins) {
    return battles > 0 ? wins / battles : 0;
  }

  function isDm20(state) {
    if (!state || !data.SPECIAL_EGGS) return false;
    if (state.eggKind && data.SPECIAL_EGGS[state.eggKind]) return true;
    // A special-line pet keeps the brick ladder even if the save lost eggKind.
    var m = mon(state);
    return !!(m && m.egg && data.SPECIAL_EGGS[m.egg]);
  }

  function cycleSec(state) {
    var m = mon(state);
    if (!m) return 3600;
    // With the Will, 20th-brick playtest (BladeSabre): Baby I ~3 min,
    // Baby II ~30 min. Later stages are "60–90 depending on kind", and
    // poop-type / Jogress / "faster when old" have no roster or formula,
    // so those keep the species cycle.
    if (isDm20(state) && m.stage === 'baby1') return 3 * 60;
    if (isDm20(state) && m.stage === 'baby2') return 30 * 60;
    if (m.cycleMin != null) return m.cycleMin * 60;
    if (m.stage === 'egg') return 600;
    if (m.stage === 'baby1') return 3 * 60;
    return 57 * 60; // placeholder fallback, labelled on the monster when used
  }

  function dpRefillSec(state) {
    return isDm20(state) ? DM20_DP_REFILL_SEC : DP_REFILL_SEC;
  }

  function poopIntervalSec(state) {
    // 1997: NHOKO 約3時間; Wikimon ~2 h; ROM interval unpublished. Keep 3 h.
    // DM20: "very frequent" — no official minute figure found; do not invent.
    // Use the same 3 h community figure until a measured source exists.
    return POOP_INTERVAL;
  }

  function poopCapOf(state) {
    return isDm20(state) ? DM20_POOP_CAP : POOP_CAP;
  }

  /* Stages that may train, battle, or link-battle (1997 + DM20 Mega).
     Baby I / Baby II / Egg cannot. Child (rookie) and up, including
     Perfect, Mega and Super Ultimate, can (battle also needs DP and no injury). */
  var STAGE_TRAIN_BATTLE = {
    rookie: 1, champion: 1, ultimate: 1, mega: 1, super: 1
  };

  function canTrain(state) {
    if (!state || state.dead) return false;
    var m = mon(state);
    return !!(m && STAGE_TRAIN_BATTLE[m.stage]);
  }

  function satietyOf(state) {
    var m = mon(state);
    if (m && m.satiety != null) return m.satiety;
    return 4;
  }

  function pushEvent(state, type, text) {
    state.events = (state.events || []).slice(-30);
    state.events.push({ t: state.gameTime, type: type, text: text });
  }

  function albumAdd(state, id) {
    if (!state.album) state.album = [];
    if (id && state.album.indexOf(id) < 0) state.album.push(id);
  }

  function hasPerfectRoll(m) {
    if (!m) return false;
    var rules = data.BRANCHES[m.id] || [];
    for (var i = 0; i < rules.length; i++) if (rules[i].perfectRoll) return true;
    return false;
  }

  // v36 note: the 1997 Ver.1 ROM ends at Perfect (BlitzGreymon and
  // BanchoMamemon come from the 2017 Ver.20th). Eric's choice (2026-11-28):
  // KEEP the Megas on Ver.1 so it can reach Ultimate. Deliberate deviation
  // from the original brick; v35 behaviour is unchanged.
  function megaAllowed(state, m) {
    return !!(m && hasMegaBranch(m) && !m.noMega);
  }

  function hasMegaBranch(m) {
    if (!m) return false;
    if (m.megaAwakeMin) return true;
    var rules = data.BRANCHES[m.id] || [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.to && !r.stay && !r.perfectRoll && !r.leftover) {
        var dest = data.MONSTERS[r.to];
        if (dest && (dest.stage === 'mega' || dest.stage === 'super')) return true;
      }
    }
    return false;
  }

  /**
   * Firmware Perfect die: winScore 0–4 / 5–8 / 9–15 → 1/8, 1/4, 1/2.
   * Inequality is ASSUMED as `die < 2/4/8` with die in 0..15
   * (2/16, 4/16, 8/16). The exact 0x0D67 comparison was not re-read.
   */
  function rollPerfect(winScore, rng) {
    var t;
    var s = winScore || 0;
    if (s <= 4) t = 2;
    else if (s <= 8) t = 4;
    else t = 8;
    var die = Math.floor((rng || Math.random)() * 16);
    return die < t;
  }

  function markCount(results, mark) {
    var n = 0;
    var a = results || [];
    for (var i = 0; i < a.length; i++) if (a[i] === mark) n++;
    return n;
  }

  /**
   * DM20 Adult → Perfect. NHOKO cites the Bandai Ver.20th post; Humulos
   * states the same endpoints (chance from 6/15, certain at 12/15).
   * Only this stage's battles count, and only the latest 15.
   *   0–5 wins  (under 39%) → 0
   *   6–10 wins (40–69%)    → 1/4
   *   11 wins   (70–79%)    → 1/2
   *   12–15 wins (80%+)     → certain
   * 1997 keeps rollPerfect. This table is not that die.
   */
  function dm20PerfectChance(results) {
    var a = results || [];
    if (a.length < 15) return 0;
    var wins = markCount(a.slice(a.length - 15), 'W');
    if (wins >= 12) return 1;
    if (wins >= 11) return 0.5;
    if (wins >= 6) return 0.25;
    return 0;
  }

  /**
   * Battle injury: (s+1)/16 where s = base + overdose, s in 0..15.
   * Firmware hole at s === 15: the comparison never hits; no injury.
   * rng() is 0..1; we use floor(rng*16) as a 0..15 die.
   */
  function rollBattleInjury(base, overdose, rng) {
    var s = (base || 0) + (overdose || 0);
    if (s > 15) s = 15;
    if (s === 15) return false;
    var t = s + 1;
    return Math.floor((rng || Math.random)() * 16) < t;
  }

  /**
   * Boost / enhancement: ⌊max(min(overdoses,4) + strengthHearts − min(CM,4), 0) / 2⌋
   */
  function enhancement(state) {
    if (!state) return 0;
    var od = Math.min(4, state.proteinPowerUp || 0);
    var hearts = state.strength || 0;
    var cm = Math.min(4, state.calls || 0);
    return Math.floor(Math.max(od + hearts - cm, 0) / 2);
  }

  function rngOf(rngOrOpts) {
    if (typeof rngOrOpts === 'function') return rngOrOpts;
    if (rngOrOpts && typeof rngOrOpts.rng === 'function') return rngOrOpts.rng;
    return Math.random;
  }

  function rollEvoDueAt(state, rng) {
    var m = mon(state);
    if (!m) { state.evoDueAt = 0; return state.evoDueAt; }
    rng = rng || Math.random;
    if (m.stage === 'ultimate' && hasMegaBranch(m) && m.noMega) {
      // shouldn't happen
    }
    if (m.lifespanMode === 'baby1-dice' || (m.stage === 'baby1' && (m.lifespanMin || 0) <= 69)) {
      var tens = Math.floor(rng() * 10);
      var lo = tens >= 5 ? 60 : 50;
      state.evoDueAt = lo + Math.floor(rng() * 10);
      return state.evoDueAt;
    }
    var a = m.lifespanMin != null ? m.lifespanMin : 0;
    var b = m.lifespanMax != null ? m.lifespanMax : a;
    if (b < a) b = a;
    state.evoDueAt = a + Math.floor(rng() * (b - a + 1));
    return state.evoDueAt;
  }

  function applySpeciesCare(state, opts) {
    opts = opts || {};
    var m = mon(state);
    if (!m) return;
    if (m.sleepStart != null) {
      state.sleepStart = m.sleepStart;
      state.sleepEnd = m.sleepEnd;
    }
    if (isDm20(state)) {
      if (DM20_SLEEP_START[m.id] != null) state.sleepStart = DM20_SLEEP_START[m.id];
      state.sleepEnd = DM20_WAKE_HOUR;
      var cap = DM20_DP_BY_STAGE[m.stage];
      if (cap == null) cap = 0;
      state.dpMax = cap;
      if ((state.dp || 0) > cap) state.dp = cap;
      if (opts.setWeight && m.weight != null) state.weight = m.weight;
      return;
    }
    if (m.dpMax != null) {
      if (opts.migrate) {
        if ((state.dpMax || 0) < m.dpMax) state.dpMax = m.dpMax;
      } else {
        state.dpMax = m.dpMax;
        if ((state.dp || 0) > state.dpMax) state.dp = state.dpMax;
      }
    }
    if (opts.setWeight && m.weight != null) state.weight = m.weight;
  }

  function resetStageCounters(state) {
    // Official: care counters reset. Battles + win score + Perfect bit CARRY
    // Child→Adult (and are harmless to keep after later evos).
    state.calls = 0;
    state.cmForm = 0;
    state.hungerEmptySince = null;
    state.train = 0;
    state.overfeed = 0;
    state.sleepDist = 0;
    state.injuries = 0;
    state.callHungerAt = null;
    state.callStrengthAt = null;
    state.callLightsAt = null;
    state.callAt = null;
    state.callResolved = false;
    state.lightsCallResolved = false;
    state.emptyCallSince = null;
    state.emptySince = null;
    state.overdose = 0;
    state.proteinPowerUp = 0;
    state.boostCareDown = 0;
    state.healProgress = 0;
    state.lifespanElapsed = false;
    state.oldAgeMistakes = 0;
    state.perfectRolledThisStage = false;
    state.megaChecked = false;
    state.stageResults = [];
    state.satietyFilled = state.hunger || 0;
    state.sleptContinuously = 0;
    state.awakeInStage = 0;
    state.sleepCalledTonight = false;
    // proteinRemainder CARRIES. battles / wins / losses / winScore /
    // perfectQualified CARRY.
  }

  function evolveTo(state, toId, reason) {
    // FileIsland Pause: if evolution hits while left on SET, unpause,
    // evolve, and (if still night) stay / go back to sleep.
    if (isClockSet(state)) confirmClockSet(state);
    var from = state.mon;
    state.mon = toId;
    state.stageEnteredGame = state.gameTime;
    var m = mon(state);
    if (m) state.weight = m.weight || state.weight;
    resetStageCounters(state);
    applySpeciesCare(state, { setWeight: true });
    // namu: evolving on the 20th brick refills stamina to the new cap.
    if (isDm20(state) && (state.dpMax || 0) > 0) state.dp = state.dpMax;
    rollEvoDueAt(state);
    albumAdd(state, toId);
    pushEvent(state, 'evolve', (data.MONSTERS[from] || {}).nameZh + ' → ' + (m ? m.nameZh : toId) + '（' + (reason || '') + '）');
    return true;
  }

  function stageMinsForEvo(state, m) {
    if (m.stage === 'ultimate' && megaAllowed(state, m)) {
      return (state.awakeInStage || 0) / 60;
    }
    return timeInStage(state) / 60;
  }

  function evoDueMinutes(state, m) {
    if (isDm20(state) && DM20_STAGE_MIN[m.stage] != null) return DM20_STAGE_MIN[m.stage];
    var due = state.evoDueAt;
    var lo = m.lifespanMin || 0;
    // After the first clock SET, hatch at 1 minute. A save that stored the
    // old 10-minute placeholder must not keep the egg waiting.
    if (m.stage === 'egg' && state.clockInitialized) return eggHatchMinutes(state);
    // Stale due from an earlier form (e.g. tests that swap mon after defaultState):
    if (due == null || due < lo) due = lo;
    return due;
  }

  function tryEvolve(state, rngOrOpts) {
    if (state.dead) return false;
    var m = mon(state);
    if (!m) return false;
    // Official: the egg does not hatch until the clock has been set.
    // The hatch timer itself starts on the first confirm (1 minute).
    if (m.stage === 'egg' && !state.clockInitialized) return false;
    var rng = rngOf(rngOrOpts);

    // Mega: 48 h AWAKE (DM20), independent of the 1997 Perfect lifespan window.
    if (m.stage === 'ultimate' && megaAllowed(state, m) && !state.megaChecked) {
      var need = m.megaAwakeMin || 2880;
      if ((state.awakeInStage || 0) / 60 >= need) {
        state.megaChecked = true;
        // Engine already gated on 48 h awake; bypass lifespanMin (1997 Perfect window is longer).
        var megaStats = buildStats(state, 999999);
        var megaR = evo.resolveEvolution(data, state.mon, megaStats);
        if (!megaR.stayed && megaR.to && megaR.to !== state.mon) {
          return evolveTo(state, megaR.to, megaR.reason);
        }
        // Failed (calls > 2): stay. Old-age still uses the 1997 Perfect window.
      }
    }

    // DM20: the evolution timer only runs while awake (Humulos DM20 manual).
    var mins = (isDm20(state) && m.stage !== 'egg') ? (state.awakeInStage || 0) / 60 : timeInStage(state) / 60;
    var due = evoDueMinutes(state, m);
    if (mins < due) return false;

    // Already failed this form's evolution and is in old-age.
    if (state.lifespanElapsed && m.stage !== 'rookie' && m.stage !== 'baby1' && m.stage !== 'baby2' && m.stage !== 'egg') {
      return false;
    }

    // Ultimates with a Mega: Mega is only via the 48 h awake path above.
    // At the 1997 Perfect window, start old-age (5 CM) if still in this form.
    if (m.stage === 'ultimate' && megaAllowed(state, m)) {
      state.lifespanElapsed = true;
      return false;
    }

    // DM20 timing is gated above (awake-only Humulos table); do not let the
    // 1997 lifespanMin in the species data hold the evolution back.
    // Egg data still says lifespanMin 10 (the old placeholder). Once the
    // 1-minute hatch is due, do not let that field hold the egg.
    var statMins = (isDm20(state) || m.stage === 'egg') ? Math.max(mins, m.lifespanMin || 0) : mins;
    var stats = buildStats(state, statMins);

    if (isDm20(state) && hasPerfectRoll(m)) {
      // 20th brick: one roll at this stage's window, from the latest 15
      // battles fought in this form. Child battles and the 1997 win-score
      // die do not qualify it.
      var chance = dm20PerfectChance(state.stageResults);
      stats.perfectEligible = chance >= 1 || (chance > 0 && rng() < chance);
    } else if (hasPerfectRoll(m)) {
      if (!state.perfectRolledThisStage) {
        state.perfectRolledThisStage = true;
        if ((state.battles || 0) >= 15) {
          if (state.perfectQualified) {
            // Child-stage success is enough; no second required roll.
          } else if (rollPerfect(state.winScore || 0, rng)) {
            state.perfectQualified = true;
          }
        }
      }
      stats.perfectEligible = !!(state.perfectQualified && (state.battles || 0) >= 15);
    }

    var r = evo.resolveEvolution(data, state.mon, stats);

    if (!isDm20(state) && m.stage === 'rookie' && (state.battles || 0) >= 15 && !state.perfectQualified) {
      // III→IV qualifying roll, carried into Adult. Runs whether or not
      // this Child became a "good" Adult (e.g. Numemon still carries the bit).
      if (rollPerfect(state.winScore || 0, rng)) state.perfectQualified = true;
    }

    if (!r.stayed && r.to && r.to !== state.mon) {
      return evolveTo(state, r.to, r.reason);
    }

    // Stay: Champion that failed Perfect, or a no-mega Ultimate at its window,
    // or a failed-mega Ultimate at its 1997 window.
    if (m.stage === 'champion' || m.stage === 'ultimate' || m.stage === 'mega' || m.stage === 'super') {
      state.lifespanElapsed = true;
    }
    return false;
  }

  function buildStats(state, mins) {
    // DM20 battle gates (Perfect win rate, Wingdramon's 100) use this
    // form's own fights. Lifetime totals stay on the status screen.
    var stageBattles = isDm20(state);
    var results = state.stageResults || [];
    var battles = stageBattles ? results.length : state.battles;
    var wins = stageBattles ? markCount(results, 'W') : state.wins;
    return {
      calls: state.calls,
      train: state.train,
      overfeed: state.overfeed,
      sleepDist: state.sleepDist,
      weight: state.weight,
      battles: battles,
      wins: wins,
      winRate: winRate(battles, wins),
      timeInStage: mins,
      eggKind: state.eggKind || null,
      lifeSteps: (state.steps && state.steps.lifetime) || 0,
      perfectEligible: !!state.perfectQualified
    };
  }

  function addCareMistake(state, why) {
    state.calls = Math.min(CALLS_CAP, (state.calls || 0) + 1);
    state.cmForm = (state.cmForm || 0) + 1; // uncapped, per form (DM20 20-mistake death)
    state.boostCareDown = Math.min(4, (state.boostCareDown || 0) + 1);
    if (state.lifespanElapsed) {
      state.oldAgeMistakes = (state.oldAgeMistakes || 0) + 1;
    }
    pushEvent(state, 'call', why || '育成失誤 +1');
  }

  function syncCallMeters(state) {
    var emptyH = state.hunger <= 0;
    var emptyS = state.strength <= 0;
    if (!emptyH && !emptyS) {
      state.callAt = null;
      state.callResolved = false;
      state.callHungerAt = null;
      state.callStrengthAt = null;
      state.emptyCallSince = null;
      state.emptySince = null;
      return;
    }
    if (state.callResolved) {
      // Mistake already taken for this empty period; do not start a new call
      // until a meter is filled (firmware: no retrigger).
      if (!state.emptyCallSince) state.emptyCallSince = state.callAt || state.gameTime;
      state.emptySince = state.emptyCallSince;
      return;
    }
    if (state.callAt == null) {
      state.callAt = state.gameTime;
      if (emptyH) state.callHungerAt = state.gameTime;
      if (emptyS) state.callStrengthAt = state.gameTime;
    }
    if (!state.emptyCallSince) state.emptyCallSince = state.callAt;
    state.emptySince = state.emptyCallSince;
  }

  function callTimeout(state) {
    return isDm20(state) ? DM20_CALL_TIMEOUT : CALL_TIMEOUT;
  }

  function lightsCallTimeout(state) {
    if (isDm20(state)) return DM20_CALL_TIMEOUT;
    return is1997Brick(state) ? BRICK97_LIGHTS_CALL_TIMEOUT : LIGHTS_CALL_TIMEOUT;
  }

  function isCallLit(state) {
    if (!state || state.dead) return false;
    if (state.callAt != null && !state.callResolved && (state.hunger <= 0 || state.strength <= 0) &&
        state.gameTime - state.callAt < callTimeout(state)) {
      return true;
    }
    if (state.callLightsAt != null && !state.lightsCallResolved && state.sleeping && state.lights &&
        state.gameTime - state.callLightsAt < lightsCallTimeout(state)) {
      return true;
    }
    // Poop and an untreated injury light the same call icon. They are not
    // the 20-minute empty-heart mistake; flush and medicine clear them.
    if ((state.poop || 0) > 0) return true;
    if (state.injured) return true;
    return false;
  }

  function markCall(state, kind) {
    if (kind === 'hunger' || kind === 'strength') {
      syncCallMeters(state);
      return;
    }
    if (kind === 'lights' && state.callLightsAt == null && !state.lightsCallResolved) {
      state.callLightsAt = state.gameTime;
    }
  }

  function resolveCalls(state) {
    syncCallMeters(state);
    if (state.callAt != null && !state.callResolved &&
        (state.hunger <= 0 || state.strength <= 0) &&
        state.gameTime - state.callAt >= callTimeout(state)) {
      addCareMistake(state, '育成失誤 +1');
      // DM20: hunger AND strength empty together = 2 mistakes (Wikimon Ver.20th).
      if (isDm20(state) && state.hunger <= 0 && state.strength <= 0) addCareMistake(state, '育成失誤 +1');
      state.callResolved = true;
      // Do not restart the call.
    }
    if (state.callLightsAt != null && !state.lightsCallResolved &&
        state.sleeping && state.lights &&
        state.gameTime - state.callLightsAt >= lightsCallTimeout(state)) {
      addCareMistake(state, '未關燈，育成失誤 +1');
      state.lightsCallResolved = true;
      // Do not retrigger; one lights mistake per night (sleepCalledTonight).
    }
  }

  function tick(state, realNow) {
    // Pendulum (and later lines) have their own engine. Never run 1997
    // care / evo / battle formulas against those saves.
    if (state && state.family === 'digivice' && root.DigiviceEngine) {
      return root.DigiviceEngine.tick(state, realNow);
    }
    if (state && state.family === 'pen20' && root.Pen20Engine) {
      return root.Pen20Engine.tick(state, realNow);
    }
    if (state && state.family === 'pendulum' && root.PendulumEngine) {
      return root.PendulumEngine.tick(state, realNow);
    }
    if (state.dead) return { died: false, evolved: false };
    migrateState(state);
    var dtReal = Math.max(0, (realNow - state.lastReal) / 1000);
    state.lastReal = realNow;
    var dt = dtReal * (state.speed || 1);
    if (!(dt > 0)) return { died: false, evolved: false };
    return advanceGrid(state, dt, simStep);
  }

  /**
   * Advance game time by dt seconds, running the care logic once per
   * 60-second grid boundary (state.simAt = last boundary processed).
   * gameTime itself stays continuous for the clock / UI. The step
   * sequence depends only on the grid, so one long catch-up after the app
   * was closed produces exactly the same state as many small open ticks.
   */
  function advanceGrid(state, dt, stepFn) {
    var res = { evolved: false, died: false };
    var g0 = state.gameTime || 0;
    // Round to 1 µs: real ms deltas then add up exactly (no float drift that
    // could make open play miss a grid boundary the long catch-up hits).
    var target = Math.round((g0 + dt) * 1e6) / 1e6;
    var t = state.simAt;
    if (typeof t !== 'number' || !isFinite(t) || t > g0 || t < g0 - SIM_GRID) t = g0;
    while (!state.dead) {
      var nb = (Math.floor(t / SIM_GRID) + 1) * SIM_GRID;
      if (nb > target) break;
      var stepLen = nb - t;
      state.gameTime = nb;
      var r = stepFn(state, stepLen);
      t = nb;
      if (r && r.evolved) res.evolved = true;
      if (r && r.died) { res.died = true; break; }
    }
    state.simAt = t;
    state.gameTime = state.dead ? t : target;
    return res;
  }

  function simStep(state, step) {
    var r = { evolved: false, died: false };
    var m = mon(state);
    if (!m) return r;

    if (m.stage !== 'egg') {
      var cyc = cycleSec(state);
      if (state.sleeping) {
        // Original: both heart timers pause while asleep. Shift the stamps
        // with this step so a long night does not empty a heart on waking.
        state.lastHungerTick = (state.lastHungerTick || 0) + step;
        state.lastStrTick = (state.lastStrTick || 0) + step;
      } else {
        state.awakeInStage = (state.awakeInStage || 0) + step;
        // Hunger and strength share this species cycle at every stage.
        // NHOKO: a refused meal freezes hunger hearts for about 1 hour.
        // Strength keeps dropping. DM20 has no such freeze.
        var hungerFrozen = !isDm20(state) && state.gameTime < (state.hungerFreezeUntil || 0);
        if (hungerFrozen) {
          state.lastHungerTick = (state.lastHungerTick || 0) + step;
        } else if (state.gameTime - (state.lastHungerTick || 0) >= cyc) {
          state.lastHungerTick = state.gameTime;
          var prevH = state.hunger;
          state.hunger = Math.max(0, state.hunger - 1);
          if (state.hunger < prevH) {
            // New fullness cycle after a heart drops (next OF after drop).
            state.satietyFilled = state.hunger;
          }
        }
        if (state.gameTime - (state.lastStrTick || 0) >= cyc) {
          state.lastStrTick = state.gameTime;
          state.strength = Math.max(0, state.strength - 1);
        }
        var poopInt = poopIntervalSec(state);
        var poopCap = poopCapOf(state);
        if (state.gameTime - (state.lastPoopAt || 0) >= poopInt) {
          state.lastPoopAt = state.gameTime;
          // DM20 at 4 piles: will not poop (or injure) again (Humulos / community).
          // 1997: stack to 8, 8th pile injures (firmware, measured).
          if ((state.poop || 0) < poopCap) {
            state.poop = (state.poop || 0) + 1;
            if (state.poop >= poopCap) injure(state, 'poop');
          }
        }
      }

      if (state.hunger <= 0 || state.strength <= 0) syncCallMeters(state);
      else {
        state.callAt = null;
        state.callResolved = false;
        state.callHungerAt = null;
        state.callStrengthAt = null;
        state.emptyCallSince = null;
        state.emptySince = null;
      }

      // Sleep follows the clock. The lamp does not start it (toggleLights
      // only flips state.lights). Egg and Baby I have no bedtime.
      var shouldSleep = m.stage !== 'baby1' && m.stage !== 'egg' && isSleepHours(state);
      var inDisturbAwake = !!(state.awakeUntil && state.gameTime < state.awakeUntil);
      if (state.sleeping) {
        state.sleptContinuously = (state.sleptContinuously || 0) + step;
      }
      if (shouldSleep && !state.sleeping) {
        if (!inDisturbAwake) {
          state.sleeping = true;
          state.awakeUntil = 0;
          // One lights-out call per night (Humulos DMC Call).
          if (state.lights && !state.sleepCalledTonight) {
            state.lightsCallResolved = false;
            markCall(state, 'lights');
          }
          state.sleepCalledTonight = true;
        }
      }
      // DM20 daytime nap: do not treat "not bedtime" as a morning wake
      // until napUntil is reached. If the nap overlaps bedtime, they
      // keep sleeping (Humulos).
      var napping = !!(state.napUntil && state.sleeping && state.gameTime < state.napUntil);
      if (!shouldSleep) {
        if (state.sleeping && !napping) {
          state.sleeping = false;
          state.callLightsAt = null;
          state.lightsCallResolved = false;
          // Natural morning wake, or a completed 3 h nap, refills DP after
          // continuous sleep: 1997 = 8 h; DM20 = 3 h (Humulos, Wikimon).
          // A disturbance wake does not (disturbSleep resets sleptContinuously).
          // No hunger / strength gift (that was invented).
          if ((state.sleptContinuously || 0) >= dpRefillSec(state)) {
            state.dp = state.dpMax || 0;
          }
          state.napUntil = 0;
          // DM20 morning wake / nap end turns the lamp back on.
          if (isDm20(state)) setLights(state, true);
        }
        if (!napping) {
          state.sleepCalledTonight = false;
          state.awakeUntil = 0;
          state.sleptContinuously = 0;
        }
      }

      resolveCalls(state);

      if (state.injured && state.injuredAt != null && state.gameTime - state.injuredAt >= INJURY_DEATH) {
        die(state, '受傷未治療');
        r.died = true;
        return r;
      }
      if (isDm20(state)) {
        // DM20 (Humulos / NHOKO / Bandai): 12 h with empty HUNGER kills; empty
        // strength alone is not lethal (NHOKO, Bandai "dies of hunger").
        if (state.hunger <= 0 && m.stage !== 'baby1') {
          if (state.hungerEmptySince == null) state.hungerEmptySince = state.gameTime - step;
        } else {
          state.hungerEmptySince = null;
        }
        if (state.hungerEmptySince != null && state.gameTime - state.hungerEmptySince >= STARVE_DEATH) {
          die(state, '飢餓過久');
          r.died = true;
          return r;
        }
        if ((state.cmForm || 0) >= DM20_DEATH_CM_FORM) {
          die(state, '育成失誤過多');
          r.died = true;
          return r;
        }
        if ((state.awakeInStage || 0) >= DM20_OLD_AGE_AWAKE && (state.cmForm || 0) >= DM20_OLD_AGE_CM) {
          die(state, '壽終');
          r.died = true;
          return r;
        }
      } else if (state.emptyCallSince && state.gameTime - state.emptyCallSince >= STARVE_DEATH &&
          m.stage !== 'baby1' && m.stage !== 'egg') {
        die(state, '飢餓過久');
        r.died = true;
        return r;
      }
      if (state.injuries >= MAX_INJURIES) {
        die(state, '受傷次數過多');
        r.died = true;
        return r;
      }
      if (!isDm20(state) && state.lifespanElapsed && (state.oldAgeMistakes || 0) >= 5) {
        die(state, '壽終');
        r.died = true;
        return r;
      }
    }
    if (tryEvolve(state)) r.evolved = true;
    return r;
  }

  function injure(state, why) {
    // Do not reset the 6 h untreated clock if already injured.
    if (!state.injured) {
      state.injured = true;
      state.injuredAt = state.gameTime;
      state.healProgress = 0;
    }
    state.injuries = (state.injuries || 0) + 1;
    pushEvent(state, 'injury', '受傷（' + why + '）');
  }

  function die(state, why) {
    state.dead = true;
    state.deadReason = why;
    state.sleeping = false;
    pushEvent(state, 'death', why);
  }

  /**
   * Official wake (Humulos 1997 FAQ, Wikimon Ver.1/2, Humulos DMC Sleep):
   * attempting to feed, train or battle wakes the pet and counts a sleep
   * disturbance (not a care mistake). Lights on/off do not wake it (1997 / DMC).
   * It then stays awake DISTURB_AWAKE_SEC before falling back asleep if it
   * is still night. That duration is an unverified, non-official placeholder
   * (see the DISTURB_AWAKE_SEC comment); it is not the Humulos DMC "10 minutes",
   * which is a call timeout.
   */
  // v36, 1997 only: asleep with the lights off. NHOKO (初代: 「電気をつけ
  // ながら寝ている時」 food/train/battle wake it = 睡眠妨害) and the CUBE
  // blog (「電気が付いているときに妨害することが可能」) both limit sleep
  // disturbance to lights ON. With the lights off nothing wakes it.
  function asleepInDark(state) {
    return !!(state && !state.dead && state.sleeping && !state.lights && !isDm20(state));
  }

  function disturbSleep(state, reason) {
    if (!state || state.dead || !state.sleeping) return { woken: false };
    if (asleepInDark(state)) return { woken: false, dark: true };
    if (reason !== 'food' && reason !== 'train' && reason !== 'battle') {
      return { woken: false };
    }
    state.sleeping = false;
    // DM20 removed sleep disturbance (Wikimon Ver.20th, NHOKO).
    if (!isDm20(state)) state.sleepDist = (state.sleepDist || 0) + 1;
    state.awakeUntil = state.gameTime + (isDm20(state) ? DM20_WAKE_SEC : DISTURB_AWAKE_SEC);
    state.callLightsAt = null;
    // Disturbance breaks the 8 h continuous-sleep stretch for DP refill.
    state.sleptContinuously = 0;
    pushEvent(state, 'sleep', '睡眠打擾');
    return { woken: true, sleepDist: state.sleepDist };
  }

  function wakePenalty(state, action) {
    return disturbSleep(state, action).woken;
  }

  function clearHungerCall(state) {
    if (state.hunger > 0) state.callHungerAt = null;
    if (state.hunger > 0 && state.strength > 0) {
      state.callAt = null;
      state.callResolved = false;
      state.emptyCallSince = null;
      state.emptySince = null;
      state.callStrengthAt = null;
    }
  }
  function clearStrengthCall(state) {
    if (state.strength > 0) state.callStrengthAt = null;
    if (state.hunger > 0 && state.strength > 0) {
      state.callAt = null;
      state.callResolved = false;
      state.emptyCallSince = null;
      state.emptySince = null;
      state.callHungerAt = null;
    }
  }

  function feedMeat(state) {
    if (asleepInDark(state)) return { ok: false, reason: 'asleep-dark' };
    if (state.dead) return { ok: false, reason: 'dead' };
    var m = mon(state);
    if (!m || m.stage === 'egg') return { ok: false, reason: 'egg' };
    wakePenalty(state, 'food');
    var capHearts = 4;
    var capSat = satietyOf(state);
    var filled = state.satietyFilled || 0;
    if (state.hunger < capHearts) {
      state.hunger = Math.min(capHearts, state.hunger + 1);
      state.weight = Math.min(99, (state.weight || 0) + 1);
      state.satietyFilled = filled + 1;
      clearHungerCall(state);
      return { ok: true };
    }
    // Hearts full: further meats count toward 満腹 until the refuse cap.
    if (filled < capSat) {
      state.satietyFilled = filled + 1;
      state.weight = Math.min(99, (state.weight || 0) + 1);
      return { ok: true, satiety: true };
    }
    if (state.gameTime >= (state.overfeedLockUntil || 0)) {
      state.overfeed = (state.overfeed || 0) + 1;
      state.overfeedLockUntil = state.gameTime + OVERFEED_LOCK;
      state.weight = Math.min(99, (state.weight || 0) + 1);
      // NHOKO 初代: the refuse itself starts the ~1 h hunger freeze. DM20 does not.
      if (!isDm20(state)) state.hungerFreezeUntil = state.gameTime + HUNGER_FREEZE_SEC;
      return { ok: true, overfeed: true, refused: true };
    }
    return { ok: false, reason: 'full' };
  }

  // Energy from every 4th protein.
  // Ver.1 (JP V1, DMComm "Wrapping"): energy can rise past the default by up
  // to +9; the protein that would make it default+10 resets it to the default.
  // Other bricks (DMComm "No overfill", EN V2/V3, JP V4/V5) stop at the default.
  // JP V2 also wraps per DMComm (v100: applied, same program as Ver.1).
  var ENERGY_WRAP_AT = 10;
  function proteinEnergy(state, m) {
    var max = state.dpMax || 0;
    var cur = state.dp || 0;
    // v100: JP Ver.2 wraps too (DMComm), and it runs Ver.1's program.
    if (!isDm20(state) && m && (Number(m.version) === 1 || Number(m.version) === 2) && max > 0) {
      if (cur < max) return cur + 1;
      var next = cur + 1;
      return next >= max + ENERGY_WRAP_AT ? max : next;
    }
    return Math.min(max, cur + 1);
  }

  function feedProtein(state) {
    if (asleepInDark(state)) return { ok: false, reason: 'asleep-dark' };
    if (state.dead) return { ok: false, reason: 'dead' };
    var m = mon(state);
    if (!m || m.stage === 'egg') return { ok: false, reason: 'egg' };
    wakePenalty(state, 'food');
    // +1 strength (no overfill past 4), +2 g, always accepted (protein is
    // not a 満腹 refuse). Every 4 proteins: +1 Energy (see proteinEnergy:
    // Ver.1 wraps at default+10, others stop at dpMax), +1 overdose (0–15), +1 power-up (0–4). Remainder 0–3 carries.
    if (state.strength < 4) state.strength = state.strength + 1;
    state.weight = Math.min(99, (state.weight || 0) + 2);
    clearStrengthCall(state);
    var rem = (state.proteinRemainder != null ? state.proteinRemainder : (state._proteinBank || 0)) + 1;
    if (rem >= 4) {
      rem = 0;
      state.overdose = Math.min(15, (state.overdose || 0) + 1);
      state.proteinPowerUp = Math.min(4, (state.proteinPowerUp || 0) + 1);
      state.dp = proteinEnergy(state, m);
    }
    state.proteinRemainder = rem;
    state._proteinBank = rem; // alias for older UI
    return { ok: true, proteinRemainder: rem };
  }

  function noteTrainingOpened(state) {
    if (asleepInDark(state)) return { ok: false, reason: 'asleep-dark' };
    if (!state || state.dead) return { ok: false };
    var m = mon(state);
    if (!m || m.stage === 'egg' || m.stage === 'baby1' || m.stage === 'baby2') {
      return { ok: false, reason: 'too-young' };
    }
    var countsAny = m.trainCounts === 'any' || Number(m.version) === 1;
    if (countsAny && !state._trainSessionCounted) {
      state.train = (state.train || 0) + 1;
      state._trainSessionCounted = true;
    }
    return { ok: true, train: state.train };
  }

  function cancelTraining(state) {
    // Ver.1 already counted on open; no weight change (they did not exercise).
    // NHOKO: cancelling a tag round still advances the six-pattern rotation.
    if (state && state.dm20TagActive) {
      state.dm20TagRound = ((state.dm20TagRound || 0) + 1) % DM20_TAG_PATTERNS.length;
      state.dm20TagActive = false;
    }
    if (state) state._trainSessionCounted = false;
    return { ok: true, train: state ? state.train : 0 };
  }

  function finishTraining(state, success, attempted) {
    if (state.dead) return { ok: false };
    if (asleepInDark(state)) return { ok: false, reason: 'asleep-dark' };
    var m = mon(state);
    if (!m || m.stage === 'egg' || m.stage === 'baby1' || m.stage === 'baby2') return { ok: false, reason: 'too-young' };
    wakePenalty(state, 'train');
    var countsAny = m.trainCounts === 'any' || Number(m.version) === 1;
    if (state._trainSessionCounted) {
      state._trainSessionCounted = false;
    } else {
      if (countsAny && attempted) state.train += 1;
      else if (!countsAny && success) state.train += 1;
    }
    if (success) {
      state.strength = Math.min(4, state.strength + 1);
      state.weight = Math.max(m.weight || 5, state.weight - (Number(m.version) === 1 ? 1 : 2));
    } else if (attempted) {
      state.weight = Math.max(m.weight || 5, state.weight - 1);
    }
    clearStrengthCall(state);
    return { ok: true, train: state.train };
  }

  /* DM20 single training (Bandai manual + NHOKO Ver.20th table + Humulos):
     after "!" mash A within the time limit to break the wall.
       untouched  → fail,  weight −1, strength  0, no effort
       half-broken→ fail,  weight −1, strength  0, effort +1 training
       wrecked    → success, weight −2, strength +1, effort +1
       destroyed  → success, weight −4, strength +2, effort +1
     Humulos: every training loses 1–4 g depending on performance, so the
     untouched wall loses the floor (1 g) rather than 0. 13 presses =
     destroyed and is the 4 g end of that range. The 4 / 9 press cut-offs
     for the two middle states are unpublished → PLACEHOLDER. Effort:
     NHOKO and Humulos say failures count too; the Bandai manual says some
     wall must be destroyed, so an untouched wall still gives no effort. */
  var DM20_TRAIN_CUTS = { half: 4, wreck: 9, destroy: 13, source: 'destroy=Humulos; half/wreck=PLACEHOLDER' };
  function dm20TrainTier(presses) {
    var n = presses || 0;
    if (n >= DM20_TRAIN_CUTS.destroy) return 3;
    if (n >= DM20_TRAIN_CUTS.wreck) return 2;
    if (n >= DM20_TRAIN_CUTS.half) return 1;
    return 0;
  }
  function finishDm20Training(state, presses) {
    if (!state || state.dead) return { ok: false };
    var m = mon(state);
    if (!m || !STAGE_TRAIN_BATTLE[m.stage]) return { ok: false, reason: 'too-young' };
    var tier = dm20TrainTier(presses);
    var minW = m.weight || 5;
    var loss = [1, 1, 2, 4][tier];
    var gain = [0, 0, 1, 2][tier];
    state.weight = Math.max(minW, (state.weight || minW) - loss);
    if (tier >= 1) state.train = (state.train || 0) + 1;
    if (gain) state.strength = Math.min(4, (state.strength || 0) + gain);
    state._trainSessionCounted = false;
    clearStrengthCall(state);
    return { ok: true, tier: tier, success: tier >= 2, train: state.train, strength: state.strength, weight: state.weight };
  }

  /* DM20 tag training (Humulos). Two Digimon, five shots. A is the top
     button (high), B is the middle button (low). 3 of 5 past the shield
     succeeds. The six patterns repeat. */
  var DM20_TAG_PATTERNS = ['ABABB', 'BBAAB', 'BAABB', 'ABBAA', 'BABAB', 'ABABA'];
  function dm20TagPattern(round) {
    var n = DM20_TAG_PATTERNS.length;
    var i = ((round || 0) % n + n) % n;
    return DM20_TAG_PATTERNS[i];
  }
  function finishDm20TagTraining(state, hits) {
    if (!state || state.dead) return { ok: false };
    var m = mon(state);
    if (!m || !STAGE_TRAIN_BATTLE[m.stage]) return { ok: false, reason: 'too-young' };
    var pattern = dm20TagPattern(state.dm20TagRound || 0);
    state.dm20TagRound = ((state.dm20TagRound || 0) + 1) % DM20_TAG_PATTERNS.length;
    var nHits = hits || 0;
    var success = nHits >= 3;
    var minW = m.weight || 5;
    // NHOKO Ver.20th tag table: every finished round loses 2 g.
    // 0–2 hits fail, 3–4 succeed with +1 strength, 5 hits succeed with +2.
    var gain = nHits >= 5 ? 2 : (success ? 1 : 0);
    state.weight = Math.max(minW, (state.weight || minW) - 2);
    state.train = (state.train || 0) + 1;
    if (gain) state.strength = Math.min(4, (state.strength || 0) + gain);
    state.dm20TagActive = false;
    state._trainSessionCounted = false;
    clearStrengthCall(state);
    return {
      ok: true, success: success, hits: nHits, pattern: pattern,
      train: state.train, strength: state.strength, weight: state.weight
    };
  }

  function flush(state) {
    if (state.dead) return { ok: false };
    state.poop = 0;
    return { ok: true };
  }

  function setLights(state, on) {
    if (!state) return { lights: true };
    state.lights = !!on;
    // Turning the lamp off clears a pending lights-left-on call (1997 / DMC).
    if (!state.lights) state.callLightsAt = null;
    return { lights: state.lights };
  }

  function toggleLights(state) {
    // 1997 / DMC: Light only toggles the lamp. It does not wake the pet
    // and does not start a second lights-out call (Humulos DMC: one call per night).
    // The user can always toggle back on.
    return setLights(state, !state.lights);
  }

  /**
   * DM20 Sleep (light-bulb) menu.
   * Official LCD options are On and Off (Humulos DM20 manual: "you are
   * given an option for On and Off"; Bandai English manual describes the
   * icon as "LIGHTS (wake up/put to sleep)"). Effects (Humulos):
   *   Not tired and not sleeping: On = no sleep change; Off = 3-hour nap
   *     (continues into normal bedtime if it overlaps).
   *   Tired: On = wake; Off = put to sleep.
   *   Sleeping: On = wake; Off = nothing (sleep state).
   * Waking is not a care mistake and not a sleep disturbance (do not
   * call disturbSleep). On ALWAYS turns the lamp on — including when the
   * pet is already awake (Humulos "On — Nothing!" is about sleep state,
   * not leaving the LCD dark). The user can always turn lights back on.
   * sel 0 = On, sel 1 = Off.
   */
  function confirmDm20Light(state, sel) {
    if (!state || state.dead) return { ok: false };
    var wantOn = (sel === 0);
    if (wantOn) {
      setLights(state, true);
      var woken = false;
      if (state.sleeping) {
        state.sleeping = false;
        state.napUntil = 0;
        // Keep a short awake window so tick() does not immediately re-sleep
        // at night. DISTURB_AWAKE_SEC is an unverified placeholder.
        state.awakeUntil = (state.gameTime || 0) + DM20_WAKE_SEC;
        woken = true;
      }
      return { ok: true, lights: true, woken: woken };
    }
    // Off
    if (state.sleeping) {
      // Official: Off does nothing to sleep while already sleeping.
      // Do not force the lamp back on or off here.
      return { ok: true, lights: state.lights, noop: true };
    }
    setLights(state, false);
    state.sleeping = true;
    if (isSleepHours(state)) {
      // Tired (bedtime, not yet asleep in official terms): put to bed.
      state.napUntil = 0;
      return { ok: true, lights: false, sleeping: true, nap: false };
    }
    // Awake, not bedtime: 3-hour nap. If it later overlaps bedtime, tick
    // keeps them asleep (Humulos).
    state.napUntil = (state.gameTime || 0) + DM20_NAP_SEC;
    return { ok: true, lights: false, sleeping: true, nap: true };
  }

  function heal(state) {
    if (state.dead) return { ok: false };
    if (!state.injured) return { ok: false, reason: 'healthy' };
    var m = mon(state);
    var doses = (m && m.healDoses != null) ? m.healDoses : 1;
    if (doses < 1) doses = 1;
    state.healProgress = (state.healProgress || 0) + 1;
    var remaining = Math.max(0, doses - state.healProgress);
    if (remaining > 0) {
      return { ok: true, remaining: remaining, needMore: true };
    }
    state.injured = false;
    state.injuredAt = null;
    state.healProgress = 0;
    return { ok: true, remaining: 0 };
  }

  function recordBattle(state, result, rng) {
    if (state.dead) return;
    if (asleepInDark(state)) return { ok: false, reason: 'asleep-dark' };
    var m = mon(state);
    if (!m || !m.canBattle || !STAGE_TRAIN_BATTLE[m.stage]) return { ok: false, reason: 'cannot-battle' };
    if (state.dp <= 0) return { ok: false, reason: 'no-dp' };
    if (state.injured) return { ok: false, reason: 'injured' };
    wakePenalty(state, 'battle');
    state.dp = Math.max(0, state.dp - 1);
    state.weight = Math.max(m.weight || 5, state.weight - (Number(m.version) === 1 ? 2 : 4));
    state.battles = (state.battles || 0) + 1;
    if (isDm20(state)) {
      if (!state.stageResults) state.stageResults = [];
      state.stageResults.push(result === 'win' ? 'W' : 'L');
    }
    state.lifeBattles = (state.lifeBattles || 0) + 1;
    if (result === 'win') {
      state.wins = (state.wins || 0) + 1;
      state.lifeWins = (state.lifeWins || 0) + 1;
      state.winScore = Math.min(WIN_SCORE_MAX, (state.winScore || 0) + 1);
    } else {
      state.losses = (state.losses || 0) + 1;
      state.lifeLosses = (state.lifeLosses || 0) + 1;
      state.winScore = Math.max(0, (state.winScore || 0) - 1);
    }
    var base = m.injuryBase != null ? m.injuryBase : 0;
    if (rollBattleInjury(base, state.overdose || 0, rng || Math.random)) {
      injure(state, 'battle');
    }
    return {
      ok: true, result: result,
      battles: state.battles, wins: state.wins,
      winScore: state.winScore,
      wr: winRate(state.battles, state.wins)
    };
  }

  function nextCpuInitiator(state) {
    // 1997: the device that presses Battle is the initiator on every fight.
    // CPU battles do not take turns. Link battles use the offerer instead.
    if (state) state.cpuPlayerInitiates = true;
    return true;
  }

  function tryJogress(state, partnerId) {
    if (state.dead) return { ok: false };
    var self = mon(state);
    // 1997 Ver.1–5 has no Jogress (Pendulum / DM20). Babies / Egg cannot.
    if (!self || !STAGE_TRAIN_BATTLE[self.stage]) return { ok: false, reason: 'too-young' };
    var pairs = data.JOGRESS || [];
    var hit = null;
    for (var i = 0; i < pairs.length; i++) {
      var j = pairs[i];
      if ((j.a === state.mon && j.b === partnerId) || (j.b === state.mon && j.a === partnerId)) {
        hit = j; break;
      }
    }
    if (!hit) return { ok: false, reason: 'not-pair' };
    var need = hit.tagWins || 5;
    if ((state.tagWins || 0) < need) return { ok: false, reason: 'need-tags', need: need, have: state.tagWins || 0, to: hit.to, nameZh: hit.nameZh };
    evolveTo(state, hit.to, '合體進化（標籤對戰 ' + need + ' 勝）');
    state.tagWins = 0;
    return { ok: true, to: hit.to, nameZh: hit.nameZh };
  }

  function addTagWin(state) {
    state.tagWins = (state.tagWins || 0) + 1;
    return state.tagWins;
  }

  function jogressPartners(state) {
    return (data.JOGRESS || []).filter(function (j) {
      return j.a === state.mon || j.b === state.mon;
    }).map(function (j) {
      var other = j.a === state.mon ? j.b : j.a;
      return { to: j.to, partner: other, nameZh: j.nameZh, tagWins: j.tagWins || 5, have: state.tagWins || 0 };
    });
  }

  function canBattle(state) {
    var m = mon(state);
    // Child (rookie) and up, including DM20 Mega / Super. Need DP, not injured.
    // Wikimon / Humulos: Baby I and Baby II cannot battle; must heal before
    // fighting again; cannot fight at 0 Energy.
    return !!(m && m.canBattle && STAGE_TRAIN_BATTLE[m.stage] &&
      !state.dead && state.dp > 0 && !state.injured);
  }

  function status(state) {
    var m = mon(state) || {};
    var st = data.STAGES[m.stage] || {};
    var br = state.battles, bw = state.wins;
    return {
      id: state.mon,
      nameZh: m.nameZh || '？',
      nameEn: m.nameEn || '',
      stageZh: st.zh || '',
      stageEn: st.en || m.stage || '',
      version: m.version,
      age: ageDays(state),
      weight: state.weight,
      hunger: state.hunger,
      strength: state.strength,
      dp: state.dp,
      dpMax: state.dpMax,
      calls: state.calls,
      train: state.train,
      overfeed: state.overfeed,
      sleepDist: state.sleepDist,
      battles: br,
      wins: bw,
      losses: state.losses,
      winRate: winRate(br, bw),
      winScore: state.winScore || 0,
      perfectQualified: !!state.perfectQualified,
      lifeBattles: state.lifeBattles,
      lifeWins: state.lifeWins,
      lifeLosses: state.lifeLosses,
      lifeWinRate: winRate(state.lifeBattles, state.lifeWins),
      poop: state.poop,
      lights: state.lights,
      sleeping: state.sleeping,
      injured: state.injured,
      dead: state.dead,
      clock: clockHour(state),
      clockSec: clockSeconds(state),
      timeInStageMin: Math.floor(timeInStage(state) / 60),
      lifespanMin: m.lifespanMin,
      lifespanMax: m.lifespanMax,
      evoDueAt: state.evoDueAt,
      canBattle: !!(m.canBattle && !state.dead),
      tagWins: state.tagWins || 0,
      lifeSteps: (state.steps && state.steps.lifetime) || 0,
      steps: root.Steps ? root.Steps.todaySummary(state) : null,
      calling: isCallLit(state)
    };
  }

  function hatchIfEggSelect(state, version, randomize, special) {
    if (randomize) version = 1 + Math.floor(Math.random() * 5);
    var s = defaultState(version, special || null);
    // Real-time (1x) is the official default. Inherit a previous speed only
    // when that save already went through speedMigrated (a deliberate debug
    // rate). An unmigrated 60x default must not carry onto the new egg.
    s.speed = (state && state.speedMigrated && state.speed) ? state.speed : 1;
    s.speedMigrated = true;
    if (root.Steps && root.Steps.carryLedger) {
      root.Steps.carryLedger(state, s);
    }
    albumAdd(s, s.mon);
    return s;
  }

  /**
   * Backward-compatible save migration. Idempotent.
   * Old saves get defaults, a winScore estimated from wins−losses, a
   * random evoDueAt inside the official window (or "due now" if already
   * past the max), and a raised dpMax without a free DP refill.
   */
  function migrateState(state) {
    if (!state) return state;
    if (state.family === 'digivice' && root.DigiviceEngine && root.DigiviceEngine.migrateState) {
      return root.DigiviceEngine.migrateState(state);
    }
    if (state.family === 'pen20' && root.Pen20Engine && root.Pen20Engine.migrateState) {
      return root.Pen20Engine.migrateState(state);
    }
    if (state.family === 'pendulum' && root.PendulumEngine && root.PendulumEngine.migrateState) {
      return root.PendulumEngine.migrateState(state);
    }
    if (state.winScore == null) {
      state.winScore = Math.min(WIN_SCORE_MAX, Math.max(0, (state.wins || 0) - (state.losses || 0)));
    }
    if (state.perfectQualified == null) state.perfectQualified = false;
    if (state.perfectRolledThisStage == null) state.perfectRolledThisStage = false;
    if (state.megaChecked == null) state.megaChecked = false;
    if (state.overdose == null) state.overdose = 0;
    if (state.proteinRemainder == null) {
      state.proteinRemainder = state._proteinBank || 0;
    }
    if (state.proteinPowerUp == null) state.proteinPowerUp = 0;
    if (state.boostCareDown == null) state.boostCareDown = Math.min(4, state.calls || 0);
    if (state.satietyFilled == null) state.satietyFilled = state.hunger || 0;
    if (state.sleptContinuously == null) state.sleptContinuously = 0;
    if (state.lifespanElapsed == null) state.lifespanElapsed = false;
    if (state.oldAgeMistakes == null) state.oldAgeMistakes = 0;
    if (state.callResolved == null) state.callResolved = false;
    if (state.lightsCallResolved == null) state.lightsCallResolved = false;
    if (state.healProgress == null) state.healProgress = 0;
    if (state.awakeInStage == null) state.awakeInStage = 0;
    if (!state.stageResults) state.stageResults = [];
    if (state.awakeUntil == null) state.awakeUntil = 0;
    if (state.hungerFreezeUntil == null) state.hungerFreezeUntil = 0;
    if (state.dm20TagRound == null) state.dm20TagRound = 0;
    if (state.sleepCalledTonight == null) state.sleepCalledTonight = false;
    if (state.cpuPlayerInitiates == null) state.cpuPlayerInitiates = true;
    if (state.emptyCallSince == null && state.emptySince != null) state.emptyCallSince = state.emptySince;
    // Official device is real-time. Old builds defaulted to 60x, which
    // starved pets in minutes. One-shot: 60 or missing → 1, then flag.
    // Already-migrated saves keep a debug rate (including 60) the user set.
    if (!state.speedMigrated) {
      if (state.speed == null || state.speed === 60) state.speed = 1;
      state.speedMigrated = true;
    }
    // Existing saves already ran (and could hatch) without a required SET.
    // Only brand-new eggs (clockInitialized: false in defaultState) wait.
    if (state.clockInitialized == null) state.clockInitialized = true;
    if (!state.clockSet) state.clockSet = { on: false, h24: 0, min: 0 };
    applySpeciesCare(state, { migrate: true });
    if (state.evoDueAt == null) {
      var m = mon(state);
      var mins = timeInStage(state) / 60;
      if (m && m.lifespanMax != null && mins >= m.lifespanMax) {
        // Already past the official window: evolve on the next tick.
        state.evoDueAt = mins;
      } else if (m && m.lifespanMin != null && mins >= m.lifespanMin) {
        // Already inside the window (old flat timer): due now.
        state.evoDueAt = mins;
      } else {
        rollEvoDueAt(state);
      }
    }
    return state;
  }

  root.Engine = {
    defaultState: defaultState,
    tick: tick,
    feedMeat: feedMeat,
    feedProtein: feedProtein,
    finishTraining: finishTraining,
    finishDm20Training: finishDm20Training,
    dm20TrainTier: dm20TrainTier,
    dm20TagPattern: dm20TagPattern,
    finishDm20TagTraining: finishDm20TagTraining,
    DM20_TAG_PATTERNS: DM20_TAG_PATTERNS,
    isDm20: isDm20,
    advanceGrid: advanceGrid,
    SIM_GRID: SIM_GRID,
    noteTrainingOpened: noteTrainingOpened,
    cancelTraining: cancelTraining,
    flush: flush,
    toggleLights: toggleLights,
    setLights: setLights,
    confirmDm20Light: confirmDm20Light,
    isDm20: isDm20,
    heal: heal,
    recordBattle: recordBattle,
    canBattle: canBattle,
    canTrain: canTrain,
    tryJogress: tryJogress,
    injure: injure,
    addTagWin: addTagWin,
    jogressPartners: jogressPartners,
    status: status,
    hatchIfEggSelect: hatchIfEggSelect,
    tryEvolve: tryEvolve,
    timeInStage: timeInStage,
    clockHour: clockHour,
    clockSeconds: clockSeconds,
    runningClockSeconds: runningClockSeconds,
    isClockSet: isClockSet,
    beginClockSet: beginClockSet,
    adjustClockSet: adjustClockSet,
    confirmClockSet: confirmClockSet,
    applyClockJump: applyClockJump,
    eggHatchMinutes: eggHatchMinutes,
    isSleepHoursAt: isSleepHoursAt,
    ageDays: ageDays,
    winRate: winRate,
    mon: mon,
    isSleepHours: isSleepHours,
    disturbSleep: disturbSleep,
    asleepInDark: asleepInDark,
    DISTURB_AWAKE_SEC: DISTURB_AWAKE_SEC,
    CALL_TIMEOUT: CALL_TIMEOUT,
    LIGHTS_CALL_TIMEOUT: LIGHTS_CALL_TIMEOUT,
    VER1_LIGHTS_CALL_TIMEOUT: VER1_LIGHTS_CALL_TIMEOUT,
    VER1_HATCH_MIN: VER1_HATCH_MIN,
    lightsCallTimeout: lightsCallTimeout,
    isVer1Brick: isVer1Brick,
    is1997Brick: is1997Brick,
    BRICK97_HATCH_MIN: BRICK97_HATCH_MIN,
    BRICK97_LIGHTS_CALL_TIMEOUT: BRICK97_LIGHTS_CALL_TIMEOUT,
    HUNGER_FREEZE_SEC: HUNGER_FREEZE_SEC,
    MAX_CATCHUP: Infinity, // v32: no cap (whole closed period simulated on SIM_GRID)
    STARVE_DEATH: STARVE_DEATH,
    INJURY_DEATH: INJURY_DEATH,
    OVERFEED_LOCK: OVERFEED_LOCK,
    DP_REFILL_SEC: DP_REFILL_SEC,
    DM20_DP_REFILL_SEC: DM20_DP_REFILL_SEC,
    DM20_DP_BY_STAGE: DM20_DP_BY_STAGE,
    DM20_NAP_SEC: DM20_NAP_SEC,
    POOP_INTERVAL: POOP_INTERVAL,
    poopCapOf: poopCapOf,
    dpRefillSec: dpRefillSec,
    cycleSec: cycleSec,
    MAX_INJURIES: MAX_INJURIES,
    isCallLit: isCallLit,
    enhancement: enhancement,
    rollPerfect: rollPerfect,
    rollBattleInjury: rollBattleInjury,
    rollEvoDueAt: rollEvoDueAt,
    migrateState: migrateState,
    applySpeciesCare: applySpeciesCare,
    nextCpuInitiator: nextCpuInitiator,
    evolveTo: evolveTo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
