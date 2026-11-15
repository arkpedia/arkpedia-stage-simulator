// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
import {makeDamageInfo} from '../server/sim/damage.js';
function fixture(){
 const op=chessRec({id:'modifier_target',stats:{atk:0,maxHp:10000,def:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{source:enemyRec({key:'source',atk:100,speed:0})}},
  units:[{chessId:op.chessId,row:9,col:6},{chessId:op.chessId,row:10,col:6}]});
 h.b.start();const source=h.b.spawnEnemy('source',{pos:[9,8]});source.profile.noAttack=true;
 return{...h,source,first:h.b.allyUnits[0],second:h.b.allyUnits[1]};
}
test('accepted recipient cancellation does not poison normalized damage shared by an area attack',()=>{
 const f=fixture(),attempts=[],settled=[];
 f.b.on('targetDamageModifier',c=>{attempts.push(c.target);if(c.target===f.first)c.cancel=true;});
 f.b.on('damaged',c=>settled.push(c.target));
 const damage=makeDamageInfo({amount:100,type:'phys',isAttack:true});
 assert.equal(f.b.dealDamage(f.source,f.first,damage),0);assert.equal(f.first.hp,10000);
 assert.equal(damage.cancel,false);assert.equal(f.b.dealDamage(f.source,f.second,damage),100);
 assert.deepEqual(attempts,[f.first,f.second]);assert.deepEqual(settled,[f.second]);assert.deepEqual(f.b.errors,[]);
});
test('misses, invulnerability and earlier hit cancellation never reach the accepted modifier phase',()=>{
 const f=fixture(),attempts=[];f.b.on('targetDamageModifier',c=>attempts.push(c));
 f.b.addBuff(f.first,{key:'dodge',mods:{dodgePhys:1,dodgeArts:1}});
 for(const type of['phys','arts'])assert.equal(f.b.dealDamage(f.source,f.first,{amount:100,type}),0);
 f.b.removeBuff(f.first,'dodge');f.b.addBuff(f.first,{key:'protected',flags:{invulnerable:true}});
 assert.equal(f.b.dealDamage(null,f.first,{amount:100,type:'true',sourceless:true}),0);
 f.b.removeBuff(f.first,'protected');f.b.on('hit',c=>{if(c.target===f.first)c.cancel=true;});
 assert.equal(f.b.dealDamage(f.source,f.first,{amount:100,type:'arts'}),0);assert.deepEqual(attempts,[]);
});
test('the phase precedes mitigation and shields, including fixed unmodified True damage and hit-count bodies',()=>{
 const f=fixture(),attempts=[];f.b.addBuff(f.first,{key:'barrier',shield:1000});
 f.b.on('targetDamageModifier',c=>{attempts.push(c);c.cancel=true;});
 for(const dmg of[{type:'phys'},{type:'arts'},{type:'true'},{type:'true',sourceless:true,unmodified:true}]){
  assert.equal(f.b.dealDamage(f.source,f.first,{amount:100,...dmg}),0);assert.equal(f.first.findBuff('barrier').shield,1000);
 }
 f.b.addBuff(f.first,{key:'frequency',flags:{hitCount:true}});
 assert.equal(f.b.dealDamage(f.source,f.first,{amount:100,type:'phys'}),0);
 assert.equal(attempts.length,5);assert.ok(attempts.every(c=>c.targetLife===f.first.deploySeq));assert.equal(f.first.hp,10000);
 // HP loss and elemental accumulation are distinct pipelines, not HP modifiers.
 const count=attempts.length;f.b.loseHp(f.first,5);assert.equal(attempts.length,count);assert.equal(f.first.hp,9995);
 f.b.dealDamage(f.source,f.first,{amount:10,type:'element',element:'neural'});assert.equal(attempts.length,count);
 assert.deepEqual(f.b.errors,[]);
});
test('a listener cannot apply an old receipt to a replacement life or override newly applied protection',()=>{
 for(const replace of[false,true]){
  const f=fixture();f.b.on('targetDamageModifier',c=>{
   if(c.target!==f.first)return;
   if(replace){f.b._remove(f.first,'retreat');f.b._deploy(f.first,{tile:[9,6]});}
   else f.b.addBuff(f.first,{key:'newProtection',flags:{invulnerable:true}});
  });
  const life=f.first.deploySeq;assert.equal(f.b.dealDamage(f.source,f.first,{amount:100,type:'true'}),0);
  assert.equal(f.first.hp,10000);if(replace)assert.notEqual(f.first.deploySeq,life);assert.deepEqual(f.b.errors,[]);
 }
});
test('an observational consumer leaves ordinary damage, shield accounting and existing hook order intact',()=>{
 const f=fixture(),order=[];f.b.addBuff(f.first,{key:'barrier',shield:40});
 for(const name of['hit','beforeTargetModifier','targetDamageModifier','damageFinal','calculatedDamage','damaged'])
  f.b.on(name,()=>order.push(name));
 assert.equal(f.b.dealDamage(f.source,f.first,{amount:100,type:'phys'}),60);assert.equal(f.first.hp,9940);
 assert.deepEqual(order,['hit','beforeTargetModifier','targetDamageModifier','damageFinal','calculatedDamage','damaged']);
 assert.deepEqual(f.b.errors,[]);
});
