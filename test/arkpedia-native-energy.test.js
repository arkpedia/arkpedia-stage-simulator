// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import{nativeEnergyMeter,enemyEnergy,changeEnemyEnergy}from'../server/sim/content/arkpedia-enemy-energy.js';
import{installFeatureDispatch,attach}from'../server/sim/content/arkpedia-enemy-ability-runtime.js';
import{makeBattle}from'./helpers/battleHarness.js';
const spec={capacity:10,initial:0,perStack:{atkPct:.1,defPct:.2},overload:{duration:10,mods:{aspd:120,defMul:2,resFlat:30}}};
function fixture(params=spec){const h=makeBattle({content:'none',autoFinish:false,setup:installFeatureDispatch});h.b.start();const e=h.b.spawnEnemy('slug',{pos:[10,6]});attach(h.b,e,[nativeEnergyMeter(params)]);h.b.addBuff(e,{key:'hold',flags:{noMove:true}});return{...h,e};}
test('native energy is one owned stacked stat modifier, bounded by the actor capacity',()=>{
 const h=fixture(),atk=h.e.s.atk,def=h.e.s.def;assert.deepEqual(enemyEnergy(h.b,h.e),{count:0,capacity:10,overloaded:false});
 assert.equal(changeEnemyEnergy(h.b,h.e,4),4);assert.equal(h.e.s.atk,atk*1.4);assert.equal(h.e.s.def,def*1.8);assert.equal(h.e.findBuff('act28side_energy_buff').stacks,4);
 assert.equal(changeEnemyEnergy(h.b,h.e,-2),-2);assert.equal(h.e.s.atk,atk*1.2);assert.equal(changeEnemyEnergy(h.b,h.e,-100),-2);assert.equal(h.e.s.atk,atk);assert.equal(h.e.findBuff('act28side_energy_buff'),null);assert.deepEqual(h.b.errors,[]);
});
test('full energy starts the source overload and clears energy when the timed attachment finishes',()=>{
 const h=fixture(),atk=h.e.s.atk,def=h.e.s.def,aspd=h.e.s.aspd,res=h.e.s.res;
 assert.equal(changeEnemyEnergy(h.b,h.e,100),10);assert.deepEqual(enemyEnergy(h.b,h.e),{count:10,capacity:10,overloaded:true});
 assert.equal(h.e.s.atk,atk*2);assert.equal(h.e.s.def,def*3*2);assert.equal(h.e.s.aspd,aspd+120);assert.equal(h.e.s.res,res+30);
 assert.equal(changeEnemyEnergy(h.b,h.e,1),0);assert.equal(changeEnemyEnergy(h.b,h.e,-1),0);h.run(9.9);assert.equal(enemyEnergy(h.b,h.e).overloaded,true);h.run(.2);
 assert.deepEqual(enemyEnergy(h.b,h.e),{count:0,capacity:10,overloaded:false});assert.equal(h.e.s.atk,atk);assert.equal(h.e.s.def,def);assert.equal(h.e.s.aspd,aspd);assert.equal(h.e.s.res,res);assert.deepEqual(h.b.errors,[]);
});
test('native decay polls independently of ordinary control and silence, but does not spend overload energy',()=>{
 const h=fixture({...spec,capacity:20,initial:15,overload:{...spec.overload,duration:20},decay:{interval:10,amount:1}});h.b.applyStatus(h.e,'silence',{duration:40});h.b.applyStatus(h.e,'stun',{duration:40});
 h.run(9.9);assert.equal(enemyEnergy(h.b,h.e).count,15);h.run(.2);assert.equal(enemyEnergy(h.b,h.e).count,14);
 changeEnemyEnergy(h.b,h.e,6);h.run(10);assert.equal(enemyEnergy(h.b,h.e).count,20);h.run(10.2);assert.equal(enemyEnergy(h.b,h.e).count,0);assert.deepEqual(h.b.errors,[]);
});
test('source removal/death/leakage clear only this meter and later changes cannot revive it',()=>{
 for(const reason of['kill','leak']){const h=fixture({...spec,initial:4}),foreign=h.b.addBuff(h.e,{key:'foreign'});h.b[reason](h.e);assert.equal(enemyEnergy(h.b,h.e),null);assert.equal(changeEnemyEnergy(h.b,h.e,5),0);assert.equal(h.e.findBuff('act28side_energy_buff'),null);assert.equal(h.e.findBuff('blacksteel_energy[mark]'),null);assert.ok(h.e.buffs.includes(foreign));assert.deepEqual(h.b.errors,[]);}
});
test('different owners and battles never share meter state',()=>{
 const h=fixture(),other=h.b.spawnEnemy('slug',{pos:[11,6]});attach(h.b,other,[nativeEnergyMeter(spec)]);const separate=fixture();changeEnemyEnergy(h.b,h.e,3);
 assert.equal(enemyEnergy(h.b,h.e).count,3);assert.equal(enemyEnergy(h.b,other).count,0);assert.equal(enemyEnergy(separate.b,separate.e).count,0);assert.equal(enemyEnergy(separate.b,h.e),null);assert.deepEqual(h.b.errors,[]);
});
test('invalid values refuse before mutation; removing an overload clears its owned energy once',()=>{
 const h=fixture();for(const delta of[NaN,Infinity,.5,'1'])assert.throws(()=>changeEnemyEnergy(h.b,h.e,delta));assert.equal(enemyEnergy(h.b,h.e).count,0);
 for(const edit of[p=>p.capacity=Infinity,p=>p.initial=11,p=>p.perStack.atkPct=NaN,p=>p.overload.mods.unknown=1,p=>p.decay={interval:0,amount:1}]){const p=structuredClone(spec);edit(p);assert.throws(()=>nativeEnergyMeter.validate(p));}
 changeEnemyEnergy(h.b,h.e,10);const foreign=h.b.addBuff(h.e,{key:'foreign',mods:{defFlat:77}});h.b.removeBuff(h.e,'act28side_over_energy_buff');assert.equal(enemyEnergy(h.b,h.e).count,0);assert.ok(h.e.buffs.includes(foreign));h.run(.1);assert.equal(enemyEnergy(h.b,h.e).overloaded,false);assert.deepEqual(h.b.errors,[]);
});
test('rejected energy attachment rolls back; rejected overload retries without discarding full energy',()=>{
 const h=fixture();const off=h.b.on('beforeBuff',c=>{if(c.buff.key==='act28side_energy_buff')c.cancel=true;});assert.equal(changeEnemyEnergy(h.b,h.e,3),0);assert.equal(enemyEnergy(h.b,h.e).count,0);h.b.off(off);
 const reject=h.b.on('beforeBuff',c=>{if(c.buff.key==='act28side_over_energy_buff')c.cancel=true;});assert.equal(changeEnemyEnergy(h.b,h.e,10),10);h.run(.1);assert.deepEqual(enemyEnergy(h.b,h.e),{count:10,capacity:10,overloaded:false});h.b.off(reject);h.run(.1);assert.equal(enemyEnergy(h.b,h.e).overloaded,true);assert.deepEqual(h.b.errors,[]);
});
