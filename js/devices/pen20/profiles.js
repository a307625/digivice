/**
 * Pendulum Ver.20th device profiles (family 'pen20', not 'pendulum').
 * SK and SB shells ship this pass. DC/BC official photos 404'd — omitted
 * from the app picker; colorway data still exists on the engine.
 */
(function (root) {
  'use strict';

  var LAYOUT = {
    aspectW: 1600,
    aspectH: 1024,
    lcd: { left: 16.4, top: 34.2, width: 33.8, height: 31.687 },
    buttons: {
      a: { cx: 79.8, cy: 31.5, w: 10.4, h: 16.25 },
      b: { cx: 79.8, cy: 50.0, w: 10.4, h: 16.25 },
      c: { cx: 79.8, cy: 68.5, w: 10.4, h: 16.25 },
      reset: { cx: 90.2, cy: 84.0, w: 2.2, h: 3.438 }
    },
    icons_top: [
      { left: 16.0, top: 23.6, width: 5.5, height: 6.6 },
      { left: 23.275, top: 23.6, width: 5.5, height: 6.6 },
      { left: 30.55, top: 23.6, width: 5.5, height: 6.6 },
      { left: 37.825, top: 23.6, width: 5.5, height: 6.6 },
      { left: 45.1, top: 23.6, width: 5.5, height: 6.6 }
    ],
    icons_bot: [
      { left: 16.0, top: 69.688, width: 5.5, height: 6.6 },
      { left: 23.275, top: 69.688, width: 5.5, height: 6.6 },
      { left: 30.55, top: 69.688, width: 5.5, height: 6.6 },
      { left: 37.825, top: 69.688, width: 5.5, height: 6.6 },
      { left: 45.1, top: 69.688, width: 5.5, height: 6.6 }
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
