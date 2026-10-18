// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {RECON_ID as ID,selectedReconBuild} from '../../server/sim/content/arkpedia-recon-source.js';
import {prepareReconLifecycle,PALAMUTE_LIFECYCLE_CONTRACT} from '../../server/sim/content/arkpedia-palamute-lifecycle.js';
export {near,advance,until} from './mon3tr-fixture.js';
export function make({level=30,potential=1,trust=0,dir='RIGHT',defer=false,contract=PALAMUTE_LIFECYCLE_CONTRACT,prepare=prepareReconLifecycle,mutate}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite:0,level,potential,trust,skillId:null,skillRank:null,module:'none'},r=selectedReconBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,arkpedia:build});mutate?.(def);
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir}),prepared=prepare(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,build,deploy,...prepared};
}
export function enemy(f,{x=6,y=5}={}){const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=t.s.maxHp;f.b.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return t;}
