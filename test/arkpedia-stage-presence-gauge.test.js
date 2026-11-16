// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {recordStageOutcome,recordStageDelta,readStageOutcomes,stagePresenceGauge} from '../server/sim/content/arkpedia-stage-outcomes.js';

function fixture(){
 const record={...enemyRec({key:'presence',hp:1000,speed:0}),runtimeFeatures:{schemaVersion:1,properties:{},entries:[
  {id:'native:presenceFixture',ability:{kind:'stagePresenceGauge',params:{key:'alive_cnt',buffKey:'test:presence'}}},
 ]}};
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,defs:{enemies:{presence:record}},setup:installEnemyFeatures});
 h.b.start();return{...h,spawn:()=>h.b.spawnEnemy('presence',{pos:[9,6]}),count:()=>readStageOutcomes(h.b).counters.alive_cnt};
}
test('independent passive owners contribute once and all removal reasons release their contribution',()=>{
 const f=fixture(),first=f.spawn(),second=f.spawn(),third=f.spawn();assert.equal(f.count(),3);
 f.b.kill(first);f.b.kill(first);assert.equal(f.count(),2);
 f.b.leak(second);assert.equal(f.count(),1);
 f.b._remove(third,'expire');assert.equal(f.count(),0);
 assert.deepEqual(readStageOutcomes(f.b).events.map(e=>e.value),[1,1,1,-1,-1,-1]);
 assert.deepEqual(f.b.errors,[]);
});
test('explicit passive removal and subsequent death cannot decrement twice or remove another owner',()=>{
 const f=fixture(),first=f.spawn(),second=f.spawn();
 f.b.removeBuff(first,'test:presence');assert.equal(f.count(),1);
 f.b.removeBuff(first,'test:presence');f.b.kill(first);assert.equal(f.count(),1);
 assert.ok(second.findBuff('test:presence'));f.b.kill(second);assert.equal(f.count(),0);
 // An old callback after owner death is harmless as well.
 f.b.removeBuff(second,'test:presence');assert.equal(f.count(),0);
 assert.deepEqual(f.b.errors,[]);
});
test('silence, hidden state, status changes and battle completion preserve a live contribution',()=>{
 const f=fixture(),owner=f.spawn();f.b.applyStatus(owner,'silence',{duration:20});
 f.b.applyStatus(owner,'stun',{duration:20});f.b._setHidden(owner,true);f.run(2);assert.equal(f.count(),1);
 f.b._finish('cleared');assert.equal(f.count(),1);
 const result=readStageOutcomes(f.b);result.counters.alive_cnt=99;result.events[0].value=99;
 assert.equal(f.count(),1);assert.equal(readStageOutcomes(f.b).events[0].value,1);
 assert.deepEqual(f.b.errors,[]);
});
test('signed deltas retain strict positive-event validation and reject overflow without partial mutation',()=>{
 const f=fixture(),owner=f.spawn();
 for(const value of[0,-1,NaN,1.5])assert.throws(()=>recordStageOutcome(f.b,owner,'positive',value),/Invalid stage outcome/);
 for(const value of[0,NaN,1.5,Infinity])assert.throws(()=>recordStageDelta(f.b,owner,'signed',value),/Invalid stage result delta/);
 recordStageDelta(f.b,owner,'signed',-1);assert.equal(readStageOutcomes(f.b).counters.signed,-1);
 recordStageDelta(f.b,owner,'large',Number.MAX_SAFE_INTEGER);const before=readStageOutcomes(f.b);
 assert.throws(()=>recordStageDelta(f.b,owner,'large',1),/overflow/);assert.deepEqual(readStageOutcomes(f.b),before);
 for(const params of[{key:'',buffKey:'x'},{key:'x',buffKey:''},{key:'x',buffKey:'x',value:-1}])
  assert.throws(()=>stagePresenceGauge(params),/Invalid stage presence gauge/);
});
test('owned presence effects roll back when recording would overflow, and invalid modifiers fail before attachment',()=>{
 const f=fixture(),owner=f.spawn();recordStageDelta(f.b,owner,'alive_cnt',Number.MAX_SAFE_INTEGER-1);
 const before=readStageOutcomes(f.b),params={key:'alive_cnt',buffKey:'overflow:presence',flags:{noDisplace:true},mods:{taunt:5}};
 assert.throws(()=>stagePresenceGauge(params).spawn(f.b,owner,{}),/overflow/);
 assert.equal(owner.findBuff(params.buffKey),null);assert.ok(!owner.s.flags.noDisplace);assert.equal(owner.s.taunt,0);
 assert.deepEqual(readStageOutcomes(f.b),before);
 for(const invalid of[{...params,flags:{typo:true}},{...params,mods:{typo:1}},{...params,mods:{taunt:NaN}}])
  assert.throws(()=>stagePresenceGauge(invalid),/Invalid stage presence gauge/);
});
