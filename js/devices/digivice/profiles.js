/**
 * 神聖計畫 / Digivice (1999) device profiles.
 * Portrait / round communicator, circular LCD, three flanking buttons
 * (left confirm/A-equivalent, right-upper cycle, right-lower back)
 * measured from the painted shell which follows the official File Island
 * photo (fi-digivice-1999.png). Ver.1 Taichi orange; Ver.2 clear pink.
 */
(function (root) {
  'use strict';

  var LAYOUT = {
    aspectW: 1400,
    aspectH: 1280,
    lcd: { left: 36.2, top: 30.906, width: 35.6, height: 38.938 },
    buttons: {
      a: { cx: 25.474, cy: 51.0, w: 14.4, h: 15.75 },
      b: { cx: 83.44, cy: 36.5, w: 13.6, h: 10.062 },
      c: { cx: 83.44, cy: 65.5, w: 13.6, h: 10.062 },
      reset: { cx: 92.0, cy: 92.0, w: 3.0, h: 3.3 }
    },
    icons_top: [],
    icons_bot: [],
    names_top: [],
    names_bot: [],
    chamber: null,
    circularLcd: true
  };

  var MENUS = ['STATUS', 'MAP', 'SLOT', 'CARD', 'MEDICAL', 'VS'];
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
