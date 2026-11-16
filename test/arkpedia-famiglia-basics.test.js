// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {famigliaBasicNative} from '../shared/arkpedia/enemy-famiglia-basic-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {registerDeviceSp} from '../server/sim/content/arkpedia-device-sp.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1277_sgman','enemy_1277_sgman_2','enemy_1279_sgbdg','enemy_1279_sgbdg_2'];
function fixture(id=ids[0],compiled=true,guard=false){
 const g=chessRec({id:'famiglia_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:5},skill:null});const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:Object.fromEntries(ids.map(k=>[k,compiled?withCompiledEnemyRuntime(records.enemies[k].levels[0]):records.enemies[k].levels[0]])),chess:{[g.chessId]:g}},units:guard?[{chessId:g.chessId,row:10,col:6}]:[],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 const controller=(row=10,col=8,side='enemy',tag='vgctrl')=>{const u=h.b.spawnDevice('controlled:SP-receiver',row,col,{side});u.tags.add(tag);const state={sp:0,active:false};registerDeviceSp(h.b,u,{get:()=>state.sp,add:n=>{if(state.active)return 0;const before=state.sp;state.sp=Math.min(500,state.sp+n);return state.sp-before;}});return{u,state};};return{...h,e,controller};
}
for(const id of ids){
 test(`${id}: native death selector/SP program and physical melee compile atomically`,()=>{
  assert.equal(famigliaBasicNative(records.enemies[id].levels[0],nativeComponents(evidence,id)),true);assert.ok(support.enemies[id].policy);assert.deepEqual(withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries.map(e=>e.ability.kind),['selectedDeathSp','animatedMeleeAttack']);
 });
 test(`${id}: killed owners grant the exact source SP to the tagged receiver without requiring one in unrelated stages`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled),target=h.controller();h.b.kill(h.e);assert.equal(target.state.sp,h.e.def.raw.talents.bb['DeathRattle.sp']);assert.equal(h.b.stageOutcomes?.counters.killed??0,id.includes('sgman')?1:0);assert.deepEqual(h.b.errors,[]);}
  const noTarget=fixture(id);noTarget.b.kill(noTarget.e);assert.deepEqual(noTarget.b.errors,[]);
 });
 test(`${id}: ordinary native marker releases one physical melee hit`,()=>{
  const h=fixture(id,true,true),hits=[],attacks=[];h.b.on('attack',c=>{if(c.attacker===h.e)attacks.push(h.b.time);});h.b.on('damaged',c=>{if(c.source===h.e)hits.push({time:h.b.time,type:c.dmg.type,loss:c.hpLoss});});assert.ok(h.runUntil(()=>hits.length===1,2));assert.equal(hits[0].type,'phys');assert.equal(hits[0].loss,h.e.base.atk);assert.ok(Math.abs(hits[0].time-attacks[0]-(id.includes('sgman')?17/30:13/30))<h.b.dt*1.2);assert.deepEqual(h.b.errors,[]);
 });
}
test('both-side tagged-device selection excludes wrong tags and honors its one-target priority',()=>{
 const h=fixture(),first=h.controller(),last=h.controller(11,8,'ally'),wrong=h.controller(9,8,'enemy','other');h.b.kill(h.e);assert.equal(first.state.sp,0);assert.equal(last.state.sp,20);assert.equal(wrong.state.sp,0);assert.deepEqual(h.b.errors,[]);
});
test('non-kill removal does not grant SP, while silence does not disable the native passive',()=>{
 const leak=fixture(),target=leak.controller();leak.b.leak(leak.e);assert.equal(target.state.sp,0);assert.equal(leak.b.stageOutcomes?.counters.killed??0,0);
 const killed=fixture(),t=killed.controller();killed.b.addBuff(killed.e,{key:'forced-silence',flags:{silence:true}});killed.b.kill(killed.e);assert.equal(t.state.sp,20);assert.deepEqual(killed.b.errors,[]);
});
test('receiver blocking/active policy is supplied by the actual SP gauge; retired and isolated receivers are excluded',()=>{
 for(const mode of['active','noSp','isolated','dead']){const h=fixture(),t=h.controller();if(mode==='active')t.state.active=true;else if(mode==='dead')h.b.kill(t.u);else h.b.addBuff(t.u,{key:'refuse',flags:{[mode]:true}});h.b.kill(h.e);assert.equal(t.state.sp,0);assert.deepEqual(h.b.errors,[]);}
});
test('native taunt modifiers stay attached to the owned death passive and preserve the database base value',()=>{
 const h=fixture(ids[2]);assert.equal(h.e.s.taunt,h.e.base.tauntLevel+1);h.b.removeBuff(h.e,'enemy_sgbdg_death');assert.equal(h.e.s.taunt,h.e.base.tauntLevel);const t=h.controller();h.b.kill(h.e);assert.equal(t.state.sp,0);assert.deepEqual(h.b.errors,[]);
});
test('separate death/log attachments retain independent removal and preserve foreign same-key instances',()=>{
 const h=fixture(),t=h.controller(),foreign=h.b.addBuff(h.e,{key:'enemy_sgman_death',refresh:'independent'}),own=h.e.buffs.find(v=>v.key==='enemy_sgman_death'&&v!==foreign);h.b.removeBuff(h.e,own);h.b.kill(h.e);assert.equal(t.state.sp,0);assert.equal(h.b.stageOutcomes.counters.killed,1);assert.ok(h.e.buffs.includes(foreign));
 const other=fixture(),u=other.controller();other.b.removeBuff(other.e,'enemy_sgman_dead_log');other.b.kill(other.e);assert.equal(u.state.sp,20);assert.equal(other.b.stageOutcomes?.counters.killed??0,0);assert.deepEqual(other.b.errors,[]);
});
test('source gates reject different receiver tags, target limits, gifts and metadata bindings',()=>{
 for(const edit of[
  n=>n.$ref(n.enemy_1277_sgman.find(v=>v._modes)._modes[0])._combat.m_FileID=1,
  n=>n.$ref(n.SelectVg.find(v=>v._selector)._selector)._filterTag='other',
  n=>n.$ref(n.SelectVg.find(v=>v._selector)._selector)._maxNum=2,
  n=>n.$template('modify_sp[start]').eventToActions.ON_BUFF_START[0]._forceFlag=true,
  n=>n.$template('enemy_sgman_death_rattle').eventToActions.ON_OWNER_KILLED[0]._abilityName='Other',
 ]){const n=nativeComponents(structuredClone(evidence),ids[0]);edit(n);assert.equal(famigliaBasicNative(records.enemies[ids[0]].levels[0],n),false);}
});
test('selected runtime loads only death-SP and melee components and preflights the receiver program',async()=>{
 const r=withCompiledEnemyRuntime(records.enemies[ids[0]].levels[0]),runtime=createEnemyRuntime();await runtime.prepare({[ids[0]]:r});assert.deepEqual(runtime.stats().loaded.sort(),['arkpedia-enemy-death-sp','arkpedia-enemy-melee-sequence']);delete r.runtimeFeatures.entries[0].ability.params.blackboard.sp;await assert.rejects(createEnemyRuntime().prepare({[ids[0]]:r}),/missing blackboard/);
});
test('same-side stealth differs from the opposite-side target-free/camouflage filters',()=>{
 for(const side of['enemy','ally'])for(const flag of['stealth','camou']){const h=fixture(),t=h.controller(10,8,side);h.b.addBuff(t.u,{key:'selection-fixture',flags:{[flag]:true}});h.b.kill(h.e);assert.equal(t.state.sp,side==='enemy'?20:0);assert.deepEqual(h.b.errors,[]);}
});
