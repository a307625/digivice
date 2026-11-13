#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const data = require('../js/evolution-data.js');

function fmtRange(range, suffix) {
  if (range == null) return '—';
  const a = range[0];
  const b = range[1];
  if (b == null) return `${a}+${suffix || ''}`;
  if (a === b) return `${a}${suffix || ''}`;
  return `${a}–${b}${suffix || ''}`;
}

function fmtRule(rule) {
  if (rule.stay && rule.leftover) {
    if (rule.reason === 'no-mega-from-this-ultimate') return '無究極體（停留在完全體）';
    if (rule.reason === 'mega-requirements-not-met') return '未達條件則停留在完全體';
    if (rule.reason === 'ultimate-requirements-not-met') return '未通過完全體檢定（15 戰以上＋勝分骰）則停留在成熟期';
    return '未達條件則停留';
  }
  if (rule.leftover) return '其他條件皆不符合時（官方 leftover）';
  const parts = [];
  if (rule.calls) parts.push(`育成失誤 ${fmtRange(rule.calls)} 次`);
  if (rule.train) parts.push(`訓練 ${fmtRange(rule.train)} 次`);
  if (rule.overfeed) parts.push(`過食 ${fmtRange(rule.overfeed)} 次`);
  if (rule.sleepDist) parts.push(`睡眠打擾 ${fmtRange(rule.sleepDist)} 次`);
  if (rule.weight) parts.push(`體重 ${fmtRange(rule.weight, 'g')}`);
  if (rule.perfectRoll) parts.push('完全體檢定（15 戰以上，勝分骰；非勝率 80%）');
  if (rule.battles) parts.push(`對戰 ${fmtRange(rule.battles)} 次`);
  if (rule.winRate) {
    const pct = (v) => (v == null ? '' : Math.round(v * 100) + '%');
    const a = rule.winRate[0], b = rule.winRate[1];
    parts.push(b == null || b === 1 ? `勝率 ${pct(a)}+` : `勝率 ${pct(a)}–${pct(b)}`);
  }
  if (rule.timeInStage) parts.push(`本階段時間 ${fmtRange(rule.timeInStage, ' 分')}`);
  return parts.length ? parts.join('；') : '時間到達即可（無其他條件）';
}

function monLine(id) {
  const m = data.MONSTERS[id];
  if (!m) return id;
  const st = data.STAGES[m.stage] || { zh: m.stage, en: m.stage };
  return `**${m.nameZh}** / ${m.nameEn} \`${id}\`（${st.zh} / ${st.en}）`;
}

const out = [];
out.push('# 數碼怪獸對打機進化表');
out.push('');
out.push('Digital Monster Ver.1–Ver.5 official branches, plus Ver.20th Anniversary Mega (究極體) and optional Jogress.');
out.push('');
out.push('本表由 `js/evolution-data.js` 自動匯出，與遊戲及自動化測試使用同一份條件表。優先順序為列表由上到下，第一條符合的規則生效；最後的 leftover／stay 為官方後備。');
out.push('');
out.push('條件欄位：育成失誤（calls / care mistakes）、訓練次數、過食、睡眠打擾、體重、對戰場次、勝率、本階段時間。體重欄位已預留，官方 Ver.1–5／20th 標準蛋路線不使用體重作為進化門檻。');
out.push('');
out.push('## 資料來源與規則摘要');
out.push('');
for (const s of data.NOTES.sources) out.push(`- ${s}`);
out.push('');
out.push('## 階段對照');
out.push('');
out.push('| 本遊戲（西式／本表） | 繁中 | 日式原機／Wikimon |');
out.push('| --- | --- | --- |');
out.push('| Egg | 數碼蛋 | Digitama |');
out.push('| Baby I | 幼年期Ⅰ | Baby I |');
out.push('| Baby II | 幼年期Ⅱ | Baby II |');
out.push('| Rookie | 成長期 | Child |');
out.push('| Champion | 成熟期 | Adult |');
out.push('| Ultimate | 完全體 | Perfect |');
out.push('| Mega | 究極體 | Ultimate |');
out.push('| Super Ultimate | 超究極體 | Jogress 合體（可選） |');
out.push('');

const order = ['egg', 'baby1', 'baby2', 'rookie', 'champion', 'ultimate', 'mega', 'super'];

function mermaidForVersion(ver) {
  const ids = Object.keys(data.MONSTERS).filter((id) => data.MONSTERS[id].version === ver);
  const lines = ['```mermaid', 'flowchart TD'];
  // egg
  lines.push(`  egg_v${ver}[Ver.${ver} 數碼蛋]`);
  const seen = new Set();
  function addEdge(frm, to, label) {
    if (!to) return;
    const a = data.MONSTERS[frm];
    const b = data.MONSTERS[to];
    if (!a || !b) return;
    if (a.version !== ver && !String(frm).startsWith('egg')) return;
    if (b.version !== ver && b.version !== 0) return;
    const lab = (label || '').replace(/"/g, "'");
    lines.push(`  ${frm}["${a.nameZh}\\n${a.nameEn}"] -->|${lab}| ${to}["${b.nameZh}\\n${b.nameEn}"]`);
    seen.add(frm); seen.add(to);
  }
  const egg = `egg_v${ver}`;
  for (const rule of data.BRANCHES[egg] || []) addEdge(egg, rule.to, fmtRule(rule));
  for (const id of ids) {
    for (const rule of data.BRANCHES[id] || []) {
      if (rule.stay || !rule.to) continue;
      addEdge(id, rule.to, fmtRule(rule));
    }
  }
  lines.push('```');
  return lines.join('\n');
}

for (const ver of [1, 2, 3, 4, 5]) {
  const meta = data.VERSIONS[ver];
  out.push(`## ${meta.zh} — ${meta.en}`);
  out.push('');
  out.push(mermaidForVersion(ver));
  out.push('');
  out.push('### 條件明細（優先順序）');
  out.push('');
  const ids = Object.keys(data.MONSTERS)
    .filter((id) => data.MONSTERS[id].version === ver)
    .sort((a, b) => order.indexOf(data.MONSTERS[a].stage) - order.indexOf(data.MONSTERS[b].stage));
  out.push(`| 目前型態 | 優先 | 進化為 | 條件 |`);
  out.push(`| --- | ---: | --- | --- |`);
  out.push(`| ${monLine('egg_v' + ver)} | 1 | ${monLine((data.BRANCHES['egg_v' + ver] || [])[0].to)} | ${fmtRule((data.BRANCHES['egg_v' + ver] || [])[0])} |`);
  for (const id of ids) {
    const rules = data.BRANCHES[id] || [];
    rules.forEach((rule, i) => {
      const dest = rule.stay || !rule.to ? '（停留）' : monLine(rule.to);
      out.push(`| ${monLine(id)} | ${i + 1} | ${dest} | ${fmtRule(rule)} |`);
    });
  }
  out.push('');
}

out.push('## 可選：20th 動畫限定蛋');
out.push('');
out.push('這兩條不是 Ver.1／Ver.2 標準蛋的 Mega 路線（標準為電光暴龍獸、偃月加魯魯獸），而是 Ver.20th 機體顏色限定數碼蛋。');
out.push('');
for (const [key, egg] of Object.entries(data.SPECIAL_EGGS)) {
  out.push(`### ${egg.nameZh} / ${egg.nameEn}`);
  out.push('');
  out.push(egg.line.map(monLine).join(' → '));
  out.push('');
  out.push(egg.note);
  out.push('');
}

out.push('## 可選：合體／超究極體（Jogress）');
out.push('');
out.push('| 夥伴 A | 夥伴 B | 合體為 | 條件 |');
out.push('| --- | --- | --- | --- |');
for (const j of data.JOGRESS) {
  out.push(`| ${monLine(j.a)} | ${monLine(j.b)} | ${monLine(j.to)} | 標籤對戰獲勝 ${j.tagWins} 次。${j.note || ''} |`);
}
out.push('');
out.push('---');
out.push('');
out.push('個人非商業用途的粉絲再創資料表。角色名稱與進化條件依官方設定整理；點陣圖為自行重繪。');
out.push('');

const dest = path.join(__dirname, '..', 'evolution-chart.md');
fs.writeFileSync(dest, out.join('\n'), 'utf8');
console.log('Wrote', dest, 'lines', out.length);
