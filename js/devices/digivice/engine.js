/**
 * 神聖計畫 / Digivice (1999) rules engine.
 * Own family — never calls 1997 / Pendulum / Pen20 formulas.
 * Sources: File Island Intro + Guide 1/2, Wikimon Toy + Version 1/2.
 * Unpublished numbers are PLACEHOLDER constants on DigiviceData.
 */
(function (root) {
  'use strict';

  function D() {
    return root.DigiviceData || (typeof require !== 'undefined' ? require('./data.js') : null);
  }

  function clamp(n, a, b) { return n < a ? a : (n > b ? b : n); }
  function nowMs(n) { return n || Date.now(); }
  function versionOf(eggKind) {
    return (String(eggKind || '') === 'dv1999_v2') ? 2 : 1;
  }

  function freshPartner(starter, gameTime) {
    var Da = D();
    var line = Da.lineOf(starter);
    var mon = line.chain[0]; // In-Training (or first form if noBaby)
    var idx = 0;
    var stage = Da.stageOfIndex(idx);
    var st = Da.statsFor(stage);
    return {
      starter: starter,
      mon: mon,
      index: idx,
      stage: stage,
      wins: 0,
      battles: 0,
      hp: st.hp,
      maxHp: st.hp,
      atk: st.atk,
      unhappy: false,
      injured: false,
      joinedAt: gameTime || 0
    };
  }

  function refreshStats(p) {
    var Da = D();
    var st = Da.statsFor(p.stage);
    p.maxHp = st.hp;
    p.atk = st.atk;
    if (p.hp == null || p.hp > p.maxHp) p.hp = p.maxHp;
    if (p.hp < 0) p.hp = 0;
    return p;
  }

  function defaultState(eggKind) {
    var ver = versionOf(eggKind);
    var Da = D();
    var areas = Da.areasFor(ver);
    return {
      family: 'digivice',
      deviceId: ver === 2 ? 'digivice-v2' : 'digivice-v1',
      eggKind: eggKind || 'dv1999_v1',
      version: ver,
      shell: ver === 2 ? 'digivice-v2' : 'digivice-v1',
      phase: 'pickPartner',   // pickPartner | setClock | play
      partnerPick: 0,
      clock: { h12: 12, min: 0, pm: false, field: 'h' },
      clockInitialized: false,
      clockSet: { on: false },
      gameTime: 0,
      lastReal: Date.now(),
      speed: 1,
      speedMigrated: true,
      clockOffset: 12 * 3600,
      totalSteps: 0,
      area: 0,
      areaRemaining: areas[0].steps,
      areasCleared: 0,
      stepsInArea: 0,
      nextEncounterAt: Da.ENCOUNTER_EVERY,
      party: [],
      active: 0,
      dp: Da.DP_START,
      items: { protein: 0, meat: 0, powerUp: 0 },
      nextBattleBuff: { protein: false, powerUp: false },
      help: {
        active: false,
        fill: 0,           // 0..1
        startedAt: 0,
        catchReady: false,
        areaUsed: {},      // area index → successful help
        target: null,      // starter id being rescued
        guardian: null
      },
      battle: null,
      encounter: null,     // pending optional fight {id, isBoss, optional}
      vsMode: null,
      mapClearSteps: null,
      v2RecruitUnlocked: false,
      recruited: {},       // mon id → true
      childEvolveAt: null,
      vdramonUnlocked: false,
      pendingHelpKind: null, // 'partner' | 'vdramon'
      soundMuted: false
    };
  }

  function migrateState(state) {
    if (!state || state.family !== 'digivice') return state;
    if (state.dp == null) state.dp = D().DP_START;
    if (!state.items) state.items = { protein: 0, meat: 0, powerUp: 0 };
    if (!state.nextBattleBuff) state.nextBattleBuff = { protein: false, powerUp: false };
    if (!state.help) {
      state.help = { active: false, fill: 0, startedAt: 0, catchReady: false,
        areaUsed: {}, target: null, guardian: null };
    }
    if (!state.recruited) state.recruited = {};
    if (state.areaRemaining == null) {
      var areas = D().areasFor(state.version);
      state.areaRemaining = areas[state.area || 0].steps;
    }
    return state;
  }

  function isClockSet(state) {
    // SET is handled inside the 1999 UI / this engine's own phase.
    // Returning false keeps the 1997 clock-SET path from intercepting.
    return false;
  }

  function active(state) {
    if (!state || !state.party || !state.party.length) return null;
    var i = state.active || 0;
    return state.party[i] || state.party[0];
  }

  function inParty(state, starter) {
    return !!(state.party && state.party.some(function (p) { return p.starter === starter; }));
  }

  function pickPartner(state, index) {
    var Da = D();
    var i = clamp(index | 0, 0, Da.STARTERS.length - 1);
    var starter = Da.STARTERS[i];
    state.partnerPick = i;
    state.party = [freshPartner(starter, state.gameTime || 0)];
    state.active = 0;
    state.recruited[starter] = true;
    state.childEvolveAt = (state.gameTime || 0) + Da.CHILD_EVOLVE_SEC;
    state.phase = 'setClock';
    state.clock = { h12: 12, min: 0, pm: false, field: 'h' };
    return state;
  }

  function confirmClock(state) {
    var c = state.clock || { h12: 12, min: 0, pm: false };
    var h24 = (c.h12 % 12) + (c.pm ? 12 : 0);
    if (c.h12 === 12 && !c.pm) h24 = 0;
    if (c.h12 === 12 && c.pm) h24 = 12;
    state.clockOffset = h24 * 3600 + (c.min || 0) * 60 - (state.gameTime || 0);
    state.clockInitialized = true;
    state.phase = 'play';
    return state;
  }

  function clockH24(state) {
    var t = ((state.gameTime || 0) + (state.clockOffset || 0)) % 86400;
    if (t < 0) t += 86400;
    return {
      h24: Math.floor(t / 3600),
      min: Math.floor((t % 3600) / 60),
      sec: Math.floor(t % 60)
    };
  }

  function canEvolve(p) {
    var Da = D();
    if (!p) return false;
    var line = Da.lineOf(p.starter);
    if (!line || line.noEvo) return false;
    if (p.index >= line.chain.length - 1) return false;
    if (p.stage === 'III') return (p.wins || 0) >= Da.CHILD_WINS_TO_ADULT;
    if (p.stage === 'IV') return (p.battles || 0) >= Da.ADULT_BATTLES_TO_PERFECT;
    return false;
  }

  function evolvePartner(state, p, opts) {
    var Da = D();
    opts = opts || {};
    if (!p) return false;
    var line = Da.lineOf(p.starter);
    if (!line || line.noEvo) return false;
    if (p.index >= line.chain.length - 1) return false;
    // Analyzer: unconditional (FI: V1 → Perfect, V2 → Adult).
    if (opts.analyzer) {
      var target = (state.version === 1) ? (line.chain.length - 1) : Math.min(2, line.chain.length - 1);
      // V1 Perfect = last of the 4-form chain (index 3). V2 Adult = index 2.
      // If already past the target, no-op.
      if (p.index >= target) return false;
      p.index = target;
    } else {
      if (!opts.force && !canEvolve(p)) return false;
      if (!opts.free) {
        if ((state.dp || 0) < Da.DP_EVOLVE_COST) return false;
        state.dp -= Da.DP_EVOLVE_COST;
      }
      p.index += 1;
    }
    p.mon = line.chain[p.index];
    p.stage = Da.stageOfIndex(p.index);
    // After a forced / threshold evo, reset the "next" counters so a further
    // evo needs a fresh 15 battles at Adult (the 15 is "after" becoming Adult).
    // Child wins already accumulated don't apply to Adult→Perfect (FI treats
    // them as separate). We keep career wins/battles for Status WIN display
    // but canEvolve for Adult uses battles — FI says "after 15 battles" at
    // Adult. If we kept the Child's battle count, a Child with 10 wins (and
    // some losses) might already be close. We snapshot battles-at-stage.
    p.stageBattles = 0;
    p.stageWins = 0;
    refreshStats(p);
    p.hp = p.maxHp;
    return true;
  }

  // Adult→Perfect uses battles fought *as Adult*, implemented via stageBattles.
  // canEvolve above uses career battles for Adult, which conflicts with a
  // fresh-stage reading. Re-read FI: "the Adult Digimon to Perfect after
  // 15 battles" — battles while Adult is the natural reading. Override:
  function _canEvolve(p) {
    var Da = D();
    if (!p) return false;
    var line = Da.lineOf(p.starter);
    if (!line || line.noEvo) return false;
    if (p.index >= line.chain.length - 1) return false;
    if (p.stage === 'III') return (p.wins || 0) >= Da.CHILD_WINS_TO_ADULT;
    if (p.stage === 'IV') return (p.stageBattles || 0) >= Da.ADULT_BATTLES_TO_PERFECT;
    return false;
  }
  canEvolve = _canEvolve;

  function maybeChildEvo(state) {
    if (!state || state.phase !== 'play') return;
    if (state.childEvolveAt == null) return;
    if ((state.gameTime || 0) < state.childEvolveAt) return;
    var p = state.party && state.party[0];
    if (!p || p.stage !== 'II') return;
    var Da = D();
    var line = Da.lineOf(p.starter);
    if (!line || line.chain.length < 2) return;
    p.index = 1;
    p.mon = line.chain[1];
    p.stage = 'III';
    p.wins = 0;
    p.battles = 0;
    p.stageBattles = 0;
    p.stageWins = 0;
    refreshStats(p);
    p.hp = p.maxHp;
    state.childEvolveAt = null;
  }

  function nextMissingStarter(state) {
    var Da = D();
    for (var i = 0; i < Da.STARTERS.length; i++) {
      if (!inParty(state, Da.STARTERS[i])) return Da.STARTERS[i];
    }
    return null;
  }

  function allSevenPerfect(state) {
    var Da = D();
    if (!state.party || state.party.length < 7) return false;
    // All 7 starters present and Perfect.
    for (var i = 0; i < Da.STARTERS.length; i++) {
      var found = null;
      for (var j = 0; j < state.party.length; j++) {
        if (state.party[j].starter === Da.STARTERS[i]) found = state.party[j];
      }
      if (!found || found.stage !== 'V') return false;
    }
    return true;
  }

  function mapComplete(state) {
    return (state.areasCleared || 0) >= 7;
  }

  function maybeUnlockVDramon(state) {
    // FI Guide 1: all seven Perfect AND complete the map, then HELP for V-Dramon.
    // FI Guide 2: Analyzer OR (all seven Perfect + map + HELP).
    if (!mapComplete(state) || !allSevenPerfect(state)) return false;
    if (inParty(state, 'vdramon') || state.recruited.vdramon) return false;
    state.vdramonUnlocked = true;
    return true;
  }

  /* ---------- steps (phone Steps + shake) ---------- */

  function applySteps(state, delta) {
    delta = Math.floor(delta || 0);
    if (!state || delta <= 0) return state;
    if (state.phase !== 'play') return state;
    if (state.battle) return state; // no walking mid-fight
    state.totalSteps = (state.totalSteps || 0) + delta;
    // Injured partners still walk (1999 untreated-skull death unpublished;
    // we do not stop the pedometer).
    if (mapComplete(state)) return state;
    state.areaRemaining = Math.max(0, (state.areaRemaining || 0) - delta);
    state.stepsInArea = (state.stepsInArea || 0) + delta;
    if (state.areaRemaining === 0 && !state.encounter && !state.battle) {
      var areas = D().areasFor(state.version);
      var a = areas[state.area || 0];
      state.encounter = { id: a.boss, isBoss: true, optional: false };
    } else if (!state.encounter && !state.help.active &&
               (state.stepsInArea || 0) >= (state.nextEncounterAt || D().ENCOUNTER_EVERY)) {
      var areas2 = D().areasFor(state.version);
      var a2 = areas2[state.area || 0];
      var list = a2.enemies;
      var id = list[Math.floor(Math.random() * list.length)];
      state.encounter = { id: id, isBoss: false, optional: true };
      state.nextEncounterAt = (state.stepsInArea || 0) + D().ENCOUNTER_EVERY;
    }
    return state;
  }

  function declineEncounter(state) {
    if (!state || !state.encounter) return state;
    if (!state.encounter.optional) return state; // boss is forced
    var p = active(state);
    if (p) p.unhappy = true; // FI: backing out of some fights makes them unhappy
    state.encounter = null;
    return state;
  }

  /* ---------- battle ---------- */

  function battleHpAtk(state, p) {
    var hp = p.maxHp, atk = p.atk;
    var buff = state.nextBattleBuff || {};
    if (buff.protein || buff.powerUp) hp = hp * 2;
    if (buff.powerUp) atk = atk * 2;
    return { hp: hp, atk: atk };
  }

  function startBattle(state, opts) {
    opts = opts || {};
    var Da = D();
    var p = active(state);
    if (!p || p.injured) return null;
    var enc = opts.encounter || state.encounter;
    if (!enc) return null;
    var est = Da.enemyStats(enc.id, !!enc.isBoss);
    var self = battleHpAtk(state, p);
    state.battle = {
      enemyId: enc.id,
      isBoss: !!enc.isBoss,
      optional: !!enc.optional,
      enemyHp: est.hp,
      enemyMaxHp: est.hp,
      enemyAtk: est.atk,
      selfHp: self.hp,
      selfMaxHp: self.hp,
      selfAtk: self.atk,
      attacks: 0,          // exchanges completed (max 3)
      evolvedThisRound: false,
      option: 'USE',
      phase: 'options',    // options | countdown | mash | exchange | result | quick
      countdown: Da.COUNTDOWN_BEATS,
      mash: 0,
      mashEndsAt: 0,
      playerFirst: true,
      result: null,        // 'win' | 'lose'
      exchanges: [],
      helpAfter: false
    };
    state.encounter = null;
    // Consumed at the start of the fight they apply to.
    state.nextBattleBuff = { protein: false, powerUp: false };
    return state.battle;
  }

  function setBattleOption(state, opt) {
    if (!state.battle || state.battle.phase !== 'options') return false;
    var allowed = D().BATTLE_OPTIONS;
    if (allowed.indexOf(opt) < 0) return false;
    if (opt === 'EVOLVE') {
      if (state.battle.evolvedThisRound) return false;
      if (!canEvolve(active(state))) return false;
      if ((state.dp || 0) < D().DP_EVOLVE_COST) return false;
    }
    if (opt === 'SWITCH') {
      if (!state.party || state.party.length < 2) return false;
    }
    state.battle.option = opt;
    return true;
  }

  function switchTo(state, index) {
    if (!state.battle) return false;
    if (!state.party || index < 0 || index >= state.party.length) return false;
    if (state.party[index].injured) return false;
    state.active = index;
    // "They will immediately be thrown into battle after being selected."
    var p = active(state);
    var self = battleHpAtk(state, p);
    // Fresh HP for the incoming mon (buffs already consumed at startBattle).
    state.battle.selfHp = self.hp;
    state.battle.selfMaxHp = self.hp;
    state.battle.selfAtk = self.atk;
    return true;
  }

  function tryBattleEvolve(state) {
    if (!state.battle) return false;
    if (state.battle.evolvedThisRound) return false;
    var p = active(state);
    if (!evolvePartner(state, p, {})) return false;
    state.battle.evolvedThisRound = true;
    // Stats update mid-fight (new form's HP/ATK). Keep remaining HP ratio.
    var ratio = state.battle.selfMaxHp ? (state.battle.selfHp / state.battle.selfMaxHp) : 1;
    var self = { hp: p.maxHp, atk: p.atk };
    // Protein / Power Up already applied at start; do not re-apply.
    state.battle.selfMaxHp = self.hp;
    state.battle.selfHp = Math.max(1, Math.round(self.hp * ratio));
    state.battle.selfAtk = self.atk;
    return true;
  }

  function resolveFirst(mashCount) {
    var Da = D();
    return (mashCount || 0) >= Da.MASH_THRESHOLD;
  }

  function runExchanges(state, playerFirst, maxAttacks) {
    var b = state.battle;
    var done = [];
    var remaining = (maxAttacks == null ? 3 : maxAttacks) - (b.attacks || 0);
    for (var i = 0; i < remaining; i++) {
      if (playerFirst) {
        b.enemyHp = Math.max(0, b.enemyHp - b.selfAtk);
        done.push({ who: 'player', dmg: b.selfAtk, enemyHp: b.enemyHp, selfHp: b.selfHp });
        if (b.enemyHp <= 0) { b.attacks += 1; break; }
        b.selfHp = Math.max(0, b.selfHp - b.enemyAtk);
        done.push({ who: 'enemy', dmg: b.enemyAtk, enemyHp: b.enemyHp, selfHp: b.selfHp });
      } else {
        b.selfHp = Math.max(0, b.selfHp - b.enemyAtk);
        done.push({ who: 'enemy', dmg: b.enemyAtk, enemyHp: b.enemyHp, selfHp: b.selfHp });
        if (b.selfHp <= 0) { b.attacks += 1; break; }
        b.enemyHp = Math.max(0, b.enemyHp - b.selfAtk);
        done.push({ who: 'player', dmg: b.selfAtk, enemyHp: b.enemyHp, selfHp: b.selfHp });
      }
      b.attacks += 1;
      if (b.selfHp <= 0 || b.enemyHp <= 0) break;
    }
    b.exchanges = (b.exchanges || []).concat(done);
    if (b.enemyHp <= 0) b.result = 'win';
    else if (b.selfHp <= 0) b.result = 'lose';
    else if (b.attacks >= 3) {
      // 3 attacks done, both still standing: higher remaining HP wins;
      // tie goes to the player. PLACEHOLDER outcome for the "3 attacks
      // and battle ends" case when HP is not 0 (FI: "After 3 attacks, or
      // when someone's Hit Points go down to zero — the battle is over
      // (you lost if a skull appears)").
      b.result = (b.selfHp >= b.enemyHp) ? 'win' : 'lose';
    }
    return b.result;
  }

  function finishBattle(state) {
    var b = state.battle;
    if (!b || !b.result) return state;
    var p = active(state);
    var Da = D();
    if (p) {
      p.battles = (p.battles || 0) + 1;
      p.stageBattles = (p.stageBattles || 0) + 1;
      if (b.result === 'win') {
        p.wins = (p.wins || 0) + 1;
        p.stageWins = (p.stageWins || 0) + 1;
        state.dp = (state.dp || 0) + Da.DP_PER_WIN;
        // PLACEHOLDER item-drop rate: 1/4, uniform among the three items.
        if (Math.random() < 0.25) {
          var k = ['protein', 'meat', 'powerUp'][Math.floor(Math.random() * 3)];
          state.items[k] = (state.items[k] || 0) + 1;
          b.dropped = k;
        }
        if (b.isBoss) clearArea(state);
        // HELP-wave recruit victory (guardian fight).
        if (b.helpRecruit && b.helpTarget) {
          joinPartner(state, b.helpTarget);
          state.help.areaUsed[state.area] = true;
          state.help.active = false;
          state.help.catchReady = false;
          state.help.target = null;
        }
        // Ver.2 post-clear recruit "upon victory".
        if (state.v2RecruitUnlocked && Da.V2_RECRUIT_IDS.indexOf(b.enemyId) >= 0) {
          joinSpecial(state, b.enemyId);
        }
        maybeUnlockVDramon(state);
      } else {
        // Skull = loss. FI: treat with Medical Kit.
        p.injured = true;
      }
    }
    // HELP may appear after battles (FI).
    if (b.result === 'win') maybeStartHelp(state, 'battle');
    b.phase = 'result';
    return state;
  }

  function confirmUse(state, mashCount) {
    if (!state.battle) return null;
    var b = state.battle;
    if (b.option === 'QUICK') {
      // Skip animation, show result. No mash (FI: "the fight happens
      // without any animation and then the results are announced").
      // First-strike PLACEHOLDER: even chance without mash.
      b.playerFirst = Math.random() < 0.5;
      b.phase = 'quick';
      runExchanges(state, b.playerFirst, 3);
      finishBattle(state);
      return b.result;
    }
    if (b.option === 'EVOLVE') {
      tryBattleEvolve(state);
      // After evolving, they still fight this round (once-per-round evo).
    }
    b.playerFirst = resolveFirst(mashCount || b.mash || 0);
    b.phase = 'exchange';
    runExchanges(state, b.playerFirst, 3);
    finishBattle(state);
    return b.result;
  }

  function clearArea(state) {
    var Da = D();
    var areas = Da.areasFor(state.version);
    state.areasCleared = (state.areasCleared || 0) + 1;
    if (state.areasCleared >= 7) {
      state.mapClearSteps = state.totalSteps;
      if (state.version === 2 && state.totalSteps <= Da.V2_RECRUIT_MAX_STEPS) {
        state.v2RecruitUnlocked = true;
      }
      maybeUnlockVDramon(state);
      return;
    }
    state.area = state.areasCleared;
    state.areaRemaining = areas[state.area].steps;
    state.stepsInArea = 0;
    state.nextEncounterAt = Da.ENCOUNTER_EVERY;
  }

  function dismissBattle(state) {
    if (state) state.battle = null;
    return state;
  }

  /* ---------- party / HELP / medical / items / analyzer ---------- */

  function joinPartner(state, starter) {
    if (inParty(state, starter)) return false;
    var p = freshPartner(starter, state.gameTime || 0);
    // Recruits join at Child (FI starts In-Training only for the chosen
    // partner, who "evolve into Child shortly"). PLACEHOLDER stage for
    // rescued partners: Child, already past "shortly".
    var Da = D();
    var line = Da.lineOf(starter);
    if (line && line.chain.length >= 2 && !line.noBaby) {
      p.index = 1;
      p.mon = line.chain[1];
      p.stage = 'III';
      refreshStats(p);
      p.hp = p.maxHp;
    }
    state.party.push(p);
    state.recruited[starter] = true;
    return true;
  }

  function joinSpecial(state, id) {
    if (inParty(state, id) || state.recruited[id]) return false;
    var Da = D();
    var line = Da.lineOf(id);
    if (!line) {
      // Treat unknown as a no-evo single form whose starter id is the mon id.
      line = { chain: [id], noEvo: true };
    }
    var st = Da.enemyStats(id, true);
    var stage = st.stage || 'IV';
    var idx = (stage === 'V') ? 0 : 0;
    var p = {
      starter: id,
      mon: line.chain[0],
      index: 0,
      stage: stage,
      wins: 0, battles: 0, stageBattles: 0, stageWins: 0,
      hp: st.hp, maxHp: st.hp, atk: st.atk,
      unhappy: false, injured: false,
      joinedAt: state.gameTime || 0,
      noEvo: true
    };
    // Tailmon has a published evo chain.
    if (id === 'tailmon') {
      p.stage = 'IV';
      p.index = 0;
      p.noEvo = false;
      refreshStats(p);
      p.hp = p.maxHp;
    }
    state.party.push(p);
    state.recruited[id] = true;
    return true;
  }

  function maybeStartHelp(state, reason) {
    var Da = D();
    if (!state || state.phase !== 'play') return false;
    if (state.help && state.help.active) return false;
    if (state.help.areaUsed[state.area]) return false; // Ver.1 one successful / area; we also skip if already used
    // A target: missing starter, or V-Dramon if unlocked.
    var target = nextMissingStarter(state);
    var kind = 'partner';
    if (!target && state.vdramonUnlocked && !inParty(state, 'vdramon')) {
      target = 'vdramon';
      kind = 'vdramon';
    }
    if (!target) return false;
    if (Math.random() >= Da.HELP_CHANCE) return false;
    var areas = Da.areasFor(state.version);
    var a = areas[state.area || 0];
    var guardian = a.enemies[Math.floor(Math.random() * a.enemies.length)];
    state.help = {
      active: true,
      fill: 0,
      startedAt: state.gameTime || 0,
      catchReady: false,
      areaUsed: state.help.areaUsed || {},
      target: target,
      guardian: guardian,
      kind: kind
    };
    return true;
  }

  function tickHelp(state, dt) {
    var Da = D();
    var h = state.help;
    if (!h || !h.active) return;
    var elapsed = (state.gameTime || 0) - (h.startedAt || 0);
    if (elapsed > Da.HELP_WINDOW_SEC) {
      // Window expired; may re-encounter later (FI).
      h.active = false;
      h.catchReady = false;
      return;
    }
    // COMPROMISE: the real device fills the signal bar by holding the
    // black antenna near a current-radiating source (Wikimon V1). The
    // app has no antenna; fill progresses with elapsed time (full at
    // half the 3-minute window) and is boosted by shakes (applyHelpShake).
    var auto = Math.min(1, elapsed / (Da.HELP_WINDOW_SEC / 2));
    h.fill = Math.max(h.fill || 0, auto);
    if (h.fill >= 1) h.catchReady = true;
  }

  function applyHelpShake(state, n) {
    var h = state.help;
    if (!h || !h.active) return;
    // PLACEHOLDER fill-per-shake (antenna substitute).
    h.fill = Math.min(1, (h.fill || 0) + 0.08 * (n || 1));
    if (h.fill >= 1) h.catchReady = true;
  }

  function catchHelp(state) {
    var h = state.help;
    if (!h || !h.active || !h.catchReady) return false;
    // Fight the guardian; winning joins the target.
    state.encounter = {
      id: h.guardian,
      isBoss: false,
      optional: false,
      helpRecruit: true,
      helpTarget: h.target
    };
    var b = startBattle(state, { encounter: state.encounter });
    if (b) {
      b.helpRecruit = true;
      b.helpTarget = h.target;
    }
    return !!b;
  }

  function treatMedical(state) {
    if (!state.party) return false;
    var any = false;
    for (var i = 0; i < state.party.length; i++) {
      if (state.party[i].injured) {
        state.party[i].injured = false;
        any = true;
      }
    }
    return any;
  }

  function useItem(state, kind) {
    if (!state.items || !state.items[kind]) return false;
    if (kind === 'meat') {
      // FI: no effect ever noticed. Consume, do nothing.
      state.items.meat -= 1;
      return true;
    }
    if (kind === 'protein') {
      state.items.protein -= 1;
      state.nextBattleBuff.protein = true;
      return true;
    }
    if (kind === 'powerUp') {
      state.items.powerUp -= 1;
      state.nextBattleBuff.powerUp = true;
      return true;
    }
    return false;
  }

  function connectAnalyzer(state) {
    // FI: Analyzer evolves Perfect (V1) or Adult (V2) unconditionally.
    var p = active(state);
    if (!p) return false;
    return evolvePartner(state, p, { analyzer: true });
  }

  /* ---------- tick ---------- */

  function tick(state, realNow) {
    if (!state || state.family !== 'digivice') return { ok: false };
    migrateState(state);
    realNow = nowMs(realNow);
    var dtReal = Math.max(0, (realNow - (state.lastReal || realNow)) / 1000);
    state.lastReal = realNow;
    var dt = dtReal * (state.speed || 1);
    // v32: no cap. The Holy Project Digivice has no care meters or death;
    // its only passive timers (Child evolution, help-signal window) are
    // absolute game-time checks, so one long step equals running open.
    state.gameTime = Math.round(((state.gameTime || 0) + dt) * 1e6) / 1e6;
    maybeChildEvo(state);
    tickHelp(state, dt);
    return { ok: true };
  }

  function noteShake(state, n) {
    n = n || 1;
    // Official: walk OR shake decrements the area counter (FI / Wikimon).
    applySteps(state, n);
    if (state.help && state.help.active) applyHelpShake(state, n);
    else maybeStartHelp(state, 'shake');
    return state;
  }

  var api = {
    defaultState: defaultState,
    migrateState: migrateState,
    isClockSet: isClockSet,
    tick: tick,
    active: active,
    pickPartner: pickPartner,
    confirmClock: confirmClock,
    clockH24: clockH24,
    canEvolve: canEvolve,
    evolvePartner: evolvePartner,
    applySteps: applySteps,
    declineEncounter: declineEncounter,
    startBattle: startBattle,
    setBattleOption: setBattleOption,
    switchTo: switchTo,
    tryBattleEvolve: tryBattleEvolve,
    confirmUse: confirmUse,
    resolveFirst: resolveFirst,
    finishBattle: finishBattle,
    dismissBattle: dismissBattle,
    joinPartner: joinPartner,
    joinSpecial: joinSpecial,
    maybeStartHelp: maybeStartHelp,
    catchHelp: catchHelp,
    applyHelpShake: applyHelpShake,
    treatMedical: treatMedical,
    useItem: useItem,
    connectAnalyzer: connectAnalyzer,
    noteShake: noteShake,
    nextMissingStarter: nextMissingStarter,
    allSevenPerfect: allSevenPerfect,
    mapComplete: mapComplete,
    maybeUnlockVDramon: maybeUnlockVDramon,
    freshPartner: freshPartner,
    refreshStats: refreshStats,
    inParty: inParty,
    versionOf: versionOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DigiviceEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
