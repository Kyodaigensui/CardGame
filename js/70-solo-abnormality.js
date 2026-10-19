/*
 * 幻想体戦（ソロ）＋ランキング連携
 * 対人戦のロジックとは分離し、既存の戦闘エンジンを流用します。
 */
const SOLO = {
  active: false,
  bossId: null,
  turns: 0,
  remoteRows: null,
  remoteLoading: false,
  remoteUrl: '',
  localKey: 'cg_solo_records_v1',
  sheetKey: 'cg_solo_sheet_endpoint',
  cloudProfiles: [],
  cloudProfilesLoading: false,
  cloudProfileMessage: ''
};
const SOLO_BOSSES = [
  {id:'blood_bath', name:'血の風呂', summary:'2回行動。ダイス値低下、3連撃による行動不能、3ダイス防御を使う。'},
  {id:'yearning_heart', name:'熱望する心臓', summary:'心臓の命中で渇望する肺を強化。肺は3ダイス攻撃を行う。'},
  {id:'ice_queen', name:'氷の女王', summary:'中央以外の味方が凍結。寒気を蓄積させ、女王を倒すと解放。'}
];

// パッシブ欄の説明専用表示。PKには説明文だけを置き、ギミックの処理自体は下の専用ロジックが担当。
Object.assign(PAS, {
  solo_blood_desc: {n:'血の風呂のギミック', k:'solo_blood_desc'},
  solo_heart_desc: {n:'熱望する心臓のギミック', k:'solo_heart_desc'},
  solo_lung_desc: {n:'渇望する肺のギミック', k:'solo_lung_desc'},
  solo_queen_desc: {n:'氷の女王のギミック', k:'solo_queen_desc'}
});
Object.assign(PK, {
  solo_blood_desc: {t:()=> '行動権2。単ダイス命中時に対象の次ターンのダイス値-3。3ダイス攻撃の全ダイスが命中すると対象は次ターン行動不能。3ダイス防御も使用する。'},
  solo_heart_desc: {t:()=> '単ダイス攻撃が命中すると、ほかの生存する味方の次ターンのダイス値+2。弱い防御ページも使用する。'},
  solo_lung_desc: {t:()=> '3ダイス攻撃を使用する。心臓の強化が重なるとダイス値が上がる。'},
  solo_queen_desc: {t:()=> '戦闘開始時、中央の味方以外を凍結。女王を倒すと凍結した味方はHP75%で解放される。攻撃命中で寒気+1。寒気はターン終了時-1、ターン開始時4以上なら速度-1・ダイス値-2、6以上なら1ターン行動不能になり寒気をすべて失う。'}
});

// 寒気は通常の状態異常とは別管理にし、画面表示だけ既存の状態異常欄へ載せます。
STN.cold = {n:'寒気', i:'❄', c:'#8bd5f5', t:'ターン終了時-1。ターン開始時4以上で速度-1・ダイス値-2、6以上で1ターン行動不能になり寒気をすべて失う。'};

const soloEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const soloSheetUrl = () => { try { return String(localStorage.getItem(SOLO.sheetKey)||'').trim(); } catch(e) { return ''; } };
const soloValidSheetUrl = u => /^https:\/\/script\.google\.com\/macros\/s\/[^\s]+\/exec(?:\?.*)?$/.test(String(u||''));
function saveSoloSheetUrl(v) {
  const u = String(v||'').trim();
  try { localStorage.setItem(SOLO.sheetKey, u); } catch(e) {}
  SOLO.remoteRows = null; SOLO.remoteLoading = false; SOLO.remoteUrl = '';
  SOLO.cloudProfiles = []; SOLO.cloudProfileMessage = 'URLを保存しました。共有プロフィール一覧を更新してください。';
  render();
}
function soloLocalRecords() {
  try { const a=JSON.parse(localStorage.getItem(SOLO.localKey)||'[]'); return Array.isArray(a)?a.filter(x=>x&&typeof x.name==='string'&&SOLO_BOSSES.some(b=>b.id===x.boss)&&Number.isInteger(+x.turns)&&+x.turns>0):[]; }
  catch(e) { return []; }
}
function soloSaveLocalRecord(row) {
  const a=soloLocalRecords();
  a.push({...row, source:'local'});
  a.sort((x,y)=>(+x.turns)-(+y.turns)||String(x.date||'').localeCompare(String(y.date||'')));
  try { localStorage.setItem(SOLO.localKey, JSON.stringify(a.slice(0,300))); } catch(e) {}
}
function soloSubmitSheetRecord(row) {
  const url=soloSheetUrl();
  if(!soloValidSheetUrl(url)||typeof fetch!=='function') return;
  // no-cors + text/plain avoids a browser CORS preflight. Response cannot be read; the sheet is the final source of truth.
  fetch(url, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=UTF-8'}, body:JSON.stringify({action:'submit',name:row.name,boss:row.boss,turns:row.turns})}).catch(()=>{});
}
function soloRequestRemoteRows() {
  const url=soloSheetUrl();
  if(!soloValidSheetUrl(url) || SOLO.remoteLoading || SOLO.remoteUrl===url || typeof document.createElement!=='function' || !document.body || typeof document.body.appendChild!=='function') return;
  SOLO.remoteLoading=true; SOLO.remoteUrl=url;
  const cb='__cgSoloRankCallback';
  window[cb]=data=>{SOLO.remoteLoading=false;SOLO.remoteRows=data&&data.ok&&Array.isArray(data.rows)?data.rows:[];renderSoloRank(false);};
  const s=document.createElement('script');
  s.src=url+(url.includes('?')?'&':'?')+'action=ranking&callback='+cb+'&v='+Date.now();
  s.onerror=()=>{SOLO.remoteLoading=false;SOLO.remoteRows=[];renderSoloRank(false);};
  document.body.appendChild(s);
}

let SOLO_JSONP_SEQ = 0;
function soloJsonp(params, onData, onError) {
  const url = soloSheetUrl();
  if (!soloValidSheetUrl(url) || !document.body || typeof document.body.appendChild !== 'function') {
    if (onError) onError(new Error('Google連携URLが未設定です。'));
    return;
  }
  const cb = '__cgSoloCloudCallback' + (++SOLO_JSONP_SEQ) + '_' + Date.now();
  const query = Object.keys(Object.assign({}, params, {callback: cb}))
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(k === 'callback' ? cb : params[k]))
    .join('&');
  const script = document.createElement('script');
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    try { delete window[cb]; } catch (e) { window[cb] = undefined; }
    if (script.parentNode && script.parentNode.removeChild) script.parentNode.removeChild(script);
  };
  window[cb] = data => { cleanup(); if (onData) onData(data); };
  script.onerror = () => { cleanup(); if (onError) onError(new Error('Googleスプレッドシートから応答がありません。URLと公開設定を確認してください。')); };
  script.src = url + (url.includes('?') ? '&' : '?') + query;
  document.body.appendChild(script);
}
function soloRefreshCloudProfiles(shouldRender=true) {
  if (!soloValidSheetUrl(soloSheetUrl())) {
    SOLO.cloudProfileMessage = '先にGoogle Apps ScriptのURLを設定してください。';
    if (shouldRender) render();
    return;
  }
  if (SOLO.cloudProfilesLoading) return;
  SOLO.cloudProfilesLoading = true;
  SOLO.cloudProfileMessage = '共有プロフィール一覧を読み込んでいます…';
  soloJsonp({action:'profiles'}, data => {
    SOLO.cloudProfilesLoading = false;
    SOLO.cloudProfiles = data && data.ok && Array.isArray(data.rows) ? data.rows.filter(x=>x&&typeof x.name==='string') : [];
    SOLO.cloudProfileMessage = data && data.ok ? `共有プロフィール ${SOLO.cloudProfiles.length} 件` : (data&&data.error||'一覧を読み込めませんでした。');
    if (shouldRender && SCR === 'home') render();
  }, err => {
    SOLO.cloudProfilesLoading = false;
    SOLO.cloudProfileMessage = err.message || '一覧を読み込めませんでした。';
    if (shouldRender && SCR === 'home') render();
  });
}
function soloCloudProfileValid(profile) {
  if (!profile || !Array.isArray(profile.decks) || profile.decks.length !== 2) return false;
  try {
    return !dErr(profile.decks[0]).length && !dErr(profile.decks[1]).length && Array.isArray(profile.hierarchies);
  } catch (e) { return false; }
}
function soloLoadCloudProfile(name) {
  name = String(name || '').trim();
  if (!name) { SOLO.cloudProfileMessage = '読み込むユーザー名を選んでください。'; render(); return; }
  SOLO.cloudProfileMessage = `「${name}」を読み込んでいます…`; render();
  soloJsonp({action:'profile', name}, data => {
    if (!data || !data.ok || !soloCloudProfileValid(data.profile)) {
      SOLO.cloudProfileMessage = data && data.error ? data.error : 'プロフィールのデータが不正です。'; render(); return;
    }
    const profile = data.profile;
    const profileName = cleanName(profile.name);
    const decks = fixDecks(profile.decks);
    const hierarchies = validHiers(profile.hierarchies);
    const list = readProfiles();
    const i = list.findIndex(x=>x.name===profileName);
    if (i >= 0 && JSON.stringify({decks:list[i].decks,hierarchies:validHiers(list[i].hierarchies)}) !== JSON.stringify({decks,hierarchies})) {
      if (!confirm(`この端末の「${profileName}」のデッキを、スプレッドシートの内容で上書きしますか？`)) {
        SOLO.cloudProfileMessage = '読み込みをキャンセルしました。'; render(); return;
      }
    }
    const entry = {name:profileName,decks,hierarchies};
    if (i >= 0) list[i] = entry; else list.push(entry);
    if (!writeProfiles(list)) { SOLO.cloudProfileMessage='この端末にプロフィールを保存できませんでした。'; render(); return; }
    lsSet('cg_cur', profileName);
    DK.d = loadDecks(); DK.cur = 0; DK.hiers = loadHierarchies(); DK.warn = false; PF.msg = '';
    SOLO.cloudProfileMessage = `「${profileName}」のユーザー名・デッキ2つ・階層を読み込みました。`;
    render();
  }, err => { SOLO.cloudProfileMessage = err.message || 'プロフィールを読み込めませんでした。'; render(); });
}
function soloSaveCloudProfile() {
  const url = soloSheetUrl();
  if (!soloValidSheetUrl(url)) { SOLO.cloudProfileMessage = '先にGoogle Apps ScriptのURLを設定してください。'; render(); return; }
  if (!PF.name) { SOLO.cloudProfileMessage = '先にユーザー名を作成または選択してください。'; render(); return; }
  saveDecks();
  const profile = {name:PF.name,decks:DK.d,hierarchies:validHiers(DK.hiers)};
  if (!dErr(profile.decks[0]).length && !dErr(profile.decks[1]).length) {
    // no-cors のPOSTはブラウザから応答本文を読めないため、送信後にJSONPで保存結果を照合します。
    if (typeof fetch !== 'function') { SOLO.cloudProfileMessage='このブラウザは同期に必要な通信機能に対応していません。'; render(); return; }
    SOLO.cloudProfileMessage = 'スプレッドシートへ保存しています…'; render();
    fetch(url, {method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'saveProfile',profile})})
      .then(() => setTimeout(() => soloVerifyCloudProfile(profile, 0), 900))
      .catch(() => { SOLO.cloudProfileMessage='送信に失敗しました。URLと公開設定を確認してください。'; render(); });
  } else { SOLO.cloudProfileMessage='デッキ1・デッキ2を両方15枚にしてから共有保存してください。'; render(); }
}
function soloVerifyCloudProfile(expected, attempt) {
  soloJsonp({action:'profile',name:expected.name}, data => {
    if (data && data.ok && data.profile && soloCloudProfileValid(data.profile)) {
      const actual = {name:cleanName(data.profile.name),decks:fixDecks(data.profile.decks),hierarchies:validHiers(data.profile.hierarchies)};
      const same = actual.name === expected.name && JSON.stringify(actual.decks) === JSON.stringify(expected.decks) && JSON.stringify(actual.hierarchies) === JSON.stringify(expected.hierarchies);
      if (same) {
        SOLO.cloudProfileMessage = `「${expected.name}」のユーザー名・デッキ2つ・階層をスプレッドシートへ保存しました。`;
        soloRefreshCloudProfiles(false);
      } else if (attempt < 2) {
        setTimeout(() => soloVerifyCloudProfile(expected, attempt + 1), 900);
        return;
      } else SOLO.cloudProfileMessage = '保存を確認できませんでした。公開設定・デプロイの更新を確認してください。';
    } else if (attempt < 2) {
      setTimeout(() => soloVerifyCloudProfile(expected, attempt + 1), 900);
      return;
    } else SOLO.cloudProfileMessage = 'スプレッドシートにプロフィールが見つかりません。Apps Scriptのエラーと公開設定を確認してください。';
    if (SCR === 'home') render();
  }, err => {
    if (attempt < 2) { setTimeout(() => soloVerifyCloudProfile(expected, attempt + 1), 900); return; }
    SOLO.cloudProfileMessage = err.message || '保存結果を確認できませんでした。';
    if (SCR === 'home') render();
  });
}
function soloCloudProfilePanelHTML() {
  const url = soloSheetUrl();
  const profiles = Array.isArray(SOLO.cloudProfiles) ? SOLO.cloudProfiles : [];
  const current = PF.name || '';
  return `<section class="pf"><h2>Googleスプレッドシート：ユーザー名・編成の共有</h2>
    <p><small>ここでいう編成は、デッキ1・デッキ2と各デッキの幻想体カード階層です。同じURLを設定した別端末から読み込めます。</small></p>
    <p><label for="soloCloudUrl">Apps Script ウェブアプリURL（末尾 /exec）</label><br><input id="soloCloudUrl" value="${soloEsc(url)}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;box-sizing:border-box"></p>
    <p><button class="sub" onclick="saveSoloSheetUrl(document.getElementById('soloCloudUrl').value)">URLを保存</button>
    <button class="sub" onclick="soloRefreshCloudProfiles(true)" ${SOLO.cloudProfilesLoading?'disabled':''}>共有プロフィール一覧を更新</button></p>
    <p>共有プロフィール：<select id="soloCloudProfileName" style="max-width:100%">${profiles.map(x=>`<option value="${soloEsc(x.name)}"${x.name===current?' selected':''}>${soloEsc(x.name)}${x.updatedAt?'（更新 '+soloEsc(String(x.updatedAt).slice(0,10))+'）':''}</option>`).join('')}</select></p>
    <p><button class="sub" onclick="soloLoadCloudProfile(document.getElementById('soloCloudProfileName').value)" ${profiles.length?'':'disabled'}>選んだプロフィールを読み込む</button>
    <button class="go" onclick="soloSaveCloudProfile()" ${current?'':'disabled'}>現在のユーザー名・編成を共有保存</button></p>
    <p class="msg">${soloEsc(SOLO.cloudProfileMessage || (profiles.length?`共有プロフィール ${profiles.length} 件`:'URLを設定して一覧を更新してください。'))}</p>
    <p class="err"><small>注意：これは公開プロフィール方式で、ログイン認証はありません。共有シートを使える人は他人のユーザー名・編成を上書きできるため、パスワードなどの秘密情報や、保護が必要な名前には使わないでください。</small></p>
  </section>`;
}

function soloBossById(id) { return SOLO_BOSSES.find(x=>x.id===id)||SOLO_BOSSES[0]; }
function soloBaseChar(name,title,hp,spd,passive,at) {
  const base={name,title,slot:0,hp,spd,ps:[PAS[passive]],at:at||[]};
  const c=mkField(base);
  c.abnState = {...(c.abnState||{}), cold:0};
  return c;
}
function soloMakeBossTeam(id) {
  let chars=[];
  if(id==='blood_bath') {
    const boss=soloBaseChar('血の風呂','幻想体',190,[2,5],'solo_blood_desc');
    setupActionSlots(boss,2);
    chars=[boss];
  } else if(id==='yearning_heart') {
    chars=[
      soloBaseChar('熱望する心臓','幻想体',155,[2,5],'solo_heart_desc'),
      soloBaseChar('渇望する肺','幻想体',86,[2,5],'solo_lung_desc'),
      soloBaseChar('渇望する肺','幻想体',86,[2,5],'solo_lung_desc')
    ];
  } else {
    chars=[soloBaseChar('氷の女王','幻想体',210,[3,7],'solo_queen_desc',['ranged'])];
  }
  return chars;
}
function soloCard(name,c,d,opts={}) { return {n:name,c:c,d:d,soloBoss:opts.soloBoss||'',req:opts.req||undefined,on:opts.on,hit:opts.hit,once:opts.once||false}; }
const soloBloodSingle = () => soloCard('血の風呂：衰弱',0,[D('a',4,8,[['rolldn',3]])]);
const soloBloodTriple = () => soloCard('血の風呂：三連撃',0,[D('a',3,6),D('a',3,6),D('a',3,6)],{soloBoss:'blood_all_three'});
const soloBloodGuard = () => soloCard('血の風呂：三重防御',0,[D('d',3,7),D('d',3,7),D('d',3,7)]);
const soloHeartAttack = () => soloCard('心臓：鼓舞の一撃',0,[D('a',4,7)],{soloBoss:'heart_buff'});
const soloHeartGuard = () => soloCard('心臓：弱い防御',0,[D('d',2,5)]);
const soloLungAttack = () => soloCard('肺：渇望の三連撃',0,[D('a',2,5),D('a',2,5),D('a',2,5)]);
const soloQueenCard = turn => turn%3===0
  ? soloCard('氷の女王：氷の連射',2,[D('a',3,8,[['rupt',1]]),D('a',3,8),D('a',3,8)],{req:'ranged',soloBoss:'queen_cold'})
  : soloCard('氷の女王：凍てつく射撃',1,[D('a',4,10,[['rolldn',1]])],{req:'ranged',soloBoss:'queen_cold'});
function soloPlanEnemy() {
  if(!SOLO.active||!S||S.phase!=='decide')return;
  const enemy=S.p[1], targets=S.p[0].chars.map((c,i)=>({c,i})).filter(x=>x.c.alive);
  if(!targets.length)return;
  const chooseTarget=()=>{
    if(SOLO.bossId==='ice_queen') {
      const cold=targets.slice().sort((a,b)=>(b.c.st.cold||0)-(a.c.st.cold||0)||a.c.hp-b.c.hp);
      return cold[0].i;
    }
    return targets.slice().sort((a,b)=>a.c.hp-b.c.hp)[0].i;
  };
  enemy.chars.forEach((c,ci)=>{
    if(!c.alive)return;
    const slotCount=actionStates(c).length||1;
    for(let slot=0;slot<slotCount;slot++) {
      setActionSlot(c,slot);
      let card;
      if(SOLO.bossId==='blood_bath') {
        if(slot===0) card=soloBloodSingle();
        else card=S.turn%3===0?soloBloodGuard():soloBloodTriple();
      } else if(SOLO.bossId==='yearning_heart') {
        if(c.name==='熱望する心臓')card=S.turn%3===0?soloHeartGuard():soloHeartAttack();
        else card=soloLungAttack();
      } else card=soloQueenCard(S.turn);
      c.card=card;c.tgt=chooseTarget();c.used=false;c.hitFired=[];c.stock=null;c.redirBy=null;c.tgt0=null;
      if(!c._soloHitCounts)c._soloHitCounts={};c._soloHitCounts[slot]=0;
    }
    setActionSlot(c,0);
  });
  enemy.cost=enemy.max=6;
}

function startSoloBattle(id) {
  if(NET.on) { PF.msg='幻想体戦はオンライン対戦を終了してから開始してください。'; render(); return; }
  if(!PF.name) { PF.msg='先にホームでプレイヤー名を作成してください。'; SCR='home'; render(); return; }
  if(dErr(DK.d[DK.cur]).length) { alert('使用するデッキを完成させてください。'); SCR='deck'; render(); return; }
  SOLO.active=true;SOLO.bossId=soloBossById(id).id;SOLO.turns=0;
  const boss=soloBossById(SOLO.bossId);
  S={turn:0,p:[newP(PF.name,DK.d[DK.cur],DK.hiers[DK.cur]),newP(boss.name,{},DK.hiers[DK.cur])],over:null,phase:'setup',sp:0,pick:[],cover:null,msg:'',log:[],order:[0,1],stage:0,leave:false,solo:true};
  S.p[1].chars=soloMakeBossTeam(SOLO.bossId);S.p[1].cost=S.p[1].max=6;
  SCR='match';render();
}

// 既存の準備確定をソロ用に置き換える。プレイヤー側の setup / draw / passive 初期化は既存処理を使う。
const __soloOriginalConfirmSetup=confirmSetup;
confirmSetup=function(){
  if(!SOLO.active||!S||S.phase!=='setup')return __soloOriginalConfirmSetup();
  if(!S.pick.length){S.msg='キャラカードを1枚以上選んでください';render();return;}
  applySetup(0,S.pick);S.pick=[];S.msg='';S.sp=0;
  if(SOLO.bossId==='ice_queen') {
    const allies=S.p[0].chars,center=Math.floor(allies.length/2);
    allies.forEach((c,i)=>{if(!c.abnState)c.abnState={};if(i!==center){c.abnState.iceLocked=true;c.abnState.skipThisTurn=true;}});
    L('氷の女王：中央以外の味方が凍結した。女王を倒すと解放される。');
  }
  startTurn();
};

// ソロ戦ではプレイヤーが先に行動を決め、その後に敵AIが決定して既存combat()に渡します。
const __soloOriginalStartTurn=startTurn;
startTurn=function(){
  if(SOLO.active&&S&&S.p&&S.p[1]) {
    S.p[1].chars.forEach(c=>{if(c.abnState&&c.abnState.iceLocked&&SOLO.bossId==='ice_queen'&&S.p[1].chars.some(z=>z.name==='氷の女王'&&z.alive))c.abnState.skipThisTurn=true;});
  }
  __soloOriginalStartTurn();
  if(SOLO.active&&S&&S.phase==='decide') {
    S.order=[0,1];S.stage=0;S.cover=null;
    if(SOLO.bossId==='ice_queen') {
      S.p[0].chars.forEach(c=>{
        if(!c.alive)return;
        const n=c.st.cold||0;
        if(n>=4){c.sp-=1;c.bf.rolldn=(c.bf.rolldn||0)+2;L(`寒気${n}：${c.name}は速度-1、ダイス値-2`);}
        if(n>=6){c.abnState.skipThisTurn=true;c.st.cold=0;L(`${c.name}は寒気6以上で行動不能。寒気をすべて失った。`);}
        if(c.abnState&&c.abnState.iceLocked&&S.p[1].chars.some(z=>z.name==='氷の女王'&&z.alive))c.abnState.skipThisTurn=true;
      });
    }
    render();
  }
};
const __soloOriginalDone=done;
done=function(){
  if(!SOLO.active||!S||S.phase!=='decide')return __soloOriginalDone();
  if(act()===0){
    __soloOriginalDone();
    if(S&&S.phase==='decide'&&act()===1){soloPlanEnemy();S.msg='';__soloOriginalDone();}
    return;
  }
  // AI側の決定は soloPlanEnemy → __soloOriginalDone のみを通す
  if(act()===1&&S._soloAiCommitting)return __soloOriginalDone();
};

// 戦闘エンジンの命中処理をラップし、ボス専用の的中ギミックだけを追加。
const __soloOriginalHit=hit;
hit=function(pa,pb,B,dmg,A,die){
  const before=B&&B.hp;
  __soloOriginalHit(pa,pb,B,dmg,A,die);
  if(!SOLO.active||!S||!A||!B||!(B.hp<before))return;
  const card=A.card||{};
  if(SOLO.bossId==='blood_bath'&&A.name==='血の風呂'&&card.soloBoss==='blood_all_three') {
    const slot=A._actionSlot||0;if(!A._soloHitCounts)A._soloHitCounts={};A._soloHitCounts[slot]=(A._soloHitCounts[slot]||0)+1;
    if(A._soloHitCounts[slot]>=3&&B.alive){if(!B.abnState)B.abnState={};B.abnState.skipNextTurn=true;L(`${B.name}は血の風呂の三連撃をすべて受け、次のターン行動不能になる。`);A._soloHitCounts[slot]=0;}
  }
  if(SOLO.bossId==='yearning_heart'&&A.name==='熱望する心臓'&&card.soloBoss==='heart_buff') {
    S.p[1].chars.filter(c=>c!==A&&c.alive).forEach(c=>{c.nx.roll=(c.nx.roll||0)+2;});
    L('熱望する心臓の一撃が命中。ほかの生存する敵の次ターンのダイス値+2。');
  }
  if(SOLO.bossId==='ice_queen'&&A.name==='氷の女王') {
    B.st.cold=(B.st.cold||0)+1;
    L(`${B.name}に寒気+1（現在${B.st.cold}）。`);
  }
};

const __soloOriginalCombat=combat;
combat=function(){
  __soloOriginalCombat();
  if(!SOLO.active||!S)return;
  // ソロ戦は連続アニメーションより、ギミック適用後の最終状態をすぐ確認できる表示を優先。
  if(S.anim){clearTimeout(S.anim.t);S.anim=null;}
  // 敵は幻想体カードの選択を行わないため、感情レベルの報酬は無効化します。
  if(S.p[1]){S.p[1].pendingAbn=false;S.p[1].abnOffers=[];S.p[1].abnSelected=null;S.p[1].coin=0;S.p[1].cost=S.p[1].max=6;}
  if(SOLO.bossId==='ice_queen') {
    S.p[0].chars.forEach(c=>{if(c.st&&c.st.cold>0)c.st.cold=Math.max(0,c.st.cold-1);});
    const queen=S.p[1].chars.find(c=>c.name==='氷の女王');
    if(queen&&!queen.alive) {
      S.p[0].chars.forEach(c=>{if(c.abnState&&c.abnState.iceLocked){c.abnState.iceLocked=false;c.abnState.skipThisTurn=false;c.abnState.skipNextTurn=false;c.st.cold=0;c.hp=Math.max(1,Math.ceil(c.max*0.75));c.alive=true;L(`${c.name}は氷から解放され、HP75%で復帰した。`);}});
      L('氷の女王を撃破。凍結していた味方が解放された。');
      if(alive(S.p[0])>0)S.over=`${S.p[0].name}の勝利、おめ`;
    }
  }
  const alivePlayer=alive(S.p[0])>0,aliveBoss=alive(S.p[1])>0;
  if(!aliveBoss&&alivePlayer&&S.over&&String(S.over).includes('勝利')) {
    const row={name:PF.name||S.p[0].name,boss:SOLO.bossId,turns:Math.max(1,S.turn),date:new Date().toISOString()};
    const prior=soloLocalRecords().some(x=>x.boss===row.boss&&x.name===row.name&&+x.turns===row.turns&&x.date===row.date);
    if(!prior){soloSaveLocalRecord(row);soloSubmitSheetRecord(row);}
    SOLO.turns=row.turns;
    S.soloRecordSaved=true;
  }
  render();
};

// 凍結中の味方へカードを割り当てない。
const __soloOriginalMine=mine;
mine=function(ci){
  const c=SOLO.active&&S&&S.p[0].chars[ci];
  if(c&&c.abnState&&c.abnState.iceLocked){S.msg=`${c.name}は氷漬けで行動できません。氷の女王を倒してください。`;render();return;}
  return __soloOriginalMine(ci);
};

const __soloOriginalRenderHome=renderHome;
renderHome=function(){
  __soloOriginalRenderHome();
  if(!document.getElementById('app'))return;
  const app=document.getElementById('app');
  app.innerHTML=app.innerHTML.replace('<p><button class="go" onclick="SCR=\'rules\';render()">ルール説明</button></p>', '<p><button class="go" onclick="SCR=\'solo\';render()">幻想体戦（ソロ）</button></p><p><button class="go" onclick="SCR=\'rules\';render()">ルール説明</button></p>');
  app.innerHTML=app.innerHTML.replace(/<\/div>\s*$/, soloCloudProfilePanelHTML() + '</div>');
};

function renderSoloMenu(){
  const currentDeck=DK.d[DK.cur]||{};
  const errors=dErr(currentDeck);
  const url=soloSheetUrl();
  document.getElementById('stat').innerHTML='<button class="sub" onclick="toHome()">ホームへ戻る</button>';
  document.getElementById('app').innerHTML=`<div class="home"><h1>幻想体戦</h1><p>ソロ用のボス戦です。ホームのプレイヤー名と、デッキ構築で選択中のデッキ${DK.cur+1}を使います。</p>
    ${!PF.name?'<p class="err">先にホームでプレイヤー名を作成してください。</p>':''}
    ${errors.length?`<p class="err">使用中デッキが未完成：${errors.map(soloEsc).join('、')}</p>`:''}
    <div class="pf"><h2>ボスを選ぶ</h2>${SOLO_BOSSES.map(b=>`<section style="border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0"><b>${soloEsc(b.name)}</b><p>${soloEsc(b.summary)}</p><button class="go" ${(!PF.name||errors.length)?'disabled':''} onclick="startSoloBattle('${b.id}')">挑戦する</button></section>`).join('')}</div>
    <div class="pf"><h2>Googleスプレッドシート連携</h2><p><small>Apps Scriptをウェブアプリとして公開したURL（末尾が /exec）を入力すると、討伐記録を共有ランキングへ送信できます。</small></p>
    <input id="soloSheetUrl" value="${soloEsc(url)}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;box-sizing:border-box">
    <p><button class="sub" onclick="saveSoloSheetUrl(document.getElementById('soloSheetUrl').value)">URLを保存</button> <button class="sub" onclick="SCR='soloRank';render()">ランキングを見る</button></p>
    <p class="msg">${soloValidSheetUrl(url)?'URL形式：OK':'未設定の場合も、このブラウザ内には記録されます。'}</p></div>
  </div>`;
}
function renderSoloRank(triggerLoad=true){
  const local=soloLocalRecords(),remote=Array.isArray(SOLO.remoteRows)?SOLO.remoteRows:[];
  document.getElementById('stat').innerHTML='<button class="sub" onclick="SCR=\'solo\';render()">幻想体戦へ戻る</button> <button class="sub" onclick="toHome()">ホームへ戻る</button>';
  const tables=SOLO_BOSSES.map(b=>{
    const loc=local.filter(r=>r.boss===b.id).sort((x,y)=>(+x.turns)-(+y.turns)||String(x.date||'').localeCompare(String(y.date||''))).slice(0,10);
    const rem=remote.filter(r=>r.boss===b.id).sort((x,y)=>(+x.turns)-(+y.turns)||String(x.date||'').localeCompare(String(y.date||''))).slice(0,10);
    const table=(rows,empty)=>rows.length?`<table style="width:100%;border-collapse:collapse"><thead><tr><th>位</th><th>名前</th><th>ターン</th><th>日時</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${soloEsc(r.name)}</td><td>${soloEsc(r.turns)}</td><td>${soloEsc(String(r.date||'').slice(0,10))}</td></tr>`).join('')}</tbody></table>`:`<p class="msg">${empty}</p>`;
    return `<section class="pf"><h2>${soloEsc(b.name)}</h2><h3>このブラウザの記録</h3>${table(loc,'まだ記録がありません。')}<h3>Googleスプレッドシートの共有記録</h3>${table(rem,soloValidSheetUrl(soloSheetUrl())?(SOLO.remoteLoading?'読み込み中…':'共有記録を取得できません。URLと公開設定を確認してください。'):'連携URLが未設定です。')}</section>`;
  }).join('');
  document.getElementById('app').innerHTML=`<div class="home"><h1>幻想体戦ランキング</h1><p><small>討伐ターン数が少ない順です。ブラウザ内記録は端末ごと、共有記録はGoogleスプレッドシートから取得します。</small></p>${tables}<p><button class="sub" onclick="SCR='solo';render()">幻想体戦へ戻る</button></p></div>`;
  if(triggerLoad)soloRequestRemoteRows();
}
const __soloOriginalRender=render;
render=function(){
  if(SCR==='solo'){document.body.className='';renderSoloMenu();return;}
  if(SCR==='soloRank'){document.body.className='';renderSoloRank(true);return;}
  return __soloOriginalRender();
};
const __soloOriginalRenderMatch=renderMatch;
renderMatch=function(){
  __soloOriginalRenderMatch();
  if(!SOLO.active||!S||S.phase!=='result')return;
  const app=document.getElementById('app');if(!app)return;
  app.innerHTML=app.innerHTML.replace('<button class="go" onclick="startMatch()">同じデッキでもう一度</button>',`<button class="go" onclick="startSoloBattle('${SOLO.bossId}')">もう一度挑戦</button>`);
  app.innerHTML=app.innerHTML.replace('<button class="sub" onclick="toHome()">ホームへ戻る</button>', '<button class="sub" onclick="SCR=\'solo\';S=null;SOLO.active=false;render()">幻想体選択へ</button> <button class="sub" onclick="toHome()">ホームへ戻る</button>');
  if(S.soloRecordSaved)app.innerHTML=app.innerHTML.replace('</h1>',`</h1><p class="msg">${soloEsc(soloBossById(SOLO.bossId).name)}を${SOLO.turns}ターンで討伐しました。ランキングに記録しました。</p>`);
};
