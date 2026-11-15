// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,enemyRec} from './helpers/battleHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {rechargingBarrierAura} from '../server/sim/content/arkpedia-enemy-barrier-aura.js';
const spec={key:'test:recharge',interval:1,radius:2.5,addRate:.02,maxRate:.5,excludedBuffs:['test:noShield'],ignoreTargetFree:true,ignoreAllyTargetFree:true};
function fixture(){
 const source={...enemyRec({key:'source',hp:1000,speed:0}),runtimeFeatures:{schemaVersion:1,properties:{},entries:[
  {id:'native:barrierFixture',ability:{kind:'rechargingBarrierAura',params:spec}},
 ]}};
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:120,defs:{enemies:{source,target:enemyRec({key:'target',hp:1000,speed:0})}},setup:installEnemyFeatures});
 h.b.start();const spawn=(key,pos)=>{const e=h.b.spawnEnemy(key,{pos});e.profile.noAttack=true;h.b.addBuff(e,{key:'hold',flags:{noMove:true}});return e;};
 const owner=spawn('source',[9,6]);h.b.addBuff(owner,{key:'test:noShield'});const target=spawn('target',[9,8]);
 return{...h,owner,target,spawn,charge:u=>u.findBuff(spec.key)?.shield??0};
}
test('recharge waits for its first period, uses recipient Max HP and reaches one shared cap without timers',()=>{
 const f=fixture();f.run(.8);assert.equal(f.charge(f.target),0);f.run(.3);assert.equal(f.charge(f.target),20);
 f.run(29);assert.equal(f.charge(f.target),500);assert.equal(f.charge(f.owner),0);
 assert.equal(f.target.buffs.filter(b=>b.key===spec.key).length,1);assert.equal(f.b._sched.length,0);assert.deepEqual(f.b.errors,[]);
});
test('Physical/Arts damage consumes charge; True damage bypasses it and later pulses refill the remaining budget',()=>{
 const f=fixture();f.run(10);assert.equal(f.charge(f.target),200);const hp=f.target.hp;
 assert.equal(f.b.dealDamage(null,f.target,{amount:100,type:'phys',sourceless:true}),0);assert.equal(f.charge(f.target),100);
 assert.equal(f.b.dealDamage(null,f.target,{amount:100,type:'true',sourceless:true}),100);assert.equal(f.target.hp,hp-100);assert.equal(f.charge(f.target),100);
 f.run(1);assert.equal(f.charge(f.target),120);assert.deepEqual(f.b.errors,[]);
});
test('independent owners add charge to the same barrier, while source death and range exit retain accumulated charge',()=>{
 const f=fixture(),second=f.spawn('source',[9,7]);f.b.addBuff(second,{key:'test:noShield'});f.run(5);
 assert.equal(f.charge(f.target),200);f.b.kill(f.owner);f.run(1);assert.equal(f.charge(f.target),220);
 f.target.x=9;f.run(2);assert.equal(f.charge(f.target),260);
 f.target.x=11;const before=f.charge(f.target);f.run(2);assert.equal(f.charge(f.target),before);
 f.b.kill(second);f.run(2);assert.equal(f.charge(f.target),before);assert.deepEqual(f.b.errors,[]);
});
test('a lower Max HP cap preserves existing charge and scales subsequent additions from current Max HP',()=>{
 const f=fixture();f.run(26);assert.equal(f.charge(f.target),500);
 f.b.addBuff(f.target,{key:'smaller',mods:{hpPct:-.5}});assert.equal(f.target.s.maxHp,500);f.run(1);assert.equal(f.charge(f.target),500);
 f.b.dealDamage(null,f.target,{amount:300,type:'arts',sourceless:true});assert.equal(f.charge(f.target),200);
 f.run(1);assert.equal(f.charge(f.target),210);assert.deepEqual(f.b.errors,[]);
});
test('source selector options retain same-side hidden/sleep exclusions and explicit marker exclusions',()=>{
 const f=fixture(),sleep=f.spawn('target',[9,7]),hidden=f.spawn('target',[10,7]),marked=f.spawn('target',[10,8]);
 f.b.addBuff(f.target,{key:'isolated',flags:{isolated:true,untargetable:true,stealth:true}});
 f.b.addBuff(sleep,{key:'sleep',flags:{sleep:true}});f.b._setHidden(hidden,true);f.b.addBuff(marked,{key:'test:noShield'});
 f.run(1);assert.equal(f.charge(f.target),20);assert.equal(f.charge(sleep),0);assert.equal(f.charge(hidden),0);assert.equal(f.charge(marked),0);
 assert.deepEqual(f.b.errors,[]);
});
test('invalid periods and nonfinite rates are rejected before a recharge loop can start',()=>{
 for(const change of[{interval:0},{interval:-1},{addRate:Infinity},{maxRate:NaN},{radius:-1},{types:['unknown']}])assert.throws(()=>rechargingBarrierAura({...spec,...change}),/Invalid barrier recharge/);
});
