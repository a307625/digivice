#!/usr/bin/env node
/**
 * Step-counting: Health delta, new day, bad values, motion+Health merge,
 * care effects, ledger carry, save backward compatibility.
 */
'use strict';

const Steps = require('../js/steps.js');
const SaveIO = require('../js/save.js');

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log('  FAIL  ' + msg);
  }
}

function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

function fresh(extra) {
  var s = {
    mon: 'agumon',
    train: 0,
    strength: 2,
    weight: 20,
    hunger: 2,
    dead: false,
    events: [],
    gameTime: 0
  };
  if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
  Steps.ensure(s);
  return s;
}

console.log('Step counting tests');
console.log('===================\n');

// ---------- parse / validate ----------
console.log('1) URL parse and validation');
{
  var p = Steps.parseParams('?steps=8421&date=2026-11-12', '');
  ok(p.present && p.ok && p.steps === 8421 && p.date === '2026-11-12', 'query steps+date');

  var h = Steps.parseParams('', '#steps=100&date=2026-11-12');
  ok(h.present && h.ok && h.steps === 100, 'hash steps');

  var hq = Steps.parseParams('', '#?steps=200&date=2026-11-11');
  ok(hq.ok && hq.steps === 200 && hq.date === '2026-11-11', 'hash with ?');

  var ts = Steps.parseTs('1731400000'); // seconds
  ok(ts === 1731400000000, 'ts seconds expanded to ms');
  var pTs = Steps.parseParams('?steps=10&ts=1731400000000', '');
  ok(pTs.ok && /^\d{4}-\d{2}-\d{2}$/.test(pTs.date), 'ts supplies local date');

  eq(Steps.parseParams('', '').present, false, 'no params: not present');
  eq(Steps.parseParams('?date=2026-11-12', '').present, false, 'date only is not an import');

  eq(Steps.parseParams('?steps=-3&date=2026-11-12', '').reason, 'negative', 'negative rejected');
  eq(Steps.parseParams('?steps=abc&date=2026-11-12', '').reason, 'non-numeric', 'non-numeric rejected');
  eq(Steps.parseParams('?steps=100001&date=2026-11-12', '').reason, 'too-large', '>100000 rejected');
  eq(Steps.parseParams('?steps=100000&date=2026-11-12', '').ok, true, '100000 accepted');
  eq(Steps.parseParams('?steps=0&date=2026-11-12', '').ok, true, '0 accepted');
  eq(Steps.parseParams('?steps=8,421&date=2026-11-12', '').steps, 8421, 'commas stripped');
  eq(Steps.parseParams('?steps=12.9&date=2026-11-12', '').steps, 12, 'floored');
  eq(Steps.parseParams('?steps=10&date=2026-13-40', '').reason, 'bad-date', 'invalid date rejected');
  eq(Steps.parseParams('?steps=1e6&date=2026-11-12', '').ok, false, 'scientific notation rejected');
}

// ---------- Health deltas ----------
console.log('\n2) Health import deltas');
{
  var s = fresh();
  var r1 = Steps.applyHealth(s, { ok: true, steps: 8421, date: '2026-11-12' }, 1000);
  eq(r1.ok, true, 'first import ok');
  eq(r1.delta, 8421, 'first import credits full total');
  eq(s.steps.lifetime, 8421, 'lifetime after first import');
  eq(s.steps.days['2026-11-12'].health, 8421, 'health max stored');
  eq(s.steps.days['2026-11-12'].credited, 8421, 'credited equals health');
  eq(s.steps.lastHealthSyncTotal, 8421, 'last sync total');
  eq(s.steps.lastHealthSyncDate, '2026-11-12', 'last sync date');

  var r2 = Steps.applyHealth(s, { ok: true, steps: 8421, date: '2026-11-12' }, 2000);
  eq(r2.delta, 0, 'repeat same total credits 0');
  eq(s.steps.lifetime, 8421, 'lifetime unchanged on repeat');
  eq(s.steps.lastHealthSyncAt, 2000, 'repeat still updates sync time');

  var r3 = Steps.applyHealth(s, { ok: true, steps: 9000, date: '2026-11-12' }, 3000);
  eq(r3.delta, 579, 'higher total credits only the difference');
  eq(s.steps.lifetime, 9000, 'lifetime is cumulative credited');

  var r4 = Steps.applyHealth(s, { ok: true, steps: 8000, date: '2026-11-12' }, 4000);
  eq(r4.delta, 0, 'lower total does not reduce or re-credit');
  eq(s.steps.days['2026-11-12'].health, 9000, 'health stays at max');
}

// ---------- New day ----------
console.log('\n3) New day starts from 0');
{
  var s = fresh();
  Steps.applyHealth(s, { ok: true, steps: 5000, date: '2026-11-12' }, 1000);
  var r = Steps.applyHealth(s, { ok: true, steps: 200, date: '2026-11-13' }, 2000);
  eq(r.delta, 200, 'new date credits its own total from 0');
  eq(s.steps.lifetime, 5200, 'lifetime sums both days');
  eq(s.steps.days['2026-11-12'].credited, 5000, 'previous day unchanged');
  eq(s.steps.days['2026-11-13'].health, 200, 'new day health stored');
}

// ---------- Bad values do not mutate ----------
console.log('\n4) Bad values ignored (state unchanged)');
{
  var s = fresh();
  Steps.applyHealth(s, { ok: true, steps: 100, date: '2026-11-12' }, 1000);
  var snap = JSON.stringify(s.steps);

  var bad = [
    Steps.applyHealth(s, { ok: false, reason: 'negative', steps: -1, date: '2026-11-12' }),
    Steps.applyHealth(s, { ok: true, steps: 100001, date: '2026-11-12' }),
    Steps.applyHealth(s, { ok: true, steps: 'nope', date: '2026-11-12' }),
    Steps.applyHealth(s, { ok: true, steps: 50, date: 'not-a-date' }),
    Steps.applyHealth(s, { ok: true, steps: 50, date: '1999-01-01' })
  ];
  bad.forEach(function (r, i) {
    ok(!r.ok && r.delta === 0, 'bad[' + i + '] rejected');
  });
  eq(JSON.stringify(s.steps), snap, 'bad values leave steps state untouched');
}

// ---------- Motion + Health merge ----------
console.log('\n5) Motion + Health merge (max, no double count)');
{
  // motion first, then Health higher
  var a = fresh();
  var m1 = Steps.addMotion(a, 200, '2026-11-12');
  eq(m1.delta, 200, 'motion alone credits 200');
  eq(a.steps.lifetime, 200, 'lifetime 200 from motion');
  var h1 = Steps.applyHealth(a, { ok: true, steps: 8000, date: '2026-11-12' }, 1);
  eq(h1.delta, 7800, 'Health then credits only 8000-200');
  eq(a.steps.lifetime, 8000, 'total credited = max(8000, 200)');
  eq(a.steps.days['2026-11-12'].credited, 8000, 'credited is max');

  // Health first, then motion below
  var b = fresh();
  Steps.applyHealth(b, { ok: true, steps: 8000, date: '2026-11-12' }, 1);
  var m2 = Steps.addMotion(b, 200, '2026-11-12');
  eq(m2.delta, 0, 'motion below Health credits 0');
  eq(b.steps.lifetime, 8000, 'lifetime stays 8000');
  eq(b.steps.days['2026-11-12'].motion, 200, 'motion still recorded');

  // Health first, then motion above
  var c = fresh();
  Steps.applyHealth(c, { ok: true, steps: 8000, date: '2026-11-12' }, 1);
  var m3 = Steps.addMotion(c, 8100, '2026-11-12');
  eq(m3.delta, 100, 'motion above Health credits the extra 100');
  eq(c.steps.lifetime, 8100, 'lifetime = max(8000, 8100)');

  // Health again equal: no extra
  var h2 = Steps.applyHealth(c, { ok: true, steps: 8000, date: '2026-11-12' }, 2);
  eq(h2.delta, 0, 're-import of lower/equal Health after higher motion: 0');
  eq(c.steps.lifetime, 8100, 'lifetime stays at 8100');
}

// ---------- Effects ----------
console.log('\n6) Care effects and daily caps');
{
  var s = fresh({ train: 0, strength: 1, weight: 20 });
  // 499: no block crossed
  Steps.applyHealth(s, { ok: true, steps: 499, date: '2026-11-12' }, 1);
  eq(s.train, 0, '499 steps: no effort');
  eq(s.weight, 20, '499 steps: no weight loss');

  Steps.applyHealth(s, { ok: true, steps: 500, date: '2026-11-12' }, 2);
  eq(s.train, 1, '500 steps: +1 effort');
  eq(s.strength, 2, '500 steps: +1 strength');
  eq(s.weight, 20, '500 steps: no weight (needs 1000)');

  Steps.applyHealth(s, { ok: true, steps: 1000, date: '2026-11-12' }, 3);
  eq(s.train, 2, '1000 steps: +2 effort total');
  eq(s.weight, 19, '1000 steps: −1 g');

  // 4000 steps = 8 effort blocks — at the daily cap
  var c = fresh({ train: 0, strength: 0, weight: 30 });
  Steps.applyHealth(c, { ok: true, steps: 4000, date: '2026-11-12' }, 1);
  eq(c.train, 8, '4000 steps: +8 effort (cap)');
  eq(c.steps.dayEffort, 8, 'dayEffort at cap');
  eq(c.strength, 2, 'strength daily cap 2');
  eq(c.weight, 27, '4000 steps would be −4 g but daily cap is 3 g');

  // more the same day: no more effort
  Steps.applyHealth(c, { ok: true, steps: 8000, date: '2026-11-12' }, 2);
  eq(c.train, 8, 'same day past cap: no more effort');
  eq(c.weight, 27, 'same day past weight cap: no more loss');
  eq(c.steps.lifetime, 8000, 'lifetime still counts every credited step');

  // new day: caps reset, new blocks grant again
  Steps.applyHealth(c, { ok: true, steps: 500, date: '2026-11-13' }, 3);
  eq(c.train, 9, 'new day: a new 500-block grants +1');
  eq(c.steps.dayEffort, 1, 'new day effort counter reset');

  // weight floor
  var w = fresh({ train: 0, weight: 16 });
  global.EvolutionData = { MONSTERS: { agumon: { stage: 'rookie', weight: 15 } } };
  Steps.applyHealth(w, { ok: true, steps: 3000, date: '2026-11-12' }, 1);
  eq(w.weight, 15, 'weight does not fall below base (15 g)');
  delete global.EvolutionData;
}

// ---------- Young / dead: lifetime only ----------
console.log('\n7) Babies and dead monsters: lifetime only');
{
  global.EvolutionData = {
    MONSTERS: {
      koromon: { stage: 'baby2', weight: 5 },
      agumon: { stage: 'rookie', weight: 15 }
    }
  };
  var baby = fresh({ mon: 'koromon', train: 0, strength: 1, weight: 5 });
  Steps.applyHealth(baby, { ok: true, steps: 2000, date: '2026-11-12' }, 1);
  eq(baby.steps.lifetime, 2000, 'baby lifetime counted');
  eq(baby.train, 0, 'baby gets no train');
  eq(baby.strength, 1, 'baby gets no strength');
  eq(baby.weight, 5, 'baby gets no weight loss');

  var dead = fresh({ mon: 'agumon', dead: true, train: 3, strength: 2, weight: 20 });
  Steps.applyHealth(dead, { ok: true, steps: 2000, date: '2026-11-12' }, 1);
  eq(dead.steps.lifetime, 2000, 'dead lifetime counted');
  eq(dead.train, 3, 'dead gets no train');
  eq(dead.weight, 20, 'dead gets no weight loss');
  delete global.EvolutionData;
}

// ---------- carryLedger / new egg ----------
console.log('\n8) Ledger carry on new egg (no re-credit)');
{
  var oldM = fresh();
  Steps.applyHealth(oldM, { ok: true, steps: 8000, date: '2026-11-12' }, 1);
  eq(oldM.train, 8, 'old monster received capped effort');

  var newM = fresh({ train: 0, strength: 2, weight: 20 });
  var delta = Steps.carryLedger(oldM, newM);
  eq(delta, 0, 'new egg does not re-credit already settled Health');
  eq(newM.steps.lifetime, 0, 'new egg lifetime starts at 0');
  eq(newM.train, 0, 'new egg train starts at 0');
  eq(newM.steps.days['2026-11-12'].health, 8000, 'ledger health preserved');
  eq(newM.steps.days['2026-11-12'].credited, 8000, 'ledger credited preserved');
  eq(newM.steps.lastHealthSyncTotal, 8000, 'sync meta preserved');

  var more = Steps.applyHealth(newM, { ok: true, steps: 8500, date: '2026-11-12' }, 2);
  eq(more.delta, 500, 'later Health increase goes to the new monster');
  eq(newM.steps.lifetime, 500, 'new lifetime is only the new delta');
  eq(newM.train, 1, 'new monster gets effort from the new 500');
}

// ---------- pending reading (no monster yet) ----------
console.log('\n9) Health import before first egg');
{
  // Simulate recordHealthReading without touching real localStorage:
  var stub = { steps: Steps.empty() };
  var reading = { ok: true, steps: 3000, date: '2026-11-12' };
  Steps.applyHealth(stub, reading, 1);
  stub.steps.days['2026-11-12'].credited = 0;
  stub.steps.lifetime = 0;
  stub.steps.dayEffort = 0;

  var egg = fresh({ train: 0, strength: 1, weight: 20 });
  var d = Steps.carryLedger(stub, egg);
  eq(d, 3000, 'first egg receives pending Health total');
  eq(egg.steps.lifetime, 3000, 'first egg lifetime');
  eq(egg.train, 6, 'first egg effort from 3000 steps');
}

// ---------- URL strip ----------
console.log('\n10) URL param strip');
{
  var a = Steps.stripSearchAndHash('?steps=1&date=2026-11-12&ts=5', '');
  eq(a.search, '', 'strips all step params from search');
  eq(a.hash, '', 'empty hash stays empty');

  var b = Steps.stripSearchAndHash('?steps=1&foo=bar', '#steps=2&date=x');
  eq(b.search, '?foo=bar', 'keeps unrelated query params');
  eq(b.hash, '', 'strips hash step params');

  var c = Steps.stripSearchAndHash('', '#?steps=9&date=2026-11-12&keep=1');
  ok(c.hash.indexOf('keep=1') >= 0 && c.hash.indexOf('steps') < 0, 'keeps unrelated hash params');
}

// ---------- Save backward compatibility ----------
console.log('\n11) Save export/import');
{
  var s = fresh();
  Steps.applyHealth(s, { ok: true, steps: 1234, date: '2026-11-12' }, 99);
  s.mon = 'agumon';
  s.hunger = 3;
  var code = SaveIO.encode(s);
  ok(/^DM20\./.test(code), 'encode produces DM20 code');
  var obj = SaveIO.decode(code);
  ok(obj && obj.state, 'decode returns state');
  eq(obj.state.steps.lifetime, 1234, 'exported lifetime survives');
  eq(obj.state.steps.days['2026-11-12'].health, 1234, 'exported day health survives');
  eq(obj.state.steps.lastHealthSyncAt, 99, 'exported sync time survives');
  eq(obj.state.hunger, 3, 'other fields intact');

  // old save without steps
  var old = { mon: 'agumon', hunger: 4, train: 2, strength: 1, weight: 18 };
  var oldCode = SaveIO.encode(old);
  var loaded = SaveIO.decode(oldCode).state;
  ok(!loaded.steps, 'old save has no steps field');
  Steps.ensure(loaded);
  ok(loaded.steps && loaded.steps.lifetime === 0 && loaded.steps.days, 'ensure migrates old save');
  var r = Steps.applyHealth(loaded, { ok: true, steps: 500, date: '2026-11-12' }, 1);
  eq(r.delta, 500, 'migrated save can import Health');
  eq(loaded.train, 3, 'effects apply on migrated save (2+1)');
}

// ---------- Pedometer peak detection ----------
console.log('\n12) Pedometer peak detection with debounce');
{
  var ped = Steps.createPedometer({ threshold: 1.2, minMs: 300, drop: 0.4 });
  function pulse(t0, height) {
    // rise then fall, with gravity already included in x,y,z
    var g = 9.80665;
    var steps = 0;
    for (var i = 0; i <= 20; i++) {
      var phase = i / 20;
      var add = phase < 0.5 ? height * (phase * 2) : height * (2 - phase * 2);
      if (ped.feed(0, 0, g + add, t0 + i * 10)) steps++;
    }
    return steps;
  }
  eq(pulse(0, 3.0), 1, 'one clear peak counts as 1 step');
  eq(pulse(100, 3.0), 0, 'debounce blocks a peak 100 ms later');
  eq(pulse(500, 3.0), 1, 'a peak after the debounce window counts');
  eq(pulse(900, 0.3), 0, 'sub-threshold wobble is ignored');
}

console.log('\n===================');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
if (failures.length) {
  console.log('\nFailed assertions:');
  failures.forEach(function (f, i) { console.log((i + 1) + '. ' + f); });
  process.exit(1);
}
console.log('All step tests passed.');
process.exit(0);
