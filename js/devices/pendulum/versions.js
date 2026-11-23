/**
 * Original Pendulum Ver.1.5–5.5 and ZERO — rosters, evos, Jogress maps,
 * and per-version device profiles. Shared rules, layout, and UI family
 * live in data.js / engine.js / ui.js. Ver.1.0 stays in data.js and is
 * not rewritten.
 *
 * Evolution sources: File Island PenEvo1 / PenEvo2 / PenEvo3 / PenEvo4 /
 * PenEvo5 / PenEvoZero (lcd.withthewill.net). Species care stats
 * (sleep, min weight, stomach, life expectancy, attribute) from
 * digivicemon.com Pendulum 1–5 guides. ZERO species without a
 * published table use NHOKO stage bedtimes + Humulos stage windows
 * and typical min-weights, labelled stage-defaults.
 *
 * Documented path resolutions (not invented numbers):
 *   (A) 3.0 Garurumon File Island "Training 0-30" overlaps Wizarmon
 *       "30+". We use Garurumon trainMax 29 so 30 uniquely reaches
 *       Wizarmon (intent of exclusive bands).
 *   (B) 4.0/4.5 File Island lists Piyomon Adult paths as both "0-3"
 *       (V-Dramon / Birdramon) and "3+" (Togemon / Woodmon). 1.0-style
 *       exclusive bands are 0-2 / 3+; we use those so the 3+ paths
 *       are reachable. Documented.
 *   (C) 4.0/4.5 Mushmon has a 1 CM gap (0 → V-Dramon/Birdramon, 2+ →
 *       Woodmon/RedVeggiemon). We treat 1 as 1+ with the 2+ path so
 *       the Child always has a destination. Documented.
 *
 * Placeholders that stay labelled: hunger-cycle minutes, per-species
 * Max DP, the battle hit table, and megahit counts Humulos did not
 * print. digivicemon Max DP of 25–50 on Ver.4/5 was rejected as the
 * wrong scale (OG training costs 0.5 DP; COLOR uses a ~50 scale).
 * The NHOKO train-result table and the 40/70/80 win-rate bands are in use.
 */
(function (root) {
  'use strict';
  var D = root.PendulumData;
  if (!D || typeof D.registerVersion !== 'function') return;

  var src = D.src;

  function baby1(minW, stomach, tw, en) {
    return src(null, 0, minW, stomach, 1, 'free', 'baby1', tw, en, { dpMax: 0 });
  }
  function baby2(minW, stomach, life, tw, en) {
    return src(19, 0, minW, stomach, life, 'free', 'baby2', tw, en, {
      dpMax: 0, lifespanMin: 6, lifespanMax: 12
    });
  }
  function child(minW, stomach, life, attr, tw, en) {
    return src(20, 0, minW, stomach, life, attr, 'child', tw, en, {
      lifespanMin: 20, lifespanMax: 32
    });
  }
  function adult(minW, stomach, life, attr, pos, tw, en) {
    return src(21, 0, minW, stomach, life, attr, 'adult', tw, en, {
      lifespanMin: 60, lifespanMax: 76, position: pos
    });
  }
  function perfect(minW, stomach, life, attr, pos, tw, en, jogressOnly) {
    var extra = { lifespanMin: 68, lifespanMax: 86, position: pos };
    if (jogressOnly) extra.jogressOnly = true;
    return src(22, 0, minW, stomach, life, attr, 'perfect', tw, en, extra);
  }
  function ultimate(minW, stomach, life, attr, pos, tw, en, jogressOnly) {
    var extra = { lifespanMin: null, lifespanMax: null, position: pos };
    if (jogressOnly) extra.jogressOnly = true;
    return src(22, 0, minW, stomach, life, attr, 'ultimate', tw, en, extra);
  }

  function remap(evos, map) {
    return evos.map(function (r) {
      var o = {}, k;
      for (k in r) if (r.hasOwnProperty(k)) o[k] = r[k];
      if (Object.prototype.toString.call(o.from) === '[object Array]') {
        o.from = o.from.map(function (f) { return map[f] || f; });
      } else if (map[o.from]) o.from = map[o.from];
      if (map[o.to]) o.to = map[o.to];
      return o;
    });
  }

  var v10 = D.VERSIONS['1.0'];


  // -------------------------------------------------------------------------
  // Ver.1.5 Nature Spirits — same paths as 1.0 with three swaps:
  // Tortomon→Tailmon (Va2), Jagamon→Angewomon (VaP2),
  // HeraclesKabuterimon→Holydramon (VaU from Atlur/Angewomon).
  // No MEGAHIT result screen (same as 1.0).
  // -------------------------------------------------------------------------
  var m15 = {
    tailmon:     adult(20, 10, 68, 'vaccine', 'Va2', '大尾獸', 'Tailmon'),
    angewomon:   perfect(25, 10, 72, 'vaccine', 'VaP2', '天女獸', 'Angewomon', true),
    holydramon:  ultimate(30, 14, 120, 'vaccine', 'VaU', '神聖龍獸', 'Holydramon', false)
  };
  D.registerVersion('1.5', {
    id: 'pen-1-5',
    eggKind: 'pen_1_5',
    shell: 'pen-1-5',
    themeTw: '自然靈魂',
    labelTw: '超代 Ver.1.5 自然靈魂',
    eggLabelTw: '超代 1.5 自然靈魂數碼蛋',
    hasMegahitScreen: false,
    baby1: 'babumon',
    baby2: 'motimon',
    idleMon: 'tentomon',
    monsters: m15,
    childEvo: v10.childEvo,
    adultEvo: remap(v10.adultEvo, { tortomon: 'tailmon' }),
    perfectEvo: remap(v10.perfectEvo, { tortomon: 'tailmon' }),
    ultimateEvo: [{
      from: ['atlurkabuterimon', 'angewomon'], to: 'holydramon', cmMax: 0, wrMin: 61,
      source: 'File-Island-PenEvo1 (1.5 swap of Heracles)'
    }],
    jogressPerfect: { vaccine: 'angewomon', data: 'piccolomon', virus: 'tonosamagekomon' },
    jogressUltimate: [
      { a: 'triceramon', b: 'piccolomon', result: 'saberleomon' },
      { a: 'okuwamon', b: 'tonosamagekomon', result: 'metaletemon' }
    ],
    specialJogress: []
  });

  // -------------------------------------------------------------------------
  // Ver.2.0 / 2.5 Deep Savers
  // 2.5 swaps: Coelamon→Ebidramon (Da2), Anomalocarimon→Hangyomon (DaP2),
  // MetalSeadramon→Plesiomon (DaU). MEGAHIT screen from 2.0 on.
  // Stats: digivicemon Pendulum 2 guide (Seadramon minWeight 21 is as published).
  // -------------------------------------------------------------------------
  var m2 = {
    pichimon:        baby1(5, 4, '比基獸', 'Pichimon'),
    pukamon:         baby2(7, 8, 8, '布加獸', 'Pukamon'),
    gomamon:         child(20, 8, 20, 'vaccine', '哥瑪獸', 'Gomamon'),
    ganimon:         child(10, 8, 26, 'data', '加尼獸', 'Ganimon'),
    shakomon:        child(10, 6, 22, 'virus', '修羅獸', 'Shakomon'),
    ikkakumon:       adult(25, 10, 68, 'vaccine', 'Va1', '一角獸', 'Ikkakumon'),
    rukamon:         adult(15, 10, 64, 'vaccine', 'Va2', '海豚獸', 'Rukamon'),
    seadramon:       adult(21, 10, 68, 'data', 'Da1', '海龍獸', 'Seadramon'),
    coelamon:        adult(20, 10, 60, 'data', 'Da2', '超古加獸', 'Coelamon'),
    ebidramon:       adult(25, 10, 60, 'data', 'Da2', '蝦龍獸', 'Ebidramon'),
    gesomon:         adult(30, 8, 68, 'virus', 'Vi1', '怪蛙獸', 'Gesomon'),
    octomon:         adult(25, 10, 64, 'virus', 'Vi2', '八爪魚獸', 'Octomon'),
    zudomon:         perfect(35, 14, 76, 'vaccine', 'VaP1', '祖頓獸', 'Zudomon'),
    whamon:          perfect(50, 8, 72, 'vaccine', 'VaP2', '鯨獸', 'Whamon', true),
    megaseadramon:   perfect(25, 12, 72, 'data', 'DaP1', '超海龍獸', 'MegaSeadramon'),
    anomalocarimon:  perfect(20, 10, 72, 'data', 'DaP2', '異龍獸', 'Anomalocarimon', true),
    hangyomon:       perfect(20, 10, 72, 'data', 'DaP2', '人魚獸', 'Hangyomon', true),
    marinedevimon:   perfect(25, 10, 74, 'virus', 'ViP1', '海洋惡魔獸', 'MarineDevimon'),
    dagomon:         perfect(30, 10, 72, 'virus', 'ViP2', '達貢獸', 'Dagomon', true),
    marineangemon:   ultimate(5, 6, 120, 'vaccine', 'VaU', '海洋天使獸', 'MarineAngemon'),
    metalseadramon:  ultimate(30, 12, 100, 'data', 'DaU', '金屬海龍獸', 'MetalSeadramon', true),
    plesiomon:       ultimate(30, 12, 100, 'data', 'DaU', '蛇頸龍獸', 'Plesiomon', true),
    pukumon:         ultimate(20, 10, 114, 'virus', 'ViU', '普庫獸', 'Pukumon', true)
  };
  var child2 = [
    { from: 'pukamon', to: 'gomamon',  cmMin: 0, cmMax: 1 },
    { from: 'pukamon', to: 'ganimon',  cmMin: 2, cmMax: 3 },
    { from: 'pukamon', to: 'shakomon', cmMin: 4 }
  ];
  var adult2_0 = [
    { from: 'gomamon',  to: 'ikkakumon',  cmMax: 2, trainMin: 30 },
    { from: 'gomamon',  to: 'rukamon',    cmMax: 2, trainMax: 29 },
    { from: 'gomamon',  to: 'coelamon',   cmMin: 3, trainMin: 30 },
    { from: 'gomamon',  to: 'octomon',    cmMin: 3, trainMax: 29 },
    { from: 'ganimon',  to: 'rukamon',    cmMax: 2, trainMin: 30 },
    { from: 'ganimon',  to: 'seadramon',  cmMax: 2, trainMax: 29 },
    { from: 'ganimon',  to: 'coelamon',   cmMin: 3, trainMin: 20 },
    { from: 'ganimon',  to: 'gesomon',    cmMin: 3, trainMax: 19 },
    { from: 'shakomon', to: 'ikkakumon',  cmMax: 0, trainMin: 35 },
    { from: 'shakomon', to: 'seadramon',  cmMax: 0, trainMax: 34 },
    { from: 'shakomon', to: 'gesomon',    cmMin: 1, trainMin: 30 },
    { from: 'shakomon', to: 'octomon',    cmMin: 1, trainMax: 29 }
  ];
  var adult2_5 = remap(adult2_0, { coelamon: 'ebidramon' });
  var perfect2_0 = [
    { from: ['ikkakumon', 'rukamon'],                 to: 'zudomon',        cmMax: 2, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['seadramon', 'coelamon'],                to: 'megaseadramon',  cmMax: 4, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['gesomon', 'octomon'],                   to: 'marinedevimon',  cmMax: 1, trainMin: 40, battlesMin: 30, wrMin: 40 }
  ];
  var perfect2_5 = remap(perfect2_0, { coelamon: 'ebidramon' });
  var ult2_0 = [
    { from: ['zudomon', 'whamon'], to: 'marineangemon', cmMax: 0, wrMin: 61, source: 'File-Island-PenEvo2' }
  ];
  D.registerVersion('2.0', {
    id: 'pen-2-0', eggKind: 'pen_2_0', shell: 'pen-2-0',
    themeTw: '深海拯救者', labelTw: '超代 Ver.2.0 深海拯救者',
    eggLabelTw: '超代 2.0 深海拯救者數碼蛋',
    hasMegahitScreen: true, baby1: 'pichimon', baby2: 'pukamon', idleMon: 'gomamon',
    monsters: m2, childEvo: child2, adultEvo: adult2_0, perfectEvo: perfect2_0,
    ultimateEvo: ult2_0,
    jogressPerfect: { vaccine: 'whamon', data: 'anomalocarimon', virus: 'dagomon' },
    jogressUltimate: [
      { a: 'megaseadramon', b: 'anomalocarimon', result: 'metalseadramon' },
      { a: 'marinedevimon', b: 'dagomon', result: 'pukumon' }
    ],
    specialJogress: []
  });
  D.registerVersion('2.5', {
    id: 'pen-2-5', eggKind: 'pen_2_5', shell: 'pen-2-5',
    themeTw: '深海拯救者', labelTw: '超代 Ver.2.5 深海拯救者',
    eggLabelTw: '超代 2.5 深海拯救者數碼蛋',
    hasMegahitScreen: true, baby1: 'pichimon', baby2: 'pukamon', idleMon: 'gomamon',
    monsters: m2, childEvo: child2, adultEvo: adult2_5, perfectEvo: perfect2_5,
    ultimateEvo: ult2_0,
    jogressPerfect: { vaccine: 'whamon', data: 'hangyomon', virus: 'dagomon' },
    jogressUltimate: [
      { a: 'megaseadramon', b: 'hangyomon', result: 'plesiomon' },
      { a: 'marinedevimon', b: 'dagomon', result: 'pukumon' }
    ],
    specialJogress: []
  });

  // -------------------------------------------------------------------------
  // Ver.3.0 / 3.5 Nightmare Soldiers
  // 3.5 swaps: Bakemon→Dokugumon (Vi2), Vamdemon→LadyDevimon (ViP1),
  // Piemon→Demon (ViU).
  // Garurumon trainMax 29 — see header (A).
  // Stats: digivicemon Pendulum 3 guide. Garurumon is Vaccine on 3.x
  // (ZERO Garurumon is Data — version override there).
  // -------------------------------------------------------------------------
  var m3 = {
    mokumon:         baby1(5, 4, '煙霧獸', 'Mokumon'),
    petitmeramon:    baby2(6, 6, 8, '小火焰獸', 'PetitMeramon'),
    bakumon:         child(20, 10, 24, 'vaccine', '夢貘獸', 'Bakumon'),
    candmon:         child(8, 6, 20, 'data', '蠟燭獸', 'Candmon'),
    picodevimon:     child(8, 6, 22, 'virus', '小惡魔獸', 'PicoDevimon'),
    hanumon:         adult(20, 15, 64, 'vaccine', 'Va1', '哈努獸', 'Hanumon'),
    garurumon:       adult(20, 15, 68, 'vaccine', 'Va2', '加魯魯獸', 'Garurumon'),
    meramon:         adult(18, 20, 62, 'data', 'Da1', '火焰獸', 'Meramon'),
    wizarmon:        adult(15, 8, 64, 'data', 'Da2', '巫師獸', 'Wizarmon'),
    devimon:         adult(15, 8, 68, 'virus', 'Vi1', '惡魔獸', 'Devimon'),
    bakemon:         adult(10, 15, 62, 'virus', 'Vi2', '鬼菇獸', 'Bakemon'),
    dokugumon:       adult(20, 15, 62, 'virus', 'Vi2', '毒蜘蛛獸', 'Dokugumon'),
    mammon:          perfect(40, 20, 68, 'vaccine', 'VaP1', '猛獁獸', 'Mammon'),
    weregarurumon:   perfect(18, 10, 70, 'vaccine', 'VaP2', '獸人加魯魯', 'WereGarurumon', true),
    deathmeramon:    perfect(20, 20, 78, 'data', 'DaP1', '死亡火焰獸', 'DeathMeramon'),
    pumpmon:         perfect(20, 15, 72, 'data', 'DaP2', '南瓜獸', 'Pumpmon', true),
    vamdemon:        perfect(18, 10, 76, 'virus', 'ViP1', '吸血魔獸', 'Vamdemon'),
    ladydevimon:     perfect(18, 10, 76, 'virus', 'ViP1', '女惡魔獸', 'LadyDevimon'),
    phantomon:       perfect(15, 15, 74, 'virus', 'ViP2', '幽靈獸', 'Phantomon', true),
    skullmammon:     ultimate(30, 18, 112, 'vaccine', 'VaU', '骷髏猛獁獸', 'SkullMammon'),
    boltmon:         ultimate(25, 20, 108, 'data', 'DaU', '雷霆獸', 'Boltmon', true),
    piemon:          ultimate(18, 8, 120, 'virus', 'ViU', '小丑獸', 'Piemon', true),
    demon:           ultimate(18, 8, 120, 'virus', 'ViU', '惡魔獸（究極）', 'Demon', true)
  };
  var child3 = [
    { from: 'petitmeramon', to: 'bakumon',     cmMin: 0, cmMax: 2 },
    { from: 'petitmeramon', to: 'candmon',     cmMin: 3, cmMax: 5 },
    { from: 'petitmeramon', to: 'picodevimon', cmMin: 6 }
  ];
  var adult3_0 = [
    { from: 'bakumon',     to: 'hanumon',    cmMax: 2, trainMin: 25 },
    { from: 'bakumon',     to: 'meramon',    cmMax: 2, trainMax: 24 },
    { from: 'bakumon',     to: 'garurumon',  cmMin: 3, trainMax: 29 }, // FI 0-30, see (A)
    { from: 'bakumon',     to: 'wizarmon',   cmMin: 3, trainMin: 30 },
    { from: 'candmon',     to: 'hanumon',    cmMax: 1, trainMin: 30 },
    { from: 'candmon',     to: 'meramon',    cmMax: 1, trainMax: 29 },
    { from: 'candmon',     to: 'wizarmon',   cmMin: 2, trainMax: 29 },
    { from: 'candmon',     to: 'devimon',    cmMin: 2, trainMin: 30 },
    { from: 'picodevimon', to: 'meramon',    cmMax: 2, trainMax: 29 },
    { from: 'picodevimon', to: 'devimon',    cmMax: 2, trainMin: 30 },
    { from: 'picodevimon', to: 'wizarmon',   cmMin: 3, trainMin: 25 },
    { from: 'picodevimon', to: 'bakemon',    cmMin: 3, trainMax: 24 }
  ];
  var adult3_5 = remap(adult3_0, { bakemon: 'dokugumon' });
  var perfect3_0 = [
    { from: ['hanumon', 'garurumon'],          to: 'mammon',       cmMax: 2, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['meramon', 'wizarmon'],           to: 'deathmeramon', cmMax: 4, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['devimon', 'bakemon'],            to: 'vamdemon',     cmMax: 1, trainMin: 40, battlesMin: 30, wrMin: 40 }
  ];
  var perfect3_5 = remap(perfect3_0, { bakemon: 'dokugumon', vamdemon: 'ladydevimon' });
  var ult3_0 = [
    { from: ['mammon', 'weregarurumon'], to: 'skullmammon', cmMax: 0, wrMin: 61, source: 'File-Island-PenEvo3' }
  ];
  D.registerVersion('3.0', {
    id: 'pen-3-0', eggKind: 'pen_3_0', shell: 'pen-3-0',
    themeTw: '夢魘士兵', labelTw: '超代 Ver.3.0 夢魘士兵',
    eggLabelTw: '超代 3.0 夢魘士兵數碼蛋',
    hasMegahitScreen: true, baby1: 'mokumon', baby2: 'petitmeramon', idleMon: 'bakumon',
    monsters: m3, childEvo: child3, adultEvo: adult3_0, perfectEvo: perfect3_0,
    ultimateEvo: ult3_0,
    jogressPerfect: { vaccine: 'weregarurumon', data: 'pumpmon', virus: 'phantomon' },
    jogressUltimate: [
      { a: 'deathmeramon', b: 'pumpmon', result: 'boltmon' },
      { a: 'vamdemon', b: 'phantomon', result: 'piemon' }
    ],
    specialJogress: []
  });
  D.registerVersion('3.5', {
    id: 'pen-3-5', eggKind: 'pen_3_5', shell: 'pen-3-5',
    themeTw: '夢魘士兵', labelTw: '超代 Ver.3.5 夢魘士兵',
    eggLabelTw: '超代 3.5 夢魘士兵數碼蛋',
    hasMegahitScreen: true, baby1: 'mokumon', baby2: 'petitmeramon', idleMon: 'bakumon',
    monsters: m3, childEvo: child3, adultEvo: adult3_5, perfectEvo: perfect3_5,
    ultimateEvo: ult3_0,
    jogressPerfect: { vaccine: 'weregarurumon', data: 'pumpmon', virus: 'phantomon' },
    jogressUltimate: [
      { a: 'deathmeramon', b: 'pumpmon', result: 'boltmon' },
      { a: 'ladydevimon', b: 'phantomon', result: 'demon' }
    ],
    specialJogress: []
  });

  // -------------------------------------------------------------------------
  // Ver.4.0 / 4.5 Wind Guardians
  // 4.5 swaps: Floramon→Palmon (Child Data), Blossomon→Lillymon (DaP1),
  // Gryphomon→Rosemon (DaU).
  // Piyomon 0-2 / 3+ — see header (B). Mushmon CM 1 treated as 1+ — (C).
  // Stats: digivicemon Pendulum 4 guide (Max DP column unused, wrong scale).
  // -------------------------------------------------------------------------
  var m4 = {
    nyokimon:        baby1(5, 4, '綠葉種子獸', 'Nyokimon'),
    pyocomon:        baby2(4, 6, 6, '比高獸', 'Pyocomon'),
    piyomon:         child(15, 10, 22, 'vaccine', '比丘獸', 'Piyomon'),
    floramon:        child(10, 10, 18, 'data', '花拉獸', 'Floramon'),
    palmon:          child(15, 6, 22, 'data', '巴魯獸', 'Palmon'),
    mushmon:         child(12, 8, 20, 'virus', '蘑菇獸', 'Mushmon'),
    vdramon:         adult(25, 20, 62, 'vaccine', 'Va1', 'V龍獸', 'V-Dramon'),
    birdramon:       adult(30, 20, 64, 'vaccine', 'Va2', '巴多拉獸', 'Birdramon'),
    togemon:         adult(20, 20, 60, 'data', 'Da1', '仙人掌獸', 'Togemon'),
    kiwimon:         adult(15, 8, 62, 'data', 'Da2', '奇異鳥獸', 'Kiwimon'),
    woodmon:         adult(18, 12, 68, 'virus', 'Vi1', '木乃伊獸', 'Woodmon'),
    redveggiemon:    adult(12, 20, 64, 'virus', 'Vi2', '紅蔬菜獸', 'RedVeggiemon'),
    aerovdramon:     perfect(30, 25, 84, 'vaccine', 'VaP1', '空襲V龍獸', 'AeroV-Dramon'),
    garudamon:       perfect(25, 15, 78, 'vaccine', 'VaP2', '迦樓羅獸', 'Garudamon', true),
    blossomon:       perfect(20, 15, 72, 'data', 'DaP1', '花朵獸', 'Blossomon'),
    lillymon:        perfect(16, 8, 84, 'data', 'DaP1', '莉莉蒙', 'Lillymon'),
    deramon:         perfect(25, 10, 70, 'data', 'DaP2', '飛龍獸', 'Deramon', true),
    jureimon:        perfect(40, 10, 68, 'virus', 'ViP1', '樹精獸', 'Jureimon'),
    garbamon:        perfect(15, 20, 62, 'virus', 'ViP2', '垃圾獸', 'Garbamon', true),
    hououmon:        ultimate(30, 20, 96, 'vaccine', 'VaU', '鳳凰獸', 'Hououmon'),
    gryphomon:       ultimate(35, 20, 100, 'data', 'DaU', '獅鷲獸', 'Gryphomon', true),
    rosemon:         ultimate(19, 8, 114, 'data', 'DaU', '薔薇獸', 'Rosemon', true),
    pinocchimon:     ultimate(10, 6, 102, 'virus', 'ViU', '木偶獸', 'Pinocchimon', true)
  };
  var child4_0 = [
    { from: 'pyocomon', to: 'piyomon',  cmMin: 0, cmMax: 3 },
    { from: 'pyocomon', to: 'floramon', cmMin: 4, cmMax: 5 },
    { from: 'pyocomon', to: 'mushmon',  cmMin: 6 }
  ];
  var child4_5 = remap(child4_0, { floramon: 'palmon' });
  // Adult: Piyomon 0-2 / 3+ (B). Mushmon 0 vs 1+ (C).
  function adult4(flora) {
    return [
      { from: 'piyomon', to: 'vdramon',      cmMax: 2, trainMin: 25 },
      { from: 'piyomon', to: 'birdramon',    cmMax: 2, trainMax: 24 },
      { from: 'piyomon', to: 'togemon',      cmMin: 3, trainMin: 30 },
      { from: 'piyomon', to: 'woodmon',      cmMin: 3, trainMax: 29 },
      { from: flora,     to: 'togemon',      cmMax: 2, trainMin: 25 },
      { from: flora,     to: 'kiwimon',      cmMax: 2, trainMax: 24 },
      { from: flora,     to: 'woodmon',      cmMin: 3, trainMin: 30 },
      { from: flora,     to: 'redveggiemon', cmMin: 3, trainMax: 29 },
      { from: 'mushmon',  to: 'vdramon',      cmMax: 0, trainMin: 30 },
      { from: 'mushmon',  to: 'birdramon',    cmMax: 0, trainMax: 29 },
      { from: 'mushmon',  to: 'woodmon',      cmMin: 1, trainMin: 25 },
      { from: 'mushmon',  to: 'redveggiemon', cmMin: 1, trainMax: 24 }
    ];
  }
  var perfect4_0 = [
    { from: ['vdramon', 'birdramon'],           to: 'aerovdramon', cmMax: 2, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['togemon', 'kiwimon'],             to: 'blossomon',   cmMax: 4, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['woodmon', 'redveggiemon'],        to: 'jureimon',    cmMax: 1, trainMin: 40, battlesMin: 30, wrMin: 40 }
  ];
  var perfect4_5 = remap(perfect4_0, { blossomon: 'lillymon' });
  var ult4 = [
    { from: ['aerovdramon', 'garudamon'], to: 'hououmon', cmMax: 0, wrMin: 61, source: 'File-Island-PenEvo4' }
  ];
  D.registerVersion('4.0', {
    id: 'pen-4-0', eggKind: 'pen_4_0', shell: 'pen-4-0',
    themeTw: '風之守護者', labelTw: '超代 Ver.4.0 風之守護者',
    eggLabelTw: '超代 4.0 風之守護者數碼蛋',
    hasMegahitScreen: true, baby1: 'nyokimon', baby2: 'pyocomon', idleMon: 'piyomon',
    monsters: m4, childEvo: child4_0, adultEvo: adult4('floramon'), perfectEvo: perfect4_0,
    ultimateEvo: ult4,
    jogressPerfect: { vaccine: 'garudamon', data: 'deramon', virus: 'garbamon' },
    jogressUltimate: [
      { a: 'blossomon', b: 'deramon', result: 'gryphomon' },
      { a: 'jureimon', b: 'garbamon', result: 'pinocchimon' }
    ],
    specialJogress: []
  });
  D.registerVersion('4.5', {
    id: 'pen-4-5', eggKind: 'pen_4_5', shell: 'pen-4-5',
    themeTw: '風之守護者', labelTw: '超代 Ver.4.5 風之守護者',
    eggLabelTw: '超代 4.5 風之守護者數碼蛋',
    hasMegahitScreen: true, baby1: 'nyokimon', baby2: 'pyocomon', idleMon: 'piyomon',
    monsters: m4, childEvo: child4_5, adultEvo: adult4('palmon'), perfectEvo: perfect4_5,
    ultimateEvo: ult4,
    jogressPerfect: { vaccine: 'garudamon', data: 'deramon', virus: 'garbamon' },
    jogressUltimate: [
      { a: 'lillymon', b: 'deramon', result: 'rosemon' },
      { a: 'jureimon', b: 'garbamon', result: 'pinocchimon' }
    ],
    specialJogress: []
  });

  // -------------------------------------------------------------------------
  // Ver.5.0 / 5.5 Metal Empire  (超五)
  // 5.5 swaps: Tankmon→Thunderballmon (Da1-ish Da2? Tankmon is from mixed
  // Data paths — FI: Tankmon 5.0 / Thunderballmon 5.5, natural Perfect
  // Knightmon from Tankmon/Thunderballmon/Clockmon). Positions:
  // Va1 Greymon, Va2 Revolmon, Da1 Tankmon/Thunderballmon, Da2 Clockmon,
  // Vi1 Guardromon, Vi2 Mechanorimon.
  // 5.5 also Andromon→Cyberdramon (VaP2), Mugendramon→VenomVamdemon (ViU).
  // -------------------------------------------------------------------------
  var m5 = {
    choromon:        baby1(5, 4, '滾球獸（金屬）', 'Choromon'),
    kapurimon:       baby2(4, 6, 6, '卡普利獸', 'Kapurimon'),
    toyagumon:       child(12, 12, 22, 'vaccine', '玩具亞古獸', 'ToyAgumon'),
    kokuwamon:       child(8, 8, 18, 'data', '可可獸', 'Kokuwamon'),
    hagurumon:       child(12, 10, 20, 'virus', '齒輪獸', 'Hagurumon'),
    greymon:         adult(30, 24, 62, 'vaccine', 'Va1', '暴龍獸', 'Greymon'),
    revolmon:        adult(20, 20, 64, 'vaccine', 'Va2', '左輪獸', 'Revolmon'),
    tankmon:         adult(35, 26, 60, 'data', 'Da1', '坦克獸', 'Tankmon'),
    thunderballmon:  adult(10, 10, 66, 'data', 'Da1', '雷球獸', 'Thunderballmon'),
    clockmon:        adult(18, 10, 62, 'data', 'Da2', '時鐘獸', 'Clockmon'),
    guardromon:      adult(32, 18, 68, 'virus', 'Vi1', '守衛獸', 'Guardromon'),
    mechanorimon:    adult(35, 20, 64, 'virus', 'Vi2', '機械獸', 'Mechanorimon'),
    metalgreymon:    perfect(40, 30, 84, 'vaccine', 'VaP1', '機械暴龍獸', 'MetalGreymon'),
    andromon:        perfect(25, 20, 78, 'vaccine', 'VaP2', '安杜路獸', 'Andromon', true),
    cyberdramon:     perfect(22, 18, 92, 'vaccine', 'VaP2', '電子龍獸', 'Cyberdramon', true),
    knightmon:       perfect(20, 18, 72, 'data', 'DaP1', '騎士獸', 'Knightmon'),
    bigmamemon:      perfect(30, 25, 70, 'data', 'DaP2', '巨大豆豆獸', 'BigMamemon', true),
    megadramon:      perfect(38, 28, 68, 'virus', 'ViP1', '機械邪龍獸', 'Megadramon'),
    warumonzaemon:   perfect(24, 20, 62, 'virus', 'ViP2', '邪惡悟空獸', 'WaruMonzaemon', true),
    wargreymon:      ultimate(20, 18, 96, 'vaccine', 'VaU', '戰鬥暴龍獸', 'WarGreymon'),
    metalgarurumon:  ultimate(28, 20, 100, 'data', 'DaU', '鋼鐵加魯魯獸', 'MetalGarurumon', true),
    mugendramon:     ultimate(40, 32, 102, 'virus', 'ViU', '無限龍獸', 'Mugendramon', true),
    venomvamdemon:   ultimate(38, 28, 118, 'virus', 'ViU', 'Venom吸血魔獸', 'VenomVamdemon', true)
  };
  var child5 = [
    { from: 'kapurimon', to: 'toyagumon', cmMin: 0, cmMax: 2 },
    { from: 'kapurimon', to: 'kokuwamon', cmMin: 3, cmMax: 4 },
    { from: 'kapurimon', to: 'hagurumon', cmMin: 5 }
  ];
  function adult5(tank) {
    return [
      { from: 'toyagumon', to: 'greymon',      cmMax: 2, trainMin: 30 },
      { from: 'toyagumon', to: 'revolmon',     cmMax: 2, trainMax: 29 },
      { from: 'toyagumon', to: tank,           cmMin: 3, trainMin: 25 },
      { from: 'toyagumon', to: 'clockmon',     cmMin: 3, trainMax: 24 },
      { from: 'kokuwamon', to: 'revolmon',     cmMax: 2, trainMin: 30 },
      { from: 'kokuwamon', to: tank,           cmMax: 2, trainMax: 29 },
      { from: 'kokuwamon', to: 'clockmon',     cmMin: 3, trainMin: 20 },
      { from: 'kokuwamon', to: 'guardromon',   cmMin: 3, trainMax: 19 },
      { from: 'hagurumon', to: 'greymon',      cmMax: 1, trainMin: 30 },
      { from: 'hagurumon', to: tank,           cmMax: 1, trainMax: 29 },
      { from: 'hagurumon', to: 'guardromon',   cmMin: 2, trainMin: 25 },
      { from: 'hagurumon', to: 'mechanorimon', cmMin: 2, trainMax: 24 }
    ];
  }
  var perfect5_0 = [
    { from: ['greymon', 'revolmon'],                    to: 'metalgreymon', cmMax: 2, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['tankmon', 'clockmon'],                    to: 'knightmon',    cmMax: 4, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['guardromon', 'mechanorimon'],             to: 'megadramon',   cmMax: 1, trainMin: 40, battlesMin: 30, wrMin: 40 }
  ];
  var perfect5_5 = remap(perfect5_0, { tankmon: 'thunderballmon' });
  var ult5_0 = [
    { from: ['metalgreymon', 'andromon'], to: 'wargreymon', cmMax: 0, wrMin: 61, source: 'File-Island-PenEvo5' }
  ];
  var ult5_5 = [
    { from: ['metalgreymon', 'cyberdramon'], to: 'wargreymon', cmMax: 0, wrMin: 61, source: 'File-Island-PenEvo5' }
  ];
  D.registerVersion('5.0', {
    id: 'pen-5-0', eggKind: 'pen_5_0', shell: 'pen-5-0',
    themeTw: '金屬帝國', labelTw: '超五 Ver.5.0 金屬帝國',
    eggLabelTw: '超五 5.0 金屬帝國數碼蛋',
    hasMegahitScreen: true, baby1: 'choromon', baby2: 'kapurimon', idleMon: 'toyagumon',
    monsters: m5, childEvo: child5, adultEvo: adult5('tankmon'), perfectEvo: perfect5_0,
    ultimateEvo: ult5_0,
    jogressPerfect: { vaccine: 'andromon', data: 'bigmamemon', virus: 'warumonzaemon' },
    jogressUltimate: [
      { a: 'knightmon', b: 'bigmamemon', result: 'metalgarurumon' },
      { a: 'megadramon', b: 'warumonzaemon', result: 'mugendramon' }
    ],
    specialJogress: []
  });
  D.registerVersion('5.5', {
    id: 'pen-5-5', eggKind: 'pen_5_5', shell: 'pen-5-5',
    themeTw: '金屬帝國', labelTw: '超五 Ver.5.5 金屬帝國',
    eggLabelTw: '超五 5.5 金屬帝國數碼蛋',
    hasMegahitScreen: true, baby1: 'choromon', baby2: 'kapurimon', idleMon: 'toyagumon',
    monsters: m5, childEvo: child5, adultEvo: adult5('thunderballmon'), perfectEvo: perfect5_5,
    ultimateEvo: ult5_5,
    jogressPerfect: { vaccine: 'cyberdramon', data: 'bigmamemon', virus: 'warumonzaemon' },
    jogressUltimate: [
      { a: 'knightmon', b: 'bigmamemon', result: 'metalgarurumon' },
      { a: 'megadramon', b: 'warumonzaemon', result: 'venomvamdemon' }
    ],
    specialJogress: []
  });

  // -------------------------------------------------------------------------
  // Pendulum ZERO — Virus Busters (超0). No .5. Omegamon is the Virus
  // Perfect Jogress AND the signature WarGreymon(ZERO)+MetalGarurumon(ZERO)
  // pair (File Island PenEvoZero).
  //
  // Device attributes (2 Vac + 2 Data + 2 Virus Adults) and NHOKO's note
  // that original ZERO treated the Plotmon–Angewomon line as Virus for
  // Jogress: Agumon Vac, Gabumon Data, Plotmon Virus; Greymon Va1,
  // Leomon Va2, Garurumon Da1, Igamon Da2, Angemon Vi1, Tailmon Vi2;
  // MetalGreymon VaP1, Asuramon VaP2, WereGarurumon DaP1, MetalMamemon
  // DaP2, HolyAngemon ViP1, Angewomon ViP2.
  //
  // ZERO species stats: no digivicemon table was reachable this pass.
  // Sleep follows NHOKO stage bedtimes (already used as the 19/20/21/22
  // pattern). Min-weights / stomachs from the same species on 1.5 / 3.0 /
  // 5.0 where they exist, otherwise typical stage values, labelled
  // 'stage-defaults'.
  // -------------------------------------------------------------------------
  var m0 = {
    yukimibotamon:   baby1(5, 4, '雪球獸', 'Yukimibotamon'),
    nyaromon:        baby2(8, 6, 10, '貓貓獸', 'Nyaromon'),
    agumon:          child(15, 8, 24, 'vaccine', '亞古獸', 'Agumon'),
    gabumon:         child(15, 8, 24, 'data', '加布獸', 'Gabumon'),
    plotmon:         child(10, 6, 22, 'virus', '普羅特獸', 'Plotmon'),
    // Greymon / MetalGreymon / WarGreymon / MetalGarurumon already in m5.
    leomon:          adult(20, 10, 64, 'vaccine', 'Va2', '獅子獸', 'Leomon'),
    igamon:          adult(18, 10, 62, 'data', 'Da2', '伊賀獸', 'Igamon'),
    angemon:         adult(20, 10, 64, 'virus', 'Vi1', '天使獸', 'Angemon'),
    // tailmon / angewomon / weregarurumon already registered (1.5 / 3.0);
    // ZERO overrides below.
    asuramon:        perfect(25, 10, 76, 'vaccine', 'VaP2', '阿修羅獸', 'Asuramon', true),
    metalmamemon:    perfect(20, 10, 72, 'data', 'DaP2', '金屬豆豆獸', 'MetalMamemon', true),
    holyangemon:     perfect(25, 10, 80, 'virus', 'ViP1', '神聖天使獸', 'HolyAngemon'),
    omegamon:        ultimate(30, 14, 120, 'vaccine', 'Omega', '奧米加獸', 'Omegamon', true)
  };
  // Fill ZERO-only copies of shared-id mons that may not yet be in MONSTERS
  // if 5.x registered first (they did). Overrides handle attribute/position.
  var childZ = [
    { from: 'nyaromon', to: 'agumon',  cmMin: 0, cmMax: 2 },
    { from: 'nyaromon', to: 'gabumon', cmMin: 3, cmMax: 5 },
    { from: 'nyaromon', to: 'plotmon', cmMin: 6 }
  ];
  var adultZ = [
    { from: 'agumon',  to: 'greymon',    cmMax: 2, trainMin: 30 },
    { from: 'agumon',  to: 'angemon',    cmMax: 2, trainMax: 29 },
    { from: 'agumon',  to: 'leomon',     cmMin: 3, trainMax: 24 },
    { from: 'agumon',  to: 'garurumon',  cmMin: 3, trainMin: 25 },
    { from: 'gabumon', to: 'leomon',     cmMax: 2, trainMin: 30 },
    { from: 'gabumon', to: 'garurumon',  cmMax: 2, trainMax: 29 },
    { from: 'gabumon', to: 'igamon',     cmMin: 3, trainMin: 20 },
    { from: 'gabumon', to: 'tailmon',    cmMin: 3, trainMax: 19 },
    { from: 'plotmon', to: 'greymon',    cmMax: 1, trainMin: 30 },
    { from: 'plotmon', to: 'angemon',    cmMax: 1, trainMax: 29 },
    { from: 'plotmon', to: 'igamon',     cmMin: 2, trainMin: 25 },
    { from: 'plotmon', to: 'tailmon',    cmMin: 2, trainMax: 24 }
  ];
  var perfectZ = [
    { from: ['greymon', 'leomon'],     to: 'metalgreymon',   cmMax: 2, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['garurumon', 'igamon'],   to: 'weregarurumon',  cmMax: 4, trainMin: 40, battlesMin: 30, wrMin: 40 },
    { from: ['angemon', 'tailmon'],    to: 'holyangemon',    cmMax: 1, trainMin: 40, battlesMin: 30, wrMin: 40 }
  ];
  var ultZ = [
    { from: ['metalgreymon', 'asuramon'], to: 'wargreymon', cmMax: 0, wrMin: 61, source: 'File-Island-PenEvoZero' }
  ];
  D.registerVersion('zero', {
    id: 'pen-zero', eggKind: 'pen_zero', shell: 'pen-zero',
    themeTw: '病毒剋星', labelTw: '超0 病毒剋星',
    eggLabelTw: '超0 病毒剋星數碼蛋',
    hasMegahitScreen: true, baby1: 'yukimibotamon', baby2: 'nyaromon', idleMon: 'agumon',
    monsters: m0, childEvo: childZ, adultEvo: adultZ, perfectEvo: perfectZ,
    ultimateEvo: ultZ,
    jogressPerfect: { vaccine: 'asuramon', data: 'metalmamemon', virus: 'angewomon' },
    jogressUltimate: [
      { a: 'weregarurumon', b: 'metalmamemon', result: 'metalgarurumon' },
      { a: 'holyangemon', b: 'angewomon', result: 'omegamon' }
    ],
    specialJogress: [
      { a: 'wargreymon', b: 'metalgarurumon', result: 'omegamon' }
    ],
    overrides: {
      // Device-original attributes / positions (see header).
      garurumon:     { attribute: 'data',    position: 'Da1', statsSource: 'ZERO-device-attr' },
      tailmon:       { attribute: 'virus',   position: 'Vi2', statsSource: 'NHOKO-ZERO-Plotmon-line-Virus' },
      angewomon:     { attribute: 'virus', position: 'ViP2', jogressOnly: true, megahit: 5, megahitSource: 'Humulos-ZERO', statsSource: 'NHOKO-ZERO-Plotmon-line-Virus' },
      weregarurumon: { attribute: 'data',    position: 'DaP1', jogressOnly: false, statsSource: 'ZERO-natural-Data-Perfect' },
      greymon:       { position: 'Va1' },
      metalgreymon:  { position: 'VaP1' },
      wargreymon:    { position: 'VaU' },
      metalgarurumon:{ position: 'DaU', jogressOnly: true }
    },
    statsSource: 'stage-defaults-plus-shared-species'
  });

  // Expose a helper the egg picker / tests can use.
  D.allPenEggs = function () {
    return Object.keys(D.EGG_TO_VER).map(function (e) {
      var V = D.verData(e);
      return { eggKind: e, key: V.key, id: V.id, labelTw: V.eggLabelTw, hasMegahitScreen: !!V.hasMegahitScreen };
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
