// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic source-controller fixture, not a public operator or native replay.
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-lappland-alter-prefabs.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {LAPPLAND_ALTER_ID as ID,LAPPLAND_ATTACK_CONTRACT,selectedLapplandBuild,prepareLapplandAttacks} from '../../server/sim/content/arkpedia-lappland-alter.js';
export function createLapplandMotionFixture({skill=3,potential=1}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
 b.autoFinish=false;b.recordEvents=true;b.rng=()=>.99;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite:2,level:90,potential,trust:0,skillId:`skchr_whitw2_${skill}`,skillRank:10},r=selectedLapplandBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
  stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
  skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir:'RIGHT'}),prepared=prepareLapplandAttacks(b,u,{contract:LAPPLAND_ATTACK_CONTRACT});
 b._setupUnit(u,prepared.kit);prepared.controller.install();
 if(!b._deploy(u,{initial:false}))throw Error('Could not deploy private Lappland fixture');u.player.dp=99;
 return {b,u,...prepared,
  advance(seconds){for(let i=0;i<Math.ceil(seconds/b.dt-1e-9);i++)b.step();if(b.errors.length)throw Error(JSON.stringify(b.errors));},
  activate(){u.skill.addCharge(1);if(!prepared.controller.toggle())throw Error('Could not activate private Lappland fixture');},
  enemy(col=17){const t=b.spawnEnemy('enemy_1007_slime',{pos:[5,col]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=1e7;
   b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return t;}
 };
}
