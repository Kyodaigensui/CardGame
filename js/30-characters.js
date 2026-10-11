// ===== キャラカード（ps＝パッシブ、先頭が「一番上」 / slot＝帰属枠：元のパッシブが少ないほど大きく） =====
const POOL1=[
 {name:"イサドラ",title:"南部ツヴァイ協会6課",slot:1,hp:37,spd:[2,5],ps:['yourshield','armor']},
 {name:"ジュリア",title:"南部ツヴァイ協会6課",slot:1,hp:35,spd:[1,4],ps:['yourshield','tough']},
 {name:"リーウェイ",title:"終止符事務所:所長",slot:1,at:['ranged'],hp:30,spd:[3,6],ps:['aim','ailmentup']},
 {name:"タマキ",title:"終止符事務所",slot:1,at:['ranged'],hp:28,spd:[3,6],ps:['aim','debuffup']},
 {name:"サルヴァドール",title:"夜明け事務所:所長",slot:1,hp:39,spd:[2,5],ps:['ailmentup1','armor','tough']},
 {name:"ユジン",title:"シ協会南部支部:部長",slot:1,at:['Shi'],hp:256,spd:[2,6],ps:['lowhp','startdmg','armor']},
 {name:"ヴァレンティン",title:"シ協会南部支部",slot:1,at:['Shi'],hp:40,spd:[2,6],ps:['lowhp1','startdmg1','armor']},
 {name:"カーリー",title:"赤い霧",size:2,at:['RedMist'],slot:1,hp:47,spd:[1,5],ps:['strongest','bloodlust','mistedge']}, // size:2＝場の枠を2つ使う大型キャラ
 {name:"キムサッガッ",title:"剣契:頭目",size:1,slot:1,hp:32,spd:[2,8],ps:['hongoku','armor']}
];
const POOL2=[
 {name:"ロウェル",title:"南部リウ協会2課:課長",slot:1,hp:36,spd:[2,7],ps:['emolv','lvbuff', 'ailmentup2']},
 {name:"メイ",title:"南部リウ協会2課",slot:1,hp:34,spd:[2,6],ps:['emolv','ailmentup2']},
 {name:"シャオ",title:"南部リウ協会1課:課長",slot:1,hp:38,spd:[2,7],ps:['emolv','ailmentup2']},
 {name:"双剣の客人",slot:2,hp:24,spd:[3,7],ps:['swift','sharp']},
 {name:"鐘楼の守護巨人",size:2,slot:1,hp:44,spd:[2,6],ps:['armor','wall','tough','sharp']}
];
