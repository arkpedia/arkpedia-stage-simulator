// SPDX-License-Identifier: GPL-3.0-or-later
// Passive account is diagnostic only, never a source-skill replacement.
import assert from 'node:assert/strict';import data from '../../data/arkpedia-mvp.json' with{type:'json'};import {StandardBattle} from '../../server/sim/arkpedia.js';import {normalizeChess} from '../../server/sim/simdata.js';import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedYukariBuild,YUKARI_ID as ID} from '../../server/sim/content/arkpedia-yukari-source.js';import e from '../../data/arkpedia-native-operators/char_4219_yukari.json' with{type:'json'};
import {YukariFinishHealing,YUKARI_TALENT_CONTRACT} from '../../server/sim/content/arkpedia-yukari-talent.js';
import {YukariOrdinaryAttacks,YUKARI_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-yukari-ordinary.js';
export{near,advance,until}from'./mon3tr-fixture.js';
export function make({skill=1,elite=2,level=[50,70,80][elite],rank=[4,7,10][elite],potential=1,trust=0,defer=false,contract=YUKARI_TALENT_CONTRACT,beforeInstall,
 dir='RIGHT',ordinary=false,ordinaryContract=YUKARI_ORDINARY_CONTRACT,mayBegin=()=>true}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite,level,potential,trust,skillId:`skchr_yukari_${skill}`,skillRank:rank,module:'none'},record=selectedYukariBuild(build),c=e.tables.character,
 def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,stats:record.stats,rangeGrid:record.rangeGrid,tags:record.tags,talents:record.talents,
 skill:{...record.source,...record.source.spData,skillId:build.skillId,rangeGrid:record.skillRangeGrid},arkpedia:build}),u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir}),talent=new YukariFinishHealing(b,u,{contract}),
 attacks=ordinary?new YukariOrdinaryAttacks(b,u,{contract:ordinaryContract,mayBegin}):null;
 b._setupUnit(u,{trait:attacks?.trait()??{noAttack:true},talents:[],skill:{kind:'instant',attack:{isSkill:true},completeOnAttack:false,trigger:{rule:'NEVER'},holdSpWhileActive:true}});beforeInstall?.(b,u,talent,attacks);talent.install();attacks?.install();
 const heals=[],hits=[],receipts=[];b.on('heal',c=>{if(c.source===u)heals.push({...c});});b.on('damaged',c=>hits.push({...c,time:b.time}));b.on('attack',c=>{if(c.attacker===u)receipts.push({...c,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,talent,attacks,record,build,heals,hits,receipts,deploy};
}
export function ally(f,options={}){
 const i=f.nextAlly??0;f.nextAlly=i+1;const pos=[[5,6],[5,7],[6,6],[4,6],[6,7],[4,7],[3,5],[7,5]][i]??[10,i];
 const{row=pos[0],col=pos[1],hpRatio=.1,kind='op',flags={},id='fixture:'+i}=options;
 const def=normalizeChess({chessId:id,charId:id,name:id,profession:'GUARD',position:'MELEE',stats:{maxHp:10000,atk:100,def:0,cost:0,baseAttackTime:1,blockCnt:1}}),u=f.b._makeAlly(f.u.player,def,kind,row,col,{dir:'RIGHT'});f.b._setupUnit(u,{trait:{noAttack:true},talents:[],skill:{kind:'passive'}});assert.ok(f.b._deploy(u,{initial:false}));u.hp=u.s.maxHp*hpRatio;if(Object.keys(flags).length)f.b.addBuff(u,{key:'fixture:flags',flags});return u;
}
export function finish(f,reason='fixture'){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);f.u.skill.end(reason);assert.deepEqual(f.b.errors,[]);}
export function enemy(f,{row=5,col=7,hp=1e7,flags={},motion='WALK'}={}){
 const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:hp,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=hp;t.motion=motion;
 f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});f.b._buildEnemyIndex();return t;
}
