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
 *   (2) Train results follow the NHOKO table (0–5 Super → strength and
 *       weight). Humulos only spells out the ends: fail −1 g, Megahit −8 g.
 *   (3) Attribute triangle: NHOKO Vac > Virus > Data > Vac
 *       (later official; 1998 Humulos had Vac > Data — we lock NHOKO)
 *   (4) Perfect WR odds: Wikimon 40%→1/8, 60%→1/4, 80%→1/2
 *       (File Island 40%→1/5; documented, Wikimon used)
 *   (5) Evolution "Training" count: NHOKO — a failed train still counts
 *       as one T. Effort stays success-only (Humulos).
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
    aspectW: 1334,
    aspectH: 985,
    lcd: { left: 22.789, top: 30.761, width: 28.786, height: 25.584 },
    buttons: {
      a: { cx: 86.184, cy: 24.162, w: 10.045, h: 13.503 },
      b: { cx: 86.761, cy: 45.249, w: 10.345, h: 13.503 },
      c: { cx: 87.361, cy: 66.873, w: 10.42, h: 13.807 },
      reset: { cx: 79.243, cy: 56.122, w: 3.898, h: 5.381 }
    },
    icons_top: [
      { left: 22.489, top: 25.685, width: 6.447, height: 4.873 },
      { left: 29.686, top: 25.685, width: 6.447, height: 4.873 },
      { left: 36.882, top: 25.685, width: 6.447, height: 4.873 },
      { left: 44.078, top: 25.685, width: 6.447, height: 4.873 }
    ],
    icons_bot: [
      { left: 22.489, top: 56.548, width: 6.447, height: 4.873 },
      { left: 29.686, top: 56.548, width: 6.447, height: 4.873 },
      { left: 36.882, top: 56.548, width: 6.447, height: 4.873 },
      { left: 44.078, top: 56.548, width: 6.447, height: 4.873 }
    ],
    names_top: ['STATUS', 'FEED', 'TRAIN', 'CONNECT'],
    names_bot: ['FLUSH', 'LIGHT', 'MEDIC', 'CALL'],
    chamber: null
  };

  // v35: accepted round-4 master shell (1329x921) for Pendulum 1.0 and 1.5
  // (/workspace/pen-shells-v35/README.md). Same px positions as rounds 2/3;
  // percentages of the new canvas. The shell's printed icon panel is masked
  // and the app draws the icons itself (iconArt) so selection shows on them.
  var ROUND4_ICON_LEFTS = [17.908, 25.959, 34.011, 42.062];
  function round4Row(top) {
    return ROUND4_ICON_LEFTS.map(function (l) { return { left: l, top: top, width: 6.922, height: 5.646 }; });
  }
  var LAYOUT_10 = {
    aspectW: 1329,
    aspectH: 921,
    lcd: { left: 17.908, top: 36.265, width: 31.076, height: 29.425 },
    buttons: {
      a: { cx: 82.553, cy: 28.282, w: 11.227, h: 16.2 },
      b: { cx: 82.553, cy: 51.189, w: 11.227, h: 16.2 },
      c: { cx: 82.553, cy: 74.096, w: 11.227, h: 16.2 },
      reset: { cx: 75.024, cy: 62.603, w: 5.957, h: 8.596 }
    },
    icons_top: round4Row(30.51),
    icons_bot: round4Row(65.907),
    names_top: LAYOUT.names_top,
    names_bot: LAYOUT.names_bot,
    chamber: null,
    // Glyphs traced from the 1.0 shell print (same set on every 超代):
    // gauge, meat, weight lifter, arrows, poop, bulb, bandage, yell.
    iconArt: {
      src: { STATUS: 'status', FEED: 'feed', TRAIN: 'train', CONNECT: 'arrows', FLUSH: 'flush', LIGHT: 'light', MEDIC: 'medic', CALL: 'call' },
      bgTop: '#badccc',
      bgBot: '#80a577'
    }
  };
  // Versions on the round-4 shell. 2.0+ keep LAYOUT until their shells are accepted.
  var ROUND4_VERSIONS = { '1.0': true, '1.5': true };
  function layoutFor(key) { return ROUND4_VERSIONS[key] ? LAYOUT_10 : LAYOUT; }

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
    // NHOKO training table, index = number of Super hits.
    // strength is added (display caps at 4); weight is applied as-is.
    trainTable: {
      source: 'NHOKO-pendulum.html',
      strength: [0, 1, 1, 2, 2, 4],
      weight: [-1, -2, -2, -4, -4, -8]
    },
    trainWeight: -1,            // 0 Super, same table
    megahitWeight: -8,          // 5 Super, same table
    battleWeight: -4,           // NHOKO / File Island
    dpSleepHours: 8,            // NHOKO: 8 h sleep fills DP
    wakeHour: 8,                // all species, Humulos / NHOKO
    wakeDelayCapHour: 14,
    disturbSickStreak: 10,
    sickDeathHours: 6,
    healSickChance: 0.5,        // NHOKO: one bandage press cures sickness 50%
    healInjuryChance: 0.4,      // NHOKO: one bandage press cures injury 40%
    deathSickInForm: 20,
    deathInjuryInForm: 20,
    deathCmInForm: 20,
    deathCmAtWindow: 5,
    effortMax: 40,
    // No manual prints the interval. With the Will playtest: about 3 hearts
    // empty in 4 hours, same across species. NHOKO says a fuller stomach
    // slows the drop, but prints no formula, so every heart uses 80 min.
    hungerCycleMin: 80,
    hungerCycleSource: 'withthewill-3hearts-per-4h',
    dpMaxPlaceholder: 4,        // fallback only; species caps are NHOKO chart tooltips
    dpMaxSource: 'placeholder-unverified',
    megahitDefault: 8,          // Motimon is sourced; others placeholder
    countWindowSec: 3,          // NHOKO: 3-second COUNT
    battleHp: 3,                // NHOKO: 3 HP, single=1, super=2
    wrOdds: {                   // NHOKO: 40–69 → 1/8, 70–79 → 1/4, 80+ → 1/2
      source: 'NHOKO-pendulum.html',
      40: 1 / 8,
      70: 1 / 4,
      80: 1 / 2
    },
    perfectBattlesRequired: 30,
    perfectMinWr: 40,
    dyingSaveShakes: 100,
    dyingSaveSec: 60,
    trainCountsOnFail: true,    // NHOKO: a failed train still counts as one T
    setPausesGrowth: true,      // Humulos
    ageAtMidnight: true,        // NHOKO AM12:00 = 00:00
    triangle: TRIANGLE
  };

  // Humulos evolution cards (NHOKO tooltip: minimum shakes for a Megahit).
  // Names Humulos did not print stay on the labelled default of 8.
  var MEGAHIT = {
    bubbmon: 8, pabumon: 8, mochimon: 8, motimon: 8,
    tentomon: 8, gottsumon: 8, gotsumon: 8, otamamon: 8,
    kabuterimon: 4, tortamon: 4, tortomon: 4, kuwagamon: 5, gekomon: 5,
    atlurkabuterimon: 14, megakabuterimon: 14, jyagamon: 14, jagamon: 14,
    angewomon: 14, triceramon: 9, okuwamon: 13, tonosamagekomon: 13,
    heraklekabuterimon: 24, herculeskabuterimon: 24, heracleskabuterimon: 24,
    holydramon: 24, magnadramon: 24, saberleomon: 26, metaletemon: 23,
    pukamon: 8, bukamon: 8, coelamon: 10, ebidramon: 10, gesomon: 5,
    whamon: 2, anomalocarimon: 3, hangyomon: 3, divermon: 3,
    marinedevimon: 4, marindevimon: 4, dagomon: 4, dragomon: 4,
    marineangemon: 7, marinangemon: 7, metalseadramon: 6, plesiomon: 6,
    petimeramon: 9, petitmeramon: 9, picodevimon: 9,
    hanumon: 3, apemon: 3, garurumon: 3, meramon: 6, wizarmon: 6,
    dokugumon: 4, weregarurumon: 5, deathmeramon: 4,
    pumpmon: 4, pumpkinmon: 4, vamdemon: 5, myotismon: 5,
    ladydevimon: 5, fantomon: 5, phantomon: 5,
    skullmammon: 6, skullmammothmon: 6, boltmon: 4,
    palmon: 8, mushmon: 8, mushroommon: 8, vdramon: 4, veedramon: 4,
    birdramon: 4, togemon: 6, aerovdramon: 7, aeroveedramon: 7, garudamon: 7,
    blossomon: 5, lilimon: 5, lillymon: 5, delumon: 5, deramon: 5,
    jureimon: 6, jyureimon: 6, gerbemon: 6,
    toyagumon: 9, kokuwamon: 9, hagurumon: 9, revolmon: 4, thunderballmon: 6,
    guardromon: 5, mechanorimon: 5, mekanorimon: 5, metalgreymon: 5,
    andromon: 5, cyberdramon: 5, knightmon: 4, bigmamemon: 4, warumonzaemon: 4,
    metalgarurumon: 8, mugendramon: 8, machinedramon: 8,
    venomvamdemon: 8, venommyotismon: 8,
    yukimibotamon: 9, snowbotamon: 9, nyaromon: 9, agumon: 9, gabumon: 9,
    plotmon: 9, salamon: 9, angemon: 4, tailmon: 4, gatomon: 4,
    asuramon: 5, metalmamemon: 4, holyangemon: 4, omegamon: 8, omnimon: 8
  };
  function megahitFor(nameEn) {
    var parts = String(nameEn || '').split(/[\/|,]/);
    var i, k;
    for (i = 0; i < parts.length; i++) {
      k = parts[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (MEGAHIT[k] != null) return MEGAHIT[k];
    }
    return null;
  }

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
    var shakes = megahitFor(o.nameEn);
    if (shakes != null && o.megahitSource === 'placeholder-unverified') {
      o.megahit = shakes;
      o.megahitSource = 'Humulos-card';
    }
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
      layout: layoutFor(def.key),
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

  // NHOKO pendulum.html chart tooltips: 名前、寿命、DP、メガヒット.
  // One shared id keeps the version that first defined it. ZERO's
  // Garurumon (36) and WereGarurumon (36) differ and are overrides.
  var NHOKO_DP = {
    babumon: 20, motimon: 20,
    tentomon: 20, gotsumon: 20, otamamon: 20,
    kabuterimon: 30, tortomon: 25, monochromon: 30, starmon: 25, kuwagamon: 25, gekomon: 30,
    atlurkabuterimon: 40, jagamon: 30, triceramon: 40, piccolomon: 30, okuwamon: 35, tonosamagekomon: 40,
    heracleskabuterimon: 50, saberleomon: 45, metaletemon: 50,
    tailmon: 30, angewomon: 40, holydramon: 50,
    pichimon: 20, pukamon: 25,
    gomamon: 25, ganimon: 25, shakomon: 25,
    ikkakumon: 30, rukamon: 25, seadramon: 30, coelamon: 25, ebidramon: 30, gesomon: 25, octomon: 30,
    zudomon: 40, whamon: 30, megaseadramon: 40, anomalocarimon: 30, hangyomon: 35, marinedevimon: 35, dagomon: 40,
    marineangemon: 40, metalseadramon: 45, plesiomon: 50, pukumon: 50,
    mokumon: 20, petitmeramon: 25,
    bakumon: 30, candmon: 25, picodevimon: 25,
    hanumon: 30, garurumon: 30, meramon: 30, wizarmon: 25, devimon: 35, bakemon: 25, dokugumon: 30,
    mammon: 40, weregarurumon: 35, deathmeramon: 35, pumpmon: 30, vamdemon: 35, ladydevimon: 40, phantomon: 30,
    skullmammon: 40, boltmon: 45, piemon: 50, demon: 50,
    nyokimon: 20, pyocomon: 25,
    piyomon: 30, floramon: 25, palmon: 20, mushmon: 28,
    vdramon: 40, birdramon: 35, togemon: 35, kiwimon: 25, woodmon: 35, redveggiemon: 25,
    aerovdramon: 50, garudamon: 35, blossomon: 35, lillymon: 45, deramon: 30, jureimon: 35, garbamon: 30,
    hououmon: 45, gryphomon: 40, rosemon: 50, pinocchimon: 45,
    choromon: 20, kapurimon: 20,
    toyagumon: 28, kokuwamon: 26, hagurumon: 26,
    greymon: 42, revolmon: 30, tankmon: 36, thunderballmon: 30, clockmon: 30, guardromon: 34, mechanorimon: 30,
    metalgreymon: 48, andromon: 38, cyberdramon: 48, knightmon: 36, bigmamemon: 38, megadramon: 40, warumonzaemon: 40,
    wargreymon: 46, metalgarurumon: 44, mugendramon: 50, venomvamdemon: 48,
    yukimibotamon: 20, nyaromon: 20,
    agumon: 30, gabumon: 28, plotmon: 28,
    leomon: 38, igamon: 30, angemon: 34,
    asuramon: 38, metalmamemon: 38, holyangemon: 40, omegamon: 60
  };

  // NHOKO chart tooltip メガヒット. Only fills species the Humulos card
  // name match left on the default of 8. ガニモン's tooltip is "メガヒット8".
  var NHOKO_MEGAHIT = {
    monochromon: 3, starmon: 3, piccolomon: 9,
    pichimon: 8, gomamon: 8, ganimon: 8, shakomon: 8,
    ikkakumon: 4, rukamon: 4, seadramon: 10, octomon: 5,
    zudomon: 2, megaseadramon: 3, pukumon: 5,
    mokumon: 9, bakumon: 9, candmon: 9, devimon: 4, bakemon: 4,
    mammon: 5, piemon: 7, demon: 7,
    nyokimon: 8, pyocomon: 8, piyomon: 8, floramon: 8,
    kiwimon: 6, woodmon: 5, redveggiemon: 5, garbamon: 6,
    hououmon: 7, gryphomon: 8, rosemon: 8, pinocchimon: 8,
    choromon: 9, kapurimon: 9, greymon: 4, tankmon: 6, clockmon: 6,
    megadramon: 4, wargreymon: 7, leomon: 4, igamon: 6
  };

  function stampNhokoDp(id, m) {
    if (!m || m.stage === 'egg') return m;
    if (NHOKO_DP[id] != null) {
      m.dpMax = NHOKO_DP[id];
      m.dpMaxSource = 'nhoko-pendulum-tooltip';
    }
    if (m.megahitSource === 'placeholder-unverified' && NHOKO_MEGAHIT[id] != null) {
      m.megahit = NHOKO_MEGAHIT[id];
      m.megahitSource = 'nhoko-pendulum-tooltip';
    }
    return m;
  }

  Object.keys(MONSTERS).forEach(function (id) { stampNhokoDp(id, MONSTERS[id]); });

  function registerVersion(key, def) {
    if (!def || !key) return null;
    def.key = key;
    VERSIONS[key] = def;
    if (def.eggKind) EGG_TO_VER[def.eggKind] = key;
    if (def.monsters) {
      var id;
      for (id in def.monsters) {
        if (!def.monsters.hasOwnProperty(id)) continue;
        stampNhokoDp(id, def.monsters[id]);
        if (!MONSTERS[id]) MONSTERS[id] = def.monsters[id];
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
    if (wr >= 70) return RULES.wrOdds[70];
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
    layout: LAYOUT_10,
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
    LAYOUT_10: LAYOUT_10,
    layoutFor: layoutFor,
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
