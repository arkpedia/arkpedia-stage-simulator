// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {blightArcherNative} from '../shared/arkpedia/enemy-blight-archer-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1391_dhbow','enemy_1391_dhbow_2'],key='enemy_dhbow_passive_check',marker=`${key}[buff]`;
function fixture(id=ids[0],compiled=true){
 const guard=chessRec({id:'blight_mode_guard',stats:{maxHp:1e6,atk:0,def:1000,res:25,blockCnt:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0]},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 const state={polluted:false};h.b.environmentConditions={test:(condition,u)=>{assert.equal(condition,'act31SidePollute');return u===h.e&&state.polluted;}};h.b.start();
 h.e=h.b.spawnEnemy(id,{pos:[10,5]});const g=h.b.allyUnits[0],hits=[],attacks=[];h.b.addBuff(h.e,{key:'hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===h.e&&c.target===g)hits.push({time:h.b.time,type:c.dmg.type});});
 h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push({time:h.b.time,mode:h.e.mem.projectileModeIndex});});
 return{...h,g,state,hits,attacks};
}
const nextHit=h=>{const count=h.hits.length;assert.ok(h.runUntil(()=>h.hits.length>count,8));return h.hits[count];};
for(const id of ids){
 test(`${id}: both native modes and the full marker program reuse the selected projectile component`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(blightArcherNative(r,nativeComponents(evidence,id)));
  assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.map(e=>e.ability?.kind),['programmedProjectileModes']);
 });
 test(`${id}: only the owner's distinct Blighted-area provider selects Arts, with native marker polling`,()=>{
  for(const compiled of[false,true]){
   const h=fixture(id,compiled);h.b.environmentConditions={maskAt:()=>8,test:(condition,u)=>u===h.e?h.state.polluted:true};
   assert.equal(nextHit(h).type,'phys');assert.equal(h.e.findBuff(marker),null);
   h.state.polluted=true;h.run(.2);assert.ok(h.e.findBuff(marker));assert.equal(h.e.buffs.filter(b=>b.key===marker).length,1);
   h.run(.5);assert.equal(h.e.buffs.filter(b=>b.key===marker).length,1);assert.equal(nextHit(h).type,'arts');
   h.state.polluted=false;h.run(.2);assert.equal(h.e.findBuff(marker),null);assert.equal(nextHit(h).type,'phys');assert.deepEqual(h.b.errors,[]);
  }
 });
 test(`${id}: source non-silenceable parent keeps its marker and current Arts mode; silence prevents later entry into Arts`,()=>{
  const h=fixture(id);h.state.polluted=true;assert.equal(nextHit(h).type,'arts');h.b.applyStatus(h.e,'silence',{duration:30});
  h.run(.2);assert.equal(h.e.mem.projectileModeIndex,0);assert.ok(h.e.findBuff(marker));assert.equal(nextHit(h).type,'arts');
  h.state.polluted=false;assert.equal(nextHit(h).type,'phys');h.state.polluted=true;assert.equal(nextHit(h).type,'phys');assert.ok(h.e.findBuff(marker));assert.deepEqual(h.b.errors,[]);
 });
}
test('markers are parent-owned: leaving, parent removal and source death clear only this attachment',()=>{
 const h=fixture();h.state.polluted=true;h.run(.2);const owned=h.e.findBuff(marker);assert.ok(owned);
 const foreign=h.b.addBuff(h.e,{key:'foreign:marker'});h.b.removeBuff(h.e,key);assert.equal(h.e.findBuff(marker),null);assert.ok(h.e.buffs.includes(foreign));
 assert.equal(h.e.mem.projectileModeIndex,1);assert.equal(nextHit(h).type,'phys');assert.deepEqual(h.b.errors,[]);
 for(const reason of ['kill','leak']){const dead=fixture();dead.state.polluted=true;dead.run(.2);assert.ok(dead.e.findBuff(marker));dead.b[reason](dead.e);assert.equal(dead.e.findBuff(marker),null);assert.deepEqual(dead.b.errors,[]);}
});
test('a marker with the same key from outside the parent is neither adopted nor removed',()=>{
 const h=fixture();const foreign=h.b.addBuff(h.e,{key:marker});h.state.polluted=true;h.run(.3);assert.ok(h.e.buffs.includes(foreign));
 h.state.polluted=false;h.run(.2);assert.ok(h.e.buffs.includes(foreign));h.b.removeBuff(h.e,key);assert.ok(h.e.buffs.includes(foreign));assert.deepEqual(h.b.errors,[]);
});
test('pending native mode casts cancel on parent detach; released shots survive source death',()=>{
 const h=fixture();h.state.polluted=true;assert.ok(h.runUntil(()=>h.attacks.length===1,1));h.run(.1);h.b.removeBuff(h.e,key);h.run(.5);assert.equal(h.hits.length,0);
 const released=fixture();released.state.polluted=true;assert.ok(released.runUntil(()=>released.b.projectiles.list.length>0,1));
 assert.ok(Math.abs(released.b.time-released.attacks[0].time-.4)<released.b.dt*1.2);released.b.kill(released.e);assert.equal(nextHit(released).type,'arts');assert.deepEqual(released.b.errors,[]);
});
test('no environment provider invents Blight from an unrelated darkness mask',()=>{
 const absent=fixture();delete absent.b.environmentConditions;assert.equal(nextHit(absent).type,'phys');assert.equal(absent.e.findBuff(marker),null);
 const darkness=fixture();darkness.b.environmentConditions={maskAt:()=>8};assert.equal(nextHit(darkness).type,'phys');assert.equal(darkness.e.findBuff(marker),null);
});
test('source admission rejects altered polling, parent disable scope, foreign markers, gameplay children and mode roles',()=>{
 for(const id of ids)for(const edit of[
  n=>n.Passive.find(c=>'_buffs'in c)._buffs[0].isSilenceable=1,
  n=>n.Passive.find(c=>'_buffs'in c)._buffs[0].triggerInterval=.2,
  n=>n.$template(key).eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[2]._buff.attributes.abnormalFlags=['INVISIBLE'],
  n=>n.$template(key).eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[2]._finishDerivedBuffIfParentFinish=false,
  n=>n.$template(key).eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[2]._buffOwner='MODIFIER_TARGET',
  n=>n.$template('empty').eventToActions.ON_BUFF_START=[{$type:'Torappu.Battle.Action.Nodes+InstantKill, Assembly-CSharp'}],
  n=>n.$ref(n.$ref(n[id].find(c=>'_modes'in c)._modes[0])._attack)._interruptAbilityOnDetach=0,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(blightArcherNative(records.enemies[id].levels[0],n),false);}
});
test('rejected derived attachments retry on the next native pulse and never leave phantom ownership',()=>{
 const h=fixture();h.state.polluted=true;
 const off=h.b.on('beforeBuff',c=>{if(c.buff.key===marker)c.cancel=true;});h.run(.3);assert.equal(h.e.findBuff(marker),null);
 h.b.off(off);h.run(.2);assert.ok(h.e.findBuff(marker));h.state.polluted=false;h.run(.2);assert.equal(h.e.findBuff(marker),null);assert.deepEqual(h.b.errors,[]);
});
test('separate parents sharing the program poll their own area and clear their own derived markers',()=>{
 const h=fixture(),second=h.b.spawnEnemy(ids[0],{pos:[11,5]});h.b.addBuff(second,{key:'hold',flags:{noMove:true}});
 const active=new Set([h.e,second]);h.b.environmentConditions={test:(_name,u)=>active.has(u)};h.run(.2);
 assert.ok(h.e.findBuff(marker));assert.ok(second.findBuff(marker));h.b.removeBuff(h.e,key);assert.equal(h.e.findBuff(marker),null);assert.ok(second.findBuff(marker));
 active.clear();h.run(.2);assert.equal(second.findBuff(marker),null);assert.deepEqual(h.b.errors,[]);
});
