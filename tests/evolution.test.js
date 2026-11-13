#!/usr/bin/env node
/**
 * Automated tests: every official evolution branch is reachable and
 * resolves to the correct monster. Also checks leftover gaps, stay-on-fail
 * for Ultimate/Mega, and that witness stats do not collide with a higher-priority rule.
 */
'use strict';

const path = require('path');
const data = require('../js/evolution-data.js');
const evo = require('../js/evolution.js');

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

function nameOf(id) {
  const m = data.MONSTERS[id];
  return m ? `${m.nameZh} / ${m.nameEn} (${id})` : String(id);
}

function resolve(fromId, stats) {
  return evo.resolveEvolution(data, fromId, stats);
}

console.log('Digital Monster evolution tests');
console.log('================================\n');

// ---------- 1. Every non-stay official branch is reachable ----------
console.log('1) Official branches are reachable with witness stats');
for (const [fromId, rules] of Object.entries(data.BRANCHES)) {
  const mon = data.MONSTERS[fromId];
  ok(!!mon, `from-id exists: ${fromId}`);
  rules.forEach((rule, idx) => {
    if (rule.leftover || rule.stay) return;
    const stats = evo.witnessStats(rule, mon);
    const r = resolve(fromId, stats);
    ok(
      r.to === rule.to && !r.stayed,
      `${nameOf(fromId)} rule#${idx} → ${rule.to} (got ${r.to}, reason=${r.reason}) ` +
        `stats=${JSON.stringify(stats)}`
    );
    if (rule.to) ok(!!data.MONSTERS[rule.to], `destination exists: ${rule.to}`);
  });
}

// ---------- 2. Leftover / gap cases (official "other requirements not met") ----------
console.log('\n2) Leftover / gap cases');

const leftovers = [
  // Ver.1 Agumon: 4+ calls but train too low for Tyranomon/Meramon
  { from: 'agumon', stats: { calls: 5, train: 2, overfeed: 5, sleepDist: 0, timeInStage: 99999 }, to: 'numemon', why: 'Agumon irregular, train ≤4' },
  { from: 'agumon', stats: { calls: 5, train: 10, overfeed: 0, sleepDist: 0, timeInStage: 99999 }, to: 'numemon', why: 'Agumon Tyranomon range but overfeed <3' },
  { from: 'agumon', stats: { calls: 5, train: 10, overfeed: 5, sleepDist: 8, timeInStage: 99999 }, to: 'numemon', why: 'Agumon Tyranomon range but sleep >4' },
  { from: 'agumon', stats: { calls: 5, train: 20, overfeed: 0, sleepDist: 0, timeInStage: 99999 }, to: 'numemon', why: 'Agumon Meramon range but overfeed <3' },
  // Ver.1 Betamon gaps
  { from: 'betamon', stats: { calls: 5, train: 5, overfeed: 5, sleepDist: 0, timeInStage: 99999 }, to: 'numemon', why: 'Betamon irregular, train <8' },
  { from: 'betamon', stats: { calls: 5, train: 40, overfeed: 5, sleepDist: 0, timeInStage: 99999 }, to: 'numemon', why: 'Betamon irregular, train >31' },
  { from: 'betamon', stats: { calls: 5, train: 20, overfeed: 1, sleepDist: 3, timeInStage: 99999 }, to: 'numemon', why: 'Betamon OF 0–3 but sleep not 9+' },
  { from: 'betamon', stats: { calls: 5, train: 20, overfeed: 6, sleepDist: 12, timeInStage: 99999 }, to: 'numemon', why: 'Betamon OF 4+ but sleep 9+ (gap)' },
  // Ver.2 Elecmon leftover gaps
  { from: 'elecmon', stats: { calls: 5, train: 4, overfeed: 0, sleepDist: 0, timeInStage: 99999 }, to: 'vegimon', why: 'Elecmon irregular, train <8' },
  { from: 'elecmon', stats: { calls: 5, train: 20, overfeed: 2, sleepDist: 0, timeInStage: 99999 }, to: 'vegimon', why: 'Elecmon Whamon range but overfeed <6' },
  { from: 'elecmon', stats: { calls: 5, train: 10, overfeed: 2, sleepDist: 2, timeInStage: 99999 }, to: 'vegimon', why: 'Elecmon Yukidarumon train range but sleep <5' },
  // Ver.5 Gizamon: train 16–31 with irregular care is a leftover gap (Deltamon needs 32+)
  { from: 'gizamon', stats: { calls: 5, train: 20, overfeed: 8, sleepDist: 0, timeInStage: 99999 }, to: 'raremon', why: 'Gizamon irregular train 16–31 (between Tuskmon and Deltamon)' },
];

for (const c of leftovers) {
  const r = resolve(c.from, c.stats);
  ok(r.to === c.to, `leftover ${c.why}: expected ${c.to}, got ${r.to}`);
}

// Known positive mid-range checks that must NOT fall to leftover
const positives = [
  { from: 'agumon', stats: { calls: 2, train: 32, timeInStage: 99999 }, to: 'greymon' },
  { from: 'agumon', stats: { calls: 0, train: 31, timeInStage: 99999 }, to: 'devimon' },
  { from: 'agumon', stats: { calls: 4, train: 10, overfeed: 3, sleepDist: 4, timeInStage: 99999 }, to: 'tyranomon' },
  { from: 'agumon', stats: { calls: 4, train: 16, overfeed: 3, sleepDist: 6, timeInStage: 99999 }, to: 'meramon' },
  { from: 'betamon', stats: { calls: 0, train: 48, timeInStage: 99999 }, to: 'devimon' },
  { from: 'betamon', stats: { calls: 3, train: 0, timeInStage: 99999 }, to: 'meramon' },
  { from: 'betamon', stats: { calls: 4, train: 8, overfeed: 0, sleepDist: 9, timeInStage: 99999 }, to: 'airdramon' },
  { from: 'betamon', stats: { calls: 4, train: 31, overfeed: 4, sleepDist: 8, timeInStage: 99999 }, to: 'seadramon' },
  { from: 'gabumon', stats: { calls: 0, train: 48, timeInStage: 99999 }, to: 'kabuterimon' },
  { from: 'elecmon', stats: { calls: 4, train: 16, overfeed: 6, sleepDist: 0, timeInStage: 99999 }, to: 'whamon' },
  { from: 'gizamon', stats: { calls: 4, train: 32, overfeed: 6, sleepDist: 0, timeInStage: 99999 }, to: 'deltamon' },
  { from: 'koromon', stats: { calls: 3, timeInStage: 99999 }, to: 'agumon' },
  { from: 'koromon', stats: { calls: 4, timeInStage: 99999 }, to: 'betamon' },
  // Firmware: Betamon 4+ CM, 8–31 train, OF 0–3 (including 3, not 4), 9+ sleep → Airdramon
  { from: 'betamon', stats: { calls: 5, train: 20, overfeed: 3, sleepDist: 9, timeInStage: 99999 }, to: 'airdramon' },
  // Elecmon 16-split (firmware): 16–31 otherwise → Vegimon; 8–15, OF 0–5, sleep 5+ → Yukidarumon
  { from: 'elecmon', stats: { calls: 5, train: 20, overfeed: 0, sleepDist: 0, timeInStage: 99999 }, to: 'vegimon' },
  { from: 'elecmon', stats: { calls: 5, train: 10, overfeed: 2, sleepDist: 5, timeInStage: 99999 }, to: 'yukidarumon' },
  { from: 'elecmon', stats: { calls: 5, train: 16, overfeed: 6, sleepDist: 0, timeInStage: 99999 }, to: 'whamon' },
];
for (const c of positives) {
  const r = resolve(c.from, c.stats);
  ok(r.to === c.to, `positive ${c.from} → ${c.to} (got ${r.to})`);
}

// ---------- 3. Champion → Ultimate: firmware Perfect eligibility (NOT 80% WR) ----------
console.log('\n3) Champion → Ultimate (perfectEligible bit; 80% WR is not a rule)');
{
  const stayStats = { calls: 0, train: 0, overfeed: 0, sleepDist: 0, battles: 20, wins: 20, winRate: 1, timeInStage: 99999 };
  const stay = resolve('greymon', stayStats);
  ok(stay.stayed, 'Greymon without perfectEligible stays, even at 20/20 (80% WR is not the gate)');
  const stay14 = resolve('greymon', Object.assign({}, stayStats, { battles: 14, wins: 14 }));
  ok(stay14.stayed, 'Greymon without perfectEligible stays at 14/14');
  const champCases = [
    { from: 'greymon', to: 'metalgreymon' },
    { from: 'numemon', to: 'monzaemon' },
    { from: 'tyranomon', to: 'mamemon' },
    { from: 'devimon', to: 'metalgreymon' },
    { from: 'airdramon', to: 'metalgreymon' },
    { from: 'kabuterimon', to: 'skullgreymon' },
    { from: 'vegimon', to: 'vademon' },
    { from: 'sukamon', to: 'etemon' },
    { from: 'nanimon', to: 'digitamamon' },
    { from: 'raremon', to: 'extyranomon' },
    { from: 'leomon', to: 'megadramon' },
  ];
  for (const c of champCases) {
    const stats = { calls: 0, train: 0, overfeed: 0, sleepDist: 0, battles: 15, wins: 12, winRate: 0.8, perfectEligible: true, timeInStage: 99999, perfectEligible: true };
    const r = resolve(c.from, stats);
    ok(!r.stayed && r.to === c.to, `${c.from} → ${c.to} when perfectEligible (got ${r.to})`);
  }
}

// ---------- 4. Ultimate → Mega (0–2 calls) or no-mega ----------
console.log('\n4) Ultimate → Mega (20th: 0–2 care mistakes) and no-mega ultimates');
const megaYes = [
  ['metalgreymon', 'blitzgreymon'],
  ['mamemon', 'banchomamemon'],
  ['skullgreymon', 'skullmammon'],
  ['metalmamemon', 'cresgarurumon'],
  ['andromon', 'hiandromon'],
  ['etemon', 'kingetemon'],
  ['megadramon', 'aegisdramon'],
  ['digitamamon', 'titamon'],
  ['metaltyranomon', 'mugendramon'],
  ['extyranomon', 'pinochimon'],
  ['metalgreymon_va', 'wargreymon'],
  ['weregarurumon', 'metalgarurumon'],
];
for (const [from, to] of megaYes) {
  for (const calls of [0, 1, 2]) {
    const r = resolve(from, { calls, train: 0, battles: 0, wins: 0, timeInStage: 99999 });
    ok(r.to === to, `${from} with ${calls} mistakes → ${to} (got ${r.to})`);
  }
  const stay = resolve(from, { calls: 3, train: 0, battles: 0, wins: 0, timeInStage: 99999 });
  ok(stay.stayed && stay.to === from, `${from} with 3 mistakes stays Ultimate`);
}
const noMega = ['monzaemon', 'vademon', 'giromon', 'piccolomon', 'nanomon'];
for (const from of noMega) {
  const r = resolve(from, { calls: 0, train: 0, battles: 40, wins: 40, winRate: 1, timeInStage: 99999 });
  ok(r.stayed && r.to === from, `${from} has no Mega even with perfect care (got ${r.to})`);
}

// ---------- 5. Too-early (time in stage) ----------
console.log('\n5) Time-in-stage gate');
{
  const r = resolve('koromon', { calls: 0, timeInStage: 10 });
  ok(r.stayed && r.reason === 'too-early', `Koromon at 10 min stays (reason=${r.reason})`);
  const r2 = resolve('koromon', { calls: 0, timeInStage: data.MONSTERS.koromon.lifespanMin });
  ok(r2.to === 'agumon', `Koromon at lifespan evolves to Agumon`);
}

// ---------- 6. Priority: a later rule must not steal an earlier official branch ----------
console.log('\n6) Priority / non-overlap of witness stats');
for (const [fromId, rules] of Object.entries(data.BRANCHES)) {
  const mon = data.MONSTERS[fromId];
  const official = rules.filter((r) => !r.leftover && !r.stay);
  official.forEach((rule, i) => {
    const stats = evo.witnessStats(rule, mon);
    official.forEach((other, j) => {
      if (j >= i) return;
      ok(
        !evo.matchesRule(other, stats),
        `priority: witness for ${fromId}→${rule.to} must not also match earlier ${other.to}`
      );
    });
  });
}

// ---------- 7. Reset policy documented in data (structural) ----------
console.log('\n7) Structure: every version egg→mega path exists');
const expectedBabies = { 1: 'botamon', 2: 'punimon', 3: 'poyomon', 4: 'yuramon', 5: 'zurumon' };
for (const [v, baby] of Object.entries(expectedBabies)) {
  ok(data.MONSTERS[baby] && data.MONSTERS[baby].stage === 'baby1', `Ver.${v} baby I is ${baby}`);
  ok(data.MONSTERS[`egg_v${v}`].hatch === baby, `Ver.${v} egg hatches ${baby}`);
}

// Every mega (standard) is reachable via some ultimate rule
const standardMegas = ['blitzgreymon', 'banchomamemon', 'skullmammon', 'cresgarurumon', 'hiandromon', 'kingetemon', 'aegisdramon', 'titamon', 'mugendramon', 'pinochimon'];
for (const mega of standardMegas) {
  let found = false;
  for (const [fromId, rules] of Object.entries(data.BRANCHES)) {
    if (rules.some((r) => r.to === mega)) found = true;
  }
  ok(found, `mega ${mega} has an incoming official branch`);
}

// Jogress partners exist
for (const j of data.JOGRESS) {
  ok(!!data.MONSTERS[j.a] && !!data.MONSTERS[j.b] && !!data.MONSTERS[j.to], `jogress ${j.a} + ${j.b} → ${j.to}`);
  ok(j.tagWins === 5, `jogress ${j.to} requires 5 tag wins`);
}

// ---------- 8. CPU/PvP are not distinguished in the resolver (same counters) ----------
console.log('\n8) Battle source is irrelevant to the resolver (CPU and PvP share counters)');
{
  const stats = { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true, timeInStage: 99999, source: 'cpu', perfectEligible: true };
  const a = resolve('greymon', stats);
  const b = resolve('greymon', Object.assign({}, stats, { source: 'pvp' }));
  ok(a.to === 'metalgreymon' && b.to === 'metalgreymon', 'CPU and PvP stats resolve identically');
}


// ---------- 9. 20th special / exclusive eggs and eggKind branches ----------
console.log('\n9) 20th special Digitama, eggKind forks, hidden megas, new jogress');

const specialLines = [
  ['egg_zuba', 'sakumon'],
  ['sakumon', 'sakuttomon'],
  ['egg_hack', 'sakumon'],
  ['egg_dra_blue', 'petitmon'],
  ['petitmon', 'babydmon'],
  ['babydmon', 'dracomon'],
  ['egg_doru', 'dodomon'],
  ['dodomon', 'dorimon'],
  ['dorimon', 'dorumon'],
  ['dorumon', 'dorugamon'],
  ['egg_corona', 'pichimon'],
  ['pichimon', 'pukamon'],
  ['egg_luna', 'pichimon'],
  ['egg_meicoo', 'yukimibotamon'],
  ['yukimibotamon', 'nyaromon'],
  ['nyaromon', 'plotmon'],
  ['plotmon', 'meicoomon'],
  ['egg_anime_agumon', 'botamon'],
  ['egg_anime_gabumon', 'punimon'],
];
for (const [from, to] of specialLines) {
  const r = resolve(from, { timeInStage: 99999 });
  ok(r.to === to && !r.stayed, `${from} → ${to} (got ${r.to})`);
}

function ev(from, stats, to, why) {
  const r = resolve(from, Object.assign({ timeInStage: 99999 }, stats));
  ok(r.to === to && !r.stayed, `${why}: ${from} → ${to} (got ${r.to}, stayed=${r.stayed})`);
}

ev('sakuttomon', { eggKind: 'zuba' }, 'zubamon', 'Zuba egg');
ev('sakuttomon', { eggKind: 'hack' }, 'hackmon', 'Hack egg');
ev('dracomon', { eggKind: 'dra_blue' }, 'coredramon_blue', 'blue Coredramon');
ev('dracomon', { eggKind: 'dra_green' }, 'coredramon_green', 'green Coredramon');
ev('pukamon', { eggKind: 'corona' }, 'coronamon', 'Corona egg');
ev('pukamon', { eggKind: 'luna' }, 'lunamon', 'Luna egg');

// shared Koromon/Agumon/Greymon: anime egg is linear; Ver.1 keeps official branches
ev('koromon', { eggKind: 'anime_agumon', calls: 9 }, 'agumon', 'anime Koromon ignores care mistakes');
ev('koromon', { eggKind: 'ver1', calls: 5 }, 'betamon', 'Ver.1 Koromon 4+ calls still Betamon');
ev('agumon', { eggKind: 'anime_agumon', calls: 5, train: 0 }, 'greymon', 'anime Agumon is linear to Greymon');
ev('agumon', { eggKind: 'ver1', calls: 0, train: 40 }, 'greymon', 'Ver.1 Agumon regular + train still Greymon');
ev('greymon', { eggKind: 'anime_agumon', battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'metalgreymon_va', 'anime Greymon → MetalGreymon (Vaccine)');
ev('greymon', { eggKind: 'ver1', battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'metalgreymon', 'Ver.1 Greymon → MetalGreymon (Virus)');
ev('gabumon', { eggKind: 'anime_gabumon', calls: 0, train: 0 }, 'garurumon', 'anime Gabumon is linear to Garurumon');
ev('garurumon', { eggKind: 'anime_gabumon', battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'weregarurumon', 'anime Garurumon → WereGarurumon');
ev('garurumon', { eggKind: 'ver2', battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'metalmamemon', 'Ver.2 Garurumon → MetalMamemon');

// Champion → Ultimate / Ultimate → Mega on specials
ev('zubaeagermon', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'duramon', 'ZubaEagermon ultimate');
ev('duramon', { calls: 1 }, 'durandamon', 'Duramon mega 0–2 mistakes');
ev('baohackmon', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'saviorhackmon', 'BaoHuckmon ultimate');
ev('saviorhackmon', { calls: 0 }, 'jesmon', 'SaviorHuckmon mega');
ev('coredramon_blue', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'wingdramon', 'Coredramon Blue ultimate');
ev('wingdramon', { calls: 0 }, 'slayerdramon', 'Wingdramon → Slayerdramon');
ev('wingdramon', { calls: 3, battles: 100 }, 'wargreymon', 'hidden Wingdramon → WarGreymon');
ev('coredramon_green', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'groundramon', 'Coredramon Green ultimate');
ev('groundramon', { calls: 2 }, 'breakdramon', 'Groundramon → Breakdramon');
ev('groundramon', { calls: 4, battles: 100 }, 'metalgarurumon', 'hidden Groundramon → MetalGarurumon');
{
  const stay = resolve('wingdramon', { calls: 5, battles: 100, timeInStage: 99999 });
  ok(stay.stayed, 'Wingdramon with 5 mistakes stays (no hidden mega)');
  const stay2 = resolve('wingdramon', { calls: 3, battles: 99, timeInStage: 99999 });
  ok(stay2.stayed, 'Wingdramon hidden mega requires 100 battles');
}
ev('dorugamon', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'doruguremon', 'DORUgamon ultimate');
ev('doruguremon', { calls: 2 }, 'alphamon', 'DORUguremon mega');
ev('firamon', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'flaremon', 'Firamon ultimate');
ev('flaremon', { calls: 0 }, 'apollomon', 'Flaremon mega');
ev('lekismon', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'crescemon', 'Lekismon ultimate');
ev('crescemon', { calls: 1 }, 'dianamon', 'Crescemon mega');
ev('meicoomon', { battles: 15, wins: 12, winRate: 0.8, perfectEligible: true }, 'meicrackmon', 'Meicoomon ultimate');
ev('meicrackmon', { calls: 0 }, 'rasielmon', 'Meicrackmon → Rasielmon (not Raguelmon)');

const newMegas = ['durandamon', 'jesmon', 'slayerdramon', 'breakdramon', 'alphamon', 'apollomon', 'dianamon', 'rasielmon'];
for (const mega of newMegas) {
  let found = false;
  for (const rules of Object.values(data.BRANCHES)) {
    if (rules.some((r) => r.to === mega)) found = true;
  }
  ok(found, `20th mega ${mega} has an incoming official branch`);
}

const newJog = [
  ['slayerdramon', 'breakdramon', 'examon'],
  ['apollomon', 'dianamon', 'gracenovamon'],
];
for (const [a, b, to] of newJog) {
  const j = data.JOGRESS.find((x) => x.to === to);
  ok(!!j && ((j.a === a && j.b === b) || (j.a === b && j.b === a)) && j.tagWins === 5, `jogress ${a}+${b} → ${to}`);
}

ok(data.SPECIAL_EGGS.zuba && data.SPECIAL_EGGS.meicoo && data.SPECIAL_EGGS.corona, 'SPECIAL_EGGS lists new 20th eggs');
ok(data.MONSTERS.rasielmon && !data.MONSTERS.raguelmon, 'Meicoo mega is Rasielmon, not Raguelmon');

console.log('\n================================');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  console.log('\nFailed assertions:');
  failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  process.exit(1);
}
console.log('All evolution tests passed.');
process.exit(0);
