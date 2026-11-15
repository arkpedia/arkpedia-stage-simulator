// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {expletiveNative} from '../shared/arkpedia/enemy-expletive-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_10053_cjman','enemy_10053_cjman_2'],mark='enemy_cjgfod[mark]';
const trigger=n=>{const root=Object.values(n).flat().find(c=>'_modes'in c);return n.$ref(n.$ref(root._modes[0])._attackTrigger);};
function fixture(id=ids[0],{compiled=true,blocked=false}={}){
 const guard=chessRec({id:'sapidity_fixture',stats:{maxHp:1e6,atk:0,def:150,blockCnt:blocked?1:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,blocked?6:5]}),g=h.b.allyUnits[0],hits=[],attacks=[];
 h.b.addBuff(e,{key:'hold',flags:{noMove:true}});h.b.on('damaged',c=>{if(c.source===e&&c.target===g)hits.push({time:h.b.time,amount:c.hpLoss});});
 h.b.on('attack',c=>{if(c.attacker===e)attacks.push(h.b.time);});return{...h,e,g,hits,attacks};
}
for(const id of ids){
 test(`${id}: ordinary and marked-target casts compile as one reusable dual-mode melee component`,()=>{
  const row=records.enemies[id].levels[0];assert.ok(expletiveNative(row,nativeComponents(evidence,id)));
  assert.deepEqual(withCompiledEnemyRuntime(row).runtimeFeatures.entries.filter(e=>e.ability).map(e=>e.ability.kind),['markedRangedMeleeAttack']);
 });
 test(`${id}: unmarked ranged allies are ignored; marked allies receive one direct hit at the Skill marker`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,{compiled});h.run(2);assert.equal(h.attacks.length,0);
   h.b.addBuff(h.g,{key:mark});assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.equal(h.e.mem.regularFormVisual.clip,'Skill');
   assert.ok(h.runUntil(()=>h.hits.length===1,1));assert.ok(Math.abs(h.hits[0].time-h.attacks[0]-23/30)<h.b.dt*1.2);
   assert.equal(h.hits[0].amount,h.e.base.atk-150);assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: an unmarked blocker receives ordinary Attack timing instead of the ranged Skill clock`,()=>{
  const h=fixture(id,{blocked:true});assert.ok(h.runUntil(()=>h.attacks.length===1,1));assert.equal(h.e.blockedBy,h.g);
  assert.equal(h.e.mem.regularFormVisual.clip,'Attack');assert.ok(h.runUntil(()=>h.hits.length===1,2));
  assert.ok(Math.abs(h.hits[0].time-h.attacks[0]-28/30)<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
 });
}
test('the native circle uses collider contact, and camouflage prevents a new marked-target cast',()=>{
 const h=fixture();h.b.addBuff(h.g,{key:mark});h.e.x=h.g.x-1.26;h.run(.2);assert.equal(h.attacks.length,0);
 h.e.x=h.g.x-1.24;h.b.addBuff(h.g,{key:'camou',flags:{camou:true}});h.run(.2);assert.equal(h.attacks.length,0);
 h.b.removeBuff(h.g,'camou');assert.ok(h.runUntil(()=>h.hits.length===1,2));assert.deepEqual(h.b.errors,[]);
});
test('death and freeze cancel unreleased ranged-mode damage through the shared cast owner',()=>{
 for(const kind of['death','freeze']){
  const h=fixture();h.b.addBuff(h.g,{key:mark});assert.ok(h.runUntil(()=>h.attacks.length===1,1));
  if(kind==='death')h.b.kill(h.e);else h.b.applyStatus(h.e,'freeze',{duration:1});
  h.run(.8);assert.equal(h.hits.length,0);if(kind==='freeze')assert.ok(h.runUntil(()=>h.hits.length===1,4));assert.deepEqual(h.b.errors,[]);
 }
});
test('a captured ranged deployment retains its cast when its selection marker ends, but a vanished deployment cannot receive it',()=>{
 for(const vanished of[false,true]){
  const h=fixture();h.b.addBuff(h.g,{key:mark});assert.ok(h.runUntil(()=>h.attacks.length===1,1));h.b.removeBuff(h.g,mark);
  if(vanished)h.b.kill(h.g);h.run(1);assert.equal(h.hits.length,vanished?0:1);assert.deepEqual(h.b.errors,[]);
 }
});
test('source admission refuses changed marker filters, range geometry, direct packets and animation aliases',()=>{
 for(const id of ids)for(const edit of[
  n=>{const root=n[id].find(c=>'_modes'in c),m=n.$ref(root._modes[0]);n.$ref(m._attack)._atkScale=2;},
  n=>n.$siblings(trigger(n)).find(c=>'_buffKey'in c)._buffKey='unreviewed',
  n=>n.$siblings(trigger(n)).find(c=>'_buffKey'in c)._targetMotion=3,
  n=>{const t=trigger(n);n.$siblings(t).find(c=>'m_Radius'in c).m_Radius=2;},
  n=>{const root=n[id].find(c=>'_modes'in c);n.$ref(root._animator)._animations.find(a=>a.animKey==='Skill').speed=2;},
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(expletiveNative(records.enemies[id].levels[0],n),false);}
});
