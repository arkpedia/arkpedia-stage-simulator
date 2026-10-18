// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4224_turdus.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {TURDUS_ID as ID,selectedTurdusBuild} from '../../server/sim/content/arkpedia-turdus-source.js';
import {TurdusChains,TURDUS_CHAIN_CONTRACT} from '../../server/sim/content/arkpedia-turdus-chain.js';
export {near,advance,until} from './mon3tr-fixture.js';
export function make({elite=2,level=e.tables.character.phases[elite].maxLevel,skill=1,rank=[4,7,10][elite],potential=1,trust=0,dir='RIGHT',defer=false,onRecipient,mutate,prepare}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite,level,potential,trust,skillId:`skchr_turdus_${skill}`,skillRank:rank,module:'none'},r=selectedTurdusBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
  skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:build});mutate?.(def);
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir}),selected=prepare?.(b,u),chain=selected?.chain??new TurdusChains(b,u,r,{contract:TURDUS_CHAIN_CONTRACT,onRecipient});
 b._setupUnit(u,selected?.kit??{trait:{noAttack:true},talents:[],skill:null});if(selected)selected.controller.install();else{b.on('deploy',({unit})=>{if(unit===u)chain.installMarkers();},{owner:u});b.on('removed',({unit})=>{if(unit===u)chain.removeMarkers();},{owner:u});b.on('death',({unit})=>{if(unit===u)chain.removeMarkers();},{owner:u});b.on('battleEnd',()=>chain.drain(),{owner:u});}
 const heals=[],attacks=[];b.on('heal',h=>{if(h.source===u)heals.push({...h,time:b.time});});b.on('attack',h=>{if(h.attacker===u)attacks.push({...h,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,record:r,chain,build,heals,attacks,deploy,...selected};
}
let allyId=0;
export function ally(f,{row=5,col=6,hpRatio=.1,maxHp=10000}={}){const id=`qa:ally:${++allyId}`,def=normalizeChess({chessId:id,charId:id,stats:{maxHp,atk:1,def:0,blockCnt:1,baseAttackTime:1,cost:0},rangeGrid:[[0,0]],profession:'WARRIOR',position:'MELEE'}),u=f.b._makeAlly(f.u.player,def,'op',row,col,{dir:'RIGHT'});f.b._setupUnit(u,{trait:{noAttack:true},talents:[],skill:null});assert.ok(f.b._deploy(u,{initial:false}));u.hp=u.s.maxHp*hpRatio;return u;}
export function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);}
