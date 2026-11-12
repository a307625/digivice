/**
 * CPU battles (opponents from all versions) + code-exchange PvP.
 * Both increment the same battle counters used for evolution.
 */
(function (root) {
  'use strict';
  var data = root.EvolutionData;

  var RANK_VAL = { B: 0, A: 1, S: 2, M: 3, X: 4 };
  var STAGE_VAL = { rookie: 1, champion: 2, ultimate: 3, mega: 4, super: 5 };

  function tribeBeats(a, b) {
    if (!a || !b || a === b) return 0;
    if (a === 'A' && b === 'B') return 1;
    if (b === 'A' && a === 'B') return -1;
    if (a === 'B' && b === 'C') return 1;
    if (b === 'B' && a === 'C') return -1;
    if (a === 'C' && b === 'A') return 1;
    if (b === 'C' && a === 'A') return -1;
    return 0;
  }

  // Win chance of the LOWER stage by stage gap (1, 2, 3+).
  var UPSET = [0.5, 0.08, 0.02, 0.005];

  function stageGap(self, foe) {
    if (!self || !foe) return 0;
    return (STAGE_VAL[self.stage] || 1) - (STAGE_VAL[foe.stage] || 1);
  }

  function strengthOf(id, extra) {
    var m = data.MONSTERS[id];
    if (!m) return 1;
    var s = (STAGE_VAL[m.stage] || 1) * 10 + (RANK_VAL[m.rank] || 1) * 3;
    if (extra && extra.strength) s += extra.strength;
    if (extra && extra.effort) s += Math.min(4, extra.effort);
    return s;
  }

  /**
   * Deterministic resolution from seed. Returns 'win' | 'loss' (no ties).
   */
  function resolveBattle(selfId, foeId, seed, selfExtra, foeExtra) {
    var self = data.MONSTERS[selfId];
    var foe = data.MONSTERS[foeId];
    var rng = mulberry(seed);
    var sa = strengthOf(selfId, selfExtra);
    var sb = strengthOf(foeId, foeExtra);
    var gap = stageGap(self, foe);
    var chance;
    if (gap === 0) {
      chance = 0.5 + (sa - sb) * 0.04;
      if (self && foe && self.rank === foe.rank) {
        chance += tribeBeats(self.tribe, foe.tribe) * 0.15;
      }
      chance = Math.max(0.12, Math.min(0.88, chance));
    } else {
      // Different stages: the lower stage almost never wins.
      var under = UPSET[Math.min(Math.abs(gap), 3)];
      chance = gap > 0 ? 1 - under : under;
    }
    return rng() < chance ? 'win' : 'loss';
  }

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickCpuFoe(selfId) {
    var self = data.MONSTERS[selfId];
    var stage = self ? self.stage : 'rookie';
    var pool = Object.keys(data.MONSTERS).filter(function (id) {
      var m = data.MONSTERS[id];
      return m.canBattle && m.stage === stage && id !== selfId;
    });
    if (!pool.length) {
      pool = Object.keys(data.MONSTERS).filter(function (id) {
        return data.MONSTERS[id].canBattle && id !== selfId;
      });
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function snapshot(state) {
    return {
      mon: state.mon,
      strength: state.strength,
      weight: state.weight,
      stage: (data.MONSTERS[state.mon] || {}).stage
    };
  }

  function makeOffer(state) {
    var seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    var body = { t: 'offer', seed: seed, you: snapshot(state), at: Date.now() };
    return pack('O', body);
  }

  function acceptOffer(code, state) {
    var body = unpack(code);
    if (!body || body.t !== 'offer') throw new Error('不是有效的對戰邀請碼');
    var result = resolveBattle(state.mon, body.you.mon, body.seed, snapshot(state), body.you);
    // result is from acceptor's perspective vs offerer. Offer encoded self as "you".
    // Acceptor fights offerer: self=state.mon, foe=body.you.mon
    var reply = {
      t: 'result',
      seed: body.seed,
      offer: body.you,
      accept: snapshot(state),
      // winner from offerer's view:
      offerWin: result === 'loss',
      at: Date.now()
    };
    return { code: pack('R', reply), result: result, foe: body.you };
  }

  function applyResult(code, state) {
    var body = unpack(code);
    if (!body || body.t !== 'result') throw new Error('不是有效的對戰結果碼');
    if (!body.offer || body.offer.mon !== state.mon) throw new Error('結果碼與目前的數碼寶貝不符');
    return { result: body.offerWin ? 'win' : 'loss', foe: body.accept };
  }

  function pack(kind, obj) {
    var payload = root.LZString
      ? root.LZString.compressToEncodedURIComponent(JSON.stringify(obj))
      : btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    var sum = root.SaveIO.crc32(kind + payload);
    return 'DM20B.' + kind + '.' + payload + '.' + sum;
  }
  function unpack(code) {
    var raw = String(code || '').trim().replace(/\s+/g, '');
    var m = raw.match(/DM20B\.[OR]\.[A-Za-z0-9\-_]+(?:\.[A-Za-z0-9]+)?/);
    if (m) raw = m[0];
    var parts = raw.split('.');
    if (parts.length < 4 || parts[0] !== 'DM20B') throw new Error('對戰碼格式不正確');
    if (root.SaveIO.crc32(parts[1] + parts[2]) !== parts[3]) throw new Error('對戰碼檢查碼不符');
    var json = root.LZString
      ? root.LZString.decompressFromEncodedURIComponent(parts[2])
      : decodeURIComponent(escape(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json);
  }

  root.Battle = {
    resolveBattle: resolveBattle,
    pickCpuFoe: pickCpuFoe,
    makeOffer: makeOffer,
    acceptOffer: acceptOffer,
    applyResult: applyResult,
    snapshot: snapshot
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
