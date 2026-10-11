// ╔══════════════════════════════════════════════════════════════════════╗
// ║  オンライン対戦（通信まわり）                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
// 【方式】両者が「同じ種(seed)から作った同じ乱数列」で、同じゲーム処理を動かす（ロックステップ）。
//   手番のプレイヤーは普通に操作し、「決定」を押した時に“操作の記録”を相手へ送る。相手はそれを同じ順に再生する。
//   戦闘は両者が同時に同じ計算をするので、結果は一致する。送るのは操作だけで、手札などは送らない。
// 【通信】公開MQTTブローカー（中継サーバー）経由。2人が直接つながらないので、ルーターが別でもつながる。設定は js/50-config.js。
// 【注意】相手のゲーム状態も各自のブラウザ内に存在する（画面には出さない）。友達同士の対戦向けで、不正対策はしていない。
// 【カードを足したとき】両者のバージョンが違うと対戦できない。このファイルを直す必要はなく、
//   カードやパッシブを足して公開し直すだけで、お互いのバージョン（netVer）が自動で変わる。

NET.clients=[];   // 中継サーバーとの接続の一覧（部屋を作る側は複数）
const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
// バージョン照合用の指紋：カード・キャラ・パッシブ・設定のデータと、ゲーム処理の関数の中身から作る
const netVer=()=>hash(JSON.stringify([SKILLS,CHARS,PAS,ATTR,STN,C])
 +Object.entries(PK).map(([k,v])=>k+Object.entries(v).map(([a,b])=>a+String(b)).join('')).join('')
 +[startTurn,combat,hit,doMatch,oneSided,direct,vibex,fx,roll,coin,nextTurn,draw,assign,attribute,pickTgt,redir,unassign,done,mkField,mkC,newP,applySetup,hookSum,hook,run1].map(String).join(''));

const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function deckValid(d){   // 相手から届いたデッキが正しい形か
 if(!d||typeof d!=='object'||Array.isArray(d))return false;
 let tot=0,ch=0;
 for(const k of Object.keys(d)){
  const n=d[k];if(!has(byKey,k)||!Number.isInteger(n)||n<1)return false;
  if(isCh(byKey[k])){if(n!==1)return false;ch++}else if(n>C.MAXC)return false;
  tot+=n;
 }
 return tot===C.DECK&&ch>=1;
}
function validPick(pi,pick){   // 場に出すキャラの選び方が正しいか
 const pool=S.p[pi].pool;
 if(!Array.isArray(pick)||!pick.length||pick.length>C.FIELD)return false;
 const seen=new Set();let u=0;
 for(const i of pick){if(!Number.isInteger(i)||i<0||i>=pool.length||seen.has(i))return false;seen.add(i);u+=szOf(pool[i])}
 return u<=C.FIELD;
}
const netSend=o=>{if(NET.send)try{NET.send(o)}catch(e){}};
function netFail(msg){NET.err=msg;render()}

function startOnline(seed,decks,me,names){
 names=names||['プレイヤー1','プレイヤー2'];
 if(names[0]===names[1])names=[names[0],names[1]+'（2）'];   // 同じ名前なら後ろに印を付ける（両者で同じ結果になる）
 Object.assign(NET,{on:true,me,seed,s:seed|0,decks,names,q:[],picks:[null,null],sums:{},rm:[false,false],lost:false,err:''});
 SCR='match';
 S={turn:0,p:[newP(names[0],decks[0]),newP(names[1],decks[1])],over:null,phase:'setup',sp:me,pick:[],cover:null,msg:'',log:[],order:[0,1],stage:0,leave:false,ops:[],waitSetup:false};
 render();
}

function netRecv(m){
 if(!m||typeof m!=='object')return;
 switch(m.t){
  case 'join':{   // 部屋を作った側が受ける：バージョンとデッキを確かめて、問題なければ開始
   if(NET.role!=='host'||NET.on)return;
   if(m.v!==netVer()){netSend({t:'reject',why:'version'});NET.status='相手のゲームのバージョンが違うため始められません。お互いにページを再読み込みしてください。';render();return}
   if(!deckValid(m.deck)){netSend({t:'reject',why:'deck'});NET.status='相手のデッキが正しくないため始められません。';render();return}
   const mine=DK.d[NET.slot],seed=(Math.random()*4294967296)>>>0;
   netSend({t:'start',v:netVer(),seed,deck:mine,name:PF.name});
   startOnline(seed,[mine,m.deck],0,[PF.name||'プレイヤー1',cleanName(m.name)||'相手']);break}
  case 'start':{   // 参加した側が受ける
   if(NET.role!=='guest'||NET.on)return;
   if(m.v!==netVer()||!deckValid(m.deck)){NET.status='ゲームのバージョンが違うか、相手のデッキが正しくありません。ページを再読み込みしてください。';render();return}
   startOnline(m.seed>>>0,[m.deck,NET.myDeck],1,[cleanName(m.name)||'相手',PF.name||'プレイヤー2']);break}
  case 'reject':
   NET.status=m.why==='version'?'ゲームのバージョンが相手と違います。ページを再読み込み（キャッシュを無視して更新）してから、もう一度お試しください。':'デッキが受け付けられませんでした。';render();break;
  case 'setup':
   if(!NET.on||!S||S.phase!=='setup'||NET.picks[1-NET.me])return;
   if(!validPick(1-NET.me,m.pick)){netFail('相手のキャラの選び方が正しくありません。');return}
   NET.picks[1-NET.me]=m.pick;netTrySetup();break;
  case 'decide':
   if(!NET.on||!Array.isArray(m.ops)||m.ops.length>300)return;
   NET.q.push(m);netFlush();break;
  case 'sum':
   if(!NET.on)return;
   (NET.sums[m.turn]=NET.sums[m.turn]||{}).other=m.h;netCheckSum(m.turn);break;
  case 'rematch':
   if(!NET.on)return;
   NET.rm[1-NET.me]=true;netRematchCheck();if(S&&S.over)render();break;
  case 'restart':
   if(NET.on&&NET.me===1&&NET.decks&&S&&S.over)startOnline(m.seed>>>0,NET.decks,1,NET.names);break;
  case 'bye':
   if(NET.on){NET.lost=true;render()}break;
 }
}

// 両者の選択がそろったら、P1→P2の順に確定してゲーム開始
function netTrySetup(){
 if(!S||S.phase!=='setup'||!NET.picks[0]||!NET.picks[1])return;
 applySetup(0,NET.picks[0]);applySetup(1,NET.picks[1]);
 S.pick=[];S.msg='';S.waitSetup=false;
 startTurn();
}

// 相手の「決定」を、こちらが同じ手番に来てから再生する（先に届いたら待たせる）
function netFlush(){
 while(NET.q.length&&S&&!NET.err){
  const m=NET.q[0];
  if(m.turn>S.turn||(m.turn===S.turn&&S.phase!=='decide'))break;
  NET.q.shift();
  if(m.turn!==S.turn||m.stage!==S.stage||m.pi!==act()||m.pi===NET.me){netFail('通信の順序が合いません（バージョン違いの可能性があります）。');return}
  netApplyDecide(m);
 }
}
function netApplyDecide(m){
 const ph0=S.phase,st0=S.stage;
 REPLAY=true;
 try{
  for(const op of m.ops){
   if(!Array.isArray(op))throw new Error('op');
   if(op[0]==='A')assign(op[1],op[2]);
   else if(op[0]==='P'){S.pend=op[1];pickTgt(op[2])}
   else if(op[0]==='R')redir(op[1]);
   else if(op[0]==='U')unassign(op[1],{stopPropagation(){}});
   else throw new Error('op');
  }
  done();
  if(S.phase===ph0&&S.stage===st0)throw new Error('not advanced');   // 再現しても手番が進まなかった＝ずれている
 }catch(e){REPLAY=false;netFail('相手の操作を再現できませんでした。お互いにページを再読み込みして、もう一度つないでください。');return}
 REPLAY=false;
 render();
}

// 毎ターン、両者の状態の指紋を交換して、ずれていないか確かめる
const stateSum=()=>hash(JSON.stringify(S.p.map(p=>[p.hand.map(key),p.deck.length,p.disc.length,p.cost,p.max,p.lv,p.coin,p.chars.map(c=>[c.hp,c.max,c.sp,c.alive,c.ps.length])]))+S.order.join()+NET.s);
function netAfterTurnStart(){
 const h=stateSum();(NET.sums[S.turn]=NET.sums[S.turn]||{}).mine=h;
 netSend({t:'sum',turn:S.turn,h});netCheckSum(S.turn);netFlush();
}
function netCheckSum(t){const e=NET.sums[t];if(e&&e.mine&&e.other&&e.mine!==e.other)netFail('対戦の状態が相手とずれました。お互いにページを再読み込みして、もう一度つないでください。')}

function netRematch(){NET.rm[NET.me]=true;netSend({t:'rematch'});netRematchCheck();render()}
function netRematchCheck(){   // 両者が「もう一度」を押したら、部屋の主が新しい種を決めて再開
 if(NET.me===0&&NET.on&&S&&S.over&&NET.rm[0]&&NET.rm[1]){const seed=(Math.random()*4294967296)>>>0;netSend({t:'restart',seed});startOnline(seed,NET.decks,0,NET.names)}
}

function netClose(){
 if(NET.on)netSend({t:'bye'});
 try{if(NET.conn)NET.conn.close()}catch(e){}
 NET.clients.forEach(c=>{try{c.end(false)}catch(e){}});   // 送信中のメッセージ（「bye」など）を送りきってから閉じる
 Object.assign(NET,{on:false,role:null,conn:null,clients:[],send:null,q:[],picks:[null,null],sums:{},rm:[false,false],decks:null,names:null,myDeck:null,lost:false,err:'',status:'',code:''});
}
function netClosed(){   // 相手との通信が切れた
 if(NET.on){NET.lost=true;render()}
 else if(SCR==='lobby'&&NET.role){NET.send=null;NET.status='接続が切れました。もう一度お試しください。';render()}
}

// ── 中継（公開MQTTブローカー）で相手とつなぐ ──
// ・宛先（トピック）は「prefix/部屋コード/h」（部屋を作った側が受け取る）と「…/g」（入った側が受け取る）の2本。
// ・メッセージには通し番号を付け、届く順番が入れ替わっても、重複しても、正しい順に1回ずつ処理する。
// ・5秒ごとに生存確認（ハートビート）を送り、25秒何も届かなければ切断とみなす。
const mqttOK=()=>typeof mqtt!=='undefined';
const genCode=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return s};
const cid=()=>'cg_'+Math.random().toString(36).slice(2,10);
const relayTopics=(code,role)=>{const b=`${RELAY.prefix}${code}/`;return role==='host'?{tIn:b+'h',tOut:b+'g'}:{tIn:b+'g',tOut:b+'h'}};
function relayLink(client,tIn,tOut,onMsg,onDead){
 const L={client,tx:0,rx:1,buf:{},last:Date.now(),dead:false};
 L.send=o=>{try{client.publish(tOut,JSON.stringify({n:++L.tx,m:o}),{qos:1})}catch(e){}};
 L.feed=raw=>{   // 届いたものを、通し番号の順に1回ずつ処理する
  let e;try{e=JSON.parse(raw)}catch(_){return}
  if(!e||typeof e!=='object')return;
  L.last=Date.now();
  if(e.p)return;   // 生存確認
  if(!Number.isInteger(e.n)||e.n<L.rx||has(L.buf,e.n))return;   // 重複・古いもの
  L.buf[e.n]=e.m;
  while(has(L.buf,L.rx)){const m=L.buf[L.rx];delete L.buf[L.rx];L.rx++;onMsg(m)}
 };
 L.timer=setInterval(()=>{
  if(L.dead)return;
  try{client.publish(tOut,JSON.stringify({p:1}),{qos:0})}catch(_){}
  if(Date.now()-L.last>25000){L.close();onDead()}
 },5000);
 L.close=()=>{L.dead=true;clearInterval(L.timer);try{client.end(false)}catch(_){}};
 return L;
}
function netHost(){   // 部屋を作る：設定の全ブローカーで待ち受け、最初に入ってきた相手の接続を使う
 if(!mqttOK()||dErr(DK.d[NET.slot]).length||!PF.name||NET.role)return;
 NET.role='host';NET.code=genCode();NET.status='部屋を準備しています…';render();
 const T=relayTopics(NET.code,'host');let ready=0;
 RELAY.brokers.forEach(url=>{
  let c;try{c=mqtt.connect(url,{clientId:cid(),clean:true,connectTimeout:8000,reconnectPeriod:2000})}catch(e){return}
  NET.clients.push(c);
  c.on('connect',()=>c.subscribe(T.tIn,{qos:1},err=>{
   if(err||NET.conn)return;
   ready++;NET.status='待機中です。相手にコード（または招待リンク）を伝えてください。';render();
  }));
  c.on('message',(topic,payload)=>{
   const raw=String(payload);
   if(NET.conn){if(NET.conn.client===c)NET.conn.feed(raw);return}   // 相手が決まったら、その接続だけ聞く
   let e;try{e=JSON.parse(raw)}catch(_){return}
   if(!e||e.n!==1||!e.m||e.m.t!=='join')return;
   NET.clients.forEach(o=>{if(o!==c)try{o.end(true)}catch(_){}});NET.clients=[c];   // 使わない接続は閉じる
   c.options.reconnectPeriod=1000;
   const L=NET.conn=relayLink(c,T.tIn,T.tOut,netRecv,netClosed);
   NET.send=L.send;L.feed(raw);
  });
  c.on('error',e=>console.error('[MQTT host error]',e));   // 待機中の個別のエラーは無視（ほかのブローカーが生きていればよい）
 });
 setTimeout(()=>{if(NET.role==='host'&&!ready&&!NET.conn){NET.status='中継サーバーにつながりません。ネットワークを確認して、もう一度お試しください。';render()}},12000);
}
function netJoin(){   // 部屋に入る：設定のブローカーを順に試し、ホストが答えたものを使う
 const code=(NET.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(!mqttOK()||dErr(DK.d[NET.slot]).length||!PF.name||NET.role)return;
 if(code.length!==6){NET.status='コードは6文字です。';render();return}
 NET.role='guest';NET.code=code;NET.myDeck=DK.d[NET.slot];
 const T=relayTopics(code,'guest'),urls=RELAY.brokers;let idx=0;
 const attempt=()=>{
  if(NET.role!=='guest'||NET.on)return;
  if(idx>=urls.length){NET.status='その部屋が見つかりません。コードを確かめるか、相手が部屋を作ってからもう一度お試しください。';NET.role=null;NET.clients=[];render();return}
  const url=urls[idx++];NET.status=`接続しています…（${idx}/${urls.length}）`;render();
  let c;try{c=mqtt.connect(url,{clientId:cid(),clean:true,connectTimeout:6000,reconnectPeriod:0})}catch(e){attempt();return}
  NET.clients=[c];let paired=false,over=false,timer=0;
  const L=relayLink(c,T.tIn,T.tOut,m=>{if(!paired){paired=true;clearTimeout(timer);c.options.reconnectPeriod=1000;NET.conn=L;NET.send=L.send}netRecv(m)},netClosed);
  const giveUp=()=>{if(over||paired||NET.role!=='guest')return;over=true;clearTimeout(timer);L.close();attempt()};
  timer=setTimeout(giveUp,7000);   // この中継では、ホストの返事が来なかった → 次へ
  c.on('connect',()=>c.subscribe(T.tIn,{qos:1},err=>{if(err){giveUp();return}L.send({t:'join',v:netVer(),deck:NET.myDeck,name:PF.name})}));
  c.on('message',(topic,payload)=>L.feed(String(payload)));
  c.on('error',giveUp);
  c.on('close',()=>{if(!paired)giveUp()});
 };
 attempt();
}

// ── ロビー画面 ──
function renderLobby(){
 document.getElementById('stat').innerHTML='<button class="sub" onclick="toHome()">ホームへ戻る</button>';
 const d=DK.d[NET.slot],e=dErr(d),ok=!e.length&&!!PF.name,pk=mqttOK(),busy=!!NET.role;
 const link=(NET.role==='host'&&NET.code&&typeof location!=='undefined')?`${location.origin}${location.pathname}?room=${NET.code}`:'';
 document.getElementById('app').innerHTML=`<div class="home lobby">
  <h1 style="font-size:1.6rem">オンライン対戦</h1>
  <p><small>1人が「部屋を作る」でコードを作り、もう1人がそのコードで「部屋に入る」と対戦が始まります。</small></p>
  <p>プレイヤー名：<b>${PF.name||'（未設定：ホームで決めてください）'}</b></p>
  <p>使うデッキ：<select onchange="NET.slot=+this.value;render()" ${busy?'disabled':''}><option value="0" ${NET.slot===0?'selected':''}>デッキ1</option><option value="1" ${NET.slot===1?'selected':''}>デッキ2</option></select>
   <span class="${e.length?'err':'ok'}">${dTot(d)}/${C.DECK}枚（${e.length?'未完成：'+e.join(' '):'OK'}）</span></p>
  ${pk?'':'<p class="err">オンライン機能の通信ライブラリを読み込めませんでした。ネットワークを確認して、ページを再読み込みしてください。</p>'}
  <p><button class="go" ${ok&&pk&&!busy?'':'disabled'} onclick="netHost()">部屋を作る</button></p>
  <p>コード：<input id="roomcode" maxlength="6" value="${NET.role==='host'?'':NET.code}" oninput="NET.code=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')" ${busy?'disabled':''} style="width:7em;text-transform:uppercase;letter-spacing:.2em"> <button class="go" ${ok&&pk&&!busy?'':'disabled'} onclick="netJoin()">部屋に入る</button></p>
  ${link?`<div class="msg">部屋のコード：<b style="font-size:1.4rem;letter-spacing:.2em">${NET.code}</b><br><small>招待リンク：${link}</small></div>`:''}
  ${NET.status?`<div class="msg">${NET.status}</div>`:''}
 </div>`;
}
try{const q=new URLSearchParams(location.search).get('room');if(q){NET.code=q.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);SCR='lobby'}}catch(e){}   // 招待リンク（?room=コード）で開いたらロビーへ
