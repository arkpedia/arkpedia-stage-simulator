// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedTaraxaBuild, TARAXA_ID as ID} from '../../server/sim/content/arkpedia-taraxa-source.js';
import {TaraxaAura,TARAXA_AURA_CONTRACT} from '../../server/sim/content/arkpedia-taraxa-aura.js';
import {TaraxaOrdinaryHeals,TARAXA_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-taraxa-ordinary.js';
export{near,advance,until}from'./mon3tr-fixture.js';
export function addOwner(b,{skill=1,rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
 row=5,col=5,dir='RIGHT',defer=false,beforeInstall,prepare,ordinary=false,mayBegin=()=>true}={}){
 const build={elite,level,potential,trust,skillId:`skchr_taraxa_${skill}`,skillRank:rank,module:'none'};
 const record=selectedTaraxaBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
  stats:record.stats,rangeGrid:record.rangeGrid,tags:record.tags,talents:record.talents,
  skill:{...record.source,...record.source.spData,skillId:build.skillId,rangeGrid:record.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:build});
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir}),prepared=prepare?.(b,u);
 const aura=prepared?.aura??new TaraxaAura(b,u,{contract:TARAXA_AURA_CONTRACT});
 const attacks=ordinary?new TaraxaOrdinaryHeals(b,u,{contract:TARAXA_ORDINARY_CONTRACT,mayBegin}):null;
 b._setupUnit(u,prepared?.kit??{trait:attacks?.trait()??{noAttack:true},talents:[],skill:{kind:'passive'}});
 beforeInstall?.(b,u,aura);if(prepared)prepared.controller.install();else {aura.install();attacks?.install();}
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();
 return{b,u,aura,build,record,deploy,attacks,...prepared};
}
export function make(opts={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));return addOwner(b,opts);
}
export function ally(f,{row=5,col=6,ratio=.2,flags={},motion='WALK',device=false}={}){
 const t=f.b.spawnToken(f.u,'diagnostic:taraxa-recipient',row,col,{def:{name:'Diagnostic recipient',profession:'TOKEN',position:'MELEE',
  stats:{maxHp:10000,atk:0,def:0,res:0,blockCnt:0,cost:0},skill:null},kit:{trait:{noAttack:true,noBlock:true},talents:[],skill:{kind:'passive'}}});
 assert.ok(t);t.motion=motion;t.hp=t.s.maxHp*ratio;if(device)t.kind='device';
 if(Object.keys(flags).length)f.b.addBuff(t,{key:'fixture:flags',flags});return t;
}
