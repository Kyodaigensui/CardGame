// ===== キャラカード（ps＝パッシブ、先頭が「一番上」 / slot＝帰属枠：元のパッシブが少ないほど大きく） =====
const POOL1=[
 {name:"イサドラ",title:"南部ツヴァイ協会6課",slot:1,hp:60,spd:[2,5],ps:['ailres','yourshield','armor']},
 {name:"ジュリア",title:"南部ツヴァイ協会6課",slot:1,hp:62,spd:[1,4],ps:['ailres','yourshield','tough']},
 {name:"リーウェイ",title:"終止符事務所:所長",slot:1,at:['ranged'],hp:50,spd:[3,6],ps:['aim','ailmentup']},
 {name:"タマキ",title:"終止符事務所",slot:1,at:['ranged'],hp:45,spd:[3,6],ps:['aim','debuffup']},
 {name:"サルヴァドール",title:"夜明け事務所:所長",slot:1,hp:65,spd:[2,5],ps:['ailmentup1','armor','tough','burncheck']},
 {name:"ユジン",title:"シ協会南部支部:部長",slot:1,at:['Shi'],hp:384,spd:[2,6],ps:['lowhp','startdmg','armor']},
 {name:"ヴァレンティン",title:"シ協会南部支部",slot:1,hp:53,spd:[2,6],ps:['lowhp1','startdmg1','armor']},
 {name:"カーリー",title:"赤い霧",size:1,at:['RedMist'],slot:1,hp:60,spd:[1,5],ps:['strongest','bloodlust','mistedge']}, // size:2＝場の枠を2つ使う大型キャラ
 {name:"キムサッガッ",title:"剣契:頭目",size:1,slot:1,hp:55,spd:[3,8],ps:['hongoku','armor']}
];
const POOL2=[
 {name:"ロウェル",title:"南部リウ協会2課:課長",slot:1,hp:60,spd:[2,7],ps:['emolv','lvbuff', 'ailmentup2']},
 {name:"メイ",title:"南部リウ協会2課",slot:1,hp:65,spd:[2,6],ps:['emolv','ailmentup2']},
 {name:"シャオ",title:"南部リウ協会1課:課長",size:2,slot:1,at:['Xiao'],hp:80,spd:[2,7],ps:['emolv','emostack','ailmentup2']},
 {name:"デモ機",slot:2,hp:24,spd:[3,7],ps:['swift','sharp']},
 {name:"デモ機(大)",size:2,slot:1,hp:44,spd:[2,6],ps:['armor','wall','tough','sharp']},
 {name:"アルガリア",title:"青い残響",size:2,at:['blue'],slot:2,hp:78,spd:[2,8],ps:['rangedres','vibcheck','ailmentup']},
 {name:"フィリップ",title:"夜明け事務所",size:1,slot:0,hp:60,spd:[2,6],ps:['ailmentup1','unstableego']},
 {name:"レイホン",title:"挿翅虎",size:1,slot:1,hp:80,spd:[2,5],ps:['tianTui','tigerBullet']},
];
