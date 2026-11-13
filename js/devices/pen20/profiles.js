/**
 * Pendulum Ver.20th device profiles (family 'pen20', not 'pendulum').
 * SK and SB shells ship this pass. DC/BC official photos 404'd — omitted
 * from the app picker; colorway data still exists on the engine.
 */
(function (root) {
  'use strict';

  var LAYOUT = {
    aspectW: 1016,
    aspectH: 676,
    lcd: { left: 16.339, top: 31.953, width: 29.823, height: 30.621 },
    buttons: {
      a: { cx: 75.994, cy: 26.124, w: 12.106, h: 18.195 },
      b: { cx: 75.971, cy: 47.796, w: 12.106, h: 18.047 },
      c: { cx: 75.960, cy: 69.112, w: 12.106, h: 18.195 },
      reset: { cx: 69.046, cy: 58.121, w: 4.626, h: 6.805 }
    },
    icons_top: [
      { left: 16.0, top: 24.704, width: 5.366, height: 6.805 },
      { left: 22.165, top: 24.704, width: 5.366, height: 6.805 },
      { left: 28.331, top: 24.704, width: 5.366, height: 6.805 },
      { left: 34.496, top: 24.704, width: 5.366, height: 6.805 },
      { left: 40.661, top: 24.704, width: 5.366, height: 6.805 }
    ],
    icons_bot: [
      { left: 16.0, top: 62.87, width: 5.366, height: 6.805 },
      { left: 22.165, top: 62.87, width: 5.366, height: 6.805 },
      { left: 28.331, top: 62.87, width: 5.366, height: 6.805 },
      { left: 34.496, top: 62.87, width: 5.366, height: 6.805 },
      { left: 40.661, top: 62.87, width: 5.366, height: 6.805 }
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
