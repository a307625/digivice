/**
 * 連線對戰大廳。綁在一份 Google 試算表上。
 *
 * 1. 新增一份空白試算表。
 * 2. 擴充功能 → Apps Script，把這個檔案整份貼上，存檔。
 * 3. 部署 → 新增部署 → 類型選「網頁應用程式」。
 *    執行身分：我。誰可以存取：任何人。
 * 4. 網址已寫在遊戲 js/ui.js 的 LOBBY_URL。
 *    用「管理部署作業」更新版本，網址才不會變。誰可以存取要選「任何人」。
 *
 * 試算表不用公開。外面只能呼叫這支腳本。
 * 打開連線對戰會把邀請碼寫進「大廳」。關掉畫面、切走或關閉網頁會刪掉該列。
 * 對戰一開始兩邊就從大廳移除，雙方入帳前（最久 15 秒）不會再被登記。
 * 勝負由這支腳本用 1997 槽位表計算。
 */
var LOBBY_TTL_MS = 45 * 1000;
var FIGHT_DEBOUNCE_MS = 8 * 1000;
var FIGHT_BUSY_MS = 15 * 1000;
var INBOX_MS = 10 * 60 * 1000;

var STAGE_VAL = { rookie: 1, champion: 2, ultimate: 3, mega: 4, super: 5 };
var UPSET = [0.5, 0.08, 0.02, 0.005];
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

function doGet(e) {
  var out;
  try {
    out = handle_((e && e.parameter) || {});
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  var body = JSON.stringify(out);
  var cb = String((e && e.parameter && e.parameter.callback) || '');
  if (/^dmLobby_[0-9]+_[0-9]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}

function handle_(p) {
  var action = String(p.action || '');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (action === 'sync') return sync_(p);
    if (action === 'fight') return fight_(p);
    if (action === 'ack') return ack_(p);
    if (action === 'leave') return leave_(p);
    return { ok: false, error: '不認得的動作' };
  } finally {
    lock.releaseLock();
  }
}

function sync_(p) {
  var code = cleanCode_(p.code);
  if (!code) return { ok: false, error: '邀請碼不正確' };
  var lobby = lobbySheet_();
  var now = Date.now();
  var busy = busyCodes_(now);
  var existing = find_(lobby, code);
  var seq = existing ? (Number(existing.seq) || 0) + 1 : 1;
  if (busy[code]) {
    if (existing) lobby.deleteRow(existing._row);
  } else {
    upsert_(lobby, code, {
      code: code,
      mon: clip_(p.mon, 40),
      name: clip_(p.name, 32),
      slot: cleanSlot_(p.slot),
      stage: clip_(p.stage, 16),
      enhancement: clampEnh_(p.enhancement),
      seen: now,
      seq: seq
    });
  }
  dropStale_(lobby, now - LOBBY_TTL_MS);
  return {
    ok: true,
    waiting: !busy[code],
    seq: seq,
    others: onlineOthers_(lobby, code, now, busy),
    inbox: inbox_(code, now)
  };
}

function fight_(p) {
  var code = cleanCode_(p.code);
  var foe = cleanCode_(p.foe);
  if (!code || !foe) return { ok: false, error: '邀請碼不正確' };
  if (code === foe) return { ok: false, error: '不能和自己對戰' };
  var now = Date.now();
  var lobby = lobbySheet_();
  var me = find_(lobby, code);
  var them = find_(lobby, foe);
  if (!me || now - Number(me.seen) > LOBBY_TTL_MS) return { ok: false, error: '你已不在線上，請重新打開連線對戰' };
  if (!them || now - Number(them.seen) > LOBBY_TTL_MS) return { ok: false, error: '對方已離開' };
  var battles = battleSheet_();
  var recent = recentOpenFight_(battles, code, foe, now);
  if (recent) return { ok: true, battle: battleView_(recent) };
  var busy = busyCodes_(now);
  if (busy[code]) return { ok: false, error: '這場還沒結束' };
  if (busy[foe]) return { ok: false, error: '對方正在對戰' };
  var id = Utilities.getUuid();
  var chance = initiatorChance_(me, them);
  var result = roll_(id, chance);
  var row = {
    id: id,
    initiator: code,
    defender: foe,
    initiatorName: String(me.name || ''),
    defenderName: String(them.name || ''),
    initiatorResult: result,
    at: now,
    initiatorAck: '',
    defenderAck: ''
  };
  append_(battles, row);
  removeLobbyCodes_(lobby, [code, foe]);
  return { ok: true, battle: battleView_(row) };
}

function ack_(p) {
  var code = cleanCode_(p.code);
  var id = String(p.id || '');
  if (!code || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: '對戰編號不正確' };
  var sh = battleSheet_();
  var packed = rows_(sh);
  for (var i = 0; i < packed.items.length; i++) {
    var b = packed.items[i];
    if (String(b.id) !== id) continue;
    if (String(b.initiator) === code) setCell_(sh, packed.headers, b._row, 'initiatorAck', '1');
    else if (String(b.defender) === code) setCell_(sh, packed.headers, b._row, 'defenderAck', '1');
    else return { ok: false, error: '這場對戰不是你的' };
    return { ok: true };
  }
  return { ok: false, error: '找不到這場對戰' };
}

function leave_(p) {
  var code = cleanCode_(p.code);
  if (!code) return { ok: false, error: '邀請碼不正確' };
  var sh = lobbySheet_();
  var found = find_(sh, code);
  if (!found) return { ok: true };
  var want = String(p.seq || '');
  if (want && found.seq != null && String(found.seq) !== '' && String(found.seq) !== want) return { ok: true };
  sh.deleteRow(found._row);
  return { ok: true };
}

function initiatorChance_(init, foe) {
  var diff = clampEnh_(init.enhancement) - clampEnh_(foe.enhancement);
  var w = winsOutOf16_(cleanSlot_(init.slot), cleanSlot_(foe.slot), diff);
  if (w != null) return w / 16;
  var gap = (STAGE_VAL[String(init.stage)] || 1) - (STAGE_VAL[String(foe.stage)] || 1);
  if (gap === 0) return 0.5;
  var under = UPSET[Math.min(Math.abs(gap), 3)];
  return gap > 0 ? 1 - under : under;
}

function winsOutOf16_(initSlot, foeSlot, diff) {
  if (!initSlot || !foeSlot || !TABLE[initSlot]) return null;
  var cell = TABLE[initSlot][foeSlot];
  if (cell == null) return null;
  var w = cell + (diff || 0);
  if (w < 1) w = 1;
  if (w > 16) w = 16;
  return w;
}

function roll_(seed, chance) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(seed), Utilities.Charset.UTF_8);
  var n = ((digest[0] & 255) * 256 + (digest[1] & 255)) / 65536;
  return n < chance ? 'win' : 'loss';
}

function busyCodes_(now) {
  var set = {};
  rows_(battleSheet_()).items.forEach(function (b) {
    if (now - Number(b.at) > FIGHT_BUSY_MS) return;
    if (b.initiatorAck && b.defenderAck) return;
    set[String(b.initiator)] = true;
    set[String(b.defender)] = true;
  });
  return set;
}

function onlineOthers_(sh, self, now, busy) {
  var out = [];
  rows_(sh).items.forEach(function (r) {
    var code = String(r.code);
    if (code === self) return;
    if (busy && busy[code]) return;
    if (now - Number(r.seen) > LOBBY_TTL_MS) return;
    out.push({ code: code, name: String(r.name || ''), mon: String(r.mon || '') });
  });
  return out;
}

function removeLobbyCodes_(sh, codes) {
  var rows = [];
  codes.forEach(function (code) {
    var found = find_(sh, code);
    if (found) rows.push(found._row);
  });
  rows.sort(function (a, b) { return b - a; });
  rows.forEach(function (r) { sh.deleteRow(r); });
}

function inbox_(code, now) {
  var out = [];
  rows_(battleSheet_()).items.forEach(function (b) {
    if (now - Number(b.at) > INBOX_MS) return;
    var mine = (String(b.initiator) === code && !b.initiatorAck) ||
      (String(b.defender) === code && !b.defenderAck);
    if (mine) out.push(battleView_(b));
  });
  return out;
}

function recentOpenFight_(sh, init, foe, now) {
  var items = rows_(sh).items;
  for (var i = items.length - 1; i >= 0; i--) {
    var b = items[i];
    if (String(b.initiator) === init && String(b.defender) === foe &&
        !b.initiatorAck && now - Number(b.at) < FIGHT_DEBOUNCE_MS) return b;
  }
  return null;
}

function battleView_(b) {
  return {
    id: String(b.id),
    initiator: String(b.initiator),
    defender: String(b.defender),
    initiatorName: String(b.initiatorName || ''),
    defenderName: String(b.defenderName || ''),
    initiatorResult: String(b.initiatorResult)
  };
}

function lobbySheet_() {
  return ensureSheet_('大廳', ['code', 'mon', 'name', 'slot', 'stage', 'enhancement', 'seen', 'seq']);
}
function battleSheet_() {
  return ensureSheet_('對戰', ['id', 'initiator', 'defender', 'initiatorName', 'defenderName', 'initiatorResult', 'at', 'initiatorAck', 'defenderAck']);
}
function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    return sh;
  }
  var width = Math.max(sh.getLastColumn(), 1);
  var have = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h); });
  headers.forEach(function (h) {
    if (have.indexOf(h) === -1) {
      have.push(h);
      sh.getRange(1, have.length).setValue(h);
    }
  });
  return sh;
}
function rows_(sh) {
  var values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], items: [] };
  var headers = values[0].map(function (h) { return String(h); });
  var items = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    items.push(obj);
  }
  return { headers: headers, items: items };
}
function find_(sh, code) {
  var items = rows_(sh).items;
  for (var i = 0; i < items.length; i++) if (String(items[i].code) === code) return items[i];
  return null;
}
function upsert_(sh, code, fields) {
  var packed = rows_(sh);
  var existing = null;
  for (var i = 0; i < packed.items.length; i++) {
    if (String(packed.items[i].code) === code) { existing = packed.items[i]; break; }
  }
  if (!existing) { append_(sh, fields); return; }
  Object.keys(fields).forEach(function (k) {
    setCell_(sh, packed.headers, existing._row, k, fields[k]);
  });
}
function append_(sh, fields) {
  var headers = rows_(sh).headers;
  var row = headers.map(function (h) { return fields[h] == null ? '' : fields[h]; });
  sh.appendRow(row);
}
function setCell_(sh, headers, row, key, value) {
  var col = headers.indexOf(key);
  if (col < 0) return;
  sh.getRange(row, col + 1).setValue(value);
}
function dropStale_(sh, cutoff) {
  var items = rows_(sh).items;
  for (var i = items.length - 1; i >= 0; i--) {
    if (Number(items[i].seen) < cutoff) sh.deleteRow(items[i]._row);
  }
}
function cleanCode_(v) {
  var s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 4 || s.length > 8) return '';
  return s;
}
function cleanSlot_(v) {
  var s = String(v || '').toUpperCase();
  return /^[A-L]$/.test(s) ? s : '';
}
function clampEnh_(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) n = 0;
  if (n < 0) n = 0;
  if (n > 8) n = 8;
  return n;
}
function clip_(v, n) {
  return String(v || '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
}
