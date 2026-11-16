// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {famigliaLimoNative,famigliaLimoChild} from '../shared/arkpedia/enemy-famiglia-limo-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {enemyRuntimeSpawnDependencies} from '../shared/arkpedia/enemy-runtime-plan.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {registerDeviceSp} from '../server/sim/content/arkpedia-device-sp.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1281_sgcar','enemy_1281_sgcar_2'],parent='enemy_sgcar_death';
function fixture(id=ids[0],compiled=true,blocked=true,autoFinish=false){
 const g=chessRec({id:'limo_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:8},skill:null}),child=famigliaLimoChild(records.enemies[id].levels[0]);const defs=Object.fromEntries([id,child].map(k=>[k,compiled?withCompiledEnemyRuntime(records.enemies[k].levels[0]):records.enemies[k].levels[0]]));
 const h=makeBattle({content:'none',autoFinish,defs:{enemies:defs,chess:{[g.chessId]:g}},units:blocked?[{chessId:g.chessId,row:10,col:6}]:[],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6],route:{start:[10,6],end:[10,10],steps:[{t:'wait',s:2},{t:'move',p:[10,8]}]}});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});if(blocked)assert.equal(h.b._checkBlock(e),true);
 const controller=h.b.spawnDevice('review:SP-receiver',10,9,{side:'enemy'});controller.tags.add('vgctrl');const state={sp:0};registerDeviceSp(h.b,controller,{get:()=>state.sp,add:n=>{const before=state.sp;state.sp=Math.min(500,state.sp+n);return state.sp-before;}});return{...h,e,child,state,children:()=>h.b.enemies.filter(u=>u.defId===child)};
}
for(const id of ids){
 test(`${id}: both native modes, parent program, source child and original melee clocks compile atomically`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(famigliaLimoNative(r,nativeComponents(evidence,id)));assert.ok(support.enemies[id].policy);assert.deepEqual(support.enemies[id].spawns,[famigliaLimoChild(r)]);const plan=withCompiledEnemyRuntime(r).runtimeFeatures;assert.deepEqual(plan.entries.map(v=>v.ability.kind),['blockedDeathSummons','animatedMeleeAttack']);assert.deepEqual(enemyRuntimeSpawnDependencies(plan),[famigliaLimoChild(r)]);
 });
 test(`${id}: a blocked fatal attempt switches death mode and queues exactly three original children following the captured route`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled);h.run(.1);h.b.kill(h.e);assert.equal(h.children().length,0);assert.equal(h.e.mem.regularFormVisual.die,'Die_2');assert.equal(h.b.stageOutcomes.counters.killed,1);assert.equal(h.b.stageOutcomes.counters.sgcar_boom_direct??0,0);assert.ok(h.b._hasPendingEnemySchedules());h.run(.1);const children=h.children();assert.equal(children.length,3);assert.ok(children.every(c=>Math.abs(c.x-6)<=Math.fround(.1)&&Math.abs(c.y-10)<=Math.fround(.1)));assert.ok(children.every(c=>c.route.legs.some(l=>l.r===10&&l.c===8)));assert.ok(children.every(c=>c.route.legs.some(l=>l.final&&l.r===10&&l.c===10)));for(const c of children)h.b.kill(c);assert.equal(h.state.sp,id.endsWith('_2')?105:60);assert.equal(h.b.stageOutcomes.counters.killed,4);assert.deepEqual(h.b.errors,[]);}
 });
 test(`${id}: unblocked killed removal records the separate direct-destruction result without passengers`,()=>{
  const h=fixture(id,true,false);h.b.kill(h.e);h.run(.1);assert.equal(h.children().length,0);assert.equal(h.e.mem.regularFormVisual.die,'Die_1');assert.equal(h.b.stageOutcomes.counters.sgcar_boom_direct,1);assert.equal(h.b.stageOutcomes.counters.killed,1);assert.equal(h.state.sp,0);assert.deepEqual(h.b.errors,[]);
 });
}
test('leakage and non-kill removal do not enter the fatal mode or create passengers',()=>{
 for(const reason of['leak','fallDown']){const h=fixture();if(reason==='leak')h.b.leak(h.e);else h.b._remove(h.e,reason);h.run(.1);assert.equal(h.children().length,0);assert.equal(h.b.stageOutcomes?.counters.killed??0,0);assert.equal(h.b.stageOutcomes?.counters.sgcar_boom_direct??0,0);assert.deepEqual(h.b.errors,[]);}
});
test('the native instant summon checks Silence but its mode-switching parent is not silenceable or stunnable',()=>{
 const h=fixture();h.b.addBuff(h.e,{key:'forced-silence',flags:{silence:true}});h.b.kill(h.e);h.run(.1);assert.equal(h.children().length,0);assert.equal(h.e.mem.regularFormVisual.die,'Die_2');assert.equal(h.b.stageOutcomes.counters.killed,1);
 const stunned=fixture();stunned.b.applyStatus(stunned.e,'stun',{duration:10});assert.ok(stunned.e.blockedBy);stunned.b.kill(stunned.e);stunned.run(.1);assert.equal(stunned.children().length,3);assert.equal(stunned.b.stageOutcomes.counters.sgcar_boom_direct??0,0);assert.deepEqual(stunned.b.errors,[]);
});
test('owned death and killed-log attachments can be removed independently and foreign instances do not replace them',()=>{
 const h=fixture(),foreign=h.b.addBuff(h.e,{key:parent,refresh:'independent',maxStacks:Infinity}),own=h.e.buffs.find(v=>v.key===parent&&v!==foreign);h.b.removeBuff(h.e,own);h.b.kill(h.e);h.run(.1);assert.equal(h.children().length,0);assert.equal(h.b.stageOutcomes.counters.killed,1);assert.ok(h.e.buffs.includes(foreign));
 const second=fixture();second.b.removeBuff(second.e,'enemy_sgcar_dead_log');second.b.kill(second.e);second.run(.1);assert.equal(second.children().length,3);assert.equal(second.b.stageOutcomes?.counters.killed??0,0);assert.deepEqual(second.b.errors,[]);
});
test('the instant mode passive is installed once and its scheduler requests retain victory ownership after the parent dies',()=>{
 const h=fixture(ids[0],true,true,true);h.b.kill(h.e);assert.equal(h.b.finished,false);h.run(.1);assert.equal(h.children().length,3);assert.equal(h.b.finished,false);assert.deepEqual(h.b.errors,[]);
});
test('native mode death clips remain after an interrupted ordinary attack is cleaned up',()=>{
 const h=fixture();h.run(.1);assert.equal(h.e.mem.regularFormVisual.clip,'Attack');h.b.kill(h.e);assert.equal(h.e.mem.regularFormVisual.die,'Die_2');h.run(.1);assert.equal(h.children().length,3);assert.deepEqual(h.b.errors,[]);
});
test('source admission refuses altered child IDs, summon offsets, blocking policy, mode bindings and death clip mapping',()=>{
 for(const id of ids)for(const edit of[
  n=>n.Passive.find(v=>v._buffs)._buffs[0].blackboard[0].valueStr='enemy_1007_slime',
  n=>n.$template('enemy_sgcar_death_sum').eventToActions.ON_BUFF_START[1]._randomOffsetBound=.5,
  n=>n.$template('enemy_sgcar_death_sum').eventToActions.ON_BUFF_START[1]._stopSummonIfHostDead=true,
  n=>n.$template('enemy_sgcar_death').eventToActions.ON_BEFORE_TRY_SET_HP_ZERO[0]._failNodes[0]._conditionNode._checkBlockedCount=true,
  (n,id)=>n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[1])._animatorHooker)._replaceAnimPairs[0].toAnimKey='Die_1',
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n,id);assert.equal(famigliaLimoNative(records.enemies[id].levels[0],n),false);}
});
test('selected loading refuses absent child records before importing factories and then prepares the real child adapters',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();assert.throws(()=>runtime.prepare({[ids[0]]:r}),/Missing enemy runtime spawn dependency/);assert.deepEqual(runtime.stats().loaded,[]);const child=famigliaLimoChild(r);await runtime.prepare({[ids[0]]:r,[child]:withCompiledEnemyRuntime(records.enemies[child].levels[0])});assert.deepEqual(runtime.stats().loaded.sort(),['arkpedia-enemy-blocked-death','arkpedia-enemy-death-sp','arkpedia-enemy-melee-sequence']);
});
test('a real source-hole fall keeps its killed receipt but bypasses both before-zero branches, even while still blocked',()=>{
 const h=fixture(),tile=h.b.grid.tile(10,7);h.b.grid.setTile(10,7,{...tile,key:'tile_hole',pass:'FLY',build:'NONE'});let wasBlocked=false;h.b.displace(h.e,{x:1,y:0},1,{onFall:unit=>{wasBlocked=!!unit.blockedBy;h.b.kill(unit);}});assert.ok(wasBlocked);assert.equal(h.e.alive,false);assert.equal(h.e.mem.deathByFall,true);h.run(.1);assert.equal(h.children().length,0);assert.equal(h.b.stageOutcomes.counters.sgcar_boom_direct??0,0);assert.equal(h.b.stageOutcomes.counters.killed,1);assert.deepEqual(h.b.errors,[]);
});
