/*
 * アカウントモード／一台モードの分離
 * アカウント用の認証・編成同期・幻想体ランキングはGoogle Apps Script経由。
 * 一台モードの編成はページ稼働中のメモリだけに保持し、スプレッドシートへ同期しない。
 */
var SOLO_ACCOUNT = {
  mode: 'landing', // landing | account | single
  token: '',
  accountId: '',
  userName: '',
  formName: '',
  loggedIn: false,
  busy: false,
  message: '',
  messageType: 'msg',
  bootStarted: false,
  saveTimer: null,
  saveBusy: false,
  pendingSave: false
};

function soloAccountStoredToken() {
  try { return String(localStorage.getItem('cg_account_token') || ''); } catch (e) { return ''; }
}
function soloAccountPersistToken(token) {
  try { if (token) localStorage.setItem('cg_account_token', token); else localStorage.removeItem('cg_account_token'); return true; }
  catch (e) { return false; }
}
function soloAccountIsActive() { return SOLO_ACCOUNT.mode === 'account' && SOLO_ACCOUNT.loggedIn && !!SOLO_ACCOUNT.token; }
function soloAccountSetMessage(message, type) {
  SOLO_ACCOUNT.message = String(message || '');
  SOLO_ACCOUNT.messageType = type || 'msg';
}
function soloAccountReqId() {
  const bytes = new Uint8Array(24);
  try {
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else throw new Error('crypto unavailable');
    return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return 'cg' + Date.now().toString(36) + Array.from({length: 32}, () => Math.floor(Math.random() * 36).toString(36)).join('');
  }
}
// Apps Script POSTの本文はno-corsで送信し、結果は推測困難なrequestIdでJSONP照会する。
function soloAccountRequest(payload) {
  const url = soloSheetUrl();
  if (!soloValidSheetUrl(url)) return Promise.reject(new Error('先にApps ScriptのウェブアプリURL（末尾が /exec）を保存してください。'));
  if (typeof fetch !== 'function') return Promise.reject(new Error('このブラウザは通信機能に対応していません。'));
  const requestId = soloAccountReqId();
  const body = Object.assign({}, payload, { requestId: requestId });
  let postError = null;
  try {
    fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) })
      .catch(err => { postError = err; });
  } catch (err) { postError = err; }
  return new Promise((resolve, reject) => {
    let done = false, attempts = 0;
    const finish = (ok, value) => {
      if (done) return;
      done = true;
      if (outerTimer) clearTimeout(outerTimer);
      ok ? resolve(value) : reject(value instanceof Error ? value : new Error(String(value || '通信に失敗しました。')));
    };
    const outerTimer = setTimeout(() => finish(false, new Error('Apps Scriptから18秒以内に結果が返りませんでした。最新バージョンのデプロイと「アクセスできるユーザー：全員」を確認してください。')), 18000);
    const poll = () => {
      if (done) return;
      attempts++;
      soloJsonp({ action: 'result', requestId: requestId }, data => {
        if (done) return;
        if (data && data.pending) {
          if (attempts >= 28) finish(false, new Error('Apps Scriptが処理を完了しませんでした。デプロイを更新して再試行してください。'));
          else setTimeout(poll, 400);
          return;
        }
        if (data && data.ok) finish(true, data);
        else finish(false, new Error(data && data.error ? data.error : (postError ? '送信に失敗しました。公開設定を確認してください。' : 'Apps Scriptから不明な応答が返りました。')));
      }, err => {
        if (done) return;
        if (attempts < 3) setTimeout(poll, 650);
        else finish(false, err || new Error('Apps Scriptの応答を取得できません。'));
      });
    };
    setTimeout(poll, 300);
  });
}
function soloAccountProfileValid(profile) {
  if (!profile || !Array.isArray(profile.decks) || profile.decks.length !== 2) return false;
  try {
    const decks = fixDecks(profile.decks);
    return !dErr(decks[0]).length && !dErr(decks[1]).length && Array.isArray(profile.hierarchies);
  } catch (e) { return false; }
}
function soloAccountActivate(data) {
  const profile = data && data.profile;
  if (!data || !data.token || !profile || !soloAccountProfileValid(profile)) throw new Error('アカウントの編成データが正しくありません。サポート用にエラー内容を控えてください。');
  const userName = cleanName(data.userName || profile.userName);
  if (!userName) throw new Error('アカウント名を読み込めませんでした。');
  CG_NO_PERSIST = false;
  SOLO_ACCOUNT.mode = 'account';
  SOLO_ACCOUNT.token = String(data.token);
  SOLO_ACCOUNT.accountId = String(data.accountId || '');
  SOLO_ACCOUNT.userName = userName;
  SOLO_ACCOUNT.loggedIn = true;
  SOLO_ACCOUNT.busy = false;
  SOLO_ACCOUNT.bootStarted = true;
  PF.name = userName;
  PF.msg = '';
  DK.d = fixDecks(profile.decks);
  DK.cur = 0;
  DK.hiers = validHiers(profile.hierarchies);
  DK.warn = false;
  soloAccountPersistToken(SOLO_ACCOUNT.token);
  soloAccountSetMessage('ログインしました。編成はアカウントへ自動保存されます。', 'msg');
  SCR = 'home';
  render();
}
function soloAccountRestore() {
  if (SOLO_ACCOUNT.mode !== 'landing' || SOLO_ACCOUNT.busy) return;
  const token = soloAccountStoredToken();
  if (!token) return;
  SOLO_ACCOUNT.busy = true;
  soloAccountSetMessage('保存済みのログインを確認しています…', 'msg');
  render();
  soloAccountRequest({ action: 'getProfile', token: token }).then(data => {
    if (SOLO_ACCOUNT.mode !== 'landing') return;
    soloAccountActivate({ token: token, accountId: data.accountId, userName: data.userName, profile: data.profile });
  }).catch(err => {
    if (SOLO_ACCOUNT.mode !== 'landing') return;
    soloAccountPersistToken('');
    SOLO_ACCOUNT.token = ''; SOLO_ACCOUNT.accountId = ''; SOLO_ACCOUNT.userName = '';
    SOLO_ACCOUNT.loggedIn = false; SOLO_ACCOUNT.busy = false;
    soloAccountSetMessage((err && err.message ? err.message + ' ' : '') + '再度ログインしてください。', 'err');
    render();
  });
}
function soloAccountRegister() {
  if (SOLO_ACCOUNT.busy) return;
  const u = String((document.getElementById('cgAccountName') || {}).value || '').trim();
  const p = String((document.getElementById('cgAccountPassword') || {}).value || '');
  SOLO_ACCOUNT.formName = cleanName(u);
  if (cleanName(u).length < 2) { soloAccountSetMessage('ユーザー名は2〜12文字で入力してください。', 'err'); render(); return; }
  if (p.length < 8) { soloAccountSetMessage('パスワードは8文字以上にしてください。', 'err'); render(); return; }
  const decks = fixDecks(DK.d);
  const hierarchies = validHiers(DK.hiers);
  if (dErr(decks[0]).length || dErr(decks[1]).length) { soloAccountSetMessage('アカウント作成用のデッキが未完成です。', 'err'); render(); return; }
  SOLO_ACCOUNT.busy = true;
  soloAccountSetMessage('アカウントを作成しています…', 'msg'); render();
  soloAccountRequest({ action: 'register', userName: cleanName(u), password: p, profile: { decks, hierarchies } })
    .then(data => soloAccountActivate(data))
    .catch(err => { SOLO_ACCOUNT.busy = false; soloAccountSetMessage(err.message || 'アカウントを作成できませんでした。', 'err'); render(); });
}
function soloAccountLogin() {
  if (SOLO_ACCOUNT.busy) return;
  const u = String((document.getElementById('cgAccountName') || {}).value || '').trim();
  const p = String((document.getElementById('cgAccountPassword') || {}).value || '');
  SOLO_ACCOUNT.formName = cleanName(u);
  if (!cleanName(u) || !p) { soloAccountSetMessage('ユーザー名とパスワードを入力してください。', 'err'); render(); return; }
  SOLO_ACCOUNT.busy = true;
  soloAccountSetMessage('ログインしています…', 'msg'); render();
  soloAccountRequest({ action: 'login', userName: cleanName(u), password: p })
    .then(data => soloAccountActivate(data))
    .catch(err => { SOLO_ACCOUNT.busy = false; soloAccountSetMessage(err.message || 'ログインできませんでした。', 'err'); render(); });
}
function soloAccountSaveUrl() {
  const input = document.getElementById('cgAccountUrl');
  if (!input || !saveSoloSheetUrl(input.value, false)) {
    soloAccountSetMessage(SOLO.cloudProfileMessage || 'URLを保存できませんでした。/exec のウェブアプリURLを確認してください。', 'err');
  } else soloAccountSetMessage('Apps ScriptのURLを保存しました。', 'msg');
  render();
}
function soloAccountProfileData() {
  // 編集中の不完全デッキをfixDecksで初期デッキへ置き換えてしまわないよう、保存前は現状をそのまま検証する。
  const decks = Array.isArray(DK.d) ? DK.d.slice(0, 2).map(d => Object.assign({}, d || {})) : [];
  return { decks: decks, hierarchies: validHiers(DK.hiers) };
}
function soloAccountSaveProfile(manual) {
  if (!soloAccountIsActive()) return Promise.reject(new Error('アカウントモードでログインしてください。'));
  const profile = soloAccountProfileData();
  if (dErr(profile.decks[0]).length || dErr(profile.decks[1]).length) {
    const err = new Error('デッキ1・デッキ2をそれぞれ15枚にしてから保存してください。');
    soloAccountSetMessage(err.message, 'err');
    if (manual) render();
    return Promise.reject(err);
  }
  if (SOLO_ACCOUNT.saveBusy) { SOLO_ACCOUNT.pendingSave = true; return Promise.resolve({ ok: true, queued: true }); }
  SOLO_ACCOUNT.saveBusy = true;
  if (manual) { soloAccountSetMessage('編成をスプレッドシートへ保存しています…', 'msg'); render(); }
  else soloAccountSetMessage('編成を保存しています…', 'msg');
  return soloAccountRequest({ action: 'saveProfile', token: SOLO_ACCOUNT.token, profile: profile })
    .then(data => {
      SOLO_ACCOUNT.saveBusy = false;
      soloAccountSetMessage('ユーザー名・デッキ2つ・幻想体カードの階層をスプレッドシートへ保存しました。', 'msg');
      if (manual || SCR === 'home') render();
      if (SOLO_ACCOUNT.pendingSave) { SOLO_ACCOUNT.pendingSave = false; soloAccountScheduleSave(); }
      return data;
    })
    .catch(err => {
      SOLO_ACCOUNT.saveBusy = false;
      soloAccountSetMessage('編成を保存できませんでした：' + (err.message || '通信エラー'), 'err');
      if (manual || SCR === 'home') render();
      if (SOLO_ACCOUNT.pendingSave) { SOLO_ACCOUNT.pendingSave = false; soloAccountScheduleSave(); }
      throw err;
    });
}
function soloAccountScheduleSave() {
  if (!soloAccountIsActive()) return;
  if (SOLO_ACCOUNT.saveTimer) clearTimeout(SOLO_ACCOUNT.saveTimer);
  SOLO_ACCOUNT.saveTimer = setTimeout(() => {
    SOLO_ACCOUNT.saveTimer = null;
    if (!soloAccountIsActive()) return;
    const profile = soloAccountProfileData();
    if (dErr(profile.decks[0]).length || dErr(profile.decks[1]).length) {
      soloAccountSetMessage('編成を編集中です。デッキ1・2がそれぞれ15枚になると自動保存します。', 'msg');
      return;
    }
    soloAccountSaveProfile(false).catch(() => {});
  }, 1100);
}
function soloAccountLogout() {
  if (SOLO_ACCOUNT.saveTimer) clearTimeout(SOLO_ACCOUNT.saveTimer);
  soloAccountPersistToken('');
  SOLO_ACCOUNT.mode = 'landing'; SOLO_ACCOUNT.token = ''; SOLO_ACCOUNT.accountId = ''; SOLO_ACCOUNT.userName = '';
  SOLO_ACCOUNT.loggedIn = false; SOLO_ACCOUNT.busy = false; SOLO_ACCOUNT.saveBusy = false; SOLO_ACCOUNT.pendingSave = false; SOLO_ACCOUNT.bootStarted = true;
  CG_NO_PERSIST = false;
  PF.name = null; PF.msg = '';
  DK.d = fixDecks(null); DK.cur = 0; DK.hiers = [ABN_HIERARCHIES[0], ABN_HIERARCHIES[0]]; DK.warn = false;
  soloAccountSetMessage('ログアウトしました。', 'msg');
  SCR = 'home'; render();
}
function soloEnterSingleDeviceMode() {
  if (SOLO_ACCOUNT.saveTimer) clearTimeout(SOLO_ACCOUNT.saveTimer);
  // 一台モードを選んだ時点でアカウントの端末セッションも切り離す。再読み込み後に自動ログインしない。
  soloAccountPersistToken('');
  SOLO_ACCOUNT.mode = 'single'; SOLO_ACCOUNT.token = ''; SOLO_ACCOUNT.accountId = ''; SOLO_ACCOUNT.userName = ''; SOLO_ACCOUNT.loggedIn = false; SOLO_ACCOUNT.busy = false; SOLO_ACCOUNT.saveBusy = false; SOLO_ACCOUNT.pendingSave = false;
  // 一台モードのプロフィール保存キーはメモリ内の一時領域にだけ保存する。
  CG_NO_PERSIST = true;
  Object.keys(CG_TEMP_PROFILE_STORE).forEach(k => delete CG_TEMP_PROFILE_STORE[k]);
  PF.name = null; PF.msg = '';
  DK.d = fixDecks(null); DK.cur = 0; DK.hiers = [ABN_HIERARCHIES[0], ABN_HIERARCHIES[0]]; DK.warn = false;
  S = null; SOLO.active = false; NET.on = false;
  SCR = 'home'; render();
}
function soloAccountBackToLanding() {
  CG_NO_PERSIST = false;
  Object.keys(CG_TEMP_PROFILE_STORE).forEach(k => delete CG_TEMP_PROFILE_STORE[k]);
  SOLO_ACCOUNT.mode = 'landing'; SOLO_ACCOUNT.loggedIn = false; SOLO_ACCOUNT.busy = false; SOLO_ACCOUNT.bootStarted = false;
  PF.name = null; PF.msg = '';
  DK.d = fixDecks(null); DK.cur = 0; DK.hiers = [ABN_HIERARCHIES[0], ABN_HIERARCHIES[0]]; DK.warn = false;
  SCR = 'home'; render();
}
function soloAccountLandingHTML() {
  return `<div class="home"><h1 style="font-size:1.8rem">カードゲーム</h1><p>遊び方を選んでください。幻想体戦・オンライン対戦はアカウントモード、一台で2人が交代する対戦は保存なしの一台モードです。</p>
    <section class="pf"><h2>アカウントモード</h2><p><small>ユーザー名・パスワードでログインすると、編成をGoogleスプレッドシートから読み込み、変更も自動保存します。パスワードはスプレッドシートに平文保存しません。</small></p>
      <p><label for="cgAccountName">ユーザー名（2〜12文字）</label><br><input id="cgAccountName" maxlength="12" autocomplete="username" value="${soloEsc(SOLO_ACCOUNT.formName)}" style="width:100%;box-sizing:border-box" placeholder="ユーザー名"></p>
      <p><label for="cgAccountPassword">パスワード（8文字以上）</label><br><input id="cgAccountPassword" type="password" minlength="8" autocomplete="current-password" style="width:100%;box-sizing:border-box" placeholder="パスワード"></p>
      <p><button class="go" onclick="soloAccountRegister()" ${SOLO_ACCOUNT.busy?'disabled':''}>新しいアカウントを作成</button> <button class="sub" onclick="soloAccountLogin()" ${SOLO_ACCOUNT.busy?'disabled':''}>ログイン</button></p>
      <p class="${soloEsc(SOLO_ACCOUNT.messageType)}">${soloEsc(SOLO_ACCOUNT.message || '初回はユーザー名とパスワードを決めて登録してください。')}</p>
    </section>
    <section class="pf"><h2>Google連携</h2><p><small>Google Apps ScriptのURLはゲーム本体に組み込み済みです。URLを入力する必要はありません。</small></p></section>
    <p><button class="go" onclick="soloEnterSingleDeviceMode()">一台モード（編成を保存しない）</button></p>
    <p><small>一台モードではプロフィール・編成は現在のページを開いている間だけ保持され、Googleスプレッドシートにもブラウザの保存領域にも書き込みません。ページを再読み込みすると消えます。</small></p><p><small>注意：パスワードを忘れた場合のメールによる再設定機能はありません。忘れないよう安全な場所に控えてください。</small></p>
  </div>`;
}
function soloAccountRenderHome() {
  document.body.className = '';
  document.getElementById('stat').innerHTML = '<button class="sub" onclick="soloAccountLogout()">ログアウト</button>';
  const states = [0, 1].map(i => {
    const e = dErr(DK.d[i] || {});
    return `<p>デッキ${i + 1}：${Object.values(DK.d[i] || {}).reduce((a,b)=>a+b,0)}/15枚　<span class="${e.length?'err':'ok'}">${e.length?'未完成':'使用可能'}</span></p>`;
  }).join('');
  document.getElementById('app').innerHTML = `<div class="home"><h1>アカウントモード</h1><p>ログイン中：<b>${soloEsc(SOLO_ACCOUNT.userName)}</b></p><p>編成はこのアカウントに紐づき、別端末でも読み込めます。一台対戦の編成はこのアカウントへ保存されません。</p>
    <section class="pf"><h2>保存中の編成</h2>${states}<p><button class="go" onclick="DK.cur=0;SCR='deck';render()">デッキ構築・編成の編集</button></p><p><button class="sub" onclick="soloAccountSaveProfile(true)">編成を今すぐ保存</button></p><p class="${soloEsc(SOLO_ACCOUNT.messageType)}">${soloEsc(SOLO_ACCOUNT.message || '編成の変更は自動保存されます。')}</p></section>
    <p><button class="go" onclick="SCR='solo';render()">幻想体戦</button></p><p><button class="go" onclick="SCR='lobby';render()">オンライン対戦</button></p><p><button class="sub" onclick="SCR='rules';render()">ルール説明</button></p>
    <p><button class="sub" onclick="soloEnterSingleDeviceMode()">一台モードへ（編成は保存しない）</button></p>
  </div>`;
}
const __soloAccountOriginalRenderHome = renderHome;
renderHome = function () {
  if (SOLO_ACCOUNT.mode === 'account' && SOLO_ACCOUNT.loggedIn && SOLO_ACCOUNT.token) {
    soloAccountRenderHome();
    return;
  }
  if (SOLO_ACCOUNT.mode === 'single') {
    __soloAccountOriginalRenderHome();
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = app.innerHTML.replace(/<p><button class="go" onclick="SCR='lobby';render\(\)">オンライン対戦<\/button><\/p>/g, '');
      app.innerHTML = app.innerHTML.replace('<p><button class="go" onclick="SCR=\'rules\';render()">ルール説明</button></p>', '<p><button class="go" onclick="SCR=\'rules\';render()">ルール説明</button></p><p><button class="sub" onclick="soloAccountBackToLanding()">モード選択へ戻る</button></p>');
      app.innerHTML = app.innerHTML.replace(/名前ごとにデッキが保存されます（この端末のブラウザの中に保存）。オンライン対戦では相手にも表示されます。/g, '一時プロフィールです。名前と編成はページ内だけに保持され、再読み込みすると消えます。');
      app.innerHTML = app.innerHTML.replace(/<details>[\s\S]*?<\/details>/g, '');
      app.innerHTML = app.innerHTML.replace('一台モード：同じ端末で2人が交代して対戦（編成はこのタブ内だけで、一台モードからGoogleへ保存しません）', '一台モード：同じ端末で2人が交代して対戦（編成はページ内だけに保持し、再読み込み時に消去）');
    }
    return;
  }
  document.body.className = '';
  document.getElementById('stat').innerHTML = '';
  document.getElementById('app').innerHTML = soloAccountLandingHTML();
  if (!SOLO_ACCOUNT.bootStarted) {
    SOLO_ACCOUNT.bootStarted = true;
    if (soloAccountStoredToken()) setTimeout(soloAccountRestore, 50);
  }
};

// 認証済みプロフィールからのみランキングを投稿する。名前・IDはサーバー側のログイン情報で決める。
function soloSubmitSheetRecord(row) {
  if (!soloAccountIsActive()) return Promise.reject(new Error('アカウントモードでログインしていないため、ランキングへ登録できません。'));
  return soloAccountRequest({ action: 'submitRank', token: SOLO_ACCOUNT.token, boss: row.boss, turns: row.turns });
}
