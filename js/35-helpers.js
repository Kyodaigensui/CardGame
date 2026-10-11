// ===== キャラ・ダイスまわりの道具（通常は触らなくてOK） =====
const isCh=x=>!!x.spd;
const mkC=c=>({...c,at:[...(c.at||[])],ps:c.ps.map(id=>({...PAS[id]}))});
const ttlHTML=c=>c.title?`<span class="ttl">${c.title}</span>`:'';   // 肩書（キャラ定義の title:'…'）
const mkField=c=>{const f={name:c.name,title:c.title||'',size:c.size||1,slot:c.slot,at:[...(c.at||[])],spd:c.spd,ps:c.ps.map(x=>({...x})),alive:true,card:null,tgt:null,used:false,sp:0,hitFired:[],st:{burn:0,bleed:0,rupt:0,vib:0},bf:BF0(),nx:BF0()};f.max=c.hp;f.hp=c.hp;hook('init',f);hook('start',f);return f};   // 最大HPなどは init フック（頑強など）
const KEY={a:'atk',d:'def',e:'eva'};
const roll=(ch,d)=>Math.max(0,R(...d.r)+pv(ch,KEY[d.t])+(ch.kb||0)+hookSum('dice',ch,d)+(d.t==='a'?ch.bf.atk:0)+ch.bf.roll-ch.bf.rolldn);   // ch.kb＝撃破ボーナス（ターンをまたいで永続）

const CHARS=[...POOL1,...POOL2];
CHARS.forEach(c=>(c.ps||[]).forEach(id=>{if(!PAS[id])throw new Error(`キャラ「${c.name}」のパッシブ「${id}」は PAS にありません`)}));
