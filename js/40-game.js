const key=x=>x.n||x.name,byKey={};
[...SKILLS,...CHARS].forEach(c=>byKey[key(c)]=c);

// フィリップ「蜜蝋の翼」用の複数行動スロット。通常キャラは従来どおり1スロット。
const ACTION_FIELDS=['card','tgt','used','hitFired','stock','redirBy','tgt0'];
const actionStates=c=>c?(c._actionStates||[c]):[];
const setActionSlot=(c,i)=>{if(c&&c._actionStates)c._actionSlot=Math.max(0,Math.min(c._actionStates.length-1,Number(i)||0))};
const setupActionSlots=(c,count=2)=>{
 if(!c||c._actionStates)return;
 const states=[{
  card:c.card||null,tgt:c.tgt==null?null:c.tgt,used:!!c.used,
  hitFired:Array.isArray(c.hitFired)?c.hitFired:[],stock:c.stock||null,
  redirBy:c.redirBy==null?null:c.redirBy,tgt0:c.tgt0==null?null:c.tgt0
 }];
 for(let i=1;i<count;i++)states.push({card:null,tgt:null,used:false,hitFired:[],stock:null,redirBy:null,tgt0:null});
 Object.defineProperty(c,'_actionStates',{value:states,writable:true,configurable:true,enumerable:true});
 Object.defineProperty(c,'_actionSlot',{value:0,writable:true,configurable:true,enumerable:true});
 for(const field of ACTION_FIELDS){
  delete c[field];
  Object.defineProperty(c,field,{configurable:true,enumerable:true,get(){return this._actionStates[this._actionSlot||0][field]},set(v){this._actionStates[this._actionSlot||0][field]=v}});
 }
 c.actionRights=count;
};
const hasPasKind=(c,k)=>!!(c&&Array.isArray(c.ps)&&c.ps.some(x=>x&&x.k===k));

// ===== 幻想体カード（試作データ。後から効果・名前・階層を差し替えられます） =====
const ABN_HIERARCHIES=['総記の階','歴史の階','技術科学の階','文学の階'];
const ABN_CARDS=[
 // 総記の階：ユーザー指定のカード
 {id:'blood',n:'血',hierarchy:'総記の階',mood:'negativeMany',levels:[1,2],desc:'守備ダイス（防御・回避）の威力+1〜3、被ダメージ+1。',fx:{guardDie:[1,3],takenPlus:1}},
 {id:'scar',n:'傷跡',hierarchy:'総記の階',mood:'positiveMany',levels:[1,2],desc:'被ダメージ-2〜3。',fx:{reduceRange:[2,3]}},
 {id:'pale_hand',n:'青ざめた手',hierarchy:'総記の階',mood:'mixed',levels:[1,2],desc:'同じ相手に攻撃が3回当たるたび、追加ダメージ3〜10。対象を変えるとカウントリセット。',fx:{paleHand:true}},
 {id:'yearning',n:'熱望',hierarchy:'総記の階',mood:'mixed',levels:[1,2],desc:'体力最大値と現在体力が15%上昇し、速度+1〜2。',fx:{yearning:true}},
 {id:'heartbeat',n:'鼓動',hierarchy:'総記の階',mood:'negativeMany',levels:[1,2],desc:'味方全員がターン開始時、次のターンのダイス値+1〜2。そのターンに相手へダメージを与えられなければ、味方全員が最大体力の25%のダメージを受ける。',fx:{heartbeat:true}},
 {id:'surging_heartbeat',n:'押し寄せる鼓動',hierarchy:'総記の階',mood:'negativeSuper',levels:[3,4],desc:'付与されたキャラは3ターン後に死亡する。それまで毎ターン開始時、ダイス値+4・速度+4・被ダメージ-4。',fx:{surgingHeartbeat:true}},
 {id:'frost_sword',n:'霜の剣',hierarchy:'総記の階',mood:'positiveMany',levels:[3,4],desc:'マッチ勝利時、50%で相手の速度-1。速度低下中の相手への攻撃は追加ダメージ1〜2。',fx:{frostSword:true}},
 {id:'kiss',n:'口づけ',hierarchy:'総記の階',mood:'positive',levels:[5,5],desc:'1枚のカードで2回以上マッチに勝利すると、相手に「氷の欠片」を1付与。氷の欠片3以上のキャラは次ターン行動不能になり、欠片をすべて失う。',fx:{kiss:true}},
 {id:'blizzard',n:'吹雪',hierarchy:'総記の階',mood:'negative',levels:[5,5],desc:'このターン、選択したキャラ以外の全員が行動不能。次のターン、相手全員の速度-6。',fx:{blizzard:true}},
 {id:'gaze',n:'眼差し',hierarchy:'総記の階',mood:'mixed',levels:[5,5],desc:'このキャラの与ダメージ・被ダメージが2倍になる。',fx:{gaze:true}},
 {id:'guilt',n:'罪悪感',hierarchy:'総記の階',mood:'negativeMany',levels:[3,4],desc:'被ダメージ-1〜2。受けたダメージの1/3を攻撃者に反射する。',fx:{guilt:true}},
 // 歴史の階：ユーザー指定のカード
 {id:'embers',n:'残り火',hierarchy:'歴史の階',mood:'positive',levels:[1,2],desc:'被ダメージ時、攻撃者に火傷1〜2を付与。さらに40%で次のターン、ダイス的中時に火傷1〜2を付与する能力を得る（重複しない）。',fx:{embers:true}},
 {id:'nostalgic_embrace',n:'懐かしいあの日の抱擁',hierarchy:'歴史の階',mood:'positive',levels:[1,2],desc:'マッチ勝利時、20%でダイス値分の追加ダメージ。同じ相手との連続マッチ勝利で発動率が上昇する。',fx:{nostalgicEmbrace:true}},
 {id:'love_expression',n:'愛情表現',hierarchy:'歴史の階',mood:'negativeSuper',levels:[1,2],desc:'マッチ中のダイス値+1〜2。一方攻撃中のダイス値-1〜2。',fx:{loveExpression:true}},
 {id:'fairy_care',n:'妖精の世話',hierarchy:'歴史の階',mood:'negativeMany',levels:[1,2],desc:'3ターンの間、ターン終了時に最大体力の15%を回復。効果中に3回ダメージを受けると最大体力の25%のダメージを受け、効果が消える。',fx:{fairyCare:true}},
 {id:'gluttony',n:'食い意地',hierarchy:'歴史の階',mood:'positiveMany',levels:[3,4],desc:'このターンに一度でもダメージを受けた相手を攻撃すると、ダメージ+1〜3、体力を2〜5回復する。',fx:{gluttony:true}},
 {id:'predation',n:'捕食',hierarchy:'歴史の階',mood:'negativeMany',levels:[3,4],desc:'このキャラ以外の味方の体力を各10減らし、実際に減った合計分を回復。このターン、ダイス値+3・速度+3。',fx:{predation:true}},
 {id:'spores',n:'胞子',hierarchy:'歴史の階',mood:'mixed',levels:[3,4],desc:'被ダメージ時、攻撃者に火傷1〜3と出血1〜3を付与する。',fx:{spores:true}},
 {id:'working_bee',n:'働き蜂',hierarchy:'歴史の階',mood:'negative',levels:[3,4],desc:'自分に最も多くダメージを与えた相手に「蜂の標的」を付与し、その相手の被ダメージを2〜4増加させる。',fx:{workingBee:true}},
 {id:'vines',n:'蔓',hierarchy:'歴史の階',mood:'positive',levels:[3,4],desc:'ターン開始時、ランダムな敵1体の速度-6。このキャラがその敵を攻撃するとダメージ+2〜4。',fx:{vines:true}},
 {id:'loyalty',n:'忠誠心',hierarchy:'歴史の階',mood:'negativeMany',levels:[5,5],desc:'このキャラが受けたダメージ5ごとに、次のターン味方全員のダイス値+1。',fx:{loyalty:true}},
 {id:'thorn_wall',n:'棘の壁',hierarchy:'歴史の階',mood:'positiveMany',levels:[5,5],desc:'被ダメージ時、攻撃者に2〜8ダメージと速度-1〜3を付与。速度低下が-3なら、与えたダメージ分を回復する。',fx:{thornWall:true}},
 {id:'malice',n:'悪意',hierarchy:'歴史の階',mood:'mixed',levels:[5,5],desc:'ターン開始時、全敵にダメージ。自分の残り体力が少ないほど増え、最小5・最大30。',fx:{malice:true}},
 {id:'metal_resonance',n:'金属の響き',hierarchy:'技術科学の階',mood:'mixed',levels:[1,2],desc:'ダイス的中時、相手に速度-1と次のターンのダイス値-1を付与する。',fx:{metalResonance:true}},
 {id:'bound_anger',n:'縛られた怒り',hierarchy:'技術科学の階',mood:'mixed',levels:[3,4],desc:'このキャラクターのダイス値は1〜3、速度は1に固定される。',fx:{boundAnger:true}},
 {id:'violence',n:'暴力性',hierarchy:'技術科学の階',mood:'negativeMany',levels:[1,2],desc:'全ダイスの最小値-1、最大値+3。',fx:{violence:true}},
 {id:'charging',n:'充電',hierarchy:'技術科学の階',mood:'mixed',levels:[3,4],desc:'幕の開始時にコストが最大なら、このターン速度+1〜2、与ダメージ+2〜7。',fx:{charging:true}},
 {id:'pattern_recognition',n:'パターン反復認識機能',hierarchy:'技術科学の階',mood:'positive',levels:[1,2],desc:'マッチに3回勝利するたび、コスト1回復し、次のターン速度+1〜2。',fx:{patternRecognition:true}},
 {id:'cleaning',n:'掃除',hierarchy:'技術科学の階',mood:'positiveMany',levels:[3,4],desc:'自分の速度が相手より高いとき、速度差2ごとにダイス値+1（最大+3）。',fx:{cleaning:true}},
 {id:'music',n:'音楽',hierarchy:'技術科学の階',mood:'negative',levels:[5,5],desc:'全キャラクターの与ダメージ+4〜8、被ダメージ+4〜8。カード所有者の味方は敵を倒すたびHP15回復。',fx:{music:true}},
 {id:'music_addiction',n:'音楽中毒',hierarchy:'技術科学の階',mood:'negativeMany',levels:[3,4],desc:'攻撃ダイス値+1〜3。守備ダイス（防御・回避）の値は1に固定される。',fx:{musicAddiction:true}},
 {id:'rest',n:'安息',hierarchy:'技術科学の階',mood:'positive',levels:[3,4],desc:'体力が最も少ない敵を攻撃すると、与ダメージ+2〜7。',fx:{rest:true}},
 {id:'mourning',n:'哀悼',hierarchy:'技術科学の階',mood:'mixed',levels:[1,2],desc:'状態異常を持つ全キャラクターは被ダメージ+2〜7。このキャラクター自身が状態異常中ならダイス値+1〜2。',fx:{mourning:true}},
 {id:'coffin',n:'棺',hierarchy:'技術科学の階',mood:'positive',levels:[5,5],desc:'体力50%以下の敵に攻撃が的中すると、40%の確率で次のターン行動不能にする。',fx:{coffin:true}},
 {id:'request',n:'依頼',hierarchy:'技術科学の階',mood:'positiveMany',levels:[1,2],desc:'依頼対象を持つ敵がいなければ、ダイス的中時に依頼対象を付与（被ダメージ+2〜4）。このキャラクターが依頼対象の敵を倒すと、体力が最大値の50%分回復する。',fx:{request:true}},
 {id:'seventh_bullet',n:'7つ目の弾丸',hierarchy:'技術科学の階',mood:'negative',levels:[3,4],desc:'攻撃ダイスのダメージ量+1〜7。7回目に使用する攻撃ページは、味方も含めて対象がランダムになる。',fx:{seventhBullet:true}},
 {id:'blackening',n:'黒化',hierarchy:'技術科学の階',mood:'negativeMany',levels:[5,5],desc:'全キャラクターの被ダメージが1.5倍になる。このキャラクターは速度+1〜2、攻撃ダイス値+2〜4。',fx:{blackening:true}},
 // 文学の階：今回の指定カード
 {id:'shyness',n:'はにかみ',hierarchy:'文学の階',mood:'positiveMany',levels:[1,2],desc:'防御ダイスの出目+1〜2。防御ダイスでマッチに勝利すると、出目の1/3（切り捨て）だけ相手にダメージ。',fx:{shyness:true}},
 {id:'social_distance',n:'社会的距離',hierarchy:'文学の階',mood:'positive',levels:[3,4],desc:'カードを使用すると、そのカードにある守備ダイス（防御・回避）の数だけ、そのカードの全ダイスの出目が増加する。',fx:{socialDistance:true}},
 {id:'glamour',n:'艶やか',hierarchy:'文学の階',mood:'negativeMany',levels:[1,2],desc:'ターン開始時、敵それぞれが50%の確率で魅了される。魅了された敵はこのカードの所有者だけを狙い、与ダメージ+2〜7。所有者とマッチするとき、所有者の出目+2。',fx:{glamour:true}},
 {id:'obsession',n:'執着',hierarchy:'文学の階',mood:'negativeSuper',levels:[3,4],desc:'戦闘中、全キャラクターが付与する出血の量が2倍になる。',fx:{obsession:true}},
 {id:'axe',n:'斧',hierarchy:'文学の階',mood:'negative',levels:[1,2],desc:'全ダイスの出目+1〜3。攻撃ダイスがマッチに負ける、相打ちになる、またはダメージを与えられなかった場合、2〜7ダメージを受ける。',fx:{axe:true}},
 {id:'meal',n:'食事',hierarchy:'文学の階',mood:'mixed',levels:[3,4],desc:'攻撃が命中した相手が状態異常またはデバフを2種類以上持っている場合、戦場の全キャラクターがHPを2〜3回復する。',fx:{meal:true}},
 {id:'cocoon',n:'繭',hierarchy:'文学の階',mood:'positive',levels:[1,2],desc:'攻撃が命中し、ダイスの基礎出目が最大値だった場合、相手に次のターン速度-1・被ダメージ+1・出目-1を付与する。',fx:{cocoon:true}},
 {id:'vigilance',n:'警戒',hierarchy:'文学の階',mood:'mixed',levels:[3,4],desc:'このキャラクターとマッチする相手の出目-1。マッチ勝利時、50%の確率で相手に次のターン速度-1・被ダメージ+1を付与する。',fx:{vigilance:true}},
 {id:'surprise_present',n:'サプライズプレゼント',hierarchy:'文学の階',mood:'mixed',levels:[1,2],desc:'このカードを受け取ってから初めてマッチする相手にプレゼントを付与。持ち主が付与者以外とマッチすると40%で2〜7ダメージと出血2を受け、持ち主の死亡時は倒した相手へプレゼントが移る。',fx:{surprisePresent:true}},
 {id:'merry_trick',n:'愉快ないたずら',hierarchy:'文学の階',mood:'negative',levels:[3,4],desc:'各カードの最初のダイスは必ず最小値か最大値になる。最小値を選んだ場合、2〜7ダメージを受ける。',fx:{merryTrick:true}},
 {id:'filth',n:'汚物',hierarchy:'文学の階',mood:'mixed',levels:[5,5],desc:'マッチ勝利時、全ての敵に速度-1・被ダメージ+1・出血1・出目-1を付与する。1ターンに2回まで。',fx:{filth:true}},
 {id:'old_parasol',n:'古びた日傘',hierarchy:'文学の階',mood:'negativeMany',levels:[5,5],desc:'速度+2〜3。被ダメージ時、30%の確率でダメージを0にして、攻撃者へ同量を反射する。',fx:{oldParasol:true}},
 {id:'beloved_family',n:'愛する家族',hierarchy:'文学の階',mood:'positiveMany',levels:[5,5],desc:'イラクサの服を6獲得。ターン開始時、残りのイラクサの服1につき被ダメージ-1。ターン終了時に1減少する。',fx:{belovedFamily:true}},
];
const DEFAULT_ABN_HIERARCHIES=[ABN_HIERARCHIES[0],ABN_HIERARCHIES[0]];
const validHiers=a=>[0,1].map(i=>ABN_HIERARCHIES.includes(a&&a[i])?a[i]:DEFAULT_ABN_HIERARCHIES[i]);
const defDeck=pool=>{const d={};SKILLS.slice(0,10).forEach(s=>d[s.n]=1);pool.slice(0,5).forEach(c=>d[c.name]=1);return d};   // 初期デッキ：技10＋キャラ5
// ===== プレイヤー名とデッキの保存 =====
// 名前ごとにデッキ2つを、このブラウザ（localStorage）へ保存する。別の端末・別のブラウザへは自動では引き継がれない（バックアップで持ち運べる）
const cleanName=s=>String(s==null?'':s).replace(/[<>&"'`\\\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,12);   // 画面に出す名前：記号を除いて12文字まで
// 一台モードではプロフィールをメモリ内だけで扱い、ブラウザやスプレッドシートへ永続保存しない。
let CG_NO_PERSIST=false;
const CG_TEMP_PROFILE_STORE={};
const CG_PROFILE_KEYS=new Set(['cg_profiles','cg_cur','cg_decks']);
const lsGet=k=>{
 try{
  if(CG_NO_PERSIST&&CG_PROFILE_KEYS.has(k))return Object.prototype.hasOwnProperty.call(CG_TEMP_PROFILE_STORE,k)?CG_TEMP_PROFILE_STORE[k]:null;
  return localStorage.getItem(k);
 }catch(e){return null}
};
const lsSet=(k,v)=>{
 try{
  if(CG_NO_PERSIST&&CG_PROFILE_KEYS.has(k)){CG_TEMP_PROFILE_STORE[k]=String(v);return true;}
  localStorage.setItem(k,v);return true;
 }catch(e){return false}
};
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
const loadHierarchies=()=>{
 const pf=readProfiles().find(x=>x.name===PF.name);
 return validHiers(pf&&pf.hierarchies);
};
let SCR='home',DK={d:loadDecks(),cur:0,warn:false,sort:'cost',hiers:loadHierarchies()};   // sort：cost＝コスト順 / file＝登録順
const saveDecks=()=>{
 // アカウントモード中は編成をGoogleスプレッドシートへ自動保存し、ブラウザ内の公開プロフィールには書かない。
 if(typeof SOLO_ACCOUNT!=='undefined'&&SOLO_ACCOUNT&&SOLO_ACCOUNT.mode==='account'&&SOLO_ACCOUNT.token){
  soloAccountScheduleSave();return;
 }
 if(!PF.name){DK.warn=true;return}
 const l=readProfiles(),e={name:PF.name,decks:DK.d,hierarchies:validHiers(DK.hiers)},i=l.findIndex(x=>x.name===PF.name);
 if(i>=0)l[i]=e;else l.push(e);
 if(!writeProfiles(l))DK.warn=true;
};
function pfUse(name){lsSet('cg_cur',name);DK.d=loadDecks();DK.cur=0;DK.hiers=loadHierarchies();DK.warn=false;PF.msg='';render()}   // 名前を切り替える
function pfCreate(){   // 名前を決めて作る
 const el=document.getElementById('pfname'),n=cleanName(el&&el.value);
 if(!n){PF.msg='名前を入力してください。';render();return}
 const l=readProfiles();
 if(l.some(x=>x.name===n)){PF.msg='その名前はすでにあります。「切り替え」から選んでください。';render();return}
 let old=null;if(!l.length){try{old=JSON.parse(lsGet('cg_decks'))}catch(e){}}   // 旧バージョンで作ったデッキは、最初の名前に引き継ぐ
 l.push({name:n,decks:fixDecks(old),hierarchies:[...DEFAULT_ABN_HIERARCHIES]});
 if(!writeProfiles(l)){PF.msg='この環境ではブラウザに保存できません（プライベートモードなど）。';render();return}
 pfUse(n);
}
function pfDelete(){
 if(!PF.name||!confirm(`「${PF.name}」とそのデッキを削除します。よろしいですか？`))return;
 const l=readProfiles().filter(x=>x.name!==PF.name);writeProfiles(l);
 lsSet('cg_cur',l.length?l[0].name:'');DK.d=loadDecks();DK.cur=0;DK.hiers=loadHierarchies();PF.msg='';render();
}
function pfOut(){const e=document.getElementById('pfcode');if(e&&PF.name)e.value=JSON.stringify({v:2,name:PF.name,decks:DK.d,hierarchies:validHiers(DK.hiers)})}   // バックアップの書き出し
function pfIn(){   // バックアップの読み込み（同じ名前があれば上書き）
 const e=document.getElementById('pfcode');let o=null;try{o=JSON.parse(e.value)}catch(_){}
 const n=o&&cleanName(o.name);
 if(!n||!Array.isArray(o.decks)||o.decks.length<2){PF.msg='バックアップのコードが正しくありません。';render();return}
 const decks=fixDecks(o.decks),hierarchies=validHiers(o.hierarchies),l=readProfiles(),i=l.findIndex(x=>x.name===n);
 if(i>=0&&!confirm(`「${n}」はすでにあります。デッキを上書きしますか？`))return;
 if(i>=0)l[i]={name:n,decks,hierarchies};else l.push({name:n,decks,hierarchies});
 writeProfiles(l);pfUse(n);
}
const dTot=d=>Object.values(d).reduce((a,b)=>a+b,0);
const dChars=d=>Object.entries(d).reduce((a,[k,v])=>a+(isCh(byKey[k])?v:0),0);
const dErr=d=>{const e=[];if(dTot(d)!==C.DECK)e.push(`${C.DECK}枚にしてください（現在${dTot(d)}枚）`);if(dChars(d)<1)e.push('キャラカードを1枚以上入れてください');return e};
function dkHierarchy(value){if(!ABN_HIERARCHIES.includes(value))return;DK.hiers[DK.cur]=value;saveDecks();render()}

let S;
const setCover=i=>{S.cover=NET.on?null:i};   // オンラインでは画面を隠さない
const newP=(name,deck,hierarchy=ABN_HIERARCHIES[0])=>{
 const p={name,chars:[],pool:[],deck:[],disc:[],hand:[],cost:C.COST,max:C.COST,lv:0,coin:0,hierarchy:ABN_HIERARCHIES.includes(hierarchy)?hierarchy:ABN_HIERARCHIES[0],emoPos:0,emoNeg:0,pendingAbn:false,abnOffers:[],abnSelected:null};
 for(const [k,n] of Object.entries(deck).sort(([a],[b])=>a<b?-1:a>b?1:0)){const c=byKey[k];   // キー順に固定（両者で同じ並びにする）
  if(isCh(c))p.pool.push(mkC(c));else for(let i=0;i<n;i++)p.deck.push(c)}
 return p;
};
const draw=(p,n)=>{for(let i=0;i<n;i++){if(!p.deck.length){p.deck=sh(p.disc);p.disc=[]}if(p.deck.length)p.hand.push(p.deck.pop())}};
const used=p=>p.chars.reduce((a,c)=>a+actionStates(c).reduce((n,st,slot)=>n+(st.card&&!(typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='funeral_dead_butterflies'&&c.abnState&&c.abnState.butterflyRightsPenaltyTurn===S.turn&&slot>=actionStates(c).length-1)?st.card.c:0),0),0);
const act=()=>S.order[S.stage];
const alive=p=>p.chars.filter(c=>c.alive).length;

// 対戦中の状態Sはデッキ定義のコピーから作る。対戦を終える（破棄する）と、帰属・HP・手札などの変化は全て消える
function startMatch(){
 if(dErr(DK.d[0]).length||dErr(DK.d[1]).length)return;
 SCR='match';
 S={turn:0,p:[newP(PF.name||'プレイヤー1',DK.d[0],DK.hiers[0]),newP('プレイヤー2',DK.d[1],DK.hiers[1])],over:null,phase:'setup',sp:0,pick:[],cover:null,msg:'',log:[],order:[0,1],stage:0,leave:false};
 render();
}
const toHome=()=>{netClose();if(typeof SOLO!=='undefined')SOLO.active=false;S=null;SCR='home';render()};
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
 p.chars=pick.map(i=>({...mkField(p.pool[i]),abn:[],abnState:{},abnFlags:{},showAbn:false}));
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
 S.turn++;S.msg='';S.sel=null;S.pend=null;S.pendActionSlot=0;S.ask=null;
 S.log=[];S.dm={};S.ev=[];S.turnDamageTeam=[false,false];
 S.p.forEach((p,pi)=>checkPhillipAwakening(pi));
 // 「艶やか」：魅了はターン開始時に敵ごとに再判定し、そのターン中だけ有効。
 S.p.forEach(p=>p.chars.forEach(c=>{if(c.abnState){delete c.abnState.charmedBy;c.abnState.charmedTurn=0}}));
 S.p.forEach((p,pi)=>p.chars.forEach(owner=>{
  if(!owner.alive||!hasAbn(owner,'glamour'))return;
  S.p[1-pi].chars.forEach(enemy=>{if(!enemy.alive)return;if(rnd()<0.5){if(!enemy.abnState)enemy.abnState={};enemy.abnState.charmedBy=owner;enemy.abnState.charmedTurn=S.turn;L(`　「艶やか」：${enemy.name}は${owner.name}に魅了された`)}});
 }));
 // 「愛する家族」：残っているイラクサの服に応じて、このターンの被ダメージを軽減。
 S.p.forEach(p=>p.chars.forEach(c=>{if(c.alive&&hasAbn(c,'beloved_family')&&(c.abnState.nettleClothes||0)>0){c.bf.guard=(c.bf.guard||0)+c.abnState.nettleClothes;L(`　「愛する家族」：${c.name}はイラクサの服${c.abnState.nettleClothes}により被ダメージ-${c.abnState.nettleClothes}`)}}));
 // 「悪意」：速度順の計算より先に、残りHPが少ないほど強い全体攻撃を行う。
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{
  if(!c.alive||!hasAbn(c,'malice'))return;
  const ratio=c.max>0?Math.max(0,Math.min(1,1-c.hp/c.max)):0;
  const dmg=Math.max(5,Math.min(30,Math.round(5+25*ratio)));
  S.p[1-pi].chars.forEach(enemy=>{if(enemy.alive){L(`　「悪意」：${c.name}が${enemy.name}に${dmg}ダメージ`);direct(1-pi,enemy,dmg,'malice')}});
 }));
 // 「蔓」は速度計算より先に対象を選び、このターンの速度-6を反映する。
 const vineStartLog=[];
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{
  if(!c.alive||!hasAbn(c,'vines'))return;
  const foes=S.p[1-pi].chars.filter(z=>z.alive);if(!foes.length)return;
  const target=foes[Math.floor(rnd()*foes.length)];if(!c.abnState)c.abnState={};if(!target.abnState)target.abnState={};
  c.abnState.vineTarget=target;target.abnState.speedDownNext=(target.abnState.speedDownNext||0)+6;
  vineStartLog.push(`　「蔓」：${c.name}が${target.name}の速度-6を付与`);
 }));
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{
  if(!c.abnState)c.abnState={};
  if(c.abnState.skipThisTurn==null)c.abnState.skipThisTurn=false;
  if(c.abnState.iceShard>=3){c.abnState.skipThisTurn=true;L(`　${c.name}は氷の欠片が3以上あるため行動不能（欠片を除去）`);c.abnState.iceShard=0}
  c.abnState.surgingActive=(c.abnState.surgingCountdown||0)>0;
  c.abnState.teamDiceBonus=0;
  // 充電：ターン開始時にコストが最大なら、このターンだけ速度・与ダメージを強化。
  if(hasAbn(c,'charging')&&p.cost>=p.max){c.abnState.chargingTurn=S.turn;c.abnState.chargingSpeed=R(1,2);c.abnState.chargingDamage=R(2,7);L(`　「充電」：${c.name}は速度+${c.abnState.chargingSpeed}、与ダメージ+${c.abnState.chargingDamage}`)}else if(hasAbn(c,'charging'))c.abnState.chargingTurn=0;
  const patternSpeed=c.abnState.speedUpNext||0;c.abnState.speedUpNext=0;
  c.abnState.speedDownNow=c.abnState.speedDownNext||0;c.abnState.speedDownNext=0;
  if(c.abnState.skipNextTurn){c.abnState.skipThisTurn=true;c.abnState.skipNextTurn=false}
  c.sp=c.alive?R(c.spd[0],c.spd[1])+pv(c,'spd')+(c.abnState.yearningSpeed||0)+(c.abnState.parasolSpeed||0)+(c.abnState.surgingActive?4:0)+patternSpeed+(c.abnState.blackeningSpeed||0)+(c.abnState.chargingTurn===S.turn?(c.abnState.chargingSpeed||0):0)-(c.abnState.speedDownNow||0):0;
  if(c.alive&&hasAbn(c,'bound_anger'))c.sp=1;
 }));
 // 忠誠心：前ターンに蓄積したダメージ5ごとのボーナスを、このターンの味方全員へ。
 S.p.forEach(p=>{
  const bonus=p.chars.reduce((n,c)=>n+((c.abnState&&c.abnState.loyaltyPending)||0),0);
  if(bonus)p.chars.forEach(c=>{if(!c.abnState)c.abnState={};c.abnState.teamDiceBonus=(c.abnState.teamDiceBonus||0)+bonus});
  p.chars.forEach(c=>{if(c.abnState)c.abnState.loyaltyPending=0});
 });
 S.p.forEach(p=>{if(p.chars.some(c=>c.alive&&hasAbn(c,'heartbeat'))){const bonus=R(1,2);p.chars.forEach(c=>{if(!c.abnState)c.abnState={};c.abnState.teamDiceBonus=(c.abnState.teamDiceBonus||0)+bonus});}});
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
 S.log.unshift(`── ターン${S.turn} ──`,`速度ダイスの平均 P1:${s[0].toFixed(1)} / P2:${s[1].toFixed(1)}　低い${S.p[S.order[0]].name}から行動を決めます`);
 chaseLog.forEach(m=>L(m));
 vineStartLog.forEach(m=>L(m));
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{
  if(!c.alive)return;
  hook('turn',c,pi);   // 再生・蔵書の加護など（PKの turn フック）
  const heal=(c.abn||[]).reduce((n,x)=>n+((x.fx&&x.fx.turnHeal)||0),0);
  if(heal&&c.hp<c.max){const old=c.hp;c.hp=Math.min(c.max,c.hp+heal);if(c.hp>old)L(`　${c.name}の幻想体カード効果：HPを${c.hp-old}回復`)}
  if(c.abnState.speedDownNow)L(`　${c.name}は速度-${c.abnState.speedDownNow}（このターン）`);
  if(c.abnState.surgingActive)L(`　${c.name}の「押し寄せる鼓動」：ダイス+4、速度+4、被ダメージ-4`);
 }));
 render();
 if(NET.on)netAfterTurnStart();
}
// ===== 行動決定 =====
// オンライン中は「自分の手番のときだけ」操作できる。相手の操作の再現中(REPLAY)は通す
const canAct=()=>!NET.on||REPLAY||(!!S&&S.phase==='decide'&&act()===NET.me&&!NET.lost&&!NET.err);
const logOp=o=>{if(NET.on&&!REPLAY)S.ops.push(o)};   // 手番中の操作を記録し、決定時に相手へ送って再現してもらう
function pickAbnormality(i){
 if(!canAct())return;const p=S.p[act()];if(!p.pendingAbn||!p.abnOffers[i])return;
 p.abnSelected=i;S.msg='カードを付与する味方キャラを選んでください';render();
}
function assignAbnormality(ci){
 const p=S.p[act()],c=p.chars[ci],card=p.abnOffers[p.abnSelected];
 if(!p.pendingAbn||p.abnSelected==null||!c||!c.alive||!card)return false;
 if(!Array.isArray(c.abn))c.abn=[];if(!c.abnState)c.abnState={};if(!c.abnFlags)c.abnFlags={};
 c.abn.push(card);
 if(card.fx&&card.fx.music){c.abnState.musicDmgUp=R(4,8);c.abnState.musicDmgTaken=R(4,8);L(`　「音楽」：全キャラクターの与ダメージ+${c.abnState.musicDmgUp}、被ダメージ+${c.abnState.musicDmgTaken}`)}
 if(card.fx&&card.fx.blackening){c.abnState.blackeningSpeed=R(1,2);c.abnState.blackeningAtk=R(2,4);c.sp+=c.abnState.blackeningSpeed;L(`　「黒化」：速度+${c.abnState.blackeningSpeed}、攻撃ダイス値+${c.abnState.blackeningAtk}。全キャラクターの被ダメージ1.5倍`)}
 if(card.fx&&card.fx.boundAnger){c.sp=1;L(`　「縛られた怒り」：${c.name}の速度は1に固定される`)}
 if(card.fx&&card.fx.patternRecognition&&!c.abnState.patternWins)c.abnState.patternWins=0;
 if(card.fx&&card.fx.request)c.abnState.requestKey=`request-${act()}-${ci}`;
 if(card.fx&&card.fx.surprisePresent)c.abnState.surpriseGiven=false;
 if(card.fx&&card.fx.oldParasol){c.abnState.parasolSpeed=R(2,3);c.sp+=c.abnState.parasolSpeed;L(`　「古びた日傘」：${c.name}の速度+${c.abnState.parasolSpeed}`)}
 if(card.fx&&card.fx.belovedFamily){c.abnState.nettleClothes=6;L(`　「愛する家族」：${c.name}はイラクサの服を6獲得`)}
 if(card.fx&&card.fx.yearning){const oldMax=c.max,oldHp=c.hp;c.max=Math.ceil(c.max*1.15);c.hp=Math.min(c.max,Math.ceil(oldHp*1.15));if(!c.abnState)c.abnState={};c.abnState.yearningSpeed=R(1,2);L(`　${c.name}の「熱望」：最大体力${oldMax}→${c.max}、速度+${c.abnState.yearningSpeed}`)}
 if(card.fx&&card.fx.fairyCare){c.abnState.fairyCareTurns=3;c.abnState.fairyCareHits=0;L(`　${c.name}の「妖精の世話」：3ターンの回復効果を得た`)}
 if(card.fx&&card.fx.predation){let lost=0;p.chars.forEach(z=>{if(z===c||!z.alive)return;const n=Math.min(10,Math.max(0,z.hp));z.hp-=n;lost+=n;L(`　「捕食」：${z.name}の体力-${n}`);if(z.hp<=0){z.hp=0;z.alive=false;L(`　${z.name}は倒れた`)}});const oldHp=c.hp;c.hp=Math.min(c.max,c.hp+lost);c.abnState.predationTurn=S.turn;c.sp+=3;L(`　「捕食」：${c.name}はHP${c.hp-oldHp}回復、ダイス+3・速度+3`)}
 if(card.fx&&card.fx.surgingHeartbeat){if(!c.abnState)c.abnState={};c.abnState.surgingCountdown=3;c.abnState.surgingAppliedTurn=S.turn}
 if(card.fx&&card.fx.blizzard){S.p.forEach((pp,pi)=>pp.chars.forEach((z,zi)=>{if(z!==c){if(!z.abnState)z.abnState={};z.abnState.skipThisTurn=true;if(pi!==act()){z.abnState.speedDownNext=6}}}));L(`　「吹雪」：${c.name}以外の全員がこのターン行動不能、相手全員は次のターン速度-6`)}
 p.pendingAbn=false;p.abnOffers=[];p.abnSelected=null;
 S.msg=`「${card.n}」を${c.name}に付与しました`;logOp(['ABN',ci,card.id]);render();return true;
}
function toggleCharacterView(pi,ci,e){if(e)e.stopPropagation();const c=S&&S.p[pi]&&S.p[pi].chars[ci];if(!c)return;c.showAbn=!c.showAbn;render()}
function selCard(i){if(!canAct()||S.p[act()].pendingAbn)return;S.sel=S.sel===i?null:i;render()}
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
 if(!canAct())return;
 const p=S.p[act()],c=p.chars[ci],card=p.hand[hi];
 if(p.pendingAbn){S.msg='先に幻想体カードを選んで味方キャラに付与してください';render();return}
 logOp(['A',ci,hi]);
 if(!c||!c.alive||!card)return;
 if(isCh(card))return attribute(p,c,hi);
 if(card.req&&!c.at.includes(card.req)){S.msg=`「${card.n}」は${ATTR[card.req].n}属性のキャラだけが使えます`;render();return}
 const states=actionStates(c);let slot=states.findIndex(st=>!st.card);if(slot<0)slot=0;
 const st=states[slot],old=st.card;
 if(used(p)-(old?old.c:0)+card.c>p.cost){S.msg=`コストが足りません（残り${p.cost-used(p)+(old?old.c:0)}）`;render();return}
 p.hand.splice(hi,1);if(old)p.hand.push(old);
 st.card=card;st.tgt=null;st.used=false;st.hitFired=[];st.stock=null;st.redirBy=null;st.tgt0=null;
 S.pend=ci;S.pendActionSlot=slot;S.sel=null;S.msg=`行動${slot+1}の攻撃対象を選んでください`;render();
}
function mine(ci){
 if(!canAct())return;
 const p=S.p[act()],c=p.chars[ci];
 if(p.pendingAbn){if(p.abnSelected==null){S.msg='先に幻想体カードを1枚選んでください';render();return}assignAbnormality(ci);return}
 if(S.sel!=null){assign(ci,S.sel);return}
 const states=actionStates(c);let slot=states.findIndex(st=>st.card&&st.tgt==null);
 if(slot<0){if(NET.on&&c.actionRights>1)return;slot=states.findIndex(st=>st.card)}
 if(slot>=0){S.pend=ci;S.pendActionSlot=slot;S.msg=`行動${slot+1}の攻撃対象を選んでください`;render()}
}
function undoRedir(yi){S.p[1-act()].chars.forEach(z=>actionStates(z).forEach(st=>{if(st.redirBy===yi){st.tgt=st.tgt0;st.redirBy=null;st.tgt0=null}}))}
function unassign(ci,e){if(e&&e.stopPropagation)e.stopPropagation();if(!canAct())return;logOp(['U',ci]);undoRedir(ci);const p=S.p[act()],c=p.chars[ci];actionStates(c).forEach(st=>{if(st.card)p.hand.push(st.card);st.card=null;st.tgt=null;st.used=false;st.hitFired=[];st.stock=null;st.redirBy=null;st.tgt0=null});if(S.pend===ci)S.pend=null;S.pendActionSlot=0;S.msg='';render()}
function chooseTarget(ci,slot,e){if(e&&e.stopPropagation)e.stopPropagation();if(!canAct()||NET.on)return;const c=S.p[act()].chars[ci],st=actionStates(c)[slot];if(!c||!st||!st.card)return;S.pend=ci;S.pendActionSlot=slot;S.msg=`行動${slot+1}の攻撃対象を選んでください`;render()}
function pickTgt(ci){
 if(!canAct()||S.p[act()].pendingAbn)return;
 if(S.pend==null||!S.p[1-act()].chars[ci].alive||(S.p[1-act()].chars[ci].abnState&&S.p[1-act()].chars[ci].abnState.soloUntargetable))return;
 const yi=S.pend,slot=S.pendActionSlot||0,y=S.p[act()].chars[yi],z=S.p[1-act()].chars[ci],yst=actionStates(y)[slot];
 logOp(['P',yi,ci]);undoRedir(yi);
 // 相手の行動が決まっていて、自分の速度が相手より規定値以上高いなら、相手のマッチ対象を変更できる。
 const zs=actionStates(z),zslot=zs.findIndex(st=>st.card&&st.tgt!=null&&st.tgt!==yi&&st.redirBy==null&&!noSpd(st.card)&&!noSpd(yst.card)&&y.sp-z.sp>=C.REDIR);
 if(zslot>=0){S.ask={yi,zi:ci,ySlot:slot,zSlot:zslot};S.pend=null;S.pendActionSlot=0;S.msg='';render();const q=document.querySelector('.ask');if(q)q.scrollIntoView({block:'center'});return}
 yst.tgt=ci;S.pend=null;S.pendActionSlot=0;S.msg='';render();
}
function redir(yes){
 if(!canAct()||!S.ask)return;logOp(['R',yes]);
 const a=S.ask,y=S.p[act()].chars[a.yi],z=S.p[1-act()].chars[a.zi],ys=actionStates(y)[a.ySlot||0],zs=actionStates(z)[a.zSlot||0];
 ys.tgt=a.zi;
 if(yes){zs.tgt0=zs.tgt;zs.tgt=a.yi;zs.redirBy=a.yi}
 S.ask=null;render();
}
const askHTML=()=>{if(!S.ask)return '';const y=S.p[act()].chars[S.ask.yi],z=S.p[1-act()].chars[S.ask.zi];return `<div class="ask"><b>${y.name}</b>（速度${y.sp}）は <b>${z.name}</b>（速度${z.sp}）より速度が${C.REDIR}以上高いので、${z.name}のマッチ対象を${y.name}に変更できます。<br><button class="go" onclick="redir(true)">対象を自分に変更する</button> <button class="sub" onclick="redir(false)">変更しない</button></div>`};
function done(){
 if(!canAct())return;
 if(S.p[act()].pendingAbn){S.msg='幻想体カードを選び、味方キャラに付与してから決定してください';render();return}
 if(S.ask){S.msg='マッチ対象を変更するか選んでください';render();return}
 const p=S.p[act()];
 if(p.chars.some(c=>c.alive&&actionStates(c).some(st=>st.card&&st.tgt==null))){S.msg='攻撃対象が未設定の行動があります';render();return}
 S.pend=null;S.pendActionSlot=0;S.sel=null;S.msg='';
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
  p.coin = Math.min(coinNeed(p), p.coin + n);
}
// 感情比率は、攻撃命中・マッチ勝敗・撃破／被撃破などの戦闘イベントで記録します。
function moodEvent(pi, mood, n=1) {
 const p=S&&S.p&&S.p[pi];if(!p)return;
 if(mood==='positive')p.emoPos=(p.emoPos||0)+n;
 else if(mood==='negative')p.emoNeg=(p.emoNeg||0)+n;
}
const positiveMoodRatio=p=>((p.emoPos||0)+1)/((p.emoPos||0)+(p.emoNeg||0)+2);
function makeAbnormalityOffers(p){
 // 一度取得して味方に付与した幻想体カードは、同じプレイヤーの以後の候補から除外する。
 const acquired=new Set((p.chars||[]).flatMap(c=>(c.abn||[]).map(a=>a.id).filter(Boolean)));
 let pool=ABN_CARDS.filter(c=>c.hierarchy===p.hierarchy&&!acquired.has(c.id)&&(!c.levels||(p.lv>=c.levels[0]&&p.lv<=c.levels[1])));
 // 指定レベル外のカードで補充しない。候補が3枚未満なら、その枚数だけ提示する。
 const ratio=positiveMoodRatio(p),offers=[];
 const weight=c=>{
  if(c.mood==='positive')return 0.2+1.8*ratio;
  if(c.mood==='negative')return 0.2+1.8*(1-ratio);
  if(c.mood==='positiveMany')return 0.05+2.8*ratio;
  if(c.mood==='negativeMany')return 0.05+2.8*(1-ratio);
  if(c.mood==='negativeSuper')return 0.03+5*Math.max(0,(0.4-ratio)/0.4);
  return 0.8;
 };
 while(pool.length&&offers.length<3){
  const weights=pool.map(weight),total=weights.reduce((a,b)=>a+b,0);let r=rnd()*total,at=weights.length-1;
  for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0){at=i;break}}
  offers.push(pool.splice(at,1)[0]);
 }
 return offers;
}
function resolveEmotion(p) {
  if (p.lv >= 5) {
    p.coin = 0;
    return;
  }

  if (p.coin >= coinNeed(p)) {
    p.coin -= coinNeed(p);
    p.lv++;

    p.max = C.COST + p.lv;
    p.cost = p.max;

    L(`✦ ${p.name}の感情レベルが${p.lv}に上昇！コスト全回復`);
    if(!p.pendingAbn){p.abnOffers=makeAbnormalityOffers(p);p.pendingAbn=true;p.abnSelected=null;L(`　幻想体カード候補を3枚用意（${p.hierarchy}／＋感情${p.emoPos}・−感情${p.emoNeg}）`)}

    p.chars.forEach(c => {
      if (c.alive) hook('lvup', c, p.lv);
    });

    if (p.lv >= 5) p.coin = 0;
  }
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
 incap:{n:'行動不能',i:'⛔',c:'#e05252',t:'このターン行動を決定・実行できない'},
 freeze:{n:'凍結',i:'❄',c:'#89c8ff',t:'氷の女王が生存している間、行動できない'},
 iceShard:{n:'氷の欠片',i:'🧊',c:'#78c7ff',t:'3以上になると次のターン行動不能になり、氷の欠片をすべて失う'},
 speedDown:{n:'速度低下',i:'🐢',c:'#80b8d9',t:'速度が低下している。次ターン分は「次」の表示が付く'},
 hiveMark:{n:'蜂の標的',i:'🐝',c:'#d9bd4c',t:'標的キャラの被ダメージが数値分増える'},
 requestMark:{n:'依頼対象',i:'🎯',c:'#e0709a',t:'このキャラが受けるダメージが数値分増える'},
 takenPlus:{n:'被ダメージ増加',i:'💔',c:'#e0709a',t:'特定の幻想体カード効果により受けるダメージが増えている'},
 globalMusic:{n:'音楽の影響',i:'🎵',c:'#d9a93f',t:'音楽の効果で全キャラクターの被ダメージが増えている'},
 globalBlackening:{n:'黒化の影響',i:'🌑',c:'#a17bd8',t:'黒化の効果で全キャラクターの被ダメージが1.5倍になっている'},
 gazeTaken:{n:'眼差し',i:'👁',c:'#b17cf0',t:'与ダメージ・被ダメージが2倍になる'},
 malice:{n:'悪意',i:'☠',c:'#8f344f',t:'悪意による固定ダメージ'},
 charm:{n:'魅了',i:'💗',c:'#e47aa7',t:'このターン、魅了したキャラクターだけを攻撃対象にする。与ダメージ+2〜7'},
 gift:{n:'プレゼント',i:'🎁',c:'#d7a4e8',t:'付与者以外とのマッチで40%の確率でダメージと出血を受ける'},
 nettle:{n:'イラクサの服',i:'🌿',c:'#75ba89',t:'ターン開始時、残数分だけ被ダメージを減らし、ターン終了時に1減る'},
 axe:{n:'斧の反動',i:'🪓',c:'#c77b54',t:'攻撃が的中しなかったことによる固定ダメージ'},
 merry:{n:'愉快ないたずら',i:'🎭',c:'#bf8bc9',t:'最初のダイスで最小値を選ぶと受ける固定ダメージ'},
 parasol:{n:'日傘の反射',i:'☂️',c:'#8a9bb8',t:'攻撃を反射したダメージ'},
 fairy:{n:'妖精の世話',i:'🧚',c:'#76c98c',t:'効果失敗時の固定ダメージ'},
 dmgup:{n:'ダメージ上昇',i:'⚔',c:'#d9a93f',t:'このターン、与えるダメージが数値分上がる'},
 guard:{n:'被ダメージ減少',i:'🛡',c:'#4e8fd6',t:'このターン、受けるダメージが数値分減る'},
 roll:{n:'マッチ数値上昇',i:'🎲',c:'#4fb58a',t:'このターン、ダイスの出目が数値分上がる'},
 rolldn:{n:'ダイス値減少',i:'🌫',c:'#8f9bb3',t:'このターン、ダイスの出目が数値分下がる（0未満にはならない）'},
 vuln:{n:'被ダメージ増加',i:'💔',c:'#e0709a',t:'このターン、受けるダメージが数値分増える'},
 dmgdn:{n:'与ダメージ減少',i:'🥀',c:'#b39a72',t:'このターン、与えるダメージが数値分減る'},
 atk:{n:'攻撃ダイス上昇',i:'🗡',c:'#e8603c',t:'このターン、攻撃ダイスの出目が数値分上がる'}
};
Object.keys(PAS).forEach(id=>(PAS[id].kinds||[]).forEach(k=>{if(!['burn','bleed','rupt'].includes(k))throw new Error(`パッシブ「${id}」の kinds「${k}」は burn / bleed / rupt のどれか`)}));   // 状態異常耐性(ailres)の対象の書き間違い検出
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
 burn:(p,pi,ch,v,tc)=>addSt(tc,'burn',v+pv(ch,'ailmentup')),bleed:(p,pi,ch,v,tc)=>addAbnBleed(tc,v+pv(ch,'ailmentup')),rupt:(p,pi,ch,v,tc)=>addSt(tc,'rupt',v+pv(ch,'ailmentup')),vib:(p,pi,ch,v,tc)=>addSt(tc,'vib',v+pv(ch,'ailmentup')),   // 状態異常付与量(ailmentup)を加算

 vibex:(p,pi,ch,v,tc)=>vibex(tc),
 rolldn:(p,pi,ch,v,tc)=>addNx(tc,'rolldn',v+pv(ch,'debuffup')),vuln:(p,pi,ch,v,tc)=>addNx(tc,'vuln',v+pv(ch,'debuffup')),dmgdn:(p,pi,ch,v,tc)=>addNx(tc,'dmgdn',v+pv(ch,'debuffup'))};   // デバフ付与量パッシブ(debuffup)を加算
// ===== 効果の発動条件 =====
// 効果は [種類, 数値, 条件] の3つ目に条件を書く（省略すると無条件）。条件は次のどれか：
//   'kill'                 敵を倒したとき
//   ['dmg',8]              8以上のダメージを与えたとき
//   ['foeHp',10]           相手の残りHPが10以下のとき
//   ['selfHp',10]          自分のHPが10以下のとき
//   ['foeSt','burn']       相手が火傷/出血/破裂/振動/寒気/胞子や行動不能などのデバフを持つとき
//   ['foeStGe','vib',5]    相手の状態異常・デバフの値が5以上のとき
//   {and:['kill',['dmg',8]]}  複数条件をすべて満たすとき
// 例："斬撃":{hit:[['draw',1],['coin',2,'kill']]}   ← ドローは的中で、コイン+2は倒したときだけ
// 条件を増やすときは COND に1行足す（t＝表示文、f＝判定。x={A:使用者,B:相手,dmg:与ダメージ}）
const STK={burn:'火傷',bleed:'出血',rupt:'破裂',vib:'振動',cold:'寒気',spore:'胞子',incap:'行動不能',freeze:'凍結',iceShard:'氷の欠片',speedDown:'速度低下',hiveMark:'蜂の標的',requestMark:'依頼対象',takenPlus:'被ダメージ増加',globalMusic:'音楽の影響',globalBlackening:'黒化の影響',gazeTaken:'眼差し'};
const statusValue=(c,k)=>{
 if(c&&c.st&&Number(c.st[k])>0)return Number(c.st[k]);
 const a=c&&c.abnState||{};
 if(k==='incap')return a.skipThisTurn||a.skipNextTurn?1:0;
 if(k==='freeze')return a.iceLocked?1:0;
 if(k==='iceShard')return Number(a.iceShard)||0;
 if(k==='speedDown')return Math.max(Number(a.speedDownNow)||0,Number(a.speedDownNext)||0);
 if(k==='hiveMark')return Object.values(a.hiveMarks||{}).reduce((n,v)=>n+(Number(v)||0),0);
 if(k==='requestMark')return Object.values(a.requestMarks||{}).reduce((n,v)=>n+(Number(v)||0),0);
 if(k==='takenPlus')return Number(a.fairyDamageTaken)||0;
 if(k==='gazeTaken')return (c.abn||[]).some(x=>x&&x.id==='gaze')?1:0;
 if(k==='globalMusic')return globalAbnHolders('music').reduce((n,x)=>n+((x.c.abnState&&x.c.abnState.musicDmgTaken)||0),0);
 if(k==='globalBlackening')return globalAbnHolders('blackening').length?1:0;
 return 0;
};
const COND={
 kill:{t:()=>'敵を倒したとき',f:x=>!x.B.alive},
 dmg:{t:n=>`${n}以上のダメージを与えたとき`,f:(x,n)=>x.dmg>=n},
 foeHp:{t:n=>`相手の残りHPが${n}以下のとき`,f:(x,n)=>x.B.alive&&x.B.hp<=n},
 selfHp:{t:n=>`自分のHPが${n}以下のとき`,f:(x,n)=>x.A.hp<=n},
 foeSt:{t:k=>`相手が${STK[k]}状態のとき`,f:(x,k)=>statusValue(x.B,k)>0},
 foeStGe:{t:(k,n)=>`相手の${STK[k]}が${n}以上のとき`,f:(x,k,n)=>statusValue(x.B,k)>=n}
};
const condKey=c=>Array.isArray(c)?c:[c];
const condTest=(c,x)=>c.and?c.and.every(y=>condTest(y,x)):(([k,...a])=>COND[k].f(x,...a))(condKey(c));
const condText=c=>c.and?c.and.map(condText).join('、かつ'):(([k,...a])=>COND[k].t(...a))(condKey(c));
const condOk=(c,path)=>{if(c.and){c.and.forEach(y=>condOk(y,path));return}const [k,a]=condKey(c);if(!COND[k])throw new Error(`未定義の条件「${k}」（${path}）`);if((k==='foeSt'||k==='foeStGe')&&!STK[a])throw new Error(`${k}の状態は burn/bleed/rupt/vib/cold/spore/incap/freeze/iceShard/speedDown/hiveMark/requestMark/takenPlus/globalMusic/globalBlackening/gazeTaken のどれか（${path}）`);if(k==='foeStGe'&&!Number.isFinite(condKey(c)[2]))throw new Error(`foeStGe は ['foeStGe','vib',5] のように数値が必要です（${path}）`)};
const fxText=(l,showCond=true)=>l.map(([k,v,c])=>(showCond&&c?`［${condText(c)}］`:'')+FXT[k](v)).join('、');
const fxLine=(s,dl=true)=>(s.aoe?`<div class="fx area-${s.aoe}">広域攻撃：${s.aoe==='sum'?'合算':'個別'}（広域攻撃は遠距離攻撃より先に発動）</div>`:'')+(s.req?`<div class="fx req">${ATTR[s.req].n}属性限定${ATTR[s.req].noSpeed?'（速度無視で先に発動）':''}</div>`:'')+(s.once?'<div class="fx">使い捨て（使用すると消滅）</div>':'')+(s.on?`<div class="fx">発動時：${fxText(s.on)}</div>`:'')+(s.hit?`<div class="fx">的中時：${fxText(s.hit)}</div>`:'')+(dl?(s.d||[]).map((x,i)=>x.fx?`<div class="fx">ダイス${i+1}的中時：${fxText(x.fx)}</div>`:'').join(''):'');
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
const holdSnap=()=>S.p.map(p=>p.chars.map(c=>c.alive?[...actionStates(c).flatMap(st=>st.card&&!st.used?st.card.d:[]),...actionStates(c).flatMap(st=>(st.stock||[]).map(x=>({...x,s:1})))]:[]));
function direct(pb,B,dmg,kind){   // 状態異常による固定ダメージ（ダメージ軽減・バフの影響は受けないが、状態異常耐性パッシブ(ailres)では減る）
 if(dmg<=0||!B.alive)return;
 const res=hookSum('ailres',B,kind);   // 状態異常耐性パッシブ：1回ごとに res 減らす
 if(res>0){const cut=Math.min(res,dmg);dmg-=cut;L(`　${B.name}の耐性で${STN[kind].n}ダメージ-${cut}`);if(dmg<=0)return}
 // 全キャラクター対象の被ダメージ効果は、状態異常などの固定ダメージにも適用する。
 const marks=requestMarks(B),requestBonus=Object.values(marks).reduce((a,v)=>a+(Number(v)||0),0);if(requestBonus){dmg+=requestBonus;L(`　「依頼対象」：被ダメージ+${requestBonus}`)}
 if(hasStatusAbn(B)&&globalAbnHolders('mourning').length){const n=R(2,7);dmg+=n;L(`　「哀悼」：状態異常中の${B.name}は被ダメージ+${n}`)}
 const music=globalAbnHolders('music'),musicTaken=music.reduce((a,x)=>a+((x.c.abnState&&x.c.abnState.musicDmgTaken)||0),0);if(musicTaken){dmg+=musicTaken;L(`　「音楽」：被ダメージ+${musicTaken}`)}
 if(globalAbnHolders('blackening').length){dmg=Math.ceil(dmg*1.5);L(`　「黒化」：被ダメージ1.5倍`)}
 if(dmg>0&&hasPasKind(B,'waxenwings')){dmg=Math.ceil(dmg*1.2);L(`　「蜜蝋の翼」：被ダメージ1.2倍`)}
 const bi=S.p[pb].chars.indexOf(B),dk=`${pb}-${bi}`;
 B.hp=Math.max(0,B.hp-dmg);if(!B.abnState)B.abnState={};B.abnState.damagedTurn=S.turn;if(kind==='malice'&&S.turnDamageTeam)S.turnDamageTeam[1-pb]=true;
 if(kind!=='fairy'&&hasAbn(B,'fairy_care')&&(B.abnState.fairyCareTurns||0)>0){B.abnState.fairyCareHits=(B.abnState.fairyCareHits||0)+1;if(B.abnState.fairyCareHits>=3){B.abnState.fairyCareTurns=0;const extra=Math.max(1,Math.ceil(B.max*0.25));B.hp=Math.max(0,B.hp-extra);L(`　「妖精の世話」：${B.name}は効果終了、追加で${extra}ダメージ`)}}
 moodEvent(pb,'negative');S.dm[dk]=(S.dm[dk]||0)+dmg;S.ev.push([pb,bi,{k:kind,a:dmg}]);
 L(`　${STN[kind].i}${B.name}は${STN[kind].n}で${dmg}ダメージ`);
 if(B.hp<=0){B.alive=false;moodEvent(pb,'negative');L(`　${B.name}は倒れた`);coin(pb,2);passGiftOnDeath(B,null);checkPhillipAwakening(pb)}
 checkPhillipAwakening(pb);
}
function abnormalityRoll(c,d,inMatch=false,opponent=null){
 // ダイス範囲を変えるページは、既存のダイス補正を維持したまま基礎範囲だけ差し替える。
 let rollDie={...d};
 if(hasAbn(c,'bound_anger'))rollDie.r=[1,3];
 else if(hasAbn(c,'music_addiction')&&(d.t==='d'||d.t==='e'))rollDie.r=[1,1];
 else if(hasAbn(c,'violence'))rollDie.r=[Math.max(0,d.r[0]-1),d.r[1]+3];
 // 「愉快ないたずら」：カード最初のダイスだけ、基礎出目を最小／最大に固定する。
 const range=[...rollDie.r];let chosenBase=null,merryMin=false;
 const forcedMerry=hasAbn(c,'merry_trick')&&c.card&&Array.isArray(c.card.d)&&c.card.d[0]===d;
 if(forcedMerry){merryMin=rnd()<0.5;chosenBase=merryMin?range[0]:range[1]}else chosenBase=R(...range);
 const raw=Math.max(0,chosenBase+pv(c,KEY[d.t])+(c.kb||0)+hookSum('dice',c,d)+(d.t==='a'?c.bf.atk:0)+c.bf.roll-c.bf.rolldn);let bonus=0;
 if(!c.abnState)c.abnState={};c.abnState.lastRollWasMax=chosenBase===range[1];c.abnState.lastRollBase=chosenBase;
 if(forcedMerry&&merryMin){const pi=S.p.findIndex(p=>p.chars.includes(c));if(pi>=0){const n=R(2,7);L(`　「愉快ないたずら」：${c.name}は最小値を出し、${n}ダメージ`);direct(pi,c,n,'merry')}}
 // 妖精の祭典：女王妖精だけが残ると全ダイス値+30。
 if(typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='fairy_festival'&&c.name==='女王妖精'&&!S.p[1].chars.some(z=>z.name==='妖精の塊'&&z.alive))bonus+=30;
 for(const card of (c.abn||[])){
  const f=card.fx||{};bonus+=(f.all||0)+(d.t==='a'?(f.atk||0):0);
  if(f.guardDie&&(d.t==='d'||d.t==='e'))bonus+=R(f.guardDie[0],f.guardDie[1]);
  if(f.shyness&&d.t==='d')bonus+=R(1,2);
  if(f.axe)bonus+=R(1,3);
  if(f.socialDistance&&c.card&&Array.isArray(c.card.d))bonus+=c.card.d.filter(z=>z.t==='d'||z.t==='e').length;
  if(f.glamour&&inMatch&&opponent&&opponent.abnState&&opponent.abnState.charmedBy===c&&opponent.abnState.charmedTurn===S.turn)bonus+=2;
  if(f.surgingHeartbeat&&c.abnState&&c.abnState.surgingActive)bonus+=4;
  if(f.loveExpression)bonus+=inMatch?R(1,2):-R(1,2);
  if(f.predation&&c.abnState&&c.abnState.predationTurn===S.turn)bonus+=3;
  if(f.musicAddiction&&d.t==='a')bonus+=R(1,3);
  if(f.mourning&&hasStatusAbn(c))bonus+=R(1,2);
  if(f.blackening&&d.t==='a')bonus+=(c.abnState&&c.abnState.blackeningAtk)||R(2,4);
  if(f.cleaning&&opponent&&c.sp>opponent.sp)bonus+=Math.min(3,Math.floor((c.sp-opponent.sp)/2));
 }
 // 「警戒」を持つ相手とマッチすると、その相手のダイス値を1下げる。
 if(inMatch&&opponent&&hasAbn(opponent,'vigilance'))bonus-=1;
 if(hasPasKind(c,'waxenwings')){
  bonus+=2;if(opponent&&opponent.st&&(opponent.st.burn||0)>0)bonus+=2;
  if(d.t==='a'){
   const burnFx=fx=>Array.isArray(fx)&&fx.some(e=>Array.isArray(e)&&e[0]==='burn');
   if(burnFx(d.fx)||burnFx(c.card&&c.card.hit))bonus+=3;
  }
 }
 if(c.abnState&&c.abnState.teamDiceBonus)bonus+=c.abnState.teamDiceBonus;
 if(d.t==='a'&&c.abnState){
  bonus+=(c.abnState.nextAtk||0);c.abnState.nextAtk=0;
  const killRate=(c.abn||[]).reduce((n,x)=>n+((x.fx&&x.fx.killAtk)||0),0);
  bonus+=(c.abnState.kills||0)*killRate;
 }
 if(bonus)L(`　${c.name}の幻想体カード効果：ダイス値${bonus>0?'+':''}${bonus}`);
 return Math.max(0,raw+bonus);
}
function abnormalityHit(A){
 if(!A||!A.alive)return;
 const cards=(A.abn||[]).filter(x=>x.fx&&x.fx.hitHeal);
 if(!cards.length||A.abnFlags&&A.abnFlags.hitHealTurn===S.turn)return;
 const n=cards.reduce((a,x)=>a+x.fx.hitHeal,0),before=A.hp;A.hp=Math.min(A.max,A.hp+n);
 if(!A.abnFlags)A.abnFlags={};A.abnFlags.hitHealTurn=S.turn;
 if(A.hp>before)L(`　${A.name}の幻想体カード効果：HPを${A.hp-before}回復`);
}
function hasAbn(c,id){return !!(c&&c.abn||[]).some(x=>x.id===id)}

const checkPhillipAwakening=pi=>{
 const p=S&&S.p&&S.p[pi];if(!p)return false;
 const sal=p.chars.find(c=>c.name==='サルヴァドール');
 // サルヴァドールが実際に出撃して死亡しており、フィリップだけが生存している場合に限る。
 if(!sal||sal.alive)return false;
 const live=p.chars.filter(c=>c.alive);
 if(live.length!==1||live[0].name!=='フィリップ')return false;
 const c=live[0];
 if(!hasPasKind(c,'unstableEgo'))return false;
 if(!c.abnState)c.abnState={};
 if(c.abnState.phillipAwakened||hasPasKind(c,'waxenwings'))return false;
 c.abnState.phillipAwakened=true;
 const wing=PAS.waxenwings;if(!wing)return false;
 c.ps.push({...wing});
 // 覚醒しても枠数は通常の1枠のまま。増えるのは行動権のみ。
 c.size=1;
 setupActionSlots(c,2);
 const old=c.hp,heal=Math.ceil(c.max*0.5);c.hp=Math.min(c.max,c.hp+heal);
 L(`　「蜜蝋の翼」：サルヴァドール死亡後、フィリップが唯一の生存者となり覚醒。行動権2`);
 if(c.hp>old)L(`　「蜜蝋の翼」：HP+${c.hp-old}`);
 return true;
};
function globalAbnHolders(id){const out=[];if(S&&S.p)S.p.forEach((p,pi)=>p.chars.forEach((c,ci)=>{if(hasAbn(c,id))out.push({pi,ci,c})}));return out}
function addAbnBleed(c,n){if(!c||!c.st||n<=0)return 0;const doubled=globalAbnHolders('obsession').length>0;const amount=n*(doubled?2:1);c.st.bleed=(c.st.bleed||0)+amount;return amount}
function abnStatusKindCount(c){
 if(!c)return 0;const kinds=new Set();
 ['burn','bleed','rupt','vib','cold','spore'].forEach(k=>{if(c.st&&Number(c.st[k])>0)kinds.add(k)});
 const a=c.abnState||{},bf=c.bf||{},nx=c.nx||{};
 if(a.skipThisTurn||a.skipNextTurn)kinds.add('incap');if(a.iceLocked)kinds.add('freeze');if((a.iceShard||0)>0)kinds.add('iceShard');
 if((a.speedDownNow||0)>0||(a.speedDownNext||0)>0)kinds.add('speedDown');
 if(Object.values(a.hiveMarks||{}).some(v=>Number(v)>0))kinds.add('hiveMark');
 if(Object.values(a.requestMarks||{}).some(v=>Number(v)>0))kinds.add('requestMark');
 if((a.fairyDamageTaken||0)>0)kinds.add('takenPlus');
 if(['vuln','rolldn','dmgdn'].some(k=>(bf[k]||0)>0||(nx[k]||0)>0))kinds.add('nextDebuff');
 return kinds.size;
}
function passGiftOnDeath(c,recipient){
 if(!c||!c.abnState||!c.abnState.giftFrom)return false;
 const from=c.abnState.giftFrom;c.abnState.giftFrom=null;
 if(recipient&&recipient.alive&&recipient!==from){if(!recipient.abnState)recipient.abnState={};recipient.abnState.giftFrom=from;L(`　「サプライズプレゼント」：${recipient.name}にプレゼントが移った`);return true}
 const pi=S.p.findIndex(p=>p.chars.includes(c));if(pi>=0)S.p[pi].giftPending=from;
 L(`　「サプライズプレゼント」：プレゼントは次のマッチまで待機する`);return false;
}
function hasStatusAbn(c){
 if(!c)return false;
 if(c.st&&['burn','bleed','rupt','vib','cold','spore'].some(k=>(c.st[k]||0)>0))return true;
 const a=c.abnState||{};
 return !!(a.skipThisTurn||a.skipNextTurn||a.iceLocked||(a.iceShard||0)>0||(a.speedDownNow||0)>0||(a.speedDownNext||0)>0||Object.values(a.hiveMarks||{}).some(v=>Number(v)>0)||Object.values(a.requestMarks||{}).some(v=>Number(v)>0)||(a.fairyDamageTaken||0)>0);
}
function requestMarks(c){return c&&c.abnState&&c.abnState.requestMarks?c.abnState.requestMarks:{}}
function abnormalityDamageTaken(B){
 if(!B||!B.alive)return;
 const n=(B.abn||[]).reduce((a,x)=>a+((x.fx&&x.fx.hurtCharge)||0),0);
 if(n){if(!B.abnState)B.abnState={};B.abnState.nextAtk=Math.max(B.abnState.nextAtk||0,n);L(`　${B.name}の幻想体カード効果：次の攻撃ダイス値+${B.abnState.nextAtk}`)}
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
 if(!B||!B.alive||dmg<=0)return;
 const targetDamagedBefore=!!(B.abnState&&B.abnState.damagedTurn===S.turn);
 let gluttonyHeal=0;
 // 女王妖精：捕食回数に応じて、受ける攻撃ダメージが増える。
 if(dmg>0&&typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='fairy_festival'&&B&&B.name==='女王妖精'&&B.abnState&&(B.abnState.fairyDamageTaken||0)>0){dmg+=B.abnState.fairyDamageTaken;L(`　「妖精の祭典」：女王妖精の被ダメージ+${B.abnState.fairyDamageTaken}`)}
 if(dmg>0&&A&&die&&die.t==='a'){
  if(A.abnState&&A.abnState.charmedTurn===S.turn&&A.abnState.charmedBy){const n=R(2,7);dmg+=n;L(`　「艶やか」：魅了された${A.name}の与ダメージ+${n}`)}
  if(hasAbn(A,'charging')&&A.abnState&&A.abnState.chargingTurn===S.turn){const n=A.abnState.chargingDamage||0;dmg+=n;if(n)L(`　「充電」：与ダメージ+${n}`)}
  if(hasAbn(A,'seventh_bullet')){const n=R(1,7);dmg+=n;L(`　「7つ目の弾丸」：攻撃ダイスの追加ダメージ+${n}`)}
  const music=globalAbnHolders('music');if(music.length){const n=music.reduce((sum,x)=>sum+((x.c.abnState&&x.c.abnState.musicDmgUp)||0),0);dmg+=n;if(n)L(`　「音楽」：与ダメージ+${n}`)}
  if(pa!==pb&&hasAbn(A,'rest')){const foes=S.p[1-pa].chars.filter(x=>x.alive);if(foes.length&&B.alive&&B.hp<=Math.min(...foes.map(x=>x.hp))){const n=R(2,7);dmg+=n;L(`　「安息」：最も体力の少ない敵への追加ダメージ+${n}`)}}
 }

 if(dmg>0&&hasAbn(A,'gluttony')&&targetDamagedBefore){const extra=R(1,3);dmg+=extra;gluttonyHeal=R(2,5);L(`　「食い意地」：ダメージ+${extra}（HP回復${gluttonyHeal}予定）`)}
 if(dmg>0&&hasAbn(A,'vines')&&A.abnState&&A.abnState.vineTarget===B){const extra=R(2,4);dmg+=extra;L(`　「蔓」：${B.name}への追加ダメージ+${extra}`)}
 const up=A.bf.dmgup-A.bf.dmgdn;
 if(dmg>0&&up){dmg=Math.max(0,dmg+up);L(`　${A.name}の${up>0?'バフ':'弱体'}でダメージ${up>0?'+':''}${up}`)}
 if(dmg>0&&hasAbn(A,'frost_sword')&&(B.abnState&&(B.abnState.speedDownNow||B.abnState.frostSpeedDown))){const extra=R(1,2);dmg+=extra;L(`　霜の剣：速度低下中の${B.name}に追加ダメージ+${extra}`)}
 if(dmg>0&&hasAbn(A,'gaze')){dmg*=2;L(`　${A.name}の「眼差し」：与ダメージ2倍`)}
 if(dmg>0&&A.card&&A.card.req==='ranged'&&B.ps.some(p=>p.k==='rangedres')){
  dmg=Math.floor(dmg/2);
  L(`　${B.name}の遠距離耐性：ダメージ半減`);}
 const g=pv(B,'guard')+B.bf.guard-B.bf.vuln;
 if(g&&dmg>0){dmg=Math.max(0,dmg-g);L(g>0?`　${B.name}の軽減でダメージ-${g}`:`　${B.name}の脆弱でダメージ+${-g}`)}
 const ar=(B.abn||[]).reduce((n,x)=>n+((x.fx&&x.fx.reduce)||0),0);
 if(ar&&dmg>0){const cut=Math.min(ar,dmg);dmg-=cut;L(`　${B.name}の幻想体カード効果：被ダメージ-${cut}`)}
 if(dmg>0&&hasAbn(B,'blood')){dmg+=1;L(`　「血」：被ダメージ+1`)}
 let rangeCut=0;
 if(dmg>0&&(hasAbn(B,'scar')||hasAbn(B,'guilt'))){
  if(hasAbn(B,'scar'))rangeCut+=R(2,3);
  if(hasAbn(B,'guilt'))rangeCut+=R(1,2);
  const cut=Math.min(rangeCut,dmg);dmg-=cut;L(`　${B.name}の幻想体カード効果：被ダメージ-${cut}`);
 }
 if(dmg>0&&B.abnState&&B.abnState.surgingActive){const cut=Math.min(4,dmg);dmg-=cut;L(`　「押し寄せる鼓動」：被ダメージ-${cut}`)}
 // 「蜂の標的」「依頼対象」は対象キャラの被ダメージを増やす。「哀悼」「音楽」は全キャラクターへ適用。
 if(dmg>0&&B&&B.abnState&&B.abnState.hiveMarks){const n=Object.values(B.abnState.hiveMarks).reduce((a,v)=>a+(Number(v)||0),0);if(n){dmg+=n;L(`　「蜂の標的」：${B.name}の被ダメージ+${n}`)}}
 if(dmg>0){const marks=requestMarks(B),n=Object.values(marks).reduce((a,v)=>a+(Number(v)||0),0);if(n){dmg+=n;L(`　「依頼対象」：被ダメージ+${n}`)}}
 if(dmg>0&&hasStatusAbn(B)&&globalAbnHolders('mourning').length){const n=R(2,7);dmg+=n;L(`　「哀悼」：状態異常中の${B.name}は被ダメージ+${n}`)}
 if(dmg>0){const music=globalAbnHolders('music');const n=music.reduce((sum,x)=>sum+((x.c.abnState&&x.c.abnState.musicDmgTaken)||0),0);if(n){dmg+=n;L(`　「音楽」：被ダメージ+${n}`)}}
 if(dmg>0&&hasAbn(B,'gaze')){dmg*=2;L(`　${B.name}の「眼差し」：被ダメージ2倍`)}
 if(dmg>0&&globalAbnHolders('blackening').length){dmg=Math.ceil(dmg*1.5);L(`　「黒化」：被ダメージ1.5倍`)}
 if(dmg>0&&hasPasKind(B,'waxenwings')){dmg=Math.ceil(dmg*1.2);L(`　「蜜蝋の翼」：被ダメージ1.2倍`)}
 // 妖精の塊は女王妖精が生きている間、HP1で踏みとどまる。
 if(dmg>0&&typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='fairy_festival'&&B.name==='妖精の塊'&&S.p[1].chars.some(z=>z.name==='女王妖精'&&z.alive))dmg=Math.min(dmg,Math.max(0,B.hp-1));
 if(dmg<=0){if(A&&die&&die.t==='a'&&hasAbn(A,'axe')){const ap=S.p.findIndex(p=>p.chars.includes(A));if(ap>=0){const self=R(2,7);L(`　「斧」：${A.name}の攻撃がダメージを与えられず、自身が${self}ダメージ`);direct(ap,A,self,'axe')}}return;}
 // 「古びた日傘」：30%でダメージを無効化し、攻撃者へ同量を反射。
 if(dmg>0&&hasAbn(B,'old_parasol')&&A&&A.alive&&rnd()<0.3){const reflected=Math.min(A.hp,dmg),ai=S.p[pa].chars.indexOf(A),rdk=`${pa}-${ai}`;A.hp=Math.max(0,A.hp-reflected);S.dm[rdk]=(S.dm[rdk]||0)+reflected;if(!S.turnDamageTeam)S.turnDamageTeam=[false,false];S.turnDamageTeam[pb]=true;L(`　「古びた日傘」：${B.name}が被ダメージを無効化し、${A.name}へ${reflected}ダメージを反射`);if(A.hp<=0){A.alive=false;L(`　${A.name}は倒れた`);passGiftOnDeath(A,B);checkPhillipAwakening(pa)}return;}
 const dk=`${pb}-${S.p[pb].chars.indexOf(B)}`;S.dm[dk]=(S.dm[dk]||0)+dmg;
 B.hp-=dmg;if(!B.abnState)B.abnState={};B.abnState.damagedTurn=S.turn;if(!S.turnDamageTeam)S.turnDamageTeam=[false,false];S.turnDamageTeam[pa]=true;coin(pa,1);moodEvent(pa,'positive');moodEvent(pb,'negative');
 // 金属の響き：的中した相手へ次ターンの速度・ダイス値低下を付与。
 if(A&&hasAbn(A,'metal_resonance')&&B.hp>0){B.abnState.speedDownNext=(B.abnState.speedDownNext||0)+1;if(!B.nx)B.nx=BF0();B.nx.rolldn=(B.nx.rolldn||0)+1;L(`　「金属の響き」：${B.name}に速度-1・次ターンのダイス値-1`)}
 // 「繭」：最大値を出した攻撃ダイスが命中すると、相手に3種の次ターン弱体を付与。
 if(A&&die&&die.t==='a'&&hasAbn(A,'cocoon')&&A.abnState&&A.abnState.lastRollWasMax&&B.hp>0){B.abnState.speedDownNext=(B.abnState.speedDownNext||0)+1;if(!B.nx)B.nx=BF0();B.nx.vuln=(B.nx.vuln||0)+1;B.nx.rolldn=(B.nx.rolldn||0)+1;L(`　「繭」：${B.name}に次ターン速度-1・被ダメージ+1・出目-1`)}
 // 「食事」：異なる状態異常／デバフを2種類以上持つ相手へ攻撃が命中すると、戦場全員を回復。
 if(A&&die&&die.t==='a'&&hasAbn(A,'meal')&&abnStatusKindCount(B)>=2){const heal=R(2,3);S.p.forEach(p=>p.chars.forEach(z=>{if(!z.alive)return;const old=z.hp;z.hp=Math.min(z.max,z.hp+heal);if(z.hp>old)L(`　「食事」：${z.name}はHP${z.hp-old}回復`)}))}
 // 棺：攻撃後にHPが半分以下になった敵は、40%で次ターン行動不能。
 if(A&&pa!==pb&&hasAbn(A,'coffin')&&B.hp>0&&B.hp<=B.max*0.5&&rnd()<0.4){B.abnState.skipNextTurn=true;L(`　「棺」：${B.name}は次のターン行動不能（40%判定成功）`)}
 // 依頼：敵に依頼対象が存在しない場合、最初に命中した敵を指定する。
 if(A&&pa!==pb&&hasAbn(A,'request')&&B.hp>0){const enemies=S.p[1-pa].chars;const anyMarked=enemies.some(z=>z.alive&&Object.keys(requestMarks(z)).length>0);if(!anyMarked){if(!A.abnState.requestKey)A.abnState.requestKey=`request-${pa}-${S.p[pa].chars.indexOf(A)}`;const n=R(2,4);if(!B.abnState.requestMarks)B.abnState.requestMarks={};B.abnState.requestMarks[A.abnState.requestKey]=n;L(`　「依頼」：${B.name}に依頼対象（被ダメージ+${n}）`)}}
 // 食い意地：このターンにすでに傷ついている相手への攻撃で回復。
 if(gluttonyHeal&&A&&A.alive){const old=A.hp;A.hp=Math.min(A.max,A.hp+gluttonyHeal);if(A.hp>old)L(`　「食い意地」：${A.name}はHP${A.hp-old}回復`)}
 abnormalityHit(A);
 // 受けたダメージの総量を記録（働き蜂・忠誠心）。
 if(A){
  const ai=S.p[pa].chars.indexOf(A),srcKey=`${pa}-${ai}`;
  if(!B.abnState.damageBy)B.abnState.damageBy={};B.abnState.damageBy[srcKey]=(B.abnState.damageBy[srcKey]||0)+dmg;
  if(hasAbn(B,'working_bee')){
   const bestKey=Object.keys(B.abnState.damageBy).sort((x,y)=>B.abnState.damageBy[y]-B.abnState.damageBy[x])[0];
   if(bestKey&&bestKey!==B.abnState.beeTargetKey){
    const oldTarget=B.abnState.beeTargetRef,markKey=`bee-${pb}-${S.p[pb].chars.indexOf(B)}`;
    if(oldTarget&&oldTarget.abnState&&oldTarget.abnState.hiveMarks)delete oldTarget.abnState.hiveMarks[markKey];
    const [tpi,tci]=bestKey.split('-').map(Number),newTarget=S.p[tpi]&&S.p[tpi].chars[tci];
    if(newTarget){if(!newTarget.abnState)newTarget.abnState={};if(!newTarget.abnState.hiveMarks)newTarget.abnState.hiveMarks={};const mark=R(2,4);newTarget.abnState.hiveMarks[markKey]=mark;B.abnState.beeTargetKey=bestKey;B.abnState.beeTargetRef=newTarget;L(`　「働き蜂」：${newTarget.name}に蜂の標的（被ダメージ+${mark}）`)}
   }
  }
 }
 // 残り火：被弾した相手に火傷を与え、40%で次ターンの命中時火傷を予約する。
 if(hasAbn(B,'embers')&&A&&A.alive){const burn=R(1,2);A.st.burn=(A.st.burn||0)+burn;L(`　「残り火」：${A.name}に火傷+${burn}`);if((B.abnState.emberBurnTurn||0)<S.turn&&rnd()<0.4){B.abnState.emberBurnTurn=S.turn+1;L(`　「残り火」：${B.name}は次のターン、命中時に火傷を付与する`)}}
 // 残り火で得た能力は、指定された次のターンにこのキャラが命中した相手へ火傷を付与する。
 if(hasAbn(A,'embers')&&A.abnState.emberBurnTurn===S.turn&&B.alive){const burn=R(1,2);B.st.burn=(B.st.burn||0)+burn;L(`　「残り火」：${B.name}に火傷+${burn}`)}
 // 胞子：攻撃者に火傷と出血を与える。
 if(hasAbn(B,'spores')&&A&&A.alive){const burn=R(1,3),bleed=R(1,3),addedBleed=addAbnBleed(A,bleed);A.st.burn=(A.st.burn||0)+burn;L(`　「胞子」：${A.name}に火傷+${burn}・出血+${addedBleed}`)}
 // 妖精の世話：効果期間中に3回ダメージを受けると、最大HPの25%を失って終了。
 if(hasAbn(B,'fairy_care')&&(B.abnState.fairyCareTurns||0)>0){B.abnState.fairyCareHits=(B.abnState.fairyCareHits||0)+1;if(B.abnState.fairyCareHits>=3){B.abnState.fairyCareTurns=0;const n=Math.max(1,Math.ceil(B.max*0.25));B.hp-=n;L(`　「妖精の世話」：${B.name}は効果終了、追加で${n}ダメージ`);if(B.hp<=0){B.hp=0;B.alive=false;L(`　${B.name}は倒れた`)}}}
 // 忠誠心：受けた攻撃ダメージ5ごとに、次ターンの味方全体ダイスボーナスを蓄積。
 if(hasAbn(B,'loyalty')){B.abnState.loyaltyDamage=(B.abnState.loyaltyDamage||0)+dmg;const n=Math.floor(B.abnState.loyaltyDamage/5);if(n>0){B.abnState.loyaltyDamage%=5;B.abnState.loyaltyPending=(B.abnState.loyaltyPending||0)+n;L(`　「忠誠心」：次のターン味方全員のダイス値+${n}`)}}
 // 棘の壁：攻撃者に固定ダメージと次ターンの速度低下を与える。
 if(hasAbn(B,'thorn_wall')&&A&&A.alive){const reflect=R(2,8),slow=R(1,3),dealt=Math.min(A.hp,reflect);A.hp-=dealt;if(!A.abnState)A.abnState={};A.abnState.speedDownNext=Math.max(A.abnState.speedDownNext||0,slow);L(`　「棘の壁」：${A.name}に${dealt}ダメージ、速度-${slow}`);if(slow===3){const old=B.hp;B.hp=Math.min(B.max,B.hp+dealt);L(`　「棘の壁」：${B.name}はHP${B.hp-old}回復`)}if(A.hp<=0){A.alive=false;L(`　${A.name}は倒れた`)}}
 // 青ざめた手：同じ相手への3回目の命中ごとに追加ダメージ
 if(hasAbn(A,'pale_hand')){if(!A.abnState)A.abnState={};const targetIndex=S.p[pb].chars.indexOf(B);if(A.abnState.paleTargetIndex!==targetIndex){A.abnState.paleTargetIndex=targetIndex;A.abnState.paleHits=0}A.abnState.paleHits=(A.abnState.paleHits||0)+1;if(A.abnState.paleHits>=3){const extra=R(3,10);A.abnState.paleHits=0;B.hp-=extra;S.dm[dk]=(S.dm[dk]||0)+extra;L(`　「青ざめた手」：${B.name}に追加ダメージ${extra}`);if(B.hp<=0){B.hp=0;B.alive=false;L(`　${B.name}は倒れた`)}}}
 // 罪悪感：受けた攻撃ダメージの1/3を攻撃者へ反射（反射自体は再反射しない）
 if(hasAbn(B,'guilt')&&A&&A.alive){const reflected=Math.floor(dmg/3);if(reflected>0){A.hp=Math.max(0,A.hp-reflected);L(`　「罪悪感」：${A.name}に${reflected}反射ダメージ`);if(A.hp<=0){A.alive=false;L(`　${A.name}は倒れた`)}}}
 if(B.hp<=0){B.hp=0;B.alive=false;moodEvent(pa,'positive',2);moodEvent(pb,'negative');L(`　${B.name}は倒れた`);passGiftOnDeath(B,A);coin(pa,2);coin(pb,2);
  // 依頼：自分が指定した依頼対象を倒したとき、最大HPの50%分を回復。
  if(A&&hasAbn(A,'request')&&A.abnState&&B.abnState&&B.abnState.requestMarks&&B.abnState.requestMarks[A.abnState.requestKey]!=null){const old=A.hp;A.hp=Math.min(A.max,A.hp+Math.ceil(A.max*0.5));L(`　「依頼」：${A.name}はHP${A.hp-old}回復`);delete B.abnState.requestMarks[A.abnState.requestKey]}
  // 音楽：このページの所有者側は敵撃破ごとに味方全員がHP15回復。
  const musicOwners=globalAbnHolders('music').filter(x=>x.pi===pa);if(musicOwners.length&&pa!==pb){S.p[pa].chars.forEach(z=>{if(!z.alive)return;const old=z.hp;z.hp=Math.min(z.max,z.hp+15);if(z.hp>old)L(`　「音楽」：${z.name}はHP${z.hp-old}回復`)})}
  if(A&&A.alive){const k=(A.abn||[]).reduce((n,x)=>n+((x.fx&&x.fx.killAtk)||0),0);if(k){if(!A.abnState)A.abnState={};A.abnState.kills=(A.abnState.kills||0)+1;L(`　${A.name}の幻想体カード効果：撃破ボーナス+${A.abnState.kills*k}`)}hook('kill',A,B);}}   // 倒した直後（PKの kill フック）
 else {abnormalityDamageTaken(B);if(B.st.rupt){
  const v=B.st.rupt;
  direct(pb,B,v,'rupt');
  B.st.rupt=decay(B.st.rupt);
 }}
 const cx={A,B,dmg};
 if(A.card&&A.card.hit){   // カード的中時：効果ごとに、条件を満たした最初の的中で1回だけ発動
  const todo=A.card.hit.filter((e,i)=>{if(A.hitFired[i]||(e[2]&&!condTest(e[2],cx)))return false;A.hitFired[i]=true;return true});
  fx(pa,A,todo,'的中時',B,cx);
 }
 if(die&&die.fx)fx(pa,A,die.fx,'ダイス的中時',B,cx);
 S.p.forEach((p,pi)=>checkPhillipAwakening(pi));
}
function oneSided(pa,A,pb,B,dice){
 for(const d of dice){
  if(!A.alive||!B.alive)return;
  if(d.t!=='a')continue;
  bleed(pa,A);
  if(!A.alive)return;
  const v=abnormalityRoll(A,d,false,B);
  L(`　${A.name}[攻${v}] → ${B.name}に${v}ダメージ`);hit(pa,pb,B,v,A,d);pf([ix(pa,A)],[ix(pb,B)],[ix(pa,A),ix(pb,B)]);
 }
}
function abnormalityMatchStart(pa,A,pb,B){
 // サプライズプレゼント：カード取得後の最初のマッチ相手にプレゼントを渡す。
 [[pa,A,pb,B],[pb,B,pa,A]].forEach(([pi,owner,oi,opponent])=>{
  if(!hasAbn(owner,'surprise_present')||!owner.abnState||owner.abnState.surpriseGiven)return;
  owner.abnState.surpriseGiven=true;
  if(!opponent.abnState)opponent.abnState={};opponent.abnState.giftFrom=owner;
  L(`　「サプライズプレゼント」：${owner.name}が初マッチの相手${opponent.name}にプレゼントを付与`);
 });
 // 死亡時に移動待ちになったプレゼントを、その陣営が次にマッチした相手へ渡す。
 [[pa,A,pb,B],[pb,B,pa,A]].forEach(([pi,owner,oi,opponent])=>{
  const p=S.p[pi];if(p&&p.giftPending&&opponent&&opponent.alive){if(!opponent.abnState)opponent.abnState={};opponent.abnState.giftFrom=p.giftPending;p.giftPending=null;L(`　「サプライズプレゼント」：${opponent.name}にプレゼントが移った`)}
 });
 // プレゼントを持つキャラクターが付与者以外とマッチすると、40%で損害を受ける。
 [[pa,A,pb,B],[pb,B,pa,A]].forEach(([pi,carrier,oi,opponent])=>{
  const from=carrier.abnState&&carrier.abnState.giftFrom;
  if(!from||from===opponent||rnd()>=0.4)return;
  const loss=R(2,7),addedBleed=addAbnBleed(carrier,2),ci=S.p[pi].chars.indexOf(carrier);carrier.hp=Math.max(0,carrier.hp-loss);S.dm[`${pi}-${ci}`]=(S.dm[`${pi}-${ci}`]||0)+loss;S.ev.push([pi,ci,{k:'gift',a:loss,t:'プレゼント'}]);L(`　「サプライズプレゼント」：${carrier.name}は${loss}ダメージと出血+${addedBleed}`);
  if(carrier.hp<=0){carrier.alive=false;L(`　${carrier.name}はプレゼントの罠で倒れた`);passGiftOnDeath(carrier,opponent);checkPhillipAwakening(pi)}
 });
}
function abnormalityMatchWin(winner,loser,wi,li){
 if(hasAbn(winner,'vigilance')&&rnd()<0.5){if(!loser.abnState)loser.abnState={};loser.abnState.speedDownNext=(loser.abnState.speedDownNext||0)+1;if(!loser.nx)loser.nx=BF0();loser.nx.vuln=(loser.nx.vuln||0)+1;L(`　「警戒」：${loser.name}に次ターン速度-1・被ダメージ+1`)}
 if(hasAbn(winner,'filth')){if(!winner.abnState)winner.abnState={};if(winner.abnState.filthTurn!==S.turn){winner.abnState.filthTurn=S.turn;winner.abnState.filthCount=0}if(winner.abnState.filthCount<2){winner.abnState.filthCount++;S.p[1-wi].chars.forEach(enemy=>{if(!enemy.alive)return;if(!enemy.abnState)enemy.abnState={};enemy.abnState.speedDownNow=(enemy.abnState.speedDownNow||0)+1;enemy.sp=Math.max(0,(enemy.sp||0)-1);enemy.bf.vuln=(enemy.bf.vuln||0)+1;enemy.bf.rolldn=(enemy.bf.rolldn||0)+1;const added=addAbnBleed(enemy,1);L(`　「汚物」：${enemy.name}に速度-1・被ダメージ+1・出血+${added}・出目-1（${winner.abnState.filthCount}/2）`)});}}
}
function doMatch(pa,A,pb,B,da=A.card.d,db=B.card.d){
 abnormalityMatchStart(pa,A,pb,B);
 let i=0,j=0,winA=0,winB=0;
 while(i<da.length&&j<db.length&&A.alive&&B.alive){
  const x=da[i],y=db[j];
  bleed(pa,A);
  bleed(pb,B);
  if(!A.alive||!B.alive)break;
  [ [A,B], [B,A] ].forEach(([holder,opponent])=>{if(hasAbn(holder,'nostalgic_embrace')){if(!holder.abnState)holder.abnState={};if(holder.abnState.nostalgicTarget===opponent)holder.abnState.nostalgicStreak=(holder.abnState.nostalgicStreak||0)+1;else{holder.abnState.nostalgicTarget=opponent;holder.abnState.nostalgicStreak=0}}});
  const vx=abnormalityRoll(A,x,true,B);
  if(!A.alive||!B.alive)break;
  const vy=abnormalityRoll(B,y,true,A);
  if(!A.alive||!B.alive)break;
  const head=`　${A.name}[${T[x.t]}${vx}] vs ${B.name}[${T[y.t]}${vy}] `;
  coin(pa,1);coin(pb,1);
  if(vx===vy){L(head+'→ 相打ち');if(x.t==='a'&&hasAbn(A,'axe')){const n=R(2,7);L(`　「斧」：${A.name}の攻撃が相打ちになり、自身が${n}ダメージ`);direct(pa,A,n,'axe')}if(y.t==='a'&&hasAbn(B,'axe')){const n=R(2,7);L(`　「斧」：${B.name}の攻撃が相打ちになり、自身が${n}ダメージ`);direct(pb,B,n,'axe')}pf([],[ix(pa,A),ix(pb,B)],[ix(pa,A),ix(pb,B)]);i++;j++;continue}
  const aw=vx>vy;
  const [wp,W,wd,wv,lp,Lc,ld,lv]=aw?[pa,A,x,vx,pb,B,y,vy]:[pb,B,y,vy,pa,A,x,vx];
  moodEvent(wp,'positive');moodEvent(lp,'negative');
  if(W===A)winA++;else winB++;
  abnormalityMatchWin(W,Lc,wp,lp);
  if(ld.t==='a'&&hasAbn(Lc,'axe')){const n=R(2,7);L(`　「斧」：${Lc.name}の攻撃がマッチに負け、自身が${n}ダメージ`);direct(lp,Lc,n,'axe')}
  if(hasAbn(W,'pattern_recognition')){if(!W.abnState)W.abnState={};W.abnState.patternWins=(W.abnState.patternWins||0)+1;if(W.abnState.patternWins>=3){W.abnState.patternWins-=3;const wpPlayer=S.p[wp],oldCost=wpPlayer.cost;wpPlayer.cost=Math.min(wpPlayer.max,wpPlayer.cost+1);const speed=R(1,2);W.abnState.speedUpNext=(W.abnState.speedUpNext||0)+speed;L(`　「パターン反復認識機能」：${W.name}が3回マッチ勝利、コスト${wpPlayer.cost-oldCost>0?'+1':'は最大'}、次ターン速度+${speed}`)}}
  if(hasAbn(W,'frost_sword')&&rnd()<0.5){if(!Lc.abnState)Lc.abnState={};Lc.abnState.speedDownNext=Math.max(Lc.abnState.speedDownNext||0,1);Lc.abnState.frostSpeedDown=1;L(`　「霜の剣」：${Lc.name}の速度-1（次のターン）`)}
  let dmg=0;
  if(wd.t==='a')dmg=ld.t==='d'?Math.max(0,wv-lv):wv;
  // はにかみ：防御ダイスでマッチに勝利すると、出目の1/3を追加ダメージにする。
  if(wd.t==='d'&&hasAbn(W,'shyness')){const extra=Math.floor(wv/3);dmg+=extra;L(`　「はにかみ」：防御ダイスの勝利で${Lc.name}に追加ダメージ${extra}`)}
  // 懐かしいあの日の抱擁：同じ相手との連続マッチ勝利ごとに発動率+20%。
  if(hasAbn(W,'nostalgic_embrace')){
   if(!W.abnState)W.abnState={};
   const chance=Math.min(1,0.2*((W.abnState.nostalgicStreak||0)+1));
   if(wd.t==='a'&&rnd()<chance){dmg+=wv;L(`　「懐かしいあの日の抱擁」：追加ダメージ+${wv}（発動率${Math.round(chance*100)}%）`)}
  }
  L(head+`→ ${W.name}の勝ち`+(wd.t==='a'?(dmg?`、${dmg}ダメージ`:'、完全に防がれた'):wd.t==='e'?'、回避ダイス再使用':'、防御成功'));
  if(dmg)hit(wp,lp,Lc,dmg,W,wd);else if(wd.t==='a'&&hasAbn(W,'axe')){const n=R(2,7);L(`　「斧」：${W.name}の攻撃がダメージを与えられず、自身が${n}ダメージ`);direct(wp,W,n,'axe')}
  // 死蝶の葬儀：非広域カードの最初のダイスでマッチ敗北したら、次ターンの行動権-1。
  if(typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='funeral_dead_butterflies'&&Lc&&Lc.card&&Lc.card.d&&Lc.card.d[0]===ld&&Lc.card&&!Lc.card.aoe&&!(Lc.card.c===0&&Lc.card.d&&Lc.card.d[0]&&Lc.card.d[0].t==='a')){if(!Lc.abnState)Lc.abnState={};Lc.abnState.butterflyActionPenalty=1;L(`　死蝶の葬儀：${Lc.name}は最初のダイスでマッチ敗北。次のターン行動権-1。`);}
  pf([ix(wp,W)],[ix(lp,Lc)],[ix(wp,W),ix(lp,Lc)]);   // 勝者が攻撃・敗者が揺れる
  if(wd.t==='e'){aw?j++:i++}else{i++;j++}
 }
 if(A.alive&&B.alive){
  if(i<da.length)oneSided(pa,A,pb,B,da.slice(i));
  if(j<db.length)oneSided(pb,B,pa,A,db.slice(j));
 }
 if(winA>=2&&hasAbn(A,'kiss')&&A.card){if(!B.abnState)B.abnState={};B.abnState.iceShard=(B.abnState.iceShard||0)+1;L(`　「口づけ」：${B.name}に氷の欠片+1（現在${B.abnState.iceShard}）`)}
 if(winB>=2&&hasAbn(B,'kiss')&&B.card){if(!A.abnState)A.abnState={};A.abnState.iceShard=(A.abnState.iceShard||0)+1;L(`　「口づけ」：${A.name}に氷の欠片+1（現在${A.abnState.iceShard}）`)}
 return [i,j];
}
function combat(){
 S.inCombat=true;   // 戦闘処理中（lvbuff が「次のターン」に回すかの判定に使う）
 L('── 戦闘開始 ──');
 S.p.forEach((p,pi)=>p.chars.forEach(z=>{if(z.redirBy!=null)L(`　${z.name}のマッチ対象が${S.p[1-pi].chars[z.redirBy].name}に変更された`)}));
 S.p.forEach(p=>{p.cost-=used(p)});
 const base=S.log.length,hp0=snap(),hold0=holdSnap(),st0=stSnap(),frames=S.fr=[];S.pv=base;S.dm={};S.ev=[];
 const acts=[];
 S.p.forEach((p,pi)=>p.chars.forEach((c,ci)=>actionStates(c).forEach((st,slot)=>{const blocked=typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='funeral_dead_butterflies'&&c.abnState&&c.abnState.butterflyRightsPenaltyTurn===S.turn&&slot>=actionStates(c).length-1;if(c.alive&&st.card&&st.tgt!=null&&!blocked)acts.push({pi,ci,slot,sp:c.sp,r:rnd()})})));
 const pr=a=>{const card=actionStates(S.p[a.pi].chars[a.ci])[a.slot].card;return card&&card.aoe?2:(noSpd(card)?1:0)};   // 広域攻撃→遠距離など速度無視→通常攻撃
 acts.sort((a,b)=>pr(b)-pr(a)||b.sp-a.sp||a.r-b.r);
 for(const a of acts){
  const c=S.p[a.pi].chars[a.ci];setActionSlot(c,a.slot);
  if(!c.alive||c.used){setActionSlot(c,0);continue}
  if(c.abnState&&c.abnState.skipThisTurn){c.used=true;L(`　${c.name}は行動不能のため行動をスキップ`);setActionSlot(c,0);continue;}
  S.dm={};
  let qi=1-a.pi,Q=S.p[qi];
  let t=Q.chars[c.tgt];
  // 女王蜂のHPが25%未満なら、働き蜂は敵ではなく女王蜂本人を攻撃する。
  if(typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='queen_bee'&&a.pi===1&&c.name==='働き蜂'&&c.abnState&&c.abnState.targetQueen){const qOwn=S.p[a.pi].chars.find(z=>z.name==='女王蜂'&&z.alive);if(qOwn){qi=a.pi;Q=S.p[qi];t=qOwn;}else c.abnState.targetQueen=false;}
  c.used=true;
  if(!c.alive){setActionSlot(c,0);continue}
  // 広域攻撃は敵側の各キャラクターの最初の行動カードを対象にする。
  // 合算：敵カードの全ダイス値の合計を上回ればカード全体を不発にし、攻撃。
  // 個別：敵カード内の各ダイスと比較し、上回ったダイスだけ取り除いて攻撃。
  if(c.card&&c.card.aoe){
    const mode=c.card.aoe,areaDie=c.card.d.find(d=>d.t==='a');
    if(areaDie){
      const enemies=S.p[1-a.pi].chars.map((z,zi)=>({z,zi})).filter(x=>x.z.alive&&!(x.z.abnState&&x.z.abnState.soloUntargetable));
      for(const item of enemies){
        const target=item.z;if(!target.alive)continue;
        const states=actionStates(target),defSlot=0;if(states[defSlot]&&states[defSlot].used)continue;let defState=states[defSlot]&&states[defSlot].card?states[defSlot]:null;
        setActionSlot(c,a.slot);
        const attackValue=abnormalityRoll(c,areaDie,false,target);
        if(!c.alive)break;
        if(!defState||!defState.card){L(`【広域攻撃：${mode==='sum'?'合算':'個別'}】${c.name}[${attackValue}] → ${target.name}（防御カードなし）`);hit(a.pi,1-a.pi,target,attackValue,c,areaDie);pf([ix(a.pi,c)],[ix(1-a.pi,target)],[ix(a.pi,c),ix(1-a.pi,target)]);if(S.fr.length)S.fr[S.fr.length-1].aoe=mode;continue;}
        setActionSlot(target,defSlot);const defendingCard=defState.card;
        if(mode==='sum'){
          let sum=0;for(const die of defendingCard.d){sum+=abnormalityRoll(target,die,true,c);}
          if(attackValue>sum){defState.used=true;L(`【広域攻撃：合算】${c.name}[${attackValue}] > ${target.name}「${defendingCard.n}」の合計${sum}。カード不発、${attackValue}ダメージ。`);hit(a.pi,1-a.pi,target,attackValue,c,areaDie);pf([ix(a.pi,c)],[ix(1-a.pi,target)],[ix(a.pi,c),ix(1-a.pi,target)]);if(S.fr.length)S.fr[S.fr.length-1].aoe=mode;}
          else {L(`【広域攻撃：合算】${c.name}[${attackValue}] ≤ ${target.name}「${defendingCard.n}」の合計${sum}。ダメージなし。`);pf([],[],[[a.pi,a.ci],[1-a.pi,item.zi]]);if(S.fr.length)S.fr[S.fr.length-1].aoe=mode;}
        }else{
          const originalCount=defendingCard.d.length;let successes=0;
          for(let di=defendingCard.d.length-1;di>=0;di--){const die=defendingCard.d[di];const defValue=abnormalityRoll(target,die,true,c);if(attackValue>defValue){defendingCard.d.splice(di,1);successes++;L(`【広域攻撃：個別】${c.name}[${attackValue}] > ${target.name}のダイス[${defValue}]。ダイスを削除、${attackValue}ダメージ。`);hit(a.pi,1-a.pi,target,attackValue,c,areaDie);pf([ix(a.pi,c)],[ix(1-a.pi,target)],[ix(a.pi,c),ix(1-a.pi,target)]);if(S.fr.length)S.fr[S.fr.length-1].aoe=mode;}}
          if(!successes)L(`【広域攻撃：個別】${c.name}[${attackValue}]は${target.name}のダイスを上回れず、ダメージなし。`);
          if(!defendingCard.d.length)defState.used=true;
        }
        setActionSlot(target,0);
      }
    }
    setActionSlot(c,0);continue;
  }
  if(typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='happy_teddy'&&c.name==='幸せなテディ'&&c.card&&c.card.soloBoss==='teddy_hug'&&c.abnState)c.abnState.hugSpent=true;
  if(hasAbn(c,'seventh_bullet')&&c.card.d.some(d=>d.t==='a')){
   if(!c.abnState)c.abnState={};c.abnState.seventhBulletPages=(c.abnState.seventhBulletPages||0)+1;
   if(c.abnState.seventhBulletPages===7){const all=S.p.flatMap((pp,pi)=>pp.chars.map((z,ci)=>({pi,ci,c:z}))).filter(x=>x.c.alive&&x.c!==c);if(all.length){const picked=all[Math.floor(rnd()*all.length)];qi=picked.pi;Q=S.p[qi];t=picked.c;L(`　「7つ目の弾丸」：7回目の攻撃ページの対象がランダムに決定 → ${t.name}${qi===a.pi?'（味方）':''}`)}}
  }
  // 魅了はボス固有の対象指定も含めて最優先し、ターゲット決定を実際の攻撃対象・表示に一致させる。
  if(c.abnState&&c.abnState.charmedTurn===S.turn&&c.abnState.charmedBy&&c.abnState.charmedBy.alive){
   const charmOwner=c.abnState.charmedBy,ownerPi=S.p.findIndex(p=>p.chars.includes(charmOwner));
   if(ownerPi===1-a.pi){qi=ownerPi;Q=S.p[qi];t=charmOwner;c.tgt=Q.chars.indexOf(charmOwner);L(`　「艶やか」：${c.name}の攻撃対象を魅了の付与者${charmOwner.name}に変更`)}
  }
  if(!t||!t.alive){t=Q.chars.find(x=>x.alive);if(!t){setActionSlot(c,0);continue}}
  const tStates=actionStates(t),matchSlot=qi!==a.pi&&!(t.abnState&&t.abnState.skipThisTurn)?tStates.findIndex(st=>st.card&&!st.used&&st.tgt===a.ci):-1;
  if(matchSlot>=0){
   setActionSlot(t,matchSlot);t.used=true;
   L(`【マッチ】${c.name}「${c.card.n}」(速度${c.sp}) vs ${t.name}「${t.card.n}」`);bleed(qi,t);fx(a.pi,c,c.card.on,'発動時',t);fx(qi,t,t.card.on,'発動時',c);doMatch(a.pi,c,qi,t);setActionSlot(t,0);
  }else{
   L(`${c.name}「${c.card.n}」(速度${c.sp}) → ${t.name}${qi===a.pi?'（味方）':''}`);fx(a.pi,c,c.card.on,'発動時',t);
   let ii=0;const stockSlot=qi!==a.pi?tStates.findIndex(st=>st.stock&&st.stock.length):-1;
   if(stockSlot>=0){setActionSlot(t,stockSlot);L(`　${t.name}は保存していた守備ダイスで対応`);const stock=t.stock;const r=doMatch(a.pi,c,qi,t,c.card.d,stock);ii=r[0];t.stock=t.stock.slice(r[1]);setActionSlot(t,0)}
   else oneSided(a.pi,c,qi,t,c.card.d);
   const dd=c.card.d.slice(ii).filter(x=>x.t!=='a');
   if(c.alive&&dd.length){c.stock=(c.stock||[]).concat(dd);L(`　${c.name}の守備ダイス${dd.length}個を保存（一方攻撃を受けたとき使用）`)}
  }
  setActionSlot(c,0);
 }
 L('── ターン終了時 ──');
 // 「愛する家族」：イラクサの服をターン終了時に1減らす。
 S.p.forEach(p=>p.chars.forEach(c=>{if(!c.alive||!hasAbn(c,'beloved_family')||(c.abnState.nettleClothes||0)<=0)return;c.abnState.nettleClothes=Math.max(0,c.abnState.nettleClothes-1);L(`　「愛する家族」：${c.name}のイラクサの服は${c.abnState.nettleClothes}`)}));
 // 妖精の世話：未解除なら3ターン、ターン終了時に最大HPの15%を回復する。
 S.p.forEach(p=>p.chars.forEach(c=>{if(!c.alive||!hasAbn(c,'fairy_care')||!(c.abnState.fairyCareTurns>0))return;const heal=Math.max(1,Math.ceil(c.max*0.15)),old=c.hp;c.hp=Math.min(c.max,c.hp+heal);if(c.hp>old)L(`　「妖精の世話」：${c.name}はHP${c.hp-old}回復`);c.abnState.fairyCareTurns--;if(c.abnState.fairyCareTurns<=0)L(`　「妖精の世話」：${c.name}の回復効果が終了`)}));
 // 鼓動：そのチームがこのターン一度もダメージを与えられなければ、全員が最大体力の25%を失う
 S.p.forEach((p,pi)=>{if(!S.turnDamageTeam[pi]&&p.chars.some(c=>c.alive&&hasAbn(c,'heartbeat'))){p.chars.forEach(c=>{if(!c.alive)return;const n=Math.max(1,Math.ceil(c.max*0.25));c.hp-=n;L(`　「鼓動」：${c.name}は${n}ダメージ`);if(c.hp<=0){c.hp=0;c.alive=false;L(`　${c.name}は倒れた`)}})}});
 // 押し寄せる鼓動：付与から3ターン経過後に死亡
 S.p.forEach(p=>p.chars.forEach(c=>{if(c.alive&&c.abnState&&c.abnState.surgingCountdown>0&&S.turn>(c.abnState.surgingAppliedTurn||0)){c.abnState.surgingCountdown--;if(c.abnState.surgingCountdown<=0){c.hp=0;c.alive=false;c.abnState.surgingActive=false;L(`　「押し寄せる鼓動」：${c.name}は3ターン経過し死亡`)}}}));
 // 女王蜂の胞子：ターン終了時に現在値分の固定ダメージを与え、値を半減（切り捨て）。
 if(typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='queen_bee')S.p.forEach((p,pi)=>p.chars.forEach(c=>{const v=c.st&&c.st.spore||0;if(!c.alive||v<=0)return;direct(pi,c,v,'spore');c.st.spore=Math.floor(v/2);L(`　胞子：${c.name}の値は${c.st.spore}になった`);pf([],[ix(pi,c)],null)}));
 S.p.forEach((p,pi)=>p.chars.forEach(c=>{if(c.alive&&c.st.burn){direct(pi,c,c.st.burn,'burn');pf([],[ix(pi,c)],null)}}));
 S.p.forEach(p=>p.chars.forEach(c=>{if(c.alive)['burn','bleed','rupt'].forEach(k=>{c.st[k]=decay(c.st[k])})}));
 S.p.forEach((p,pi) => {if(!(typeof SOLO!=='undefined'&&SOLO.active&&pi===1))resolveEmotion(p)});
 pf([],[],null);
 S.p.forEach((p,pi)=>checkPhillipAwakening(pi));
 const n=S.p.map(alive);
 if(!n[0]||!n[1]){S.over=n[0]===n[1]?'引き分け':n[0]?`${S.p[0].name}の勝利、おめ`:`${S.p[1].name}の勝利、おめ`;L(`★ ${S.over}`)}
 S.inCombat=false;S.phase='result';S.cover=null;play(frames,base,hp0,hold0,st0);
}
// 戦闘演出は最初のフレームから表示する。OSの「視差効果を減らす」設定が
// 有効でも演出全体を無条件に飛ばさず、短い間隔で再生する（手動スキップは可能）。
function animFrameDelay(A){
 const frame=A.frames[A.i]||{},ms=Number(frame.ms)||750;
 return A.reducedMotion?Math.max(180,Math.min(320,Math.round(ms*0.25))):Math.max(180,ms);
}
function play(frames,base,hp0,hold0,st0){
 if(!frames.length){S.anim=null;render();return}
 const reduced=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const A=S.anim={frames,base,hp0,hold0,st0,i:0,t:null,reducedMotion:reduced};
 // render()の表示更新で例外が起きてもアニメーション進行用タイマーが失われないよう先に予約する。
 A.t=setTimeout(()=>step(A),animFrameDelay(A));
 render();
}
function step(A){
 if(!S||S.anim!==A)return;
 A.i++;
 if(A.i>=A.frames.length){S.anim=null;render();return}
 A.t=setTimeout(()=>step(A),animFrameDelay(A));
 render();
}
function skipAnim(){if(S&&S.anim){clearTimeout(S.anim.t);S.anim=null;render()}}
const logLines=()=>{const A=S.anim;return A?S.log.slice(0,A.i<0?A.base:A.frames[A.i].to):S.log};
function nextTurn(){
 S.p.forEach(p=>{
  const n=alive(p);
  p.chars.forEach(c=>{
   actionStates(c).forEach(st=>{if(st.card){if(st.card.once&&st.used)p.gone=(p.gone||0)+1;else p.disc.push(st.card)}st.card=null;st.tgt=null;st.used=false;st.hitFired=[];st.stock=null;st.redirBy=null;st.tgt0=null});setActionSlot(c,0);
   c.bf=c.nx;c.nx=BF0();   // 「次のターン」のバフが有効になる
   if(c.abnState){c.abnState.surgingActive=false;c.abnState.speedDownNow=0;c.abnState.frostSpeedDown=0;c.abnState.teamDiceBonus=0;c.abnState.skipThisTurn=false;}
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
 const A=S.anim,fr=A&&A.i>=0?A.frames[A.i]:null;
 // 働き蜂などが戦闘途中に生成された場合、生成前のフレームにはそのキャラの
 // HP・手札・状態スナップショットがない。欠けた履歴を使って描画が例外終了しないよう、
 // そのキャラの現在値にフォールバックする。
 const frameAt=(grid,fallback)=>grid&&grid[pi]&&grid[pi][ci]!==undefined?grid[pi][ci]:fallback;
 const hv=A?frameAt(A.i<0?A.hp0:fr&&fr.hp,c.hp):c.hp,dead=A?hv<=0:!c.alive,dmv=fr&&fr.dm?fr.dm[`${pi}-${ci}`]:undefined;
 let cls='ch'+(c.size>1?' big':'')+(dead?' dead':'');
 const has=l=>l.some(x=>x[0]===pi&&x[1]===ci);
 const low=pi===view;   // 画面の下側に出ているのは自分側（オンラインのP2視点では pi=1 が下）
 if(fr&&has(fr.lu))cls+=low?' up':' dn';
 if(fr&&has(fr.sh))cls+=' hurt';
 const hd=A?(frameAt(A.i<0?A.hold0:fr&&fr.hold,[])||[]):[],gh=hd.length?`<div class="ghosts ${low?'top':'bot'}">${hd.map(x=>`<span class="die ${x.t} ghost${x.s?' st':''}">${T[x.t]}${x.r[0]}-${x.r[1]}</span>`).join('')}</div>`:'';
 const sn=A?(frameAt(A.i<0?A.st0:fr&&fr.sts,c)||c):c,ST=sn.st,stk=['burn','bleed','rupt','vib','cold','spore'],bk=['dmgup','guard','roll','dmgdn','vuln','rolldn','atk'];
 const evs=fr?fr.ev.filter(e=>e[0]===pi&&e[1]===ci).map(e=>e[2]):[];
 const badge=(k,v,nx)=>`<span class="stt${nx?' nx':''}" style="--c:${STN[k].c}" title="${STN[k].n}${nx?'（次のターンから）':''}：${STN[k].t}">${STN[k].i}${bk.includes(k)?(['guard','dmgdn','rolldn'].includes(k)?'-':'+'):''}${v}${nx?'<small>次</small>':''}</span>`;
 const sts=stk.filter(k=>ST[k]>0).map(k=>badge(k,ST[k])).join('')+bk.filter(k=>sn.bf[k]>0).map(k=>badge(k,sn.bf[k])).join('')+bk.filter(k=>sn.nx[k]>0).map(k=>badge(k,sn.nx[k],1)).join('');
 const ad=c.abnState||{},special=[];
 const specialBadge=(k,label,value='',next=false)=>`<span class="stt${next?' nx':''}" style="--c:${STN[k].c}" title="${STN[k].n}${next?'（次のターン）':''}：${STN[k].t}">${STN[k].i} ${label}${value!==''?` ${value}`:''}${next?'<small>次</small>':''}</span>`;
 if(ad.skipThisTurn)special.push(specialBadge('incap','行動不能'));
 if(ad.skipNextTurn)special.push(specialBadge('incap','行動不能','',true));
 if(ad.iceLocked)special.push(specialBadge('freeze','凍結'));
 if((ad.iceShard||0)>0)special.push(specialBadge('iceShard','氷の欠片',ad.iceShard));
 if((ad.speedDownNow||0)>0)special.push(specialBadge('speedDown','速度低下',`-${ad.speedDownNow}`));
 if((ad.speedDownNext||0)>0)special.push(specialBadge('speedDown','速度低下',`-${ad.speedDownNext}`,true));
 const hiveMark=Object.values(ad.hiveMarks||{}).reduce((n,v)=>n+(Number(v)||0),0);
 if(hiveMark>0)special.push(specialBadge('hiveMark','蜂の標的',`被ダメージ+${hiveMark}`));
 const requestMark=Object.values(ad.requestMarks||{}).reduce((n,v)=>n+(Number(v)||0),0);
 if(requestMark>0)special.push(specialBadge('requestMark','依頼対象',`被ダメージ+${requestMark}`));
 if((ad.fairyDamageTaken||0)>0)special.push(specialBadge('takenPlus','被ダメージ増加',`+${ad.fairyDamageTaken}`));
 if(ad.charmedTurn===S.turn&&ad.charmedBy)special.push(specialBadge('charm','魅了',`→${ad.charmedBy.name}`));
 if(ad.giftFrom)special.push(specialBadge('gift','プレゼント'));
 if((ad.nettleClothes||0)>0)special.push(specialBadge('nettle','イラクサの服',ad.nettleClothes));
 if(hasAbn(c,'gaze'))special.push(specialBadge('gazeTaken','与・被ダメージ×2'));
 const globalMusicTaken=globalAbnHolders('music').reduce((n,x)=>n+((x.c.abnState&&x.c.abnState.musicDmgTaken)||0),0);
 if(globalMusicTaken>0)special.push(specialBadge('globalMusic','音楽の影響',`被ダメージ+${globalMusicTaken}`));
 if(globalAbnHolders('blackening').length)special.push(specialBadge('globalBlackening','黒化の影響','被ダメージ×1.5'));
 const extraStatuses=special.join('');
 const aur=dead?'':stk.filter(k=>ST[k]>0).map(k=>`<i class="aur ${k}"></i>`).join('');
 const trg=evs.find(e=>e.k),dbase=(dmv||0)-evs.reduce((x,e)=>x+e.a,0);
 if(trg)cls+=' trg';
 const fl=(dbase>0?`<div class="dmg">-${dbase}</div>`:'')+evs.map((e,k)=>`<div class="dmg ${e.k}" style="top:${38+k*13}%;left:${50+(k%2?22:-22)}%">${e.t||'-'+e.a}</div>`).join('');
 const sc=isMine&&S.sel!=null?p.hand[S.sel]:null;
 if(sc&&!isCh(sc)&&sc.req&&!c.at.includes(sc.req))cls+=' dimc';   // 使えないキャラを暗くする
 if(isMine&&c.alive)cls+=' mine'+(S.pend===ci?' pend':'');
 if(decide&&pi!==view&&S.pend!=null&&c.alive&&!(c.abnState&&c.abnState.soloUntargetable))cls+=' tgt';
 const ev=isMine?`onclick="mine(${ci})" ondragover="event.preventDefault()" ondrop="event.preventDefault();assign(${ci},+event.dataTransfer.getData('text/plain'))"`:
  (cls.includes('tgt')?`onclick="pickTgt(${ci})"`:'');
 let a='';
 if(isMine||!decide||(NET.on&&pi===view)){
  a=actionStates(c).map((st,slot)=>{if(!st.card)return '';const tg=st.tgt!=null?` → ${typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='queen_bee'&&pi===1&&c.name==='働き蜂'&&c.abnState&&c.abnState.targetQueen?'女王蜂':(S.p[1-pi].chars[st.tgt]?S.p[1-pi].chars[st.tgt].name:'対象')}`:'（対象未設定）';const cancel=isMine&&slot===0?`<button class="x" title="このキャラに割り当てた行動をすべて解除" onclick="unassign(${ci},event)">×</button>`:'';const retarget=isMine&&!NET.on&&st.tgt!=null?`<button class="sub" style="font-size:10px;padding:2px 4px" onclick="chooseTarget(${ci},${slot},event)">対象変更</button>`:'';return `<div class="act">${cancel}<b>${c.actionRights>1?`行動${slot+1}：`:''}${st.card.n}</b>${tg}${retarget}${fxLine(st.card)}<div>${diceHTML(st.card.d)}</div></div>`}).join('');
 }
 const showAbn=!!c.showAbn,abnList=c.abn||[];
 const detail=showAbn?(abnList.length?`<ul class="pl abnlist">${abnList.map(x=>`<li>✦ ${x.n}：${x.desc}</li>`).join('')}</ul>`:'<div class="pl">幻想体カードはまだありません</div>'):`<ul class="pl">${c.ps.map(x=>`<li>${x.n}${x.from?'（借）':''}：${pasText(x)}</li>`).join('')}</ul>`;
 const switchBtn=`<button class="sub" style="font-size:11px;padding:3px 6px;margin:3px 0" onclick="toggleCharacterView(${pi},${ci},event)">${showAbn?'パッシブ':'幻想体カード'}</button>`;
 return `<div id="ch-${pi}-${ci}" class="${cls}" ${ev} style="${trg?`--c:${STN[trg.k].c}`:''}">${aur}<div class="nm"><span>${c.name}${c.size>1?` <span class="sz">${c.size}枠</span>`:''}${c.actionRights>1?` <span class="sz">行動権${c.actionRights}</span>`:''}${ttlHTML(c)}</span><span class="sp">速度 ${c.alive?c.sp:'-'}</span></div>
 <div>HP ${hv}/${c.max}　<small>帰属枠 ${c.slot}</small></div><div class="bar"><i style="width:${hv/c.max*100}%"></i></div>
 <div class="sts">${sts}${extraStatuses}${typeof SOLO!=='undefined'&&SOLO.active&&SOLO.bossId==='fairy_festival'&&c.name==='妖精の塊'&&c.abnState&&c.abnState.preparedMeatTurn===S.turn?'<span class="stt" style="--c:#d9a441" title="ターン終了時にHP1なら女王妖精に捕食される">🍖 用意された肉</span>':''}${c.kb?`<span class="stt" style="--c:#d65a4f" title="撃破ボーナス：ダイス値+${c.kb}（戦闘中永続）">⚔+${c.kb}</span>`:''}</div>${switchBtn}${detail}${atHTML(c)}${a}${fl}${gh}</div>`;
}
const costDots=(p,u)=>{const on=p.cost-u;let h='';for(let i=0;i<p.max;i++)h+=`<i class="dot${i<on?' on':i<p.cost?' rs':''}"></i>`;return `<span class="cost" title="コスト ${on}/${p.max}">コスト ${h} <small>${on}/${p.max}</small></span>`};
const emoGauge = p => {
  const need = coinNeed(p);
  let h = '';
  for (let i = 0; i < 5; i++) {
    h += `<i class="seg${i < p.lv ? ' on' : ''}"></i>`;
  }
  return `<span class="emo" title="感情レベル ${p.lv}/5（コイン ${p.coin}/${need}）／＋感情${p.emoPos||0}・−感情${p.emoNeg||0}">
    感情Lv <b>${p.lv}</b> ${h} <small>＋${p.emoPos||0} / −${p.emoNeg||0}</small>
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
  return `<div class="card chc${sel?' sel':''}" ${drag} ${clk}><b>${c.name}</b>${c.size>1?` <span class="sz">${c.size}枠</span>`:''}${ttlHTML(c)} <span class="c">HP${c.hp}</span> <span class="sp">速度${c.spd[0]}-${c.spd[1]}</span> <small>帰属枠${c.slot}</small><ul class="pl">${c.ps.map((x,k)=>`<li class="${k?'':'top'}">${k?'':'▶ '}${x.n}：${pasText(x)}</li>`).join('')}</ul>${atHTML(c)}${mode==='play'?'<div class="fx">キャラに重ねると先頭のパッシブを帰属（カードは消滅）</div>':''}</div>`;
 }
 return `<div class="card${mode==='setup'?' off':''}${mode==='play'&&S.sel===i?' sel':''}" ${drag}><b>${c.n}</b> <span class="c">コスト${c.c}</span>${fxLine(c,false)}${diceRows(c)}</div>`;
};
const legendHTML=()=>`<details class="lg"><summary>状態異常・バフの説明</summary>${Object.keys(STN).map(k=>`<div><span class="stt" style="--c:${STN[k].c}">${STN[k].i}</span> <b>${STN[k].n}</b>：${STN[k].t}</div>`).join('')}${Object.keys(ATTR).map(k=>`<div><b>属性：${ATTR[k].n}</b>：${ATTR[k].t}</div>`).join('')}<div><small>破線のバッジは「次のターンから」有効になるバフです。</small></div></details>`;
function abnormalityOfferHTML(p,enabled){
 if(!p.pendingAbn||!enabled)return '';
 const ratio=Math.round(positiveMoodRatio(p)*100),selected=p.abnSelected;
 const cards=p.abnOffers.map((c,i)=>`<div class="card${selected===i?' sel':''}" style="min-width:150px;max-width:240px;flex:1;border:1px solid ${selected===i?'#e7c65a':'var(--line)'};padding:10px"><b>${c.n}</b><div><small>${c.hierarchy}／${c.mood==='positiveMany'?'正の感情多め':c.mood==='positive'?'正の感情':c.mood==='negativeSuper'?'負の感情超多め':c.mood==='negativeMany'?'負の感情多め':c.mood==='negative'?'負の感情':'混合'}</small></div><p>${c.desc}</p><button class="sub" onclick="pickAbnormality(${i})">${selected===i?'選択中':'このカードを選ぶ'}</button></div>`).join('');
 return `<section style="margin:10px 0;padding:12px;border:1px solid var(--line);border-radius:10px;background:rgba(30,35,50,.75)"><h2 style="margin:0 0 6px">幻想体カードを1枚選択</h2><div class="msg">階層：${p.hierarchy}　感情比率：＋${p.emoPos||0} / −${p.emoNeg||0}（正の感情傾向 ${ratio}%）</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${cards}</div><p class="msg">${selected==null?'候補から1枚選び、その後に付与したい味方キャラをクリックしてください。':'選んだカードを付与する味方キャラをクリックしてください。'}</p></section>`;
}
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
  h+=abnormalityOfferHTML(p,can)+`<div class="msg">${can?(p.pendingAbn?'幻想体カードの選択と付与を完了してください。':(S.msg||'技カードを自分のキャラへドラッグ（またはカード→キャラの順にクリック）。キャラカードを重ねるとパッシブを帰属できます')):'相手が行動を決めています。決定されるまでお待ちください…'}</div>
  <div class="handwrap"><div class="hand">${p.hand.map((c,i)=>handHTML(c,i,can?'play':'view')).join('')}</div></div>`;
  if(can)h=`<div class="topbar"><button class="go" onclick="done()">${S.stage===0?(NET.on?'決定（相手の番へ）':'決定（相手に交代）'):'決定して戦闘開始'}</button></div>`+askHTML()+h;   // 誤操作を防ぐため一番上に配置
 }else{
  h+=S.anim?`<button class="sub" style="margin-top:10px" title="戦闘演出を最後まで再生せずに結果へ進みます" onclick="skipAnim()">演出をスキップ</button>`:S.over?`<h1 style="margin:12px 0">${S.over}</h1>${NET.on?(NET.rm[NET.me]?'<span class="msg">相手の返事を待っています…</span>':'<button class="go" onclick="netRematch()">もう一度対戦</button>'):'<button class="go" onclick="startMatch()">同じデッキでもう一度</button>'} <button class="sub" onclick="toHome()">ホームへ戻る</button>`:`<button class="go" style="margin-top:10px" onclick="nextTurn()">次のターンへ</button>`;
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
 document.getElementById('app').innerHTML=`<div class="home"><h1 style="font-size:1.8rem">（仮）カードゲーム</h1><p><small>Library of Ruina風・2人交代制の対戦</small></p>${named?box+st(0)+st(1):gate}
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
   <li>対戦が始まったら、各プレイヤーがデッキのキャラカードから<b>場に出すキャラ</b>を選びます。場の枠は<b>${C.FIELD}つ</b>で、通常の大型キャラは2枠を使い、「蜜蝋の翼」を得たフィリップも場の枠は1つのままです。</li>
   <li>選ばなかったキャラカードは山札に戻ります（あとで手札に来て、パッシブの帰属に使えます）。</li>
   <li>最初の手札は5枚、コストは${C.COST}です。</li>
  </ul></section>

 <section><h2>3. 1ターンの流れ</h2>
  <ol>
   <li><b>速度ダイス</b>：各キャラが速度ダイスを振ります（キャラごとの速度範囲＋パッシブ）。</li>
   <li><b>行動の決定</b>：速度の<b>平均が低い</b>プレイヤーから先にカードを割り当て、攻撃対象を決めます。もう一方のプレイヤーは、先に決めた側の割り当てを見たうえで決められます。</li>
   <li><b>戦闘</b>：両者が決め終わると、速度の高いキャラから順に行動します。</li>
   <li><b>ターン終了</b>：火傷などの継続効果を処理し、対象の状態異常値を減衰させます。</li>
   <li><b>次のターンの準備</b>：使ったカードは山札に混ざります。生きているキャラ数＋1枚ドローし、コストも同じだけ回復します（上限まで）。</li>
  </ol></section>

 <section><h2>4. カードを使う</h2>
  <ul>
   <li>手札の技カードを、自分のキャラにドラッグ（またはカードを選んでキャラをクリック）して割り当て、<b>攻撃対象の相手キャラ</b>をクリックします。通常は1キャラにつき1枚ですが、「蜜蝋の翼」を得たフィリップは行動権2となり、最大2枚まで割り当てられます。</li>
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
   <li>攻撃命中・マッチ勝利・撃破を「正の感情」、被弾・マッチ敗北・味方の撃破を「負の感情」として記録します。正負の比率によって、提示される幻想体カードの傾向が変わります。</li>
   <li>感情レベル上昇後、次の自分の行動決定時に候補3枚から1枚を選び、味方キャラ1体に付与します。候補はデッキ構築で選んだ階層のカードから出ます。</li>
  </ul></section>

 <section><h2>7. パッシブとキャラ</h2>
  <ul>
   <li>キャラは<b>パッシブ</b>（常に働く能力）を持ちます。数値を足すもの、ターン開始時に働くもの、条件で働くものなどがあります。</li>
   <li>手札に来た<b>キャラカード</b>を味方キャラにドラッグすると、そのカードの一番上のパッシブを、そのキャラに<b>帰属</b>できます。帰属したカードは消滅し、キャラの「帰属枠」が1つ減ります。帰属枠が0のキャラには帰属できません。</li>
   <li>戦闘中のキャラにある「幻想体カード」ボタンで、パッシブ表示と幻想体カード表示を切り替えられます。</li>
  </ul></section>

 <section><h2>8. 状態異常とバフ・デバフ</h2>
  <h3>数値を持つ状態異常</h3>
  <ul>${['burn','bleed','rupt','vib','cold','spore'].map(st).join('')}</ul>
  <h3>行動阻害・被ダメージ増加などの特殊デバフ</h3>
  <ul>${['incap','freeze','iceShard','speedDown','hiveMark','requestMark','takenPlus','globalMusic','globalBlackening','gazeTaken'].map(st).join('')}</ul>
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
function dkClear(){
 if(!confirm(`デッキ${DK.cur+1}に入っているカードをすべて解除しますか？\nこの操作は「初期デッキに戻す」と違い、空のデッキになります。`))return;
 DK.d[DK.cur]={};saveDecks();render();
}
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
  const body=isCh(c)?`<b>${c.name}</b>${c.size>1?` <span class="sz">${c.size}枠</span>`:''}${ttlHTML(c)} <span class="c">HP${c.hp}</span> <span class="sp">速度${c.spd[0]}-${c.spd[1]}</span> <small>帰属枠${c.slot}</small><ul class="pl">${c.ps.map(id=>`<li>${PAS[id].n}：${pasText(PAS[id])}</li>`).join('')}</ul>${atHTML(c)}`
   :`<b>${c.n}</b> <span class="c">コスト${c.c}</span>${fxLine(c,false)}${diceRows(c)}`;
  return `<div class="tile${n?' in':''}">${body}<div class="cnt"><button class="sub" onclick="dkAdd('${k}',-1)">−</button><b>${n}</b><button class="sub" onclick="dkAdd('${k}',1)">＋</button></div></div>`;
 };
 const scr=id=>{const e=document.getElementById(id);return e?e.scrollTop:0},sL=scr('dkL'),sR=scr('dkR');   // 再描画しても各ペインのスクロール位置を保つ
 const inDeck=[...CHARS.filter(c=>d[key(c)]),...SKILLS.filter(c=>d[key(c)]).sort((a,b)=>a.c-b.c)];   // 右ペイン：キャラ→技（コスト順）
 document.getElementById('app').innerHTML=`<h1 style="margin:10px 0">デッキ構築　<small>${PF.name||''}</small></h1>
 <div>${[0,1].map(i=>`<button class="sub${i===DK.cur?' sel':''}" onclick="DK.cur=${i};render()">デッキ${i+1}</button>`).join(' ')}</div>
 <p style="margin:10px 0"><label for="abnHierarchy">このデッキで使う幻想体カードの階層：</label> <select id="abnHierarchy" onchange="dkHierarchy(this.value)">${ABN_HIERARCHIES.map(x=>`<option value="${x}"${DK.hiers[DK.cur]===x?' selected':''}>${x}</option>`).join(' ')}</select><br><small>感情レベルが上がると、この階層の幻想体カードから候補3枚が提示されます。</small></p>
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
 <p class="dktools"><button class="sub" onclick="dkReset()">初期デッキに戻す</button> <button class="sub" onclick="dkClear()">カード一括解除</button> <button class="sub" onclick="dkOut()">コードを書き出す</button> <button class="sub" onclick="dkIn()">コードを読み込む</button></p>
 <textarea id="code" rows="3" style="width:100%;background:#10131f;color:var(--ink);border:1px solid var(--line)"></textarea>`;
 const rs=(id,v)=>{const e=document.getElementById(id);if(e)e.scrollTop=v};rs('dkL',sL);rs('dkR',sR);
}
function drawArrows(){
 const svg=document.getElementById('arr'),bd=document.getElementById('board');if(!svg||!bd)return;
 const decide=S.phase==='decide',view=NET.on?NET.me:(decide?act():0),B=bd.getBoundingClientRect();
 let h='<defs><marker id="as" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#a879ff"/></marker><marker id="ai" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#35c9d0"/></marker><marker id="ag" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#d9a93f"/></marker><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#d65a4f"/></marker></defs>';
 const add=(pi,ci,qi,ti,area=null)=>{
  const a=document.getElementById(`ch-${pi}-${ci}`),b=document.getElementById(`ch-${qi}-${ti}`);if(!a||!b)return;
  const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),up=ra.top<rb.top;
  const x1=ra.left+ra.width/2-B.left,y1=(up?ra.bottom:ra.top)-B.top,x2=rb.left+rb.width/2-B.left,y2=(up?rb.top:rb.bottom)-B.top;
  const own=pi===view,stroke=area==='sum'?'#a879ff':area==='individual'?'#35c9d0':(own?'#d9a93f':'#d65a4f'),marker=area==='sum'?'as':area==='individual'?'ai':(own?'ag':'ar');
  h+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" marker-end="url(#${marker})"/>`;
 };
 if(S.anim){const f=S.anim.i>=0&&S.anim.frames[S.anim.i];if(f&&f.ar)add(f.ar[0][0],f.ar[0][1],f.ar[1][0],f.ar[1][1],f.aoe||null)}
 else[0,1].forEach(pi=>{
  if(decide&&!(pi===view||(S.stage===1&&pi===S.order[0])))return;
  S.p[pi].chars.forEach((c,ci)=>actionStates(c).forEach(st=>{if(!st.card||st.tgt==null)return;if(st.card.aoe)S.p[1-pi].chars.forEach((enemy,ti)=>{if(enemy.alive)add(pi,ci,1-pi,ti,st.card.aoe)});else add(pi,ci,1-pi,st.tgt,null)}));
 });
 svg.innerHTML=h;
}
