/**
 * Original Pendulum Ver.1.0–5.5 + ZERO — shared rules, 1.0 roster,
 * plus registerVersion() for later versions (see versions.js).
 * species care stats, and the device profile (shell / icons / menus).
 *
 * Sources (see also /workspace/ui-research/device-lines.md §4, §13):
 *   - File Island PenEvo1 (lcd.withthewill.net/PenEvo1)
 *   - Wikimon Pendulum 1.0
 *   - Humulos https://humulos.com/digimon/pen/  (defaults for disputes)
 *   - NHOKO https://nhoko.xxxxxxxx.jp/pendulum.html  (attribute triangle,
 *     battle 3 HP, poop −1 g, age at AM 12:00, 8 h DP sleep, train 0.5 DP)
 *   - digivicemon species table (sleep, min weight, stomach, lifespan h)
 *
 * Documented conflicts and the value used:
 *   (1) Call timeout 10/30 min (Humulos) vs 20 (File Island) → Humulos
 *   (2) Train weight −1 g / Megahit −8 g (Humulos) vs −2/−4 (FI) → Humulos
 *   (3) Attribute triangle: NHOKO Vac > Virus > Data > Vac
 *       (later official; 1998 Humulos had Vac > Data — we lock NHOKO)
 *   (4) Perfect WR odds: Wikimon 40%→1/8, 60%→1/4, 80%→1/2
 *       (File Island 40%→1/5; documented, Wikimon used)
 *   (5) Evolution "Training" count: File Island + plan = successful only.
 *       NHOKO says a failed train still counts as one T. We follow FI/plan
 *       for T and Effort (Effort is successful-only per Humulos).
 *   (6) Hunger cycle minutes and per-species DP max were not published
 *       for PenOG on the pages we have — placeholders, labelled below.
 *   (7) Megahit shake targets: Motimon 8 (Humulos species page). Others
 *       use 8 as a labelled placeholder until NHOKO tooltips are dumped.
 *   (8) Ultimate HeraclesKabuterimon sources: File Island Atlur/Jagamon;
 *       Wikimon Atlur/Okuwamon. Default File Island (position-consistent).
 */
(function (root) {
  'use strict';

  // Landscape shell from a 4K Nature Spirits product photo (Moonlight Mouse).
  // Percentages measured on the punched photo shell. No front pendulum window
  // (the clacker is internal); chamber is null and the HTML overlay stays hidden.
  var LAYOUT = {
    aspectW: 2000,
    aspectH: 1304,
    lcd: { left: 20.5, top: 38.113, width: 24.75, height: 24.08 },
    buttons: {
      a: { cx: 75.057, cy: 26.24, w: 12.499, h: 19.17 },
      b: { cx: 75.567, cy: 47.396, w: 11.978, h: 18.372 },
      c: { cx: 76.086, cy: 69.352, w: 12.499, h: 19.17 },
      reset: { cx: 66.832, cy: 57.625, w: 4.687, h: 7.189 }
    },
    icons_top: [
      { left: 19.756, top: 28.996, width: 5.951, height: 7.842 },
      { left: 26.518, top: 28.996, width: 5.951, height: 7.842 },
      { left: 33.281, top: 28.996, width: 5.951, height: 7.842 },
      { left: 40.043, top: 28.996, width: 5.951, height: 7.842 }
    ],
    icons_bot: [
      { left: 19.756, top: 63.111, width: 5.951, height: 7.058 },
      { left: 26.518, top: 63.111, width: 5.951, height: 7.058 },
      { left: 33.281, top: 63.111, width: 5.951, height: 7.058 },
      { left: 40.043, top: 63.111, width: 5.951, height: 7.058 }
    ],
    names_top: ['STATUS', 'FEED', 'TRAIN', 'CONNECT'],
    names_bot: ['FLUSH', 'LIGHT', 'MEDIC', 'CALL'],
    chamber: null
  };

  // Attribute triangle — NHOKO original-Pendulum page (Vac strong vs Virus).
  var TRIANGLE = {
    source: 'NHOKO-pendulum.html',
    beats: { vaccine: 'virus', data: 'vaccine', virus: 'data' }
  };

  function attrAdvantage(a, b) {
    if (!a || !b || a === 'free' || b === 'free' || a === b) return 0;
    if (TRIANGLE.beats[a] === b) return 1;
    if (TRIANGLE.beats[b] === a) return -1;
    return 0;
  }

  // Jogress attribute product (NHOKO): VaVa/VaDa→Va, VaVi/DaVi/ViVi→ matching,
  // DaDa→Da. Adult+Adult of those products become the Jogress Perfect.
  var JOGRESS_ATTR = {
    vaccine: { vaccine: 'vaccine', data: 'vaccine', virus: 'data' },
    data:    { vaccine: 'vaccine', data: 'data',    virus: 'virus' },
    virus:   { vaccine: 'data',    data: 'virus',   virus: 'virus' }
  };

  // Call / weight / poop / sleep constants. Sources in the header.
  var RULES = {
    hatchMinutes: 1,
    eggShakeBonusAt: 100,
    eggShakeBonus: 0.10,
    babyIHours: 1,
    callHungerMin: 10,          // Humulos default (conflict: FI 20)
    callStrengthMin: 10,
    callBedtimeMin: 30,         // Humulos default
    poopHours: 3,
    poopCap: 8,
    poopWeight: -1,             // NHOKO: each poop −1 g
    weightSick: 99,
    trainDp: 0.5,
    battleDp: 1,
    jogressDpFull: true,
    proteinStrength: 1,
    proteinWeight: 2,
    proteinDp: 0.25,
    meatHunger: 1,
    meatWeight: 1,
    trainWeight: -1,            // Humulos (even on fail)
    megahitWeight: -8,          // Humulos
    battleWeight: -4,           // NHOKO / File Island
    dpSleepHours: 8,            // NHOKO: 8 h sleep fills DP
    wakeHour: 8,                // all species, Humulos / NHOKO
    wakeDelayCapHour: 14,
    disturbSickStreak: 10,
    sickDeathHours: 6,
    deathSickInForm: 20,
    deathInjuryInForm: 20,
    deathCmInForm: 20,
    deathCmAtWindow: 5,
    effortMax: 40,
    hungerCycleMin: 60,         // PLACEHOLDER — unpublished for PenOG
    hungerCycleSource: 'placeholder-unverified',
    dpMaxPlaceholder: 4,        // PLACEHOLDER — per-species Max DP unpublished
    dpMaxSource: 'placeholder-unverified',
    megahitDefault: 8,          // Motimon is sourced; others placeholder
    countWindowSec: 3,          // NHOKO: 3-second COUNT
    battleHp: 3,                // NHOKO: 3 HP, single=1, super=2
    wrOdds: {                   // Wikimon (FI 40%→1/5 documented, unused)
      source: 'Wikimon-Pendulum-1.0',
      40: 1 / 8,
      60: 1 / 4,
      80: 1 / 2
    },
    perfectBattlesRequired: 30,
    perfectMinWr: 40,
    dyingSaveShakes: 100,
    dyingSaveSec: 60,
    trainCountsOnFail: false,   // FI/plan; NHOKO disagrees, documented
    setPausesGrowth: true,      // Humulos
    ageAtMidnight: true,        // NHOKO AM12:00 = 00:00
    triangle: TRIANGLE
  };

  function src(sleepH, sleepM, minW, stomach, lifeH, attr, stage, nameTw, nameEn, extra) {
    var o = {
      nameTw: nameTw,
      nameEn: nameEn,
      stage: stage,
      attribute: attr,          // 'free' | 'vaccine' | 'data' | 'virus'
      sleepHour: sleepH,        // 24h, null = no bedtime (Baby I)
      sleepMin: sleepM || 0,
      minWeight: minW,
      stomach: stomach,         // hunger cap (hearts display still 4)
      lifespanHours: lifeH,     // species table "life expectancy"
      dpMax: RULES.dpMaxPlaceholder,
      dpMaxSource: RULES.dpMaxSource,
      megahit: RULES.megahitDefault,
      megahitSource: 'placeholder-unverified',
      canBattle: stage !== 'egg' && stage !== 'baby1' && stage !== 'baby2',
      canJogress: stage === 'adult' || stage === 'perfect' || stage === 'ultimate',
      position: null            // Jogress slot, set below
    };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  // Stages: egg, baby1, baby2, child, adult, perfect, ultimate
  var MONSTERS = {
    pen_egg: src(null, 0, 5, 0, 1 / 60, 'free', 'egg', '數碼蛋', 'Digitama', {
      dpMax: 0, canBattle: false, canJogress: false, lifespanHours: 1 / 60
    }),
    // Baby I → Motimon after 1 hour. Care during Baby I does not matter.
    babumon: src(null, 0, 5, 4, 1, 'free', 'baby1', '巴布獸', 'Babumon / Bubbmon', { dpMax: 0 }),
    // Baby II. Humulos 6–12 h window; species table life 12 h. Motimon Mega Hit 8 (Humulos).
    motimon: src(19, 0, 8, 6, 12, 'free', 'baby2', '種子獸', 'Motimon', {
      dpMax: 0, lifespanMin: 6, lifespanMax: 12, megahit: 8, megahitSource: 'Humulos-Motimon'
    }),
    // Child. Lifespan = Humulos Child→Adult 20–32 h; table gives a typical hour used as max.
    tentomon:  src(20, 0, 15, 8, 28, 'vaccine', 'child', '甲蟲獸', 'Tentomon', { lifespanMin: 20, lifespanMax: 32 }),
    gotsumon:  src(20, 0, 20, 8, 32, 'data',    'child', '岩石獸', 'Gotsumon', { lifespanMin: 20, lifespanMax: 32 }),
    otamamon:  src(20, 0, 10, 6, 24, 'virus',   'child', '蝌蚪獸', 'Otamamon', { lifespanMin: 20, lifespanMax: 32 }),
    // Adult. Humulos 60–76 h to Perfect. Table life used as typical max.
    kabuterimon:  src(21, 0, 25, 10, 76, 'vaccine', 'adult', '比多獸', 'Kabuterimon', { lifespanMin: 60, lifespanMax: 76, position: 'Va1' }),
    tortomon:     src(21, 0, 20, 10, 68, 'vaccine', 'adult', '頓甲獸', 'Tortomon', { lifespanMin: 60, lifespanMax: 76, position: 'Va2' }),
    monochromon:  src(21, 0, 30, 10, 68, 'data',    'adult', '單角龍獸', 'Monochromon', { lifespanMin: 60, lifespanMax: 76, position: 'Da1' }),
    starmon:      src(21, 0, 15, 10, 60, 'data',    'adult', '星獸', 'Starmon', { lifespanMin: 60, lifespanMax: 76, position: 'Da2' }),
    kuwagamon:    src(21, 0, 20,  8, 72, 'virus',   'adult', '古加獸', 'Kuwagamon', { lifespanMin: 60, lifespanMax: 76, position: 'Vi1' }),
    gekomon:      src(21, 0, 15, 10, 64, 'virus',   'adult', '加哥怪獸', 'Gekomon', { lifespanMin: 60, lifespanMax: 76, position: 'Vi2' }),
    // Perfect. Humulos 68–86 h to Ultimate.
    atlurkabuterimon: src(22, 0, 30, 14, 80, 'vaccine', 'perfect', '超比多獸', 'AtlurKabuterimon', { lifespanMin: 68, lifespanMax: 86, position: 'VaP1' }),
    jagamon:          src(22, 0, 25, 10, 72, 'vaccine', 'perfect', '炸薯獸', 'Jagamon', { lifespanMin: 68, lifespanMax: 86, position: 'VaP2', jogressOnly: true }),
    triceramon:       src(22, 0, 30, 14, 84, 'data',    'perfect', '三角龍獸', 'Triceramon', { lifespanMin: 68, lifespanMax: 86, position: 'DaP1' }),
    piccolomon:       src(22, 0,  5,  6, 72, 'data',    'perfect', '比丘獸', 'Piccolomon', { lifespanMin: 68, lifespanMax: 86, position: 'DaP2', jogressOnly: true }),
    okuwamon:         src(22, 0, 25, 10, 76, 'virus',   'perfect', '大古加獸', 'Okuwamon', { lifespanMin: 68, lifespanMax: 86, position: 'ViP1' }),
    tonosamagekomon:  src(22, 0, 20, 10, 72, 'virus',   'perfect', '王者加哥怪獸', 'TonosamaGekomon', { lifespanMin: 68, lifespanMax: 86, position: 'ViP2', jogressOnly: true }),
    // Ultimate. No further natural window.
    heracleskabuterimon: src(22, 0, 30, 14, 120, 'vaccine', 'ultimate', '大力神甲蟲獸', 'HeraclesKabuterimon', { lifespanMin: null, lifespanMax: null, position: 'VaU' }),
    saberleomon:         src(22, 0, 20, 10,  96, 'data',    'ultimate', '刃獅獸', 'SaberLeomon', { lifespanMin: null, lifespanMax: null, position: 'DaU', jogressOnly: true }),
    metaletemon:         src(22, 0, 30,  8, 108, 'virus',   'ultimate', '金屬艾力獸', 'MetalEtemon', { lifespanMin: null, lifespanMax: null, position: 'ViU', jogressOnly: true })
  };

  // Natural Child paths — File Island PenEvo1 / Wikimon. CM = care mistakes
  // this form (reset on evo). T = successful trains this form.
  var CHILD_EVO = [
    // Motimon
    { from: 'motimon', to: 'tentomon',  cmMax: 1, cmMin: 0 },
    { from: 'motimon', to: 'gotsumon',  cmMin: 2, cmMax: 4 },
    { from: 'motimon', to: 'otamamon',  cmMin: 5 }
  ];

  var ADULT_EVO = [
    { from: 'tentomon',  to: 'kabuterimon', cmMax: 2, trainMin: 40 },
    { from: 'tentomon',  to: 'tortomon',    cmMax: 2, trainMax: 39 },
    { from: 'tentomon',  to: 'kuwagamon',   cmMin: 3, trainMin: 20 },
    { from: 'tentomon',  to: 'gekomon',     cmMin: 3, trainMax: 19 },
    { from: 'gotsumon',  to: 'monochromon', cmMax: 2, trainMin: 30 },
    { from: 'gotsumon',  to: 'tortomon',    cmMax: 2, trainMax: 29 },
    { from: 'gotsumon',  to: 'starmon',     cmMin: 3, trainMin: 30 },
    { from: 'gotsumon',  to: 'gekomon',     cmMin: 3, trainMax: 29 },
    { from: 'otamamon',  to: 'tortomon',    cmMax: 2, trainMin: 40 },
    { from: 'otamamon',  to: 'starmon',     cmMax: 2, trainMax: 39 },
    { from: 'otamamon',  to: 'kuwagamon',   cmMin: 3, trainMin: 20 },
    { from: 'otamamon',  to: 'gekomon',     cmMin: 3, trainMax: 19 }
  ];

  // Natural Perfect. Also requires wrFlag (30 battles BEFORE the window),
  // WR ≥ 40 %, and the CM / train gates. Higher WR improves odds (Wikimon).
  var PERFECT_EVO = [
    { from: ['kabuterimon', 'tortomon'],    to: 'atlurkabuterimon', cmMax: 2, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['monochromon', 'starmon'],     to: 'triceramon',       cmMax: 4, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['kuwagamon', 'gekomon'],       to: 'okuwamon',         cmMax: 1, trainMin: 40, battlesMin: 30, wrMin: 40 }
  ];

  // Natural Ultimate. 0 CM, WR > 60 %. File Island sources Atlur/Jagamon.
  var ULTIMATE_EVO = [
    { from: ['atlurkabuterimon', 'jagamon'], to: 'heracleskabuterimon', cmMax: 0, wrMin: 61,
      source: 'File-Island-PenEvo1 (Wikimon lists Atlur/Okuwamon — documented conflict, FI used)' }
  ];

  // Jogress Perfect results by attribute product (NHOKO / File Island).
  var JOGRESS_PERFECT = {
    vaccine: 'jagamon',
    data: 'piccolomon',
    virus: 'tonosamagekomon'
  };

  // Same-attribute Adult + already-Perfect of that product: Adult becomes
  // the Perfect; Perfect stays. Ultimate Jogress is pair-specific.
  var JOGRESS_ULTIMATE = [
    // File Island: First Data Perfect + Second Data Perfect
    { a: 'triceramon', b: 'piccolomon', result: 'saberleomon' },
    // First Virus Perfect + Second Virus Perfect
    { a: 'okuwamon', b: 'tonosamagekomon', result: 'metaletemon' }
    // Heracles is natural, not listed as Jogress-only on FI for 1.0.
  ];


  var EGG_TO_VER = { pen_1_0: '1.0' };

  var VERSIONS = {
    '1.0': {
      key: '1.0',
      id: 'pen-1-0',
      eggKind: 'pen_1_0',
      shell: 'pen-1-0',
      themeTw: '自然靈魂',
      labelTw: '超代 Ver.1.0 自然靈魂',
      eggLabelTw: '超代 1.0 自然靈魂數碼蛋',
      hasMegahitScreen: false,
      baby1: 'babumon',
      baby2: 'motimon',
      idleMon: 'tentomon',
      childEvo: CHILD_EVO,
      adultEvo: ADULT_EVO,
      perfectEvo: PERFECT_EVO,
      ultimateEvo: ULTIMATE_EVO,
      jogressPerfect: JOGRESS_PERFECT,
      jogressUltimate: JOGRESS_ULTIMATE,
      specialJogress: [],
      overrides: null
    }
  };

  function resolveVer(v) {
    if (!v) return '1.0';
    if (VERSIONS[v]) return v;
    if (EGG_TO_VER[v]) return EGG_TO_VER[v];
    // deviceId 'pen-1-5' / 'pen-zero'
    if (typeof v === 'string' && v.indexOf('pen-') === 0) {
      var rest = v.slice(4);
      if (rest === 'zero') return VERSIONS.zero ? 'zero' : '1.0';
      var k = rest.replace(/-/g, '.');
      if (VERSIONS[k]) return k;
    }
    if (typeof v === 'string' && v.indexOf('pen_') === 0) {
      var r2 = v.slice(4);
      if (r2 === 'zero') return VERSIONS.zero ? 'zero' : '1.0';
      var k2 = r2.replace(/_/g, '.');
      if (VERSIONS[k2]) return k2;
    }
    return '1.0';
  }

  function verData(v) {
    return VERSIONS[resolveVer(v)] || VERSIONS['1.0'];
  }

  function versionForEgg(eggKind) {
    return verData(eggKind);
  }

  function makeProfile(key) {
    var def = verData(key);
    return {
      id: def.id,
      family: 'pendulum',
      line: 'pen-og',
      versionKey: def.key,
      shell: def.shell,
      orient: 'landscape',
      version: def.key,
      layout: LAYOUT,
      iconsTop: LAYOUT.names_top,
      iconsBot: LAYOUT.names_bot,
      selectable: ['STATUS', 'FEED', 'TRAIN', 'CONNECT', 'FLUSH', 'LIGHT', 'MEDIC'],
      statusPages: ['age', 'hunger', 'strength', 'win', 'dp', 'type', 'bj'],
      buttonStyle: 'pendulum-metal',
      lightsOff: 'black-z',
      clockSet: 'pendulum',
      clock12_24: true,
      setPausesGrowth: true,
      hatchMinutes: 1,
      engine: 'PendulumEngine',
      steps: true,
      eggs: [def.eggKind],
      labelTw: def.labelTw,
      hasMegahitScreen: !!def.hasMegahitScreen,
      wakeHour: 8
    };
  }

  function registerVersion(key, def) {
    if (!def || !key) return null;
    def.key = key;
    VERSIONS[key] = def;
    if (def.eggKind) EGG_TO_VER[def.eggKind] = key;
    if (def.monsters) {
      var id;
      for (id in def.monsters) {
        if (def.monsters.hasOwnProperty(id) && !MONSTERS[id]) MONSTERS[id] = def.monsters[id];
      }
    }
    if (root.Devices && typeof root.Devices.register === 'function') {
      root.Devices.register(makeProfile(key));
    }
    return def;
  }

  function monster(id, version) {
    var base = MONSTERS[id] || null;
    if (!base) return null;
    var V = version != null && version !== '' ? verData(version) : null;
    if (V && V.overrides && V.overrides[id]) {
      var o = {}, k, ov = V.overrides[id];
      for (k in base) if (base.hasOwnProperty(k)) o[k] = base[k];
      for (k in ov) if (ov.hasOwnProperty(k)) o[k] = ov[k];
      return o;
    }
    return base;
  }



  function winRate(state) {
    var b = (state && state.battles) || 0;
    if (b <= 0) return 0;
    return 100 * ((state.wins || 0) / b);
  }

  function wrOdds(wr) {
    if (wr >= 80) return RULES.wrOdds[80];
    if (wr >= 60) return RULES.wrOdds[60];
    if (wr >= 40) return RULES.wrOdds[40];
    return 0;
  }

  function matchRule(rule, cm, train) {
    if (rule.cmMin != null && cm < rule.cmMin) return false;
    if (rule.cmMax != null && cm > rule.cmMax) return false;
    if (rule.trainMin != null && train < rule.trainMin) return false;
    if (rule.trainMax != null && train > rule.trainMax) return false;
    return true;
  }

  function naturalChild(cm, version) {
    var evos = verData(version).childEvo || CHILD_EVO;
    var i, r;
    for (i = 0; i < evos.length; i++) {
      r = evos[i];
      if (matchRule(r, cm, 0)) return r.to;
    }
    return evos.length ? evos[evos.length - 1].to : 'otamamon';
  }

  function naturalAdult(from, cm, train, version) {
    var evos = verData(version).adultEvo || ADULT_EVO;
    var i, r;
    for (i = 0; i < evos.length; i++) {
      r = evos[i];
      if (r.from === from && matchRule(r, cm, train)) return r.to;
    }
    return null;
  }

  function naturalPerfect(from, cm, train, battles, wr, wrFlag, version) {
    var evos = verData(version).perfectEvo || PERFECT_EVO;
    var i, r;
    for (i = 0; i < evos.length; i++) {
      r = evos[i];
      if (r.from.indexOf(from) < 0) continue;
      if (!wrFlag) return { to: null, reason: 'no-wr-flag' };
      if (battles < (r.battlesMin || 30)) return { to: null, reason: 'battles' };
      if (wr < (r.wrMin || 40)) return { to: null, reason: 'wr' };
      if (r.trainMin != null && train < r.trainMin) return { to: null, reason: 'train' };
      if (r.cmMax != null && cm > r.cmMax) return { to: null, reason: 'cm' };
      return { to: r.to, reason: 'ok', odds: wrOdds(wr) };
    }
    return { to: null, reason: 'no-path' };
  }

  function naturalUltimate(from, cm, wr, version) {
    var evos = verData(version).ultimateEvo || ULTIMATE_EVO;
    var i, r;
    for (i = 0; i < evos.length; i++) {
      r = evos[i];
      if (r.from.indexOf(from) < 0) continue;
      if (r.cmMax != null && cm > r.cmMax) return { to: null, reason: 'cm' };
      if (r.wrMin != null && wr < r.wrMin) return { to: null, reason: 'wr' };
      return { to: r.to, reason: 'ok' };
    }
    return { to: null, reason: 'no-path' };
  }

  function samePosition(a, b, verA, verB) {
    var ma = monster(a, verA), mb = monster(b, verB);
    if (!ma || !mb || !ma.position || !mb.position) return false;
    return ma.position === mb.position;
  }

  function jogressResult(selfId, otherId, selfVer, otherVer) {
    var V = verData(selfVer);
    var a = monster(selfId, selfVer), b = monster(otherId, otherVer != null ? otherVer : selfVer);
    if (!a || !b) return { ok: false, error: 'unknown' };
    if (!a.canJogress || !b.canJogress) return { ok: false, error: 'stage' };
    if (samePosition(selfId, otherId, selfVer, otherVer != null ? otherVer : selfVer)) {
      return { ok: false, error: 'position' };
    }
    var i, u, special = V.specialJogress || [];
    for (i = 0; i < special.length; i++) {
      u = special[i];
      if ((u.a === selfId && u.b === otherId) || (u.a === otherId && u.b === selfId)) {
        return { ok: true, to: u.result, kind: 'ultimate-special' };
      }
    }
    var ult = V.jogressUltimate || JOGRESS_ULTIMATE;
    for (i = 0; i < ult.length; i++) {
      u = ult[i];
      if ((u.a === selfId && u.b === otherId) || (u.a === otherId && u.b === selfId)) {
        return { ok: true, to: u.result, kind: 'ultimate' };
      }
    }
    // Perfect + same-attr Adult → Adult becomes that Perfect (NHOKO)
    if (a.stage === 'perfect' && b.stage === 'adult' && a.attribute === b.attribute) {
      return { ok: true, to: selfId, kind: 'perfect-stay' };
    }
    if (a.stage === 'adult' && b.stage === 'perfect' && a.attribute === b.attribute) {
      return { ok: true, to: otherId, kind: 'adult-to-perfect' };
    }
    // Adult + Adult → product Perfect from THIS device's roster (NHOKO).
    if (a.stage === 'adult' && b.stage === 'adult') {
      var prod = (JOGRESS_ATTR[a.attribute] || {})[b.attribute];
      var dest = prod && (V.jogressPerfect || JOGRESS_PERFECT)[prod];
      if (dest) return { ok: true, to: dest, kind: 'adult-jogress', product: prod };
    }
    return { ok: false, error: 'miss-match' };
  }

  var PROFILE = {
    id: 'pen-1-0',
    family: 'pendulum',
    line: 'pen-og',
    versionKey: '1.0',
    shell: 'pen-1-0',
    orient: 'landscape',
    version: '1.0',
    layout: LAYOUT,
    iconsTop: LAYOUT.names_top,
    iconsBot: LAYOUT.names_bot,
    selectable: ['STATUS', 'FEED', 'TRAIN', 'CONNECT', 'FLUSH', 'LIGHT', 'MEDIC'],
    statusPages: ['age', 'hunger', 'strength', 'win', 'dp', 'type', 'bj'],
    buttonStyle: 'pendulum-metal',
    lightsOff: 'black-z',
    clockSet: 'pendulum',
    clock12_24: true,
    setPausesGrowth: true,
    hatchMinutes: 1,
    engine: 'PendulumEngine',
    steps: true,
    eggs: ['pen_1_0'],
    labelTw: '超代 Ver.1.0 自然靈魂',
    hasMegahitScreen: false,     // 1.0 / 1.5: no MEGAHIT result screen
    wakeHour: 8
  };

  var api = {
    LAYOUT: LAYOUT,
    LAYOUT_PEN: LAYOUT,
    RULES: RULES,
    TRIANGLE: TRIANGLE,
    JOGRESS_ATTR: JOGRESS_ATTR,
    JOGRESS_PERFECT: JOGRESS_PERFECT,
    JOGRESS_ULTIMATE: JOGRESS_ULTIMATE,
    MONSTERS: MONSTERS,
    CHILD_EVO: CHILD_EVO,
    ADULT_EVO: ADULT_EVO,
    PERFECT_EVO: PERFECT_EVO,
    ULTIMATE_EVO: ULTIMATE_EVO,
    PROFILE: PROFILE,
    VERSIONS: VERSIONS,
    EGG_TO_VER: EGG_TO_VER,
    src: src,
    resolveVer: resolveVer,
    verData: verData,
    versionForEgg: versionForEgg,
    makeProfile: makeProfile,
    registerVersion: registerVersion,
    monster: monster,
    attrAdvantage: attrAdvantage,
    winRate: winRate,
    wrOdds: wrOdds,
    naturalChild: naturalChild,
    naturalAdult: naturalAdult,
    naturalPerfect: naturalPerfect,
    naturalUltimate: naturalUltimate,
    jogressResult: jogressResult,
    samePosition: samePosition
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PendulumData = api;

  // Register with the device registry when it is already loaded.
  if (root.Devices && typeof root.Devices.register === 'function') {
    root.Devices.register(PROFILE);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
