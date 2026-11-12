/**
 * Digital Monster care / time / evolution engine.
 * Stage battle counters reset on evolution; lifetime totals do not.
 */
(function (root) {
  'use strict';
  var data = root.EvolutionData;
  var evo = root.Evolution;

  var CALL_TIMEOUT = 20 * 60;      // 20 min game-time
  var POOP_INTERVAL = 3 * 3600;
  var INJURY_DEATH = 6 * 3600;
  var STARVE_DEATH = 12 * 3600;
  var MAX_INJURIES = 20;
  var OVERFEED_LOCK = 3600;

  function now() { return Date.now(); }

  var SPECIAL_EGG_IDS = {
    zuba: "egg_zuba", hack: "egg_hack",
    dra_blue: "egg_dra_blue", dra_green: "egg_dra_green",
    doru: "egg_doru",
    anime_agumon: "egg_anime_agumon", anime_gabumon: "egg_anime_gabumon",
    corona: "egg_corona", luna: "egg_luna", meicoo: "egg_meicoo"
  };

  function defaultState(eggVersion, specialEgg) {
    var eggId, mon, eggKind, version;
    if (specialEgg) {
      eggId = SPECIAL_EGG_IDS[specialEgg] || ("egg_" + specialEgg);
      mon = eggId;
      eggKind = specialEgg;
      version = specialEgg;
    } else {
      eggId = "egg_v" + (eggVersion || 1);
      mon = eggId;
      eggKind = "ver" + (eggVersion || 1);
      version = eggVersion || 1;
    }
    var clock = new Date();
    return {
      mon: mon,
      version: version,
      eggKind: eggKind,
      bornAt: now(),
      stageEnteredAt: now(),
      stageEnteredGame: 0,
      gameTime: 0,
      lastReal: now(),
      tagWins: 0,
      clockOffset: clock.getHours() * 3600 + clock.getMinutes() * 60 + clock.getSeconds(),
      speed: 60,
      hunger: 4,
      hungerCap: 4,
      strength: 4,
      dp: 0,
      dpMax: 4,
      weight: (data.MONSTERS[mon] && data.MONSTERS[mon].weight) || 5,
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
      album: mon ? [mon] : [],
      events: [],
      sleepStart: 21,
      sleepEnd: 8,
      steps: (root.Steps && root.Steps.empty) ? root.Steps.empty() : {
        days: {}, lastHealthSyncAt: 0, lastHealthSyncDate: '', lastHealthSyncTotal: 0,
        lifetime: 0, dayEffectsDate: '', dayEffort: 0, dayStrength: 0, dayWeightLoss: 0
      }
    };
  }

  function mon(state) { return data.MONSTERS[state.mon]; }

  function clockSeconds(state) {
    return (state.clockOffset + state.gameTime) % 86400;
  }
  function clockHour(state) {
    return Math.floor(clockSeconds(state) / 3600);
  }
  function isSleepHours(state) {
    var h = clockHour(state);
    if (state.sleepStart > state.sleepEnd) return h >= state.sleepStart || h < state.sleepEnd;
    return h >= state.sleepStart && h < state.sleepEnd;
  }
  function ageDays(state) {
    return Math.floor(state.gameTime / 86400);
  }
  function timeInStage(state) {
    // game-seconds in current form
    return Math.max(0, state.gameTime - (state.stageEnteredGame || 0));
  }
  function winRate(battles, wins) {
    return battles > 0 ? wins / battles : 0;
  }

  function cycleSec(state) {
    var m = mon(state);
    if (!m) return 3600;
    if (m.stage === 'egg') return 600;
    if (m.stage === 'baby1') return 3 * 60;
    return 57 * 60;
  }

  function pushEvent(state, type, text) {
    state.events = (state.events || []).slice(-30);
    state.events.push({ t: state.gameTime, type: type, text: text });
  }

  function albumAdd(state, id) {
    if (!state.album) state.album = [];
    if (id && state.album.indexOf(id) < 0) state.album.push(id);
  }

  function resetStageCounters(state) {
    // Official: counters reset on evolution (including internal battle record).
    state.calls = 0;
    state.train = 0;
    state.overfeed = 0;
    state.sleepDist = 0;
    state.injuries = 0;
    state.battles = 0;
    state.wins = 0;
    state.losses = 0;
    state.callHungerAt = null;
    state.callStrengthAt = null;
    state.callLightsAt = null;
  }

  function evolveTo(state, toId, reason) {
    var from = state.mon;
    state.mon = toId;
    state.stageEnteredGame = state.gameTime;
    var m = mon(state);
    if (m) state.weight = m.weight || state.weight;
    resetStageCounters(state);
    albumAdd(state, toId);
    if (m && m.canBattle) state.dpMax = m.stage === 'rookie' ? 3 : 4;
    pushEvent(state, 'evolve', (data.MONSTERS[from] || {}).nameZh + ' → ' + (m ? m.nameZh : toId) + '（' + (reason || '') + '）');
    return true;
  }

  function tryEvolve(state) {
    if (state.dead) return false;
    var m = mon(state);
    if (!m) return false;
    var mins = timeInStage(state) / 60;
    var stats = {
      calls: state.calls,
      train: state.train,
      overfeed: state.overfeed,
      sleepDist: state.sleepDist,
      weight: state.weight,
      battles: state.battles,
      wins: state.wins,
      winRate: winRate(state.battles, state.wins),
      timeInStage: mins,
      eggKind: state.eggKind || null,
      lifeSteps: (state.steps && state.steps.lifetime) || 0
    };
    var r = evo.resolveEvolution(data, state.mon, stats);
    if (!r.stayed && r.to && r.to !== state.mon) {
      return evolveTo(state, r.to, r.reason);
    }
    return false;
  }

  function markCall(state, kind) {
    if (kind === 'hunger' && state.callHungerAt == null) state.callHungerAt = state.gameTime;
    if (kind === 'strength' && state.callStrengthAt == null) state.callStrengthAt = state.gameTime;
    if (kind === 'lights' && state.callLightsAt == null) state.callLightsAt = state.gameTime;
  }

  function resolveCalls(state) {
    // If both hunger and strength are in a missed window, count as ONE mistake (original).
    var missedH = state.callHungerAt != null && state.gameTime - state.callHungerAt >= CALL_TIMEOUT && state.hunger <= 0;
    var missedS = state.callStrengthAt != null && state.gameTime - state.callStrengthAt >= CALL_TIMEOUT && state.strength <= 0;
    if (missedH || missedS) {
      state.calls += 1;
      state.callHungerAt = missedH ? null : state.callHungerAt;
      state.callStrengthAt = missedS ? null : state.callStrengthAt;
      // after a locked-in mistake, start a new window only when still empty later
      if (state.hunger <= 0) state.callHungerAt = state.gameTime;
      if (state.strength <= 0) state.callStrengthAt = state.gameTime;
      pushEvent(state, 'call', '育成失誤 +1');
    }
    if (state.callLightsAt != null && state.sleeping && state.lights && state.gameTime - state.callLightsAt >= CALL_TIMEOUT) {
      state.calls += 1;
      state.callLightsAt = state.gameTime;
      pushEvent(state, 'call', '未關燈，育成失誤 +1');
    }
  }

  function tick(state, realNow) {
    if (state.dead) return { died: false, evolved: false };
    var dtReal = Math.max(0, (realNow - state.lastReal) / 1000);
    state.lastReal = realNow;
    var dt = dtReal * (state.speed || 1);
    if (dt <= 0) return { died: false, evolved: false };
    // Cap catch-up: 8 game-hours. Long background pauses should not insta-kill.
    var MAX_CATCHUP = 8 * 3600;
    if (dt > MAX_CATCHUP) dt = MAX_CATCHUP;
    var evolved = false, died = false;
    var remain = dt;
    while (remain > 0 && !state.dead) {
      var step = Math.min(remain, 60);
      remain -= step;
      state.gameTime += step;
      var m = mon(state);
      if (!m) break;

      // egg auto hatch via tryEvolve
      if (m.stage !== 'egg') {
        var cyc = cycleSec(state);
        if (!state.sleeping) {
          if (state.gameTime - (state.lastHungerTick || 0) >= cyc) {
            state.lastHungerTick = state.gameTime;
            if (state.gameTime >= state.overfeedLockUntil) {
              state.hunger = Math.max(0, state.hunger - 1);
            }
          }
          if (state.gameTime - (state.lastStrTick || 0) >= cyc) {
            state.lastStrTick = state.gameTime;
            state.strength = Math.max(0, state.strength - 1);
          }
          if (state.gameTime - (state.lastPoopAt || 0) >= POOP_INTERVAL) {
            state.lastPoopAt = state.gameTime;
            state.poop = Math.min(8, (state.poop || 0) + 1);
            if (state.poop >= 8 && !state.injured) injure(state, 'poop');
          }
        }
        if (state.hunger <= 0) {
          markCall(state, 'hunger');
          if (!state.emptySince) state.emptySince = state.gameTime;
        }
        if (state.strength <= 0) markCall(state, 'strength');
        if (state.hunger > 0 && state.strength > 0) state.emptySince = null;

        // sleep
        var shouldSleep = m.stage !== 'baby1' && isSleepHours(state);
        if (shouldSleep && !state.sleeping) {
          state.sleeping = true;
          if (state.lights) markCall(state, 'lights');
        }
        if (!shouldSleep && state.sleeping) {
          state.sleeping = false;
          state.callLightsAt = null;
          // 8h sleep refills DP
          state.dp = state.dpMax || 4;
          state.hunger = Math.max(state.hunger, 2);
          state.strength = Math.max(state.strength, 2);
        }
        resolveCalls(state);

        if (state.injured && state.injuredAt && state.gameTime - state.injuredAt >= INJURY_DEATH) {
          die(state, '受傷未治療');
          died = true;
          break;
        }
        if (state.emptySince && state.gameTime - state.emptySince >= STARVE_DEATH && m.stage !== 'baby1' && m.stage !== 'egg') {
          die(state, '飢餓過久');
          died = true;
          break;
        }
        if (state.injuries >= MAX_INJURIES) {
          die(state, '受傷次數過多');
          died = true;
          break;
        }
      }
      if (tryEvolve(state)) evolved = true;

      // old age death for mega/super after lifespan * 1.5 if already checked
      m = mon(state);
      if (m && (m.stage === 'mega' || m.stage === 'super' || (m.stage === 'ultimate' && m.noMega) || (m.stage === 'champion' && timeInStage(state) / 60 > (m.lifespanMin || 0) * 1.8))) {
        if (timeInStage(state) / 60 > (m.lifespanMin || 96 * 60) * 1.6) {
          die(state, '壽終');
          died = true;
        }
      }
    }
    return { evolved: evolved, died: died };
  }

  function injure(state, why) {
    state.injured = true;
    state.injuredAt = state.gameTime;
    state.injuries += 1;
    pushEvent(state, 'injury', '受傷（' + why + '）');
  }

  function die(state, why) {
    state.dead = true;
    state.deadReason = why;
    state.sleeping = false;
    pushEvent(state, 'death', why);
  }

  function wakePenalty(state, action) {
    if (state.sleeping && (action === 'food' || action === 'train' || action === 'battle')) {
      state.sleeping = false;
      state.sleepDist += 1;
      state.callLightsAt = null;
      pushEvent(state, 'sleep', '睡眠打擾 +1');
      return true;
    }
    return false;
  }

  function feedMeat(state) {
    if (state.dead) return { ok: false, reason: 'dead' };
    var m = mon(state);
    if (!m || m.stage === 'egg') return { ok: false, reason: 'egg' };
    wakePenalty(state, 'food');
    var cap = 4;
    if (state.hunger >= cap) {
      // refuse → overfeed if lock expired
      if (state.gameTime >= (state.overfeedLockUntil || 0)) {
        state.overfeed += 1;
        state.overfeedLockUntil = state.gameTime + OVERFEED_LOCK;
        state.weight = Math.min(99, state.weight + 1);
        return { ok: true, overfeed: true, refused: true };
      }
      return { ok: false, reason: 'full' };
    }
    state.hunger = Math.min(cap, state.hunger + 1);
    state.weight = Math.min(99, state.weight + 1);
    if (state.hunger > 0) state.callHungerAt = null;
    if (state.hunger > 0 && state.strength > 0) state.emptySince = null;
    return { ok: true };
  }

  function feedProtein(state) {
    if (state.dead) return { ok: false, reason: 'dead' };
    var m = mon(state);
    if (!m || m.stage === 'egg') return { ok: false, reason: 'egg' };
    wakePenalty(state, 'food');
    state.strength = Math.min(4, state.strength + 1);
    if (state.strength > 0) state.callStrengthAt = null;
    if (state.hunger > 0 && state.strength > 0) state.emptySince = null;
    state._proteinBank = (state._proteinBank || 0) + 1;
    if (state._proteinBank >= 4) {
      state._proteinBank = 0;
      state.dp = Math.min(state.dpMax || 4, state.dp + 1);
    }
    return { ok: true };
  }

  function finishTraining(state, success, attempted) {
    if (state.dead) return { ok: false };
    var m = mon(state);
    if (!m || m.stage === 'egg' || m.stage === 'baby1' || m.stage === 'baby2') return { ok: false, reason: 'too-young' };
    wakePenalty(state, 'train');
    var countsAny = m.trainCounts === 'any' || Number(m.version) === 1;
    if (countsAny && attempted) state.train += 1;
    else if (!countsAny && success) state.train += 1;
    if (success) {
      state.strength = Math.min(4, state.strength + 1);
      state.weight = Math.max(m.weight || 5, state.weight - (Number(m.version) === 1 ? 1 : 2));
    } else if (attempted) {
      state.weight = Math.max(m.weight || 5, state.weight - 1);
    }
    if (state.strength > 0) state.callStrengthAt = null;
    return { ok: true, train: state.train };
  }

  function flush(state) {
    if (state.dead) return { ok: false };
    state.poop = 0;
    return { ok: true };
  }

  function toggleLights(state) {
    state.lights = !state.lights;
    if (!state.lights) state.callLightsAt = null;
    else if (state.sleeping) markCall(state, 'lights');
    return { lights: state.lights };
  }

  function heal(state) {
    if (state.dead) return { ok: false };
    if (!state.injured) return { ok: false, reason: 'healthy' };
    state.injured = false;
    state.injuredAt = null;
    return { ok: true };
  }

  function recordBattle(state, result) {
    // CPU and PvP both use this.
    if (state.dead) return;
    var m = mon(state);
    if (!m || !m.canBattle) return { ok: false, reason: 'cannot-battle' };
    if (state.dp <= 0) return { ok: false, reason: 'no-dp' };
    wakePenalty(state, 'battle');
    state.dp = Math.max(0, state.dp - 1);
    state.weight = Math.max(m.weight || 5, state.weight - (Number(m.version) === 1 ? 2 : 4));
    state.battles += 1;
    state.lifeBattles += 1;
    if (result === 'win') {
      state.wins += 1;
      state.lifeWins += 1;
    } else {
      state.losses += 1;
      state.lifeLosses += 1;
      injure(state, 'battle');
    }
    // even winners can be injured sometimes
    if (result === 'win' && Math.random() < 0.12) injure(state, 'battle');
    return { ok: true, result: result, battles: state.battles, wins: state.wins, wr: winRate(state.battles, state.wins) };
  }


  function tryJogress(state, partnerId) {
    if (state.dead) return { ok: false };
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
    return !!(m && m.canBattle && !state.dead && state.dp > 0);
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
      canBattle: !!(m.canBattle && !state.dead),
      tagWins: state.tagWins || 0,
      lifeSteps: (state.steps && state.steps.lifetime) || 0,
      steps: root.Steps ? root.Steps.todaySummary(state) : null
    };
  }

  function hatchIfEggSelect(state, version, randomize, special) {
    if (randomize) version = 1 + Math.floor(Math.random() * 5);
    var s = defaultState(version, special || null);
    s.speed = state && state.speed ? state.speed : 60;
    if (root.Steps && root.Steps.carryLedger) {
      root.Steps.carryLedger(state, s);
    }
    albumAdd(s, s.mon);
    return s;
  }

  root.Engine = {
    defaultState: defaultState,
    tick: tick,
    feedMeat: feedMeat,
    feedProtein: feedProtein,
    finishTraining: finishTraining,
    flush: flush,
    toggleLights: toggleLights,
    heal: heal,
    recordBattle: recordBattle,
    canBattle: canBattle,
    tryJogress: tryJogress,
    addTagWin: addTagWin,
    jogressPartners: jogressPartners,
    status: status,
    hatchIfEggSelect: hatchIfEggSelect,
    tryEvolve: tryEvolve,
    timeInStage: timeInStage,
    clockHour: clockHour,
    clockSeconds: clockSeconds,
    ageDays: ageDays,
    winRate: winRate,
    mon: mon
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
