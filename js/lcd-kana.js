/**
 * v36: kana for the 1997 LCD words shown in the Bandai Ver.1 manual:
 * status labels おなか / きんりょく / たいりょく / しょうりつ, feed menu
 * エサ / プロテイン, lights おん / おふ, the age unit 才 and the menu arrow →.
 *
 * 7 rows, 1 glyph pixel = 1 LCD dot (the same dot size as every sprite and
 * letter). Hand-drawn dot glyphs reconstructed from the manual mock-ups, not
 * a ROM dump. Kept in its own file so js/items.js (the HUD art) is untouched.
 */
(function (root) {
  'use strict';

  var RAW_KANA = {
    "お": [
    "01001",
    "11110",
    "01000",
    "01110",
    "11001",
    "11001",
    "01110"
    ],
    "な": [
    "01000",
    "11101",
    "01001",
    "10001",
    "00111",
    "01011",
    "00110"
    ],
    "か": [
    "01001",
    "11110",
    "01010",
    "01010",
    "10010",
    "10010",
    "10110"
    ],
    "き": [
    "00100",
    "11110",
    "00010",
    "11111",
    "01000",
    "00100",
    "01110"
    ],
    "ん": [
    "00100",
    "00100",
    "01000",
    "01000",
    "10100",
    "10101",
    "10010"
    ],
    "り": [
    "10010",
    "10001",
    "10001",
    "10001",
    "01001",
    "00010",
    "00100"
    ],
    "ょ": [
    "0000",
    "0000",
    "0010",
    "0011",
    "0010",
    "0111",
    "0110"
    ],
    "く": [
    "0001",
    "0010",
    "0100",
    "1000",
    "0100",
    "0010",
    "0001"
    ],
    "た": [
    "01000",
    "11100",
    "01011",
    "01000",
    "10000",
    "10100",
    "10011"
    ],
    "い": [
    "00000",
    "10010",
    "10001",
    "10001",
    "10000",
    "10000",
    "01000"
    ],
    "し": [
    "01000",
    "01000",
    "01000",
    "01000",
    "01000",
    "01001",
    "00110"
    ],
    "う": [
    "01110",
    "00000",
    "01110",
    "10001",
    "00001",
    "00010",
    "01100"
    ],
    "つ": [
    "00000",
    "01110",
    "10001",
    "00001",
    "00001",
    "00010",
    "01100"
    ],
    "ふ": [
    "01100",
    "00010",
    "00100",
    "00100",
    "10010",
    "10101",
    "10001"
    ],
    "エ": [
    "00000",
    "11111",
    "00100",
    "00100",
    "00100",
    "00100",
    "11111"
    ],
    "サ": [
    "01010",
    "11111",
    "01010",
    "01010",
    "00010",
    "00100",
    "01000"
    ],
    "プ": [
    "00010",
    "00101",
    "11110",
    "00010",
    "00010",
    "00100",
    "11000"
    ],
    "ロ": [
    "0000",
    "1111",
    "1001",
    "1001",
    "1001",
    "1111",
    "0000"
    ],
    "テ": [
    "01110",
    "00000",
    "11111",
    "00100",
    "00100",
    "01000",
    "10000"
    ],
    "イ": [
    "0001",
    "0010",
    "0110",
    "1010",
    "0010",
    "0010",
    "0010"
    ],
    "ン": [
    "00000",
    "10000",
    "01001",
    "00001",
    "00010",
    "00100",
    "11000"
    ],
    "才": [
    "00010",
    "11111",
    "00010",
    "00110",
    "01010",
    "10010",
    "00110"
    ],
    "→": [
    "0000",
    "0010",
    "0011",
    "1111",
    "0011",
    "0010",
    "0000"
    ]
    };

  var INK = '#1a1c16ff';
  var GLYPHS = {};
  Object.keys(RAW_KANA).forEach(function (ch) {
    var rows = RAW_KANA[ch];
    GLYPHS[ch] = { w: rows[0].length, h: rows.length, rows: rows };
  });

  function has(ch) { return !!GLYPHS[ch]; }

  function digitW() { return 4; }

  /* Width in LCD dots (digits use the 4-wide device digits). */
  function kanaDots(text, tracking) {
    if (typeof tracking !== 'number') tracking = 1;
    var w = 0, n = 0;
    text = String(text || '');
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (GLYPHS[ch]) { w += GLYPHS[ch].w + tracking; n++; }
      else if (/[0-9]/.test(ch)) { w += digitW() + tracking; n++; }
    }
    return n ? w - tracking : 0;
  }

  function drawGlyph(ctx, g, x, y, scale) {
    ctx.fillStyle = INK;
    for (var r = 0; r < g.h; r++) {
      var row = g.rows[r];
      for (var c = 0; c < g.w; c++) {
        if (row.charAt(c) === '1') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  /* Draw a kana word. Digits go through VpetItems.drawNumber. */
  function drawKana(ctx, text, x, y, scale, tracking) {
    scale = scale || 1;
    if (typeof tracking !== 'number') tracking = 1;
    var dx = x;
    text = String(text || '');
    var I = root.VpetItems;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (GLYPHS[ch]) {
        drawGlyph(ctx, GLYPHS[ch], dx, y, scale);
        dx += (GLYPHS[ch].w + tracking) * scale;
      } else if (/[0-9]/.test(ch) && I && I.drawNumber) {
        I.drawNumber(ctx, Number(ch), dx, y, scale, 0);
        dx += (digitW() + tracking) * scale;
      }
    }
    var A = root.VpetLcdAudit;
    if (dx > x && A && A.on && typeof A.rec === 'function') {
      A.rec({ kind: 'kana', text: text, x: x, y: y, w: dx - x - Math.max(0, tracking) * scale, h: 7 * scale, scale: scale });
    }
    return dx - x;
  }

  var api = { RAW_KANA: RAW_KANA, GLYPHS: GLYPHS, has: has, kanaDots: kanaDots, drawKana: drawKana };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LcdKana = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
