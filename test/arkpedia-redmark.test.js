// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {redmarkNative} from '../shared/arkpedia/enemy-redmark-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {enemyAttackRadius,enemyStealthed} from '../server/sim/targeting.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1135_redman','enemy_1135_redman_2'],mark='storm_ally_mark';
const trigger=n=>{const root=Object.values(n).flat().find(c=>'_modes'in c);return n.$ref(n.$ref(root._modes[0])._attackTrigger);};
function fixture(id=ids[0],{compiled=true,blocked=false}={}){
 const guard=chessRec({id:'redmark_guard',stats:{maxHp:1e6,atk:0,def:150,blockCnt:blocked?1:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,blocked?6:14]}),g=h.b.allyUnits[0],hits=[],attacks=[];
 h.b.addBuff(e,{key:'hold',flags:{noMove:true}});h.b.on('damaged',c=>{if(c.source===e&&c.target===g)hits.push({time:h.b.time,amount:c.hpLoss});});
 h.b.on('attack',c=>{if(c.attacker===e)attacks.push(h.b.time);});return{...h,e,g,hits,attacks};
}
for(const id of ids){
 test(`${id}: source-gated marker targeting and native casts compile without nonfinite portable stats`,()=>{
  const row=records.enemies[id].levels[0];assert.ok(redmarkNative(row,nativeComponents(evidence,id)));
  const plan=withCompiledEnemyRuntime(row).runtimeFeatures;assert.ok(plan.entries.some(e=>e.ability?.kind==='markedMeleeProjectileAttack'));
  assert.ok(!JSON.stringify(plan).includes('Infinity'));const h=fixture(id);assert.equal(enemyAttackRadius(h.e),Infinity);assert.equal(h.e.base.rangeRadius,0);
 });
 test(`${id}: global selection requires the sandstorm marker and releases at the native C_Attack marker`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,{compiled});h.run(1);assert.equal(h.attacks.length,0);h.b.addBuff(h.g,{key:mark});
   assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.equal(h.e.mem.regularFormVisual.clip,'C_Attack');
   assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,2));const release=h.b.time;assert.equal(h.hits.length,0);
   assert.ok(Math.abs(release-h.attacks[0]-43/30)<h.b.dt*1.2);assert.ok(h.runUntil(()=>h.hits.length===1,1));
   assert.equal(h.hits[0].amount,h.e.base.atk-150);assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: the unmarked blocker receives native 30-percent physical melee at C_Combat's marker`,()=>{
  const h=fixture(id,{blocked:true});assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.equal(h.e.mem.regularFormVisual.clip,'C_Combat');
  assert.ok(h.runUntil(()=>h.hits.length===1,1));assert.equal(h.b.projectiles.list.length,0);
  assert.ok(Math.abs(h.hits[0].time-h.attacks[0]-.8)<h.b.dt*1.2);
  assert.ok(Math.abs(h.hits[0].amount-(h.e.base.atk*Math.fround(.3)-150))<1e-6);assert.deepEqual(h.b.errors,[]);
 });
}
test('native tag exclusions and camouflage suppress new marked ranged casts',()=>{
 const h=fixture();h.b.addBuff(h.g,{key:mark});h.g.tags.add('redman_exclude');h.run(.2);assert.equal(h.attacks.length,0);
 h.g.tags.delete('redman_exclude');h.b.addBuff(h.g,{key:'camou',flags:{camou:true}});h.run(.2);assert.equal(h.attacks.length,0);
 h.b.removeBuff(h.g,'camou');assert.ok(h.runUntil(()=>h.hits.length===1,3));assert.deepEqual(h.b.errors,[]);
});
test('released projectiles survive source death; death or freeze before release cancels them',()=>{
 const released=fixture();released.b.addBuff(released.g,{key:mark});assert.ok(released.runUntil(()=>released.b.projectiles.list.length>0,3));
 released.b.kill(released.e);assert.ok(released.runUntil(()=>released.hits.length===1,1));assert.deepEqual(released.b.errors,[]);
 for(const kind of['death','freeze']){
  const h=fixture();h.b.addBuff(h.g,{key:mark});assert.ok(h.runUntil(()=>h.attacks.length===1,1));
  if(kind==='death')h.b.kill(h.e);else h.b.applyStatus(h.e,'freeze',{duration:2});h.run(1.7);
  assert.equal(h.b.projectiles.list.length,0);assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);
 }
});
test('stealth is lifted by blocking and returns only three seconds after unblock',()=>{
 const h=fixture();assert.equal(enemyStealthed(h.e),true);h.e.x=h.g.x;h.b.addBuff(h.g,{key:'block',mods:{blockCnt:1}});h.run(.1);
 assert.equal(h.e.blockedBy,h.g);assert.equal(enemyStealthed(h.e),false);h.b.removeBuff(h.g,'block');h.run(.1);
 assert.equal(h.e.blockedBy,null);assert.equal(enemyStealthed(h.e),false);h.run(2.8);assert.equal(enemyStealthed(h.e),false);
 h.run(.3);assert.equal(enemyStealthed(h.e),true);assert.deepEqual(h.b.errors,[]);
});
test('admission rejects widened marker filters, melee scaling, stealth restore delay and projectile death policy',()=>{
 for(const id of ids)for(const edit of[
  n=>n.$siblings(trigger(n)).find(c=>'_buffKey'in c)._filterTag='',
  n=>n.$siblings(trigger(n)).find(c=>'_buffKey'in c)._buffKey='unreviewed',
  n=>{const root=n[id].find(c=>'_modes'in c);n.$ref(n.$ref(root._modes[0])._combat)._atkScale=1;},
  n=>n.$ref(n.Invi.find(c=>'_checker'in c)._checker)._restoreDelay=0,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(redmarkNative(records.enemies[id].levels[0],n),false);}
 const changed=structuredClone(evidence),parts=changed.projectiles.projectile_enemy_redman;
 const row=parts.find(c=>JSON.parse(c.originalJson)._stopWhenSourceInvalid===0);const data=JSON.parse(row.originalJson);data._stopWhenSourceInvalid=1;row.originalJson=JSON.stringify(data);
 assert.equal(redmarkNative(records.enemies[ids[0]].levels[0],nativeComponents(changed,ids[0])),false);
});
