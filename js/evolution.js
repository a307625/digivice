/**
 * Pure evolution resolver for Digital Monster Ver.1–5 + 20th Anniversary mega.
 * Works in both Node and the browser. No DOM / no timers.
 */
(function (root) {
  'use strict';

  function inRange(value, range) {
    if (range == null) return true;
    var min = range[0];
    var max = range[1];
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    return true;
  }

  function num(v, d) {
    if (v == null || Number.isNaN(Number(v))) return d;
    return Number(v);
  }

  /**
   * @param {object} rule
   * @param {object} stats
   *   calls, train, overfeed, sleepDist, weight, battles, wins, winRate, timeInStage
   */
  function matchesRule(rule, stats) {
    if (rule.leftover) return true;
    if (rule.eggKind && rule.eggKind !== stats.eggKind) return false;
    var battles = num(stats.battles, 0);
    var wins = num(stats.wins, null);
    var winRate = stats.winRate;
    if (winRate == null) {
      winRate = battles > 0 && wins != null ? wins / battles : 0;
    }
    return (
      inRange(num(stats.calls, 0), rule.calls) &&
      inRange(num(stats.train, 0), rule.train) &&
      inRange(num(stats.overfeed, 0), rule.overfeed) &&
      inRange(num(stats.sleepDist, 0), rule.sleepDist) &&
      inRange(num(stats.weight, 0), rule.weight) &&
      inRange(battles, rule.battles) &&
      inRange(winRate, rule.winRate) &&
      inRange(num(stats.timeInStage, Infinity), rule.timeInStage)
    );
  }

  /**
   * First matching rule wins (official priority / leftover last).
   * Returns { to, rule, stayed } where `to` is the destination id, or the
   * same as fromId when the Digimon should remain in its current form.
   */
  function resolveEvolution(data, fromId, stats) {
    var monster = data.MONSTERS[fromId];
    if (!monster) {
      return { to: fromId, rule: null, stayed: true, reason: 'unknown-from' };
    }
    var rules = data.BRANCHES[fromId] || [];
    if (!rules.length) {
      return { to: fromId, rule: null, stayed: true, reason: 'no-branches' };
    }
    var minTime = monster.lifespanMin;
    if (minTime != null && num(stats.timeInStage, 0) < minTime) {
      return { to: fromId, rule: null, stayed: true, reason: 'too-early' };
    }
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (matchesRule(rule, stats)) {
        if (rule.stay || rule.to == null) {
          return { to: fromId, rule: rule, stayed: true, reason: rule.reason || 'stay' };
        }
        return { to: rule.to, rule: rule, stayed: false, reason: rule.leftover ? 'leftover' : 'match' };
      }
    }
    return { to: fromId, rule: null, stayed: true, reason: 'no-match' };
  }

  function mid(range) {
    if (range == null) return 0;
    var a = range[0] == null ? 0 : range[0];
    var b = range[1];
    if (b == null) {
      if (a <= 0) return 0;
      if (a < 10) return a + 2;
      if (a < 40) return a + 8;
      return a + 10;
    }
    return Math.floor((a + b) / 2);
  }

  /**
   * Build a canonical stat snapshot that should uniquely hit a non-leftover rule.
   */
  function witnessStats(rule, monster) {
    var time = 999999;
    if (monster && monster.lifespanMin != null) time = monster.lifespanMin;
    if (rule.timeInStage && rule.timeInStage[0] != null) {
      time = Math.max(time, rule.timeInStage[0]);
    }
    var stats = {
      calls: rule.calls ? mid(rule.calls) : 0,
      train: rule.train ? mid(rule.train) : 0,
      overfeed: rule.overfeed ? mid(rule.overfeed) : 0,
      sleepDist: rule.sleepDist ? mid(rule.sleepDist) : 0,
      weight: rule.weight ? mid(rule.weight) : 20,
      battles: rule.battles ? mid(rule.battles) : 0,
      wins: 0,
      winRate: 0,
      timeInStage: time
    };
    if (rule.eggKind) stats.eggKind = rule.eggKind;
    if (rule.winRate) {
      stats.winRate = mid(rule.winRate);
      if (stats.winRate > 1) stats.winRate = stats.winRate / 100;
      stats.wins = Math.ceil(stats.battles * stats.winRate);
      if (stats.battles > 0 && stats.wins / stats.battles < (rule.winRate[0] || 0)) {
        stats.wins = stats.battles;
        stats.winRate = 1;
      }
    } else if (stats.battles > 0) {
      stats.wins = stats.battles;
      stats.winRate = 1;
    }
    return stats;
  }

  function listBranches(data, fromId) {
    return (data.BRANCHES[fromId] || []).slice();
  }

  var api = {
    inRange: inRange,
    matchesRule: matchesRule,
    resolveEvolution: resolveEvolution,
    witnessStats: witnessStats,
    mid: mid,
    listBranches: listBranches
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.Evolution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
