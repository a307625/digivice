/**
 * CPU battles (opponents from all versions) + code-exchange PvP.
 * Both increment the same battle counters used for evolution.
 *
 * 1997 firmware: initiator wins iff M(A3) ≥ threshold, chance (16−t)/16,
 * from the measured 12×12 slot table (Humulos / firmware 0x0D7A) plus boost
 * difference. Boost is supplied by the engine:
 *   ⌊max(min(overdoses,4) + strengthHearts − min(CM,4), 0) / 2⌋
 * The difference is initiator boost − defender boost, then clamped to 1–16.
 * There is no 1997 attribute triangle, no hit-count formula, and no
 * stage-gap cap. Slots already cover cross-stage (Child A–B, Adult C–I,
 * Perfect J–L). The device that presses Battle is the initiator every time.
 * PvP: the offerer presses Battle, so the offerer initiates.
 *
 * NO 1997 SLOT (Mega and later): not on the firmware table. Same stage uses
 * a labelled 0.5 placeholder. A stage gap uses 8% / 2% / 0.5% for a gap of
 * 1 / 2 / 3+. That fallback is not a firmware value.
 */
(function (root) {
  'use strict';
  var data = root.EvolutionData;

  var STAGE_VAL = { rookie: 1, champion: 2, ultimate: 3, mega: 4, super: 5 };

  // Official initiator wins / 16. Rows = initiator A–L, columns = opponent.
  // Source: rules-audit appendix B = Humulos battle chart = firmware 0x0D7A.
  var TABLE = {
    A: { A: 8, B: 8, C: 2, D: 3, E: 2, F: 3, G: 2, H: 3, I: 2, J: 1, K: 1, L: 1 },
    B: { A: 8, B: 8, C: 2, D: 3, E: 2, F: 3, G: 2, H: 3, I: 2, J: 1, K: 1, L: 1 },
    C: { A: 14, B: 13, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 2, K: 3, L: 2 },
    D: { A: 14, B: 13, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 2, K: 3, L: 2 },
    E: { A: 14, B: 13, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 2, K: 3, L: 2 },
    F: { A: 14, B: 13, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 2, K: 3, L: 2 },
    G: { A: 14, B: 13, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 2, K: 3, L: 2 },
    H: { A: 14, B: 13, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 2, K: 3, L: 2 },
    I: { A: 9, B: 9, C: 3, D: 5, E: 3, F: 5, G: 3, H: 5, I: 3, J: 1, K: 1, L: 1 },
    J: { A: 15, B: 15, C: 14, D: 11, E: 14, F: 11, G: 14, H: 11, I: 14, J: 5, K: 5, L: 5 },
    K: { A: 15, B: 15, C: 14, D: 11, E: 14, F: 11, G: 14, H: 11, I: 14, J: 5, K: 5, L: 5 },
    L: { A: 15, B: 15, C: 14, D: 11, E: 14, F: 11, G: 14, H: 11, I: 14, J: 5, K: 5, L: 5 }
  };

  // No-slot fallback only: win chance of the LOWER stage by stage gap (1, 2, 3+).
  // Not a 1997 firmware value. Slotted fights never read this.
  var UPSET = [0.5, 0.08, 0.02, 0.005];

  function stageGap(self, foe) {
    if (!self || !foe) return 0;
    return (STAGE_VAL[self.stage] || 1) - (STAGE_VAL[foe.stage] || 1);
  }

  function slotOf(m) {
    return m && m.slot ? m.slot : null;
  }

  function tableCell(initSlot, foeSlot) {
    if (!initSlot || !foeSlot || !TABLE[initSlot]) return null;
    var v = TABLE[initSlot][foeSlot];
    return v == null ? null : v;
  }

  /**
   * Official initiator wins out of 16, after boost, clamped 1–16.
   * Returns null if the pairing has no table cell.
   */
  function initiatorWinsOutOf16(initSlot, foeSlot, boostDiff) {
    var cell = tableCell(initSlot, foeSlot);
    if (cell == null) return null;
    var w = cell + (boostDiff || 0);
    if (w < 1) w = 1;
    if (w > 16) w = 16;
    return w;
  }

  function boostOf(extra) {
    if (!extra) return 0;
    if (extra.enhancement != null) return extra.enhancement;
    return 0;
  }

  /**
   * Player (self) win probability.
   * selfExtra.initiator === false means the opponent initiates (default: self initiates).
   */
  function selfWinChance(self, foe, selfExtra, foeExtra) {
    var selfInit = !(selfExtra && selfExtra.initiator === false);
    var sb = boostOf(selfExtra);
    var fb = boostOf(foeExtra);
    var ss = slotOf(self);
    var fs = slotOf(foe);
    if (ss && fs) {
      if (selfInit) {
        var w = initiatorWinsOutOf16(ss, fs, sb - fb);
        if (w != null) return w / 16;
      } else {
        var w2 = initiatorWinsOutOf16(fs, ss, fb - sb);
        if (w2 != null) return 1 - w2 / 16;
      }
    }
    // No 1997 slot on one or both sides. Not a firmware value.
    var gap = stageGap(self, foe);
    if (gap === 0) return 0.5;
    var underMax = UPSET[Math.min(Math.abs(gap), 3)];
    return gap > 0 ? 1 - underMax : underMax;
  }

  /**
   * Deterministic resolution from seed. Returns 'win' | 'loss' (no ties).
   */
  function resolveBattle(selfId, foeId, seed, selfExtra, foeExtra) {
    var self = data.MONSTERS[selfId];
    var foe = data.MONSTERS[foeId];
    var rng = mulberry(seed);
    var chance = selfWinChance(self, foe, selfExtra, foeExtra);
    return rng() < chance ? 'win' : 'loss';
  }

  /* DM20 single battle "!" charge (v32). Humulos: the mash sets the attack
     order Weak < Strong < Double Weak < Double Strong < Critical; Wikimon:
     about 10 presses gives the Critical order. Tiers 0–4 by presses; only the
     10-press Critical cut is sourced, the lower cuts are PLACEHOLDER. The
     DM20 HP damage table is unpublished, so the tier is applied as a small
     boost on the existing win model (PLACEHOLDER: +0/+0/+1/+1/+2 sixteenths),
     not as a fake damage simulation. */
  var CHARGE_CUTS = [3, 6, 8, 10];
  function chargeTier(presses) {
    var n = presses || 0, t = 0;
    for (var i = 0; i < CHARGE_CUTS.length; i++) if (n >= CHARGE_CUTS[i]) t = i + 1;
    return t;
  }
  function chargeBoost(tier) { return [0, 0, 1, 1, 2][Math.max(0, Math.min(4, tier || 0))]; }

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
    var m = data.MONSTERS[state.mon] || {};
    var enhancement = 0;
    if (root.Engine && root.Engine.enhancement) {
      enhancement = root.Engine.enhancement(state);
    } else if (state.enhancement != null) {
      enhancement = state.enhancement;
    }
    return {
      mon: state.mon,
      strength: state.strength,
      weight: state.weight,
      stage: m.stage,
      slot: m.slot || null,
      enhancement: enhancement,
      initiator: state.initiator
    };
  }

  function makeOffer(state) {
    var seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    var you = snapshot(state);
    you.initiator = true; // offerer is the initiator
    var body = { t: 'offer', seed: seed, you: you, at: Date.now() };
    return pack('O', body);
  }

  function acceptOffer(code, state) {
    var body = unpack(code);
    if (!body || body.t !== 'offer') throw new Error('不是有效的對戰邀請碼');
    var selfSnap = snapshot(state);
    selfSnap.initiator = false; // acceptor is not the initiator
    var result = resolveBattle(state.mon, body.you.mon, body.seed, selfSnap, body.you);
    var reply = {
      t: 'result',
      seed: body.seed,
      offer: body.you,
      accept: selfSnap,
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
    chargeTier: chargeTier,
    chargeBoost: chargeBoost,
    pickCpuFoe: pickCpuFoe,
    makeOffer: makeOffer,
    acceptOffer: acceptOffer,
    applyResult: applyResult,
    snapshot: snapshot,
    selfWinChance: selfWinChance,
    initiatorWinsOutOf16: initiatorWinsOutOf16,
    TABLE: TABLE,
    UPSET: UPSET,
    STAGE_VAL: STAGE_VAL
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Battle;
})(typeof globalThis !== 'undefined' ? globalThis : this);
