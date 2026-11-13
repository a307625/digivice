/**
 * Pendulum Ver.20th device profiles (family 'pen20', not 'pendulum').
 * SK and SB shells ship this pass. DC/BC official photos 404'd — omitted
 * from the app picker; colorway data still exists on the engine.
 */
(function (root) {
  'use strict';

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
      { left: 19.62, top: 28.996, width: 4.869, height: 7.842 },
      { left: 25.03, top: 28.996, width: 4.869, height: 7.842 },
      { left: 30.44, top: 28.996, width: 4.869, height: 7.842 },
      { left: 35.85, top: 28.996, width: 4.869, height: 7.842 },
      { left: 41.261, top: 28.996, width: 4.869, height: 7.842 }
    ],
    icons_bot: [
      { left: 19.62, top: 63.111, width: 4.869, height: 7.058 },
      { left: 25.03, top: 63.111, width: 4.869, height: 7.058 },
      { left: 30.44, top: 63.111, width: 4.869, height: 7.058 },
      { left: 35.85, top: 63.111, width: 4.869, height: 7.058 },
      { left: 41.261, top: 63.111, width: 4.869, height: 7.058 }
    ],
    names_top: ['STATUS', 'FEED', 'TRAIN', 'COLOSSEUM', 'FLUSH'],
    names_bot: ['LIGHT', 'MEDIC', 'ALBUM', 'CONNECT', 'CALL'],
    chamber: null
  };

  var SELECTABLE = ['STATUS', 'FEED', 'TRAIN', 'COLOSSEUM', 'FLUSH', 'LIGHT', 'MEDIC', 'ALBUM', 'CONNECT'];
  var STATUS_PAGES = ['name', 'age', 'weight', 'hunger', 'strength', 'effort', 'dp', 'attr', 'bj', 'record'];

  function makeProfile(cw) {
    var Da = root.Pen20Data;
    var meta = (Da && Da.COLORWAYS && Da.COLORWAYS[cw]) || { id: 'pen-20th-' + cw, shell: 'pen-20th-' + cw, eggKind: 'pen_20th_' + cw };
    return {
      id: meta.id,
      family: 'pen20',
      line: 'pen20',
      shell: meta.shell,
      orient: 'landscape',
      version: cw,
      colorway: cw,
      eggKind: meta.eggKind,
      eggs: [meta.eggKind],
      layout: LAYOUT,
      iconsTop: LAYOUT.names_top,
      iconsBot: LAYOUT.names_bot,
      selectable: SELECTABLE.slice(),
      statusPages: STATUS_PAGES.slice(),
      buttonStyle: 'pen20-' + cw,
      lightsOff: 'paper-fridge',
      clockSet: 'pen20',
      hatchMinutes: 1,
      engine: 'Pen20Engine',
      steps: true
    };
  }

  function register() {
    if (!root.Devices || typeof root.Devices.register !== 'function') return;
    // SK + SB only in this pass (official DC/BC shell photos 404).
    ['sk', 'sb'].forEach(function (cw) {
      root.Devices.register(makeProfile(cw));
    });
  }
  register();

  var api = {
    LAYOUT: LAYOUT,
    SELECTABLE: SELECTABLE,
    STATUS_PAGES: STATUS_PAGES,
    makeProfile: makeProfile,
    register: register
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Pen20Profiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
