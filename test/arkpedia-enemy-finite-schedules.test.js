// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import {featureAbilities} from '../server/sim/content/enemies.js';
function fixture(){
 const id='finite_schedule_fixture',guard=chessRec({id:'finite_guard',stats:{maxHp:1e6,atk:0,def:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:enemyRec({key:id,speed:0,atk:100})},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:9,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})}});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,5]});e.profile.noAttack=true;h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});
 const g=h.b.allyUnits[0],hits=[];e.target=g;
 h.b.on('damaged',c=>{if(c.source===e)hits.push({time:h.b.time,type:c.dmg.type,tags:c.dmg.tags});});
 return{...h,e,g,hits};
}
const cases=[
 ['bombard',1,f=>featureAbilities.bombard({delay:1,radius:1.1}).attack({target:f.g},f.b,f.e)],
 ['deathEye',4,f=>{const ability=featureAbilities.deathEye({cooldown:100,init:0,duration:3,scale:1,ep:.1}),state={};ability.spawn(f.b,f.e,state);ability.tick(f.b,f.e,state);}],
 ['soulHusk',5,f=>featureAbilities.soulHusk({cooldown:100,scale:1}).cast(f.b,f.e,{souls:1})],
 ['soulRemnant',3,f=>featureAbilities.soulRemnant({cooldown:100,scale:1,ladder:.5}).cast(f.b,f.e,{souls:2})],
];
for(const[name,count,activate]of cases)test(`${name}: one activation has finite hits and releases all its timers`,()=>{
 const f=fixture();activate(f);f.run(8);
 assert.equal(f.hits.length,count);assert.ok(f.hits.every(hit=>hit.time<=3.1));
 assert.equal(f.b._sched.filter(s=>!s.cancelled).length,0);assert.deepEqual(f.b.errors,[]);
});
