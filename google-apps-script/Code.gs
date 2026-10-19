/**
 * CardGame：アカウント・編成同期・幻想体戦ランキング
 * スプレッドシートに紐づけた Apps Script をウェブアプリとしてデプロイします。
 * パスワードは平文で保存しません。ブラウザからのPOSTはrequestIdで結果を照会します。
 */
const CG_ACCOUNT_SHEET = 'アカウント';
const CG_ACCOUNT_HEADERS = ['アカウントID', 'ユーザー名', 'ソルト', 'パスワードハッシュ', 'デッキ1(JSON)', 'デッキ2(JSON)', '幻想体階層(JSON)', '作成日時', '更新日時'];
const CG_RECORD_SHEET = '討伐記録';
const CG_RECORD_HEADERS = ['日時', 'アカウントID', 'ユーザー名', '幻想体ID', '幻想体名', '討伐ターン数'];
const CG_BOSSES = { blood_bath: '血の風呂', yearning_heart: '熱望する心臓', ice_queen: '氷の女王' };
const CG_HIERARCHIES = ['総記の階', '歴史の階', '技術科学の階', '文学の階'];
const CG_SESSION_SECONDS = 21600; // 6時間
const CG_RESULT_SECONDS = 180;
const CG_HASH_ROUNDS = 8000;
const CG_LOGIN_MAX_FAILURES = 8;
const CG_LOGIN_WINDOW_SECONDS = 3600;

function cgSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('このApps Scriptを保存先のGoogleスプレッドシートから「拡張機能 → Apps Script」で開いてください。');
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}
function cgAccounts_() { return cgSheet_(CG_ACCOUNT_SHEET, CG_ACCOUNT_HEADERS); }
function cgRecords_() { return cgSheet_(CG_RECORD_SHEET, CG_RECORD_HEADERS); }
function cgOutput_(data, callback) {
  const body = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function cgCleanName_(value) {
  return String(value || '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}
function cgNameKey_(value) { return cgCleanName_(value).toLocaleLowerCase(); }
function cgRequestId_(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) throw new Error('リクエストIDが不正です。画面を更新してやり直してください。');
  return id;
}
function cgRequestKey_(id) { return 'result:' + id; }
function cgPutResult_(id, result) {
  if (!id) return;
  try { CacheService.getScriptCache().put(cgRequestKey_(id), JSON.stringify(result), CG_RESULT_SECONDS); } catch (e) {}
}
function cgPasswordHash_(password, salt) {
  let current = String(salt) + ':' + String(password);
  for (let i = 0; i < CG_HASH_ROUNDS; i++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, current, Utilities.Charset.UTF_8);
    current = Utilities.base64Encode(bytes) + ':' + salt + ':' + i;
  }
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, current, Utilities.Charset.UTF_8));
}
function cgEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i % Math.max(1, a.length)) || 0) ^ (b.charCodeAt(i % Math.max(1, b.length)) || 0);
  return diff === 0;
}
function cgToken_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function cgTokenHash_(token) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token || ''), Utilities.Charset.UTF_8)).replace(/=+$/g, '');
}
function cgNewSession_(account) {
  const token = cgToken_();
  const session = { accountId: String(account.accountId), userName: String(account.userName), expiresAt: Date.now() + CG_SESSION_SECONDS * 1000 };
  CacheService.getScriptCache().put('session:' + cgTokenHash_(token), JSON.stringify(session), CG_SESSION_SECONDS);
  return { token: token, accountId: session.accountId, userName: session.userName };
}
function cgSession_(token) {
  const raw = String(token || '');
  if (raw.length < 32 || raw.length > 200) throw new Error('ログイン情報がありません。ログインし直してください。');
  const encoded = CacheService.getScriptCache().get('session:' + cgTokenHash_(raw));
  if (!encoded) throw new Error('ログインの有効期限が切れました。もう一度ログインしてください。');
  const session = JSON.parse(encoded);
  if (!session.accountId || Number(session.expiresAt) < Date.now()) throw new Error('ログインの有効期限が切れました。もう一度ログインしてください。');
  return session;
}
function cgRows_() {
  const sheet = cgAccounts_();
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((r, i) => ({
    row: i + 2,
    accountId: String(r[0] || ''),
    userName: cgCleanName_(r[1]),
    salt: String(r[2] || ''),
    passwordHash: String(r[3] || ''),
    decks: [cgParse_(r[4], null), cgParse_(r[5], null)],
    hierarchies: cgParse_(r[6], null),
    createdAt: r[7] instanceof Date ? r[7].toISOString() : String(r[7] || ''),
    updatedAt: r[8] instanceof Date ? r[8].toISOString() : String(r[8] || '')
  })).filter(x => x.accountId && x.userName);
}
function cgParse_(v, fallback) { try { return JSON.parse(String(v || '')); } catch (e) { return fallback; } }
function cgFindByName_(name) { const key = cgNameKey_(name); return cgRows_().find(x => cgNameKey_(x.userName) === key) || null; }
function cgFindById_(id) { return cgRows_().find(x => x.accountId === String(id)) || null; }
function cgValidateDeck_(deck) {
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
function cgValidateProfile_(profile, userName) {
  if (!profile || typeof profile !== 'object') throw new Error('編成データがありません。');
  if (!Array.isArray(profile.decks) || profile.decks.length !== 2 || !profile.decks.every(cgValidateDeck_)) {
    throw new Error('デッキ1・デッキ2を、それぞれ15枚にしてから保存してください。');
  }
  const supplied = Array.isArray(profile.hierarchies) ? profile.hierarchies : [];
  const hierarchies = [0, 1].map(i => CG_HIERARCHIES.includes(supplied[i]) ? supplied[i] : CG_HIERARCHIES[0]);
  if (JSON.stringify(profile.decks).length + JSON.stringify(hierarchies).length > 30000) throw new Error('編成データが大きすぎます。');
  return { userName: cgCleanName_(userName), decks: profile.decks, hierarchies: hierarchies };
}
function cgProfileResult_(account) {
  return { userName: account.userName, decks: account.decks, hierarchies: Array.isArray(account.hierarchies) ? account.hierarchies : [CG_HIERARCHIES[0], CG_HIERARCHIES[0]], updatedAt: account.updatedAt || '' };
}
function cgCreateAccount_(payload) {
  const userName = cgCleanName_(payload.userName || payload.name);
  if (userName.length < 2) throw new Error('ユーザー名は2〜12文字で入力してください。');
  if (/^[=+\-@]/.test(userName)) throw new Error('ユーザー名の先頭に =、+、-、@ は使えません。');
  const password = String(payload.password || '');
  if (password.length < 8 || password.length > 100) throw new Error('パスワードは8〜100文字にしてください。');
  const profile = cgValidateProfile_(payload.profile || {}, userName);
  const salt = Utilities.getUuid() + Utilities.getUuid();
  const passwordHash = cgPasswordHash_(password, salt);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let rowData;
  try {
    if (cgFindByName_(userName)) throw new Error('そのユーザー名はすでに使われています。別の名前を入力してください。');
    const now = new Date();
    const accountId = Utilities.getUuid();
    rowData = { accountId: accountId, userName: userName, decks: profile.decks, hierarchies: profile.hierarchies, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    cgAccounts_().appendRow([accountId, userName, salt, passwordHash, JSON.stringify(profile.decks[0]), JSON.stringify(profile.decks[1]), JSON.stringify(profile.hierarchies), now, now]);
  } finally { lock.releaseLock(); }
  const session = cgNewSession_(rowData);
  return { ok: true, token: session.token, accountId: session.accountId, userName: session.userName, profile: cgProfileResult_(rowData) };
}
function cgLogin_(payload) {
  const userName = cgCleanName_(payload.userName || payload.name);
  const password = String(payload.password || '');
  if (!userName || !password) throw new Error('ユーザー名とパスワードを入力してください。');
  const key = 'login-fail:' + cgTokenHash_(cgNameKey_(userName));
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(key) || 0);
  if (attempts >= CG_LOGIN_MAX_FAILURES) throw new Error('ログイン試行が多すぎます。1時間ほど待ってから再試行してください。');
  const account = cgFindByName_(userName);
  if (!account || !cgEqual_(cgPasswordHash_(password, account.salt), account.passwordHash)) {
    cache.put(key, String(attempts + 1), CG_LOGIN_WINDOW_SECONDS);
    throw new Error('ユーザー名またはパスワードが違います。ログイン失敗が続くと一時的に制限されます。');
  }
  cache.remove(key);
  const session = cgNewSession_(account);
  return { ok: true, token: session.token, accountId: session.accountId, userName: session.userName, profile: cgProfileResult_(account) };
}
function cgSaveProfile_(payload) {
  const session = cgSession_(payload.token);
  const account = cgFindById_(session.accountId);
  if (!account) throw new Error('アカウントが見つかりません。もう一度登録してください。');
  const profile = cgValidateProfile_(payload.profile || {}, account.userName);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let now;
  try {
    now = new Date();
    cgAccounts_().getRange(account.row, 5, 1, 5).setValues([[JSON.stringify(profile.decks[0]), JSON.stringify(profile.decks[1]), JSON.stringify(profile.hierarchies), account.createdAt ? new Date(account.createdAt) : now, now]]);
  } finally { lock.releaseLock(); }
  return { ok: true, userName: account.userName, updatedAt: now.toISOString() };
}
function cgGetProfile_(payload) {
  const session = cgSession_(payload.token);
  const account = cgFindById_(session.accountId);
  if (!account) throw new Error('アカウントが見つかりません。もう一度登録してください。');
  return { ok: true, accountId: account.accountId, userName: account.userName, profile: cgProfileResult_(account) };
}
function cgSubmitRank_(payload) {
  const session = cgSession_(payload.token);
  const account = cgFindById_(session.accountId);
  if (!account) throw new Error('アカウントが見つかりません。もう一度ログインしてください。');
  const boss = String(payload.boss || '');
  const turns = Number(payload.turns);
  if (!Object.prototype.hasOwnProperty.call(CG_BOSSES, boss)) throw new Error('幻想体IDが不正です。');
  if (!Number.isInteger(turns) || turns < 1 || turns > 9999) throw new Error('ターン数が不正です。');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { cgRecords_().appendRow([new Date(), account.accountId, account.userName, boss, CG_BOSSES[boss], turns]); }
  finally { lock.releaseLock(); }
  return { ok: true, userName: account.userName, boss: boss, turns: turns };
}
function cgRanking_() {
  const values = cgRecords_().getDataRange().getValues();
  const best = {};
  values.slice(1).forEach(row => {
    const date = row[0] instanceof Date ? row[0].toISOString() : String(row[0] || '');
    const accountId = String(row[1] || ''), name = String(row[2] || ''), boss = String(row[3] || ''), turns = Number(row[5]);
    if (!accountId || !name || !Object.prototype.hasOwnProperty.call(CG_BOSSES, boss) || !Number.isInteger(turns) || turns < 1) return;
    const key = accountId + ':' + boss;
    const old = best[key];
    if (!old || turns < old.turns || (turns === old.turns && date < old.date)) best[key] = { date: date, accountId: accountId, name: name, boss: boss, bossName: CG_BOSSES[boss], turns: turns };
  });
  return Object.keys(best).map(k => best[k]).sort((a, b) => a.boss.localeCompare(b.boss) || a.turns - b.turns || a.date.localeCompare(b.date)).slice(0, 300);
}
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || 'ranking');
  try {
    if (action === 'health') return cgOutput_({ ok: true, version: 'accounts-v1' }, params.callback || '');
    if (action === 'result') {
      const id = cgRequestId_(params.requestId || params.id);
      const cached = CacheService.getScriptCache().get(cgRequestKey_(id));
      return cgOutput_(cached ? JSON.parse(cached) : { ok: false, pending: true }, params.callback || '');
    }
    if (action === 'ranking') return cgOutput_({ ok: true, rows: cgRanking_() }, params.callback || '');
    return cgOutput_({ ok: false, error: '未対応の操作です。' }, params.callback || '');
  } catch (err) { return cgOutput_({ ok: false, error: String(err && err.message || err) }, params.callback || ''); }
}
function doPost(e) {
  let requestId = '';
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    requestId = cgRequestId_(payload.requestId);
    const prior = CacheService.getScriptCache().get(cgRequestKey_(requestId));
    if (prior) return cgOutput_({ ok: true, requestId: requestId });
    let result;
    switch (String(payload.action || '')) {
      case 'register': result = cgCreateAccount_(payload); break;
      case 'login': result = cgLogin_(payload); break;
      case 'getProfile': result = cgGetProfile_(payload); break;
      case 'saveProfile': result = cgSaveProfile_(payload); break;
      case 'submitRank': result = cgSubmitRank_(payload); break;
      default: throw new Error('未対応の操作です。');
    }
    cgPutResult_(requestId, result);
    return cgOutput_({ ok: true, requestId: requestId });
  } catch (err) {
    const result = { ok: false, error: String(err && err.message || err) };
    if (requestId) cgPutResult_(requestId, result);
    return cgOutput_({ ok: false, requestId: requestId, error: result.error });
  }
}
