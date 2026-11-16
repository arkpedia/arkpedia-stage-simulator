// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {famigliaCasterNative} from '../shared/arkpedia/enemy-famiglia-caster-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {registerDeviceSp} from '../server/sim/content/arkpedia-device-sp.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1280_sgmag','enemy_1280_sgmag_2'],key='enemy_sgmag_s_modify_vg';
function fixture(id=ids[0],compiled=true,guards=true){
 const g=chessRec({id:'caster_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0},skill:null});const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:guards?[{chessId:g.chessId,row:10,col:6},{chessId:g.chessId,row:11,col:6}]:[],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,5]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});const controller=h.b.spawnDevice('review:SP-receiver',10,9,{side:'enemy'});controller.tags.add('vgctrl');const state={sp:0,pulses:[]};registerDeviceSp(h.b,controller,{get:()=>state.sp,add:n=>{const prior=state.sp;state.sp=Math.min(500,state.sp+n);state.pulses.push(h.b.time);return state.sp-prior;}});const hits=[];h.b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,time:h.b.time,type:c.dmg.type});});return{...h,e,controller,state,hits,guards:h.b.allyUnits};
}
for(const id of ids){
 test(`${id}: the native two-target packet and bounded channel compile to shared components`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(famigliaCasterNative(r,nativeComponents(evidence,id)));assert.ok(support.enemies[id].policy);const entries=withCompiledEnemyRuntime(r).runtimeFeatures.entries;assert.equal(entries[0].trait.maxTargets,2);assert.deepEqual(entries.filter(v=>v.ability).map(v=>v.ability.kind),['channelledSpEmitter','stageOutcomeCounter']);
 });
 test(`${id}: an eight-second channel grants eight pulses of five SP, with the three original animation segments`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled);h.run(4.9);assert.equal(h.state.sp,0);assert.equal(h.e.findBuff(key),null);h.run(.2);assert.ok(h.e.findBuff(key));assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Begin');h.run(.6);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Loop');assert.equal(h.e.mem.regularFormVisual.loop,true);h.run(6.9);assert.equal(h.e.mem.regularFormVisual.clip,'Skill_End');h.run(.6);assert.equal(h.e.findBuff(key),null);assert.equal(h.e.findBuff('enemy_sgmag_s_effect'),null);assert.equal(h.state.sp,40);assert.equal(h.state.pulses.length,8);assert.ok(h.state.pulses.every((t,i)=>Math.abs(t-(6+i))<h.b.dt*2));assert.deepEqual(h.b.errors,[]);}
 });
 test(`${id}: both captured deployments receive one Arts projectile per ordinary native release`,()=>{
  const h=fixture(id),attacks=[];h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});assert.ok(h.runUntil(()=>h.hits.length===2,2));assert.equal(new Set(h.hits.map(v=>v.target)).size,2);assert.ok(h.hits.every(v=>v.type==='arts'));assert.ok(h.hits.every(v=>v.time-attacks[0]>=14/30));assert.deepEqual(h.b.errors,[]);
 });
}
test('an existing Asset Liquidation marker suppresses entry while a marker gained during channeling leaves that cast running',()=>{
 const h=fixture(),aura=h.b.addBuff(h.e,{key:'vgctrl_s[aura]'});h.run(7);assert.equal(h.e.findBuff(key),null);assert.equal(h.state.sp,0);h.b.removeBuff(h.e,aura);h.run(.1);assert.ok(h.e.findBuff(key));h.run(1);h.b.addBuff(h.e,{key:'vgctrl_s[aura]'});h.run(7.1);assert.equal(h.state.sp,40);assert.equal(h.e.findBuff(key),null);h.run(3);assert.equal(h.state.sp,40);assert.deepEqual(h.b.errors,[]);
});
test('channeling starts without ordinary attack targets and source cooldown continues while it runs',()=>{
 const h=fixture(ids[0],true,false);h.run(13.2);assert.equal(h.state.sp,40);assert.equal(h.e.findBuff(key),null);h.run(1.9);assert.ok(h.e.findBuff(key));assert.equal(h.e.mem.regularFormVisual.clip,'Skill_Begin');assert.deepEqual(h.b.errors,[]);
});
test('interrupting a channel removes its buffs and future pulses without restarting its ten-second cooldown',()=>{
 const h=fixture();h.run(7.1);assert.equal(h.state.sp,10);h.b.applyStatus(h.e,'stun',{duration:1});assert.equal(h.e.findBuff(key),null);assert.equal(h.e.findBuff('enemy_sgmag_s_effect'),null);h.run(7.8);assert.equal(h.state.sp,10);assert.equal(h.e.findBuff(key),null);h.run(.2);assert.ok(h.e.findBuff(key));assert.deepEqual(h.b.errors,[]);
});
test('new acquisition is ground-only while released shots retain targets becoming airborne and survive source death',()=>{
 const h=fixture();h.guards[1].motion='FLY';h.run(1);assert.equal(h.hits.length,1);assert.equal(h.hits[0].target,h.guards[0]);
 const captured=fixture();assert.ok(captured.runUntil(()=>captured.b.projectiles.list.length===2,2));captured.guards[0].motion='FLY';captured.b.kill(captured.e);captured.run(.4);assert.equal(captured.hits.length,2);assert.equal(captured.b.stageOutcomes.counters.killed,1);assert.deepEqual(captured.b.errors,[]);
});
test('death inside channel buff admission cannot leave owned channel or effect attachments behind',()=>{
 const h=fixture();const off=h.b.on('beforeBuff',c=>{if(c.unit===h.e&&c.buff.key===key)h.b.kill(h.e);});h.run(5.2);h.b.off(off);assert.equal(h.e.alive,false);assert.equal(h.e.findBuff(key),null);assert.equal(h.e.findBuff('enemy_sgmag_s_effect'),null);assert.equal(h.state.sp,0);assert.deepEqual(h.b.errors,[]);
});
test('source admission refuses different selection timing, target counts, entry condition, channel clocks and cleanup ownership',()=>{
 for(const id of ids)for(const edit of[
  (n,id)=>n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[0])._attack)._selectTargetTiming=1,
  (n,id)=>n.$ref(n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[0])._attack)._selector)._maxNum=1,
  n=>n.$siblings(n.$ref(n.AddVG.find(v=>v._familyMask)._trigger)).find(v=>v._buffKeys)._buffKeys=['other'],
  n=>n.$siblings(n.AddVG.find(v=>v._familyMask)).find(v=>v._default)._default.endAnim='Idle',
  n=>n.$siblings(n.AddVG.find(v=>v._familyMask)).find(v=>v._buffs)._buffs[0].triggerInterval=.5,
  n=>n.$template(key).eventToActions.ON_BUFF_TRIGGER[0]._finishDerivedBuffIfParentFinish=false,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n,id);assert.equal(famigliaCasterNative(records.enemies[id].levels[0],n),false);}
});
test('selected channel plans preflight their SP program and use only the channel and result modules',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();await runtime.prepare({[ids[0]]:r});assert.deepEqual(runtime.stats().loaded.sort(),['arkpedia-enemy-sp-channel','arkpedia-stage-outcomes']);delete r.runtimeFeatures.entries.find(v=>v.ability?.kind==='channelledSpEmitter').ability.params.blackboard.sp;await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:r}),/missing blackboard/);
});
