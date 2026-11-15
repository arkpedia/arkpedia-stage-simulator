// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {reactiveEnemySpAccount} from '../server/sim/content/arkpedia-enemy-sp-account.js';
function fixture(params={}){
 const record={...enemyRec({key:'reactive',hp:1000,speed:0}),runtimeFeatures:{schemaVersion:1,properties:{},entries:[
  {id:'native:reactiveFixture',ability:{kind:'reactiveEnemySpAccount',params:{cost:7,rate:0,perHit:1,cancelDamage:true,...params}}},
 ]}};
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,defs:{enemies:{reactive:record}},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy('reactive',{pos:[9,6]});e.profile.noAttack=true;
 const hit=(d={})=>h.b.dealDamage(null,e,{amount:100,type:'true',sourceless:true,...d});
 return{...h,e,hit};
}
test('seven accepted hits fill a noncasting account without losing HP or consuming a barrier',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'barrier',shield:500});const casts=[];f.b.on('skillStart',c=>casts.push(c));
 for(let i=1;i<=10;i++){assert.equal(f.hit(),0);assert.equal(f.e.skill.sp,Math.min(7,i));}
 assert.equal(f.e.skill.ready,true);assert.equal(f.e.hp,1000);assert.equal(f.e.findBuff('barrier').shield,500);
 f.run(2);assert.equal(f.e.skill.active,false);assert.deepEqual(casts,[]);assert.deepEqual(f.b.errors,[]);
});
test('time recovery continues while stunned, pauses for noSp, and does not double tick',()=>{
 const f=fixture({cost:40,rate:1});f.b.applyStatus(f.e,'stun',{duration:50});f.run(10);
 assert.ok(Math.abs(f.e.skill.sp-10)<1e-8);
 f.b.addBuff(f.e,{key:'noSp',flags:{noSp:true}});const sp=f.e.skill.sp;f.run(5);f.hit();assert.equal(f.e.skill.sp,sp);
 f.b.removeBuff(f.e,'noSp');f.run(30.1);assert.equal(f.e.skill.sp,40);assert.equal(f.e.skill.ready,true);
 assert.equal(f.e.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
test('misses and protection do not charge, while accepted fixed damage grants explicit SP despite noSp on its packet',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'dodge',mods:{dodgePhys:1,dodgeArts:1}});
 f.hit({type:'phys'});f.hit({type:'arts'});assert.equal(f.e.skill.sp,0);
 f.b.removeBuff(f.e,'dodge');f.b.addBuff(f.e,{key:'protected',flags:{invulnerable:true}});f.hit();assert.equal(f.e.skill.sp,0);
 f.b.removeBuff(f.e,'protected');f.hit({unmodified:true,noSp:true});assert.equal(f.e.skill.sp,1);assert.equal(f.e.hp,1000);
 f.b.loseHp(f.e,5);assert.equal(f.e.skill.sp,1);assert.equal(f.e.hp,995);assert.deepEqual(f.b.errors,[]);
});
test('independent bodies retain their own SP and source-owned hooks are released after removal',()=>{
 const f=fixture(),other=f.b.spawnEnemy('reactive',{pos:[9,7]});other.profile.noAttack=true;
 f.hit();assert.equal(f.e.skill.sp,1);assert.equal(other.skill.sp,0);
 f.b.kill(f.e);const before=f.e.skill.sp;f.run(.1);
 assert.ok(!f.b._hooks.targetDamageModifier.some(h=>h.owner===f.e&&!h.removed));
 f.b.dealDamage(null,other,{amount:100,type:'true',sourceless:true});assert.equal(other.skill.sp,1);assert.equal(f.e.skill.sp,before);
 assert.deepEqual(f.b.errors,[]);
});
test('a noncancelling account can observe accepted damage while ordinary mitigation and shields remain active',()=>{
 const f=fixture({cancelDamage:false,initial:2,perHit:2});f.b.addBuff(f.e,{key:'barrier',shield:150});
 assert.equal(f.hit(),0);assert.equal(f.e.skill.sp,4);assert.equal(f.e.findBuff('barrier').shield,50);
 assert.equal(f.hit(),50);assert.equal(f.e.skill.sp,6);assert.equal(f.e.hp,950);assert.deepEqual(f.b.errors,[]);
});
test('invalid accounts are rejected before they can install a nonterminating clock',()=>{
 for(const p of[{cost:0},{cost:NaN},{cost:7,initial:8},{cost:7,rate:-1},{cost:7,perHit:Infinity},{cost:7,cancelDamage:1}])
  assert.throws(()=>reactiveEnemySpAccount(p),/Invalid reactive enemy SP account/);
});
test('the shared account retains ordinary recovery and cost modifiers without creating a second SP ledger',()=>{
 const f=fixture({cost:40,initial:5,rate:1});assert.equal(f.e.skill.sp,5);
 f.b.addBuff(f.e,{key:'recovery',mods:{spRecoveryFlat:1,spRecoveryMul:1.5}});f.run(2);
 assert.ok(Math.abs(f.e.skill.sp-11)<1e-8);
 f.e.skill.spCostMul=.25;assert.equal(f.e.skill.spCost,10);assert.equal(f.e.skill.sp,10);assert.equal(f.e.skill.ready,true);
 assert.equal(f.e.skill.active,false);assert.deepEqual(f.b.errors,[]);
});
