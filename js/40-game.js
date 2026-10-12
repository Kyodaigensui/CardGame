const key=x=>x.n||x.name,byKey={};
[...SKILLS,...CHARS].forEach(c=>byKey[key(c)]=c);
const defDeck=pool=>{const d={};SKILLS.slice(0,10).forEach(s=>d[s.n]=1);pool.slice(0,5).forEach(c=>d[c.name]=1);return d};   // 初期デッキ：技10＋キャラ5
// ===== プレイヤー名とデッキの保存 =====
// 名前ごとにデッキ2つを、このブラウザ（localStorage）へ保存する。別の端末・別のブラウザへは自動では引き継がれない（バックアップで持ち運べる）
const cleanName=s=>String(s==null?'':s).replace(/[<>&"'`\\\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,12);   // 画面に出す名前：記号を除いて12文字まで
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}};
const readProfiles=()=>{let p=null;try{p=JSON.parse(lsGet('cg_profiles'))}catch(e){}return Array.isArray(p)?p.filter(x=>x&&typeof x.name==='string'):[]};
const writeProfiles=l=>lsSet('cg_profiles',JSON.stringify(l));
const fixDecks=d=>{   // 保存デッキの確認：存在しないカードは除き、枚数が合わなければ初期デッキに戻す
 if(!Array.isArray(d)||d.length<2)return [defDeck(POOL1),defDeck(POOL2)];
 const r=d.slice(0,2).map(x=>{const o={};for(const k in (x||{}))if(Object.prototype.hasOwnProperty.call(byKey,k)&&x[k]>0)o[k]=x[k];return o});
 return r.some(x=>Object.values(x).reduce((a,b)=>a+b,0)!==C.DECK)?[defDeck(POOL1),defDeck(POOL2)]:r;
};
const PF={name:null,msg:''};   // name＝いまのプレイヤー名（未設定なら null）
function loadDecks(){   // いまの名前のデッキを読む
 const cur=lsGet('cg_cur'),pf=readProfiles().find(x=>x.name===cur);
 PF.name=pf?pf.name:null;
 return fixDecks(pf?pf.decks:null);
}
let SCR='home',DK={d:loadDecks(),cur:0,warn:false,sort:'cost'};   // sort：cost＝コスト順 / file＝登録順
const saveDecks=()=>{
 if(!PF.name){DK.warn=true;return}
 const l=readProfiles(),e={name:PF.name,decks:DK.d},i=l.findIndex(x=>x.name===PF.name);
 if(i>=0)l[i]=e;else l.push(e);
 if(!writeProfiles(l))DK.warn=true;
};
function pfUse(name){lsSet('cg_cur',name);DK.d=loadDecks();DK.cur=0;DK.warn=false;PF.msg='';render()}   // 名前を切り替える
function pfCreate(){   // 名前を決めて作る
 const el=document.getElementById('pfname'),n=cleanName(el&&el.value);
 if(!n){PF.msg='名前を入力してください。';render();return}
 const l=readProfiles();
 if(l.some(x=>x.name===n)){PF.msg='その名前はすでにあります。「切り替え」から選んでください。';render();return}
 let old=null;if(!l.length){try{old=JSON.parse(lsGet('cg_decks'))}catch(e){}}   // 旧バージョンで作ったデッキは、最初の名前に引き継ぐ
 l.push({name:n,decks:fixDecks(old)});
 if(!writeProfiles(l)){PF.msg='この環境ではブラウザに保存できません（プライベートモードなど）。';render();return}
 pfUse(n);
}
function pfDelete(){
 if(!PF.name||!confirm(`「${PF.name}」とそのデッキを削除します。よろしいですか？`))return;
 const l=readProfiles().filter(x=>x.name!==PF.name);writeProfiles(l);
 lsSet('cg_cur',l.length?l[0].name:'');DK.d=loadDecks();DK.cur=0;PF.msg='';render();
}
function pfOut(){const e=document.getElementById('pfcode');if(e&&PF.name)e.value=JSON.stringify({v:1,name:PF.name,decks:DK.d})}   // バックアップの書き出し
function pfIn(){   // バックアップの読み込み（同じ名前があれば上書き）
 const e=document.getElementById('pfcode');let o=null;try{o=JSON.parse(e.value)}catch(_){}
 const n=o&&cleanName(o.name);
 if(!n||!Array.isArray(o.decks)||o.decks.length<2){PF.msg='バックアップのコードが正しくありません。';render();return}
 const decks=fixDecks(o.decks),l=readProfiles(),i=l.findIndex(x=>x.name===n);
 if(i>=0&&!confirm(`「${n}」はすでにあります。デッキを上書きしますか？`))return;
 if(i>=0)l[i]={name:n,decks};else l.push({name:n,decks});
 writeProfiles(l);pfUse(n);
}
const dTot=d=>Object.values(d).reduce((a,b)=>a+b,0);
const dChars=d=>Object.entries(d).reduce((a,[k,v])=>a+(isCh(byKey[k])?v:0),0);
const dErr=d=>{const e=[];if(dTot(d)!==C.DECK)e.push(`${C.DECK}枚にしてください（現在${dTot(d)}枚）`);if(dChars(d)<1)e.push('キャラカードを1枚以上入れてください');return e};

let S;
const setCover=i=>{S.cover=NET.on?null:i};   // オンラインでは画面を隠さない
const newP=(name,deck)=>{
 const p={name,chars:[],pool:[],deck:[],disc:[],hand:[],cost:C.COST,max:C.COST,lv:0,coin:0};
 for(const [k,n] of Object.entries(deck).sort(([a],[b])=>a<b?-1:a>b?1:0)){const c=byKey[k];   // キー順に固定（両者で同じ並びにする）
  if(isCh(c))p.pool.push(mkC(c));else for(let i=0;i<n;i++)p.deck.push(c)}
 return p;
};
const draw=(p,n)=>{for(let i=0;i<n;i++){if(!p.deck.length){p.deck=sh(p.disc);p.disc=[]}if(p.deck.length)p.hand.push(p.deck.pop())}};
const used=p=>p.chars.reduce((a,c)=>a+(c.card?c.card.c:0),0);
const act=()=>S.order[S.stage];
const alive=p=>p.chars.filter(c=>c.alive).length;

// 対戦中の状態Sはデッキ定義のコピーから作る。対戦を終える（破棄する）と、帰属・HP・手札などの変化は全て消える
function startMatch(){
 if(dErr(DK.d[0]).length||dErr(DK.d[1]).length)return;
 SCR='match';
 S={turn:0,p:[newP(PF.name||'プレイヤー1',DK.d[0]),newP('プレイヤー2',DK.d[1])],over:null,phase:'setup',sp:0,pick:[],cover:null,msg:'',log:[],order:[0,1],stage:0,leave:false};
 render();
}
const toHome=()=>{netClose();S=null;SCR='home';render()};
function leave(){if(!S.leave){S.leave=true;render()}else toHome()}
const leaveBtn=()=>`<button class="sub" onclick="leave()">${S.leave?'本当に戻る（この対戦は破棄されます）':'ホームへ戻る'}</button>`;
// ===== 初手：場に出すキャラを選ぶ =====
const szOf=c=>c.size||1,pickUsed=()=>S.pick.reduce((a,i)=>a+szOf(S.p[S.sp].pool[i]),0);
function pickCh(i){
 if(NET.on&&S.waitSetup)return;
 const k=S.pick.indexOf(i),c=S.p[S.sp].pool[i];
 if(k>=0){S.pick.splice(k,1);S.msg=''}
 else if(pickUsed()+szOf(c)<=C.FIELD){S.pick.push(i);S.msg=''}
 else S.msg=`場の枠が足りません（${c.name}は${szOf(c)}枠。場は${C.FIELD}枠まで）`;
 render();
}
// 場に出すキャラを確定する（pi＝プレイヤー番号）。オンラインでも「P1→P2の順」で適用して乱数の使い方を揃える
function applySetup(pi,pick){
 const p=S.p[pi];
 p.chars=pick.map(i=>mkField(p.pool[i]));
 p.deck=sh([...p.deck,...p.pool.filter((_,i)=>!pick.includes(i))]);p.pool=[];   // 選ばなかったキャラは山札に戻す
 draw(p,5);
}
function confirmSetup(){
 if(NET.on&&S.waitSetup)return;
 if(!S.pick.length){S.msg='キャラカードを1枚以上選んでください';render();return}
 if(NET.on){NET.picks[NET.me]=[...S.pick];S.waitSetup=true;S.msg='';netSend({t:'setup',pick:NET.picks[NET.me]});render();netTrySetup();return}
 const p=S.p[S.sp];
 applySetup(S.sp,S.pick);S.pick=[];S.msg='';
 if(S.sp===0){S.sp=1;setCover(1);render()}else startTurn();
}
function startTurn(){
 S.turn++;S.msg='';S.sel=null;S.pend=null;S.ask=null;
 S.p.forEach(p=>p.chars.forEach(c=>c.sp=c.alive?R(c.spd[0],c.spd[1])+pv(c,'spd'):0));
 // パッシブの speed フック（例：最強）：素の速度が出そろってから一斉に判定する（持ち主同士で連鎖しない）
 const chaseLog=[],allMax=Math.max(...S.p.flatMap(p=>p.chars.filter(c=>c.alive).map(c=>c.sp))),spNew=new Map();
 S.p.forEach(p=>{
  const al=p.chars.filter(c=>c.alive);
  al.forEach(c=>c.ps.forEach(x=>{
   const h=PK[x.k].speed;if(!h)return;
   const ns=h(c,x,{allMax,team:al});
   if(ns!=null&&(!spNew.has(c)||ns>spNew.get(c).sp))spNew.set(c,{sp:ns,n:x.n});
  }));
 });
 spNew.forEach((r,c)=>{chaseLog.push(`　${c.name}の${r.n}：速度${c.sp}→${r.sp}`);c.sp=r.sp});
 const s=S.p.map(p=>{const a=p.chars.filter(c=>c.alive);return a.length?a.reduce((x,c)=>x+c.sp,0)/a.length:0});
 S.order=s[0]<s[1]?[0,1]:s[0]>s[1]?[1,0]:sh([0,1]);
 S.phase='decide';S.stage=0;setCover(S.order[0]);S.ops=[];
 S.log=[`── ターン${S.turn} ──`,`速度ダイスの平均 P1:${s[0].toFixed(1)} / P2:${s[1].toFixed(1)}　低い${S.p[S.order[0]].name}から行動を決めます`];
 chaseLog.forEach(m=>L(m));
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{
  if(!c.alive)return;
  hook('turn',c,pi);   // 再生・蔵書の加護など（PKの turn フック）
 }));
 render();
 if(NET.on)netAfterTurnStart();
}
// ===== 行動決定 =====
// オンライン中は「自分の手番のときだけ」操作できる。相手の操作の再現中(REPLAY)は通す
const canAct=()=>!NET.on||REPLAY||(!!S&&S.phase==='decide'&&act()===NET.me&&!NET.lost&&!NET.err);
const logOp=o=>{if(NET.on&&!REPLAY)S.ops.push(o)};   // 手番中の操作を記録し、決定時に相手へ送って再現してもらう
function selCard(i){if(!canAct())return;S.sel=S.sel===i?null:i;render()}
function attribute(p,c,hi){
 const card=p.hand[hi];
 if(c.slot<=0){S.msg=`${c.name}には帰属枠が残っていません`;render();return}
 if(!card.ps.length){S.msg='このカードに残りのパッシブはありません';render();return}
 const x=card.ps.shift();c.ps.push({...x,from:card.name});c.slot--;
 run1('init',c,x);   // 帰属した瞬間に1回（頑強なら最大HP+）
 p.hand.splice(hi,1);p.gone=(p.gone||0)+1;   // 帰属したカードは消滅（捨て札・山札には行かない）
 S.sel=null;S.msg=`${card.name}の「${x.n}」を${c.name}に帰属しました。${card.name}は消滅します`;render();
}
function assign(ci,hi){
 if(!canAct())return;logOp(['A',ci,hi]);
 const p=S.p[act()],c=p.chars[ci],card=p.hand[hi];
 if(!c||!c.alive||!card)return;
 if(isCh(card))return attribute(p,c,hi);
 if(card.req&&!c.at.includes(card.req)){S.msg=`「${card.n}」は${ATTR[card.req].n}属性のキャラだけが使えます`;render();return}
 if(used(p)-(c.card?c.card.c:0)+card.c>p.cost){S.msg=`コストが足りません（残り${p.cost-used(p)+(c.card?c.card.c:0)}）`;render();return}
 p.hand.splice(hi,1);if(c.card)p.hand.push(c.card);
 c.card=card;c.tgt=null;S.pend=ci;S.sel=null;S.msg='攻撃対象の相手キャラをクリックしてください';render();
}
function mine(ci){
 if(!canAct())return;
 const p=S.p[act()],c=p.chars[ci];
 if(S.sel!=null)assign(ci,S.sel);else if(c.card){S.pend=ci;S.msg='攻撃対象の相手キャラをクリックしてください';render()}
}
function undoRedir(yi){S.p[1-act()].chars.forEach(z=>{if(z.redirBy===yi){z.tgt=z.tgt0;z.redirBy=null;z.tgt0=null}})}
function unassign(ci,e){e.stopPropagation();if(!canAct())return;logOp(['U',ci]);undoRedir(ci);const c=S.p[act()].chars[ci];if(c.card)S.p[act()].hand.push(c.card);c.card=null;c.tgt=null;if(S.pend===ci)S.pend=null;S.msg='';render()}
function pickTgt(ci){
 if(!canAct())return;logOp(['P',S.pend,ci]);
 if(S.pend==null||!S.p[1-act()].chars[ci].alive)return;
 const yi=S.pend,y=S.p[act()].chars[yi],z=S.p[1-act()].chars[ci];
 undoRedir(yi);
 // 相手の行動が決まっていて、自分の速度が相手より2以上高いなら、相手のマッチ対象を自分に変更できる
 if(z.card&&z.tgt!=null&&z.tgt!==yi&&z.redirBy==null&&!noSpd(z.card)&&!noSpd(y.card)&&y.sp-z.sp>=C.REDIR){S.ask={yi,zi:ci};S.pend=null;S.msg='';render();const q=document.querySelector('.ask');if(q)q.scrollIntoView({block:'center'});return}
 y.tgt=ci;S.pend=null;S.msg='';render();
}
function redir(yes){
 if(!canAct()||!S.ask)return;logOp(['R',yes]);
 const a=S.ask,y=S.p[act()].chars[a.yi],z=S.p[1-act()].chars[a.zi];
 y.tgt=a.zi;
 if(yes){z.tgt0=z.tgt;z.tgt=a.yi;z.redirBy=a.yi}
 S.ask=null;render();
}
const askHTML=()=>{if(!S.ask)return '';const y=S.p[act()].chars[S.ask.yi],z=S.p[1-act()].chars[S.ask.zi];return `<div class="ask"><b>${y.name}</b>（速度${y.sp}）は <b>${z.name}</b>（速度${z.sp}）より速度が${C.REDIR}以上高いので、${z.name}のマッチ対象を${y.name}に変更できます。<br><button class="go" onclick="redir(true)">対象を自分に変更する</button> <button class="sub" onclick="redir(false)">変更しない</button></div>`};
function done(){
 if(!canAct())return;
 if(S.ask){S.msg='マッチ対象を変更するか選んでください';render();return}
 const p=S.p[act()];
 if(p.chars.some(c=>c.alive&&c.card&&c.tgt==null)){S.msg='攻撃対象が未設定のキャラがいます';render();return}
 S.pend=null;S.sel=null;S.msg='';
 if(NET.on&&!REPLAY){netSend({t:'decide',turn:S.turn,stage:S.stage,pi:act(),ops:S.ops});S.ops=[]}   // 決定内容（操作の記録）を相手へ送る
 if(S.stage===0){S.stage=1;setCover(act());render()}else{combat()}
}
// ===== 戦闘 =====
const L=m=>S.log.push(m);
/**
 * 感情レベル上昇に必要なコイン数
 * 自分の場の生存キャラクター数が少ないほど、必要量が減る
 * 感情レベルが高いほど、必要量が増える
 */
const coinNeed = p => {
  const count = p.chars.filter(c => c.alive).length;

  // 1人なら50%、2人なら約67%、3人なら100%
  const peopleRate = Math.max(0.5, Math.min(1, count / 3));

  // 感情レベルが1上がるごとに必要量が25%増加
  const levelRate = 1 + p.lv * 0.25;

  return Math.max(
    1,
    Math.ceil(C.COIN * peopleRate * levelRate)
  );
};
function coin(pi, n) {
  const p = S.p[pi];
  p.coin += n;
  while (p.lv < 5 && p.coin >= coinNeed(p)) {
    p.coin -= coinNeed(p);
    p.lv++;
    p.max = C.COST + p.lv;
    p.cost = p.max;
    L(`✦ ${p.name}の感情レベルが${p.lv}に上昇！コスト全回復`);
    p.chars.forEach(c => {
      if (c.alive) hook('lvup', c, p.lv);
    });
  }
  if (p.lv >= 5) p.coin = 0;
}
// ===== 属性（キャラの二段目パッシブ。帰属できない）／カードの限定属性 =====
// 属性を増やす手順：①ここに1行足す ②キャラに at:['属性名'] ③カードに req:'属性名'
// noSpeed:true にすると、その属性限定のカードは戦闘時に速度を無視して最初に発動する
const ATTR={
 ranged:{n:'遠距離',t:'遠距離系スキルを使える。遠距離系スキルは速度を無視して、戦闘の最初に発動する',noSpeed:true},
 Shi:{n:'シ協会南部支部:部長',t:"暗殺専門の協会。少数精鋭、効率的動作、情報判断能力が要求される"},
 Xiao:{n:'南部リウ協会1課:課長',t:'覚悟しろ。今日、都市の星が１つ沈むことになるだろうから'},
 RedMist:{n:'赤い霧',t:'耳を立てて、よく澄ませな！あれが例の赤い霧だ！'},
 blue:{n:'青い残響',t:'始めよう。世界を変える俺らの序曲を'}
};
Object.keys(PAS).forEach(id=>{const a=PAS[id].at;if(a&&!ATTR[a])throw new Error(`パッシブ「${id}」の属性 at:'${a}' は ATTR にありません`)});   // 属性名の書き間違い検出
const noSpd=c=>!!(c&&c.req&&ATTR[c.req]&&ATTR[c.req].noSpeed);
const atHTML=c=>(c.at&&c.at.length)?`<ul class="pl at">${c.at.map(k=>`<li title="${ATTR[k].t}">属性：${ATTR[k].n}</li>`).join('')}</ul>`:'';
// ===== 状態異常・バフの定義（i＝アイコン / c＝色 / t＝説明） =====
const STN={
 burn:{n:'火傷',i:'🔥',c:'#ff7a3d',t:'ターン終了時に数値分のダメージを受ける。そのあと数値が約2/3に減る'},
 bleed:{n:'出血',i:'🩸',c:'#e0455a',t:'行動のたびに数値分のダメージを受ける。ターン終了時に数値が約2/3に減る'},
 rupt:{n:'破裂',i:'💥',c:'#b17cf0',t:'ダメージを受けるたびに数値分の追加ダメージを受ける。ターン終了時に数値が約2/3に減る'},
 vib:{n:'振動',i:'〰',c:'#5cc8f5',t:'「振動爆発」を持つダイスでダメージを受けると、数値÷2枚の手札が山札に戻り、振動は消える'},
 dmgup:{n:'ダメージ上昇',i:'⚔',c:'#d9a93f',t:'このターン、与えるダメージが数値分上がる'},
 guard:{n:'被ダメージ減少',i:'🛡',c:'#4e8fd6',t:'このターン、受けるダメージが数値分減る'},
 roll:{n:'マッチ数値上昇',i:'🎲',c:'#4fb58a',t:'このターン、ダイスの出目が数値分上がる'},
 rolldn:{n:'ダイス値減少',i:'🌫',c:'#8f9bb3',t:'このターン、ダイスの出目が数値分下がる（0未満にはならない）'},
 vuln:{n:'被ダメージ増加',i:'💔',c:'#e0709a',t:'このターン、受けるダメージが数値分増える'},
 dmgdn:{n:'与ダメージ減少',i:'🥀',c:'#b39a72',t:'このターン、与えるダメージが数値分減る'},
 atk:{n:'攻撃ダイス上昇',i:'🗡',c:'#e8603c',t:'このターン、攻撃ダイスの出目が数値分上がる'}
};
const BF0=()=>({dmgup:0,guard:0,roll:0,dmgdn:0,vuln:0,rolldn:0,atk:0});   // バフ・次ターン系デバフの入れ物
const addNx=(tc,k,v)=>{if(tc&&tc.alive)tc.nx[k]+=v};   // 相手の「次のターン」に効くデバフ
const decay=v=>Math.floor(v*2/3);   // ターン終了時の減衰（値の2/3に・小数点以下切り捨て）。変えたいときはここだけ
const addSt=(tc,k,v)=>{if(tc&&tc.alive)tc.st[k]+=v};
// 効果の種類を増やすときは、FXT（表示）とFXA（処理）に1行ずつ足す。debuffは tc（相手）に、buffは自分(ch)に付く
const FXT={draw:v=>`ドロー${v}`,cost:v=>`コスト+${v}`,heal:v=>`HP+${v}`,coin:v=>`コイン+${v}`,
 dmgup:v=>`次ターン与ダメージ+${v}`,guardup:v=>`次ターン被ダメージ-${v}`,rollup:v=>`次ターンのマッチ数値+${v}`,atk:v=>`次ターンの攻撃ダイス+${v}`,
 burn:v=>`相手に火傷${v}`,bleed:v=>`相手に出血${v}`,rupt:v=>`相手に破裂${v}`,vib:v=>`相手に振動${v}`,vibex:()=>'振動爆発',
 rolldn:v=>`相手の次ターンのダイス値-${v}`,vuln:v=>`相手の次ターンの被ダメージ+${v}`,dmgdn:v=>`相手の次ターンの与ダメージ-${v}`};
const FXA={draw:(p,pi,ch,v)=>draw(p,v),cost:(p,pi,ch,v)=>{p.cost=Math.min(p.max,p.cost+v)},heal:(p,pi,ch,v)=>{ch.hp=Math.min(ch.max,ch.hp+v)},coin:(p,pi,ch,v)=>coin(pi,v),
 dmgup:(p,pi,ch,v)=>{ch.nx.dmgup+=v},guardup:(p,pi,ch,v)=>{ch.nx.guard+=v},rollup:(p,pi,ch,v)=>{ch.nx.roll+=v},atk:(p,pi,ch,v)=>{ch.nx.atk+=v},
 burn:(p,pi,ch,v,tc)=>addSt(tc,'burn',v+pv(ch,'ailmentup')),bleed:(p,pi,ch,v,tc)=>addSt(tc,'bleed',v+pv(ch,'ailmentup')),rupt:(p,pi,ch,v,tc)=>addSt(tc,'rupt',v+pv(ch,'ailmentup')),vib:(p,pi,ch,v,tc)=>addSt(tc,'vib',v+pv(ch,'ailmentup')),   // 状態異常付与量(ailmentup)を加算

 vibex:(p,pi,ch,v,tc)=>vibex(tc),
 rolldn:(p,pi,ch,v,tc)=>addNx(tc,'rolldn',v+pv(ch,'debuffup')),vuln:(p,pi,ch,v,tc)=>addNx(tc,'vuln',v+pv(ch,'debuffup')),dmgdn:(p,pi,ch,v,tc)=>addNx(tc,'dmgdn',v+pv(ch,'debuffup'))};   // デバフ付与量パッシブ(debuffup)を加算
// ===== 効果の発動条件 =====
// 効果は [種類, 数値, 条件] の3つ目に条件を書く（省略すると無条件）。条件は次のどれか：
//   'kill'                 敵を倒したとき
//   ['dmg',8]              8以上のダメージを与えたとき
//   ['foeHp',10]           相手の残りHPが10以下のとき
//   ['selfHp',10]          自分のHPが10以下のとき
//   ['foeSt','burn']       相手が火傷(burn)/出血(bleed)/破裂(rupt)/振動(vib)状態のとき
//   ['foeStGe','vib',5]    相手の状態異常の値が5以上のとき（状態＝burn/bleed/rupt/vib）
//   {and:['kill',['dmg',8]]}  複数条件をすべて満たすとき
// 例："斬撃":{hit:[['draw',1],['coin',2,'kill']]}   ← ドローは的中で、コイン+2は倒したときだけ
// 条件を増やすときは COND に1行足す（t＝表示文、f＝判定。x={A:使用者,B:相手,dmg:与ダメージ}）
const STK={burn:'火傷',bleed:'出血',rupt:'破裂',vib:'振動'};
const COND={
 kill:{t:()=>'敵を倒したとき',f:x=>!x.B.alive},
 dmg:{t:n=>`${n}以上のダメージを与えたとき`,f:(x,n)=>x.dmg>=n},
 foeHp:{t:n=>`相手の残りHPが${n}以下のとき`,f:(x,n)=>x.B.alive&&x.B.hp<=n},
 selfHp:{t:n=>`自分のHPが${n}以下のとき`,f:(x,n)=>x.A.hp<=n},
 foeSt:{t:k=>`相手が${STK[k]}状態のとき`,f:(x,k)=>(x.B.st[k]||0)>0},
 foeStGe:{t:(k,n)=>`相手の${STK[k]}が${n}以上のとき`,f:(x,k,n)=>(x.B.st[k]||0)>=n}
};
const condKey=c=>Array.isArray(c)?c:[c];
const condTest=(c,x)=>c.and?c.and.every(y=>condTest(y,x)):(([k,...a])=>COND[k].f(x,...a))(condKey(c));
const condText=c=>c.and?c.and.map(condText).join('、かつ'):(([k,...a])=>COND[k].t(...a))(condKey(c));
const condOk=(c,path)=>{if(c.and){c.and.forEach(y=>condOk(y,path));return}const [k,a]=condKey(c);if(!COND[k])throw new Error(`未定義の条件「${k}」（${path}）`);if((k==='foeSt'||k==='foeStGe')&&!STK[a])throw new Error(`${k}の状態は burn/bleed/rupt/vib のどれか（${path}）`);if(k==='foeStGe'&&!Number.isFinite(condKey(c)[2]))throw new Error(`foeStGe は ['foeStGe','vib',5] のように数値が必要です（${path}）`)};
const fxText=(l,showCond=true)=>l.map(([k,v,c])=>(showCond&&c?`［${condText(c)}］`:'')+FXT[k](v)).join('、');
const fxLine=(s,dl=true)=>(s.req?`<div class="fx req">${ATTR[s.req].n}属性限定${ATTR[s.req].noSpeed?'（速度無視で先に発動）':''}</div>`:'')+(s.once?'<div class="fx">使い捨て（使用すると消滅）</div>':'')+(s.on?`<div class="fx">発動時：${fxText(s.on)}</div>`:'')+(s.hit?`<div class="fx">的中時：${fxText(s.hit)}</div>`:'')+(dl?(s.d||[]).map((x,i)=>x.fx?`<div class="fx">ダイス${i+1}的中時：${fxText(x.fx)}</div>`:'').join(''):'');
function fx(pi,ch,list,label,tc,ctx){
 if(!list)return;const p=S.p[pi],x=ctx||{A:ch,B:tc,dmg:0};
 list=list.filter(e=>!e[2]||condTest(e[2],x));       // 条件を満たす効果だけ発動
 if(!list.length)return;
 for(const [k,v] of list)FXA[k](p,pi,ch,v,tc);
 L(`　✧ ${ch.name}の${label}効果：${fxText(list,false)}${bonusNote(ch,list)}`);
}
// 読み込み時に条件の書き間違いを検出する
SKILLS.forEach(s=>{[...(s.on||[]),...(s.hit||[]),...(s.d||[]).flatMap(d=>d.fx||[])].forEach(e=>{if(!FXT[e[0]]||!FXA[e[0]])throw new Error(`未定義の効果「${e[0]}」（カード「${s.n}」）。FXTとFXAに追加してください`);if(e[2])condOk(e[2],`カード「${s.n}」`)})});
const snap=()=>S.p.map(p=>p.chars.map(c=>c.hp));
const ix=(pi,c)=>[pi,S.p[pi].chars.indexOf(c)];
// ダイス1つごとにアニメーションの1コマを記録（lu=前に出る / sh=揺れる / ar=矢印）
function pf(lu,sh,ar){S.fr.push({to:S.log.length,hp:snap(),hold:holdSnap(),sts:stSnap(),dm:S.dm,ev:S.ev,lu,sh,ar:ar||null,ms:Math.min(2200,750+(S.log.length-S.pv)*160)});S.pv=S.log.length;S.dm={};S.ev=[]}
const stSnap=()=>S.p.map(p=>p.chars.map(c=>({st:{...c.st},bf:{...c.bf},nx:{...c.nx}})));
const holdSnap=()=>S.p.map(p=>p.chars.map(c=>c.alive?[...(c.card&&!c.used?c.card.d:[]),...(c.stock||[]).map(x=>({...x,s:1}))]:[]));
function direct(pb,B,dmg,kind){   // 状態異常による固定ダメージ（軽減・バフの影響を受けない）
 if(dmg<=0||!B.alive)return;
 const bi=S.p[pb].chars.indexOf(B),dk=`${pb}-${bi}`;
 B.hp=Math.max(0,B.hp-dmg);S.dm[dk]=(S.dm[dk]||0)+dmg;S.ev.push([pb,bi,{k:kind,a:dmg}]);
 L(`　${STN[kind].i}${B.name}は${STN[kind].n}で${dmg}ダメージ`);
 if(B.hp<=0){B.alive=false;L(`　${B.name}は倒れた`);coin(pb,2)}
}
function vibex(B){   // 振動爆発：振動÷2枚の手札を山札に戻し、振動を消す
 if(!B||!B.st.vib)return;
 const pb=S.p.findIndex(p=>p.chars.includes(B)),P=S.p[pb],n=Math.min(Math.floor(B.st.vib/2),P.hand.length),back=[];
 for(let i=0;i<n;i++)back.push(P.hand.splice(R(0,P.hand.length-1),1)[0]);
 P.deck=sh([...P.deck,...back]);
 L(`　${STN.vib.i}振動爆発！${B.name}の振動${B.st.vib}：${P.name}の手札${n}枚が山札に戻る`);
 S.ev.push([pb,P.chars.indexOf(B),{k:'vib',a:0,t:`手札-${n}`}]);B.st.vib=0;
}
function bleed(pi,ch){
 if(!ch.alive||!ch.st.bleed)return;
 const v=ch.st.bleed;
 direct(pi,ch,v,'bleed');
 ch.st.bleed=decay(ch.st.bleed);
 pf([],[ix(pi,ch)],null);
}
function hit(pa,pb,B,dmg,A,die){
 const up=A.bf.dmgup-A.bf.dmgdn;
 if(dmg>0&&up){dmg=Math.max(0,dmg+up);L(`　${A.name}の${up>0?'バフ':'弱体'}でダメージ${up>0?'+':''}${up}`)}
 if(dmg>0&&A.card&&A.card.req==='ranged'&&B.ps.some(p=>p.k==='rangedres')){
  dmg=Math.floor(dmg/2);
  L(`　${B.name}の遠距離耐性：ダメージ半減`);}
 const g=pv(B,'guard')+B.bf.guard-B.bf.vuln;
 if(g&&dmg>0){dmg=Math.max(0,dmg-g);L(g>0?`　${B.name}の軽減でダメージ-${g}`:`　${B.name}の脆弱でダメージ+${-g}`)}
 if(dmg<=0)return;
 const dk=`${pb}-${S.p[pb].chars.indexOf(B)}`;S.dm[dk]=(S.dm[dk]||0)+dmg;
 B.hp-=dmg;coin(pa,1);
 if(B.hp<=0){B.hp=0;B.alive=false;L(`　${B.name}は倒れた`);coin(pa,2);coin(pb,2);
  if(A.alive)hook('kill',A,B);}   // 倒した直後（PKの kill フック）
 else if(B.st.rupt){
  const v=B.st.rupt;
  direct(pb,B,v,'rupt');
  B.st.rupt=decay(B.st.rupt);
 }
 const cx={A,B,dmg};
 if(A.card&&A.card.hit){   // カード的中時：効果ごとに、条件を満たした最初の的中で1回だけ発動
  const todo=A.card.hit.filter((e,i)=>{if(A.hitFired[i]||(e[2]&&!condTest(e[2],cx)))return false;A.hitFired[i]=true;return true});
  fx(pa,A,todo,'的中時',B,cx);
 }
 if(die&&die.fx)fx(pa,A,die.fx,'ダイス的中時',B,cx);
}
function oneSided(pa,A,pb,B,dice){
 for(const d of dice){
  if(!A.alive||!B.alive)return;
  if(d.t!=='a')continue;
  bleed(pa,A);
  if(!A.alive)return;
  const v=roll(A,d);
  L(`　${A.name}[攻${v}] → ${B.name}に${v}ダメージ`);hit(pa,pb,B,v,A,d);pf([ix(pa,A)],[ix(pb,B)],[ix(pa,A),ix(pb,B)]);
 }
}
function doMatch(pa,A,pb,B,da=A.card.d,db=B.card.d){
 let i=0,j=0;
 while(i<da.length&&j<db.length&&A.alive&&B.alive){
  const x=da[i],y=db[j];
  bleed(pa,A);
  bleed(pb,B);
  if(!A.alive||!B.alive)break;
  const vx=roll(A,x),vy=roll(B,y);
  const head=`　${A.name}[${T[x.t]}${vx}] vs ${B.name}[${T[y.t]}${vy}] `;
  coin(pa,1);coin(pb,1);
  if(vx===vy){L(head+'→ 相打ち');pf([],[ix(pa,A),ix(pb,B)],[ix(pa,A),ix(pb,B)]);i++;j++;continue}
  const aw=vx>vy;
  const [wp,W,wd,wv,lp,Lc,ld,lv]=aw?[pa,A,x,vx,pb,B,y,vy]:[pb,B,y,vy,pa,A,x,vx];
  let dmg=0;
  if(wd.t==='a')dmg=ld.t==='d'?Math.max(0,wv-lv):wv;
  L(head+`→ ${W.name}の勝ち`+(wd.t==='a'?(dmg?`、${dmg}ダメージ`:'、完全に防がれた'):wd.t==='e'?'、回避ダイス再使用':'、防御成功'));
  if(dmg)hit(wp,lp,Lc,dmg,W,wd);
  pf([ix(wp,W)],[ix(lp,Lc)],[ix(wp,W),ix(lp,Lc)]);   // 勝者が攻撃・敗者が揺れる
  if(wd.t==='e'){aw?j++:i++}else{i++;j++}
 }
 if(A.alive&&B.alive){
  if(i<da.length)oneSided(pa,A,pb,B,da.slice(i));
  if(j<db.length)oneSided(pb,B,pa,A,db.slice(j));
 }
 return [i,j];
}
function combat(){
 S.inCombat=true;   // 戦闘処理中（lvbuff が「次のターン」に回すかの判定に使う）
 L('── 戦闘開始 ──');
 S.p.forEach((p,pi)=>p.chars.forEach(z=>{if(z.redirBy!=null)L(`　${z.name}のマッチ対象が${S.p[1-pi].chars[z.redirBy].name}に変更された`)}));
 S.p.forEach(p=>{p.cost-=used(p)});
 const base=S.log.length,hp0=snap(),hold0=holdSnap(),st0=stSnap(),frames=S.fr=[];S.pv=base;S.dm={};S.ev=[];
 const acts=[];
 S.p.forEach((p,pi)=>p.chars.forEach((c,ci)=>{if(c.alive&&c.card&&c.tgt!=null)acts.push({pi,ci,sp:c.sp,r:rnd()})}));
 const pr=a=>noSpd(S.p[a.pi].chars[a.ci].card)?1:0;   // 速度無視のカードは最初（その中では速度順）
 acts.sort((a,b)=>pr(b)-pr(a)||b.sp-a.sp||a.r-b.r);
 for(const a of acts){
  const c=S.p[a.pi].chars[a.ci];
  if(!c.alive||c.used)continue;
  S.dm={};
  const qi=1-a.pi,Q=S.p[qi];
  let t=Q.chars[c.tgt];
  if(!t.alive){t=Q.chars.find(x=>x.alive);if(!t)continue}
  c.used=true;
  if(!c.alive)continue;
  if(t.card&&!t.used&&t.tgt===a.ci){t.used=true;L(`【マッチ】${c.name}「${c.card.n}」(速度${c.sp}) vs ${t.name}「${t.card.n}」`);bleed(qi,t);fx(a.pi,c,c.card.on,'発動時',t);fx(qi,t,t.card.on,'発動時',c);doMatch(a.pi,c,qi,t)}
  else{L(`${c.name}「${c.card.n}」(速度${c.sp}) → ${t.name}`);fx(a.pi,c,c.card.on,'発動時',t);
   let ii=0;
   if(t.stock&&t.stock.length){L(`　${t.name}は保存していた守備ダイスで対応`);const r=doMatch(a.pi,c,qi,t,c.card.d,t.stock);ii=r[0];t.stock=t.stock.slice(r[1])}
   else oneSided(a.pi,c,qi,t,c.card.d);
   const dd=c.card.d.slice(ii).filter(x=>x.t!=='a');
   if(c.alive&&dd.length){c.stock=(c.stock||[]).concat(dd);L(`　${c.name}の守備ダイス${dd.length}個を保存（一方攻撃を受けたとき使用）`)}}
 }
 L('── ターン終了時 ──');
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{if(c.alive&&c.st.burn){direct(pi,c,c.st.burn,'burn');pf([],[ix(pi,c)],null)}}));
 S.p.forEach(p=>p.chars.forEach(c=>{if(c.alive)['burn','bleed','rupt'].forEach(k=>{c.st[k]=decay(c.st[k])})}));
 pf([],[],null);
 const n=S.p.map(alive);
 if(!n[0]||!n[1]){S.over=n[0]===n[1]?'引き分け':n[0]?`${S.p[0].name}の勝利、おめ`:`${S.p[1].name}の勝利、おめ`;L(`★ ${S.over}`)}
 S.inCombat=false;S.phase='result';S.cover=null;play(frames,base,hp0,hold0,st0);
}
function play(frames,base,hp0,hold0,st0){
 if(!frames.length||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){S.anim=null;render();return}
 const A=S.anim={frames,base,hp0,hold0,st0,i:-1,t:null};render();
 A.t=setTimeout(()=>step(A),600);
}
function step(A){
 if(!S||S.anim!==A)return;
 A.i++;
 if(A.i>=A.frames.length){S.anim=null;render();return}
 render();A.t=setTimeout(()=>step(A),A.frames[A.i].ms);
}
function skipAnim(){if(S&&S.anim){clearTimeout(S.anim.t);S.anim=null;render()}}
const logLines=()=>{const A=S.anim;return A?S.log.slice(0,A.i<0?A.base:A.frames[A.i].to):S.log};
function nextTurn(){
 S.p.forEach(p=>{
  const n=alive(p);
  p.chars.forEach(c=>{
   if(c.card){if(c.card.once&&c.used)p.gone=(p.gone||0)+1;else p.disc.push(c.card)}   // 使い捨てカードは使うと消滅
   c.card=null;c.tgt=null;c.used=false;c.hitFired=[];c.stock=null;c.redirBy=null;c.tgt0=null;
   c.bf=c.nx;c.nx=BF0();   // 「次のターン」のバフが有効になる
  });
  p.deck=sh([...p.deck,...p.disc]);p.disc=[];   // 使った技カードを山札に混ぜる
  p.cost=Math.min(p.max,p.cost+n+1);draw(p,n+1);
 });
 startTurn();
}
// ===== 描画 =====
const diceHTML=d=>d.map(x=>`<span class="die ${x.t}">${T[x.t]} ${x.r[0]}-${x.r[1]}${x.fx?'✧':''}</span>`).join('');
const diceRows=c=>`<div>${c.d.map(x=>`<div class=\"drow\"><span class=\"die ${x.t}\">${T[x.t]} ${x.r[0]}-${x.r[1]}</span>${x.fx?`<span class=\"fx\">的中時：${fxText(x.fx)}</span>`:''}</div>`).join('')}</div>`;
function chHTML(pi,ci,view){
 const p=S.p[pi],c=p.chars[ci],decide=S.phase==='decide',isMine=decide&&pi===view&&(!NET.on||act()===NET.me);
 const showCard=!decide||isMine||(S.stage===1&&pi===S.order[0]);
 const A=S.anim,fr=A&&A.i>=0?A.frames[A.i]:null,hv=A?(A.i<0?A.hp0:fr.hp)[pi][ci]:c.hp,dead=A?hv<=0:!c.alive,dmv=fr&&fr.dm[`${pi}-${ci}`];
 let cls='ch'+(c.size>1?' big':'')+(dead?' dead':'');
 const has=l=>l.some(x=>x[0]===pi&&x[1]===ci);
 const low=pi===view;   // 画面の下側に出ているのは自分側（オンラインのP2視点では pi=1 が下）
 if(fr&&has(fr.lu))cls+=low?' up':' dn';
 if(fr&&has(fr.sh))cls+=' hurt';
 const hd=A?((A.i<0?A.hold0:fr.hold)[pi][ci]||[]):[],gh=hd.length?`<div class="ghosts ${low?'top':'bot'}">${hd.map(x=>`<span class="die ${x.t} ghost${x.s?' st':''}">${T[x.t]}${x.r[0]}-${x.r[1]}</span>`).join('')}</div>`:'';
 const sn=A?(A.i<0?A.st0:fr.sts)[pi][ci]:c,ST=sn.st,stk=['burn','bleed','rupt','vib'],bk=['dmgup','guard','roll','dmgdn','vuln','rolldn','atk'];
 const evs=fr?fr.ev.filter(e=>e[0]===pi&&e[1]===ci).map(e=>e[2]):[];
 const badge=(k,v,nx)=>`<span class="stt${nx?' nx':''}" style="--c:${STN[k].c}" title="${STN[k].n}${nx?'（次のターンから）':''}：${STN[k].t}">${STN[k].i}${bk.includes(k)?(['guard','dmgdn','rolldn'].includes(k)?'-':'+'):''}${v}${nx?'<small>次</small>':''}</span>`;
 const sts=stk.filter(k=>ST[k]>0).map(k=>badge(k,ST[k])).join('')+bk.filter(k=>sn.bf[k]>0).map(k=>badge(k,sn.bf[k])).join('')+bk.filter(k=>sn.nx[k]>0).map(k=>badge(k,sn.nx[k],1)).join('');
 const aur=dead?'':stk.filter(k=>ST[k]>0).map(k=>`<i class="aur ${k}"></i>`).join('');
 const trg=evs.find(e=>e.k),dbase=(dmv||0)-evs.reduce((x,e)=>x+e.a,0);
 if(trg)cls+=' trg';
 const fl=(dbase>0?`<div class="dmg">-${dbase}</div>`:'')+evs.map((e,k)=>`<div class="dmg ${e.k}" style="top:${38+k*13}%;left:${50+(k%2?22:-22)}%">${e.t||'-'+e.a}</div>`).join('');
 const sc=isMine&&S.sel!=null?p.hand[S.sel]:null;
 if(sc&&!isCh(sc)&&sc.req&&!c.at.includes(sc.req))cls+=' dimc';   // 使えないキャラを暗くする
 if(isMine&&c.alive)cls+=' mine'+(S.pend===ci?' pend':'');
 if(decide&&pi!==view&&S.pend!=null&&c.alive)cls+=' tgt';
 const ev=isMine?`onclick="mine(${ci})" ondragover="event.preventDefault()" ondrop="event.preventDefault();assign(${ci},+event.dataTransfer.getData('text/plain'))"`:
  (cls.includes('tgt')?`onclick="pickTgt(${ci})"`:'');
 let a='';
 if(c.card&&(isMine||!decide||(NET.on&&pi===view))){
  const tg=c.tgt!=null?` → ${S.p[1-pi].chars[c.tgt].name}`:'（対象未設定）';
  a=`<div class="act">${isMine?`<button class="x" onclick="unassign(${ci},event)">×</button>`:''}<b>${c.card.n}</b>${tg}${fxLine(c.card)}<div>${diceHTML(c.card.d)}</div></div>`;
 }
 return `<div id="ch-${pi}-${ci}" class="${cls}" ${ev} style="${trg?`--c:${STN[trg.k].c}`:''}">${aur}<div class="nm"><span>${c.name}${c.size>1?' <span class="sz">2枠</span>':''}${ttlHTML(c)}</span><span class="sp">速度 ${c.alive?c.sp:'-'}</span></div>
 <div>HP ${hv}/${c.max}　<small>帰属枠 ${c.slot}</small></div><div class="bar"><i style="width:${hv/c.max*100}%"></i></div>
 <div class="sts">${sts}${c.kb?`<span class="stt" style="--c:#d65a4f" title="撃破ボーナス：ダイス値+${c.kb}（戦闘中永続）">⚔+${c.kb}</span>`:''}</div><ul class="pl">${c.ps.map(x=>`<li>${x.n}${x.from?'（借）':''}：${pasText(x)}</li>`).join('')}</ul>${atHTML(c)}${a}${fl}${gh}</div>`;
}
const costDots=(p,u)=>{const on=p.cost-u;let h='';for(let i=0;i<p.max;i++)h+=`<i class="dot${i<on?' on':i<p.cost?' rs':''}"></i>`;return `<span class="cost" title="コスト ${on}/${p.max}">コスト ${h} <small>${on}/${p.max}</small></span>`};
const emoGauge = p => {
  const need = coinNeed(p);
  let h = '';
  for (let i = 0; i < 5; i++) {
    h += `<i class="seg${i < p.lv ? ' on' : ''}"></i>`;
  }
  return `<span class="emo" title="感情レベル ${p.lv}/5（コイン ${p.coin}/${need}）">
    感情Lv <b>${p.lv}</b> ${h}
    ${p.lv < 5
      ? `<span class="cbar"><i style="width:${Math.min(100, p.coin / need * 100)}%"></i></span>`
      : ' <small>MAX</small>'}
  </span>`;
};

function sideHTML(pi,view,btm){
 const p=S.p[pi],u=S.phase==='decide'&&pi===view?used(p):0;
 const info=`<div class="info" style="margin:${btm?'6px 0 0':'0 0 4px'}"><span>${p.name}</span>${costDots(p,u)}${emoGauge(p)}<span>山札 ${p.deck.length}</span>${p.gone?`<span>消滅 ${p.gone}</span>`:''}</div>`;
 const row=`<div class="row">${p.chars.map((_,ci)=>chHTML(pi,ci,view)).join('')}</div>`;
 return `<div class="side">${btm?row+info:info+row}</div>`;
}
const handHTML=(c,i,mode)=>{
 const drag=mode==='play'?`draggable="true" ondragstart="event.dataTransfer.setData('text/plain',${i})" onclick="selCard(${i})"`:'';
 if(isCh(c)){
  const sel=mode==='play'?S.sel===i:S.pick.includes(i);
  const clk=mode==='setup'?`onclick="pickCh(${i})"`:'';
  return `<div class="card chc${sel?' sel':''}" ${drag} ${clk}><b>${c.name}</b>${c.size>1?' <span class="sz">2枠</span>':''}${ttlHTML(c)} <span class="c">HP${c.hp}</span> <span class="sp">速度${c.spd[0]}-${c.spd[1]}</span> <small>帰属枠${c.slot}</small><ul class="pl">${c.ps.map((x,k)=>`<li class="${k?'':'top'}">${k?'':'▶ '}${x.n}：${pasText(x)}</li>`).join('')}</ul>${atHTML(c)}${mode==='play'?'<div class="fx">キャラに重ねると先頭のパッシブを帰属（カードは消滅）</div>':''}</div>`;
 }
 return `<div class="card${mode==='setup'?' off':''}${mode==='play'&&S.sel===i?' sel':''}" ${drag}><b>${c.n}</b> <span class="c">コスト${c.c}</span>${fxLine(c,false)}${diceRows(c)}</div>`;
};
const legendHTML=()=>`<details class="lg"><summary>状態異常・バフの説明</summary>${Object.keys(STN).map(k=>`<div><span class="stt" style="--c:${STN[k].c}">${STN[k].i}</span> <b>${STN[k].n}</b>：${STN[k].t}</div>`).join('')}${Object.keys(ATTR).map(k=>`<div><b>属性：${ATTR[k].n}</b>：${ATTR[k].t}</div>`).join('')}<div><small>破線のバッジは「次のターンから」有効になるバフです。</small></div></details>`;
function renderMatch(){
 if(S.phase==='setup'){
  const p=S.p[S.sp];
  document.getElementById('stat').innerHTML=`<small>${NET.on?`オンライン：あなたは${p.name}`:`${p.name}の準備`}</small> ${leaveBtn()}`;
  let h=`<h1 style="margin:10px 0">${p.name}：デッキのキャラカードから、場に出すキャラを選んでください（場の枠 ${pickUsed()}/${C.FIELD}）</h1>
  <div class="msg">${S.msg||'クリックで選択／解除。大型キャラは場の枠を2つ使います。選ばなかったキャラカードは山札に戻り、あとで引くとパッシブの帰属元になります。決定後に5枚引きます。'}</div>
  <div class="hand">${p.pool.map((c,i)=>handHTML(c,i,'setup')).join('')}</div>
  ${NET.on?(S.waitSetup?'<div class="msg">相手の準備を待っています…</div>':'<button class="go" onclick="confirmSetup()">決定</button>'):`<button class="go" onclick="confirmSetup()">${S.sp===0?'決定（相手に交代）':'決定してゲーム開始'}</button>`}`;
  if(S.cover!=null)h=`<div class="cover"><h1>${S.p[S.cover].name}の番です</h1><p>相手に画面を見せないでください。</p><button class="go" onclick="S.cover=null;render()">手札を表示</button></div>`+h;
  document.getElementById('app').innerHTML=h;return;
 }
 const decide=S.phase==='decide',view=NET.on?NET.me:(decide?act():0),can=!NET.on||act()===NET.me;
 document.getElementById('stat').innerHTML=`<small>${NET.on?`オンライン（あなた＝${S.p[NET.me].name}）　`:''}ターン${S.turn}　${decide?(NET.on?(can?'あなたが行動決定中':'相手が行動決定中'):`${S.p[view].name}が行動決定中`):'戦闘結果'}</small> ${leaveBtn()}`;
 let h=`<div id="board">${sideHTML(1-view,view,false)}<div class="gap"></div>${sideHTML(view,view,true)}<svg id="arr"></svg></div>`;
 if(decide){
  const p=S.p[view];
  h+=`<div class="msg">${can?(S.msg||'技カードを自分のキャラへドラッグ（またはカード→キャラの順にクリック）。キャラカードを重ねるとパッシブを帰属できます'):'相手が行動を決めています。決定されるまでお待ちください…'}</div>
  <div class="handwrap"><div class="hand">${p.hand.map((c,i)=>handHTML(c,i,can?'play':'view')).join('')}</div></div>`;
  if(can)h=`<div class="topbar"><button class="go" onclick="done()">${S.stage===0?(NET.on?'決定（相手の番へ）':'決定（相手に交代）'):'決定して戦闘開始'}</button></div>`+askHTML()+h;   // 誤操作を防ぐため一番上に配置
 }else{
  h+=S.anim?`<button class="sub" style="margin-top:10px" onclick="skipAnim()">スキップ</button>`:S.over?`<h1 style="margin:12px 0">${S.over}</h1>${NET.on?(NET.rm[NET.me]?'<span class="msg">相手の返事を待っています…</span>':'<button class="go" onclick="netRematch()">もう一度対戦</button>'):'<button class="go" onclick="startMatch()">同じデッキでもう一度</button>'} <button class="sub" onclick="toHome()">ホームへ戻る</button>`:`<button class="go" style="margin-top:10px" onclick="nextTurn()">次のターンへ</button>`;
 }
 h+=`<div class="log" id="log">${logLines().join('<br>')}</div>${legendHTML()}<p><small>試作版：攻守の数値や感情の条件は、コード先頭のデータで調整できます。</small></p>`;
 if(NET.on&&(NET.lost||NET.err))h=`<div class="msg err">${NET.err||'相手との接続が切れました。'}　<button class="sub" onclick="toHome()">ホームへ戻る</button></div>`+h;
 if(S.cover!=null)h=`<div class="cover"><h1>${S.p[S.cover].name}の番です</h1><p>${S.stage===0?'相手に画面を見せないでください。':'相手の行動（矢印）を確認できます。'}</p><button class="go" onclick="S.cover=null;render()">手札を表示</button></div>`+h;
 document.getElementById('app').innerHTML=h;drawArrows();
 const lg=document.getElementById('log');if(lg&&!decide)lg.scrollTop=lg.scrollHeight;
}
function render(){if(REPLAY)return;document.body.className=SCR==='deck'?'deckmode':'';document.getElementById('stat').innerHTML='';if(SCR==='home')renderHome();else if(SCR==='deck')renderDeck();else if(SCR==='rules')renderRules();else if(SCR==='lobby')renderLobby();else renderMatch()}
function renderHome(){
 const l=readProfiles(),named=!!PF.name;
 const st=i=>{const e=dErr(DK.d[i]);return `<div class="${e.length?'err':'ok'}">デッキ${i+1}：${dTot(DK.d[i])}/${C.DECK}枚（${e.length?'未完成':'OK'}）</div>`};
 const ok=named&&!dErr(DK.d[0]).length&&!dErr(DK.d[1]).length;
 const msg=PF.msg?`<p class="err">${PF.msg}</p>`:'';
 const gate=`<div class="pf"><b>プレイヤー名を決めてください</b>
  <p><small>名前ごとにデッキが保存されます（この端末のブラウザの中に保存）。オンライン対戦では相手にも表示されます。</small></p>
  <p><input id="pfname" maxlength="12" placeholder="名前（12文字まで）" onkeydown="if(event.key==='Enter')pfCreate()"> <button class="go" onclick="pfCreate()">決定</button></p>${msg}</div>`;
 const box=`<div class="pf"><b>プレイヤー名：${PF.name}</b>
  <details><summary>名前の切り替え・追加・バックアップ</summary>
   <p>切り替え：<select onchange="pfUse(this.value)">${l.map(x=>`<option${x.name===PF.name?' selected':''}>${x.name}</option>`).join('')}</select></p>
   <p>新しい名前：<input id="pfname" maxlength="12" onkeydown="if(event.key==='Enter')pfCreate()"> <button class="sub" onclick="pfCreate()">追加</button> <button class="sub" onclick="pfDelete()">いまの名前を削除</button></p>
   <p><small>バックアップ（別の端末へ移す／消えたときの復元用。デッキ2つ分）</small><br><textarea id="pfcode" rows="2" style="width:100%;background:#10131f;color:var(--ink);border:1px solid var(--line)"></textarea><br><button class="sub" onclick="pfOut()">書き出し</button> <button class="sub" onclick="pfIn()">読み込み</button></p>
  </details>${msg}</div>`;
 document.getElementById('app').innerHTML=`<div class="home"><h1 style="font-size:1.8rem">（仮）カードゲーム</h1><p><small>圧倒的理不尽のクソカス2人交代制の対戦</small></p>${named?box+st(0)+st(1):gate}
 ${named?`<p><button class="go" ${ok?'':'disabled'} onclick="startMatch()">対戦開始（1台で交代）</button></p><p><button class="go" onclick="SCR='deck';render()">デッキ構築</button></p><p><button class="go" onclick="SCR='lobby';render()">オンライン対戦</button></p>`:''}<p><button class="go" onclick="SCR='rules';render()">ルール説明</button></p>${named&&!ok?'<p class="err">1台で対戦するには、デッキ1・デッキ2の両方を完成させてください（オンラインは使う1つだけでOK）</p>':''}</div>`;
}
// ===== ルール説明画面 =====
// 数値は C、状態異常・バフの説明は STN、属性の説明は ATTR から取るので、ここを書き換えなくても設定変更に追従する
function renderRules(){
 document.getElementById('stat').innerHTML='<button class="sub" onclick="toHome()">ホームへ戻る</button>';
 const die=(t,x)=>`<span class="die ${t}">${T[t]} ${x}</span>`;
 const st=k=>`<li><b>${STN[k].i} ${STN[k].n}</b>：${STN[k].t}</li>`;
 document.getElementById('app').innerHTML=`<div class="rules">
 <h1 style="margin:10px 0">ルール説明</h1>
 <p class="note">2人で対戦するゲームです。1台の画面を交代で使うか、「オンライン対戦」でそれぞれの端末から遊べます（オンラインでは自分の手番のときだけ操作できます）。</p>

 <section><h2>1. 勝敗</h2>
  <p>相手のキャラクターを全員倒したら勝ちです。両方の全員が同時に倒れたときは引き分けです。</p></section>

 <section><h2>2. 準備</h2>
  <ul>
   <li>デッキは <b>${C.DECK}枚</b>。技カードは同じ名前を${C.MAXC}枚まで、キャラカードは1枚ずつ、キャラカードは1枚以上入れます（ホームの「デッキ構築」で作ります）。</li>
   <li>対戦が始まったら、各プレイヤーがデッキのキャラカードから<b>場に出すキャラ</b>を選びます。場の枠は<b>${C.FIELD}つ</b>で、大型キャラは2枠を使います。</li>
   <li>選ばなかったキャラカードは山札に戻ります（あとで手札に来て、パッシブの帰属に使えます）。</li>
   <li>最初の手札は5枚、コストは${C.COST}です。</li>
  </ul></section>

 <section><h2>3. 1ターンの流れ</h2>
  <ol>
   <li><b>速度ダイス</b>：各キャラが速度ダイスを振ります（キャラごとの速度範囲＋パッシブ）。</li>
   <li><b>行動の決定</b>：速度の<b>平均が低い</b>プレイヤーから先にカードを割り当て、攻撃対象を決めます。もう一方のプレイヤーは、先に決めた側の割り当てを見たうえで決められます。</li>
   <li><b>戦闘</b>：両者が決め終わると、速度の高いキャラから順に行動します。</li>
   <li><b>ターン終了</b>：火傷のダメージを受け、火傷・出血・破裂の数値が減ります。</li>
   <li><b>次のターンの準備</b>：使ったカードは山札に混ざります。生きているキャラ数＋1枚ドローし、コストも同じだけ回復します（上限まで）。</li>
  </ol></section>

 <section><h2>4. カードを使う</h2>
  <ul>
   <li>手札の技カードを、自分のキャラにドラッグ（またはカードを選んでキャラをクリック）して割り当て、<b>攻撃対象の相手キャラ</b>をクリックします。1キャラにつき1枚です。</li>
   <li>割り当てたカードのコストの合計は、現在のコスト以内にします。割り当てたカードの「×」ボタンで割り当てを外して、付け替えられます。</li>
   <li>カードには<b>ダイス</b>が付いています：${die('a','3-8')}攻撃　${die('d','2-6')}防御　${die('e','4-9')}回避（数字は出目の範囲）。</li>
   <li>ダイスの<b>✧</b>は、そのダイスが当たったときの追加効果（的中時）、カードの「発動時」は使った時点で起きる効果です。</li>
   <li>「使い捨て」のカードは、使うと消滅します。</li>
   <li>属性限定のカードは、その属性を持つキャラだけが使えます（9章）。</li>
  </ul></section>

 <section><h2>5. 戦闘のしくみ</h2>
  <h3>マッチ（お互いに狙い合っているとき）</h3>
  <p>2枚のカードのダイスを先頭から順に1個ずつぶつけ、<b>出目の大きいほう</b>が勝ちます。</p>
  <ul>
   <li>${die('a','攻')} vs ${die('a','攻')}：勝ったほうが、<b>自分の出目ぶん</b>のダメージを与えます。</li>
   <li>${die('a','攻')} vs ${die('d','防')}：攻撃が勝てば<b>出目の差</b>がダメージ、防御が勝てば完全に防ぎます。</li>
   <li>${die('e','回')} 回避：勝つとダメージを受けず、<b>回避ダイスは使い回せます</b>。負けると攻撃のダメージを全額受けます。</li>
   <li>同じ出目なら<b>相打ち</b>で、どちらもダメージなしです。</li>
   <li>片方のダイスが先になくなったら、残った<b>攻撃ダイス</b>は一方攻撃として相手に当たります（防御・回避ダイスは使われません）。</li>
  </ul>
  <h3>一方攻撃（相手がこちらを狙っていないとき）</h3>
  <p>攻撃ダイスの出目がそのままダメージになります。ただし、自分が一方攻撃をしたキャラは、使わなかった<b>防御・回避ダイスを保存</b>します。そのあとに一方攻撃を受けたら、保存したダイスを使って応戦します。</p>
  <h3>行動の順番</h3>
  <p>速度の高いキャラから順に行動します。遠距離などの「速度を無視する」カードは、戦闘の最初に発動します。</p>
  <h3>マッチ対象の変更</h3>
  <p>後から決める側のキャラは、自分の速度が相手キャラより<b>${C.REDIR}以上高い</b>とき、相手が決めた対象を自分に変更して、強制的にマッチへ持ち込めます（相手のカードも自分のカードも速度無視でないときのみ）。</p></section>

 <section><h2>6. 感情レベルとコイン</h2>
  <ul>
   <li>コインは、ダイスをぶつけ合うたび（双方+1）、ダメージを与えたとき（+1）、キャラが倒れたとき（倒された側のプレイヤーに+2。攻撃で倒した側にも+2）に貯まります。</li>
   <li>コインが<b>${C.COIN}枚</b>たまるたびに<b>感情レベル</b>が1上がります（最大5）。</li>
   <li>感情レベルが上がると、コストの上限が（${C.COST}＋レベル）になり、<b>コストが全回復</b>します。</li>
  </ul></section>

 <section><h2>7. パッシブとキャラ</h2>
  <ul>
   <li>キャラは<b>パッシブ</b>（常に働く能力）を持ちます。数値を足すもの、ターン開始時に働くもの、条件で働くものなどがあります。</li>
   <li>手札に来た<b>キャラカード</b>を味方キャラにドラッグすると、そのカードの一番上のパッシブを、そのキャラに<b>帰属</b>できます。帰属したカードは消滅し、キャラの「帰属枠」が1つ減ります。帰属枠が0のキャラには帰属できません。</li>
  </ul></section>

 <section><h2>8. 状態異常とバフ・デバフ</h2>
  <h3>状態異常（ターンをまたいで残る）</h3>
  <ul>${['burn','bleed','rupt','vib'].map(st).join('')}</ul>
  <h3>バフ・デバフ（1ターンだけ。多くは「次のターン」から効く）</h3>
  <ul>${['dmgup','guard','roll','atk','rolldn','vuln','dmgdn'].map(st).join('')}</ul></section>

 <section><h2>9. 属性</h2>
  <p>キャラが持つ「属性」は、同じ属性が付いた専用カードを使えるようにします。</p>
  <ul>${Object.keys(ATTR).map(k=>`<li><b>${ATTR[k].n}</b>：${ATTR[k].t}</li>`).join('')}</ul></section>

 <p style="text-align:center"><button class="go" onclick="toHome()">ホームへ戻る</button></p>
 </div>`;
 if(window.scrollTo)scrollTo(0,0);
}
function dkAdd(k,v){
 const d=DK.d[DK.cur],m=isCh(byKey[k])?1:C.MAXC,n=(d[k]||0)+v;
 if(n<0||n>m||(v>0&&dTot(d)>=C.DECK))return;
 if(n)d[k]=n;else delete d[k];saveDecks();render();
}
function dkReset(){DK.d[DK.cur]=defDeck(DK.cur?POOL2:POOL1);saveDecks();render()}
function dkOut(){document.getElementById('code').value=JSON.stringify(DK.d[DK.cur])}
function dkIn(){
 try{const o=JSON.parse(document.getElementById('code').value),d={};
  for(const k in o)if(byKey[k]&&o[k]>0)d[k]=Math.min(o[k],isCh(byKey[k])?1:C.MAXC);
  DK.d[DK.cur]=d;saveDecks();render();
 }catch(e){document.getElementById('code').value='読み込めませんでした'}
}
function renderDeck(){
 document.getElementById('stat').innerHTML='<button class="sub" onclick="toHome()">ホームへ戻る</button>';
 const d=DK.d[DK.cur],er=dErr(d);
 const tile=c=>{
  const k=key(c),n=d[k]||0;
  const body=isCh(c)?`<b>${c.name}</b>${c.size>1?' <span class="sz">2枠</span>':''}${ttlHTML(c)} <span class="c">HP${c.hp}</span> <span class="sp">速度${c.spd[0]}-${c.spd[1]}</span> <small>帰属枠${c.slot}</small><ul class="pl">${c.ps.map(id=>`<li>${PAS[id].n}：${pasText(PAS[id])}</li>`).join('')}</ul>${atHTML(c)}`
   :`<b>${c.n}</b> <span class="c">コスト${c.c}</span>${fxLine(c,false)}${diceRows(c)}`;
  return `<div class="tile${n?' in':''}">${body}<div class="cnt"><button class="sub" onclick="dkAdd('${k}',-1)">−</button><b>${n}</b><button class="sub" onclick="dkAdd('${k}',1)">＋</button></div></div>`;
 };
 const scr=id=>{const e=document.getElementById(id);return e?e.scrollTop:0},sL=scr('dkL'),sR=scr('dkR');   // 再描画しても各ペインのスクロール位置を保つ
 const inDeck=[...CHARS.filter(c=>d[key(c)]),...SKILLS.filter(c=>d[key(c)]).sort((a,b)=>a.c-b.c)];   // 右ペイン：キャラ→技（コスト順）
 document.getElementById('app').innerHTML=`<h1 style="margin:10px 0">デッキ構築　<small>${PF.name||''}</small></h1>
 <div>${[0,1].map(i=>`<button class="sub${i===DK.cur?' sel':''}" onclick="DK.cur=${i};render()">デッキ${i+1}</button>`).join(' ')}</div>
 <p>枚数 <b>${dTot(d)}</b>/${C.DECK}（キャラ ${dChars(d)}枚）　<span class="${er.length?'err':'ok'}">${er.join(' ')||'このデッキで対戦できます'}</span></p>
 <p><small>技カードは同名${C.MAXC}枚まで、キャラカードは1枚まで。変更は自動で保存されます。</small>${DK.warn?'<span class="err">　この環境ではブラウザ保存が使えません。下のコードで書き出してください。</span>':''}</p>
 <div class="dkwrap">
  <section class="dkpane">
   <div class="dkhead"><b>カード一覧</b><button class="sub" onclick="DK.sort=DK.sort==='cost'?'file':'cost';render()">並び：${DK.sort==='cost'?'コスト順':'登録順'}</button></div>
   <div class="dkscroll" id="dkL">
    <h2>技カード</h2><div class="hand">${(DK.sort==='cost'?[...SKILLS].sort((a,b)=>a.c-b.c):SKILLS).map(tile).join('')}</div>
    <h2>キャラカード</h2><div class="hand">${CHARS.map(tile).join('')}</div>
   </div>
  </section>
  <section class="dkpane">
   <div class="dkhead"><b>現在のデッキ</b><span class="${er.length?'err':'ok'}">${dTot(d)}/${C.DECK}枚（キャラ ${dChars(d)}枚）</span></div>
   <div class="dkscroll" id="dkR">${inDeck.length?`<div class="hand">${inDeck.map(tile).join('')}</div>`:'<div class="dkempty">左の一覧から、カードを＋で追加してください。</div>'}</div>
  </section>
 </div>
 <p><button class="sub" onclick="dkReset()">初期デッキに戻す</button> <button class="sub" onclick="dkOut()">コードを書き出す</button> <button class="sub" onclick="dkIn()">コードを読み込む</button></p>
 <textarea id="code" rows="3" style="width:100%;background:#10131f;color:var(--ink);border:1px solid var(--line)"></textarea>`;
 const rs=(id,v)=>{const e=document.getElementById(id);if(e)e.scrollTop=v};rs('dkL',sL);rs('dkR',sR);
}
function drawArrows(){
 const svg=document.getElementById('arr'),bd=document.getElementById('board');if(!svg||!bd)return;
 const decide=S.phase==='decide',view=NET.on?NET.me:(decide?act():0),B=bd.getBoundingClientRect();
 let h='<defs><marker id="ag" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#d9a93f"/></marker><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#d65a4f"/></marker></defs>';
 const add=(pi,ci,qi,ti)=>{
  const a=document.getElementById(`ch-${pi}-${ci}`),b=document.getElementById(`ch-${qi}-${ti}`);if(!a||!b)return;
  const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),up=ra.top<rb.top;
  const x1=ra.left+ra.width/2-B.left,y1=(up?ra.bottom:ra.top)-B.top,x2=rb.left+rb.width/2-B.left,y2=(up?rb.top:rb.bottom)-B.top;
  const own=pi===view;
  h+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${own?'#d9a93f':'#d65a4f'}" stroke-width="3" stroke-linecap="round" marker-end="url(#${own?'ag':'ar'})"/>`;
 };
 if(S.anim){const f=S.anim.i>=0&&S.anim.frames[S.anim.i];if(f&&f.ar)add(f.ar[0][0],f.ar[0][1],f.ar[1][0],f.ar[1][1])}
 else[0,1].forEach(pi=>{
  if(decide&&!(pi===view||(S.stage===1&&pi===S.order[0])))return;
  S.p[pi].chars.forEach((c,ci)=>{if(c.card&&c.tgt!=null)add(pi,ci,1-pi,c.tgt)});
 });
 svg.innerHTML=h;
}
