/**
 * Per-device architecture (v26 Step 0).
 *
 * Each egg maps to one device profile: shell art, orientation, button
 * layout, icon set and menu order, status pages, training/battle screens,
 * clock-SET procedure, lights-off screen, and a rules-engine module.
 * Devices must not share another model's UI.
 *
 * 1997 Ver.1–5 and DM20 profiles wrap the EXISTING Engine / UI behaviour
 * bit-for-bit — same selectable lists, status pages, shell files, LCD
 * percentages, and Engine.tick. Pendulum (and later lines) register
 * their own modules and are routed only when the egg is theirs.
 *
 * Step counting is a cross-cutting extra and is never gated by family.
 */
(function (root) {
  'use strict';

  // Exact v25 1997 / DM20 LCD and pad percentages. Do not change:
  // existing shells were measured against these numbers.
  var LAYOUT_1997 = {
    aspectW: 1494,
    aspectH: 1037,
    lcd: { left: 12.249, top: 39.634, width: 33.4, height: 23.819 },
    buttons: {
      a: { cx: 81.459, cy: 26.422, w: 11.379, h: 16.393 },
      b: { cx: 81.459, cy: 50.53, w: 11.379, h: 16.393 },
      c: { cx: 81.459, cy: 72.71, w: 11.379, h: 16.393 },
      reset: { cx: 75.435, cy: 61.62, w: 4.819, h: 6.943 }
    },
    icons_top: [
      { left: 14.19, top: 29.315, width: 6.493, height: 7.425 },
      { left: 21.754, top: 29.219, width: 6.627, height: 7.522 },
      { left: 30.254, top: 29.026, width: 5.154, height: 7.811 },
      { left: 37.751, top: 29.026, width: 5.288, height: 7.907 }
    ],
    icons_bot: [
      { left: 14.659, top: 66.249, width: 5.556, height: 7.811 },
      { left: 23.025, top: 66.152, width: 4.016, height: 8.004 },
      { left: 29.987, top: 66.056, width: 5.689, height: 8.1 },
      { left: 37.483, top: 66.635, width: 6.225, height: 6.461 }
    ],
    names_top: ['STATUS', 'FEED', 'TRAIN', 'BATTLE'],
    names_bot: ['FLUSH', 'LIGHT', 'MEDIC', 'CALL'],
    chamber: null
  };

  var DM20_EGGS = {
    zuba: 'dm20-zuba', meicoo: 'dm20-zuba',
    corona: 'dm20-omega',
    luna: 'dm20-alpha', doru: 'dm20-alpha',
    hack: 'dm20-brown', dra_blue: 'dm20-brown', dra_green: 'dm20-brown',
    anime_agumon: 'dm20-brown', anime_gabumon: 'dm20-brown'
  };

  var byId = {};
  var eggIndex = {};

  function copy(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(copy);
    var o = {};
    Object.keys(obj).forEach(function (k) { o[k] = copy(obj[k]); });
    return o;
  }

  function register(profile) {
    if (!profile || !profile.id) return;
    byId[profile.id] = profile;
    var eggs = profile.eggs || [];
    for (var i = 0; i < eggs.length; i++) eggIndex[eggs[i]] = profile.id;
    return profile;
  }

  function profileById(id) { return byId[id] || null; }

  function profileByEgg(eggKind) {
    if (!eggKind) return null;
    var id = eggIndex[String(eggKind)];
    return id ? byId[id] : null;
  }

  function dm1997Profile(ver) {
    ver = ver >= 1 && ver <= 5 ? ver : 1;
    return {
      id: 'dm1997-v' + ver,
      family: 'dm1997',
      line: 'dm1997',
      shell: 'dm1997-v' + ver,
      orient: 'landscape',
      version: ver,
      layout: LAYOUT_1997,
      iconsTop: LAYOUT_1997.names_top,
      iconsBot: LAYOUT_1997.names_bot,
      selectable: ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'],
      statusPages: ['age', 'hunger', 'strength', 'dp', 'win'],
      buttonStyle: 'brick-1997',
      lightsOff: 'blank',
      clockSet: '1997',
      hatchMinutes: 10,
      engine: 'Engine',
      steps: true
    };
  }

  function dm20Profile(shell, eggKind) {
    return {
      id: 'dm20-' + (eggKind || 'zuba'),
      family: 'dm20',
      line: 'dm20',
      shell: shell,
      orient: 'landscape',
      version: 20,
      layout: LAYOUT_1997,
      iconsTop: LAYOUT_1997.names_top,
      iconsBot: LAYOUT_1997.names_bot,
      selectable: ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC', 'ALBUM', 'CONNECT'],
      statusPages: ['name', 'age', 'hunger', 'strength', 'effort', 'dp', 'win'],
      buttonStyle: 'dm20-gold',
      lightsOff: 'visible-z',
      clockSet: '1997',
      hatchMinutes: 1,
      engine: 'Engine',
      steps: true,
      eggKind: eggKind
    };
  }

  // Register the five 1997 shells and the DM20 eggs so profileFor works
  // even before a later line's module loads.
  for (var v = 1; v <= 5; v++) {
    var p = dm1997Profile(v);
    p.eggs = ['ver' + v];
    register(p);
  }
  Object.keys(DM20_EGGS).forEach(function (kind) {
    var q = dm20Profile(DM20_EGGS[kind], kind);
    q.eggs = [kind];
    register(q);
  });

  function profileFor(state) {
    if (!state) return dm1997Profile(1);
    // Pendulum (and future lines) set family / deviceId on the save.
    if (state.deviceId && byId[state.deviceId]) return byId[state.deviceId];
    if (state.family && state.family !== 'dm1997' && state.family !== 'dm20') {
      var found = null;
      Object.keys(byId).some(function (id) {
        if (byId[id].family === state.family &&
            (!state.eggKind || (byId[id].eggs || []).indexOf(state.eggKind) >= 0)) {
          found = byId[id];
          return true;
        }
        return false;
      });
      if (found) return found;
    }
    var kind = state.eggKind || '';
    var fromEgg = profileByEgg(kind);
    if (fromEgg) {
      // DM20 eggs all share family 'dm20' but different shells — return
      // a profile whose shell matches the v25 DM20_EGGS map.
      return fromEgg;
    }
    var ver = parseInt(state.version, 10);
    if (kind && /^ver[1-5]$/.test(String(kind))) ver = parseInt(String(kind).charAt(3), 10);
    return dm1997Profile(ver);
  }

  function isPendulum(state) {
    var p = profileFor(state);
    return !!(p && p.family === 'pendulum');
  }

  function isPendulumEgg(kind) {
    var p = profileByEgg(kind);
    return !!(p && p.family === 'pendulum');
  }

  function isPen20(state) {
    var p = profileFor(state);
    return !!(p && p.family === 'pen20');
  }

  function isPen20Egg(kind) {
    var p = profileByEgg(kind);
    return !!(p && p.family === 'pen20');
  }

  function isDigivice(state) {
    var p = profileFor(state);
    return !!(p && p.family === 'digivice');
  }

  function isDigiviceEgg(kind) {
    var p = profileByEgg(kind);
    return !!(p && p.family === 'digivice');
  }

  function engineFor(state) {
    var p = profileFor(state);
    if (p && p.family === 'digivice' && root.DigiviceEngine) return root.DigiviceEngine;
    if (p && p.family === 'pen20' && root.Pen20Engine) return root.Pen20Engine;
    if (p && p.family === 'pendulum' && root.PendulumEngine) return root.PendulumEngine;
    return root.Engine;
  }

  /* v31 device clock: user-set time that runs at real speed.
     The time of day is NOT the phone's clock. It is the value the player
     entered with the device's own SET operation (or the device's reset
     default), advanced by real elapsed time:

         clock = clockAnchor.value + (Date.now() - clockAnchor.at) / 1000

     Engines still read time of day as clockOffset + gameTime (sleep, wake,
     lights, calls, midnight age), so after every tick clockOffset is
     re-derived from the anchor. gameTime is simulation time and may be
     capped during a long catch-up; the clock is not.
     - SET confirm / clock jumps change clockOffset → detected (it no longer
       equals clockSyncOffset) → re-anchored at the new value, now.
     - While SET is open the edited value is shown (original behaviour);
       the anchor is untouched until confirm.
     - Old saves without an anchor: anchored at their last known clock at
       their lastReal, so the time they were closed is caught up.
     - Debug speeds > 1 run the clock at game speed (re-anchored each tick). */
  function mod86400(x) { return ((x % 86400) + 86400) % 86400; }
  function rawClock(state) { return mod86400((state.clockOffset || 0) + (state.gameTime || 0)); }

  function syncClock(state, before, realNow) {
    if (!state || typeof state !== 'object') return;
    if (state.clockSet && state.clockSet.on) return;
    var a = state.clockAnchor;
    var external = before && before.syncOffset != null &&
      Math.abs(mod86400((before.offset || 0) - before.syncOffset + 43200) - 43200) > 0.5;
    if (!a || typeof a.value !== 'number' || typeof a.at !== 'number' || external) {
      // Anchor at the clock as it stood before this tick, at the time it was valid.
      var at = (before && !external && typeof before.lastReal === 'number') ? before.lastReal : realNow;
      var val = before ? mod86400((before.offset || 0) + (before.gameTime || 0)) : rawClock(state);
      if (external && before) at = realNow;
      a = state.clockAnchor = { value: val, at: at };
    }
    if ((state.speed || 1) !== 1) {
      // Debug fast-forward: clock follows game time; keep the anchor current.
      state.clockAnchor = { value: rawClock(state), at: realNow };
    } else {
      var target = mod86400(a.value + (realNow - a.at) / 1000);
      // Rounded to 1 µs so the offset is bit-stable between ticks (v32: the
      // grid simulation reads it for sleep / age times).
      state.clockOffset = mod86400(Math.round((target - (state.gameTime || 0)) * 1e6) / 1e6);
    }
    state.clockSyncOffset = state.clockOffset;
  }

  function tick(state, realNow) {
    var eng = engineFor(state);
    if (!eng || typeof eng.tick !== 'function') return { ok: false };
    if (realNow == null) realNow = Date.now();
    var before = state ? {
      lastReal: (typeof state.lastReal === 'number' && state.lastReal <= realNow) ? state.lastReal : realNow,
      gameTime: state.gameTime || 0,
      offset: state.clockOffset || 0,
      syncOffset: state.clockSyncOffset
    } : null;
    var r = eng.tick(state, realNow);
    syncClock(state, before, realNow);
    return r;
  }

  function clockSeconds(state) {
    if (!state) return 0;
    var eng = engineFor(state);
    if (state.family === 'digivice' && eng && eng.clockH24) {
      var c = eng.clockH24(state);
      return c.h24 * 3600 + c.min * 60 + (c.sec || 0);
    }
    if (eng && eng.clockSeconds) return eng.clockSeconds(state);
    if (eng && eng.runningClockSeconds) return eng.runningClockSeconds(state);
    return ((((state.clockOffset || 0) + (state.gameTime || 0)) % 86400) + 86400) % 86400;
  }

  function migrate(state) {
    var eng = engineFor(state);
    if (eng && typeof eng.migrateState === 'function') return eng.migrateState(state);
    return state;
  }

  function hatchEgg(prev, version, randomize, special) {
    if (isDigiviceEgg(special) && root.DigiviceEngine) {
      var sdv = root.DigiviceEngine.defaultState(special);
      sdv.speed = (prev && prev.speedMigrated && prev.speed) ? prev.speed : 1;
      sdv.speedMigrated = true;
      if (root.Steps && root.Steps.carryLedger) root.Steps.carryLedger(prev, sdv);
      return sdv;
    }
    if (isPen20Egg(special) && root.Pen20Engine) {
      var s20 = root.Pen20Engine.defaultState(special);
      s20.speed = (prev && prev.speedMigrated && prev.speed) ? prev.speed : 1;
      s20.speedMigrated = true;
      if (root.Steps && root.Steps.carryLedger) root.Steps.carryLedger(prev, s20);
      return s20;
    }
    if (isPendulumEgg(special) && root.PendulumEngine) {
      var s = root.PendulumEngine.defaultState(special);
      s.speed = (prev && prev.speedMigrated && prev.speed) ? prev.speed : 1;
      s.speedMigrated = true;
      if (root.Steps && root.Steps.carryLedger) root.Steps.carryLedger(prev, s);
      return s;
    }
    return root.Engine.hatchIfEggSelect(prev, version, !!randomize, special || null);
  }

  var api = {
    LAYOUT_1997: LAYOUT_1997,
    DM20_EGGS: DM20_EGGS,
    register: register,
    profileById: profileById,
    profileByEgg: profileByEgg,
    profileFor: profileFor,
    dm1997Profile: dm1997Profile,
    dm20Profile: dm20Profile,
    isPendulum: isPendulum,
    isPendulumEgg: isPendulumEgg,
    isPen20: isPen20,
    isPen20Egg: isPen20Egg,
    isDigivice: isDigivice,
    isDigiviceEgg: isDigiviceEgg,
    engineFor: engineFor,
    tick: tick,
    syncClock: syncClock,
    clockSeconds: clockSeconds,
    migrate: migrate,
    hatchEgg: hatchEgg,
    allProfiles: function () {
      return Object.keys(byId).map(function (k) { return byId[k]; });
    },
    // Public identical-to-v25 snapshot used by tests.
    SELECTABLE_1997: ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'],
    SELECTABLE_DM20: ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC', 'ALBUM', 'CONNECT'],
    STATUS_1997: ['age', 'hunger', 'strength', 'dp', 'win'],
    STATUS_DM20: ['name', 'age', 'hunger', 'strength', 'effort', 'dp', 'win']
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Devices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
