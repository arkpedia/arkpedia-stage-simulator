// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4236_tmslot.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {TMSLOT_ID as ID,TMSLOT_SKILLS,selectedTimeslotBuild} from '../../server/sim/content/arkpedia-tmslot-source.js';
import {prepareTimeslot,TMSLOT_CONTRACT} from '../../server/sim/content/arkpedia-tmslot.js';
export {near,advance,until} from './mon3tr-fixture.js';
export function make({skill=1,elite=2,rank=[4,7,10][elite],potential=1,trust=0,dir='RIGHT',defer=false,contract=TMSLOT_CONTRACT,mutate}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite,level:e.tables.character.phases[elite].maxLevel,skillId:TMSLOT_SKILLS[skill-1],skillRank:rank,potential,trust,module:'none'};
 const r=selectedTimeslotBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
  stats:r.stats,traitBb:r.traitBb,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
  skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:build});
 mutate?.(def);const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir});
 const prepared=prepareTimeslot(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
 const hits=[],attacks=[],calculated=[];b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});
 b.on('calculatedDamage',c=>{if(c.source===u)calculated.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();
 return {b,u,build,...prepared,hits,attacks,calculated,deploy};
}
export function enemy(f,{x=f.u.x,y=f.u.y,hp=100000,fly=false,id='enemy_1007_slime',pin=true}={}){
 const e=f.b.spawnEnemy(id,{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 if(pin)f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
export function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);}
