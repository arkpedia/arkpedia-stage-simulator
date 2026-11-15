// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import native from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { compileStageDanger, dangerNativeReviewed } from '../shared/arkpedia/stage-danger.js';
import { compileStageEnvironments } from '../shared/arkpedia/stage-environments.js';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { StageWaveScheduler } from '../server/sim/content/arkpedia-stage-waves.js';
import { prepareStageEnvironments } from '../tools/arkpedia/stage-environments.mjs';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
const bb = values => Object.entries(values).map(([key,value]) => ({key,value:typeof value==='string'?0:value,valueStr:typeof value==='string'?value:null}));
const environment = values => ({ prefabKey:'legion_mode_enemy_boost',blackboard:bb(values),overrideCameraEffect:null,
  passProfessionMaskFlag:false,professionMask:'NONE',playerSideMask:'ALL' });
const compile = values => compileStageEnvironments([environment(values)])[0];
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
function fixture(values={}) {
  const enemy=enemyRec({speed:0});
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:10000,defs:{enemies:{[enemy.key]:enemy}},
    setup:b=>installStageEnvironments(b,[compile(values)])});
  h.b.start();return {...h,spawn:()=>h.b.spawnEnemy(enemy.key,{pos:[10,5]})};
}
test('danger parameters retain native defaults, source regional variants and explicit wave caps',()=>{
  assert.equal(dangerNativeReviewed(native),true);
  const basic=compile({init_stack_cnt:3,danger_level_step_limit:'5|10|15'});
  assert.deepEqual({...basic,perLevel:undefined},{kind:'legion_mode_enemy_boost',initial:3,max:50,delay:50,interval:50,limits:[5,10,15],blacklist:[],perLevel:undefined});
  near(basic.perLevel.hpPct,.25);near(basic.perLevel.atkPct,.05);
  const regional=compile({def:0,atk:0,attack_speed:.05,max_hp:.1,move_speed:.1,legion_buff_blacklist:'trap_124_eradio'});
  assert.deepEqual(regional.perLevel,{hpPct:.1,atkPct:0,defPct:0,movePct:.1,aspdPct:.05});
  assert.equal(compileStageDanger(null).initial,0);
  for(const values of [{danger_grade:1},{delay:1},{heal_scale:2},{init_stack_cnt:1.5},{init_stack_cnt:51},
    {danger_level_step_limit:'5|4'},{danger_level_step_limit:'0|5'},{danger_level_step_limit:'5||10'},
    {init_stack_cnt:6,danger_level_step_limit:'5|10'},{atk:-.1},{attack_speed:Infinity},
    {legion_buff_blacklist:'enemy_test'},{legion_buff_blacklist:'trap_a|trap_a'}]) assert.throws(()=>compile(values),/danger/i);
  assert.throws(()=>compileStageDanger([...bb({atk:.1}),...bb({atk:.2})]),/Duplicate/);
});
test('native mutation checks prevent unfamiliar controllers, attributes, clocks and heal actions from passing',()=>{
  for(const mutate of [c=>c.m_Script.m_PathID='unknown',c=>c._untickInWavePostDelay=0,
    c=>c._keysScaleWithTime.push('atk'),c=>c._initBlackboard[4].value=45,
    c=>c._options.ignoreTargetFree=1,c=>{delete c._options.ignoreTargetFree;c._options.unknown=0;},
    c=>c._buffs[0].attributes.attributeModifiers[0].formulaItem=0,
    c=>c._buffs[0].isSilenceable=1,c=>c._buffs[1].lifeTime=1]){
    const n=structuredClone(native);mutate(n.prefabs.legion_mode_enemy_boost[0].data);assert.equal(dangerNativeReviewed(n),false);
  }
  const n=structuredClone(native);n.templates.legion_mode_enemy_boost.eventToActions.ON_APPLYING_MODIFIER[1]._addParamKey='different';
  assert.equal(dangerNativeReviewed(n),false);
});
test('danger starts from the source level, grows every 50 seconds and preserves injured HP ratio',()=>{
  const {b,spawn,run}=fixture({init_stack_cnt:2});const e=spawn();
  near(e.s.maxHp,e.base.maxHp*1.5);near(e.s.atk,e.base.atk*1.1);
  e.hp=e.s.maxHp*.4;run(49.9);assert.equal(b.stageDanger.level,2);
  run(.1);assert.equal(b.stageDanger.level,3);near(e.hpRatio,.4);near(e.s.maxHp,e.base.maxHp*1.75);
  const later=spawn();near(later.s.maxHp,later.base.maxHp*1.75);near(later.hpRatio,1);
  run(50);assert.equal(b.stageDanger.level,4);near(e.s.def,e.base.def*1.2);assert.deepEqual(b.errors,[]);
});
test('danger keeps one additive percentage account, including ASPD, and excludes hostile devices',()=>{
  const {b,spawn,run}=fixture({init_stack_cnt:2,atk:0,def:0,attack_speed:.05,move_speed:.1});
  const e=spawn();e.base.aspd=80;e.markDirty();
  b.addBuff(e,{key:'other',mods:{aspd:20,aspdPct:.2,aspdMul:2,hpPct:.5}});
  near(e.s.aspd,260);near(e.s.maxHp,e.base.maxHp*2);
  b.applyStatus(e,'silence',{duration:100});b.applyStatus(e,'stun',{duration:100});run(50);
  near(e.s.aspd,270);near(e.s.maxHp,e.base.maxHp*2.25);
  assert.equal(e.buffs.filter(x=>x.key==='stage:danger').length,1);
  const device=spawn();device.kind='device';b.removeBuff(device,'stage:danger');const hp=device.s.maxHp;
  run(50);assert.equal(device.s.maxHp,hp);assert.equal(device.findBuff('stage:danger'),null);assert.deepEqual(b.errors,[]);
});
test('wave caps bound each scheduled rise, pauses exclude post-delay, and discarded capped ticks do not accumulate',()=>{
  const {b,run}=fixture({init_stack_cnt:4,danger_level_step_limit:'5|10|15'});
  b.stageWaveScheduler={wave:0,done:false,postUntil:null};run(150);assert.equal(b.stageDanger.level,5);
  b.stageWaveScheduler.postUntil=b.time+15;const elapsed=b.stageDanger.elapsed;run(15);near(b.stageDanger.elapsed,elapsed);
  b.stageWaveScheduler={wave:1,done:false,postUntil:null};run(49.9);assert.equal(b.stageDanger.level,5);
  run(.1);assert.equal(b.stageDanger.level,6);assert.equal(b.stageDanger.cap,10);
  b.stageWaveScheduler.done=true;run(100);assert.equal(b.stageDanger.level,6);assert.deepEqual(b.errors,[]);
});
test('danger observes the actual scheduler post-delay and next-wave transition',()=>{
  const {b,run}=fixture({init_stack_cnt:0,danger_level_step_limit:'5|10'});
  const s=b.stageWaveScheduler=new StageWaveScheduler(b,{schemaVersion:1,waves:[
    {preDelay:0,postDelay:15,maxWait:-1,fragments:[]},
    {preDelay:5,postDelay:0,maxWait:-1,fragments:[{preDelay:0,duration:100,spawns:[]}]}]});
  while(s.advance()){} assert.equal(s.postUntil,15);
  run(15);assert.equal(b.stageDanger.elapsed,0);
  while(s.advance()){} assert.equal(s.wave,1);assert.equal(s.postUntil,null);
  run(50);assert.equal(b.stageDanger.level,1);assert.equal(b.stageDanger.cap,10);
});
test('verified level admission rejects unreviewed mappings between danger limits and waves',async t=>{
  const root=await mkdtemp(join(tmpdir(),'danger-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'.cache/arkpedia/original-level-blobs'),{recursive:true});await mkdir(join(root,'data'));
  await writeFile(join(root,'data/arkpedia-environment-native-source.json'),JSON.stringify(native));
  const prepare=async count=>{
    const bytes=Buffer.from(JSON.stringify({globalBuffs:[environment({danger_level_step_limit:'5|10'})],waves:Array.from({length:count},()=>({}))}));
    const gitBlob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    const sha256=createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(root,'.cache/arkpedia/original-level-blobs',gitBlob+'.json'),bytes);
    return prepareStageEnvironments({root,rules:{source:{gitBlob,sha256}}});
  };
  assert.equal((await prepare(2)).environment[0].limits.length,2);
  await assert.rejects(prepare(3),/wave mapping/);
});
test('the environment component does not accidentally advertise complete Security Service mode support',async()=>{
  const context=await loadContentContext(),plan=await planStage(context,'lt-1_lt_01_01',{waves:true});
  assert.ok(plan.blockers.some(b=>b.kind==='mode'&&b.id==='climb_tower'));
  assert.equal(plan.blockers.some(b=>b.kind==='environment'),false);
});
