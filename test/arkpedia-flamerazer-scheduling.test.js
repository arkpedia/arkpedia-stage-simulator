// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
function fixture(interval=100){
 const id='flame_timer_fixture',guard=chessRec({id:'flame_timer_guard',stats:{maxHp:1e6,atk:0,def:0},skill:null});
 const raw={...enemyRec({key:id,speed:0,atk:100}),runtimeFeatures:{schemaVersion:1,properties:{},entries:[
  {id:'native:timerFixture',ability:{kind:'flamerazer',params:{duration:2,interval,hitInterval:.5,scale:.1,ep:.05,deathScale:1}}},
 ]}};
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,defs:{enemies:{[id]:raw},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:9,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[9,6]});e.profile.noAttack=true;h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});
 const hits=[];h.b.on('damaged',c=>{if(c.source===e&&c.dmg.type==='arts'&&c.dmg.tags.includes('flame'))hits.push(h.b.time);});
 return{...h,e,hits};
}
test('one Flame window emits each scheduled hit once and leaves no repeating timers after its duration',()=>{
 const f=fixture();f.run(5);assert.equal(f.hits.length,4);assert.ok(f.hits.every(t=>t<=2.1));
 assert.equal(f.b._sched.filter(s=>!s.cancelled).length,0);assert.deepEqual(f.b.errors,[]);
});
test('successive Flame windows keep a bounded timer queue rather than accumulating permanent intervals',()=>{
 const f=fixture(3);let maximum=0;
 for(let i=0;i<1000;i++){f.step();maximum=Math.max(maximum,f.b._sched.filter(s=>!s.cancelled).length);}
 assert.ok(f.hits.length>20);assert.ok(maximum<=4,`maximum queued callbacks: ${maximum}`);assert.deepEqual(f.b.errors,[]);
});
