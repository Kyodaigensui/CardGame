// 自動テスト（Node.js があれば動く。ブラウザは不要）
//   使い方：リポジトリの一番上のフォルダで  node tests/run.js
//   カード・キャラ・パッシブを足したあとに実行すると、書き間違い・対戦のずれ（同期ずれ）・画面エラーを見つけられる。
//   内容：①データ検証 ②ホットシート対戦の自動プレイ ③オンライン対戦（2つのブラウザ役を作って通信をつなぐ）
//        ④通信まわりの異常系（バージョン違い・不正データ・切断・再戦）
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const GAMES=+process.env.GAMES||60;
// index.html の <script src="js/…"> を読み込み順どおりに集める（外部URLのMQTT.jsは除く）
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const FILES=[...html.matchAll(/<script src="(?!https?:)([^"]+)"/g)].map(m=>path.join(ROOT,m[1]));

const mkEl=()=>({style:{},value:'',classList:{add(){},remove(){}},getBoundingClientRect:()=>({left:0,top:0,width:0,height:0,bottom:0}),scrollTop:0,scrollHeight:0,querySelectorAll:()=>[],appendChild(){},scrollIntoView(){},_h:'',set innerHTML(v){this._h=v},get innerHTML(){return this._h}});
function makeCtx(store){   // store を渡すと、同じ保存領域を使う別のページ（＝再読み込み）を作れる
 store=store||{};const els={};
 const ctx={document:{getElementById:id=>els[id]||(els[id]=mkEl()),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mkEl(),body:{className:''}},localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v)}},addEventListener(){},console,Math,JSON,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,alert(){},confirm:()=>true,matchMedia:()=>({matches:true}),scrollTo(){},URLSearchParams};
 ctx.window=ctx;vm.createContext(ctx);
 for(const f of FILES)vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
 ctx._els=els;ctx._store=store;return ctx;
}
const ev=(c,code)=>vm.runInContext(code,c);
const rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)],J=o=>JSON.parse(JSON.stringify(o));

let pass=0,fail=0;const bad=[];
const ok=(name,cond,extra)=>{if(cond)pass++;else{fail++;bad.push(name+(extra?'  → '+extra:''))}};

// ───── ① データ検証（読み込みに成功した時点で、パッシブの種類・属性・効果・条件の書き間違いは検出済み） ─────
let C0;
try{C0=makeCtx();ok('ゲームデータの読み込み',true)}catch(e){ok('ゲームデータの読み込み',false,e.message);finish()}
const names=J(ev(C0,'({sk:SKILLS.map(s=>s.n),ch:CHARS.map(c=>c.name)})'));
ok('カード名・キャラ名が重複していない',new Set([...names.sk,...names.ch]).size===names.sk.length+names.ch.length,'重複あり');
ok('デッキ構築画面が開ける',(()=>{try{ev(C0,"SCR='deck';render()");return true}catch(e){return false}})());
ok('ルール説明画面が開ける',(()=>{try{ev(C0,"SCR='rules';render()");return true}catch(e){return false}})());
for(const c of names.ch){ // 全キャラが戦場データにできる
 ok('キャラ「'+c+'」を作れる',(()=>{try{ev(C0,`mkField(mkC(byKey[${JSON.stringify(c)}]))`);return true}catch(e){return false}})());
}
const mkDeck=()=>{const d={};const n=1+rnd(5);[...names.ch].sort(()=>Math.random()-.5).slice(0,n).forEach(c=>d[c]=1);let t=n;while(t<15){const s=pick(names.sk);if((d[s]||0)<3){d[s]=(d[s]||0)+1;t++}}return d};

// ───── ② ホットシート（1台で交代）対戦の自動プレイ ─────
{let errs={},over=0;
 for(let g=0;g<GAMES;g++){
  try{
   const c=makeCtx();ev(c,`DK.d[0]=${JSON.stringify(mkDeck())};DK.d[1]=${JSON.stringify(mkDeck())};startMatch()`);
   for(let sp=0;sp<2;sp++){ev(c,'S.pick=[]');const n=ev(c,'S.p[S.sp].pool.length');for(const i of [...Array(n).keys()].sort(()=>Math.random()-.5))ev(c,`pickCh(${i})`);if(!ev(c,'S.pick.length'))ev(c,'pickCh(0)');ev(c,'confirmSetup()')}
   for(let t=0;t<40&&!ev(c,'S.over');t++){
    for(let st=0;st<2;st++){const nch=ev(c,'S.p[act()].chars.length');
     for(let ci=0;ci<nch;ci++){if(!ev(c,`S.p[act()].chars[${ci}].alive`))continue;const hn=ev(c,'S.p[act()].hand.length');if(!hn)continue;
      ev(c,`assign(${ci},${rnd(hn)})`);if(ev(c,'S.pend')===ci){const e=J(ev(c,'S.p[1-act()].chars.map((x,i)=>x.alive?i:-1).filter(i=>i>=0)'));if(e.length){ev(c,`pickTgt(${pick(e)})`);if(ev(c,'!!S.ask'))ev(c,`redir(${Math.random()<.5})`)}}}
     for(let ci=0;ci<nch;ci++)if(ev(c,`(()=>{const x=S.p[act()].chars[${ci}];return x.alive&&x.card&&x.tgt==null})()`)){ev(c,`S.pend=${ci}`);const e=J(ev(c,'S.p[1-act()].chars.map((x,i)=>x.alive?i:-1).filter(i=>i>=0)'));ev(c,`pickTgt(${e[0]})`);if(ev(c,'!!S.ask'))ev(c,'redir(false)')}
     ev(c,'done()')}
    if(!ev(c,'S.over'))ev(c,'nextTurn()')}
   if(ev(c,'S.over'))over++;
  }catch(e){const k=String(e.stack||e).split('\n').slice(0,2).join(' | ').slice(0,300);errs[k]=(errs[k]||0)+1}
 }
 ok(`ホットシート ${GAMES}試合でエラーなし（決着${over}）`,!Object.keys(errs).length,JSON.stringify(errs));
}

// ───── ③ オンライン対戦：2つのブラウザ役を通信でつなぎ、毎ターン状態が一致するか確かめる ─────
function pair(){
 const A=makeCtx(),B=makeCtx(),qAB=[],qBA=[];
 A.__send=m=>qAB.push(J(m));B.__send=m=>qBA.push(J(m));
 ev(A,'NET.send=__send');ev(B,'NET.send=__send');
 const pump=()=>{let n=0;while((qAB.length||qBA.length)&&n++<500){if(qAB.length){B.__m=qAB.shift();ev(B,'netRecv(__m)')}if(qBA.length){A.__m=qBA.shift();ev(A,'netRecv(__m)')}}};
 return{A,B,pump};
}
function connect(p,dA,dB){
 ev(p.A,`DK.d[0]=${JSON.stringify(dA)}`);ev(p.B,`DK.d[1]=${JSON.stringify(dB)}`);
 ev(p.A,'PF.name="アリス"');ev(p.B,'PF.name="ボブ"');
 ev(p.A,'NET.role="host";NET.slot=0');ev(p.B,'NET.role="guest";NET.slot=1;NET.myDeck=DK.d[1]');
 ev(p.B,'netSend({t:"join",v:netVer(),deck:NET.myDeck,name:PF.name})');p.pump();
}
function playOnline(A,B,pump,st){   // 接続できた2つのブラウザ役で、1試合を最後まで遊ばせる（毎ターン状態の一致を確認）
   const setup=c=>{ev(c,'S.pick=[]');const n=ev(c,'S.p[NET.me].pool.length');for(const i of [...Array(n).keys()].sort(()=>Math.random()-.5))ev(c,`pickCh(${i})`);if(!ev(c,'S.pick.length'))ev(c,'pickCh(0)');ev(c,'confirmSetup()')};
   const od=Math.random()<.5?[A,B]:[B,A];setup(od[0]);if(Math.random()<.5)pump();setup(od[1]);pump();
   const snap=c=>ev(c,'JSON.stringify({p:S.p,turn:S.turn,phase:S.phase,stage:S.stage,order:S.order,over:S.over,log:S.log,s:NET.s})');
   const same=w=>{if(snap(A)!==snap(B)){st.mism++;throw new Error('状態が一致しません：'+w)}};
   const decisions=c=>{
    const me=ev(c,'NET.me'),nch=ev(c,'S.p[NET.me].chars.length');
    if(ev(c,'S.p[NET.me].pendingAbn')){const ci=ev(c,'S.p[NET.me].chars.findIndex(x=>x.alive)');if(ci>=0){ev(c,'pickAbnormality(0)');ev(c,`assignAbnormality(${ci})`);}}
    const enemy=()=>J(ev(c,'S.p[1-NET.me].chars.map((x,i)=>x.alive?i:-1).filter(i=>i>=0)'));
    const target=()=>{const e=enemy();if(!e.length)return;ev(c,`pickTgt(${pick(e)})`);if(ev(c,'!!S.ask'))ev(c,`redir(${Math.random()<.5})`)};
    for(let ci=0;ci<nch;ci++){
     if(!ev(c,`S.p[NET.me].chars[${ci}].alive`))continue;const hn=ev(c,'S.p[NET.me].hand.length');if(!hn||Math.random()<.15)continue;
     const hi=rnd(hn),isChr=ev(c,`isCh(S.p[NET.me].hand[${hi}])`);ev(c,`assign(${ci},${hi})`);if(isChr)continue;
     if(ev(c,'S.pend')===ci)target();
     if(Math.random()<.12&&ev(c,`!!S.p[NET.me].chars[${ci}].card`)){ev(c,`unassign(${ci},{stopPropagation(){}})`);const h2=ev(c,'S.p[NET.me].hand.length');if(h2){ev(c,`assign(${ci},${rnd(h2)})`);if(ev(c,'S.pend')===ci)target()}}}
    for(let ci=0;ci<nch;ci++)if(ev(c,`(()=>{const x=S.p[NET.me].chars[${ci}];return x.alive&&x.card&&x.tgt==null})()`)){ev(c,`S.pend=${ci}`);target()}
    if(ev(c,'!!S.ask'))ev(c,'redir(false)');
    ev(c,'done()');
   };
   for(let t=0;t<40;t++){
    for(let guard=0;ev(A,'S.phase')==='decide'&&ev(B,'S.phase')==='decide'&&guard<4;guard++){
     const actor=ev(A,'S.order[S.stage]')===0?A:B,other=actor===A?B:A;
     same('手番の開始');
     const before=snap(other);ev(other,'selCard(0);assign(0,0);pickTgt(0);done();redir(true)');
     if(snap(other)!==before)throw new Error('手番でない側が操作できてしまいました');
     decisions(actor);pump();
    }
    if(ev(A,'S.phase')!=='result'||ev(B,'S.phase')!=='result')throw new Error('戦闘まで進みません');
    same('戦闘後');st.turns++;
    if(ev(A,'S.over')){st.over++;break}
    const first=Math.random()<.5?A:B,second=first===A?B:A;
    ev(first,'nextTurn()');
    if(ev(first,'S.order[S.stage]===NET.me')&&Math.random()<.6){st.early++;decisions(first);pump()}   // 相手が「次へ」を押す前に決定が届く場合
    ev(second,'nextTurn()');pump();
    if(ev(A,'NET.err')||ev(B,'NET.err'))throw new Error('NET.err '+ev(A,'NET.err')+ev(B,'NET.err'));
   }
}
{let errs={};const st={turns:0,mism:0,early:0,over:0};
 for(let g=0;g<GAMES;g++){
  try{
   const p=pair(),{A,B,pump}=p;connect(p,mkDeck(),mkDeck());
   if(!ev(A,'NET.on')||!ev(B,'NET.on'))throw new Error('接続の握手に失敗');
   playOnline(A,B,pump,st);
  }catch(e){const k=String(e.stack||e).split('\n').slice(0,2).join(' | ').slice(0,300);errs[k]=(errs[k]||0)+1}
 }
 ok(`オンライン ${GAMES}試合（${st.turns}ターン・先行決定${st.early}回）で状態が毎回一致`,!Object.keys(errs).length&&!st.mism,JSON.stringify(errs));
}

// ───── ④ 通信まわりの異常系 ─────
{const p=pair();const d=mkDeck();connect(p,d,d);
 ok('握手して開始できる',ev(p.A,'NET.on')&&ev(p.B,'NET.on'));
 ok('バージョン指紋が一致',ev(p.A,'netVer()')===ev(p.B,'netVer()'));}
{const p=pair();const d=mkDeck();ev(p.B,'SKILLS[0].c+=1');connect(p,d,d);   // 片方だけカードの数値が違う
 ok('バージョンが違う相手とは始まらない（両側に理由を表示）',!ev(p.A,'NET.on')&&!ev(p.B,'NET.on')&&/バージョン/.test(ev(p.A,'NET.status'))&&/バージョン/.test(ev(p.B,'NET.status')));}
{const p=pair();const d=mkDeck();connect(p,d,d);
 const dv=x=>{p.B.__d=x;return ev(p.B,'deckValid(__d)')};
 ok('不正なデッキを拒否',![null,[],'x',{},{'斬撃':1.5},{'斬撃':-1},{'斬撃':99},JSON.parse('{"__proto__":15}'),JSON.parse('{"constructor":15}')].some(dv)&&dv(d));
 p.A.__m={t:'setup',pick:[99]};ev(p.A,'netRecv(__m)');ok('不正な初手の選択を拒否',/正しくありません/.test(ev(p.A,'NET.err')));}
{const p=pair();const d=mkDeck();connect(p,d,d);
 ev(p.A,'S.turn=1;NET.sums[1]={mine:"aaa"}');p.A.__m={t:'sum',turn:1,h:"bbb"};ev(p.A,'netRecv(__m)');
 ok('状態の指紋がずれたら検出',/ずれ/.test(ev(p.A,'NET.err')));}
{const p=pair();const d=mkDeck();connect(p,d,d);p.A.__m={t:'bye'};ev(p.A,'netRecv(__m)');
 ok('相手が切断したら操作できなくなる',ev(p.A,'NET.lost')&&!ev(p.A,'canAct()'));}
{const p=pair();const d=mkDeck();connect(p,d,d);ev(p.A,'S.over="x"');ev(p.B,'S.over="x"');
 ev(p.B,'netRematch()');p.pump();const mid=ev(p.A,'S.over');ev(p.A,'netRematch()');p.pump();
 ok('両者が押すと再戦（片方だけでは始まらない）',mid==='x'&&ev(p.A,'S.phase')==='setup'&&ev(p.B,'S.phase')==='setup'&&ev(p.A,'NET.seed')===ev(p.B,'NET.seed'));}
{const p=pair();const d=mkDeck();connect(p,d,d);for(const c of [p.A,p.B])ev(c,'S.pick=[];pickCh(0);confirmSetup()');p.pump();
 const html=c=>c._els.app._h,act=ev(p.A,'S.order[S.stage]')===0?p.A:p.B,wait=act===p.A?p.B:p.A;
 ok('手番の側だけに「決定」ボタンが出る',/onclick="done\(\)"/.test(html(act))&&!/onclick="done\(\)"/.test(html(wait)));
 ok('手番でない側の手札は操作できない表示',!/draggable="true"/.test(html(wait))&&/相手が行動を決めています/.test(html(wait)));
 ok('画面に undefined/NaN が出ない',!/undefined|NaN|\[object/.test(html(act)+html(wait)));}
{const L=makeCtx();ev(L,"SCR='lobby';NET.code='ABC123';render()");
 ok('ロビーに版の目印（ver.）が出る',/ver\.[0-9a-z]{3,6}/.test(L._els.app._h));
 ok('ロビー画面が開ける（通信ライブラリなしでは部屋を作れない表示）',/id="roomcode"/.test(L._els.app._h)&&/disabled onclick="netHost/.test(L._els.app._h));}

// ───── ⑤ プレイヤー名とデッキの紐づけ ─────
{const store={};let c=makeCtx(store);
 ok('名前が未設定のときは名前入力の画面',/プレイヤー名を決めてください/.test((ev(c,'render()'),c._els.app._h))&&!/対戦開始/.test(c._els.app._h));
 c._els.pfname={value:'<b>太郎</b>'};ev(c,'pfCreate()');
 ok('名前を決めると保存され、記号は取り除かれる',ev(c,'PF.name')==='b太郎/b'.replace('/','')||ev(c,'PF.name')==='b太郎b'||!/[<>]/.test(ev(c,'PF.name')));
 const nm=ev(c,'PF.name');
 ev(c,'delete DK.d[0]['+JSON.stringify(names.sk[3])+'];DK.d[0]['+JSON.stringify(names.sk[4])+']=2;saveDecks()');   // 1枚減らして1枚増やす（15枚のまま）
 const saved=JSON.stringify(ev(c,'DK.d'));
 const c2=makeCtx(store);   // ページを再読み込みした想定
 ok('再読み込みしても、名前とデッキが戻る',ev(c2,'PF.name')===nm&&JSON.stringify(ev(c2,'DK.d'))===saved);
 c2._els.pfname={value:'花子'};ev(c2,'pfCreate()');
 ok('別の名前を作ると、初期デッキから始まる（デッキは名前ごとに別）',ev(c2,'PF.name')==='花子'&&JSON.stringify(ev(c2,'DK.d'))!==saved);
 ev(c2,'pfUse('+JSON.stringify(nm)+')');
 ok('名前を切り替えると、その名前のデッキに戻る',JSON.stringify(ev(c2,'DK.d'))===saved);
 c2._els.pfname={value:nm};ev(c2,'pfCreate()');
 ok('同じ名前は作れない',/すでにあります/.test(ev(c2,'PF.msg')));
 ev(c2,"SCR='home';render()");c2._els.pfcode={value:''};ev(c2,'pfOut()');const code=c2._els.pfcode.value;
 ev(c2,'pfDelete()');
 ok('名前を削除できる',!ev(c2,'readProfiles().some(x=>x.name===PF.name&&x.name==='+JSON.stringify(nm)+')')||ev(c2,'PF.name')!==nm);
 c2._els.pfcode={value:code};ev(c2,'pfIn()');
 ok('バックアップから復元できる',ev(c2,'PF.name')===nm&&JSON.stringify(ev(c2,'DK.d'))===saved);
 const s2={cg_decks:JSON.stringify([{[names.ch[0]]:1,[names.sk[0]]:3,[names.sk[1]]:3,[names.sk[2]]:3,[names.sk[3]]:3,[names.sk[4]]:2}, J(ev(C0,'defDeck(POOL2)'))])};
 const c3=makeCtx(s2);c3._els.pfname={value:'旧データ'};ev(c3,'pfCreate()');
 ok('旧バージョンのデッキを最初の名前に引き継ぐ',ev(c3,'dTot(DK.d[0])')===15&&ev(c3,'DK.d[0]['+JSON.stringify(names.sk[0])+']')===3);
 ok('名前の長さ・記号の制限',ev(c3,'cleanName("あ".repeat(30))').length===12&&!/[<>&"\'`]/.test(ev(c3,'cleanName(`<img src=x onerror="a">\'`)')));
}
{const p=pair();const d=mkDeck();connect(p,d,d);
 ok('オンラインで双方の名前が表示名になる',ev(p.A,'S.p[0].name')==='アリス'&&ev(p.A,'S.p[1].name')==='ボブ'&&ev(p.B,'S.p[0].name')==='アリス'&&ev(p.B,'S.p[1].name')==='ボブ');}
{const p=pair();const d=mkDeck();ev(p.A,'PF.name="同じ"');ev(p.B,'PF.name="同じ"');
 ev(p.A,'DK.d[0]='+JSON.stringify(d));ev(p.B,'DK.d[1]='+JSON.stringify(d));ev(p.A,'NET.role="host";NET.slot=0');ev(p.B,'NET.role="guest";NET.slot=1;NET.myDeck=DK.d[1]');
 ev(p.B,'netSend({t:"join",v:netVer(),deck:NET.myDeck,name:PF.name})');p.pump();
 ok('同じ名前でも区別される（両者で同じ表示）',ev(p.A,'S.p[1].name')!==ev(p.A,'S.p[0].name')&&ev(p.A,'S.p[1].name')===ev(p.B,'S.p[1].name'));}
{const p=pair();const d=mkDeck();ev(p.A,'PF.name="ホスト"');ev(p.A,'DK.d[0]='+JSON.stringify(d));ev(p.A,'NET.role="host";NET.slot=0');
 p.A.__m={t:'join',v:ev(p.A,'netVer()'),deck:d,name:'<img src=x onerror=alert(1)>'};ev(p.A,'netRecv(__m)');
 const html=p.A._els.app._h+p.A._els.stat._h;
 ok('相手の名前にHTMLを仕込まれても無害化される',ev(p.A,'NET.on')&&!/<img/.test(html)&&!/[<>"]/.test(ev(p.A,'S.p[1].name')));}
// ───── ⑥ 画面：P2視点でも「薄いダイス」「突進」が相手側へ向く ─────
{const p=pair();const d=mkDeck();connect(p,d,d);for(const c of [p.A,p.B])ev(c,'S.pick=[];pickCh(0);confirmSetup()');p.pump();
 const c=p.B;
 ev(c,'(()=>{const hp=snap(),hold=holdSnap(),sts=stSnap();hold[0][0]=[{t:"d",r:[2,5],s:false}];hold[1][0]=[{t:"d",r:[2,5],s:false}];const fr={hp,hold,sts,dm:{},ev:[],lu:[[0,0],[1,0]],sh:[],ar:null};S.anim={i:0,frames:[fr],hp0:hp,hold0:hold,st0:sts}})()');
 const h=(pi,v)=>ev(c,`chHTML(${pi},0,${v})`);
 ok('P1視点：自分(下側)の薄いダイスは上へ・突進は上へ／相手(上側)は下へ',/ghosts top/.test(h(0,0))&&/ch up/.test(h(0,0))&&/ghosts bot/.test(h(1,0))&&/ch dn/.test(h(1,0)));
 ok('P2視点：自分(下側＝プレイヤー2)の薄いダイスは上へ・突進は上へ／相手(上側)は下へ',/ghosts top/.test(h(1,1))&&/ch up/.test(h(1,1))&&/ghosts bot/.test(h(0,1))&&/ch dn/.test(h(0,1)));}

// ───── ⑦ 条件「相手の状態異常の値がN以上」 ─────
{const c=makeCtx();
 const res=J(ev(c,`(()=>{
  startMatch();const mk=n=>mkField(mkC({name:n,slot:1,hp:40,spd:[1,1],ps:[]}));
  const A=mk('a'),B=mk('b');S.p[0].chars=[A];S.p[1].chars=[B];S.log=[];
  S.p[0].deck=Array.from({length:20},()=>({n:'d',c:1,d:[]}));S.p[0].hand=[];S.p[0].disc=[];
  const eff=[['draw',2,['foeStGe','vib',5]]];
  const r={};
  B.st.vib=4;fx(0,A,eff,'発動時',B);r.at4=S.p[0].hand.length;
  B.st.vib=5;fx(0,A,eff,'発動時',B);r.at5=S.p[0].hand.length;
  B.st.vib=9;fx(0,A,eff,'発動時',B);r.at9=S.p[0].hand.length;
  r.text=fxText(eff);
  let e1='',e2='';try{condOk(['foeStGe','fire',5],'t')}catch(e){e1=e.message}try{condOk(['foeStGe','vib'],'t')}catch(e){e2=e.message}
  r.e1=e1;r.e2=e2;r.andOk=condTest({and:['kill',['foeStGe','vib',5]]},{A,B,dmg:0});
  return r})()`));
 ok('相手の振動が4のときはドローしない・5以上でドロー2',res.at4===0&&res.at5===2&&res.at9===4,JSON.stringify(res));
 ok('条件の説明文が表示される',/相手の振動が5以上のとき/.test(res.text)&&/ドロー2/.test(res.text),res.text);
 ok('条件の書き間違いを検出（状態名・数値なし）',/burn\/bleed\/rupt\/vib/.test(res.e1)&&/数値が必要/.test(res.e2),res.e1+res.e2);}

// ───── ⑧ パッシブ「共鳴(vibcheck)」「青い残響(rangedres)」 ─────
{const c=makeCtx();
 const r=JSON.parse(ev(c,`(()=>{
  startMatch();const mk=(n,ps)=>mkField(mkC({name:n,slot:1,hp:60,spd:[1,1],ps}));
  const o={};
  const A=mk('a',['vibcheck']),B=mk('b',[]);S.p[0].chars=[A];S.p[1].chars=[B];S.log=[];S.dm={};S.ev=[];S.fr=[];
  const die={t:'a',r:[5,5]};A.card={n:'t',c:1,d:[]};A.tgt=0;
  B.st.vib=2;o.v2=roll(A,die);B.st.vib=3;o.v3=roll(A,die);B.st.vib=9;o.v9=roll(A,die);
  A.tgt=null;o.noTgt=roll(A,die);A.tgt=0;
  const R2=mk('r',['rangedres']),X=mk('x',[]);S.p[0].chars=[X];S.p[1].chars=[R2];
  X.card={n:'遠',c:1,req:'ranged',d:[]};let h=R2.hp;hit(0,1,R2,10,X,null);o.ranged=h-R2.hp;
  X.card={n:'近',c:1,d:[]};h=R2.hp;hit(0,1,R2,10,X,null);o.melee=h-R2.hp;
  X.card={n:'遠',c:1,req:'ranged',d:[]};S.log=[];hit(0,1,R2,0,X,null);o.zeroLog=S.log.filter(x=>x.includes('半減')).length;
  return JSON.stringify(o)})()`));
 ok('共鳴：相手の振動が3未満は+0、3以上で+2（相手が居ないときは+0）',r.v2===5&&r.v3===7&&r.v9===7&&r.noTgt===5,JSON.stringify(r));
 ok('青い残響：遠距離カードのダメージだけ半減（0ダメージではログも出さない）',r.ranged===5&&r.melee===10&&r.zeroLog===0,JSON.stringify(r));}

// ───── ⑨ 中継（MQTTブローカー）経由の通信：重複・順序の入れ替わり・ブローカー停止・切断 ─────
function makeBroker(){   // 本物のブローカーの代わりをする、メモリ上の簡易版
 const B={subs:[],q:[],down:new Set(),dup:false,reorder:false};
 B.mqtt={connect(url,opts){
  const c={url,options:Object.assign({},opts),_ev:{},ended:false,
   on(e,f){(c._ev[e]=c._ev[e]||[]).push(f);return c},
   emit(e,...a){(c._ev[e]||[]).slice().forEach(f=>f(...a))},
   subscribe(topic,o,cb){B.q.push({k:'ctl',fn:()=>{if(c.ended)return;B.subs.push({c,topic});cb&&cb(null)}})},
   publish(topic,payload){B.q.push({k:'msg',fn:()=>{B.subs.filter(s=>s.topic===topic&&s.c.url===c.url&&!s.c.ended&&s.c!==c).forEach(s=>{const n=B.dup?2:1;for(let i=0;i<n;i++)s.c.emit('message',topic,payload)})}})},
   end(){if(c.ended)return;c.ended=true;B.subs=B.subs.filter(s=>s.c!==c);c.emit('close')}};
  B.q.push({k:'ctl',fn:()=>{if(c.ended)return;if(B.down.has(url)){c.emit('error',new Error('down'));c.emit('close')}else c.emit('connect')}});
  return c}};
 B.pump=()=>{let n=0;while(B.q.length&&n++<20000){let i=0;if(B.reorder&&B.q[0].k==='msg'){let m=1;while(m<3&&B.q[m]&&B.q[m].k==='msg')m++;i=Math.floor(Math.random()*m)}B.q.splice(i,1)[0].fn()}};
 return B;
}
function withTimers(ctx){const T={to:[],iv:[]};ctx.setTimeout=(f,ms)=>{T.to.push({f,ms});return T.to.length};ctx.clearTimeout=id=>{if(T.to[id-1])T.to[id-1].f=null};ctx.setInterval=f=>{T.iv.push(f);return T.iv.length};ctx.clearInterval=id=>{T.iv[id-1]=null};return T}
function relayPair(opts){
 const B=Object.assign(makeBroker(),opts||{}),A=makeCtx(),G=makeCtx();A.mqtt=B.mqtt;G.mqtt=B.mqtt;
 const TA=withTimers(A),TG=withTimers(G),d=mkDeck();
 [[A,'アリス',0],[G,'ボブ',1]].forEach(([c,nm,sl])=>{ev(c,`PF.name=${JSON.stringify(nm)};DK.d[${sl}]=${JSON.stringify(d)};NET.slot=${sl}`)});
 return{B,A,G,TA,TG};
}
const relayStart=p=>{ev(p.A,'netHost()');p.B.pump();const code=ev(p.A,'NET.code');ev(p.G,`NET.code=${JSON.stringify(code)};netJoin()`);p.B.pump();return code};
{const p=relayPair();const code=relayStart(p);
 ok('中継：部屋のコードが6文字で、待機表示（接続できた中継サーバーの数つき）が出る',code.length===6&&/待機中です.*2\/2/.test(ev(p.A,'NET.status')),ev(p.A,'NET.status'));
 ok('中継：入室すると握手して始まり、名前が双方に出る',ev(p.A,'NET.on')&&ev(p.G,'NET.on')&&ev(p.A,'S.p[0].name')==='アリス'&&ev(p.G,'S.p[1].name')==='ボブ'&&ev(p.G,'S.p[0].name')==='アリス');}
{const p=relayPair();p.B.down.add(ev(p.A,'RELAY.brokers[0]'));const code=relayStart(p);
 ok('中継：先頭のブローカーが落ちていても、次のブローカーでつながる',ev(p.A,'NET.on')&&ev(p.G,'NET.on'),code);}
{const p=relayPair();ev(p.A,'netHost()');p.B.pump();ev(p.G,'NET.code="ZZZZZZ";netJoin()');p.B.pump();
 for(let i=0;i<5&&ev(p.G,'NET.role');i++){const t=p.TG.to.find(x=>x.f);if(t){const f=t.f;t.f=null;f();p.B.pump()}}
 ok('中継：コードが違うと「部屋が見つかりません」になる（ほかの部屋には入れない）。古いページの可能性も案内する',!ev(p.G,'NET.on')&&/部屋が見つかりません/.test(ev(p.G,'NET.status'))&&/更新/.test(ev(p.G,'NET.status')));}
{const p=relayPair();ev(p.A,'netHost()');p.B.pump();p.B.down.add(ev(p.A,'RELAY.brokers[0]'));p.B.down.add(ev(p.A,'RELAY.brokers[1]'));ev(p.G,'NET.code="ABCDEF";netJoin()');p.B.pump();
 for(let i=0;i<6&&ev(p.G,'NET.role');i++){const x=p.TG.to.find(y=>y.f);if(x){const f=x.f;x.f=null;f();p.B.pump()}}
 ok('中継：どの中継サーバーにもつながれない入室者には、「ネットワークで止められている」旨を表示（部屋が無い、とは別の文言）',/つながれませんでした/.test(ev(p.G,'NET.status'))&&!/部屋が見つかりません/.test(ev(p.G,'NET.status')));}
{const p=relayPair();p.B.down.add(ev(p.A,'RELAY.brokers[0]'));p.B.down.add(ev(p.A,'RELAY.brokers[1]'));ev(p.A,'netHost()');p.B.pump();
 const t=p.TA.to.find(x=>x.f&&x.ms===12000);if(t){const f=t.f;t.f=null;f()}
 ok('中継：すべてのブローカーが落ちているときは、その旨が表示される',/中継サーバーにつながりません/.test(ev(p.A,'NET.status')));}
{let errs={};const st={turns:0,mism:0,early:0,over:0};
 const N=Math.max(10,Math.floor(GAMES/3));
 for(let g=0;g<N;g++){try{const p=relayPair({dup:true,reorder:true});relayStart(p);
   if(!ev(p.A,'NET.on')||!ev(p.G,'NET.on'))throw new Error('中継の握手に失敗');
   playOnline(p.A,p.G,p.B.pump,st);}catch(e){const k=String(e.stack||e).split('\n').slice(0,2).join(' | ').slice(0,300);errs[k]=(errs[k]||0)+1}}
 ok(`中継：メッセージの重複・順序入れ替わりがあっても、${N}試合で状態が毎回一致（${st.turns}ターン）`,!Object.keys(errs).length&&!st.mism,JSON.stringify(errs));}
{const p=relayPair();relayStart(p);
 // 切断の検出：相手から何も届かない状態が25秒続いたら切断とみなす
 ev(p.A,'NET.conn.last=Date.now()-30000');p.TA.iv.filter(Boolean).forEach(f=>f());
 ok('中継：25秒何も届かなければ切断として表示される',ev(p.A,'NET.lost')&&!ev(p.A,'canAct()'));}
{const p=relayPair();relayStart(p);ev(p.G,'toHome()');p.B.pump();
 ok('中継：片方がホームへ戻ると、相手に切断が伝わり、接続が閉じられる',ev(p.A,'NET.lost')&&ev(p.G,'NET.clients.length')===0&&!ev(p.G,'NET.on'));}

finish();
function finish(){
 console.log(`\n合格 ${pass} / 失敗 ${fail}`);
 if(fail){console.log('\n失敗した項目：');bad.forEach(b=>console.log(' ・'+b));process.exit(1)}
 console.log('すべて合格しました。');
}
