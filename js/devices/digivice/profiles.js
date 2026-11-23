/**
 * 神聖計畫 / Digivice (1999) device profiles.
 * Portrait / round communicator, circular LCD, three flanking buttons
 * (left confirm/A-equivalent, right-upper cycle, right-lower back)
 * measured on the shipped 1150×1056 shells. The glass is 303px tall;
 * the window is that circle, centered, so it does not cover the digicode ring.
 * Ver.1 default is Taichi (white/ice face, orange outer grip, blue buttons);
 * Ver.2 default is Hikari (pink grip). Partner shells swap with the chosen starter.
 */
(function (root) {
  'use strict';

  var LAYOUT = {
    aspectW: 1150,
    aspectH: 1056,
    lcd: { left: 36.62, top: 37.88, width: 26.34, height: 28.69 },
    buttons: {
      a: { cx: 13.391, cy: 50.189, w: 17.391, h: 18.939 },
      b: { cx: 84.522, cy: 38.447, w: 13.913, h: 10.606 },
      c: { cx: 84.696, cy: 62.311, w: 13.913, h: 10.795 },
      reset: { cx: 92.0, cy: 92.0, w: 3.0, h: 3.3 }
    },
    icons_top: [],
    icons_bot: [],
    names_top: [],
    names_bot: [],
    chamber: null,
    circularLcd: true
  };

  var MENUS = ['STATUS', 'MAP', 'SLOT', 'CARD', 'VS', 'MEDICAL'];
  var STATUS = ['mon', 'hp', 'atk', 'dp', 'win'];

  function profile(ver) {
    ver = ver === 2 ? 2 : 1;
    return {
      id: 'digivice-v' + ver,
      family: 'digivice',
      line: 'digivice',
      shell: 'digivice-v' + ver,
      orient: 'portrait',
      version: ver,
      layout: LAYOUT,
      iconsTop: [],
      iconsBot: [],
      selectable: MENUS.slice(),
      statusPages: STATUS.slice(),
      buttonStyle: 'digivice-1999',
      lightsOff: 'paper',
      clockSet: 'digivice',
      hatchMinutes: 0,
      engine: 'DigiviceEngine',
      steps: true,
      eggs: [ver === 2 ? 'dv1999_v2' : 'dv1999_v1']
    };
  }

  function register() {
    var R = root.Devices;
    if (!R || !R.register) return;
    R.register(profile(1));
    R.register(profile(2));
  }

  register();

  var api = {
    LAYOUT: LAYOUT,
    MENUS: MENUS,
    STATUS: STATUS,
    profile: profile,
    register: register
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DigiviceProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
