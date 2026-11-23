#!/usr/bin/env node
'use strict';
/* v35: writes the list of user-sprite files the game will look for:
 *   assets/user-sprites/expected.json   (used by user-sprites-check.html)
 *   docs/user-sprites-list.csv          (for the owner; UTF-8 with BOM)
 * Run: node scripts/user-sprite-list.js
 * Frames = the frames the renderers request (js/ui.js, js/devices/pendulum/ui.js). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
['js/evolution-data.js', 'js/sprites.js', 'js/devices/registry.js', 'js/devices/pendulum/data.js',
  'js/devices/pendulum/versions.js', 'js/devices/pendulum/sprites.js'].forEach((f) => require(path.join(ROOT, f)));

const F1997 = ['idle0', 'idle1', 'eat0', 'eat1', 'happy', 'angry', 'refuse', 'sleep0', 'sleep1', 'train0', 'train1', 'attack', 'sick', 'hurt', 'lose'];
const F1997_EGG = ['idle0', 'idle1', 'hatch'];
const FPEN = ['idle0', 'idle1', 'eat0', 'eat1', 'happy', 'angry', 'refuse', 'sleep0', 'sleep1', 'attack', 'sick', 'lose'];
const FPEN_EGG = ['idle0', 'idle1'];
const FRAME_ZH = {
  idle0: '待機 1', idle1: '待機 2', eat0: '吃 1（閉口）', eat1: '吃 2（張口）', happy: '開心', angry: '生氣',
  refuse: '拒絕（搖頭）', sleep0: '睡覺 1', sleep1: '睡覺 2', train0: '訓練 1', train1: '訓練 2', attack: '攻擊',
  sick: '生病', hurt: '受傷／被打', lose: '輸／倒下', hatch: '孵化（裂開）'
};
const STAGE_ZH = { egg: '數碼蛋', baby1: '幼年期Ⅰ', baby2: '幼年期Ⅱ', rookie: '成長期', child: '成長期', champion: '成熟期', adult: '成熟期',
  ultimate: '完全體', perfect: '完全體', mega: '究極體', super: '超究極體' };
const rows = [];
function add(device, family, version, id, nameZh, nameEn, stage, frames, required) {
  frames.forEach((fr) => rows.push({
    device, version, file: `${family}/${id}_${fr}.png`, family, id, nameZh: nameZh || '', nameEn: nameEn || '',
    stage: STAGE_ZH[stage] || stage || '', frame: fr, frameZh: FRAME_ZH[fr] || fr,
    size: '16x16', required: fr === 'idle0' ? '必要' : (required || '建議'),
  }));
}
// 1997 Digital Monster Ver.1-5 (every species of those versions that the game has a sprite for)
const M = global.EvolutionData.MONSTERS, A = global.SpriteAtlas.SPRITES;
for (const v of ['1', '2', '3', '4', '5']) {
  for (const m of Object.values(M).filter((x) => String(x.version) === v)) {
    if (!A[m.id]) continue;
    const egg = m.stage === 'egg';
    add('1997 Ver.' + v, 'dm1997', v, m.id, m.nameZh, m.nameEn, m.stage, egg ? F1997_EGG : F1997);
  }
}
// Pendulum Ver.1.0
const D = global.PendulumData, V = D.VERSIONS['1.0'];
const ids = [];
const seen = new Set();
function push(id) { if (id && D.MONSTERS[id] && !seen.has(id)) { seen.add(id); ids.push(id); } }
push(V.baby1); push(V.baby2);
const walk = (o) => { if (!o) return; if (typeof o === 'string') return push(o); if (Array.isArray(o)) return o.forEach(walk); Object.keys(o).forEach((k) => { push(k); walk(o[k]); }); };
['childEvo', 'adultEvo', 'perfectEvo', 'ultimateEvo', 'jogressPerfect', 'jogressUltimate'].forEach((k) => walk(V[k]));
const order = { baby1: 0, baby2: 1, child: 2, adult: 3, perfect: 4, ultimate: 5 };
ids.sort((a, b) => (order[D.MONSTERS[a].stage] - order[D.MONSTERS[b].stage]) || 0);
add('Pendulum 1.0', 'pendulum', '1.0', 'egg_pen_1_0', '超代 1.0 數碼蛋', 'Pendulum 1.0 Digitama', 'egg', FPEN_EGG);
for (const id of ids) add('Pendulum 1.0', 'pendulum', '1.0', id, D.MONSTERS[id].nameTw, D.MONSTERS[id].nameEn, D.MONSTERS[id].stage, FPEN);
add('Pendulum 1.0', 'pendulum', '1.0', 'pen_computer', '對戰電腦（連線畫面）', 'Computer', '', ['idle0'], '選用');

const expected = rows.map((r) => r.file);
fs.writeFileSync(path.join(ROOT, 'assets/user-sprites/expected.json'),
  JSON.stringify({ generated: 'scripts/user-sprite-list.js', count: expected.length, files: expected }, null, 1) + '\n');
const head = ['機種', '版本', '檔名（放在 assets/user-sprites/ 之下）', '怪獸 ID', '中文名', '英文名', '階段', '影格', '影格說明', '尺寸（點）', '必要性'];
const esc = (s) => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
const csv = [head].concat(rows.map((r) => [r.device, r.version, r.file, r.id, r.nameZh, r.nameEn, r.stage, r.frame, r.frameZh, r.size, r.required]))
  .map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
fs.writeFileSync(path.join(ROOT, 'docs/user-sprites-list.csv'), '\ufeff' + csv);
const species = new Set(rows.map((r) => r.family + '/' + r.id));
console.log(rows.length + ' files, ' + species.size + ' sprites (' + rows.filter((r) => r.family === 'dm1997').length + ' for 1997, ' + rows.filter((r) => r.family === 'pendulum').length + ' for Pendulum 1.0)');
