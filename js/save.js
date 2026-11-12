/**
 * Save export/import: compressed code + checksum + version.
 * Format: DM20.<ver>.<payload>.<checksum>
 */
(function (root) {
  'use strict';
  var PREFIX = 'DM20';
  var VERSION = 1;
  var KEY = 'digivice-save-v1';

  function crc32(str) {
    var t = crc32.table;
    if (!t) {
      t = crc32.table = new Uint32Array(256);
      for (var i = 0; i < 256; i++) {
        var c = i;
        for (var k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
        t[i] = c >>> 0;
      }
    }
    var crc = 0 ^ -1;
    for (var j = 0; j < str.length; j++) {
      crc = (crc >>> 8) ^ t[(crc ^ str.charCodeAt(j)) & 0xff];
    }
    return ((crc ^ -1) >>> 0).toString(36);
  }

  function compress(json) {
    if (root.LZString) return root.LZString.compressToEncodedURIComponent(json);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decompress(payload) {
    if (root.LZString) {
      var s = root.LZString.decompressFromEncodedURIComponent(payload);
      if (s != null) return s;
    }
    var b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return decodeURIComponent(escape(atob(b64)));
  }

  function slim(state) {
    return {
      v: VERSION,
      exportedAt: Date.now(),
      state: state
    };
  }

  function encode(state) {
    var json = JSON.stringify(slim(state));
    var payload = compress(json);
    var sum = crc32(VERSION + '.' + payload);
    return [PREFIX, VERSION, payload, sum].join('.');
  }

  function decode(code) {
    if (!code || typeof code !== 'string') throw new Error('沒有存檔碼');
    var raw = code.trim().replace(/\s+/g, '');
    // allow scanning URLs that wrap the code
    var m = raw.match(/DM20\.[0-9]+\.[A-Za-z0-9\-_]+(?:\.[A-Za-z0-9]+)?/);
    if (m) raw = m[0];
    var parts = raw.split('.');
    if (parts.length < 4 || parts[0] !== PREFIX) throw new Error('存檔碼格式不正確');
    var ver = parseInt(parts[1], 10);
    var payload = parts[2];
    var sum = parts[3];
    if (crc32(ver + '.' + payload) !== sum) throw new Error('存檔碼檢查碼不符，可能已損壞');
    var json = decompress(payload);
    var obj = JSON.parse(json);
    if (!obj || !obj.state) throw new Error('存檔內容不完整');
    return obj;
  }

  function loadLocal() {
    try {
      var s = localStorage.getItem(KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }
  function saveLocal(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function hasLocal() {
    return !!localStorage.getItem(KEY);
  }
  function clearLocal() {
    localStorage.removeItem(KEY);
  }

  root.SaveIO = {
    PREFIX: PREFIX,
    VERSION: VERSION,
    KEY: KEY,
    encode: encode,
    decode: decode,
    crc32: crc32,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    hasLocal: hasLocal,
    clearLocal: clearLocal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SaveIO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
