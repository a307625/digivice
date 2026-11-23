#!/usr/bin/env node
/**
 * Pendulum Ver.1.5–5.5 and ZERO: rosters, evos, Jogress, shells,
 * MEGAHIT flag, hatch, and 1.0 non-regression.
 */
'use strict';

global.PendulumData = require('../js/devices/pendulum/data.js');
require('../js/devices/pendulum/versions.js');
const Data = global.PendulumData;
const Eng = require('../js/devices/pendulum/engine.js');
global.PendulumEngine = Eng;

let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL  ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');
}

function form(egg, mon, extra) {
  const s = Eng.defaultState(egg);
  s.clockInitialized = true;
  s.clockSet.on = false;
  s.mon = mon;
  const m = Data.monster(mon, s.version);
  if (m) {
    s.weight = m.minWeight;
    s.hungerCap = m.stomach;
    s.dpMaxQ = Math.round((m.dpMax || 0) * 4);
    s.dpQ = s.dpMaxQ;
  }
  s.hunger = 4;
  s.strength = 4;
  s.stageEnteredGame = 0;
  s.gameTime = 0;
  s.lastReal = Date.now();
  s.speed = 1;
  s.lights = true;
  s.sleeping = false;
  s.dead = false;
  Eng.rollEvoDue(s);
  if (extra) Object.assign(s, extra);
  return s;
}
function advance(s, gameSec) {
  s.lastReal = Date.now() - gameSec * 1000 / (s.speed || 1);
  return Eng.tick(s, Date.now());
}

console.log('Pendulum Ver.1.5–5.5 + ZERO');
console.log('============================\n');

console.log('0) All eleven versions registered; 1.0 still the default');
{
  const keys = ['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5','zero'];
  keys.forEach((k) => ok(!!Data.VERSIONS[k], k + ' is registered'));
  eq(Data.resolveVer(), '1.0', 'resolveVer() defaults to 1.0');
  eq(Data.naturalAdult('tentomon', 2, 39), 'tortomon', '1.0 default (no version arg) is still Tortomon');
  eq(Data.PROFILE.hasMegahitScreen, false, '1.0 PROFILE flag unchanged');
}

console.log('1) Ver.1.5 Nature Spirits swaps; 1.0 unchanged');
{
  eq(Data.naturalAdult('tentomon', 2, 39, '1.5'), 'tailmon', '1.5 Tentomon 0–2 T0–39 → Tailmon');
  eq(Data.naturalAdult('tentomon', 2, 39, '1.0'), 'tortomon', '1.0 still Tortomon');
  eq(Data.naturalPerfect('tailmon', 2, 40, 30, 40, true, '1.5').to, 'atlurkabuterimon', '1.5 Tailmon → Atlur');
  eq(Data.naturalUltimate('atlurkabuterimon', 0, 80, '1.5').to, 'holydramon', '1.5 Atlur → Holydramon');
  eq(Data.naturalUltimate('angewomon', 0, 80, '1.5').to, 'holydramon', '1.5 Angewomon → Holydramon');
  eq(Data.naturalUltimate('atlurkabuterimon', 0, 80, '1.0').to, 'heracleskabuterimon', '1.0 still Heracles');
  eq(Data.jogressResult('kabuterimon', 'tailmon', '1.5').to, 'angewomon', '1.5 Va Jogress → Angewomon');
  eq(Data.jogressResult('kabuterimon', 'tortomon', '1.0').to, 'jagamon', '1.0 Va Jogress still Jagamon');
  eq(Data.VERSIONS['1.5'].hasMegahitScreen, false, '1.5 has no MEGAHIT screen');
  const s = form('pen_1_5', 'pen_egg');
  eq(s.version, '1.5', '1.5 defaultState version');
  eq(s.deviceId, 'pen-1-5', '1.5 deviceId');
  s.clockInitialized = true;
  s.evoDueAt = 1 / 60;
  s.gameTime = 0;
  advance(s, 70);
  eq(s.mon, 'babumon', '1.5 hatches to Babumon (same Baby I as 1.0)');
  // live adult evo
  const a = form('pen_1_5', 'tentomon', { careMistakes: 0, trainSuccess: 39, evoDueAt: 24 });
  a.gameTime = 24 * 3600;
  a.lastReal = Date.now() - 60000;
  Eng.tick(a, Date.now());
  eq(a.mon, 'tailmon', 'live 1.5 Tentomon → Tailmon');
}

console.log('2) Ver.2.0 / 2.5 Deep Savers');
{
  eq(Data.naturalChild(0, '2.0'), 'gomamon', 'Pukamon 0–1 → Gomamon');
  eq(Data.naturalChild(3, '2.0'), 'ganimon', '2–3 Ganimon');
  eq(Data.naturalChild(4, '2.0'), 'shakomon', '4+ Shakomon');
  eq(Data.naturalAdult('gomamon', 0, 30, '2.0'), 'ikkakumon', 'Gomamon 0–2 T30+ → Ikkakumon');
  eq(Data.naturalAdult('gomamon', 3, 30, '2.0'), 'coelamon', '2.0 high-CM → Coelamon');
  eq(Data.naturalAdult('gomamon', 3, 30, '2.5'), 'ebidramon', '2.5 high-CM → Ebidramon');
  eq(Data.naturalPerfect('ikkakumon', 2, 40, 30, 50, true, '2.0').to, 'zudomon', 'Ikkakumon → Zudomon');
  eq(Data.naturalPerfect('seadramon', 4, 40, 30, 50, true, '2.5').to, 'megaseadramon', '2.5 Seadramon/Ebidramon → MegaSeadramon');
  eq(Data.naturalUltimate('zudomon', 0, 80, '2.0').to, 'marineangemon', 'Zudomon → MarineAngemon');
  eq(Data.jogressResult('ikkakumon', 'rukamon', '2.0').to, 'whamon', 'Va Jogress Whamon');
  eq(Data.jogressResult('megaseadramon', 'anomalocarimon', '2.0').to, 'metalseadramon', '2.0 Data Perfects → MetalSeadramon');
  eq(Data.jogressResult('megaseadramon', 'hangyomon', '2.5').to, 'plesiomon', '2.5 Data Perfects → Plesiomon');
  ok(Data.VERSIONS['2.0'].hasMegahitScreen && Data.VERSIONS['2.5'].hasMegahitScreen, '2.x have the MEGAHIT screen');
  const s = form('pen_2_0', 'pen_egg');
  s.clockInitialized = true;
  advance(s, 70);
  eq(s.mon, 'pichimon', '2.0 hatches to Pichimon');
}

console.log('3) Ver.3.0 / 3.5 Nightmare Soldiers');
{
  eq(Data.naturalChild(0, '3.0'), 'bakumon', '0–2 Bakumon');
  eq(Data.naturalChild(5, '3.0'), 'candmon', '3–5 Candmon');
  eq(Data.naturalChild(6, '3.0'), 'picodevimon', '6+ PicoDevimon');
  eq(Data.naturalAdult('bakumon', 3, 29, '3.0'), 'garurumon', 'Bakumon 3+ T≤29 → Garurumon (FI 0-30 resolved as 0-29)');
  eq(Data.naturalAdult('bakumon', 3, 30, '3.0'), 'wizarmon', 'T30+ Wizarmon uniquely');
  eq(Data.naturalAdult('picodevimon', 3, 0, '3.0'), 'bakemon', '3.0 Pico 3+ T0–24 → Bakemon');
  eq(Data.naturalAdult('picodevimon', 3, 0, '3.5'), 'dokugumon', '3.5 → Dokugumon');
  eq(Data.naturalPerfect('devimon', 1, 40, 30, 50, true, '3.0').to, 'vamdemon', '3.0 → Vamdemon');
  eq(Data.naturalPerfect('devimon', 1, 40, 30, 50, true, '3.5').to, 'ladydevimon', '3.5 → LadyDevimon');
  eq(Data.naturalUltimate('mammon', 0, 80, '3.0').to, 'skullmammon', 'Mammon → SkullMammon');
  eq(Data.jogressResult('vamdemon', 'phantomon', '3.0').to, 'piemon', '3.0 Virus Perfects → Piemon');
  eq(Data.jogressResult('ladydevimon', 'phantomon', '3.5').to, 'demon', '3.5 Virus Perfects → Demon');
  const s = form('pen_3_0', 'pen_egg');
  s.clockInitialized = true;
  advance(s, 70);
  eq(s.mon, 'mokumon', '3.0 hatches to Mokumon');
}

console.log('4) Ver.4.0 / 4.5 Wind Guardians (Piyomon 0-2/3+ and Mushmon 1+)');
{
  eq(Data.naturalChild(3, '4.0'), 'piyomon', 'Pyocomon 0–3 → Piyomon');
  eq(Data.naturalChild(4, '4.0'), 'floramon', '4–5 Floramon (4.0)');
  eq(Data.naturalChild(4, '4.5'), 'palmon', '4–5 Palmon (4.5)');
  eq(Data.naturalChild(6, '4.0'), 'mushmon', '6+ Mushmon');
  eq(Data.naturalAdult('piyomon', 2, 25, '4.0'), 'vdramon', 'Piyomon 0–2 T25+ → V-Dramon');
  eq(Data.naturalAdult('piyomon', 3, 30, '4.0'), 'togemon', 'Piyomon 3+ T30+ → Togemon (FI 0-3 overlap resolved)');
  eq(Data.naturalAdult('mushmon', 1, 25, '4.0'), 'woodmon', 'Mushmon CM 1 treated as 1+ → Woodmon');
  eq(Data.naturalAdult('floramon', 0, 25, '4.0'), 'togemon', 'Floramon 0–2 T25+ → Togemon');
  eq(Data.naturalAdult('palmon', 0, 25, '4.5'), 'togemon', 'Palmon same path on 4.5');
  eq(Data.naturalPerfect('togemon', 4, 40, 30, 50, true, '4.0').to, 'blossomon', '4.0 → Blossomon');
  eq(Data.naturalPerfect('togemon', 4, 40, 30, 50, true, '4.5').to, 'lillymon', '4.5 → Lillymon');
  eq(Data.naturalUltimate('aerovdramon', 0, 80, '4.0').to, 'hououmon', 'AeroV-Dramon → Hououmon');
  eq(Data.jogressResult('blossomon', 'deramon', '4.0').to, 'gryphomon', '4.0 Data Perfects → Gryphomon');
  eq(Data.jogressResult('lillymon', 'deramon', '4.5').to, 'rosemon', '4.5 Data Perfects → Rosemon');
  const s = form('pen_4_0', 'pen_egg');
  s.clockInitialized = true;
  advance(s, 70);
  eq(s.mon, 'nyokimon', '4.0 hatches to Nyokimon');
}

console.log('5) Ver.5.0 / 5.5 Metal Empire');
{
  eq(Data.naturalChild(2, '5.0'), 'toyagumon', '0–2 ToyAgumon');
  eq(Data.naturalChild(4, '5.0'), 'kokuwamon', '3–4 Kokuwamon');
  eq(Data.naturalChild(5, '5.0'), 'hagurumon', '5+ Hagurumon');
  eq(Data.naturalAdult('toyagumon', 3, 25, '5.0'), 'tankmon', '5.0 ToyAgumon 3+ T25+ → Tankmon');
  eq(Data.naturalAdult('toyagumon', 3, 25, '5.5'), 'thunderballmon', '5.5 → Thunderballmon');
  eq(Data.naturalPerfect('greymon', 2, 40, 30, 50, true, '5.0').to, 'metalgreymon', 'Greymon → MetalGreymon');
  eq(Data.naturalPerfect('tankmon', 4, 40, 30, 50, true, '5.0').to, 'knightmon', 'Tankmon → Knightmon');
  eq(Data.naturalPerfect('thunderballmon', 4, 40, 30, 50, true, '5.5').to, 'knightmon', 'Thunderballmon → Knightmon');
  eq(Data.naturalUltimate('metalgreymon', 0, 80, '5.0').to, 'wargreymon', '5.0 MetalGreymon/Andromon → WarGreymon');
  eq(Data.naturalUltimate('metalgreymon', 0, 80, '5.5').to, 'wargreymon', '5.5 MetalGreymon/Cyberdramon → WarGreymon');
  eq(Data.jogressResult('greymon', 'revolmon', '5.0').to, 'andromon', '5.0 Va Jogress Andromon');
  eq(Data.jogressResult('greymon', 'revolmon', '5.5').to, 'cyberdramon', '5.5 Va Jogress Cyberdramon');
  eq(Data.jogressResult('megadramon', 'warumonzaemon', '5.0').to, 'mugendramon', '5.0 Virus Perfects → Mugendramon');
  eq(Data.jogressResult('megadramon', 'warumonzaemon', '5.5').to, 'venomvamdemon', '5.5 → VenomVamdemon');
  const s = form('pen_5_0', 'pen_egg');
  s.clockInitialized = true;
  advance(s, 70);
  eq(s.mon, 'choromon', '5.0 hatches to Choromon');
}

console.log('6) Pendulum ZERO Virus Busters, Omegamon Jogress');
{
  eq(Data.naturalChild(0, 'zero'), 'agumon', 'Nyaromon 0–2 → Agumon');
  eq(Data.naturalChild(5, 'zero'), 'gabumon', '3–5 Gabumon');
  eq(Data.naturalChild(6, 'zero'), 'plotmon', '6+ Plotmon');
  eq(Data.naturalAdult('agumon', 0, 30, 'zero'), 'greymon', 'Agumon 0–2 T30+ → Greymon');
  eq(Data.naturalAdult('agumon', 0, 0, 'zero'), 'angemon', 'Agumon 0–2 T0–29 → Angemon');
  eq(Data.naturalAdult('gabumon', 3, 0, 'zero'), 'tailmon', 'Gabumon 3+ T0–19 → Tailmon');
  eq(Data.monster('tailmon', 'zero').attribute, 'virus', 'ZERO Tailmon is Virus (device original / NHOKO)');
  eq(Data.monster('tailmon', '1.5').attribute, 'vaccine', '1.5 Tailmon stays Vaccine');
  eq(Data.monster('garurumon', 'zero').attribute, 'data', 'ZERO Garurumon is Data');
  eq(Data.monster('garurumon', '3.0').attribute, 'vaccine', '3.0 Garurumon stays Vaccine');
  eq(Data.naturalPerfect('greymon', 2, 40, 30, 50, true, 'zero').to, 'metalgreymon', 'Greymon/Leomon → MetalGreymon');
  eq(Data.naturalPerfect('angemon', 1, 40, 30, 50, true, 'zero').to, 'holyangemon', 'Angemon/Tailmon → HolyAngemon');
  eq(Data.naturalUltimate('metalgreymon', 0, 80, 'zero').to, 'wargreymon', 'MetalGreymon/Asuramon → WarGreymon');
  eq(Data.jogressResult('holyangemon', 'angewomon', 'zero').to, 'omegamon', 'Virus Perfect pair → Omegamon');
  eq(Data.jogressResult('wargreymon', 'metalgarurumon', 'zero').to, 'omegamon', 'WarGreymon + MetalGarurumon (ZERO) → Omegamon');
  eq(Data.jogressResult('wargreymon', 'metalgarurumon', '5.0').ok, false, 'same pair on 5.0 is NOT Omegamon');
  eq(Data.jogressResult('greymon', 'leomon', 'zero').to, 'asuramon', 'Va Jogress Asuramon');
  const s = form('pen_zero', 'pen_egg');
  s.clockInitialized = true;
  advance(s, 70);
  eq(s.mon, 'yukimibotamon', 'ZERO hatches to Yukimibotamon');
  ok(Data.VERSIONS.zero.hasMegahitScreen, 'ZERO has the MEGAHIT screen');
  eq(Data.VERSIONS.zero.eggLabelTw, '超0 病毒剋星數碼蛋', 'ZERO egg label');
}

console.log('7) Cross-version same-position Jogress is blocked (NHOKO)');
{
  ok(Data.samePosition('kabuterimon', 'ikkakumon', '1.0', '2.0'), 'Va1 is the same position across versions');
  const r = Data.jogressResult('kabuterimon', 'ikkakumon', '1.0', '2.0');
  eq(r.ok, false, 'Va1 + Va1 across versions cannot Jogress');
  eq(r.error, 'position', 'reason is position');
  const okj = Data.jogressResult('kabuterimon', 'rukamon', '1.0', '2.0');
  eq(okj.to, 'jagamon', 'Va1 + Va2 across versions uses SELF (1.0) product Jagamon');
}

console.log('8) Egg labels: sprite + name only, no roster spoilers');
{
  const items = require('../js/items.js');
  const pen = items.EGG_PICKER.filter((e) => /^pen_/.test(String(e.dataEgg)) && !/^pen_20th/.test(String(e.dataEgg)));
  eq(pen.length, 11, '11 Pendulum eggs');
  ok(pen.every((e) => e.label && e.id && e.dataEgg && e.label.indexOf('→') < 0), 'no arrows');
  ok(pen.every((e) => !/甲蟲|比多|大力神|炸薯|三角龍|Heracles|Atlur|奧米加|Omegamon|WarGrey|MetalGaru|Holydra|Venom|Mugendra/.test(e.label)),
    'no roster spoilers in Pendulum egg labels');
}

console.log('9) NHOKO chart DP, including Ultimates');
{
  eq(Data.monster('tentomon', '1.0').dpMax, 20, 'Tentomon DP 20');
  eq(Data.monster('kabuterimon', '1.0').dpMax, 30, 'Kabuterimon DP 30');
  eq(Data.monster('heracleskabuterimon', '1.0').dpMax, 50, 'HeraclesKabuterimon DP 50');
  eq(Data.monster('hououmon', '4.0').dpMax, 45, 'Hououmon DP 45');
  eq(Data.monster('omegamon', 'zero').dpMax, 60, 'Omegamon DP 60');
  eq(Data.monster('garurumon', '3.0').dpMax, 30, 'Ver.3 Garurumon DP 30');
  eq(Data.monster('garurumon', 'zero').dpMax, 36, 'ZERO Garurumon DP 36');
  eq(Data.monster('mushmon', '4.0').dpMax, 28, 'Mushmon DP 28');
  var missing = [];
  Object.keys(Data.MONSTERS).forEach(function (id) {
    var m = Data.MONSTERS[id];
    if (!m || m.stage === 'egg') return;
    if (m.dpMaxSource !== 'nhoko-pendulum-tooltip') missing.push(id);
  });
  eq(missing.join(','), '', 'every non-egg Pendulum species has an NHOKO DP');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('  · ' + f));
process.exit(failed ? 1 : 0);
