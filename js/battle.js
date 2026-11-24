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
     10-press Critical cut is sourced, the lower cuts are PLACEHOLDER. Wikimon
     says 11 presses hits harder on the first shot, but not by how much, so
     11 stays in this same Critical tier. The
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

  /* Humulos tag-battle strongest rows. First meter is counted from the
     bottom (4 stops). Other stops and press counts are unpublished.
     Wikimon's "11 presses hits harder on the first shot" has no amount,
     so 11 is not its own row. */
  var DM20_TAG_SHOTS = [
    { meter: 3, presses: 9, shots: [12, 8, 6, 8, 12] },
    { meter: 3, presses: 12, shots: [12, 6, 8, 8, 12] },
    { meter: 2, presses: 12, shots: [8, 12, 8, 8, 8] }
  ];
  function dm20TagShots(meterFromBottom, presses) {
    for (var i = 0; i < DM20_TAG_SHOTS.length; i++) {
      var row = DM20_TAG_SHOTS[i];
      if (row.meter === meterFromBottom && row.presses === presses) return row.shots.slice();
    }
    return null;
  }
  /* Humulos: max Strength adds +1 damage per shot in a single battle, or
     +2 per shot in a tag battle when BOTH Digimon are at max Strength. */
  function dm20ShotBonus(strength, tag, partnerStrength) {
    if ((strength || 0) < 4) return 0;
    if (!tag) return 1;
    return (partnerStrength || 0) >= 4 ? 2 : 0;
  }
  function applyDm20ShotBonus(shots, bonus) {
    if (!shots || !bonus) return shots ? shots.slice() : null;
    var out = [];
    for (var i = 0; i < shots.length; i++) out.push(shots[i] + bonus);
    return out;
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


  /* Humulos DM20 list: [base power, attribute]. Babies have no power. */
  var DM20_POWER = {"agumon":[18,"vaccine"],"betamon":[10,"virus"],"greymon":[75,"vaccine"],"tyranomon":[70,"data"],"devimon":[65,"virus"],"meramon":[60,"data"],"airdramon":[55,"vaccine"],"seadramon":[50,"data"],"numemon":[40,"virus"],"metalgreymon":[126,"virus"],"mamemon":[118,"data"],"monzaemon":[107,"vaccine"],"blitzgreymon":[188,"virus"],"banchomamemon":[176,"data"],"gabumon":[18,"data"],"elecmon":[10,"data"],"kabuterimon":[75,"vaccine"],"garurumon":[70,"vaccine"],"angemon":[65,"vaccine"],"yukidarumon":[60,"vaccine"],"birdramon":[55,"vaccine"],"whamon":[50,"vaccine"],"vegimon":[40,"virus"],"skullgreymon":[126,"virus"],"metalmamemon":[118,"data"],"vademon":[107,"virus"],"skullmammon":[169,"vaccine"],"cresgarurumon":[188,"data"],"patamon":[18,"data"],"kunemon":[10,"virus"],"unimon":[75,"vaccine"],"centalmon":[70,"data"],"ogremon":[65,"virus"],"bakemon":[60,"virus"],"shellmon":[55,"data"],"drimogemon":[50,"data"],"sukamon":[40,"virus"],"andromon":[126,"vaccine"],"giromon":[118,"vaccine"],"etemon":[107,"virus"],"hiandromon":[176,"vaccine"],"kingetemon":[169,"virus"],"piyomon":[18,"vaccine"],"palmon":[10,"data"],"monochromon":[75,"data"],"cockatrimon":[70,"data"],"leomon":[65,"vaccine"],"kuwagamon":[60,"virus"],"coelamon":[55,"data"],"mojyamon":[50,"vaccine"],"nanimon":[40,"virus"],"megadramon":[126,"virus"],"piccolomon":[118,"data"],"digitamamon":[107,"data"],"aegisdramon":[188,"vaccine"],"titamon":[176,"virus"],"gazimon":[18,"virus"],"gizamon":[10,"virus"],"darktyranomon":[75,"virus"],"cyclomon":[70,"virus"],"devidramon":[65,"virus"],"tuskmon":[60,"virus"],"flymon":[55,"virus"],"deltamon":[50,"virus"],"raremon":[40,"virus"],"metaltyranomon":[126,"virus"],"nanomon":[118,"virus"],"extyranomon":[107,"vaccine"],"mugendramon":[188,"virus"],"pinochimon":[176,"virus"],"zubamon":[34,"vaccine"],"zubaeagermon":[90,"vaccine"],"duramon":[155,"vaccine"],"durandamon":[210,"vaccine"],"hackmon":[34,"data"],"baohackmon":[90,"data"],"saviorhuckmon":[155,"data"],"jesmon":[210,"data"],"dracomon":[34,"data"],"coredramon_blue":[80,"vaccine"],"wingdramon":[143,"vaccine"],"slayerdramon":[199,"vaccine"],"coredramon_green":[80,"virus"],"groundramon":[143,"virus"],"breakdramon":[199,"virus"],"coronamon":[27,"vaccine"],"firamon":[80,"vaccine"],"flaremon":[135,"vaccine"],"apollomon":[199,"vaccine"],"lunamon":[27,"data"],"lekismon":[80,"data"],"crescemon":[135,"data"],"dianamon":[199,"data"],"metalgreymon_va":[135,"vaccine"],"dorumon":[27,"data"],"dorugamon":[90,"data"],"doruguremon":[143,"data"],"alphamon":[210,"vaccine"],"plotmon":[27,"vaccine"],"meicoomon":[80,"free"],"meicrackmon":[143,"vaccine"],"rasielmon":[210,"vaccine"]};

  var DM20_STAGE_POWER = { rookie: 18, champion: 60, ultimate: 118, mega: 176, super: 199 };
  var DM20_BEATS = { vaccine: 'virus', virus: 'data', data: 'vaccine' };
  var DM20_SINGLE_HP = 10;
  /* gameomocha: tag HP was not measured; about 30. Single HP 10 is stated. */
  var DM20_TAG_HP = 30;

  function dm20Listed(mon) {
    var row = mon && DM20_POWER[mon.id];
    var stageP = DM20_STAGE_POWER[mon && mon.stage] || 18;
    if (!row) return { power: stageP, attr: 'free' };
    return { power: row[0] || stageP, attr: row[1] || 'free' };
  }

  /* Humulos: base power, +4 per Strength heart, +32 if your attribute beats
     theirs. NHOKO: 99g or empty Hunger removes the Strength bonus. */
  function dm20BattlePower(mon, extra) {
    extra = extra || {};
    var listed = dm20Listed(mon);
    var hearts = extra.strength || 0;
    if (hearts > 4) hearts = 4;
    var blocked = (extra.weight || 0) >= 99 || (extra.hunger || 0) <= 0;
    var p = listed.power + (blocked ? 0 : hearts * 4);
    if (extra.foeAttr && DM20_BEATS[listed.attr] === extra.foeAttr) p += 32;
    return p;
  }

  /* Hit chance from the power gap. Humulos describes the direction and that
     a large gap can still miss. The exact percentage is not published.
     ±400 power spans the 4–238 list, and the result stays between 15% and 85%. */
  function dm20HitChance(attPower, defPower) {
    var c = 0.5 + ((attPower || 0) - (defPower || 0)) / 400;
    if (c < 0.15) c = 0.15;
    if (c > 0.85) c = 0.85;
    return c;
  }

  /* Single attack from the photographed 1/2/3/4 pt chart (gameomocha) and
     Humulos order Weak < Strong < Double Weak < Double Strong < Critical.
     Wikimon: 10 presses is Critical and the first shot may miss; 11 presses
     does more damage on that first shot (the 4pt hit). Press cuts below 10
     are the four pictured damages across the meter; those cuts are not published. */
  function dm20SinglePattern(presses) {
    var n = presses || 0;
    if (n >= 11) return { order: 'critical', shots: [4, 2], firstMiss: false };
    if (n >= 10) return { order: 'critical', shots: [2, 2], firstMiss: true };
    if (n >= 8) return { order: 'doubleStrong', shots: [2, 2], firstMiss: false };
    if (n >= 5) return { order: 'doubleWeak', shots: [1, 2], firstMiss: false };
    if (n >= 3) return { order: 'strong', shots: [2], firstMiss: false };
    return { order: 'weak', shots: [1], firstMiss: false };
  }

  function dm20StrengthBlocked(extra) {
    extra = extra || {};
    return (extra.weight || 0) >= 99 || (extra.hunger || 0) <= 0;
  }

  /* Both sides have the same HP. Shots alternate, player first. A shot hits
     with dm20HitChance. Leftover HP decides if nobody is knocked out.
     The CPU mash count is not published; they throw Double Strong (two 2pt
     shots) unless the caller passes presses. */
  function resolveDm20(selfId, foeId, seed, selfExtra, foeExtra) {
    var self = data.MONSTERS[selfId];
    var foe = data.MONSTERS[foeId];
    selfExtra = selfExtra || {};
    foeExtra = foeExtra || {};
    var rng = (typeof selfExtra.rng === 'function') ? selfExtra.rng : mulberry((seed || 0) >>> 0);
    var tag = !!selfExtra.tag;
    var selfListed = dm20Listed(self);
    var foeListed = dm20Listed(foe);
    var selfPow = dm20BattlePower(self, {
      strength: selfExtra.strength, weight: selfExtra.weight, hunger: selfExtra.hunger, foeAttr: foeListed.attr
    });
    var foeHunger = foeExtra.hunger == null ? 4 : foeExtra.hunger;
    var foeWeight = foeExtra.weight == null ? 30 : foeExtra.weight;
    var foePow = dm20BattlePower(foe, {
      strength: foeExtra.strength || 0, weight: foeWeight, hunger: foeHunger, foeAttr: selfListed.attr
    });
    var selfPat = (tag && selfExtra.shots && selfExtra.shots.length)
      ? { order: 'tag', shots: selfExtra.shots.slice(), firstMiss: false }
      : dm20SinglePattern(selfExtra.presses || 0);
    var foePat = dm20SinglePattern(foeExtra.presses == null ? 8 : foeExtra.presses);
    var selfBonus = dm20StrengthBlocked(selfExtra) ? 0 : dm20ShotBonus(selfExtra.strength || 0, tag, selfExtra.partnerStrength || 0);
    var foeBonus = dm20StrengthBlocked({ weight: foeWeight, hunger: foeHunger }) ? 0 : dm20ShotBonus(foeExtra.strength || 0, false, 0);
    function boosted(shots, bonus) {
      var o = [], i;
      for (i = 0; i < shots.length; i++) o.push(shots[i] + (bonus || 0));
      return o;
    }
    var selfShots = boosted(selfPat.shots, selfBonus);
    var foeShots = boosted(foePat.shots, foeBonus);
    var hpMax = tag ? DM20_TAG_HP : DM20_SINGLE_HP;
    var selfHp = hpMax, foeHp = hpMax;
    var log = [];
    var turns = Math.max(selfShots.length, foeShots.length);
    var selfHit = dm20HitChance(selfPow, foePow);
    var foeHit = dm20HitChance(foePow, selfPow);
    var i;
    for (i = 0; i < turns; i++) {
      if (selfHp <= 0 || foeHp <= 0) break;
      if (i < selfShots.length) {
        var chance = selfHit;
        if (i === 0 && selfPat.firstMiss) chance = chance * 0.5;
        var hit = rng() < chance;
        if (hit) foeHp = Math.max(0, foeHp - selfShots[i]);
        log.push({ side: 'self', dmg: selfShots[i], hit: hit, selfHp: selfHp, foeHp: foeHp });
      }
      if (selfHp <= 0 || foeHp <= 0) break;
      if (i < foeShots.length) {
        var hitF = rng() < foeHit;
        if (hitF) selfHp = Math.max(0, selfHp - foeShots[i]);
        log.push({ side: 'foe', dmg: foeShots[i], hit: hitF, selfHp: selfHp, foeHp: foeHp });
      }
    }
    var result;
    if (foeHp <= 0 && selfHp > 0) result = 'win';
    else if (selfHp <= 0 && foeHp > 0) result = 'loss';
    else if (selfHp > foeHp) result = 'win';
    else if (foeHp > selfHp) result = 'loss';
    else result = rng() < 0.5 ? 'win' : 'loss';
    return {
      result: result, log: log, selfHp: selfHp, foeHp: foeHp, hpMax: hpMax,
      selfPower: selfPow, foePower: foePow
    };
  }

  root.Battle = {
    resolveBattle: resolveBattle,
    resolveDm20: resolveDm20,
    dm20SinglePattern: dm20SinglePattern,
    dm20BattlePower: dm20BattlePower,
    dm20HitChance: dm20HitChance,
    DM20_SINGLE_HP: DM20_SINGLE_HP,
    chargeTier: chargeTier,
    chargeBoost: chargeBoost,
    dm20TagShots: dm20TagShots,
    dm20ShotBonus: dm20ShotBonus,
    applyDm20ShotBonus: applyDm20ShotBonus,
    DM20_TAG_SHOTS: DM20_TAG_SHOTS,
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
