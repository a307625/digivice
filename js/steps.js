/**
 * Step counting for the Digimon V-pet.
 *
 * Health (iPhone 健康 via Shortcuts) reports a cumulative daily total.
 * We store the max total seen per date and credit only the delta.
 *
 * In-game DeviceMotion steps are provisional for that date.
 * Credited(date) = max(healthTotal, motionCount).
 * A later Health import or extra motion only credits the difference,
 * so the same physical steps are never counted twice.
 *
 * Effects (modest, Pendulum / Digivice-style):
 *   every 500 credited steps → +1 effort (train), daily cap 8
 *   every 500 credited steps → +1 strength (max 4), daily cap 2
 *   every 1000 credited steps → −1 g weight (not below base), daily cap 3 g
 * Lifetime steps stay on the monster across evolution (reset on a new egg)
 * and are passed to the evolution resolver as `lifeSteps` for future rules.
 * Official evolution requirements themselves are unchanged.
 */
(function (root) {
  'use strict';

  var LEDGER_KEY = 'digivice-steps-ledger-v1';
  var SHORTCUT_NAME = '數碼寶貝步數';
  var GAME_URL = 'https://a307625.github.io/digivice/index.html';

  var MAX_DAILY = 100000;
  var STEPS_PER_EFFORT = 500;
  var STEPS_PER_WEIGHT = 1000;
  var DAILY_EFFORT_CAP = 8;
  var DAILY_STRENGTH_CAP = 2;
  var DAILY_WEIGHT_CAP = 3;
  var GRAVITY = 9.80665;

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function localDate(input) {
    var d;
    if (input == null || input === '') d = new Date();
    else if (input instanceof Date) d = input;
    else if (typeof input === 'number') d = new Date(input);
    else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    else d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function isValidDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-');
    var y = +p[0], m = +p[1], d = +p[2];
    if (y < 2000 || y > 2100) return false;
    var dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function parseTs(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    if (!isFinite(n) || n < 0) return null;
    // 10-digit unix seconds vs 13-digit milliseconds
    if (n < 1e11) n = n * 1000;
    var d = new Date(n);
    if (isNaN(d.getTime())) return null;
    return n;
  }

  function parseStepCount(v) {
    if (v == null || v === '') return { ok: false, reason: 'non-numeric' };
    if (typeof v === 'string') {
      v = v.trim().replace(/,/g, '');
      if (v === '') return { ok: false, reason: 'non-numeric' };
      if (/^-/.test(v)) {
        return { ok: false, reason: /^-[0-9]+(?:\.[0-9]+)?$/.test(v) ? 'negative' : 'non-numeric' };
      }
      if (/[eE]/.test(v) || !/^[0-9]+(?:\.[0-9]+)?$/.test(v)) {
        return { ok: false, reason: 'non-numeric' };
      }
    }
    var n = Number(v);
    if (!isFinite(n) || isNaN(n)) return { ok: false, reason: 'non-numeric' };
    if (n < 0) return { ok: false, reason: 'negative' };
    n = Math.floor(n);
    if (n > MAX_DAILY) return { ok: false, reason: 'too-large' };
    return { ok: true, value: n };
  }

  function emptyDay() {
    return { health: 0, motion: 0, credited: 0 };
  }

  function empty() {
    return {
      days: {},
      lastHealthSyncAt: 0,
      lastHealthSyncDate: '',
      lastHealthSyncTotal: 0,
      lifetime: 0,
      dayEffectsDate: '',
      dayEffort: 0,
      dayStrength: 0,
      dayWeightLoss: 0
    };
  }

  function ensure(state) {
    if (!state) return empty();
    if (!state.steps || typeof state.steps !== 'object') state.steps = empty();
    var s = state.steps;
    if (!s.days || typeof s.days !== 'object') s.days = {};
    if (typeof s.lastHealthSyncAt !== 'number') s.lastHealthSyncAt = 0;
    if (typeof s.lastHealthSyncDate !== 'string') s.lastHealthSyncDate = '';
    if (typeof s.lastHealthSyncTotal !== 'number') s.lastHealthSyncTotal = 0;
    if (typeof s.lifetime !== 'number' || s.lifetime < 0) s.lifetime = s.lifetime || 0;
    if (typeof s.dayEffectsDate !== 'string') s.dayEffectsDate = '';
    if (typeof s.dayEffort !== 'number') s.dayEffort = 0;
    if (typeof s.dayStrength !== 'number') s.dayStrength = 0;
    if (typeof s.dayWeightLoss !== 'number') s.dayWeightLoss = 0;
    return s;
  }

  function getDay(state, date) {
    var s = ensure(state);
    if (!s.days[date]) s.days[date] = emptyDay();
    var d = s.days[date];
    d.health = Math.max(0, Number(d.health) || 0);
    d.motion = Math.max(0, Number(d.motion) || 0);
    d.credited = Math.max(0, Number(d.credited) || 0);
    return d;
  }

  function monsterInfo(state) {
    var data = root.EvolutionData;
    var m = data && data.MONSTERS && state && data.MONSTERS[state.mon];
    if (!m) return { canCare: true, baseWeight: 5, stage: null };
    var young = m.stage === 'egg' || m.stage === 'baby1' || m.stage === 'baby2';
    return {
      canCare: !young && !state.dead,
      baseWeight: m.weight || 5,
      stage: m.stage
    };
  }

  function rollDayEffects(state, date) {
    var s = ensure(state);
    if (s.dayEffectsDate !== date) {
      s.dayEffectsDate = date;
      s.dayEffort = 0;
      s.dayStrength = 0;
      s.dayWeightLoss = 0;
    }
  }

  function pushEvent(state, text) {
    if (!state) return;
    state.events = (state.events || []).slice(-30);
    state.events.push({ t: state.gameTime || 0, type: 'steps', text: text });
  }

  function applyEffects(state, delta, date) {
    var result = { effort: 0, strength: 0, weightLoss: 0 };
    if (!state || delta <= 0) return result;
    var s = ensure(state);
    var prev = s.lifetime;
    s.lifetime = prev + delta;
    var info = monsterInfo(state);
    if (!info.canCare) return result;
    rollDayEffects(state, date);

    // Pen20: Humulos — training is the only way to add Effort. Steps still
    // count (ungated) but must not grant effortQ / strength / weight.
    if (state.family === 'pen20') return result;

    // Digivice: phone steps (and shake) drive the authentic map countdown.
    // Do not grant 1997 Effort / strength / weight.
    if (state.family === 'digivice') {
      if (root.DigiviceEngine && root.DigiviceEngine.applySteps) {
        root.DigiviceEngine.applySteps(state, delta);
      }
      return result;
    }

    var newEffortBlocks = Math.floor(s.lifetime / STEPS_PER_EFFORT) - Math.floor(prev / STEPS_PER_EFFORT);
    var effortGrant = Math.min(newEffortBlocks, Math.max(0, DAILY_EFFORT_CAP - s.dayEffort));
    if (effortGrant > 0) {
      // dayEffort is a walking extra. It must NOT increment official
      // state.train (1997 training counts only come from the training menu).
      s.dayEffort += effortGrant;
      result.effort = effortGrant;
    }

    var strengthGrant = Math.min(newEffortBlocks, Math.max(0, DAILY_STRENGTH_CAP - s.dayStrength));
    if (strengthGrant > 0 && (state.strength || 0) < 4) {
      var room = 4 - (state.strength || 0);
      var actual = Math.min(strengthGrant, room);
      state.strength = (state.strength || 0) + actual;
      s.dayStrength += actual;
      result.strength = actual;
      if (state.strength > 0) state.callStrengthAt = null;
      if (state.hunger > 0 && state.strength > 0) state.emptySince = null;
    }

    var newWeightBlocks = Math.floor(s.lifetime / STEPS_PER_WEIGHT) - Math.floor(prev / STEPS_PER_WEIGHT);
    var weightGrant = Math.min(newWeightBlocks, Math.max(0, DAILY_WEIGHT_CAP - s.dayWeightLoss));
    if (weightGrant > 0) {
      var floor = info.baseWeight;
      var before = state.weight == null ? floor : state.weight;
      var after = Math.max(floor, before - weightGrant);
      var lost = before - after;
      if (lost > 0) {
        state.weight = after;
        s.dayWeightLoss += lost;
        result.weightLoss = lost;
      }
    }
    return result;
  }

  function settleDay(state, date) {
    var day = getDay(state, date);
    var target = Math.max(day.health, day.motion);
    var delta = target - day.credited;
    var effects = { effort: 0, strength: 0, weightLoss: 0 };
    if (delta > 0) {
      day.credited = target;
      effects = applyEffects(state, delta, date);
    } else {
      delta = 0;
    }
    return { date: date, delta: delta, credited: day.credited, health: day.health, motion: day.motion, effects: effects };
  }

  function parseQueryString(raw) {
    if (!raw) return new URLSearchParams('');
    if (raw.charAt(0) === '#' || raw.charAt(0) === '?') raw = raw.slice(1);
    if (raw.charAt(0) === '?') raw = raw.slice(1);
    return new URLSearchParams(raw);
  }

  function parseParams(search, hash) {
    var q = parseQueryString(search);
    var h = parseQueryString(hash);
    function get(k) {
      if (q.has(k) && q.get(k) !== '') return q.get(k);
      if (h.has(k) && h.get(k) !== '') return h.get(k);
      return null;
    }
    var stepsRaw = get('steps');
    var dateRaw = get('date');
    var tsRaw = get('ts');
    // An import is present only when a steps param exists (date/ts alone is not enough).
    var present = stepsRaw != null;
    if (!present) return { present: false, ok: false, reason: 'none' };

    var counted = parseStepCount(stepsRaw);
    if (!counted.ok) {
      return { present: true, ok: false, reason: counted.reason, raw: stepsRaw };
    }

    var ts = parseTs(tsRaw);
    var date = null;
    if (dateRaw) {
      date = String(dateRaw).trim();
      if (!isValidDate(date)) {
        return { present: true, ok: false, reason: 'bad-date', rawDate: dateRaw };
      }
    } else if (ts != null) {
      date = localDate(ts);
    } else {
      date = localDate(new Date());
    }
    if (!isValidDate(date)) {
      return { present: true, ok: false, reason: 'bad-date' };
    }
    return { present: true, ok: true, steps: counted.value, date: date, ts: ts };
  }

  function applyHealth(state, reading, now) {
    if (!reading || !reading.ok) {
      return { ok: false, reason: (reading && reading.reason) || 'bad-value', delta: 0 };
    }
    var counted = parseStepCount(reading.steps);
    if (!counted.ok) return { ok: false, reason: counted.reason, delta: 0 };
    var date = reading.date || localDate(now || Date.now());
    if (!isValidDate(date)) return { ok: false, reason: 'bad-date', delta: 0 };

    var s = ensure(state);
    var day = getDay(state, date);
    day.health = Math.max(day.health, counted.value);
    var settled = settleDay(state, date);

    var when = reading.ts || now || Date.now();
    s.lastHealthSyncAt = when;
    s.lastHealthSyncDate = date;
    s.lastHealthSyncTotal = day.health;

    if (settled.delta > 0 && settled.effects && (settled.effects.effort || settled.effects.weightLoss)) {
      var bits = ['健康步數入帳 +' + settled.delta];
      if (settled.effects.effort) bits.push('訓練 +' + settled.effects.effort);
      if (settled.effects.strength) bits.push('體力 +' + settled.effects.strength);
      if (settled.effects.weightLoss) bits.push('體重 −' + settled.effects.weightLoss + 'g');
      pushEvent(state, bits.join('，'));
    }
    return {
      ok: true,
      reason: settled.delta > 0 ? 'credited' : 'no-delta',
      date: date,
      health: day.health,
      motion: day.motion,
      credited: day.credited,
      delta: settled.delta,
      effects: settled.effects
    };
  }

  function addMotion(state, count, date, now) {
    var n = count == null ? 1 : count;
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) {
      return { ok: false, reason: 'bad-value', delta: 0 };
    }
    n = Math.floor(n);
    date = date || localDate(now || Date.now());
    if (!isValidDate(date)) return { ok: false, reason: 'bad-date', delta: 0 };
    var day = getDay(state, date);
    // Cap motion so a runaway sensor cannot explode a day.
    var room = Math.max(0, MAX_DAILY - day.motion);
    n = Math.min(n, room);
    if (n <= 0) return { ok: true, reason: 'capped', delta: 0, date: date, health: day.health, motion: day.motion, credited: day.credited, effects: { effort: 0, strength: 0, weightLoss: 0 } };
    day.motion += n;
    var settled = settleDay(state, date);
    return {
      ok: true,
      reason: settled.delta > 0 ? 'credited' : 'no-delta',
      date: date,
      health: day.health,
      motion: day.motion,
      credited: day.credited,
      delta: settled.delta,
      effects: settled.effects
    };
  }

  function recordHealthReading(reading, now) {
    // No monster yet: remember the Health total so the first egg can settle it.
    var stub = { steps: empty() };
    var r = applyHealth(stub, reading, now);
    // Undo lifetime/effects on the stub — there is no monster. Keep day health,
    // but credited stays 0 so the first egg receives the delta.
    if (stub.steps && stub.steps.days) {
      Object.keys(stub.steps.days).forEach(function (d) {
        stub.steps.days[d].credited = 0;
      });
      stub.steps.lifetime = 0;
      stub.steps.dayEffort = 0;
      stub.steps.dayStrength = 0;
      stub.steps.dayWeightLoss = 0;
    }
    saveLedger(stub.steps);
    return r;
  }

  function emptyLedger() {
    return {
      days: {},
      lastHealthSyncAt: 0,
      lastHealthSyncDate: '',
      lastHealthSyncTotal: 0
    };
  }

  function loadLedger() {
    try {
      if (typeof localStorage === 'undefined') return emptyLedger();
      var raw = localStorage.getItem(LEDGER_KEY);
      if (!raw) return emptyLedger();
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return emptyLedger();
      if (!obj.days || typeof obj.days !== 'object') obj.days = {};
      return obj;
    } catch (e) {
      return emptyLedger();
    }
  }

  function saveLedger(steps) {
    try {
      if (typeof localStorage === 'undefined' || !steps) return;
      var out = {
        days: steps.days || {},
        lastHealthSyncAt: steps.lastHealthSyncAt || 0,
        lastHealthSyncDate: steps.lastHealthSyncDate || '',
        lastHealthSyncTotal: steps.lastHealthSyncTotal || 0
      };
      localStorage.setItem(LEDGER_KEY, JSON.stringify(out));
    } catch (e) { /* quota / private mode */ }
  }

  function absorbDay(dst, src) {
    if (!src) return;
    dst.health = Math.max(dst.health || 0, Number(src.health) || 0);
    dst.motion = Math.max(dst.motion || 0, Number(src.motion) || 0);
    dst.credited = Math.max(dst.credited || 0, Number(src.credited) || 0);
  }

  function mergeLedgerInto(state, extra) {
    var s = ensure(state);
    function absorb(src) {
      if (!src) return;
      var days = src.days || {};
      Object.keys(days).forEach(function (date) {
        absorbDay(getDay(state, date), days[date]);
      });
      var at = Number(src.lastHealthSyncAt) || 0;
      if (at > (s.lastHealthSyncAt || 0)) {
        s.lastHealthSyncAt = at;
        s.lastHealthSyncDate = src.lastHealthSyncDate || s.lastHealthSyncDate;
        s.lastHealthSyncTotal = src.lastHealthSyncTotal || s.lastHealthSyncTotal;
      }
    }
    absorb(extra);
    return s;
  }

  function carryLedger(fromState, toState) {
    ensure(toState);
    // New monster: lifetime / daily caps start at 0; day ledger is shared
    // so already-credited Health totals are not granted again.
    toState.steps.lifetime = 0;
    toState.steps.dayEffectsDate = '';
    toState.steps.dayEffort = 0;
    toState.steps.dayStrength = 0;
    toState.steps.dayWeightLoss = 0;
    toState.steps.days = {};
    mergeLedgerInto(toState, loadLedger());
    mergeLedgerInto(toState, fromState && fromState.steps);
    var totalDelta = 0;
    var dates = Object.keys(toState.steps.days);
    for (var i = 0; i < dates.length; i++) {
      var r = settleDay(toState, dates[i]);
      totalDelta += r.delta || 0;
    }
    saveLedger(toState.steps);
    return totalDelta;
  }

  function syncLedger(state) {
    if (state && state.steps) saveLedger(state.steps);
  }

  function todaySummary(state, date) {
    date = date || localDate(new Date());
    var s = state ? ensure(state) : empty();
    var day = (s.days && s.days[date]) ? s.days[date] : emptyDay();
    return {
      date: date,
      health: day.health || 0,
      motion: day.motion || 0,
      credited: day.credited || 0,
      lifetime: s.lifetime || 0,
      lastHealthSyncAt: s.lastHealthSyncAt || 0,
      lastHealthSyncDate: s.lastHealthSyncDate || '',
      lastHealthSyncTotal: s.lastHealthSyncTotal || 0,
      dayEffort: s.dayEffectsDate === date ? s.dayEffort : 0,
      dayStrength: s.dayEffectsDate === date ? s.dayStrength : 0,
      dayWeightLoss: s.dayEffectsDate === date ? s.dayWeightLoss : 0
    };
  }

  function formatSyncTime(ts) {
    if (!ts) return '尚未同步';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '尚未同步';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '（裝置時間）';
  }

  function shortcutRunURL() {
    return 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME);
  }

  function stripKeys(raw, keys) {
    var hadQ = false;
    var s = raw || '';
    if (s.charAt(0) === '?') { hadQ = true; s = s.slice(1); }
    var p = new URLSearchParams(s);
    var before = p.toString();
    for (var i = 0; i < keys.length; i++) p.delete(keys[i]);
    var after = p.toString();
    if (!after) return '';
    return '?' + after;
  }

  function stripSearchAndHash(search, hash) {
    var keys = ['steps', 'date', 'ts'];
    var newSearch = stripKeys(search || '', keys);
    var h = hash || '';
    var hashPrefix = '#';
    if (h.charAt(0) === '#') h = h.slice(1);
    var innerQ = false;
    if (h.charAt(0) === '?') { innerQ = true; h = h.slice(1); }
    var newHashBody = stripKeys('?' + h, keys);
    var newHash = '';
    if (newHashBody) {
      newHash = '#' + (innerQ ? newHashBody : newHashBody.replace(/^\?/, ''));
    }
    return { search: newSearch, hash: newHash };
  }

  function stripWindowHistory(win) {
    win = win || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.location || !win.history || !win.history.replaceState) return;
    var loc = win.location;
    var stripped = stripSearchAndHash(loc.search, loc.hash);
    var next = loc.pathname + (stripped.search || '') + (stripped.hash || '');
    var cur = loc.pathname + loc.search + loc.hash;
    if (next !== cur) {
      try { win.history.replaceState(win.history.state, '', next); } catch (e) {}
    }
  }

  function createPedometer(opts) {
    opts = opts || {};
    var threshold = opts.threshold != null ? opts.threshold : 1.35;
    var minMs = opts.minMs != null ? opts.minMs : 320;
    var drop = opts.drop != null ? opts.drop : 0.45;
    var filtered = 0;
    var prev = 0;
    var goingUp = false;
    var peak = 0;
    var lastStep = -1e15;
    return {
      reset: function () {
        filtered = 0; prev = 0; goingUp = false; peak = 0; lastStep = -1e15;
      },
      feed: function (x, y, z, now) {
        now = now || Date.now();
        var mag = Math.sqrt(x * x + y * y + z * z) - GRAVITY;
        filtered = filtered * 0.75 + mag * 0.25;
        var stepped = false;
        if (!goingUp && filtered > prev && filtered > threshold) {
          goingUp = true;
          peak = filtered;
        }
        if (goingUp) {
          if (filtered > peak) peak = filtered;
          if (filtered < peak - drop) {
            if (now - lastStep >= minMs) {
              lastStep = now;
              stepped = true;
            }
            goingUp = false;
          }
        }
        prev = filtered;
        return stepped;
      }
    };
  }


  /**
   * The Health-sync launch prompt is only for a cold open on iOS.
   * Resume, visibilitychange, pageshow, a shortcut return, or an already
   * dismissed / already-applied session must not show it again.
   */
  function shouldShowLaunchPrompt(opts) {
    opts = opts || {};
    if (opts.shotMode) return false;
    if (!opts.coldLaunch) return false;
    if (opts.alreadyDismissed) return false;
    if (opts.healthApplied) return false;
    if (opts.fromShortcut) return false;
    if (opts.isIOS === false) return false;
    return true;
  }

  var api = {
    LEDGER_KEY: LEDGER_KEY,
    SHORTCUT_NAME: SHORTCUT_NAME,
    GAME_URL: GAME_URL,
    MAX_DAILY: MAX_DAILY,
    STEPS_PER_EFFORT: STEPS_PER_EFFORT,
    STEPS_PER_WEIGHT: STEPS_PER_WEIGHT,
    DAILY_EFFORT_CAP: DAILY_EFFORT_CAP,
    DAILY_STRENGTH_CAP: DAILY_STRENGTH_CAP,
    DAILY_WEIGHT_CAP: DAILY_WEIGHT_CAP,
    empty: empty,
    emptyDay: emptyDay,
    ensure: ensure,
    localDate: localDate,
    isValidDate: isValidDate,
    parseTs: parseTs,
    parseStepCount: parseStepCount,
    parseParams: parseParams,
    applyHealth: applyHealth,
    addMotion: addMotion,
    settleDay: settleDay,
    applyEffects: applyEffects,
    recordHealthReading: recordHealthReading,
    loadLedger: loadLedger,
    saveLedger: saveLedger,
    carryLedger: carryLedger,
    mergeLedgerInto: mergeLedgerInto,
    syncLedger: syncLedger,
    todaySummary: todaySummary,
    formatSyncTime: formatSyncTime,
    shortcutRunURL: shortcutRunURL,
    stripSearchAndHash: stripSearchAndHash,
    stripWindowHistory: stripWindowHistory,
    createPedometer: createPedometer,
    getDay: getDay,
    shouldShowLaunchPrompt: shouldShowLaunchPrompt
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.Steps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
