// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ★ パッシブ ★  定義・説明文・動作は、すべてこの区画（PAS と PK）にまとめてある  ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// 【新しいパッシブを作る手順】
//   ① PAS に1行足す          …… 名前(n)・種類(k)・数値(v)。例）mine:{n:'名前',k:'regen',v:3}
//   ② 新しい「種類(k)」が必要なら PK に1つ足す …… 説明文(t)と、動作（フック）を書く
//   ③ キャラの ps:['mine'] に書く（帰属カードのパッシブにも同じキーが使える）
//
// 【種類(k)の動作の書き場所は PK だけ】 PK[k] に書けるもの：
//   t(p)           説明文。p＝パッシブ（p.v が数値）                      ← 必須
//   use            （数値型だけ）どこで読まれるかのメモ
//   init(c,x)      戦闘開始時と、帰属で受け取った瞬間に1回        例）頑強
//   start(c,x)     戦闘開始時に1回だけ（帰属では動かない）            例）捨て身の覚悟
//   turn(c,x,pi)   ターン開始時に毎回                               例）再生・蔵書の加護
//   speed(c,x,e)   速度ダイスが出そろった直後。新しい速度を返す(返さなければ変えない)。
//                  e={allMax:全員の最大速度, team:自分のチームの生存者}   例）最強
//   kill(A,x,B)    攻撃で敵Bを倒した直後（Aは倒した側）             例）赤い霧
//   dice(c,x,d)    ダイスを振るとき、出目に足す数を返す（d＝そのダイス / c.card＝使用中のカード） 例）属性カード強化・背水の陣
//   lvup(c,x,lv)   持ち主の側の感情レベルが上がった直後（lv＝新しいレベル）       例）闘志の発露
//   need:['pct']   （任意）そのパッシブに必ず書くべき項目。書き忘れると読み込み時にエラーにする
//   ※ c＝持ち主 / x＝そのパッシブ(x.v, x.n, x.fx) / pi＝プレイヤー番号
//   ※ 数値を足すだけの種類は、戦闘処理が pv(キャラ,'種類') で読む（読む場所は各 use に書いた）
//
// ---------- ① パッシブ一覧（k=種類 / v=数値） ----------
const PAS={
 tough:{n:'頑強',k:'maxhp',v:6},
 swift:{n:'俊敏',k:'spd',v:2},
 sharp:{n:'鋭利',k:'atk',v:1},
 wall:{n:'堅守',k:'def',v:2},
 float:{n:'身軽',k:'eva',v:2},
 armor:{n:'重装',k:'guard',v:1},
 heal:{n:'再生',k:'regen',v:2},
 lib:{n:'蔵書の加護',k:'ts',fx:[['draw',1]]},
 flow:{n:'気力',k:'ts',fx:[['cost',1]]},
 fervor:{n:'高揚',k:'ts',fx:[['coin',1]]},
 strongest:{n:'最強',k:'catchup',v:2},
 bloodlust:{n:'赤い霧',k:'killup',v:2},
 hongoku:{n:'本国剣術',k:'atk',v:2},
 yourshield:{n:'あなたの盾',k:'def',v:1},
 debuffup:{n:'狙撃',k:'debuffup',v:1},
 ailmentup:{n:'集中',k:'ailmentup',v:1},
 ailmentup1:{n:'スティグマ工房の武器',k:'ailmentup',v:1},
 mistedge:{n:'E.G.Oプロトタイプ',k:'cardup',at:'RedMist',v:1},   // 赤い霧属性のカードのダイス値+v（at＝属性名。ATTRのキー）
 aim:{n:'精密射撃',k:'cardup',at:'ranged',v:1},         // 遠距離属性のカードのダイス値+v
 lowhp:{n:'死の目',k:'lowhp',pct:20,v:2},          // HPが最大値の pct% 以下のとき、ダイス値+v
 lowhp1:{n:'死線足掻き',k:'lowhp',pct:80,v:1},
 startdmg:{n:'疲弊',k:'startdmg',pct:90},      // 戦闘開始時、HPが最大値の pct% 減少
 startdmg1:{n:'疲弊',k:'startdmg',pct:25},
 emolv:{n:'熱血',k:'emolv',lv:2,v:1},      // 感情レベルが lv 以上のとき、全ダイス値+v
 lvbuff:{n:'臨戦無退',k:'lvbuff',v:2},            // 感情レベルが上がったとき、1ターンの間ダメージ+v
 ailmentup2:{n:'制式服-リウ協会',k:'ailmentup',v:2},
 vibcheck:{n:'共鳴',k:'vibcheck',min:3,v:2},
 rangedres:{n:'青い残響',k:'rangedres'},
 emostack:{n:'龍生九子',k:'emostack'},
};
// ---------- ② 種類(k)ごとの 説明文＋動作 ----------
const PK={
 // ── 数値を足すだけのタイプ（pv で読まれる）──
 spd:{t:p=>`速度+${p.v}`,use:'startTurn()：速度ダイスに加算'},
 atk:{t:p=>`攻撃ダイス+${p.v}`,use:'roll()：攻撃ダイスの出目に加算'},
 def:{t:p=>`防御ダイス+${p.v}`,use:'roll()：防御ダイスの出目に加算'},
 eva:{t:p=>`回避ダイス+${p.v}`,use:'roll()：回避ダイスの出目に加算'},
 guard:{t:p=>`被ダメージ-${p.v}`,use:'hit()：受けるダメージから引く'},
 debuffup:{t:p=>`相手に与えるデバフ（ダイス値減少・被ダメージ増加・与ダメージ減少）の付与量+${p.v}`,use:'FXA：rolldn/vuln/dmgdn の付与量に加算'},
 ailmentup:{t:p=>`相手に与える状態異常（火傷・出血・破裂・振動）の付与量+${p.v}`,use:'FXA：burn/bleed/rupt/vib の付与量に加算'},
 ailmentup1:{t:p=>`相手に与える状態異常（火傷・出血・破裂・振動）の付与量+${p.v}`,use:'FXA：burn/bleed/rupt/vib の付与量に加算'},
 ailmentup2:{t:p=>`相手に与える状態異常（火傷・出血・破裂・振動）の付与量+${p.v}`,use:'FXA：burn/bleed/rupt/vib の付与量に加算'},
 // ── 動作（フック）を持つタイプ ──
 maxhp:{t:p=>`最大HP+${p.v}`,
  init:(c,x)=>{c.max+=x.v;c.hp+=x.v}},
 regen:{t:p=>`ターン開始時HP+${p.v}`,
  turn:(c,x)=>{c.hp=Math.min(c.max,c.hp+x.v);L(`　${c.name}の${x.n}：HP+${x.v}`)}},
 ts:{t:p=>`ターン開始時：${fxText(p.fx)}`,                       // ターン開始時にカード効果(fx)を発動
  turn:(c,x,pi)=>fx(pi,c,x.fx,`パッシブ「${x.n}」`)},
 catchup:{t:p=>`チーム内で最も遅いとき、速度が全員の最大速度+${p.v}になる`,
  // 仲間がいなくても「最遅」扱い。仲間がいるときだけ発動させたいなら、e.team.length<2 のとき null を返す
  speed:(c,x,e)=>e.team.some(o=>o!==c&&o.sp<c.sp)?null:e.allMax+x.v},
 killup:{t:p=>`敵を倒すたび、ダイス値+${p.v}（戦闘中ずっと続く）`,
  kill:(A,x,B)=>{A.kb=(A.kb||0)+x.v;L(`　${A.name}の${x.n}：ダイス値+${x.v}（累計+${A.kb}）`)}},   // A.kb は roll() が読む
 // 「ある属性のカード」を使うときだけ、そのカードの全ダイスの出目に +v（at＝属性名）
 cardup:{t:p=>`${(ATTR[p.at]||{n:p.at}).n}属性のカードのダイス値+${p.v}`,
  dice:(c,x,d)=>c.card&&c.card.req===x.at?x.v:0},
 // HP が最大値の pct% 以下のとき、全ダイスの出目に +v（現在HPで毎回判定）
 lowhp:{t:p=>`HPが最大値の${p.pct}%以下のとき、ダイス値+${p.v}`,need:['pct','v'],
  dice:(c,x)=>c.hp<=c.max*x.pct/100?x.v:0},
 // 戦闘開始時に、HP が最大値の pct% 減る（端数は切り捨て・HPは最低1残る）
 startdmg:{t:p=>`戦闘開始時、HPが最大値の${p.pct}%減少する`,need:['pct'],
  start:(c,x)=>{c.hp=Math.max(1,c.hp-Math.floor(c.max*x.pct/100))}},
 // 感情レベルが lv 以上のあいだ、全ダイスの出目に +v（持ち主の側の現在の感情レベルで毎回判定）
 emolv:{t:p=>`感情レベルが${p.lv}以上のとき、ダイス値+${p.v}`,need:['lv','v'],
  dice:(c,x)=>{const p=ownerOf(c);return p&&p.lv>=x.lv?x.v:0}},
 // 感情レベルが上がるたびに、与ダメージ+v を「1ターン分」得る
 //   戦闘中に上がった → 次のターン1回ぶん（nx） / ターン開始時に上がった → そのターン（bf）
 // 感情レベル2ごとに全ダイス値+1
emostack:{
  t:()=>`感情レベル2ごとにダイス値+1`,
  dice:c=>{
    const p=ownerOf(c);
    return p?Math.floor(p.lv/2):0;
  }
},
 lvbuff:{t:p=>`感情レベルが上がったとき、1ターンの間ダメージ+${p.v}`,need:['v'],
  lvup:(c,x)=>{const k=S.inCombat?'nx':'bf';c[k].dmgup+=x.v;L(`　${c.name}の${x.n}：${S.inCombat?'次のターン':'このターン'}ダメージ+${x.v}`)}},
 vibcheck:{
  t:p=>`相手の振動が${p.min}以上なら、ダイス値+${p.v}`,
  need:['min','v'],
  // c.tgt は「狙っている相手キャラの番号」。相手側のキャラを取り出して、その振動を見る
  dice:(c,x)=>{const o=S.p.findIndex(q=>q.chars.includes(c)),t=o<0||c.tgt==null?null:S.p[1-o].chars[c.tgt];return t&&t.st.vib>=x.min?x.v:0}
 },
 rangedres:{
  t:()=>`遠距離属性から受けるダメージ半減`
},
};
// ---------- ③ 仕組み（ここから下は触らなくてOK） ----------
const pasText=p=>PK[p.k].t(p);
const pv=(c,k)=>c.ps.reduce((a,p)=>a+(p.k===k?p.v:0),0);   // 数値型の合計
const ownerOf=c=>S&&S.p.find(p=>p.chars.includes(c));   // キャラの持ち主（プレイヤー）
const run1=(name,c,x,...a)=>{const h=PK[x.k][name];if(h)h(c,x,...a)};   // パッシブ1つのフックを実行
const hook=(name,c,...a)=>c.ps.forEach(x=>run1(name,c,x,...a));          // キャラの全パッシブのフックを実行
const hookSum=(name,c,...a)=>c.ps.reduce((t,x)=>{const h=PK[x.k][name];return t+(h&&h(c,x,...a)||0)},0);   // 戻り値（数）を合計するフック
const bonusNote=(ch,list)=>{const t=[],d=pv(ch,'debuffup'),m=pv(ch,'ailmentup');   // ログ用：付与量パッシブの注記
 if(d&&list.some(e=>['rolldn','vuln','dmgdn'].includes(e[0])))t.push(`デバフ付与量+${d}`);
 if(m&&list.some(e=>['burn','bleed','rupt','vib'].includes(e[0])))t.push(`状態異常付与量+${m}`);
 return t.length?`（${t.join('、')}）`:''};
Object.keys(PAS).forEach(id=>{const k=PAS[id].k;if(!PK[k])throw new Error(`パッシブ「${id}」の種類 k:'${k}' が PK にありません`);(PK[k].need||[]).forEach(f=>{if(PAS[id][f]==null)throw new Error(`パッシブ「${id}」には ${f} が必要です（種類 ${k}）`)})});   // 書き間違い検出
