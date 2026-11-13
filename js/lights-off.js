/**
 * Per-family playfield when the lamp is off. Menus and the clock always
 * paint on paper (official 1997 / DM20 / Pendulum).
 *
 *   1997  — blank dark LCD whenever the lamp is off, any stage including
 *           egg and Baby I/II, awake or asleep. No monster, poop, or Z.
 *           (clock-rules.md; "the screen goes dark like the old ones".)
 *   DM20  — does NOT go dark. Sleep cell + Z when the pet is sleeping
 *           (nap or bedtime). Official: "The screen doesn't go dark like
 *           the old ones" (WithTheWill / clock-rules.md). Babydmon is
 *           Baby II on the 20th special eggs (dra_blue / dra_green);
 *           Baby I is Petitmon. Off still starts a 3-hour nap (or puts a
 *           tired pet to bed) at every stage that can sleep, including
 *           Baby I/II — the visible change is the sleep pose and Z, not
 *           a black panel.
 *   Pendulum OG — black + floating Z when tired/sleeping and off;
 *           solid black when awake and off (including Baby I, who has
 *           no bedtime). Egg with lamp off is black.
 *
 * Returns one of: 'paper' | 'blank-dark' | 'black' | 'black-z' | 'paper-sleep'
 */
(function (root) {
  'use strict';

  var MENU_VIEWS = {
    clock: 1, status: 1, food: 1, battleMenu: 1, lightMenu: 1,
    album: 1, albumView: 1, albumRecord: 1, connect: 1,
    healMenu: 1, soundMenu: 1, train: 1, battle: 1, evo: 1
  };

  function familyOf(state, family) {
    if (family) return family;
    if (state && state.family) return state.family;
    return 'dm1997';
  }

  function isMenuView(view) {
    return !!(view && MENU_VIEWS[view]);
  }

  /**
   * What the playfield (home / play view) should look like.
   * `view` is the current UI view; non-play views always return 'paper'.
   */
  function playfieldMode(state, view, family) {
    if (isMenuView(view)) return 'paper';
    if (!state) return 'paper';
    // Grave / dying paint their own art on paper.
    if (state.dead && view !== 'play') return 'paper';
    var fam = familyOf(state, family);
    if (state.lights !== false && state.lights !== 0) return 'paper';
    // Lamp is off.
    if (fam === 'dm20') {
      return state.sleeping ? 'paper-sleep' : 'paper';
    }
    if (fam === 'pendulum') {
      if (state.sleeping || state.tired) return 'black-z';
      return 'black';
    }
    // 1997 (and unknown brick): blank dark at every stage, awake or asleep.
    return 'blank-dark';
  }

  function isDarkPlayfield(mode) {
    return mode === 'blank-dark' || mode === 'black' || mode === 'black-z';
  }

  /**
   * Device identity for the Babydmon line (user-reported lights-off repro).
   * Babydmon is Baby II; Petitmon is Baby I; eggs dra_blue / dra_green.
   * Family is DM20 (Digital Monster 20th).
   */
  var BABYDMON_LINE = {
    baby1: 'petitmon',
    baby2: 'babydmon',
    eggs: ['dra_blue', 'dra_green'],
    family: 'dm20',
    note: 'Babydmon is Baby II on the 20th special dragon eggs, not Baby I. Official DM20 playfield does not go dark.'
  };

  var api = {
    MENU_VIEWS: MENU_VIEWS,
    BABYDMON_LINE: BABYDMON_LINE,
    familyOf: familyOf,
    isMenuView: isMenuView,
    playfieldMode: playfieldMode,
    isDarkPlayfield: isDarkPlayfield
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LightsOff = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
