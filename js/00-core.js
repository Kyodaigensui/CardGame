
// ===== オンライン状態と乱数 =====
// オンライン対戦は「両者が同じ種(seed)から同じ乱数列を作り、同じ操作を同じ順に再生する」方式。
// ゲームの乱数は必ず rnd()/R()/sh() を通すこと（Math.random() を直接使うと両者がずれる）
let REPLAY=false;   // 相手の操作を再現している間 true（描画を止め、操作の許可判定を通す）
const NET={on:false,me:0,seed:0,s:0,slot:0,role:null,conn:null,peer:null,send:null,q:[],picks:[null,null],sums:{},rm:[false,false],decks:null,myDeck:null,lost:false,err:'',status:'',code:''};
const mulberry32=()=>{let t=NET.s=(NET.s+0x6D2B79F5)|0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const rnd=()=>NET.on?mulberry32():Math.random();
const R=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const sh=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=R(0,i);[a[i],a[j]]=[a[j],a[i]]}return a};
const C={FIELD:3,COST:3,COIN:3,DECK:15,MAXC:3,REDIR:2};   // 初期コスト / 感情1レベルのコイン / デッキ枚数 / 技カードの同名上限 / マッチ対象を変更できる速度差            // 初期コスト / 感情レベル1つ分に必要なコイン
const T={a:'攻',d:'防',e:'回'};
const D=(t,a,b,fx)=>({t,r:[a,b],fx});   // fx＝そのダイスが的中したときの効果（省略可）
