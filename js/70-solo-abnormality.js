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
  sheetKey: 'cg_solo_sheet_endpoint',
  cloudProfiles: [],
  cloudProfilesLoading: false,
  cloudProfileMessage: '',
  recordStatus: ''
};
const SOLO_BOSSES = [
  {id:'blood_bath', name:'血の風呂', floor:'総記の階', summary:'2回行動。ダイス値低下、3連撃による行動不能、3ダイス防御を使う。'},
  {id:'yearning_heart', name:'熱望する心臓', floor:'総記の階', summary:'心臓の命中で渇望する肺を強化。肺は3ダイス攻撃を行う。'},
  {id:'ice_queen', name:'氷の女王', floor:'総記の階', summary:'中央以外の味方が凍結。寒気を蓄積させ、女王を倒すと解放。'},
  {id:'burning_girl', name:'燃え尽きた少女', floor:'歴史の階', summary:'2体の「最後のマッチの火」を倒すと本体のHPが半減。5ターン目に自爆ページを使う。'},
  {id:'happy_teddy', name:'幸せなテディ', floor:'歴史の階', summary:'速度10固定・2回行動・コスト最大値2。マッチごとに「懐かしいあの日の抱擁」のコストが下がる。'},
  {id:'fairy_festival', name:'妖精の祭典', floor:'歴史の階', summary:'女王妖精と2体の妖精の塊。塊を捕食するたび女王が強化される。女王撃破で勝利。'},
  {id:'queen_bee', name:'女王蜂', floor:'歴史の階', summary:'働き蜂が胞子を付与し、胞子を持つキャラが死亡すると働き蜂が増える。女王蜂撃破で勝利。'}
];

// パッシブ欄の説明専用表示。PKには説明文だけを置き、ギミックの処理自体は下の専用ロジックが担当。
Object.assign(PAS, {
  solo_blood_desc: {n:'血の風呂のギミック', k:'solo_blood_desc'},
  solo_heart_desc: {n:'熱望する心臓のギミック', k:'solo_heart_desc'},
  solo_lung_desc: {n:'渇望する肺のギミック', k:'solo_lung_desc'},
  solo_queen_desc: {n:'氷の女王のギミック', k:'solo_queen_desc'},
  solo_burning_desc: {n:'燃え尽きた少女のギミック', k:'solo_burning_desc'},
  solo_match_desc: {n:'最後のマッチの火のギミック', k:'solo_match_desc'},
  solo_teddy_desc: {n:'幸せなテディのギミック', k:'solo_teddy_desc'},
  solo_fairy_queen_desc: {n:'女王妖精のギミック', k:'solo_fairy_queen_desc'},
  solo_fairy_lump_desc: {n:'妖精の塊のギミック', k:'solo_fairy_lump_desc'},
  solo_bee_queen_desc: {n:'女王蜂のギミック', k:'solo_bee_queen_desc'},
  solo_worker_bee_desc: {n:'働き蜂のギミック', k:'solo_worker_bee_desc'}
});
Object.assign(PK, {
  solo_blood_desc: {t:()=> '行動権2。単ダイス命中時に対象の次ターンのダイス値-3。3ダイス攻撃の全ダイスが命中すると対象は次ターン行動不能。3ダイス防御も使用する。'},
  solo_heart_desc: {t:()=> '単ダイス攻撃が命中すると、ほかの生存する味方の次ターンのダイス値+2。弱い防御ページも使用する。'},
  solo_lung_desc: {t:()=> '3ダイス攻撃を使用する。心臓の強化が重なるとダイス値が上がる。'},
  solo_queen_desc: {t:()=> '戦闘開始時、中央の味方以外を凍結。女王を倒すと凍結した味方はHP75%で解放される。攻撃命中で寒気+1。寒気はターン終了時-1、ターン開始時4以上なら速度-1・ダイス値-2、6以上なら1ターン行動不能になり寒気をすべて失う。'},
  solo_burning_desc: {t:()=> '4ターンは行動せず、5ターン目に「4本目のマッチの火」を使用して自滅する。最後のマッチの火が倒されるたび、現在HPが半分になる。'},
  solo_match_desc: {t:()=> '回避ダイスを使う。攻撃ページ使用時、自身のHPを少し失う。倒されると燃え尽きた少女の現在HPが半分になる。'},
  solo_teddy_desc: {t:()=> '速度10固定、行動権2、コスト最大値2。マッチが発生するたび「懐かしいあの日の抱擁」のコストが1下がる。'},
  solo_fairy_queen_desc: {t:()=> '3ダイス防御と出血を付与する3ダイス攻撃を使用。毎ターン妖精の塊1体に用意された肉を付与し、HP1なら捕食して回復・被ダメージ+10。ほかに敵がいない間はダイス値+30。死亡すると勝利。'},
  solo_fairy_lump_desc: {t:()=> '低威力の出血攻撃を使う。女王妖精が生存中はHPが1未満にならず、用意された肉がありHP1ならターン終了時に捕食される。'},
  solo_bee_queen_desc: {t:()=> '3ダイスの防御ページのみを使用。HPが25%未満になると働き蜂は女王蜂を攻撃する。死亡すると勝利。'},
  solo_worker_bee_desc: {t:()=> '胞子を付与する3ダイス攻撃、または女王蜂を回復する低威力攻撃を使う。胞子はターン終了時に数値分のダメージを与えて半減し、胞子を持つ対象が死亡すると働き蜂が増える。'}
});

// 寒気は通常の状態異常とは別管理にし、画面表示だけ既存の状態異常欄へ載せます。
STN.cold = {n:'寒気', i:'❄', c:'#8bd5f5', t:'ターン終了時-1。ターン開始時4以上で速度-1・ダイス値-2、6以上で1ターン行動不能になり寒気をすべて失う。'};
STN.spore = {n:'胞子', i:'🍄', c:'#b69aff', t:'ターン終了時に数値分のダメージを受け、値が半減する。胞子を持って死亡すると女王蜂側に働き蜂が生成される。'};

const soloEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Google Apps Script URL is built into the game; no manual URL entry is needed.
const SOLO_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwX66N5uX1cIyFPUWzXgVejb3ybAKsYwubW-sgRqigENv1ep2EOvRv_0wXr8TmCZqI/exec';
const soloSheetUrl = () => SOLO_SCRIPT_URL;
// 標準URLに加えて、Google Workspace配下やログインアカウント番号付きURLも受け付ける。
const soloNormalizeSheetUrl = v => String(v||'').trim().replace(/\/exec\/(?=[?#]|$)/, '/exec');
const soloValidSheetUrl = u => {
  const v = soloNormalizeSheetUrl(u);
  return /^https:\/\/script\.google\.com\/(?:macros\/(?:u\/\d+\/)?s\/[^/?#]+\/exec|a\/macros\/[^/?#]+\/s\/[^/?#]+\/exec)(?:\?[^#]*)?(?:#.*)?$/.test(v);
};
function saveSoloSheetUrl(v, doRender=true) {
  const u = soloNormalizeSheetUrl(v);
  if (!soloValidSheetUrl(u)) {
    SOLO.cloudProfileMessage = 'URLを認識できません。デプロイ画面の「ウェブアプリ URL」（https://script.google.com/macros/s/.../exec）をコピーしてください。';
    if (doRender) render();
    return false;
  }
  if (u !== SOLO_SCRIPT_URL) {
    SOLO.cloudProfileMessage = '連携URLはゲーム本体に組み込まれているため、画面から変更できません。';
    if (doRender) render();
    return false;
  }
  SOLO.remoteRows = null; SOLO.remoteLoading = false; SOLO.remoteUrl = '';
  SOLO.cloudProfiles = []; SOLO.cloudProfileMessage = 'Google Apps Scriptの連携先はゲーム本体に設定済みです。';
  if (doRender) render();
  return true;
}
// 入力欄へURLを貼り付けた後、「一覧を更新」「共有保存」を押した場合も自動で保存する。
function soloCaptureSheetUrlFromInput() {
  const input = document.getElementById('soloCloudUrl') || document.getElementById('soloSheetUrl');
  if (!input || !String(input.value||'').trim()) return soloValidSheetUrl(soloSheetUrl());
  const value = soloNormalizeSheetUrl(input.value);
  if (value === soloSheetUrl()) return soloValidSheetUrl(value);
  return saveSoloSheetUrl(value, false);
}
function soloRequestRemoteRows() {
  const url=soloSheetUrl();
  if(!soloValidSheetUrl(url) || SOLO.remoteLoading) return;
  SOLO.remoteLoading=true; SOLO.remoteUrl=url;
  soloJsonp({action:'ranking'}, data=>{
    SOLO.remoteLoading=false;
    SOLO.remoteRows=data&&data.ok&&Array.isArray(data.rows)?data.rows:[];
    SOLO.cloudProfileMessage=data&&data.ok?'':(data&&data.error||'ランキングの取得に失敗しました。');
    renderSoloRank(false);
  }, err=>{
    SOLO.remoteLoading=false;SOLO.remoteRows=[];SOLO.cloudProfileMessage=err.message||'ランキングを取得できませんでした。';
    renderSoloRank(false);
  });
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
  script.async = true;
  let finished = false;
  let timeoutId = null;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
    try { delete window[cb]; } catch (e) { window[cb] = undefined; }
    if (script.parentNode && script.parentNode.removeChild) script.parentNode.removeChild(script);
  };
  window[cb] = data => { cleanup(); if (onData) onData(data); };
  script.onerror = () => {
    cleanup();
    if (onError) onError(new Error('Google Apps Scriptの読み込みに失敗しました。ウェブアプリURL（/exec）と公開設定を確認してください。'));
  };
  // Googleのログイン画面へ転送された場合など、script.onerror もJSONP callbackも呼ばれず
  // 読み込み表示が永遠に残ることがあるため、必ずタイムアウトさせる。
  timeoutId = setTimeout(() => {
    cleanup();
    if (onError) onError(new Error('Apps Scriptから15秒以内に応答がありませんでした。/exec URLを使い、デプロイを最新バージョンに更新し、「アクセスできるユーザー」を「全員」に設定してください。Googleアカウントのログイン画面が出る設定では共有できません。'));
  }, 15000);
  script.src = url + (url.includes('?') ? '&' : '?') + query;
  document.body.appendChild(script);
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
    const boss=soloBaseChar('血の風呂','幻想体',190,[2,5],'solo_blood_desc'); setupActionSlots(boss,2); chars=[boss];
  } else if(id==='yearning_heart') {
    chars=[soloBaseChar('熱望する心臓','幻想体',155,[2,5],'solo_heart_desc'),soloBaseChar('渇望する肺','幻想体',86,[2,5],'solo_lung_desc'),soloBaseChar('渇望する肺','幻想体',86,[2,5],'solo_lung_desc')];
  } else if(id==='ice_queen') {
    chars=[soloBaseChar('氷の女王','幻想体',210,[3,7],'solo_queen_desc',['ranged'])];
  } else if(id==='burning_girl') {
    chars=[soloBaseChar('燃え尽きた少女','幻想体',300,[1,4],'solo_burning_desc'),soloBaseChar('最後のマッチの火','幻想体',38,[3,8],'solo_match_desc'),soloBaseChar('最後のマッチの火','幻想体',38,[3,8],'solo_match_desc')];
  } else if(id==='happy_teddy') {
    const teddy=soloBaseChar('幸せなテディ','幻想体',165,[10,10],'solo_teddy_desc');setupActionSlots(teddy,2);teddy.abnState.hugCost=5;teddy.abnState.hugSpent=false;chars=[teddy];
  } else if(id==='fairy_festival') {
    chars=[soloBaseChar('女王妖精','幻想体',275,[3,6],'solo_fairy_queen_desc'),soloBaseChar('妖精の塊','幻想体',32,[2,5],'solo_fairy_lump_desc'),soloBaseChar('妖精の塊','幻想体',32,[2,5],'solo_fairy_lump_desc')];
  } else if(id==='queen_bee') {
    chars=[soloBaseChar('女王蜂','幻想体',300,[3,6],'solo_bee_queen_desc'),soloBaseChar('働き蜂','幻想体',105,[2,5],'solo_worker_bee_desc'),soloBaseChar('働き蜂','幻想体',105,[2,5],'solo_worker_bee_desc')];
    chars[0].abnState.beeAttackedThisTurn=[];chars[0].abnState.beeAttackedLastTurn=[];
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
const soloBurnGirlSuicide=()=>soloCard('4本目のマッチの火',0,[D('a',8,12),D('a',8,12)],{soloBoss:'burn_self_destruct'});
const soloMatchFireAttack=()=>soloCard('最後のマッチの火：火を投げる',0,[D('a',3,6)],{soloBoss:'match_fire_self_cost'});
const soloMatchFireEvade=()=>soloCard('最後のマッチの火：身をかわす',0,[D('e',7,12)]);
const soloTeddyLight=slot=>soloCard(slot===0?'テディ：小さな一撃':'テディ：じゃれつき',0,[D('a',2,5),D('a',1,4)]);
const soloTeddyHug=cost=>soloCard('懐かしいあの日の抱擁',Math.max(0,cost),[D('a',8,13),D('a',10,16,[['bleed',4]])],{soloBoss:'teddy_hug'});
const soloFairyQueenCard=turn=>turn%2===0
  ? soloCard('女王妖精：三連撃',0,[D('a',4,8,[['bleed',2]]),D('a',4,8,[['bleed',2]]),D('a',4,9,[['bleed',2]])])
  : soloCard('女王妖精：三重守護',0,[D('d',4,8),D('d',4,8),D('d',5,9)]);
const soloFairyLumpCard=()=>soloCard('妖精の塊：小さな爪',0,[D('a',2,5,[['bleed',1]]),D('a',2,5,[['bleed',1]])]);
const soloBeeQueenCard=()=>soloCard('女王蜂：防御陣形',0,[D('d',4,7),D('d',4,7),D('d',4,8)]);
const soloWorkerSpore=()=>soloCard('働き蜂：胞子の連撃',0,[D('a',3,6),D('a',3,6),D('a',3,6)],{soloBoss:'bee_spore'});
const soloWorkerHeal=()=>soloCard('働き蜂：女王への献身',0,[D('a',1,3),D('a',1,3)],{soloBoss:'bee_heal'});
function soloPlanEnemy() {
  if(!SOLO.active||!S||S.phase!=='decide')return;
  const enemy=S.p[1], targets=S.p[0].chars.map((c,i)=>({c,i})).filter(x=>x.c.alive);
  if(!targets.length)return;
  let beeFocus=null;
  if(SOLO.bossId==='queen_bee'){
    const queen=enemy.chars.find(c=>c.name==='女王蜂');
    if(queen&&queen.alive&&queen.hp>=queen.max*0.25){
      const last=(queen.abnState&&queen.abnState.beeAttackedLastTurn||[]).filter(z=>z&&z.alive&&S.p[0].chars.includes(z));
      if(last.length)beeFocus=last[Math.floor(rnd()*last.length)];
    }
  }
  const chooseTarget=(c)=>{
    if(SOLO.bossId==='ice_queen') {
      const cold=targets.slice().sort((a,b)=>(b.c.st.cold||0)-(a.c.st.cold||0)||a.c.hp-b.c.hp);return cold[0].i;
    }
    if(SOLO.bossId==='queen_bee'&&c.name==='働き蜂') {
      const queen=enemy.chars.find(z=>z.name==='女王蜂');
      if(queen&&queen.alive&&queen.hp<queen.max*0.25){c.abnState.targetQueen=true;return enemy.chars.indexOf(queen)}
      c.abnState.targetQueen=false;
      if(beeFocus)return S.p[0].chars.indexOf(beeFocus);
    }
    return targets.slice().sort((a,b)=>a.c.hp-b.c.hp)[0].i;
  };
  enemy.chars.forEach((c,ci)=>{
    if(!c.alive)return;
    const slotCount=actionStates(c).length||1;
    for(let slot=0;slot<slotCount;slot++) {
      setActionSlot(c,slot);
      let card=null;
      if(SOLO.bossId==='blood_bath') card=slot===0?soloBloodSingle():(S.turn%3===0?soloBloodGuard():soloBloodTriple());
      else if(SOLO.bossId==='yearning_heart') card=c.name==='熱望する心臓'?(S.turn%3===0?soloHeartGuard():soloHeartAttack()):soloLungAttack();
      else if(SOLO.bossId==='ice_queen') card=soloQueenCard(S.turn);
      else if(SOLO.bossId==='burning_girl') {
        if(c.name==='燃え尽きた少女')card=S.turn>=5?soloBurnGirlSuicide():null;
        else card=S.turn%2===1?soloMatchFireAttack():soloMatchFireEvade();
      } else if(SOLO.bossId==='happy_teddy') {
        const hugCost=c.abnState.hugCost==null?5:c.abnState.hugCost;
        card=slot===0&&!c.abnState.hugSpent&&hugCost<=2?soloTeddyHug(hugCost):soloTeddyLight(slot);
      } else if(SOLO.bossId==='fairy_festival') card=c.name==='女王妖精'?soloFairyQueenCard(S.turn):soloFairyLumpCard();
      else if(SOLO.bossId==='queen_bee') {
        if(c.name==='女王蜂')card=soloBeeQueenCard();
        else card=S.turn%3===0?soloWorkerHeal():soloWorkerSpore();
      }
      c.card=card;c.tgt=card?chooseTarget(c):null;c.used=false;c.hitFired=[];c.stock=null;c.redirBy=null;c.tgt0=null;
      if(!c._soloHitCounts)c._soloHitCounts={};c._soloHitCounts[slot]=0;
    }
    setActionSlot(c,0);
  });
  if(SOLO.bossId==='happy_teddy'){enemy.max=2;enemy.cost=2;}
  else {enemy.cost=enemy.max=6;}
}

function startSoloBattle(id) {
  if(NET.on) { PF.msg='幻想体戦はオンライン対戦を終了してから開始してください。'; render(); return; }
  if(typeof SOLO_ACCOUNT==='undefined'||SOLO_ACCOUNT.mode!=='account'||!SOLO_ACCOUNT.token||!SOLO_ACCOUNT.userName) { SOLO.cloudProfileMessage='幻想体戦と共有ランキングを使うには、アカウントモードでログインしてください。'; SCR='home'; render(); return; }
  if(!PF.name) { PF.msg='アカウント情報が読み込まれていません。再ログインしてください。'; SCR='home'; render(); return; }
  if(dErr(DK.d[DK.cur]).length) { alert('使用するデッキを完成させてください。'); SCR='deck'; render(); return; }
  SOLO.active=true;SOLO.bossId=soloBossById(id).id;SOLO.turns=0;SOLO.recordStatus='';
  const boss=soloBossById(SOLO.bossId);
  S={turn:0,p:[newP(PF.name,DK.d[DK.cur],DK.hiers[DK.cur]),newP(boss.name,{},boss.floor||DK.hiers[DK.cur])],over:null,phase:'setup',sp:0,pick:[],cover:null,msg:'',log:[],order:[0,1],stage:0,leave:false,solo:true};
  S.p[1].chars=soloMakeBossTeam(SOLO.bossId);S.p[1].cost=S.p[1].max=SOLO.bossId==='happy_teddy'?2:6;
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

// ソロ戦では敵AIが先に行動を決め、速度に関係なくプレイヤーが後から行動を決定します。
const __soloOriginalStartTurn=startTurn;
startTurn=function(){
  if(SOLO.active&&S&&S.p&&S.p[1]) {
    if(SOLO.bossId==='queen_bee'){
      const q=S.p[1].chars.find(c=>c.name==='女王蜂');
      if(q&&q.abnState){q.abnState.beeAttackedLastTurn=[...(q.abnState.beeAttackedThisTurn||[])];q.abnState.beeAttackedThisTurn=[];}
    }
    S.p[1].chars.forEach(c=>{if(c.abnState&&c.abnState.iceLocked&&SOLO.bossId==='ice_queen'&&S.p[1].chars.some(z=>z.name==='氷の女王'&&z.alive))c.abnState.skipThisTurn=true;});
  }
  __soloOriginalStartTurn();
  if(SOLO.active&&S&&S.phase==='decide') {
    S.order=[1,0];S.stage=0;S.cover=null;
    // 敵側の行動を先に自動決定。stage=1にしてプレイヤーの決定画面へ移る。
    soloPlanEnemy();S.stage=1;S.cover=null;
    if(SOLO.bossId==='fairy_festival'){
      const queen=S.p[1].chars.find(c=>c.name==='女王妖精');
      S.p[1].chars.filter(c=>c.name==='妖精の塊').forEach(c=>{if(c.abnState)delete c.abnState.preparedMeatTurn;});
      const lumps=S.p[1].chars.filter(c=>c.name==='妖精の塊'&&c.alive);
      if(queen&&queen.alive&&lumps.length){const target=lumps[Math.floor(rnd()*lumps.length)];if(!target.abnState)target.abnState={};target.abnState.preparedMeatTurn=S.turn;L(`女王妖精は${target.name}に「用意された肉」を付与した。`);}
    }
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
  // 通常は敵AIの行動がすでに割り当てられ、プレイヤー（order[1]）が決定中。
  if(S.stage===1&&act()===0)return __soloOriginalDone();
  // 予期せず敵側の決定画面に戻った場合も、敵AIを自動決定してプレイヤーへ渡す。
  if(S.stage===0&&act()===1){soloPlanEnemy();S.stage=1;S.cover=null;S.msg='';render();return;}
  return;
};

// ボス固有の死亡処理。幻想体戦だけで使い、通常対戦のルールは変えない。
function soloHandleDeath(c){
  if(!SOLO.active||!S||!c)return;
  if(SOLO.bossId==='fairy_festival'&&c.name==='妖精の塊'){
    const queen=S.p[1].chars.find(z=>z.name==='女王妖精');
    if(queen&&queen.alive){c.hp=1;c.alive=true;return;}
  }
  if(SOLO.bossId==='burning_girl'&&c.name==='最後のマッチの火'){
    if(!c.abnState)c.abnState={};
    if(!c.abnState.burnBossHalved){
      c.abnState.burnBossHalved=true;
      const girl=S.p[1].chars.find(z=>z.name==='燃え尽きた少女');
      if(girl&&girl.alive){const old=girl.hp;girl.hp=Math.max(1,Math.ceil(girl.hp*0.5));L(`最後のマッチの火が倒れ、燃え尽きた少女のHPが${old}から${girl.hp}に半減した。`);}
    }
  }
  if(SOLO.bossId==='queen_bee'&&c.abnState&&c.abnState.sporesFromBee&&(c.st&&c.st.spore||0)>0&&!c.abnState.sporeDeathSpawned){
    c.abnState.sporeDeathSpawned=true;
    const queen=S.p[1].chars.find(z=>z.name==='女王蜂');
    if(queen&&queen.alive)soloSpawnWorkerBee(`胞子を持つ${c.name}の死亡`);
  }
}
function soloSpawnWorkerBee(reason){
  if(!SOLO.active||!S||SOLO.bossId!=='queen_bee')return null;
  const bee=soloBaseChar('働き蜂','幻想体',105,[2,5],'solo_worker_bee_desc');
  bee.abnState.spawnedBySpore=true;
  S.p[1].chars.push(bee);
  L(`${reason}：場の枠を無視して働き蜂が生成された。`);
  return bee;
}

// 既存命中処理に幻想体戦専用ギミックを追加。
const __soloOriginalHit=hit;
hit=function(pa,pb,B,dmg,A,die){
  if(SOLO.active&&S&&SOLO.bossId==='queen_bee'&&B&&B.name==='女王蜂'&&pa===0&&pb===1&&A){
    const queen=S.p[1].chars.find(z=>z.name==='女王蜂');
    if(queen&&queen.abnState){if(!queen.abnState.beeAttackedThisTurn)queen.abnState.beeAttackedThisTurn=[];if(!queen.abnState.beeAttackedThisTurn.includes(A))queen.abnState.beeAttackedThisTurn.push(A);}
  }
  const before=B&&B.hp,beforeAlive=B&&B.alive;
  __soloOriginalHit(pa,pb,B,dmg,A,die);
  if(!SOLO.active||!S||!A||!B)return;
  const card=A.card||{};
  // 女王蜂に狙われるキャラの記録は「前ターン」単位で使うため、攻撃ダメージの発生時に保存。
  if(SOLO.bossId==='blood_bath'&&A.name==='血の風呂'&&card.soloBoss==='blood_all_three'&&B.hp<before) {
    const slot=A._actionSlot||0;if(!A._soloHitCounts)A._soloHitCounts={};A._soloHitCounts[slot]=(A._soloHitCounts[slot]||0)+1;
    if(A._soloHitCounts[slot]>=3&&B.alive){if(!B.abnState)B.abnState={};B.abnState.skipNextTurn=true;L(`${B.name}は血の風呂の三連撃をすべて受け、次のターン行動不能になる。`);A._soloHitCounts[slot]=0;}
  }
  if(SOLO.bossId==='yearning_heart'&&A.name==='熱望する心臓'&&card.soloBoss==='heart_buff'&&B.hp<before) {
    S.p[1].chars.filter(c=>c!==A&&c.alive).forEach(c=>{c.nx.roll=(c.nx.roll||0)+2;});
    L('熱望する心臓の一撃が命中。ほかの生存する敵の次ターンのダイス値+2。');
  }
  if(SOLO.bossId==='ice_queen'&&A.name==='氷の女王'&&B.hp<before) {
    B.st.cold=(B.st.cold||0)+1;L(`${B.name}に寒気+1（現在${B.st.cold}）。`);
  }
  // 最後のマッチの火は攻撃ページの使用時に少し自傷する。
  if(SOLO.bossId==='burning_girl'&&A.name==='最後のマッチの火'&&card.soloBoss==='match_fire_self_cost'&&A.abnState&&A.abnState.matchFireCostTurn!==S.turn&&B.hp<before){
    A.abnState.matchFireCostTurn=S.turn;A.hp=Math.max(0,A.hp-3);L(`最後のマッチの火は火を投げ、自身も3ダメージを受けた。`);
    if(A.hp<=0){A.alive=false;L('最後のマッチの火は自傷で倒れた。');soloHandleDeath(A);}
  }
  // 働き蜂の胞子ページは、攻撃ダイスが実際に命中するたび胞子+2。
  if(SOLO.bossId==='queen_bee'&&A.name==='働き蜂'&&card.soloBoss==='bee_spore'&&B.alive&&B.hp<before){
    B.st.spore=(B.st.spore||0)+2;if(!B.abnState)B.abnState={};B.abnState.sporesFromBee=true;
    L(`${B.name}に胞子+2（現在${B.st.spore}）。`);
  }
  // 働き蜂の低威力ページは敵に当たるたび女王蜂を少し回復。
  if(SOLO.bossId==='queen_bee'&&A.name==='働き蜂'&&card.soloBoss==='bee_heal'&&B.hp<before){
    const queen=S.p[1].chars.find(z=>z.name==='女王蜂');if(queen&&queen.alive){const old=queen.hp;queen.hp=Math.min(queen.max,queen.hp+4);if(queen.hp>old)L(`働き蜂は女王蜂をHP${queen.hp-old}回復した。`);}
  }
  // 被弾で死んだ妖精の塊は女王が生存している限りHP1で踏みとどまる。
  if(SOLO.bossId==='fairy_festival'&&B.name==='妖精の塊'&&!B.alive&&S.p[1].chars.some(z=>z.name==='女王妖精'&&z.alive)){B.hp=1;B.alive=true;}
  else if(beforeAlive&&!B.alive)soloHandleDeath(B);
};

const __soloOriginalDirect=direct;
direct=function(pb,B,dmg,kind){
  const beforeAlive=B&&B.alive;
  __soloOriginalDirect(pb,B,dmg,kind);
  if(!SOLO.active||!B)return;
  if(SOLO.bossId==='fairy_festival'&&B.name==='妖精の塊'&&!B.alive&&S.p[1].chars.some(z=>z.name==='女王妖精'&&z.alive)){B.hp=1;B.alive=true;}
  else if(beforeAlive&&!B.alive)soloHandleDeath(B);
};

const __soloOriginalDoMatch=doMatch;
doMatch=function(pa,A,pb,B,da=A.card.d,db=B.card.d){
  if(SOLO.active&&SOLO.bossId==='happy_teddy'&&S&&S.p[1]){
    const teddy=S.p[1].chars.find(c=>c.name==='幸せなテディ');
    if(teddy&&teddy.alive&&(A===teddy||B===teddy)&&teddy.abnState&&!teddy.abnState.hugSpent){
      const old=teddy.abnState.hugCost==null?5:teddy.abnState.hugCost;teddy.abnState.hugCost=Math.max(0,old-1);
      if(teddy.abnState.hugCost!==old)L(`幸せなテディのマッチ：懐かしいあの日の抱擁のコスト${old}→${teddy.abnState.hugCost}`);
    }
  }
  return __soloOriginalDoMatch(pa,A,pb,B,da,db);
};

const __soloOriginalCombat=combat;
combat=function(){
  __soloOriginalCombat();
  if(!SOLO.active||!S)return;
  if(S.anim){clearTimeout(S.anim.t);S.anim=null;}
  if(S.p[1]){S.p[1].pendingAbn=false;S.p[1].abnOffers=[];S.p[1].abnSelected=null;S.p[1].coin=0;S.p[1].cost=S.p[1].max=(SOLO.bossId==='happy_teddy'?2:6);}
  if(SOLO.bossId==='ice_queen') {
    S.p[0].chars.forEach(c=>{if(c.st&&c.st.cold>0)c.st.cold=Math.max(0,c.st.cold-1);});
    const queen=S.p[1].chars.find(c=>c.name==='氷の女王');
    if(queen&&!queen.alive) {
      S.p[0].chars.forEach(c=>{if(c.abnState&&c.abnState.iceLocked){c.abnState.iceLocked=false;c.abnState.skipThisTurn=false;c.abnState.skipNextTurn=false;c.st.cold=0;c.hp=Math.max(1,Math.ceil(c.max*0.75));c.alive=true;L(`${c.name}は氷から解放され、HP75%で復帰した。`);}});
      L('氷の女王を撃破。凍結していた味方が解放された。');
    }
  }
  if(SOLO.bossId==='fairy_festival'){
    const queen=S.p[1].chars.find(c=>c.name==='女王妖精');
    if(queen&&queen.alive){
      S.p[1].chars.filter(c=>c.name==='妖精の塊'&&c.alive&&c.abnState&&c.abnState.preparedMeatTurn===S.turn&&c.hp<=1).forEach(c=>{
        c.hp=0;c.alive=false;const old=queen.hp;queen.hp=Math.min(queen.max,queen.hp+Math.ceil(queen.max*0.2));
        if(!queen.abnState)queen.abnState={};queen.abnState.fairyDamageTaken=(queen.abnState.fairyDamageTaken||0)+10;
        L(`女王妖精は${c.name}を捕食し、HP${queen.hp-old}回復・被ダメージ+10（累計+${queen.abnState.fairyDamageTaken}）を得た。`);
      });
    }
  }
  // 燃え尽きた少女は4ターン経過後に自爆ページを使用し、その戦闘中に自滅する。
  if(SOLO.bossId==='burning_girl'&&S.turn>=5&&S.phase==='result'){
    const girl=S.p[1].chars.find(c=>c.name==='燃え尽きた少女');
    if(girl&&girl.alive){
      girl.hp=0;girl.alive=false;
      if(!girl.abnState)girl.abnState={};
      girl.abnState.selfDestructed=true;
      L('燃え尽きた少女は「4本目のマッチの火」で自爆し、敵側の敗北となった。');
    }
  }
  let playerAlive=alive(S.p[0])>0,enemyAlive=alive(S.p[1])>0;
  const queenFairy=SOLO.bossId==='fairy_festival'?S.p[1].chars.find(c=>c.name==='女王妖精'):null;
  const queenBee=SOLO.bossId==='queen_bee'?S.p[1].chars.find(c=>c.name==='女王蜂'):null;
  const burningGirl=SOLO.bossId==='burning_girl'?S.p[1].chars.find(c=>c.name==='燃え尽きた少女'):null;
  const objectiveBossDead=!!((queenFairy&&!queenFairy.alive)||(queenBee&&!queenBee.alive)||(burningGirl&&burningGirl.abnState&&burningGirl.abnState.selfDestructed));
  if(playerAlive&&(objectiveBossDead||!enemyAlive))S.over=`${S.p[0].name}の勝利、おめ`;
  else if(!playerAlive&&!enemyAlive)S.over='引き分け';
  else if(!playerAlive&&enemyAlive)S.over=`${S.p[1].name}の勝利、おめ`;
  if(S.phase==='result'&&S.over&&String(S.over).includes('勝利')&&String(S.over).startsWith(S.p[0].name)){
    if(!S.soloRecordSaved){
      const row={name:SOLO_ACCOUNT.userName||PF.name||S.p[0].name,boss:SOLO.bossId,turns:Math.max(1,S.turn),date:new Date().toISOString()};
      SOLO.turns=row.turns;SOLO.recordStatus='ランキングへ記録を送信しています…';S.soloRecordSaved=true;
      soloSubmitSheetRecord(row).then(()=>{SOLO.recordStatus='討伐記録をランキングへ登録しました。';if(S&&SOLO.active&&S.phase==='result')render();}).catch(err=>{SOLO.recordStatus='討伐には成功しましたが、ランキングへの保存に失敗しました：'+(err&&err.message||'通信エラー');if(S&&SOLO.active&&S.phase==='result')render();});
    }
  }
  render();
};

// 凍結中の味方へカードを割り当てない。
const __soloOriginalMine=mine;
mine=function(ci){
  const c=SOLO.active&&S&&S.p[0].chars[ci];
  if(c&&c.abnState&&c.abnState.iceLocked){S.msg=`${c.name}は氷漬けで行動できません。氷の女王を倒してください。`;render();return;}
  if(c&&c.abnState&&c.abnState.skipThisTurn){S.msg=`${c.name}は行動不能のため、このターンは行動を選べません。`;render();return;}
  return __soloOriginalMine(ci);
};

const __soloOriginalRenderHome=renderHome;
renderHome=function(){
  __soloOriginalRenderHome();
  if(!document.getElementById('app'))return;
  const app=document.getElementById('app');
  app.innerHTML=app.innerHTML.replace('Library of Ruina風・2人交代制の対戦','一台モード：同じ端末で2人が交代して対戦（編成はこのタブ内だけで、一台モードからGoogleへ保存しません）');
  app.innerHTML=app.innerHTML.replace(/<section class="pf"><h2>Googleスプレッドシート：ユーザー名・編成の共有<\/h2>[\s\S]*?<\/section>/, '');
  app.innerHTML=app.innerHTML.replace('<p><button class="go" onclick="SCR=\'rules\';render()">ルール説明</button></p>', '<p><button class="go" onclick="SCR=\'rules\';render()">ルール説明</button></p>');
};

function renderSoloMenu(){
  const currentDeck=DK.d[DK.cur]||{};
  const errors=dErr(currentDeck);
  const url=soloSheetUrl();
  const accountReady=typeof SOLO_ACCOUNT!=='undefined'&&SOLO_ACCOUNT.mode==='account'&&!!SOLO_ACCOUNT.token;
  document.getElementById('stat').innerHTML='<button class="sub" onclick="toHome()">ホームへ戻る</button>';
  document.getElementById('app').innerHTML=`<div class="home"><h1>幻想体戦</h1><p>アカウント「${soloEsc(accountReady?SOLO_ACCOUNT.userName:'未ログイン')}」の保存済み編成を使います。</p>
    ${!accountReady?'<p class="err">幻想体戦はアカウントモード専用です。ホームで登録またはログインしてください。</p>':''}
    ${errors.length?`<p class="err">使用中デッキが未完成：${errors.map(soloEsc).join('、')}</p>`:''}
    <div class="pf"><h2>幻想体戦</h2>${[...new Set(SOLO_BOSSES.map(b=>b.floor))].map(floor=>`<section style="border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0"><h3>${soloEsc(floor)}</h3>${SOLO_BOSSES.filter(b=>b.floor===floor).map(b=>`<section style="border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0"><b>${soloEsc(b.name)}</b><p>${soloEsc(b.summary)}</p><button class="go" ${(!accountReady||errors.length)?'disabled':''} onclick="startSoloBattle('${b.id}')">挑戦する</button></section>`).join('')}</section>`).join('')}</div>
    <div class="pf"><h2>ランキング</h2><p>アカウントごとの最少討伐ターン数を表示します。</p><p><button class="sub" onclick="SCR='soloRank';render()">ランキングを見る</button></p>
    <p><small>Google Apps Scriptの連携先はゲーム本体に設定済みです。</small></p></div>
  </div>`;
}
function renderSoloRank(triggerLoad=true){
  const remote=Array.isArray(SOLO.remoteRows)?SOLO.remoteRows:[];
  document.getElementById('stat').innerHTML='<button class="sub" onclick="SCR=\'solo\';render()">幻想体戦へ戻る</button> <button class="sub" onclick="toHome()">ホームへ戻る</button>';
  const tables=SOLO_BOSSES.map(b=>{
    const rows=remote.filter(r=>r.boss===b.id).sort((x,y)=>(+x.turns)-(+y.turns)||String(x.date||'').localeCompare(String(y.date||''))).slice(0,50);
    const table=rows.length?`<table style="width:100%;border-collapse:collapse"><thead><tr><th>位</th><th>アカウント</th><th>ターン</th><th>日時</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${soloEsc(r.name)}</td><td>${soloEsc(r.turns)}</td><td>${soloEsc(String(r.date||'').slice(0,10))}</td></tr>`).join('')}</tbody></table>`:`<p class="msg">${!soloValidSheetUrl(soloSheetUrl())?'Apps ScriptのURLが未設定です。ホームから設定してください。':(SOLO.remoteLoading?'ランキングを読み込み中…':(SOLO.cloudProfileMessage||'まだ討伐記録がありません。'))}</p>`;
    return `<section class="pf"><h2>${soloEsc(b.floor)}：${soloEsc(b.name)}</h2>${table}</section>`;
  }).join('');
  document.getElementById('app').innerHTML=`<div class="home"><h1>幻想体戦ランキング</h1><p><small>同じアカウントの記録はボスごとに最少ターン数を採用し、少ない順に表示します。</small></p>${tables}<p><button class="sub" onclick="soloRequestRemoteRows()">ランキングを更新</button> <button class="sub" onclick="SCR='solo';render()">幻想体戦へ戻る</button></p></div>`;
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
  if(S.soloRecordSaved)app.innerHTML=app.innerHTML.replace('</h1>',`</h1><p class="msg">${soloEsc(soloBossById(SOLO.bossId).name)}を${SOLO.turns}ターンで討伐しました。${soloEsc(SOLO.recordStatus||'ランキングへ記録を送信しています…')}</p>`);
};
