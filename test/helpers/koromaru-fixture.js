// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4220_kormr.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedKoromaruBuild,KOROMARU_ID as ID} from '../../server/sim/content/arkpedia-koromaru-source.js';
import {prepareKoromaru,KOROMARU_CONTRACT} from '../../server/sim/content/arkpedia-koromaru.js';
export {advance,near,until} from './mon3tr-fixture.js';
export function make({potential=1,trust=0,level=30,dir='RIGHT',defer=false,contract=KOROMARU_CONTRACT,mutate}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 const build={elite:0,level,potential,trust,skillRank:null,skillId:null,module:'none'},r=selectedKoromaruBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,arkpedia:build});mutate?.(def);
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',2,5,{dir}),prepared=prepareKoromaru(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();const hits=[],attacks=[],statuses=[];
 b.on('damaged',c=>{if(c.source===u)hits.push({...c,time:b.time});});b.on('attack',c=>{if(c.attacker===u)attacks.push({...c,time:b.time});});b.on('statusApplied',c=>{if(c.source===u)statuses.push({...c,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,build,...prepared,hits,attacks,statuses,deploy};
}
export function target(f,{x=6,y=2,res=0,def=0,fly=false,hp=100000,flags={}}={}){const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(t.base,{maxHp:hp,atk:0,def,res,moveSpeed:0});t.markDirty();void t.s;t.hp=t.s.maxHp;if(fly)t.motion='FLY';f.b.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,...flags}});f.b._buildEnemyIndex();return t;}
