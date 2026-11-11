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
 const ctx={document:{getElementById:id=>els[id]||(els[id]=mkEl()),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>mkEl(),body:{className:''}},localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},addEventListener(){},console,Math,JSON,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,alert(){},confirm:()=>true,matchMedia:()=>({matches:true}),scrollTo(){},URLSearchParams};
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
// ───── URL保存時の回帰テスト：貼り付け後に「一覧を更新／共有保存」でも自動保存する ─────
{const u=makeCtx();
 ok('Apps Script標準の /exec URLを認識',ev(u,'soloValidSheetUrl("https://script.google.com/macros/s/AKfycb-test/exec")'));
 ok('Googleアカウント番号付きURLを認識',ev(u,'soloValidSheetUrl("https://script.google.com/macros/u/0/s/AKfycb-test/exec?authuser=0")'));
 ok('Google Workspace配下のURLを認識',ev(u,'soloValidSheetUrl("https://script.google.com/a/macros/example.jp/s/AKfycb-test/exec")'));
 ok('Apps Script編集画面のURLは連携URLとして受け付けない',!ev(u,'soloValidSheetUrl("https://script.google.com/home/projects/123/edit")'));
 ok('Apps Script URLはゲームコードに組み込み済みで入力不要',ev(u,'soloSheetUrl()')==='https://script.google.com/macros/s/AKfycbwX66N5uX1cIyFPUWzXgVejb3ybAKsYwubW-sgRqigENv1ep2EOvRv_0wXr8TmCZqI/exec');
}
const names=J(ev(C0,'({sk:SKILLS.map(s=>s.n),ch:CHARS.map(c=>c.name)})'));
ok('カード名・キャラ名が重複していない',new Set([...names.sk,...names.ch]).size===names.sk.length+names.ch.length,'重複あり');
ok('デッキ構築画面が開ける',(()=>{try{ev(C0,"SCR='deck';render()");return true}catch(e){return false}})());
ok('ルール説明画面が開ける',(()=>{try{ev(C0,"SCR='rules';render()");return true}catch(e){return false}})());
for(const c of names.ch){ // 全キャラが戦場データにできる
 ok('キャラ「'+c+'」を作れる',(()=>{try{ev(C0,`mkField(mkC(byKey[${JSON.stringify(c)}]))`);return true}catch(e){return false}})());
}
// ───── 幻想体戦：敵が先に決定し、行動不能が戦闘で処理される ─────
{
 const c=makeCtx();
 const deck=(()=>{const d={};d['フィリップ']=1;const skills=names.sk.slice(0,14);skills.forEach((k,i)=>d[k]=(i%3)+1);return d})();
 // 15枚を超えないよう、固定デッキを15枚に整える。
 const validDeck=(()=>{const d={'フィリップ':1};let n=1;for(const k of names.sk){const take=Math.min(3,15-n);if(take<=0)break;d[k]=take;n+=take;}return d})();
 const init=ev(c,`(()=>{SOLO_ACCOUNT.mode='account';SOLO_ACCOUNT.token='test-token';SOLO_ACCOUNT.userName='テスト';SOLO_ACCOUNT.loggedIn=true;PF.name='テスト';DK.cur=0;DK.d[0]=${JSON.stringify(validDeck)};DK.hiers[0]='総記の階';return true})()`);
 let soloStarted=false;
 try {
  ev(c,"startSoloBattle('blood_bath')");
  const ci=ev(c,"S.p[0].pool.findIndex(x=>isCh(x))");
  ev(c,`S.pick=[${ci}];confirmSetup()`);
  soloStarted=ev(c,"S.phase==='decide'&&S.order[0]===1&&S.order[1]===0&&S.stage===1&&act()===0&&!!S.p[1].chars[0].card");
 } catch(e) { soloStarted=false; }
 ok('幻想体戦は速度に関係なく敵AIが先に決定し、プレイヤーが後から決定する',soloStarted);
 let skipWorks=false,blocked=false;
 try {
  ev(c,`(()=>{const x=S.p[0].chars.find(z=>z.alive);x.abnState=x.abnState||{};x.abnState.skipThisTurn=true;x.max=9999;x.hp=9999;x.alive=true;return true})()`);
  ev(c,'mine(0)');
  blocked=ev(c,"S.msg.includes('行動不能')");
  ev(c,`(()=>{const x=S.p[0].chars.find(z=>z.alive);setActionSlot(x,0);x.card={n:'テスト行動',c:0,d:[D('a',1,1)]};x.tgt=0;x.used=false;return true})()`);
  ev(c,'done()');
  skipWorks=ev(c,"S.log.some(x=>x.includes('行動不能のため行動をスキップ'))");
 } catch(e) { skipWorks=false; }
 ok('幻想体戦で行動不能のキャラは選択が制限され、戦闘処理でも行動をスキップする',skipWorks&&blocked,ev(c,"JSON.stringify({phase:S.phase,stage:S.stage,order:S.order,log:S.log.slice(-8),player:S.p[0].chars.map(x=>({name:x.name,alive:x.alive,skip:x.abnState&&x.abnState.skipThisTurn,card:x.card&&x.card.n,tgt:x.tgt,used:x.used})),enemy:S.p[1].chars.map(x=>({name:x.name,alive:x.alive,card:x.card&&x.card.n,tgt:x.tgt}))})"));

 // 行動不能は行動選択だけに適用し、幻想体カードの付与は妨げない。
 const abnTarget=makeCtx();
 try {
  ev(abnTarget,`SOLO_ACCOUNT.mode='account';SOLO_ACCOUNT.token='test-token';SOLO_ACCOUNT.userName='テスト';SOLO_ACCOUNT.loggedIn=true;PF.name='テスト';DK.cur=0;DK.d[0]=${JSON.stringify(validDeck)};DK.hiers[0]='総記の階';startSoloBattle('blood_bath');S.pick=[S.p[0].pool.findIndex(x=>isCh(x))];confirmSetup()`);
  ev(abnTarget,`(()=>{const p=S.p[0],c=p.chars[0];c.abnState=c.abnState||{};c.abnState.skipThisTurn=true;p.pendingAbn=true;p.abnOffers=[{id:'test_abn',n:'テスト幻想体カード',desc:'テスト',hierarchy:'総記の階',mood:'mixed',fx:{}}];p.abnSelected=0;mine(0)})()`);
 } catch(e) {}
 ok('行動不能中でも幻想体カードを味方に付与できる',ev(abnTarget,"S.p[0].chars[0].abn.some(x=>x.id==='test_abn')&&!S.p[0].pendingAbn"));

 // 血の風呂の2行動は同じキャラへ集中しないよう、同一ターン内の対象を分散する。
 const targetDeck={'シャオ':1,'カーリー':1};for(const sk of names.sk){if(Object.keys(targetDeck).length>=15)break;targetDeck[sk]=1;}
 const targetCtx=makeCtx();
 let targetSpread=false;
 try {
  ev(targetCtx,`SOLO_ACCOUNT.mode='account';SOLO_ACCOUNT.token='test-token';SOLO_ACCOUNT.userName='テスト';SOLO_ACCOUNT.loggedIn=true;PF.name='テスト';DK.cur=0;DK.d[0]=${JSON.stringify(targetDeck)};DK.hiers[0]='総記の階';startSoloBattle('blood_bath');S.pick=S.p[0].pool.map((x,i)=>isCh(x)?i:-1).filter(i=>i>=0);confirmSetup()`);
  targetSpread=ev(targetCtx,"new Set(actionStates(S.p[1].chars[0]).map(st=>st.card&&st.tgt).filter(t=>t!=null)).size===2");
 } catch(e) {}
 ok('血の風呂の2つの行動はシャオとカーリーへ分散して狙う',targetSpread);

 // 戦闘後処理が combat() で開始されたアニメーションを破棄しない。
 const animCtx=makeCtx();let animPreserved=false;
 try {
  ev(animCtx,`SOLO_ACCOUNT.mode='account';SOLO_ACCOUNT.token='test-token';SOLO_ACCOUNT.userName='テスト';SOLO_ACCOUNT.loggedIn=true;PF.name='テスト';DK.cur=0;DK.d[0]=${JSON.stringify(validDeck)};DK.hiers[0]='総記の階';startSoloBattle('blood_bath');S.pick=[S.p[0].pool.findIndex(x=>isCh(x))];confirmSetup()`);
  ev(animCtx,`(()=>{const p=S.p[0].chars[0];p.card=soloCard('テスト攻撃',0,[D('a',1,3)]);p.tgt=0;p.used=false;p.hitFired=[];p.stock=null;p.redirBy=null;p.tgt0=null;return true})()`);
  ev(animCtx,'combat()');
  animPreserved=ev(animCtx,'!!S.anim&&S.anim.i===0&&S.anim.frames.length>0');
 } catch(e) {}
 ok('幻想体戦は最初の攻撃フレームを即時表示し、動きを減らすOS設定でも自動スキップしない',animPreserved);
 // 戦闘中に働き蜂が生成されても、生成前フレームに存在しないキャラの表示でアニメーションを止めない。
 const spawnAnimCtx=makeCtx();let spawnAnimSafe=false;
 try {
  ev(spawnAnimCtx,`startMatch();const mk=n=>mkField(mkC({name:n,slot:1,hp:40,spd:[1,1],ps:[]}));S.p[1].chars=[mk('既存の敵')];const hp0=snap(),hold0=holdSnap(),st0=stSnap();S.anim={frames:[{hp:hp0,hold:hold0,sts:st0,dm:{},ev:[],lu:[],sh:[],ar:null,ms:400}],i:0,hp0,hold0,st0};S.p[1].chars.push(mk('途中出現の働き蜂'))`);
  spawnAnimSafe=ev(spawnAnimCtx,`chHTML(1,1,0).includes('途中出現の働き蜂')`);
 } catch(e) {spawnAnimSafe=false;}
 ok('戦闘中に生成されたキャラがいても、履歴不足による描画エラーでアニメーションが止まらない',spawnAnimSafe);
 const cssText=fs.readFileSync(path.join(ROOT,'css/style.css'),'utf8');
 ok('大型キャラの2枠表示と選択中の金色枠を見分けやすくする',!cssText.includes('.ch.big{grid-column:span 2;border-color:var(--gold)}'));
}

// ───── 幻想体戦：階層分類と歴史の階の4戦 ─────
{
 const deck=(()=>{const d={'フィリップ':1};let n=1;for(const k of names.sk){if(n>=15)break;d[k]=1;n++}return d})();
 const menu=makeCtx();
 ev(menu,"SCR='solo';render()");
 ok('幻想体戦メニューが総記の階・歴史の階に分類される',/総記の階/.test(menu._els.app._h)&&/歴史の階/.test(menu._els.app._h));
 ok('現在の3戦は総記の階、新しい4戦は歴史の階として登録される',
  ev(menu,`SOLO_BOSSES.filter(x=>x.floor==='総記の階').map(x=>x.id).join(',')`)==='blood_bath,yearning_heart,ice_queen'&&
  ev(menu,`SOLO_BOSSES.filter(x=>x.floor==='歴史の階').map(x=>x.id).join(',')`)==='burning_girl,happy_teddy,fairy_festival,queen_bee');
 const setup=(id)=>{
  const c=makeCtx();
  ev(c,`SOLO_ACCOUNT.mode='account';SOLO_ACCOUNT.token='test-token';SOLO_ACCOUNT.userName='テスト';SOLO_ACCOUNT.loggedIn=true;PF.name='テスト';DK.cur=0;DK.d[0]=${JSON.stringify(deck)};DK.hiers[0]='総記の階';startSoloBattle(${JSON.stringify(id)});S.pick=[S.p[0].pool.findIndex(x=>isCh(x))];confirmSetup()`);
  return c;
 };
 const checkTeam=(id,expected)=>{
  const c=setup(id);
  const got=ev(c,"S.p[1].chars.map(x=>x.name).join('|')");
  ok(`${id}の敵編成を生成できる`,got===expected,got);
  return c;
 };
 const burn=checkTeam('burning_girl','燃え尽きた少女|最後のマッチの火|最後のマッチの火');
 ok('燃え尽きた少女は保有コスト0・最大5で開始する',ev(burn,"S.p[1].cost===0&&S.p[1].max===5"));
 ok('取り巻きの攻撃・回避ページはすべてコスト0',ev(burn,"S.p[1].chars.slice(1).every(x=>x.card&&x.card.c===0)"));
 ok('5ターン目でも保有コスト4なら4本目のマッチの火を使わない',ev(burn,"S.turn=5;S.p[1].cost=4;soloPlanEnemy();S.p[1].chars[0].card===null"));
 const burnPage=ev(burn,"S.turn=6;S.p[1].cost=5;soloPlanEnemy();(()=>{const c=S.p[1].chars[0].card;return {name:c&&c.n,cost:c&&c.c,aoe:c&&c.aoe,dice:c&&c.d.map(x=>x.r),stored:S.p[1].cost}})()");
 ok('コスト5を保有すると4本目のマッチの火（個別広域・2ダイス・HP連動威力）を使用する',burnPage.name==='4本目のマッチの火'&&burnPage.cost===5&&burnPage.aoe==='individual'&&burnPage.dice.length===2&&burnPage.dice[0][0]===18&&burnPage.dice[0][1]===22&&burnPage.stored===5,JSON.stringify(burnPage));
 ev(burn,'done()');
 ok('4本目のマッチの火を使用した後に燃え尽きた少女が自滅する',!ev(burn,"S.p[1].chars.find(x=>x.name==='燃え尽きた少女').alive"));
 ok('燃え尽きた少女が自爆した時点で、最後のマッチの火が残っていても敵側の敗北になる',ev(burn,"S.over&&S.over.startsWith(S.p[0].name)&&S.p[1].chars.some(x=>x.name==='最後のマッチの火'&&x.alive)"),ev(burn,"JSON.stringify({over:S.over,phase:S.phase,enemies:S.p[1].chars.map(x=>({n:x.name,alive:x.alive}))})"));
 const burnCost=setup('burning_girl');
 const regen=ev(burnCost,"(()=>{S.p[1].cost=2;nextTurn();return {turn:S.turn,cost:S.p[1].cost,max:S.p[1].max}})()");
 ok('燃え尽きた少女の保有コストはターン経過で1だけ回復する',regen.cost===3&&regen.max===5,JSON.stringify(regen));
 const burnThreshold=setup('burning_girl');
 const threshold=ev(burnThreshold,"(()=>{const g=S.p[1].chars[0];S.p[1].cost=3;direct(1,g,99,'bleed');const first={hp:g.hp,cost:S.p[1].cost};direct(1,g,99,'bleed');return {first,second:{hp:g.hp,cost:S.p[1].cost}}})()");
 ok('燃え尽きた少女は最大HPの約33%を失うごとに保有コスト-1',threshold.first.hp===201&&threshold.first.cost===2&&threshold.second.hp===102&&threshold.second.cost===1,JSON.stringify(threshold));
 const burnMinions=setup('burning_girl');
 const halved=ev(burnMinions,"(()=>{const p=S.p[1],g=p.chars[0];p.cost=3;soloHandleDeath(p.chars[1]);const first={hp:g.hp,cost:p.cost};soloHandleDeath(p.chars[2]);return {first,second:{hp:g.hp,cost:p.cost}}})()");
 ok('取り巻きが倒れるたびに本体HP半減と33%ごとのコスト減少が連動する',halved.first.hp===150&&halved.first.cost===2&&halved.second.hp===75&&halved.second.cost===1,JSON.stringify(halved));
 const teddy=checkTeam('happy_teddy','幸せなテディ');
 ok('幸せなテディは速度10固定、行動権2、コスト最大値2',ev(teddy,"S.p[1].chars[0].spd[0]===10&&S.p[1].chars[0].spd[1]===10&&S.p[1].chars[0].actionRights===2&&S.p[1].max===2"));
 const fairy=checkTeam('fairy_festival','女王妖精|妖精の塊|妖精の塊');
 ok('妖精の祭典は毎ターンの用意された肉をランダムな妖精の塊に付与する',ev(fairy,"S.p[1].chars.filter(x=>x.name==='妖精の塊').some(x=>x.abnState.preparedMeatTurn===S.turn)"));
 const fed=checkTeam('fairy_festival','女王妖精|妖精の塊|妖精の塊');
 ev(fed,`(()=>{const q=S.p[1].chars.find(x=>x.name==='女王妖精'),m=S.p[1].chars.find(x=>x.name==='妖精の塊'&&x.abnState.preparedMeatTurn===S.turn);q.hp=200;m.hp=1;return true})()`);
 ev(fed,'done()');
 ok('用意された肉を持つ妖精の塊がHP1なら捕食され、女王妖精が回復・被ダメージ+10を得る',ev(fed,"(()=>{const q=S.p[1].chars.find(x=>x.name==='女王妖精');return q.hp>200&&q.abnState.fairyDamageTaken===10&&S.p[1].chars.some(x=>x.name==='妖精の塊'&&!x.alive)})()"));
 const bee=checkTeam('queen_bee','女王蜂|働き蜂|働き蜂');
 ev(bee,'done()');
 ok('女王蜂の働き蜂が胞子を付与し、ターン終了時の胞子ダメージを処理する',ev(bee,"S.log.some(x=>x.includes('胞子')&&x.includes('ダメージ'))&&S.p[0].chars[0].st.spore>0"),ev(bee,"JSON.stringify({spore:S.p[0].chars[0].st.spore,log:S.log.slice(-8)})"));
 const beeSpawn=checkTeam('queen_bee','女王蜂|働き蜂|働き蜂');
 ev(beeSpawn,`(()=>{const c=S.p[0].chars[0];c.hp=1;c.st.spore=2;c.abnState.sporesFromBee=true;return direct(0,c,3,'spore')})()`);
 ok('胞子を持ったキャラが死亡すると働き蜂が場の枠を無視して生成される',ev(beeSpawn,"S.p[1].chars.filter(x=>x.name==='働き蜂').length===3"));
 const beeFocus=checkTeam('queen_bee','女王蜂|働き蜂|働き蜂');
 ev(beeFocus,"S.p[1].chars[0].hp=Math.floor(S.p[1].chars[0].max*.24);soloPlanEnemy()");
 ok('女王蜂のHPが25%未満になると働き蜂が女王蜂を対象にする',ev(beeFocus,"S.p[1].chars.filter(x=>x.name==='働き蜂').every(x=>x.abnState.targetQueen&&x.tgt===0)"));
 const teddyMatch=checkTeam('happy_teddy','幸せなテディ');
 ev(teddyMatch,`(()=>{const p=S.p[0].chars[0],t=S.p[1].chars[0];p.card={n:'テスト攻撃',c:0,d:[D('a',10,10)]};p.tgt=0;p.used=false;p.hitFired=[];t.card=soloTeddyLight(0);t.tgt=0;t.used=false;t.hitFired=[];return true})()`);
 ev(teddyMatch,'done()');
 ok('幸せなテディはマッチ1回ごとに特殊ページのコストを1下げる',ev(teddyMatch,"S.p[1].chars[0].abnState.hugCost===4"));
}

// ───── フィリップ覚醒条件テスト ─────
{
 ok('フィリップのキャラカードがデッキ一覧に存在する',names.ch.includes('フィリップ'));
 const ph=makeCtx();
 ok('フィリップ固有パッシブが登録されている',!!ev(ph,"PAS.unstableego&&PAS.waxenwings&&PK.unstableEgo&&PK.waxenwings"));
 const solo=ev(ph,`(()=>{const c=mkField(mkC(byKey['フィリップ']));c.hp=20;S={turn:1,p:[{chars:[c]}],log:[],inCombat:true};const done=checkPhillipAwakening(0);return {done,wing:hasPasKind(c,'waxenwings'),rights:c.actionRights,slots:actionStates(c).length}})()`);
 ok('サルヴァドール未出場でフィリップ単独の場合は覚醒しない',!solo.done&&!solo.wing&&solo.rights==null&&solo.slots===1,JSON.stringify(solo));
 const aliveSal=ev(ph,`(()=>{const s=mkField(mkC(byKey['サルヴァドール'])),c=mkField(mkC(byKey['フィリップ']));S={turn:1,p:[{chars:[s,c]}],log:[],inCombat:true};const done=checkPhillipAwakening(0);return {done,wing:hasPasKind(c,'waxenwings')}})()`);
 ok('サルヴァドールが生存中はフィリップが唯一の生存者条件を満たさず覚醒しない',!aliveSal.done&&!aliveSal.wing,JSON.stringify(aliveSal));
 const res=ev(ph,`(()=>{const s=mkField(mkC(byKey['サルヴァドール'])),c=mkField(mkC(byKey['フィリップ']));s.alive=false;s.hp=0;c.hp=20;S={turn:1,p:[{chars:[s,c]}],log:[],inCombat:true};const done=checkPhillipAwakening(0);return {done,alive:c.alive,hp:c.hp,max:c.max,size:c.size,rights:c.actionRights,wing:hasPasKind(c,'waxenwings'),slots:actionStates(c).length}})()`);
 ok('サルヴァドール死亡時にフィリップが唯一の生存者なら1枠のまま行動権2とHP回復を得る',res.done&&res.wing&&res.size===1&&res.rights===2&&res.slots===2&&res.hp===Math.min(res.max,20+Math.ceil(res.max*.5)),JSON.stringify(res));
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
// ───── ④b アカウント／一台モードの分離 ─────
{const store={},c=makeCtx(store);
 const profile=J(ev(c,'({decks:[defDeck(POOL1),defDeck(POOL2)],hierarchies:[ABN_HIERARCHIES[0],ABN_HIERARCHIES[1]]})'));
 ev(c,'soloAccountActivate('+JSON.stringify({token:'test-session-token-'.padEnd(40,'x'),accountId:'test-account',userName:'クラウド太郎',profile})+')');
 ok('アカウントモードはログインした名前と編成を表示',ev(c,'SOLO_ACCOUNT.mode')==='account'&&ev(c,'PF.name')==='クラウド太郎'&&/クラウド太郎/.test(c._els.app._h));
 ev(c,'saveDecks()');
 ok('アカウントモードはブラウザのプロフィール一覧へ編成を書かない',!('cg_profiles' in store)&&!('cg_cur' in store));
 ev(c,'soloEnterSingleDeviceMode()');
 ok('一台モードへ切り替えるとアカウント編成を使わず未ログインにする',ev(c,'SOLO_ACCOUNT.mode')==='single'&&ev(c,'PF.name')===null&&ev(c,'CG_NO_PERSIST')===true&&!/onclick="SCR='lobby'/.test(c._els.app._h),JSON.stringify({mode:ev(c,'SOLO_ACCOUNT.mode'),name:ev(c,'PF.name'),noPersist:ev(c,'CG_NO_PERSIST'),html:c._els.app._h.slice(0,500)}));
 ok('一台モードへ移るとアカウントの端末ログイントークンも消える',!('cg_account_token' in store));
 c._els.pfname={value:'一時アカウント'};ev(c,'pfCreate()');
 ok('一台モードで作った名前・編成はlocalStorageへ書かれない',!('cg_profiles' in store)&&!('cg_cur' in store));
}

// ───── ⑤ プレイヤー名とデッキの紐づけ ─────
{const store={};let c=makeCtx(store);
 ok('初期画面にアカウント登録・ログインと一台モードの選択肢が出る',/アカウントモード/.test((ev(c,'render()'),c._els.app._h))&&/cgAccountName/.test(c._els.app._h)&&/一台モード/.test(c._els.app._h)&&!/対戦開始/.test(c._els.app._h));
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
 {const tempStore={};const tmp=makeCtx(tempStore);ev(tmp,'soloEnterSingleDeviceMode()');tmp._els.pfname={value:'一時ユーザー'};ev(tmp,'pfCreate()');
  ok('一台モードのプロフィールはメモリ内で使える',ev(tmp,'PF.name')==='一時ユーザー'&&ev(tmp,'CG_NO_PERSIST')===true&&ev(tmp,'readProfiles().some(x=>x.name===\"一時ユーザー\")'));
  ok('一台モードではプロフィールをlocalStorageへ保存しない',!('cg_profiles' in tempStore)&&!('cg_cur' in tempStore));
  const tmpReload=makeCtx(tempStore);ok('一台モードの名前は再読み込みすると残らない',ev(tmpReload,'PF.name')===null);
 }
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
 ok('P1視点：自分(下側)の薄いダイスは上へ・突進は上へ／相手(上側)は下へ',/ghosts top/.test(h(0,0))&&/class="ch(?: [^"]*)?\bup\b/.test(h(0,0))&&/ghosts bot/.test(h(1,0))&&/class="ch(?: [^"]*)?\bdn\b/.test(h(1,0)));
 ok('P2視点：自分(下側＝プレイヤー2)の薄いダイスは上へ・突進は上へ／相手(上側)は下へ',/ghosts top/.test(h(1,1))&&/class="ch(?: [^"]*)?\bup\b/.test(h(1,1))&&/ghosts bot/.test(h(0,1))&&/class="ch(?: [^"]*)?\bdn\b/.test(h(0,1)));}

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

// ───── 状態異常・デバフ表示と実処理の整合性 ─────
{
 const c=makeCtx();
 let statusHtml='';
 try {
  ev(c,`startMatch();(()=>{const mk=n=>mkField(mkC({name:n,slot:1,hp:50,spd:[1,1],ps:[]}));const x=mk('デバフ確認'),music=mk('音楽所持者'),blackening=mk('黒化所持者');x.abn=[{id:'gaze'}];x.abnState={skipThisTurn:true,skipNextTurn:true,iceLocked:true,iceShard:2,speedDownNow:1,speedDownNext:4,hiveMarks:{bee:3},requestMarks:{req:2},fairyDamageTaken:10};music.abn=[{id:'music'}];music.abnState={musicDmgTaken:4};blackening.abn=[{id:'blackening'}];S.p[0].chars=[x];S.p[1].chars=[music,blackening];return true})()`);
  statusHtml=ev(c,'chHTML(0,0,0)');
 } catch(e) { statusHtml=String(e); }
 ok('行動不能・凍結・氷の欠片・速度低下・蜂の標的・依頼対象・被ダメージ増加がデバフ欄に表示される',
  ['行動不能','凍結','氷の欠片','速度低下','蜂の標的','依頼対象','被ダメージ増加','眼差し','音楽の影響','黒化の影響'].every(x=>statusHtml.includes(x)),statusHtml.slice(0,900));
}
{
 const c=makeCtx();let res={};
 try {
  res=JSON.parse(ev(c,`(()=>{startMatch();const mk=n=>mkField(mkC({name:n,slot:1,hp:80,spd:[1,1],ps:[]}));const A=mk('攻撃側'),B=mk('標的');S.p[0].chars=[A];S.p[1].chars=[B];A.abnState={};B.abnState={};S.turn=1;S.dm={};S.ev=[];S.turnDamageTeam=[false,false];A.card={n:'テスト攻撃',c:0,d:[]};B.abnState.hiveMarks={bee:4};const before=B.hp;hit(0,1,B,10,A,{t:'a',r:[1,1]});const marked=before-B.hp;const C=mk('標的なし'),D=mk('別の攻撃側');S.p[0].chars=[D];S.p[1].chars=[C];D.abnState={};C.abnState={};S.dm={};S.ev=[];S.turnDamageTeam=[false,false];D.abnState.hiveMarks={bee:4};D.card={n:'テスト攻撃',c:0,d:[]};const before2=C.hp;hit(0,1,C,10,D,{t:'a',r:[1,1]});return JSON.stringify({marked,unmarked:before2-C.hp,log:S.log.filter(x=>x.includes('蜂の標的'))})})()`));
 } catch(e) {res={error:String(e)}}
 ok('蜂の標的は標的キャラが受けるダメージを増やし、標的キャラの与ダメージは増やさない',res.marked===14&&res.unmarked===10,JSON.stringify(res));
}
{
 const c=makeCtx();let res={};
 try {
  res=JSON.parse(ev(c,`(()=>{startMatch();const mk=n=>mkField(mkC({name:n,slot:1,hp:40,spd:[1,1],ps:[]}));const A=mk('A'),B=mk('B');S.p[0].chars=[A];S.p[1].chars=[B];B.abnState={};B.st.cold=1;const cold=hasStatusAbn(B);B.st.cold=0;B.st.spore=1;const spore=hasStatusAbn(B);B.st.spore=0;B.abnState.skipThisTurn=true;const incap=hasStatusAbn(B);let coldCond=false,sporeCond=false,incapCond=false;try{condOk(['foeSt','cold'],'test');condOk(['foeStGe','spore',2],'test');condOk(['foeSt','incap'],'test');B.st.cold=1;coldCond=condTest(['foeSt','cold'],{A,B,dmg:0});sporeCond=condTest(['foeStGe','spore',2],{A,B,dmg:0});incapCond=condTest(['foeSt','incap'],{A,B,dmg:0});}catch(e){}B.st.spore=2;sporeCond=condTest(['foeStGe','spore',2],{A,B,dmg:0});return JSON.stringify({cold,spore,incap,coldCond,sporeCond,incapCond})})()`));
 } catch(e) {res={error:String(e)}}
 ok('寒気・胞子・行動不能も状態異常判定に含まれ、寒気/胞子を条件として指定できる',res.cold&&res.spore&&res.incap&&res.coldCond&&res.sporeCond&&res.incapCond,JSON.stringify(res));
}


// ───── 新規追加・変更仕様：レイホン、ツヴァイ、リアン、広域攻撃 ─────
{
 const c=makeCtx();
 const defs=ev(c,`(()=>{const iso=CHARS.find(x=>x.name==='イサドラ'),jul=CHARS.find(x=>x.name==='ジュリア'),ray=CHARS.find(x=>x.name==='レイホン'),lian=CHARS.find(x=>x.name==='リアン'),old=SKILLS.find(x=>x.n==='超絶猛虎殺撃乱斬'),quick=SKILLS.find(x=>x.n==='快刀亂麻');return {iso:iso.ps,jul:jul.ps,rayRights:ray.actionRights,lian:{title:lian.title,size:lian.size,slot:lian.slot,rights:lian.actionRights,hp:lian.hp},old:old.d.map(x=>({t:x.t,r:x.r,fx:x.fx})),quick:{c:quick.c,aoe:quick.aoe,once:quick.once,d:quick.d.map(x=>({t:x.t,r:x.r}))},reload:SPECIAL_CARD_DEFS.reload.trigger,furioso:SPECIAL_CARD_DEFS.furiosoReplica.d.map(x=>({r:x.r,ignore:!!x.__ignoreBuffDebuffs}))}})()`);
 ok('ツヴァイ2人の先頭パッシブと「あなたの盾」+2が定義されている',defs.iso[0]==='twinBlade'&&defs.iso.includes('yourshield')&&defs.iso.includes('ailres')&&defs.jul[0]==='yourshield'&&defs.jul.includes('ailres')&&ev(c,'PAS.ailres.k')==='def'&&ev(c,'PAS.ailres.v')===2,JSON.stringify(defs));
 ok('レイホンは行動権2を維持し、「快刀亂麻」と3ダイス版「超絶猛虎殺撃乱斬」が定義されている',defs.rayRights===2&&defs.old.length===3&&defs.old[0].r[0]===7&&defs.old[2].r[0]===12&&defs.quick.c===5&&defs.quick.aoe==='sum'&&defs.quick.once&&defs.quick.d.length===1&&defs.quick.d[0].r[0]===15&&defs.quick.d[0].r[1]===20);
 ok('リアンが2枠・帰属枠0・行動権1で定義されている',defs.lian.title==='人差し指:神託代行者'&&defs.lian.size===2&&defs.lian.slot===0&&defs.lian.rights===1&&defs.lian.hp<67&&defs.lian.hp>=55,JSON.stringify(defs.lian));
 ok('「再装填」は装着時発動として定義されている',defs.reload==='equip');
 ok('Furioso-Replicaは9ダイスで、先頭8個が3〜6かつバフ・デバフ無視、9個目が5〜10',defs.furioso.length===9&&defs.furioso.slice(0,8).every(x=>x.r[0]===3&&x.r[1]===6&&x.ignore)&&defs.furioso[8].r[0]===5&&defs.furioso[8].r[1]===10&&!defs.furioso[8].ignore,JSON.stringify(defs.furioso));

 const rayCtx=makeCtx();
 const rayResult=ev(rayCtx,`(()=>{startMatch();const r=mkField(mkC(byKey['レイホン']));S.p[0].chars=[r];S.p[0].deck=[{n:'超絶猛虎殺撃乱斬'},{n:'別カード'}];S.p[0].disc=[{n:'超絶猛虎殺撃乱斬'}];S.p[0].hand=[{n:'超絶猛虎殺撃乱斬'}];S.p[0].gone=0;S.turn=1;PK.tianTui.turn(r,PAS.tianTui,0);return {deck:S.p[0].deck.map(x=>x.n),disc:S.p[0].disc.map(x=>x.n),hand:S.p[0].hand.map(x=>x.n),gone:S.p[0].gone,quick:S.p[0].deck.some(x=>x.n==='快刀亂麻'),special:S.p[0].specialHand.map(x=>x.id)}})()`);
 ok('天退星は旧カードをデッキ・捨て札・手札から消滅させ、快刀亂麻をデッキに追加する',rayResult.deck.includes('快刀亂麻')&&!rayResult.deck.includes('超絶猛虎殺撃乱斬')&&!rayResult.disc.includes('超絶猛虎殺撃乱斬')&&!rayResult.hand.includes('超絶猛虎殺撃乱斬')&&rayResult.gone===3&&!rayResult.special.includes('tianTui'),JSON.stringify(rayResult));

 const reloadCtx=makeCtx();
 const reloadResult=ev(reloadCtx,`(()=>{startMatch();const r=mkField(mkC(byKey['レイホン']));r.abnState={tigerBullet:8,mightyTigerBullet:0};S.p[0].chars=[r];S.p[0].specialHand=[{...SPECIAL_CARD_DEFS.reload}];S.phase='decide';S.order=[0,1];S.stage=0;const ok=assignSpecial(0,0);return {ok,tiger:r.abnState.tigerBullet,mighty:r.abnState.mightyTigerBullet,gone:S.p[0].gone,left:S.p[0].specialHand.length}})()`);
 ok('再装填は装着時に従来どおり虎標弾を消滅させ、猛虎標弾5を得る',reloadResult.ok&&reloadResult.tiger===0&&reloadResult.mighty===5&&reloadResult.gone===1&&reloadResult.left===0,JSON.stringify(reloadResult));

 const lianCtx=makeCtx();
 const lianResult=ev(lianCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン'])),enemy=mkField(mkC({name:'敵',slot:0,hp:100,spd:[1,1],ps:[]}));S.p[0].chars=[c];S.p[1].chars=[enemy];S.p[0].hand=[SKILLS.find(x=>x.n==='斬撃')];PK.indexFinger.turn(c,PAS.indexFinger,0);const target=enemy.abnState.directiveTargetBy==='0:0',name=c.abnState.directiveCardName;c.abnState.directiveBlessing=0;c.abnState.directiveResult=2;resolveIndexFingerCommands();const fullBase=c.abnState.directiveBlessing;c.abnState.directiveBlessing=15;c.abnState.directiveResult=2;resolveIndexFingerCommands();const blessing=c.abnState.directiveBlessing;c.abnState.directiveResult=0;resolveIndexFingerCommands();const penalty=c.abnState.directiveTakenBonus;c.abnState.directiveBlessing=0;c.abnState.directiveResult=1;resolveIndexFingerCommands();const partialGain=c.abnState.directiveBlessing;return {target,name,hand:S.p[0].hand.map(x=>x.n),fullBase,blessing,penalty,partialGain}})()`);
 ok('人差し指はランダム敵を指定し、手札のカード名を指令カードにする',lianResult.target&&lianResult.name==='斬撃'&&lianResult.hand.includes('斬撃'),JSON.stringify(lianResult));
 ok('カドゥケウスは両達成+7（15以上なら+11）、片方達成+2、未達成で永続被ダメージ+1',lianResult.fullBase===7&&lianResult.blessing===26&&lianResult.penalty===1&&lianResult.partialGain===2,JSON.stringify(lianResult));

 const reverseIndexMatchCtx=makeCtx();
 const reverseIndexMatchResult=ev(reverseIndexMatchCtx,`(()=>{startMatch();const lian=mkField(mkC(byKey['リアン'])),bee=mkField(mkC({name:'働き蜂',slot:0,hp:100,spd:[1,1],ps:[]}));S.p[0].chars=[lian];S.p[1].chars=[bee];S.turn=1;S.turnDamageTeam=[false,false];lian.sp=1;bee.sp=10;lian.abnState={directiveTargetPi:1,directiveTargetCi:0,directiveCardName:'指定カード',directiveBlessing:0,directiveResult:0};lian.card={n:'指定カード',c:0,d:[D('d',20,20)]};lian.tgt=0;lian.used=false;bee.card={n:'働き蜂の攻撃',c:0,d:[D('a',1,1)]};bee.tgt=0;bee.used=false;combat();return {blessing:lian.abnState.directiveBlessing,penalty:lian.abnState.directiveTakenBonus||0,log:S.log.filter(x=>x.includes('指令'))}})()`);
 ok('敵側から先に攻撃してリアンが防御側として指令対象とマッチした場合も、指定カードの指令達成として加護+7を得る',reverseIndexMatchResult.blessing===7&&reverseIndexMatchResult.penalty===0,JSON.stringify(reverseIndexMatchResult));

 const oracleCtx=makeCtx();
 const oracleResult=ev(oracleCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン']));S.p[0].chars=[c];c.abnState={directiveBlessing:30};c.abnState.directiveComposure=true;PK.oracle.turn(c,PAS.oracle,0);return {burn:c.st.burn,bleed:c.st.bleed,blessing:c.abnState.directiveBlessing,special:S.p[0].specialHand.map(x=>x.id)}})()`);
 ok('指令沈着は毎ターン火傷3・出血3を付与し、加護30でFurioso-Crescendoを追加しても使用までは消費しない',oracleResult.burn===3&&oracleResult.bleed===3&&oracleResult.blessing===30&&oracleResult.special.includes('furiosoCrescendo'),JSON.stringify(oracleResult));

 const matchCtx=makeCtx();
 const matchResult=ev(matchCtx,`(()=>{startMatch();const a=mkField(mkC(byKey['イサドラ'])),b=mkField(mkC({name:'敵',slot:0,hp:100,spd:[1,1],ps:[]}));a.hp=30;S.p[0].chars=[a];S.p[1].chars=[b];S.dm={};S.ev=[];S.fr=[];S.pv=0;S.turnDamageTeam=[false,false];a.card={n:'テスト',c:0,d:[D('a',10,10)]};b.card={n:'テスト防御',c:0,d:[D('d',1,1)]};S.turn=1;const old=a.hp;doMatch(0,a,1,b,[D('a',10,10)],[D('d',1,1)]);return {delta:a.hp-old,log:S.log.some(x=>x.includes('ツヴァイの剣術'))}})()`);
 ok('ツヴァイの剣術はマッチ勝利時にHP1〜2を回復する',matchResult.delta>=1&&matchResult.delta<=2&&matchResult.log,JSON.stringify(matchResult));

 const aoeCtx=makeCtx();
 const aoeResult=ev(aoeCtx,`(()=>{startMatch();const a=mkField(mkC({name:'広域攻撃者',slot:0,hp:1000,spd:[1,1],ps:[]})),b=mkField(mkC({name:'敵1',slot:0,hp:1000,spd:[1,1],ps:[]})),d=mkField(mkC({name:'敵2',slot:0,hp:1000,spd:[1,1],ps:[]}));S.p[0].chars=[a];S.p[1].chars=[b,d];S.turnDamageTeam=[false,false];b.bf.guard=100;d.bf.guard=100;S.turn=1;a.card={n:'全体攻撃',c:0,aoe:'individual',d:[D('a',10,10),D('a',10,10)]};a.tgt=0;a.used=false;combat();const frames=S.fr.filter(f=>f.lu.some(x=>x[0]===0&&x[1]===0));return {count:frames.length,attacker:frames[0]&&frames[0].lu.some(x=>x[0]===0&&x[1]===0),victims:frames[0]&&frames[0].sh.map(x=>x.join(':')).sort(),log:S.log.filter(x=>x.includes('広域攻撃：個別')).length}})()`);
 ok('広域攻撃は複数ダイス・複数対象を一括アニメーションし、軽減でHPが減らなくても成功した対象と攻撃者を同じフレームで動かす',aoeResult.count===1&&aoeResult.attacker&&aoeResult.victims.join(',')==='1:0,1:1'&&aoeResult.log>=4,JSON.stringify(aoeResult));

 const randomDirectiveCtx=makeCtx();
 const randomDirectiveResult=ev(randomDirectiveCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン'])),a=mkField(mkC({name:'敵A',slot:0,hp:1000,spd:[1,1],ps:[]})),b=mkField(mkC({name:'敵B',slot:0,hp:1000,spd:[1,1],ps:[]}));S.p[0].chars=[c];S.p[1].chars=[a,b];S.turn=1;S.turnDamageTeam=[false,false];c.abnState={directiveTargetPi:1,directiveTargetCi:0,directiveCardName:'指定カード',directiveBlessing:0,directiveResult:0};c.card={n:'Furioso-Replica',c:0,aoe:'random',__furiosoReplica:true,d:[D('a',1,1),D('a',1,1)]};c.tgt=0;c.used=false;const old=Math.random;Math.random=()=>0.999999;try{combat()}finally{Math.random=old}return {blessing:c.abnState.directiveBlessing,penalty:c.abnState.directiveTakenBonus||0}})()`);
 ok('乱射は実際に指令対象へ着弾した場合だけ指令達成として扱う',randomDirectiveResult.blessing===0&&randomDirectiveResult.penalty===1,JSON.stringify(randomDirectiveResult));

 const furiosoCtx=makeCtx();
 const furiosoResult=ev(furiosoCtx,`(()=>{startMatch();const a=mkField(mkC(byKey['リアン'])),b=mkField(mkC({name:'防御敵',slot:0,hp:10000,spd:[1,1],ps:[]}));S.p[0].chars=[a];S.p[1].chars=[b];S.turn=2;a.abnState={directiveBlessing:35};a.card={...SPECIAL_CARD_DEFS.furiosoReplica,__furiosoReplica:true,d:SPECIAL_CARD_DEFS.furiosoReplica.d.map(x=>({...x,r:[...x.r]}))};a.tgt=0;a.used=false;b.card={n:'強い守備',c:0,d:[D('d',100,100)]};b.tgt=0;b.used=false;combat();const nine=S.log.map(x=>{const m=x.match(/ダイス9\\[(\\d+)\\]/);return m?Number(m[1]):null}).find(x=>x!==null);const attackFrames=S.fr.filter(f=>f.lu.some(x=>x[0]===0&&x[1]===0));return {nine,half:S.log.some(x=>x.includes('半分の')),composure:a.abnState.directiveComposure,blessing:a.abnState.directiveBlessing,frames:attackFrames.length,victims:attackFrames[0]&&attackFrames[0].sh.length}})()`);
 ok('Furioso-Replicaの半分ダメージは命中回数に数えず、9ダイスを1つずつ演出し、使用後に加護30を消費して初回は指令沈着を得る',furiosoResult.half&&furiosoResult.composure&&furiosoResult.nine>=5&&furiosoResult.nine<=10&&furiosoResult.frames===9&&furiosoResult.victims===1&&furiosoResult.blessing===5,JSON.stringify(furiosoResult));

 const capCtx=makeCtx();
 const capResult=ev(capCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン']));S.p[0].chars=[c];c.abnState={directiveBlessing:29,directiveResult:2};resolveIndexFingerCommands();const atCap=c.abnState.directiveBlessing;c.abnState.directiveBlessing=30;c.abnState.directiveResult=1;resolveIndexFingerCommands();const stillCap=c.abnState.directiveBlessing;c.abnState.directiveBlessing=45;c.abnState.directiveResult=0;resolveIndexFingerCommands();return {atCap,stillCap,normalized:c.abnState.directiveBlessing}})()`);
 ok('指令の加護は獲得時に30を超えず、既存値が上限超過していても30に正規化される',capResult.atCap===30&&capResult.stillCap===30&&capResult.normalized===30,JSON.stringify(capResult));

 const crescendoCtx=makeCtx();
 const crescendoResult=ev(crescendoCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン'])),enemy=mkField(mkC({name:'敵',slot:0,hp:1000,spd:[1,1],ps:[]}));S.p[0].chars=[c];S.p[1].chars=[enemy];c.abnState={directiveBlessing:30,directiveComposure:true};PK.oracle.turn(c,PAS.oracle,0);const special=S.p[0].specialHand[0];c.bf.atk=4;c.bf.roll=3;c.bf.rolldn=2;const old=Math.random;Math.random=()=>0.999999;let roll;try{roll=abnormalityRoll(c,special.d[0])}finally{Math.random=old}S.phase='decide';S.order=[0,1];S.stage=0;const used=assignSpecial(0,0);return {id:special.id,name:special.n,ranges:special.d.map(d=>d.r),ignore:special.d.some(d=>d.__ignoreBuffDebuffs),roll,used,assigned:c.card&&c.card.n,flags:c.card&&{special:c.card.__furiosoSpecial,crescendo:c.card.__furiosoCrescendo}}})()`);
 ok('指令沈着後はFurioso-Crescendoを追加し、全ダイスが出目+1かつバフ・デバフの影響を受ける',crescendoResult.id==='furiosoCrescendo'&&crescendoResult.name==='Furioso-Crescendo'&&crescendoResult.ranges.slice(0,8).every(r=>r[0]===4&&r[1]===7)&&crescendoResult.ranges[8][0]===6&&crescendoResult.ranges[8][1]===11&&!crescendoResult.ignore&&crescendoResult.roll===12&&crescendoResult.used&&crescendoResult.assigned==='Furioso-Crescendo'&&crescendoResult.flags.special&&crescendoResult.flags.crescendo,JSON.stringify(crescendoResult));

 const buffIgnoreCtx=makeCtx();
 const buffIgnoreResult=ev(buffIgnoreCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン']));S.p[0].chars=[c];c.bf.atk=4;c.bf.roll=3;c.bf.rolldn=2;c.abnState={teamDiceBonus:5,nextAtk:7};const ignored=abnormalityRoll(c,{t:'a',r:[5,5],__ignoreBuffDebuffs:true});const nextAfterIgnored=c.abnState.nextAtk;const normal=abnormalityRoll(c,{t:'a',r:[5,5]});return {ignored,nextAfterIgnored,normal}})()`);
 ok('先頭8ダイスはバフ・デバフを無視し、無視した一時バフを消費せず最終ダイス等へ残す',buffIgnoreResult.ignored===5&&buffIgnoreResult.nextAfterIgnored===7&&buffIgnoreResult.normal===22,JSON.stringify(buffIgnoreResult));

 const auraCtx=makeCtx();
 const auraResult=ev(auraCtx,`(()=>{startMatch();const c=mkField(mkC(byKey['リアン']));S.p[0].chars=[c];S.p[0].specialHand=[{...SPECIAL_CARD_DEFS.furiosoCrescendo}];S.phase='decide';S.order=[0,1];S.stage=0;return chHTML(0,0,0).includes('furioso-ready')})()`);
 ok('特殊カード欄にFurioso系カードを保有している間、リアンに専用エフェクトが付く',auraResult);

 const legendCtx=makeCtx();
 const legendResult=ev(legendCtx,`(()=>{startMatch();const h=legendHTML();return {hidden:['氷の欠片','蜂の標的','依頼対象','音楽の影響','黒化の影響','眼差し','魅了','プレゼント','日傘の反射','妖精の世話'].every(x=>!h.includes(x))&&STN.takenPlus.legend===false,ordinary:['火傷','出血','破裂','振動','行動不能','速度低下','指令対象','指令カード','指令の加護'].every(x=>h.includes(x))}})()`);
 ok('幻想体カード由来の効果は一覧から隠し、通常状態異常とリアンの効果は表示する',legendResult.hidden&&legendResult.ordinary,JSON.stringify(legendResult));
}

// ───── シャオ「龍生九子」リワーク ─────
{
 const c=makeCtx();
 const lvCtx=ev(c,`(()=>{startMatch();const shao=mkField(mkC(byKey['シャオ']));shao.ps=[PAS.emostack];S.p[0].chars=[shao];const attack={t:'a',r:[5,5]},defense={t:'d',r:[5,5]};S.p[0].lv=1;const lv1=[abnormalityRoll(shao,attack),abnormalityRoll(shao,defense)];S.p[0].lv=2;const lv2=[abnormalityRoll(shao,attack),abnormalityRoll(shao,defense)];S.p[0].lv=4;const lv4=[abnormalityRoll(shao,attack),abnormalityRoll(shao,defense)];return {lv1,lv2,lv4}})()`);
 ok('龍生九子は感情Lv2で攻撃ダイス+1、Lv4で全ダイス+2に強化される',lvCtx.lv1.join(',')==='5,5'&&lvCtx.lv2.join(',')==='6,5'&&lvCtx.lv4.join(',')==='7,7',JSON.stringify(lvCtx));

 const hitCtx=makeCtx();
 const hitResult=ev(hitCtx,`(()=>{startMatch();const shao=mkField(mkC(byKey['シャオ'])),enemy=mkField(mkC({name:'敵',slot:0,hp:100,spd:[1,1],ps:[]}));shao.ps=[PAS.emostack];S.p[0].chars=[shao];S.p[1].chars=[enemy];S.p[0].lv=2;S.dm={};S.ev=[];S.fr=[];S.pv=0;S.turn=1;S.turnDamageTeam=[false,false];hit(0,1,enemy,5,shao,D('a',5,5));return {burn:enemy.st.burn,hp:enemy.hp}})()`);
 ok('龍生九子は感情Lv2以上で攻撃ダイス的中時に火傷1を付与する',hitResult.burn===1&&hitResult.hp===95,JSON.stringify(hitResult));

 const startCtx=makeCtx();
 const startResult=ev(startCtx,`(()=>{startMatch();const shao=mkField(mkC(byKey['シャオ'])),ally=mkField(mkC({name:'味方',slot:0,hp:100,spd:[1,1],ps:[]})),enemy=mkField(mkC({name:'敵',slot:0,hp:100,spd:[1,1],ps:[]}));S.p[0].chars=[shao,ally];S.p[1].chars=[enemy];S.p[0].lv=4;S.turn=3;shao.abnState={};PK.emostack.turn(shao,PAS.emostack,0);const first=[shao.st.burn,ally.st.burn,enemy.st.burn];PK.emostack.turn(shao,PAS.emostack,0);return {first,second:[shao.st.burn,ally.st.burn,enemy.st.burn],cards:S.p[0].specialHand.map(x=>x.id).sort(),granted:shao.abnState.xiaoSpecialCardsGranted}})()`);
 ok('感情Lv4のターン開始時に場の生存者全員へ火傷3を1回付与し、三種の特殊カードを追加する',startResult.first.join(',')==='3,3,3'&&startResult.second.join(',')==='3,3,3'&&startResult.cards.join(',')==='xiaoPulao,xiaoTaotie,xiaoYazi'&&startResult.granted,JSON.stringify(startResult));

 const cardCtx=makeCtx();
 const cardDefs=ev(cardCtx,`(()=>({pulao:SPECIAL_CARD_DEFS.xiaoPulao,yazi:SPECIAL_CARD_DEFS.xiaoYazi,taotie:SPECIAL_CARD_DEFS.xiaoTaotie}))()`);
 ok('蒲牢・睚眦・饕餮のカードコスト、広域攻撃方式、ダイス値と効果が定義されている',cardDefs.pulao.c===3&&cardDefs.pulao.aoe==='individual'&&cardDefs.pulao.d[0].r.join(',')==='6,9'&&cardDefs.pulao.d[0].fx[0][0]==='rolldn'&&cardDefs.yazi.c===5&&cardDefs.yazi.aoe==='individual'&&cardDefs.yazi.d.map(d=>d.r.join(',')).join(';')==='5,10;4,9'&&cardDefs.yazi.on[0][0]==='rollup'&&cardDefs.yazi.on[0][1]===2&&cardDefs.taotie.c===7&&cardDefs.taotie.aoe==='sum'&&cardDefs.taotie.d[0].r.join(',')==='25,30'&&cardDefs.taotie.d[0].fx[0][1]===8,JSON.stringify(cardDefs));

 const areaCtx=makeCtx();
 const areaResult=ev(areaCtx,`(()=>{startMatch();const shao=mkField(mkC(byKey['シャオ'])),e1=mkField(mkC({name:'敵1',slot:0,hp:500,spd:[1,1],ps:[]})),e2=mkField(mkC({name:'敵2',slot:0,hp:500,spd:[1,1],ps:[]}));shao.ps=[PAS.emostack];S.p[0].chars=[shao];S.p[1].chars=[e1,e2];S.p[0].lv=4;shao.abnState={xiaoSpecialCardsGranted:true};S.p[0].specialHand=[{...SPECIAL_CARD_DEFS.xiaoPulao},{...SPECIAL_CARD_DEFS.xiaoYazi},{...SPECIAL_CARD_DEFS.xiaoTaotie}];S.p[0].cost=10;S.p[0].max=10;S.phase='decide';S.order=[0,1];S.stage=0;S.turnDamageTeam=[false,false];const assignOk=assignSpecial(0,0);pickTgt(0);S.turn=1;combat();const pulao={hp:[e1.hp,e2.hp],down:[e1.nx.rolldn,e2.nx.rolldn],assigned:shao.card&&shao.card.n};nextTurn();return {assignOk,pulao,remaining:S.p[0].specialHand.map(x=>x.id),gone:S.p[0].gone}})()`);
 ok('蒲牢は特殊カードから装着でき、広域個別で敵へ次ターンダイス値-1を与え、使用後に消滅する',areaResult.assignOk&&areaResult.pulao.down.every(x=>x===1)&&areaResult.remaining.join(',')==='xiaoYazi,xiaoTaotie'&&areaResult.gone===1,JSON.stringify(areaResult));

 const yaziCtx=makeCtx();
 const yaziResult=ev(yaziCtx,`(()=>{startMatch();const shao=mkField(mkC(byKey['シャオ'])),enemy=mkField(mkC({name:'敵',slot:0,hp:500,spd:[1,1],ps:[]}));shao.ps=[PAS.emostack];S.p[0].chars=[shao];S.p[1].chars=[enemy];S.p[0].lv=4;shao.abnState={xiaoSpecialCardsGranted:true};S.p[0].specialHand=[{...SPECIAL_CARD_DEFS.xiaoYazi}];S.p[0].cost=10;S.p[0].max=10;S.phase='decide';S.order=[0,1];S.stage=0;S.turnDamageTeam=[false,false];const assigned=assignSpecial(0,0);pickTgt(0);S.turn=1;combat();return {assigned,roll:shao.nx.roll,burn:enemy.st.burn,hp:enemy.hp}})()`);
 ok('睚眦は使用時に次ターンダイス値+2、2ダイスの的中で火傷を付与する',yaziResult.assigned&&yaziResult.roll===2&&yaziResult.burn===2&&yaziResult.hp<500,JSON.stringify(yaziResult));

 const taotieCtx=makeCtx();
 const taotieResult=ev(taotieCtx,`(()=>{startMatch();const shao=mkField(mkC(byKey['シャオ'])),enemy=mkField(mkC({name:'敵',slot:0,hp:500,spd:[1,1],ps:[]}));shao.ps=[PAS.emostack];S.p[0].chars=[shao];S.p[1].chars=[enemy];S.p[0].lv=4;shao.abnState={xiaoSpecialCardsGranted:true};S.p[0].specialHand=[{...SPECIAL_CARD_DEFS.xiaoTaotie}];S.p[0].cost=10;S.p[0].max=10;S.phase='decide';S.order=[0,1];S.stage=0;S.turnDamageTeam=[false,false];const assigned=assignSpecial(0,0);pickTgt(0);S.turn=1;combat();return {assigned,burn:enemy.st.burn,hp:enemy.hp}})()`);
 ok('饕餮は合算25〜30の単ダイスで的中時に火傷8を付与する',taotieResult.assigned&&taotieResult.burn===6&&taotieResult.hp<500,JSON.stringify(taotieResult));
}

// ───── 赤い霧E.G.Oの帰属・発現テスト ─────
{
 const egoCtx=makeCtx();
 const egoResult=ev(egoCtx,`(()=>{startMatch();const red=mkField(mkC(byKey['カーリー'])),m=mkField(mkC(byKey['ロボトミーE.G.O:ミミック'])),d=mkField(mkC(byKey['ロボトミーE.G.O:ダ・カーポ']));S.p[0].chars=[red,m,d];S.p[0].lv=3;hook('turn',m,0);hook('turn',d,0);return {red:red.at,mp:m.ps.map(x=>x.n),dp:d.ps.map(x=>x.n),cards:S.p[0].specialHand.map(x=>x.id)}})()`);
 ok('ミミック／ダ・カーポは赤い霧属性を持つパッシブ保持者として追加される',egoResult.red.includes('RedMist')&&egoResult.mp.includes('ミミック')&&egoResult.dp.includes('ダ・カーポ'),JSON.stringify(egoResult));
 ok('赤い霧属性のパッシブ保有者が感情レベル3以上なら両E.G.O発現カードが追加される',egoResult.cards.includes('mimicAwakening')&&egoResult.cards.includes('daCapoAwakening'),JSON.stringify(egoResult));
 const ownerAttrCtx=makeCtx();
 const ownerAttrResult=ev(ownerAttrCtx,`(()=>{startMatch();const red=mkField(mkC(byKey['カーリー'])),m=mkField(mkC(byKey['ロボトミーE.G.O:ミミック'])),d=mkField(mkC(byKey['ロボトミーE.G.O:ダ・カーポ']));m.at=[];d.at=[];S.p[0].chars=[red,m,d];S.p[0].lv=3;hook('turn',m,0);hook('turn',d,0);return S.p[0].specialHand.map(x=>x.id)})()`);
 ok('味方にカーリーがいても、パッシブ保有者自身が赤い霧属性でなければ発現カードは追加されない',ownerAttrResult.length===0,JSON.stringify(ownerAttrResult));
 const visibleBuffCtx=makeCtx();
 const visibleBuffResult=ev(visibleBuffCtx,`(()=>{startMatch();const m=mkField(mkC(byKey['ロボトミーE.G.O:ミミック'])),d=mkField(mkC(byKey['ロボトミーE.G.O:ダ・カーポ']));S.p[0].chars=[m,d];m.abnState={mimicBuff:true};d.abnState={daCapoBuff:true};const mh=chHTML(0,0,0),dh=chHTML(0,1,0),legend=legendHTML();return {m:mh.includes('E.G.O発現:ミミック'),d:dh.includes('E.G.O発現:ダ・カーポ'),ml:legend.includes('E.G.O発現:ミミック'),dl:legend.includes('E.G.O発現:ダ・カーポ')}})()`);
 ok('ミミック／ダ・カーポの発現バフはキャラクター上に状態異常と同じバッジで表示され、説明一覧にも掲載される',visibleBuffResult.m&&visibleBuffResult.d&&visibleBuffResult.ml&&visibleBuffResult.dl,JSON.stringify(visibleBuffResult));
 const attrDefs=ev(egoCtx,`['mimicAwakening','mimicry','daCapoAwakening','daCapo'].every(id=>SPECIAL_CARD_DEFS[id].at.includes('RedMist'))`);
 ok('E.G.O発現カードと発現後の専用カードに赤い霧限定属性が設定されている',attrDefs);
 const cards=ev(egoCtx,`({mimic:SPECIAL_CARD_DEFS.mimicry.d[0].r,daCapo:SPECIAL_CARD_DEFS.daCapo.d.map(x=>x.r),mimicAwakening:SPECIAL_CARD_DEFS.mimicAwakening.d.map(x=>x.t)})`);
 ok('ミミクリー／ダ・カーポのカードデータが定義されている',cards.mimic[0]===19&&cards.mimic[1]===35&&cards.daCapo.length===3&&cards.mimicAwakening.join(',')==='d,e',JSON.stringify(cards));
}

finish();
function finish(){
 console.log(`\n合格 ${pass} / 失敗 ${fail}`);
 if(fail){console.log('\n失敗した項目：');bad.forEach(b=>console.log(' ・'+b));process.exit(1)}
 console.log('すべて合格しました。');
}
