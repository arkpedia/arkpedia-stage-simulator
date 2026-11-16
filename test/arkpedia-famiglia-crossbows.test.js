// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {famigliaCrossbowNative} from '../shared/arkpedia/enemy-famiglia-crossbow-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1278_sgbow','enemy_1278_sgbow_2'],parent='enemy_sgbow_vg_check',marker='sgbow_vg_passive',log='enemy_sgbow_dead_log';
function fixture(id=ids[0],compiled=true){
 const g=chessRec({id:'crossbow_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0},skill:null});
 const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const e=h.b.spawnEnemy(id,{pos:[10,5]}),guard=h.b.allyUnits[0],hits=[],attacks=[];h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e&&c.target===guard)hits.push({time:h.b.time,type:c.dmg.type});});h.b.on('attack',c=>{if(c.attacker===e)attacks.push({time:h.b.time,mode:e.mem.projectileModeIndex});});
 return{...h,e,guard,hits,attacks,aura:()=>h.b.addBuff(e,{key:'vgctrl_s[aura]'})};
}
const nextHit=h=>{const count=h.hits.length;assert.ok(h.runUntil(()=>h.hits.length>count,8));return h.hits[count];};
for(const id of ids){
 test(`${id}: source-gated modes compile with an independently removable killed-log attachment`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(famigliaCrossbowNative(r,nativeComponents(evidence,id)));assert.ok(support.enemies[id].policy);
  assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.map(v=>v.ability.kind),['programmedProjectileModes','stageOutcomeCounter']);
 });
 test(`${id}: native half-second polling changes future casts and maintains its mode marker`,()=>{
  for(const compiled of [false,true]){const h=fixture(id,compiled);assert.equal(nextHit(h).type,'phys');const aura=h.aura();h.run(.55);assert.equal(h.e.mem.projectileModeIndex,1);assert.ok(h.e.findBuff(marker));assert.equal(nextHit(h).type,'arts');h.b.removeBuff(h.e,aura);h.run(.55);assert.equal(h.e.mem.projectileModeIndex,0);assert.equal(h.e.findBuff(marker),null);assert.equal(nextHit(h).type,'phys');assert.deepEqual(h.b.errors,[]);}
 });
}
test('first poll waits its interval, ignores silence, and retains the old mode of a pending physical cast',()=>{
 const h=fixture();h.aura();h.b.applyStatus(h.e,'silence',{duration:10});h.run(.4);assert.equal(h.e.mem.projectileModeIndex,0);h.run(.15);assert.equal(h.e.mem.projectileModeIndex,1);assert.equal(nextHit(h).type,'phys');assert.equal(nextHit(h).type,'arts');assert.deepEqual(h.b.errors,[]);
});
test('checker removal leaves current mode/general marker attached, foreign same-key markers survive mode exit and death',()=>{
 const h=fixture();h.aura();h.run(.55);const own=h.e.findBuff(marker),foreign=h.b.addBuff(h.e,{key:marker,refresh:'independent',maxStacks:Infinity});h.b.removeBuff(h.e,parent);h.b.removeBuff(h.e,'vgctrl_s[aura]');h.run(.6);assert.equal(h.e.mem.projectileModeIndex,1);assert.ok(h.e.buffs.includes(own));assert.equal(nextHit(h).type,'arts');h.b.kill(h.e);assert.ok(!h.e.buffs.includes(own));assert.ok(h.e.buffs.includes(foreign));assert.equal(h.b.stageOutcomes.counters.killed,1);
 const exit=fixture();exit.aura();exit.run(.55);const f=exit.b.addBuff(exit.e,{key:marker,refresh:'independent',maxStacks:Infinity});exit.b.removeBuff(exit.e,'vgctrl_s[aura]');exit.run(.55);assert.deepEqual(exit.e.buffs.filter(v=>v.key===marker),[f]);assert.deepEqual(exit.b.errors,[]);
});
test('released projectiles survive source death and retain a captured target that later flies',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,2));h.guard.motion='FLY';h.b.kill(h.e);assert.equal(nextHit(h).type,'phys');assert.deepEqual(h.b.errors,[]);
});
test('new acquisition excludes flying targets and native killed counters require their own live attachment',()=>{
 const h=fixture();h.guard.motion='FLY';h.run(3);assert.equal(h.hits.length,0);h.b.removeBuff(h.e,log);const foreign=h.b.addBuff(h.e,{key:log,refresh:'independent',maxStacks:Infinity});h.b.kill(h.e);assert.equal(h.b.stageOutcomes?.counters.killed??0,0);assert.ok(h.e.buffs.includes(foreign));
 const leak=fixture();leak.b.leak(leak.e);assert.equal(leak.b.stageOutcomes?.counters.killed??0,0);assert.equal(leak.e.findBuff(log),null);
});
test('source gates refuse changed selector geometry, external refs, checker timing, mode children and log semantics',()=>{
 for(const id of ids)for(const edit of[
  n=>n.VGCheck.find(v=>v._buffs)._buffs[0].triggerInterval=.1,
  n=>n.VGCheck.find(v=>v._buffs)._buffs[0].isSilenceable=1,
  n=>n.Passive.find(v=>v._buffs)._buffs[0].attributes.abnormalFlags=[9],
  (n,id)=>n[id].find(v=>v._modes)._modes[0].m_FileID=1,
  (n,id)=>n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[0])._attack)._projectileKey='other',
  n=>n.$template('log_killed').eventToActions.ON_OWNER_KILLED[0]._additionValue=2,
  n=>n.$template('empty').eventToActions.ON_BUFF_START=[{}],
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n,id);assert.equal(famigliaCrossbowNative(records.enemies[id].levels[0],n),false);}
});
test('a mode-marker attachment interrupted by source death cannot leave an owned buff behind',()=>{
 const h=fixture();h.aura();const off=h.b.on('beforeBuff',c=>{if(c.unit===h.e&&c.buff.key===marker)h.b.kill(h.e);});h.run(.6);h.b.off(off);assert.equal(h.e.alive,false);assert.equal(h.e.findBuff(marker),null);assert.deepEqual(h.b.errors,[]);
});
