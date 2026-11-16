// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {famigliaCapoNative} from '../shared/arkpedia/enemy-famiglia-capo-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {registerDeviceSp} from '../server/sim/content/arkpedia-device-sp.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
const ids=['enemy_1282_sgelder','enemy_1282_sgelder_2'],key='enemy_sgelder_aura_vg';
function fixture(id=ids[0],compiled=true){
 const g=chessRec({id:'capo_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:5},skill:null});const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{...Object.fromEntries(ids.map(k=>[k,compiled?withCompiledEnemyRuntime(records.enemies[k].levels[0]):records.enemies[k].levels[0]])),dummy:enemyRec({key:'dummy',speed:0})},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});const guard=h.b.allyUnits[0];
 const controller=h.b.spawnDevice('review:SP-receiver',10,9,{side:'enemy'});controller.tags.add('vgctrl');const state={sp:0};registerDeviceSp(h.b,controller,{get:()=>state.sp,add:n=>{const before=state.sp;state.sp=Math.min(500,state.sp+n);return state.sp-before;}});
 const donor=(pos=[10,7])=>{const u=h.b.spawnEnemy('dummy',{pos});h.b.addBuff(u,{key:'hold',flags:{noMove:true}});return u;};return{...h,e,guard,controller,state,donor};
}
for(const id of ids){
 test(`${id}: native independent death aura and Arts melee compile atomically`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(famigliaCapoNative(r,nativeComponents(evidence,id)));assert.ok(support.enemies[id].policy);assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.map(v=>v.ability.kind),['selectedAuraDeathSp','animatedMeleeAttack']);
 });
 test(`${id}: an attached killed recipient grants forty SP and consumes only this source's attachment`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled),near=h.donor();h.run(.1);assert.ok(near.findBuff(key));h.b.kill(near);assert.equal(h.state.sp,40);assert.equal(near.findBuff(key),null);assert.ok(h.e.findBuff(key));assert.deepEqual(h.b.errors,[]);}
 });
 test(`${id}: native melee release deals Arts at its source clock`,()=>{
  const h=fixture(id),hits=[],attacks=[];h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});h.b.on('hit',c=>{if(c.source===h.e&&c.target===h.guard)hits.push({time:h.b.time,type:c.dmg.type,amount:c.dmg.amount});});assert.ok(h.runUntil(()=>hits.length===1,2));assert.equal(hits[0].type,'arts');assert.equal(hits[0].amount,h.e.s.atk);assert.ok(Math.abs(hits[0].time-attacks[0]-.4)<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
 });
}
test('source range follows membership; airborne same-side DEFAULT recipients qualify, devices and opponents do not',()=>{
 const h=fixture(),inside=h.donor([10,7.79]),outside=h.donor([10,7.81]),air=h.donor([11,6]);air.motion='FLY';const device=h.b.spawnDevice('review:nearby-device',11,6,{side:'enemy'});h.run(.1);assert.ok(inside.findBuff(key));assert.equal(outside.findBuff(key),null);assert.ok(air.findBuff(key));assert.equal(device.findBuff(key),null);assert.equal(h.guard.findBuff(key),null);
 inside.x=9;outside.x=7;h.run(.1);assert.equal(inside.findBuff(key),null);assert.ok(outside.findBuff(key));h.b.kill(inside);assert.equal(h.state.sp,0);h.b.kill(outside);h.b.kill(air);h.b.kill(device);assert.equal(h.state.sp,80);assert.deepEqual(h.b.errors,[]);
});
test('overlapping owners retain independent attachments and contribute forty each, including the killed owner',()=>{
 const h=fixture(),second=h.b.spawnEnemy(ids[1],{pos:[11,6]}),recipient=h.donor();h.b.addBuff(second,{key:'hold',flags:{noMove:true}});h.run(.1);assert.equal(recipient.buffs.filter(v=>v.key===key).length,2);h.b.kill(recipient);assert.equal(h.state.sp,80);h.b.kill(h.e);assert.equal(h.state.sp,160);assert.ok(second.findBuff(key));h.b.kill(second);assert.equal(h.state.sp,200);assert.deepEqual(h.b.errors,[]);
});
test('leakage does not pay; source removal detaches only its own membership and cosmetic passives',()=>{
 const h=fixture(),recipient=h.donor(),foreign=h.b.addBuff(recipient,{key,refresh:'independent',maxStacks:Infinity});h.run(.1);h.b.leak(h.e);assert.equal(h.state.sp,0);assert.deepEqual(recipient.buffs.filter(v=>v.key===key),[foreign]);assert.equal(h.e.findBuff('enemy_sgelder_eff1'),null);assert.equal(h.e.findBuff('enemy_sgelder_eff2'),null);h.b.kill(recipient);assert.equal(h.state.sp,0);assert.deepEqual(h.b.errors,[]);
});
test('an explicitly removed recipient attachment does not pay until the live aura reapplies it',()=>{
 const h=fixture(),first=h.donor();h.run(.1);h.b.removeBuff(first,key);h.b.kill(first);assert.equal(h.state.sp,0);const second=h.donor();h.b.removeBuff(second,key);h.run(.1);assert.ok(second.findBuff(key));h.b.kill(second);assert.equal(h.state.sp,40);assert.deepEqual(h.b.errors,[]);
});
test('the non-silenceable aura survives forced silence and stun and honors receiver SP refusal',()=>{
 const h=fixture(),a=h.donor();h.b.addBuff(h.e,{key:'forced',flags:{silence:true,stun:true}});h.run(.1);assert.ok(a.findBuff(key));h.b.addBuff(h.controller,{key:'no-sp',flags:{noSp:true}});h.b.kill(a);assert.equal(h.state.sp,0);h.b.removeBuff(h.controller,'no-sp');const b=h.donor();h.run(.1);h.b.kill(b);assert.equal(h.state.sp,40);assert.deepEqual(h.b.errors,[]);
});
test('source death during recipient attachment admission leaves no retired aura attachments',()=>{
 const h=fixture();const off=h.b.on('beforeBuff',c=>{if(c.unit!==h.e&&c.buff.key===key)h.b.kill(h.e);});const target=h.donor();h.b.off(off);assert.equal(h.e.alive,false);assert.equal(target.findBuff(key),null);assert.equal(h.e.findBuff('enemy_sgelder_eff1'),null);assert.deepEqual(h.b.errors,[]);
});
test('source gates reject radius, detach policy, target category, reward origin and ordinary damage changes',()=>{
 for(const id of ids)for(const edit of[
  n=>n.AuraVG.find(v=>v._buffs)._selfOption=2,
  n=>n.AuraVG.find(v=>v._buffs)._removeBuffWhenTargetLeave=0,
  n=>n.$ref(n.AuraVG.find(v=>v._targetValidator)._targetValidator)._targetOptions.targetCategory=3,
  n=>n.$template(key).eventToActions.ON_OWNER_KILLED[0]._sourceType='BUFF_OWNER',
  n=>n.$template(key).eventToActions.ON_OWNER_KILLED[1]._decCntIfStack=true,
  (n,id)=>n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[0])._combat)._damageType=1,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n,id);assert.equal(famigliaCapoNative(records.enemies[id].levels[0],n),false);}
});
test('selected runtime preflights the aura SP graph and loads the shared aura/melee components',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();await runtime.prepare({[ids[0]]:r});assert.deepEqual(runtime.stats().loaded.sort(),['arkpedia-enemy-death-aura','arkpedia-enemy-melee-sequence']);delete r.runtimeFeatures.entries[0].ability.params.blackboard.sp;await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:r}),/missing blackboard/);
});
