/**
 * CardGame Googleスプレッドシート連携
 * ランキングと公開プロフィール（ユーザー名・デッキ2つ・幻想体階層）を保存します。
 * スプレッドシートに紐づいた Apps Script としてウェブアプリにデプロイしてください。
 * 注意：プロフィールは公開共有データです。ログイン認証はありません。
 */
const RANKING_SHEET_NAME = 'ランキング';
const RANKING_HEADERS = ['日時', 'プレイヤー名', '幻想体ID', '幻想体名', '討伐ターン数'];
const PROFILE_SHEET_NAME = 'プロフィール';
const PROFILE_HEADERS = ['ユーザー名', 'デッキ1(JSON)', 'デッキ2(JSON)', '幻想体階層(JSON)', '更新日時'];
const RANKING_BOSSES = {
  blood_bath: '血の風呂',
  yearning_heart: '熱望する心臓',
  ice_queen: '氷の女王'
};
const PROFILE_HIERARCHIES = ['総記の階', '歴史の階', '技術科学の階', '文学の階'];
const MAX_ROWS_PER_BOSS = 50;

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('このスクリプトを連携用スプレッドシートに紐づけてください。');
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function getRankingSheet_() { return getSheet_(RANKING_SHEET_NAME, RANKING_HEADERS); }
function getProfileSheet_() { return getSheet_(PROFILE_SHEET_NAME, PROFILE_HEADERS); }

function outputJson_(data, callback) {
  const json = JSON.stringify(data);
  // GitHub Pages側のクロスオリジン読み込みはJSONPで行います。
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function cleanProfileName_(value) {
  return String(value || '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}
function safeParse_(value, fallback) {
  try { return JSON.parse(String(value || '')); } catch (e) { return fallback; }
}
function profileRows_() {
  const sheet = getProfileSheet_();
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((row, i) => ({
    rowNumber: i + 2,
    name: cleanProfileName_(row[0]),
    decks: [safeParse_(row[1], null), safeParse_(row[2], null)],
    hierarchies: safeParse_(row[3], null),
    updatedAt: row[4] instanceof Date ? row[4].toISOString() : String(row[4] || '')
  })).filter(row => row.name);
}
function findProfile_(name) {
  const normalized = cleanProfileName_(name).toLocaleLowerCase();
  if (!normalized) return null;
  return profileRows_().find(row => row.name.toLocaleLowerCase() === normalized) || null;
}
function validateDeck_(deck) {
  if (!deck || typeof deck !== 'object' || Array.isArray(deck)) return false;
  const keys = Object.keys(deck);
  if (keys.length > 100) return false;
  let total = 0;
  for (const key of keys) {
    const count = deck[key];
    if (!key || key.length > 100 || !Number.isInteger(count) || count < 1 || count > 3) return false;
    total += count;
  }
  return total === 15;
}
function validateProfile_(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('プロフィールデータがありません。');
  const name = cleanProfileName_(profile.name);
  if (!name) throw new Error('ユーザー名が空です。');
  if (/^[=+\-@]/.test(name)) throw new Error('ユーザー名の先頭に =、+、-、@ は使えません。');
  if (!Array.isArray(profile.decks) || profile.decks.length !== 2 || !profile.decks.every(validateDeck_)) {
    throw new Error('デッキが正しくありません（2つとも15枚必要です）。');
  }
  const hs = Array.isArray(profile.hierarchies) ? profile.hierarchies : [];
  const hierarchies = [0, 1].map(i => PROFILE_HIERARCHIES.includes(hs[i]) ? hs[i] : PROFILE_HIERARCHIES[0]);
  const jsonLength = JSON.stringify(profile.decks).length + JSON.stringify(hierarchies).length;
  if (jsonLength > 30000) throw new Error('プロフィールのデータが大きすぎます。');
  return { name, decks: profile.decks, hierarchies };
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || 'ranking');
  try {
    if (action === 'profiles') {
      const rows = profileRows_().map(row => ({ name: row.name, updatedAt: row.updatedAt }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      return outputJson_({ ok: true, rows }, params.callback || '');
    }
    if (action === 'profile') {
      const row = findProfile_(params.name);
      if (!row) return outputJson_({ ok: false, error: 'プロフィールが見つかりません。' }, params.callback || '');
      return outputJson_({ ok: true, profile: {
        name: row.name, decks: row.decks, hierarchies: row.hierarchies, updatedAt: row.updatedAt
      } }, params.callback || '');
    }
    if (action !== 'ranking') {
      return outputJson_({ ok: false, error: 'Unsupported action' }, params.callback || '');
    }
    const values = getRankingSheet_().getDataRange().getValues();
    const rows = values.slice(1).map(row => ({
      date: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
      name: String(row[1] || ''), boss: String(row[2] || ''), bossName: String(row[3] || ''), turns: Number(row[4])
    })).filter(row => RANKING_BOSSES[row.boss] && Number.isInteger(row.turns) && row.turns > 0 && row.name);
    const best = [];
    Object.keys(RANKING_BOSSES).forEach(boss => {
      rows.filter(row => row.boss === boss)
        .sort((a, b) => a.turns - b.turns || String(a.date).localeCompare(String(b.date)))
        .slice(0, MAX_ROWS_PER_BOSS).forEach(row => best.push(row));
    });
    return outputJson_({ ok: true, rows: best }, params.callback || '');
  } catch (err) {
    return outputJson_({ ok: false, error: String(err && err.message || err) }, params.callback || '');
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') throw new Error('送信データが不正です。');

    if (payload.action === 'saveProfile') {
      const profile = validateProfile_(payload.profile || payload);
      const lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        const sheet = getProfileSheet_();
        const existing = findProfile_(profile.name);
        const row = [profile.name, JSON.stringify(profile.decks[0]), JSON.stringify(profile.decks[1]), JSON.stringify(profile.hierarchies), new Date()];
        if (existing) sheet.getRange(existing.rowNumber, 1, 1, PROFILE_HEADERS.length).setValues([row]);
        else sheet.appendRow(row);
      } finally { lock.releaseLock(); }
      return outputJson_({ ok: true, name: profile.name, updatedAt: new Date().toISOString() });
    }

    if (payload.action !== 'submit') throw new Error('Unsupported action');
    const name = cleanProfileName_(payload.name).replace(/^[=+\-@]+/, '').slice(0, 12);
    const boss = String(payload.boss || '');
    const turns = Number(payload.turns);
    if (!name) throw new Error('プレイヤー名が空です');
    if (!Object.prototype.hasOwnProperty.call(RANKING_BOSSES, boss)) throw new Error('幻想体IDが不正です');
    if (!Number.isInteger(turns) || turns < 1 || turns > 9999) throw new Error('ターン数が不正です');
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try { getRankingSheet_().appendRow([new Date(), name, boss, RANKING_BOSSES[boss], turns]); }
    finally { lock.releaseLock(); }
    return outputJson_({ ok: true });
  } catch (err) {
    return outputJson_({ ok: false, error: String(err && err.message || err) });
  }
}
