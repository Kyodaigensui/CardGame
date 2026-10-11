// ╔══════════════════════════════════════════════════════════════════════╗
// ║  オンライン対戦（通信まわり）                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
// 【方式】両者が「同じ種(seed)から作った同じ乱数列」で、同じゲーム処理を動かす（ロックステップ）。
//   手番のプレイヤーは普通に操作し、「決定」を押した時に“操作の記録”を相手へ送る。相手はそれを同じ順に再生する。
//   戦闘は両者が同時に同じ計算をするので、結果は一致する。送るのは操作だけで、手札などは送らない。
// 【通信】PeerJS（WebRTC）。仲介サーバーは「相手を見つける」ためだけに使い、対戦内容は2人の間で直接やり取りする。
// 【注意】相手のゲーム状態も各自のブラウザ内に存在する（画面には出さない）。友達同士の対戦向けで、不正対策はしていない。
// 【カードを足したとき】両者のバージョンが違うと対戦できない。このファイルを直す必要はなく、
//   カードやパッシブを足して公開し直すだけで、お互いのバージョン（netVer）が自動で変わる。

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

function startOnline(seed,decks,me){
 Object.assign(NET,{on:true,me,seed,s:seed|0,decks,q:[],picks:[null,null],sums:{},rm:[false,false],lost:false,err:''});
 SCR='match';
 S={turn:0,p:[newP('プレイヤー1',decks[0]),newP('プレイヤー2',decks[1])],over:null,phase:'setup',sp:me,pick:[],cover:null,msg:'',log:[],order:[0,1],stage:0,leave:false,ops:[],waitSetup:false};
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
   netSend({t:'start',v:netVer(),seed,deck:mine});
   startOnline(seed,[mine,m.deck],0);break}
  case 'start':{   // 参加した側が受ける
   if(NET.role!=='guest'||NET.on)return;
   if(m.v!==netVer()||!deckValid(m.deck)){NET.status='ゲームのバージョンが違うか、相手のデッキが正しくありません。ページを再読み込みしてください。';render();return}
   startOnline(m.seed>>>0,[m.deck,NET.myDeck],1);break}
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
   if(NET.on&&NET.me===1&&NET.decks&&S&&S.over)startOnline(m.seed>>>0,NET.decks,1);break;
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
 if(NET.me===0&&NET.on&&S&&S.over&&NET.rm[0]&&NET.rm[1]){const seed=(Math.random()*4294967296)>>>0;netSend({t:'restart',seed});startOnline(seed,NET.decks,0)}
}

function netClose(){
 if(NET.on)netSend({t:'bye'});
 try{if(NET.conn)NET.conn.close()}catch(e){}
 try{if(NET.peer)NET.peer.destroy()}catch(e){}
 Object.assign(NET,{on:false,role:null,conn:null,peer:null,send:null,q:[],picks:[null,null],sums:{},rm:[false,false],decks:null,myDeck:null,lost:false,err:'',status:'',code:''});
}
function netClosed(){   // 相手との通信が切れた
 if(NET.on){NET.lost=true;render()}
 else if(SCR==='lobby'&&NET.role){NET.send=null;NET.status='接続が切れました。もう一度お試しください。';render()}
}

// ── PeerJS（WebRTC）で相手とつなぐ ──
const PEER_PREFIX='cgame-';
const peerOK=()=>typeof Peer!=='undefined';
const genCode=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return s};
function netWire(conn){   // 接続ができたあとの共通の配線
 NET.conn=conn;
 conn.on('data',netRecv);
 conn.on('close',netClosed);
 conn.on('error',()=>netClosed());
}
function netHost(){   // 部屋を作る
 if(!peerOK()||dErr(DK.d[NET.slot]).length||NET.role)return;
 NET.role='host';NET.code=genCode();NET.status='部屋を準備しています…';render();
 const peer=NET.peer=new Peer(PEER_PREFIX+NET.code);
 peer.on('open',()=>{NET.status='待機中です。相手にコード（または招待リンク）を伝えてください。';render()});
 peer.on('connection',conn=>{
  if(NET.conn||NET.on){conn.on('open',()=>conn.close());return}   // すでに相手がいる
  netWire(conn);
  conn.on('open',()=>{NET.send=o=>conn.send(o);NET.status='相手がつながりました。確認しています…';render()});
 });
 peer.on('error',e=>{NET.status=e.type==='unavailable-id'?'コードが他の部屋と重なりました。もう一度「部屋を作る」を押してください。':`接続エラー：${e.type}`;if(e.type==='unavailable-id'){try{peer.destroy()}catch(_){}NET.role=null;NET.peer=null}render()});
}
function netJoin(){   // 部屋に入る
 const code=(NET.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(!peerOK()||dErr(DK.d[NET.slot]).length||NET.role)return;
 if(code.length!==6){NET.status='コードは6文字です。';render();return}
 NET.role='guest';NET.code=code;NET.myDeck=DK.d[NET.slot];NET.status='接続しています…';render();
 const peer=NET.peer=new Peer();
 peer.on('open',()=>{
  const conn=peer.connect(PEER_PREFIX+code,{reliable:true,serialization:'json'});
  netWire(conn);
  conn.on('open',()=>{NET.send=o=>conn.send(o);netSend({t:'join',v:netVer(),deck:NET.myDeck});NET.status='つながりました。ゲームの開始を待っています…';render()});
 });
 peer.on('error',e=>{NET.status=e.type==='peer-unavailable'?'その部屋が見つかりません。コードを確かめてください。':`接続エラー：${e.type}`;try{peer.destroy()}catch(_){}NET.role=null;NET.peer=null;NET.conn=null;render()});
 setTimeout(()=>{if(NET.role==='guest'&&!NET.send&&!NET.on){NET.status='つながりませんでした。ネットワークやコードを確認して、もう一度お試しください。';try{peer.destroy()}catch(_){}NET.role=null;NET.peer=null;render()}},20000);
}

// ── ロビー画面 ──
function renderLobby(){
 document.getElementById('stat').innerHTML='<button class="sub" onclick="toHome()">ホームへ戻る</button>';
 const d=DK.d[NET.slot],e=dErr(d),ok=!e.length,pk=peerOK(),busy=!!NET.role;
 const link=(NET.role==='host'&&NET.code&&typeof location!=='undefined')?`${location.origin}${location.pathname}?room=${NET.code}`:'';
 document.getElementById('app').innerHTML=`<div class="home lobby">
  <h1 style="font-size:1.6rem">オンライン対戦</h1>
  <p><small>1人が「部屋を作る」でコードを作り、もう1人がそのコードで「部屋に入る」と対戦が始まります。</small></p>
  <p>使うデッキ：<select onchange="NET.slot=+this.value;render()" ${busy?'disabled':''}><option value="0" ${NET.slot===0?'selected':''}>プレイヤー1のデッキ</option><option value="1" ${NET.slot===1?'selected':''}>プレイヤー2のデッキ</option></select>
   <span class="${ok?'ok':'err'}">${dTot(d)}/${C.DECK}枚（${ok?'OK':'未完成：'+e.join(' ')}）</span></p>
  ${pk?'':'<p class="err">オンライン機能（PeerJS）を読み込めませんでした。ネットワークを確認して、ページを再読み込みしてください。</p>'}
  <p><button class="go" ${ok&&pk&&!busy?'':'disabled'} onclick="netHost()">部屋を作る</button></p>
  <p>コード：<input id="roomcode" maxlength="6" value="${NET.role==='host'?'':NET.code}" oninput="NET.code=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')" ${busy?'disabled':''} style="width:7em;text-transform:uppercase;letter-spacing:.2em"> <button class="go" ${ok&&pk&&!busy?'':'disabled'} onclick="netJoin()">部屋に入る</button></p>
  ${link?`<div class="msg">部屋のコード：<b style="font-size:1.4rem;letter-spacing:.2em">${NET.code}</b><br><small>招待リンク：${link}</small></div>`:''}
  ${NET.status?`<div class="msg">${NET.status}</div>`:''}
 </div>`;
}
try{const q=new URLSearchParams(location.search).get('room');if(q){NET.code=q.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);SCR='lobby'}}catch(e){}   // 招待リンク（?room=コード）で開いたらロビーへ
