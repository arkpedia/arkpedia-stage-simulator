// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
function make() {
 const h=makeBattle({content:'none',autoFinish:false,
  defs:{chess:{guard:chessRec({id:'guard',skill:null,stats:{maxHp:100000,atk:100}})},
   enemies:{enemy:enemyRec({key:'enemy',hp:100000,atk:100,speed:0})}},
  units:[{chessId:'guard',row:10,col:5}],enemies:[{key:'enemy',pos:[10,5.3]}]});
 h.step();const u=h.unit('guard'),e=h.enemies()[0];u.atkCd=e.atkCd=1000;
 const events=[];for(const name of ['hitFailed','dodge','damaged'])h.b.on(name,c=>events.push({name,...c}));
 return {b:h.b,u,e,events};
}
test('ordinary Physical/Arts hits preserve their damage and do not add an RNG draw',()=>{
 const{b,u,e,events}=make();let draws=0;b.rng=()=>{draws++;return .9;};
 assert.equal(u.s.hitRatePhys,1);assert.equal(u.s.hitRateArts,1);
 for(const type of ['phys','arts'])assert.ok(b.dealDamage(u,e,{amount:100,type})>0);
 assert.equal(draws,0);assert.deepEqual(events.map(e=>e.name),['damaged','damaged']);
});
test('Physical and Arts hit-rate attributes are independent, additive and reversible',()=>{
 const{b,u,e,events}=make();b.rng=()=>.6;b.addBuff(u,{key:'test:phys',mods:{hitRatePhys:-.5}});
 assert.equal(b.dealDamage(u,e,{amount:100,type:'phys'}),0);assert.ok(b.dealDamage(u,e,{amount:100,type:'arts'})>0);
 b.addBuff(u,{key:'test:arts',mods:{hitRateArts:-1}});assert.equal(u.s.hitRateArts,0);assert.equal(b.dealDamage(u,e,{amount:100,type:'arts'}),0);
 b.removeBuff(u,'test:phys');assert.equal(u.s.hitRatePhys,1);assert.ok(b.dealDamage(u,e,{amount:100,type:'phys'})>0);
 b.addBuff(u,{key:'test:phys-a',mods:{hitRatePhys:-.2}});b.addBuff(u,{key:'test:phys-b',mods:{hitRatePhys:-.3}});assert.equal(u.s.hitRatePhys,.5);
 assert.equal(events.filter(e=>e.name==='hitFailed').length,2);
});
test('miss precedes evasion: one failure event and no second roll; successful hits can still dodge',()=>{
 const{b,u,e,events}=make();b.addBuff(u,{key:'test:miss',mods:{hitRatePhys:-.5}});b.addBuff(e,{key:'test:evade',mods:{dodgePhys:.5}});
 const rolls=[.7,.2,.2];let draws=0;b.rng=()=>rolls[draws++];
 assert.equal(b.dealDamage(u,e,{amount:100,type:'phys'}),0);assert.equal(draws,1);assert.deepEqual(events.map(e=>e.name),['hitFailed']);
 assert.equal(b.dealDamage(u,e,{amount:100,type:'phys'}),0);assert.equal(draws,3);assert.deepEqual(events.map(e=>e.name),['hitFailed','dodge']);
});
test('non-missable, true, elemental and sourceless damage bypass attacker hit rate',()=>{
 const{b,u,e,events}=make();b.addBuff(u,{key:'test:miss',mods:{hitRatePhys:-1,hitRateArts:-1}});b.addBuff(e,{key:'test:evade',mods:{dodgePhys:1,dodgeArts:1}});
 let draws=0;b.rng=()=>{draws++;return .99;};
 for(const dmg of [{type:'phys',canDodge:false},{type:'arts',canDodge:false},{type:'true'},{type:'elemental'}])assert.ok(b.dealDamage(u,e,{amount:100,...dmg})>0);
 b.removeBuff(e,'test:evade');assert.ok(b.dealDamage(u,e,{amount:100,type:'phys',sourceless:true})>0);
 assert.equal(draws,0);assert.equal(events.filter(e=>e.name==='hitFailed').length,0);
});
test('hit-rate zero is deterministic; cancellation, invulnerability and HP loss do not report misses',()=>{
 const{b,u,e,events}=make();b.addBuff(u,{key:'test:miss',mods:{hitRatePhys:-1}});let draws=0;b.rng=()=>{draws++;return .5;};
 assert.equal(b.dealDamage(u,e,{amount:100,type:'phys'}),0);assert.equal(draws,0);
 b.addBuff(e,{key:'test:invulnerable',flags:{invulnerable:true}});b.dealDamage(u,e,{amount:100,type:'phys'});b.removeBuff(e,'test:invulnerable');
 b.on('hit',({dmg})=>{dmg.cancel=true;});b.dealDamage(u,e,{amount:100,type:'phys'});b.loseHp(e,10,u);
 assert.equal(events.filter(e=>e.name==='hitFailed').length,1);assert.equal(draws,0);
});
