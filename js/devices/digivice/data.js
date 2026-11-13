/**
 * 神聖計畫 / Digivice (1999) Ver.1 and Ver.2 — sourced tables.
 *
 * Primary sources (do not invent unpublished numbers):
 *   File Island DigiviceIntro, DigiviceGuide1, DigiviceGuide2, DigiviceGallery
 *     https://lcd.withthewill.net/DigiviceIntro
 *     https://lcd.withthewill.net/DigiviceGuide1
 *     https://lcd.withthewill.net/DigiviceGuide2
 *   Wikimon Digivice Toy, Digivice Version 1, Digivice Version 2
 *     https://wikimon.net/Digivice_Toy
 *     https://wikimon.net/Digivice_Version_1
 *     https://wikimon.net/Digivice_Version_2
 *
 * Values marked PLACEHOLDER are unpublished; labelled and reported.
 * Conflicts are documented on the constant and in the v29 report.
 *
 * The US Interactive Digivice is a different product (Select/OK/Cancel)
 * and is never used as a JP Ver.1/Ver.2 rules source.
 * DIGIVICE Ver.REVIVAL (2026) is a later remake and is not used as 1999.
 */
(function (root) {
  'use strict';

  var STAGES = { II: 'II', III: 'III', IV: 'IV', V: 'V' };

  // File Island Guide 1 / 2 and Gallery. In-Training → Child → Adult → Perfect.
  // Sprite ids match File Island lcd/mon/*.gif filenames (no extension).
  var LINES = {
    agumon:   { name: 'Agumon',   chain: ['koromon', 'agumon', 'greymon', 'metalgreymon'] },
    gabumon:  { name: 'Gabumon',  chain: ['tsunomon', 'gabumon', 'garurumon', 'weregarurumon'] },
    piyomon:  { name: 'Piyomon',  chain: ['pyocomon', 'piyomon', 'birdramon', 'garudamon'] },
    palmon:   { name: 'Palmon',   chain: ['tanemon', 'palmon', 'togemon', 'lilymon'] },
    tentomon: { name: 'Tentomon', chain: ['motimon', 'tentomon', 'kabuterimon', 'atlurkabuterimon'] },
    gomamon:  { name: 'Gomamon',  chain: ['pukamon', 'gomamon', 'ikkakumon', 'zudomon'] },
    patamon:  { name: 'Patamon',  chain: ['tokomon', 'patamon', 'angemon', 'holyangemon'] },
    // Ver.2 extra: Tailmon line (Guide 2). No In-Training in the published chain.
    tailmon:  { name: 'Tailmon',  chain: ['tailmon', 'angewomon', 'holydramon'], noBaby: true },
    // Single-form recruits (Guide 1 V-Dramon; Guide 2 extras).
    vdramon:        { name: 'V-Dramon',        chain: ['vdramon'], noEvo: true },
    wizarmon:       { name: 'Wizarmon',        chain: ['wizarmon'], noEvo: true },
    devimon:        { name: 'Devimon',         chain: ['devimon'], noEvo: true },
    etemon:         { name: 'Etemon',          chain: ['etemon'], noEvo: true },
    vamdemon:       { name: 'Vamdemon',        chain: ['vamdemon'], noEvo: true },
    venomvamdemon:  { name: 'VenomVamdemon',   chain: ['venomvamdemon'], noEvo: true },
    piemon:         { name: 'Piemon',          chain: ['piemon'], noEvo: true }
  };

  // The 7 starting Chosen partners (FI Intro / Wikimon Toy). No Hikari/Tailmon on Ver.1 pick.
  var STARTERS = ['agumon', 'gabumon', 'gomamon', 'palmon', 'tentomon', 'patamon', 'piyomon'];

  // Stage of a chain index: 0=II In-Training, 1=III Child, 2=IV Adult, 3=V Perfect.
  var STAGE_BY_INDEX = ['II', 'III', 'IV', 'V'];

  // FI Guide 1: "The Child Digimon evolves with 10 victories in battle into
  // Adult, and the Adult Digimon to Perfect after 15 battles."
  // Wikimon Version 1 conflicts: "10 victories, and to Perfect after 15
  // additional victories (25 victories in total)". We follow File Island
  // wording: 10 victories for Child→Adult; 15 battles (not only wins) for
  // Adult→Perfect.
  var CHILD_WINS_TO_ADULT = 10;
  var ADULT_BATTLES_TO_PERFECT = 15;

  // Wikimon Toy: "Consumes 3 DP per evolution." FI Intro only says "Consumes DP".
  var DP_EVOLVE_COST = 3;

  // Wikimon Version 1 Area Details — step counts. Ver.2 area steps were
  // not separately published; we reuse this table for Ver.2 (labelled).
  // Sum = 112,000. Ver.2 130,000-step recruit (Wikimon Toy) then has an
  // 18,000-step official buffer over a straight clear.
  var AREA_STEPS = [10000, 12000, 14000, 16000, 18000, 20000, 22000];

  // Wikimon Toy: "For version 2, If you clear all Areas within 130,000
  // steps or less, the Boss Digimon and others will become available to
  // join your party."
  var V2_RECRUIT_MAX_STEPS = 130000;

  // FI Guide: HELP wave "three minutes to get the HELP wave to fill up
  // and press the button when CATCH appears."
  var HELP_WINDOW_SEC = 180;

  // FI: "In-Training stage and evolve into Child shortly." Exact delay
  // unpublished. PLACEHOLDER: 5 minutes of device time.
  var CHILD_EVOLVE_SEC = 300; // PLACEHOLDER

  // PLACEHOLDER encounter spacing (unpublished). An optional enemy is
  // offered every N area-steps while remaining > 0.
  var ENCOUNTER_EVERY = 500; // PLACEHOLDER

  // PLACEHOLDER HELP appearance chance after a battle or shake, if the
  // area has not yet had a successful HELP (Ver.1: one successful per area,
  // Wikimon V1 / FI "per island" read as per area).
  var HELP_CHANCE = 0.25; // PLACEHOLDER

  // PLACEHOLDER DP economy (1999 gain rate unpublished; Revival's
  // "100 steps = 1 DP" is 2026 and is not used). Start with 6 (two evos);
  // +1 DP per victory.
  var DP_START = 6; // PLACEHOLDER
  var DP_PER_WIN = 1; // PLACEHOLDER

  // PLACEHOLDER HP/ATK (no official 1999 table published; TofGF only
  // confirms DP/WIN/HP/ATTACK appear on screen). Stage-scaled so battles
  // are playable. Reported as unverified.
  var STATS = {
    II: { hp: 4, atk: 1 },
    III: { hp: 6, atk: 2 },
    IV: { hp: 9, atk: 3 },
    V:  { hp: 13, atk: 5 }
  };

  // FI Guide 1 enemy / boss table.
  var AREAS_V1 = [
    { id: 1, steps: 10000, enemies: ['gizamon', 'gazimon', 'kunemon'],       boss: 'kuwagamon' },
    { id: 2, steps: 12000, enemies: ['gizamon', 'gazimon', 'sukamon'],       boss: 'devimon' },
    { id: 3, steps: 14000, enemies: ['bakemon', 'shellmon', 'sukamon'],      boss: 'etemon' },
    { id: 4, steps: 16000, enemies: ['bakemon', 'shellmon', 'gekomon'],      boss: 'metaltyranomon' },
    { id: 5, steps: 18000, enemies: ['gekomon', 'shellmon', 'airdramon'],    boss: 'metalseadramon' },
    { id: 6, steps: 20000, enemies: ['gekomon', 'ogremon', 'airdramon'],     boss: 'megadramon' },
    { id: 7, steps: 22000, enemies: ['darktyranomon', 'ogremon', 'airdramon'], boss: 'mugendramon' }
  ];
  // FI Guide 1 calls the area-7 boss Machinedramon; the File Island LCD
  // sprite is mugendramon.gif (same mon, JP ムゲンドラモン).

  // FI Guide 2 / Wikimon Version 2. DeathMeramon sprite is deathmeramon.gif.
  var AREAS_V2 = [
    { id: 1, steps: 10000, enemies: ['picodevimon', 'gazimon', 'numemon'],         boss: 'devimon' },
    { id: 2, steps: 12000, enemies: ['picodevimon', 'monochromon', 'numemon'],     boss: 'etemon' },
    { id: 3, steps: 14000, enemies: ['cockatrimon', 'monochromon', 'dokugumon'],   boss: 'wizarmon' },
    { id: 4, steps: 16000, enemies: ['cockatrimon', 'devidramon', 'dokugumon'],    boss: 'tailmon' },
    { id: 5, steps: 18000, enemies: ['mammon', 'devidramon', 'dokugumon'],         boss: 'vamdemon' },
    { id: 6, steps: 20000, enemies: ['mammon', 'devidramon', 'deathmeramon'],      boss: 'venomvamdemon' },
    { id: 7, steps: 22000, enemies: ['mammon', 'deathmeramon', 'metalseadramon'],  boss: 'piemon' }
  ];

  // Ver.2 recruits "available to be-friend upon victory" after the 130k clear
  // (Wikimon Toy + Guide 2 partner list).
  var V2_RECRUIT_IDS = ['devimon', 'etemon', 'wizarmon', 'tailmon', 'vamdemon', 'venomvamdemon', 'piemon'];

  // PLACEHOLDER implied enemy stages for HP/ATK (unpublished).
  var ENEMY_STAGE = {
    gizamon: 'III', gazimon: 'III', kunemon: 'III', sukamon: 'III',
    bakemon: 'IV', shellmon: 'IV', gekomon: 'IV', airdramon: 'IV',
    ogremon: 'IV', darktyranomon: 'IV',
    picodevimon: 'III', numemon: 'III', monochromon: 'IV',
    cockatrimon: 'IV', dokugumon: 'IV', devidramon: 'IV',
    mammon: 'V', deathmeramon: 'V', metalseadramon: 'V',
    kuwagamon: 'IV', devimon: 'IV', etemon: 'IV',
    metaltyranomon: 'V', megadramon: 'V', mugendramon: 'V',
    wizarmon: 'IV', tailmon: 'IV', vamdemon: 'V',
    venomvamdemon: 'V', piemon: 'V'
  };

  // FI Intro item effects (plan-recommended). Wikimon Toy conflicts:
  //   Meat "Adds 2 DP"; Power Up "Ensures a One-hit KO".
  // We follow File Island: Protein doubles HP next fight; Meat no effect
  // ever noticed; Power Up doubles all stats next fight.
  var ITEM_EFFECTS = {
    protein: 'double_hp',   // FI
    meat: 'none',           // FI: "unknown, no effect ever noticed"
    powerUp: 'double_all'   // FI
  };

  // Menus: Status, Map, Slot, Card, Medical, VS (device-lines.md / FI Intro).
  // No Scale/Meat/Train/Flush/Lights; no 4+4 hunger icons.
  var MENUS = ['STATUS', 'MAP', 'SLOT', 'CARD', 'MEDICAL', 'VS'];

  // Battle options (FI Intro / Wikimon Toy).
  var BATTLE_OPTIONS = ['USE', 'EVOLVE', 'SWITCH', 'QUICK'];

  // PLACEHOLDER mash-to-go-first: after a 3-beat countdown (ANIM_MS=500,
  // official 2 Hz unless a source says otherwise), presses of the
  // A-equivalent (left button; FI/Wikimon "press the A button rapidly")
  // in a 1-second window. Threshold unpublished.
  var MASH_WINDOW_MS = 1000; // PLACEHOLDER
  var MASH_THRESHOLD = 6;    // PLACEHOLDER
  var COUNTDOWN_BEATS = 3;   // three 500 ms beats before mash

  function areasFor(version) {
    return version === 2 ? AREAS_V2 : AREAS_V1;
  }

  function lineOf(starter) { return LINES[starter] || null; }

  function monAt(starter, index) {
    var L = LINES[starter];
    if (!L) return null;
    var i = Math.max(0, Math.min(index, L.chain.length - 1));
    return L.chain[i];
  }

  function stageOfIndex(index) { return STAGE_BY_INDEX[index] || 'III'; }

  function statsFor(stage) {
    return STATS[stage] || STATS.III;
  }

  function enemyStats(id, isBoss) {
    var st = ENEMY_STAGE[id] || (isBoss ? 'V' : 'III');
    var s = statsFor(st);
    // PLACEHOLDER: bosses a little sturdier than a same-stage grunt.
    if (isBoss) return { hp: s.hp + 3, atk: s.atk + 1, stage: st };
    return { hp: s.hp, atk: s.atk, stage: st };
  }

  function starterIndex(id) {
    var i = STARTERS.indexOf(id);
    return i < 0 ? 0 : i;
  }

  var api = {
    STAGES: STAGES,
    LINES: LINES,
    STARTERS: STARTERS,
    STAGE_BY_INDEX: STAGE_BY_INDEX,
    CHILD_WINS_TO_ADULT: CHILD_WINS_TO_ADULT,
    ADULT_BATTLES_TO_PERFECT: ADULT_BATTLES_TO_PERFECT,
    DP_EVOLVE_COST: DP_EVOLVE_COST,
    AREA_STEPS: AREA_STEPS,
    V2_RECRUIT_MAX_STEPS: V2_RECRUIT_MAX_STEPS,
    HELP_WINDOW_SEC: HELP_WINDOW_SEC,
    CHILD_EVOLVE_SEC: CHILD_EVOLVE_SEC,
    ENCOUNTER_EVERY: ENCOUNTER_EVERY,
    HELP_CHANCE: HELP_CHANCE,
    DP_START: DP_START,
    DP_PER_WIN: DP_PER_WIN,
    STATS: STATS,
    AREAS_V1: AREAS_V1,
    AREAS_V2: AREAS_V2,
    V2_RECRUIT_IDS: V2_RECRUIT_IDS,
    ENEMY_STAGE: ENEMY_STAGE,
    ITEM_EFFECTS: ITEM_EFFECTS,
    MENUS: MENUS,
    BATTLE_OPTIONS: BATTLE_OPTIONS,
    MASH_WINDOW_MS: MASH_WINDOW_MS,
    MASH_THRESHOLD: MASH_THRESHOLD,
    COUNTDOWN_BEATS: COUNTDOWN_BEATS,
    ANIM_MS: 500,
    areasFor: areasFor,
    lineOf: lineOf,
    monAt: monAt,
    stageOfIndex: stageOfIndex,
    statsFor: statsFor,
    enemyStats: enemyStats,
    starterIndex: starterIndex
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DigiviceData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
