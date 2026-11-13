/**
 * Pendulum Ver.20th (新超代) rules engine.
 * Sources: Humulos Pen20 manual + evo guide (2026-11-13).
 * Own two-pet / freeze / Effort / DP / Power / Colosseum / Copymon logic.
 * Does not call PendulumEngine or the 1997 Engine formulas.
 */
(function (root) {
  'use strict';

  function D() { return root.Pen20Data || (typeof require !== 'undefined' ? require('./data.js') : null); }

  var MAX_SPEED = 64;
  var HEARTS = 4;

  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function nowMs(n) { return n || Date.now(); }
  function cwOf(eggKind) {
    var m = String(eggKind || 'pen_20th_sk').match(/pen_20th_(sk|sb|dc|bc)/);
    return m ? m[1] : 'sk';
  }
  function data() { return D(); }

  function emptyPet() {
    return {
      mon: null,
      eggId: null,
      level: 'egg',
      hunger: 0, hungerCap: HEARTS,
      strength: 0, strengthCap: HEARTS,
      effortQ: 0,           // quarters; 4 = 1 heart, max 16
      dpQ: 0, dpMaxQ: 0,    // quarters of DP
      weight: 5,
      cm: 0,
      sickCount: 0, injuryCount: 0,
      sick: false, injured: false,
      sickSince: 0, injuredSince: 0,
      battles: 0, wins: 0, losses: 0,
      last15: [],            // booleans, most-recent last
      sleeping: false, tired: false, frozen: false,
      putToBed: false,
      freezeStartedGame: 0, freezeDpGranted: false,
      poop: 0,
      stageEnteredGame: 0,
      evoDueAt: 0,           // gameTime hours
      calling: false, callKind: null, callStartedGame: 0,
      dying: false, dieStartedGame: 0, shakeSaved: false,
      dead: false, traited: false, traitedNext: false,
      ageDays: 0,
      lifeGame: 0
    };
  }

  function applyMon(pet, monId, gameTime, asEgg) {
    var Da = data();
    var m = Da.monster(monId);
    pet.mon = monId;
    pet.level = (m && m.level) || (asEgg ? 'egg' : 'I');
    pet.dpMaxQ = Math.round((Da.dpMaxForLevel(pet.level) || 0) * 4);
    if (pet.level === 'I' || pet.level === 'II' || pet.level === 'egg') pet.dpMaxQ = 0;
    pet.dpQ = pet.dpMaxQ; // new form starts full (not contradicted)
    pet.cm = 0;           // Humulos: CM resets each evolution
    pet.sickCount = 0; pet.injuryCount = 0;
    pet.sick = false; pet.injured = false;
    pet.dying = false;
    pet.stageEnteredGame = gameTime || 0;
    var hrs = Da.hourForStage(pet.level === 'egg' ? 'egg' : pet.level);
    pet.evoDueAt = hrs == null ? Infinity : (gameTime || 0) / 3600 + hrs;
    if (pet.level === 'I') {
      // Stage I: "literally nothing you do during this stage matters"
      pet.cm = 0;
    }
    return pet;
  }

  function defaultState(eggKind) {
    var cw = cwOf(eggKind);
    var Da = data();
    var meta = Da.COLORWAYS[cw] || Da.COLORWAYS.sk;
    var eggId = meta.defaultEgg;
    var st = {
      family: 'pen20',
      deviceId: meta.id,
      version: cw,
      eggKind: eggKind || meta.eggKind,
      colorway: cw,
      clockInitialized: false,
      clockSet: { on: false, h24: 12, min: 0 },
      clockOffset: 12 * 3600,
      clock24h: false,
      gameTime: 0,
      lastReal: Date.now(),
      speed: 1,
      muted: false,
      twoPetUnlocked: false,
      display: 'pet0',     // pet0 | pet1 | both | egg | computer
      active: 0,
      pets: [emptyPet(), null],
      pendingEgg: false,   // second slot available to pick
      unlockedEggs: [eggId],
      album: [],
      copymon: [],         // {id, from}
      passwordsUsed: [],
      recordWins: 0,
      recordBattles: 0,
      coloSingle: 1, coloTag: 1,   // next round (1-100), 101 = cleared
      coloClearedSingle: false, coloClearedTag: false,
      champion: false,
      lightsMenu: false,
      trash: 0,            // shared piles? Humulos: both poop on the screen — shared piles
      deadComputer: false,
      traitedWaiting: [false, false],
      screenOff: false,
      idleSince: 0
    };
    // First egg already "on screen", will hatch after 1 minute once clock is set.
    var p = emptyPet();
    p.eggId = eggId;
    p.mon = 'egg';
    p.level = 'egg';
    p.stageEnteredGame = 0;
    p.evoDueAt = 1 / 60;
    st.pets[0] = p;
    return st;
  }

  function visiblePets(state) {
    var out = [];
    if (state.display === 'both') {
      if (state.pets[0] && !state.pets[0].dead && state.pets[0].mon) out.push(0);
      if (state.pets[1] && !state.pets[1].dead && state.pets[1].mon) out.push(1);
    } else if (state.display === 'pet1') {
      if (state.pets[1] && state.pets[1].mon) out.push(1);
    } else if (state.display === 'pet0' || state.display === 'play') {
      if (state.pets[0] && state.pets[0].mon) out.push(0);
    }
    return out;
  }

  function activePet(state) {
    var i = state.active === 1 ? 1 : 0;
    if (state.pets[i] && state.pets[i].mon && !state.pets[i].dead) return state.pets[i];
    if (state.pets[0] && state.pets[0].mon) return state.pets[0];
    return state.pets[1];
  }

  function mon(state) {
    var p = activePet(state);
    return p && p.mon !== 'egg' ? p.mon : (p ? 'egg' : null);
  }

  function effortHearts(pet) { return Math.floor((pet.effortQ || 0) / 4); }

  function winsInLast15(pet) {
    var a = pet.last15 || [];
    var n = 0;
    for (var i = 0; i < a.length; i++) if (a[i]) n++;
    return n;
  }

  function recordBattle(state, pet, won) {
    pet.battles = (pet.battles || 0) + 1;
    if (won) pet.wins = (pet.wins || 0) + 1;
    else pet.losses = (pet.losses || 0) + 1;
    pet.last15 = (pet.last15 || []).concat([!!won]);
    if (pet.last15.length > 15) pet.last15 = pet.last15.slice(-15);
    state.recordBattles = Math.min(999, (state.recordBattles || 0) + 1);
    if (won) state.recordWins = Math.min(999, (state.recordWins || 0) + 1);
    if (state.recordWins >= 999) state.champion = true;
    maybeUnlock(state);
  }

  function albumAdd(state, id) {
    if (!id || id === 'egg') return;
    if (!state.album) state.album = [];
    if (state.album.indexOf(id) < 0) {
      state.album.push(id);
      maybeUnlock(state);
    }
  }

  function colorwayMatches(onVersions, cw) {
    if (!onVersions) return true;
    var s = onVersions.toLowerCase();
    if (s.indexOf('all colors') >= 0) return true;
    var map = { sk: 'silver black', sb: 'silver blue', dc: 'dukemon', bc: 'beelzebumon' };
    var needle = map[cw] || cw;
    // "Silver Black and Beelzebumon Color" — match either name
    // "Silver Black" alone — exact-ish
    if (s.indexOf(needle) >= 0) return true;
    return false;
  }

  function maybeUnlock(state) {
    var Da = data();
    var cw = state.colorway;
    var albumN = (state.album || []).length;
    Object.keys(Da.EGGS).forEach(function (eid) {
      var e = Da.EGGS[eid];
      if ((state.unlockedEggs || []).indexOf(eid) >= 0) return;
      if (!colorwayMatches(e.onVersions, cw)) return;
      var r = e.rule || {};
      var ok = false;
      if (r.when === 'default') ok = true;
      else if (r.when === 'child' && state.twoPetUnlocked) ok = true;
      else if (r.when === 'album' && albumN >= (r.count || 0)) ok = true;
      else if (r.when === 'single100' && state.coloClearedSingle) ok = true;
      else if (r.when === 'tag100' && state.coloClearedTag) ok = true;
      else if (r.when === 'wins100' && (state.recordWins || 0) >= 100) ok = true;
      // crossColorBattle: unlocked when we win a link battle vs the other colour group — flagged externally
      else if (r.when === 'crossColorBattle' && state._wonCrossColor) ok = true;
      if (ok) state.unlockedEggs.push(eid);
    });
  }

  function reqNaturalMet(req, pet) {
    if (!req || req.any) return true;
    if (req.jogress || req.password) return false;
    if (req.cm) {
      var c = pet.cm || 0;
      if (c < req.cm[0]) return false;
      if (req.cm[1] != null && c > req.cm[1]) return false;
    }
    if (req.effort) {
      var e = effortHearts(pet);
      if (e < req.effort[0]) return false;
      if (req.effort[1] != null && e > req.effort[1]) return false;
    }
    if (req.battles) {
      if ((pet.battles || 0) < req.battles[0]) return false;
    }
    if (req.victories && !req.victoriesStar) {
      var w = winsInLast15(pet);
      if (w < req.victories[0]) return false;
      if (req.victories[1] != null && w > req.victories[1]) return false;
    }
    return true;
  }

  function wrRoll(pet, rng) {
    var Da = data();
    var chance = Da.wrChance(winsInLast15(pet));
    if (chance >= 1) return true;
    if (chance <= 0) return false;
    var r = (rng || Math.random)();
    return r < chance;
  }

  function tryEvolvePet(state, pi, rng) {
    var Da = data();
    var pet = state.pets[pi];
    if (!pet || pet.dead || pet.frozen || pet.dying) return null;
    var hours = (state.gameTime - (pet.stageEnteredGame || 0)) / 3600;
    if (pet.level === 'egg') {
      if (!state.clockInitialized) return null;
      if (hours + 1e-9 >= (Da.STAGE_HOURS.egg)) {
        var baby = Da.baby1ForEgg(pet.eggId);
        applyMon(pet, baby, state.gameTime);
        albumAdd(state, baby);
        pet.hunger = 0; // "immediately beep... STARVING"
        pet.calling = true; pet.callKind = 'hunger'; pet.callStartedGame = state.gameTime;
        return { from: 'egg', to: baby };
      }
      return null;
    }
    var due = Da.hourForStage(pet.level);
    if (due == null) return null;
    if (hours + 1e-9 < due) return null;
    var m = Da.monster(pet.mon);
    if (!m || !m.evos || !m.evos.length) return null;

    if (pet.level === 'I') {
      // nothing matters; take the only natural evo
      var t = m.evos[0].to;
      applyMon(pet, t, state.gameTime);
      albumAdd(state, t);
      return { from: m.id, to: t };
    }

    // Natural candidates (non-jogress)
    var natural = m.evos.filter(function (ev) { return ev.req && !ev.req.jogress && !ev.req.password; });
    var picked = null;
    var wrNeeded = false;
    for (var i = 0; i < natural.length; i++) {
      var ev = natural[i];
      if (!reqNaturalMet(ev.req, pet)) continue;
      if (ev.req.victoriesStar) {
        wrNeeded = true;
        if (!wrRoll(pet, rng)) continue;
        // traited-egg bonus: exact amount unpublished — flag only, no invented %
      }
      picked = ev;
      break;
    }
    if (!picked) return null;
    var from = pet.mon;
    applyMon(pet, picked.to, state.gameTime);
    albumAdd(state, picked.to);
    // Stage III unlocks two-pet
    var nm = Da.monster(picked.to);
    if (nm && nm.level === 'III' && !state.twoPetUnlocked) {
      state.twoPetUnlocked = true;
      state.pendingEgg = true;
      maybeUnlock(state);
    }
    return { from: from, to: picked.to, wr: wrNeeded };
  }

  function clockH(state) {
    var t = ((state.clockOffset || 0) + (state.gameTime || 0)) % 86400;
    if (t < 0) t += 86400;
    return Math.floor(t / 3600);
  }

  function sleepHour(pet) {
    var Da = data();
    var m = Da.monster(pet.mon);
    var s = m && m.sleep;
    if (!s || s === 'NA') return null;
    var mh = String(s).match(/(\d{1,2})/);
    return mh ? parseInt(mh[1], 10) : 21;
  }

  function tickPet(state, pet, dt, pi) {
    if (!pet || pet.dead || !pet.mon) return;
    if (pet.level === 'egg') {
      tryEvolvePet(state, pi);
      return;
    }
    var Da = data();
    pet.lifeGame = (pet.lifeGame || 0) + dt;
    pet.ageDays = Math.floor(pet.lifeGame / 86400);

    if (pet.frozen) {
      // no growth, no hunger, no poop. DP after 3 hours.
      if (!pet.freezeDpGranted && (state.gameTime - (pet.freezeStartedGame || 0)) >= Da.FREEZE_DP_HOURS * 3600) {
        pet.dpQ = pet.dpMaxQ;
        pet.freezeDpGranted = true;
      }
      return;
    }

    // Hunger / strength empty — PLACEHOLDER interval.
    // Official: a pet put to bed does not lose hunger/strength or call.
    if (!pet.sleeping) {
      var cycle = (Da.HUNGER_CYCLE_MIN.min || 60) * 60;
      pet._hAcc = (pet._hAcc || 0) + dt;
      while (pet._hAcc >= cycle) {
        pet._hAcc -= cycle;
        if (pet.level !== 'egg') {
          if (pet.hunger > 0) pet.hunger--;
          if (pet.strength > 0) pet.strength--;
          if (pet.hunger === 0 && !pet.calling) {
            pet.calling = true; pet.callKind = 'hunger'; pet.callStartedGame = state.gameTime;
          } else if (pet.strength === 0 && !pet.calling) {
            pet.calling = true; pet.callKind = 'strength'; pet.callStartedGame = state.gameTime;
          }
        }
      }
    }

    // Poop — PLACEHOLDER interval, official 4 piles → sick
    var pc = (Da.POOP_CYCLE_MIN.min || 180) * 60;
    pet._pAcc = (pet._pAcc || 0) + dt;
    while (pet._pAcc >= pc) {
      pet._pAcc -= pc;
      if (pet.level !== 'egg' && pet.level !== 'I') {
        state.trash = (state.trash || 0) + 1;
        if (state.trash >= Da.POOP_SICK_AT && !pet.sick) becomeSick(state, pet);
      }
    }

    // Tired at bedtime (uses SET clock; SET does not speed growth)
    var bed = sleepHour(pet);
    var h = clockH(state);
    var wakeH = pet.putToBed ? Da.WAKE.ifPutToBed : Da.WAKE.ifNot;
    if (!pet.sleeping && !pet.tired && bed != null && h === bed) {
      pet.tired = true;
      pet.calling = true; pet.callKind = 'tired'; pet.callStartedGame = state.gameTime;
    }
    if (pet.sleeping && h === wakeH) {
      pet.sleeping = false;
      pet.tired = false;
      pet.putToBed = false;
      pet.dpQ = pet.dpMaxQ; // "full nights sleep" restores DP
    }

    // Call timeout → care mistake (Stage I does not track CM — "begins to matter" at II)
    if (pet.calling) {
      var limit = pet.callKind === 'tired' ? Da.CALL.tiredMin : Da.CALL.emptyMeterMin;
      if ((state.gameTime - pet.callStartedGame) >= limit * 60) {
        pet.calling = false;
        if (pet.level !== 'I' && pet.level !== 'egg') {
          pet.cm = (pet.cm || 0) + 1;
          checkDeath(state, pet, pi);
        }
      }
    }

    // Untreated sick/injury 6h
    if ((pet.sick || pet.injured)) {
      var since = pet.sick ? pet.sickSince : pet.injuredSince;
      if (since && (state.gameTime - since) >= Da.DEATH.untreatedHours * 3600) {
        beginDying(state, pet, pi);
      }
    }

    // Traited: alive 48h after last evo
    if (!pet.traitedNext && (state.gameTime - pet.stageEnteredGame) >= Da.TRAITED_AFTER_H * 3600) {
      pet.traitedNext = true;
    }

    tryEvolvePet(state, pi);
    checkDeath(state, pet, pi);
  }

  function becomeSick(state, pet) {
    if (pet.sick) return;
    pet.sick = true;
    pet.sickSince = state.gameTime;
    pet.sickCount = (pet.sickCount || 0) + 1;
  }
  function becomeInjured(state, pet) {
    if (pet.injured) return;
    pet.injured = true;
    pet.injuredSince = state.gameTime;
    pet.injuryCount = (pet.injuryCount || 0) + 1;
  }

  function beginDying(state, pet, pi) {
    if (pet.dying || pet.dead) return;
    pet.dying = true;
    pet.dieStartedGame = state.gameTime;
    pet.calling = false;
  }

  function checkDeath(state, pet, pi) {
    var Da = data();
    if (pet.dead || pet.dying) return;
    // After a successful shake-save, the same counters do not immediately
    // restart the 1-minute cry (Humulos: "you very well could save it").
    var g = pet.deathSavedAt;
    if (g) {
      var same = ((pet.sickCount || 0) <= (g.sick || 0)) &&
                 ((pet.injuryCount || 0) <= (g.injury || 0)) &&
                 ((pet.cm || 0) <= (g.cm || 0));
      if (same) return;
    }
    if ((pet.sickCount || 0) >= Da.DEATH.sick) return beginDying(state, pet, pi);
    if ((pet.injuryCount || 0) >= Da.DEATH.injury) return beginDying(state, pet, pi);
    if ((pet.cm || 0) >= Da.DEATH.cm) return beginDying(state, pet, pi);
    // "5 care mistakes after the evolution period for stages V or VI"
    var due = data().hourForStage(pet.level);
    if (due != null && (pet.level === 'V' || pet.level === 'VI')) {
      var hours = (state.gameTime - pet.stageEnteredGame) / 3600;
      if (hours >= due && (pet.cm || 0) >= Da.DEATH.cmAfterEvoWindow) return beginDying(state, pet, pi);
    }
  }

  function finishDeath(state, pet, pi) {
    pet.dead = true;
    pet.dying = false;
    pet.mon = 'computer';
    pet.level = 'dead';
    state.deadComputer = true;
    if (pet.traitedNext) state.traitedWaiting[pi] = true;
    // free the slot after C isolate + A+B (pending handled by UI)
  }

  function tickDying(state, pet, pi, dt) {
    if (!pet.dying) return;
    if (pet.shakeSaved) {
      // Shake during the cry window saves immediately (does not wait out the minute).
      pet.dying = false;
      pet.shakeSaved = false;
      pet.deathSavedAt = {
        sick: pet.sickCount || 0,
        injury: pet.injuryCount || 0,
        cm: pet.cm || 0
      };
      return;
    }
    if ((state.gameTime - pet.dieStartedGame) >= data().DEATH.shakeSaveSeconds) {
      finishDeath(state, pet, pi);
    }
  }

  function tick(state, now) {
    now = nowMs(now);
    migrateState(state);
    if (!state.clockInitialized) {
      state.lastReal = now;
      return state;
    }
    if (state.clockSet && state.clockSet.on) {
      state.lastReal = now; // SET does not advance growth (Humulos)
      return state;
    }
    var speed = clamp(state.speed || 1, 1, MAX_SPEED);
    var elapsed = Math.max(0, (now - (state.lastReal || now)) / 1000) * speed;
    state.lastReal = now;
    // Process in chunks so 6h death etc. fire correctly
    var left = elapsed;
    while (left > 0) {
      var step = Math.min(left, 60); // 1-minute chunks
      state.gameTime += step;
      for (var i = 0; i < 2; i++) {
        var pet = state.pets[i];
        if (!pet) continue;
        if (pet.dying) tickDying(state, pet, i, step);
        else tickPet(state, pet, step, i);
      }
      left -= step;
    }
    return state;
  }

  function feed(state, kind) {
    var idxs = visiblePets(state);
    if (!idxs.length) {
      var ap = activePet(state);
      if (ap) idxs = [state.pets[0] === ap ? 0 : 1];
    }
    var both = idxs.length >= 2;
    var hearts = both ? 2 : 1; // Humulos: feeding both at once doubles hearts
    var any = false;
    idxs.forEach(function (i) {
      var pet = state.pets[i];
      if (!pet || pet.dead || pet.frozen || pet.sleeping || pet.level === 'egg') return;
      if (kind === 'protein') {
        pet.strength = clamp(pet.strength + hearts, 0, HEARTS);
        pet.weight = (pet.weight || 0) + 2;
        pet.dpQ = clamp((pet.dpQ || 0) + 1, 0, pet.dpMaxQ); // +0.25 DP
      } else {
        pet.hunger = clamp(pet.hunger + hearts, 0, HEARTS);
        pet.weight = (pet.weight || 0) + 1;
      }
      if (pet.weight >= 99) becomeSick(state, pet);
      if (pet.calling && (kind !== 'protein' ? pet.hunger > 0 : pet.strength > 0)) {
        if (pet.callKind !== 'tired') pet.calling = false;
      }
      any = true;
    });
    return { ok: any, both: both, hearts: hearts };
  }

  function train(state, result) {
    // result: 'fail' | 'success' | 'megahit' | 'gigahit'
    // Effort 0.25 even on fail. −1g always. Success +1 strength. Megahit fills strength −8g.
    var pet = activePet(state);
    if (!pet || pet.dead || pet.frozen || pet.sleeping || pet.level === 'egg') return { ok: false };
    pet.effortQ = clamp((pet.effortQ || 0) + 1, 0, 16);
    pet.weight = Math.max(1, (pet.weight || 0) - 1);
    if (result === 'megahit' || result === 'gigahit') {
      pet.strength = HEARTS;
      pet.weight = Math.max(1, pet.weight - 7); // additional to the −1, total −8 (Humulos megahit −8)
      // Gigahit "really reduces weight" — extra amount unpublished; apply megahit −8 only, labelled
    } else if (result === 'success') {
      pet.strength = clamp(pet.strength + 1, 0, HEARTS);
    }
    if (pet.calling && pet.callKind === 'strength' && pet.strength > 0) pet.calling = false;
    return { ok: true, effortQ: pet.effortQ, strength: pet.strength, weight: pet.weight };
  }

  function clean(state) {
    state.trash = 0;
    return { ok: true };
  }

  function heal(state, kind) {
    // kind: 'dots' | 'skull'. On-screen pet(s).
    var idxs = visiblePets(state);
    if (!idxs.length) {
      var ap = activePet(state);
      if (ap) idxs = [state.pets[0] === ap ? 0 : 1];
    }
    var n = 0;
    idxs.forEach(function (i) {
      var pet = state.pets[i];
      if (!pet || pet.dead) return;
      if (kind === 'skull' && pet.injured) { pet.injured = false; n++; }
      if (kind === 'dots' && pet.sick) { pet.sick = false; n++; }
    });
    return { ok: n > 0, healed: n };
  }

  /**
   * Lights On/Off — Humulos state table. Not PenOG, not 1997.
   * on=true means the On option, on=false the Off option.
   */
  function applyLightToPet(pet, on, state) {
    if (!pet || pet.dead || pet.level === 'egg') return { ok: false, mode: 'nothing' };
    var tired = !!pet.tired, sleeping = !!pet.sleeping, frozen = !!pet.frozen;
    if (!tired && !sleeping && !frozen) {
      if (!on) {
        pet.frozen = true;
        pet.freezeStartedGame = state.gameTime;
        pet.freezeDpGranted = false;
        pet.calling = false;
        return { ok: true, mode: 'freeze' };
      }
      return { ok: true, mode: 'nothing' };
    }
    if (tired) {
      if (on) {
        pet.tired = false;
        pet.calling = false;
        return { ok: true, mode: 'wake' };
      }
      pet.tired = false;
      pet.sleeping = true;
      pet.putToBed = true;
      pet.calling = false;
      return { ok: true, mode: 'sleep' };
    }
    if (sleeping) {
      if (on) {
        pet.sleeping = false;
        pet.tired = false;
        pet.putToBed = false;
        pet.calling = false;
        return { ok: true, mode: 'wake' };
      }
      return { ok: true, mode: 'nothing' };
    }
    if (frozen) {
      if (on) {
        pet.frozen = false;
        return { ok: true, mode: 'unfreeze' };
      }
      return { ok: true, mode: 'nothing' };
    }
    return { ok: true, mode: 'nothing' };
  }

  function confirmLight(state, on) {
    var idxs = visiblePets(state);
    if (!idxs.length) {
      var ap = activePet(state);
      if (ap) idxs = [state.pets[0] === ap ? 0 : 1];
    }
    if (!idxs.length) return { ok: false, mode: 'nothing' };
    var last = { ok: false, mode: 'nothing' };
    idxs.forEach(function (i) {
      last = applyLightToPet(state.pets[i], on, state);
    });
    return last;
  }

  function switchDisplay(state) {
    // C on home: cycle what is shown. After Stage III, two-pet is unlocked.
    var slots = [];
    if (state.pets[0] && state.pets[0].mon && !state.pets[0].dead) slots.push('pet0');
    if (state.twoPetUnlocked && state.pets[1] && state.pets[1].mon && !state.pets[1].dead) slots.push('pet1');
    if (slots.length >= 2) slots.push('both');
    if (state.pendingEgg) slots.push('egg');
    if (state.deadComputer || (state.pets[0] && state.pets[0].dead) || (state.pets[1] && state.pets[1].dead)) slots.push('computer');
    if (!slots.length) slots = ['pet0'];
    var i = slots.indexOf(state.display);
    var next = slots[(i + 1) % slots.length];
    if (i < 0) next = slots[0];
    state.display = next;
    if (next === 'pet0') state.active = 0;
    if (next === 'pet1') state.active = 1;
    return state.display;
  }

  function pickEgg(state, eggId) {
    var Da = data();
    if ((state.unlockedEggs || []).indexOf(eggId) < 0) return { ok: false, error: 'locked' };
    // Need an open slot: pendingEgg (second) or a dead slot / computer isolated
    var slot = -1;
    if (state.display === 'computer' || state.deadComputer) {
      if (state.pets[0] && state.pets[0].dead) slot = 0;
      else if (state.pets[1] && state.pets[1].dead) slot = 1;
      else if (!state.pets[1] || !state.pets[1].mon) slot = 1;
    }
    if (state.display === 'egg' && state.pendingEgg) {
      if (!state.pets[1] || !state.pets[1].mon || state.pets[1].dead) slot = 1;
    }
    if (slot < 0) return { ok: false, error: 'no-slot' };
    var p = emptyPet();
    p.eggId = eggId;
    p.mon = 'egg';
    p.level = 'egg';
    p.stageEnteredGame = state.gameTime;
    p.evoDueAt = state.gameTime / 3600 + 1 / 60;
    if (state.traitedWaiting && state.traitedWaiting[slot]) {
      p.traited = true;
      state.traitedWaiting[slot] = false;
    }
    state.pets[slot] = p;
    state.pendingEgg = false;
    state.deadComputer = !((state.pets[0] && state.pets[0].dead) || (state.pets[1] && state.pets[1].dead));
    if (state.pets[0] && !state.pets[0].dead && state.pets[1] && !state.pets[1].dead) state.deadComputer = false;
    state.display = slot === 1 ? 'pet1' : 'pet0';
    state.active = slot;
    return { ok: true, slot: slot };
  }

  function enterPassword(state, code) {
    var Da = data();
    code = String(code || '').replace(/\s/g, '');
    var found = null;
    Object.keys(Da.MONSTERS).forEach(function (id) {
      var m = Da.MONSTERS[id];
      if (m.password && m.password === code) found = m;
    });
    if (!found) return { ok: false, error: 'bad' };
    if ((state.passwordsUsed || []).indexOf(found.password) >= 0) {
      // reusable per Humulos ("are reusable") — allow again
    }
    state.copymon = state.copymon || [];
    state.copymon.push({ id: found.id, name: found.name, from: 'password' });
    if (state.passwordsUsed.indexOf(found.password) < 0) state.passwordsUsed.push(found.password);
    albumAdd(state, found.id);
    return { ok: true, mon: found.id, name: found.name };
  }

  function powerOfPet(pet, foeAttr) {
    var Da = data();
    var p = Da.powerOf(pet.mon, pet.strength || 0);
    if (foeAttr) {
      var m = Da.monster(pet.mon);
      if (m && Da.attrAdvantage(m.attr, foeAttr) > 0) p += Da.POWER.attrBonus;
    }
    return p;
  }

  /**
   * Hit chance from Power gap. Exact table unpublished (Humulos qualitative only).
   * Monotonic labelled placeholder: 50% at equal, ±40% at a 80-point gap.
   */
  function hitChance(selfP, foeP) {
    var gap = (selfP || 0) - (foeP || 0);
    var c = 0.5 + 0.4 * clamp(gap / 80, -1, 1);
    return clamp(c, 0.1, 0.9);
  }

  function doBattle(state, pet, foe, rng) {
    // foe: {id, attr, power}  power is species base (Humulos colo table).
    var Da = data();
    if (!pet || !pet.canBattle && Da.monster(pet.mon) && !Da.monster(pet.mon).canBattle) {
      if (Da.monster(pet.mon) && !Da.monster(pet.mon).canBattle) return { ok: false, error: 'no-battle' };
    }
    if ((pet.dpQ || 0) <= 0) return { ok: false, error: 'no-dp' };
    // DP spend: required to fight; exact spend unpublished — 1 DP (4 quarters) labelled.
    var spendQ = 4;
    pet.dpQ = Math.max(0, pet.dpQ - spendQ);
    pet.weight = Math.max(1, (pet.weight || 0) - 1);
    var foeAttr = foe.attr || (foe.id && Da.monster(foe.id) && Da.monster(foe.id).attr);
    var selfP = powerOfPet(pet, foeAttr);
    var foeP = (foe.power != null ? foe.power : Da.powerOf(foe.id, 4));
    // foe listed Power on colo is already the used value (often the species base)
    var hc = hitChance(selfP, foeP);
    var won = (rng || Math.random)() < hc;
    recordBattle(state, pet, won);
    var inj = Da.INJURY_CHANCE || { win: 0.1, lose: 0.4 };
    var injured = (rng || Math.random)() < (won ? inj.win : inj.lose);
    if (injured) becomeInjured(state, pet);
    return { ok: true, won: won, selfP: selfP, foeP: foeP, hitChance: hc, injured: injured, spendQ: spendQ, spendNote: 'PLACEHOLDER-unpublished-dp-spend' };
  }

  function coloBattle(state, division, rng) {
    // division: 'single' | 'tag'
    var Da = data();
    var pet = activePet(state);
    if (!pet) return { ok: false };
    var list = division === 'tag' ? Da.COLOSSEUM.tag : Da.COLOSSEUM.single;
    var rnd = division === 'tag' ? state.coloTag : state.coloSingle;
    if (rnd > 100) rnd = 100;
    var row = list[rnd - 1];
    if (!row) return { ok: false, error: 'no-row' };
    var foe = division === 'tag' ? { id: null, name: row.L.name, attr: row.L.attr, power: row.L.power } : { name: row.name, attr: row.attr, power: row.power };
    var res = doBattle(state, pet, foe, rng);
    if (!res.ok) return res;
    if (res.won) {
      if (division === 'tag') {
        state.coloTag = Math.min(101, state.coloTag + 1);
        if (state.coloTag > 100) { state.coloClearedTag = true; state.champion = true; maybeUnlock(state); }
      } else {
        state.coloSingle = Math.min(101, state.coloSingle + 1);
        if (state.coloSingle > 100) { state.coloClearedSingle = true; state.champion = true; maybeUnlock(state); }
      }
    }
    res.round = rnd;
    res.foe = foe;
    return res;
  }

  function jogressOnDevice(state, leftIdx, rightKind, rightId) {
    // rightKind: 'pet' | 'copymon'; Left determines outcome from Right attribute (Humulos).
    var Da = data();
    var left = state.pets[leftIdx];
    if (!left || left.dead) return { ok: false, error: 'no-left' };
    var lm = Da.monster(left.mon);
    if (!lm || !lm.canJogress) return { ok: false, error: 'no-jogress' };
    if ((left.dpQ || 0) < (left.dpMaxQ || 0)) return { ok: false, error: 'dp' };
    var rm = null, rightPet = null, rightAttr = null, rightLevel = null;
    if (rightKind === 'pet') {
      rightPet = state.pets[rightId];
      if (!rightPet) return { ok: false, error: 'no-right' };
      rm = Da.monster(rightPet.mon);
      if ((rightPet.dpQ || 0) < (rightPet.dpMaxQ || 0)) return { ok: false, error: 'dp' };
    } else {
      var cm = (state.copymon || [])[rightId];
      if (!cm) return { ok: false, error: 'no-copy' };
      rm = Da.monster(cm.id);
    }
    if (!rm) return { ok: false, error: 'no-right-mon' };
    rightAttr = rm.attr;
    rightLevel = rm.level;
    // Both Stage IV or higher, usually same stage (Humulos)
    var stageOk = { I:0, II:0, III:0, IV:1, V:2, VI:3, 'VI+':4, Armor:1, '???':4 };
    if ((stageOk[lm.level] || 0) < 1 || (stageOk[rm.level] || 0) < 1) return { ok: false, error: 'stage' };

    var evos = (lm.evos || []).filter(function (ev) { return ev.req && ev.req.jogress; });
    var picked = null;
    for (var i = 0; i < evos.length; i++) {
      var ev = evos[i];
      var r = ev.req;
      if (r.jogressWith) {
        var want = r.jogressWith.toLowerCase();
        if ((rm.name && rm.name.toLowerCase().indexOf(want) >= 0) ||
            (rm.dub && rm.dub.toLowerCase().indexOf(want) >= 0) ||
            (rm.id && want.indexOf(rm.id) >= 0)) { picked = ev; break; }
        continue;
      }
      if (r.jogressAttrs && r.jogressAttrs.length && r.jogressAttrs.indexOf(rightAttr) < 0) continue;
      if (r.jogressStages && r.jogressStages.length && r.jogressStages.indexOf(rightLevel) < 0) {
        // "Adult" = IV; Humulos wording
        var map = { Adult:'IV', Perfect:'V', Ultimate:'VI', Child:'III' };
        var okS = r.jogressStages.some(function (s) { return s === rightLevel || map[s] === rightLevel; });
        // If stages empty after attr match, accept
        if (!okS && r.jogressStages.length) continue;
      }
      picked = ev;
      break;
    }
    if (!picked) return { ok: false, error: 'no-match' };
    var from = left.mon;
    applyMon(left, picked.to, state.gameTime);
    albumAdd(state, picked.to);
    left.dpQ = left.dpMaxQ;
    // Same-device: right is absorbed and disappears (Humulos)
    if (rightKind === 'pet') {
      state.pets[rightId] = null;
      state.pendingEgg = true; // a slot opened
    }
    if (Da.monster(picked.to) && Da.monster(picked.to).level === 'III' && !state.twoPetUnlocked) {
      state.twoPetUnlocked = true;
      maybeUnlock(state);
    }
    return { ok: true, from: from, to: picked.to, absorbed: rightKind === 'pet' };
  }

  function shakeSave(state) {
    var n = 0;
    for (var i = 0; i < 2; i++) {
      var p = state.pets[i];
      if (p && p.dying && !p.dead) { p.shakeSaved = true; n++; }
    }
    return { ok: n > 0, saved: n };
  }

  function beginClockSet(state) {
    var t = ((state.clockOffset || 0) + (state.gameTime || 0)) % 86400;
    if (t < 0) t += 86400;
    state.clockSet = { on: true, h24: Math.floor(t / 3600), min: Math.floor((t % 3600) / 60) };
  }
  function bumpClockHour(state) {
    if (!state.clockSet || !state.clockSet.on) return;
    state.clockSet.h24 = (state.clockSet.h24 + 1) % 24;
  }
  function bumpClockMin(state) {
    if (!state.clockSet || !state.clockSet.on) return;
    state.clockSet.min = (state.clockSet.min + 1) % 60;
  }
  function confirmClock(state) {
    if (!state.clockSet || !state.clockSet.on) return;
    var want = state.clockSet.h24 * 3600 + state.clockSet.min * 60;
    state.clockOffset = want - (state.gameTime || 0);
    state.clockSet.on = false;
    state.clockInitialized = true;
    // Does NOT speed growth (Humulos) — gameTime unchanged.
  }
  function toggleClock24(state) { state.clock24h = !state.clock24h; }

  function migrateState(state) {
    if (!state || state.family !== 'pen20') return state;
    if (!state.pets) state = Object.assign(state, defaultState(state.eggKind));
    if (!state.unlockedEggs) state.unlockedEggs = [data().defaultEggFor(state.colorway || 'sk')];
    if (!state.album) state.album = [];
    if (state.coloSingle == null) state.coloSingle = 1;
    if (state.coloTag == null) state.coloTag = 1;
    maybeUnlock(state);
    return state;
  }

  function hatchEgg(prev, eggKind) {
    return defaultState(eggKind);
  }

  var api = {
    defaultState: defaultState,
    tick: tick,
    migrateState: migrateState,
    hatchEgg: hatchEgg,
    mon: mon,
    activePet: activePet,
    visiblePets: visiblePets,
    feed: feed,
    train: train,
    clean: clean,
    heal: heal,
    confirmLight: confirmLight,
    switchDisplay: switchDisplay,
    pickEgg: pickEgg,
    enterPassword: enterPassword,
    doBattle: doBattle,
    coloBattle: coloBattle,
    jogressOnDevice: jogressOnDevice,
    shakeSave: shakeSave,
    beginClockSet: beginClockSet,
    bumpClockHour: bumpClockHour,
    bumpClockMin: bumpClockMin,
    confirmClock: confirmClock,
    toggleClock24: toggleClock24,
    isCallLit: function (state) {
      if (!state || !state.pets) return false;
      for (var i = 0; i < 2; i++) {
        if (state.pets[i] && state.pets[i].calling && !state.pets[i].dead) return true;
      }
      return false;
    },
    albumAdd: albumAdd,
    maybeUnlock: maybeUnlock,
    powerOfPet: powerOfPet,
    hitChance: hitChance,
    effortHearts: effortHearts,
    winsInLast15: winsInLast15,
    recordBattle: recordBattle,
    tryEvolvePet: tryEvolvePet,
    applyMon: applyMon,
    emptyPet: emptyPet,
    HEARTS: HEARTS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Pen20Engine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
