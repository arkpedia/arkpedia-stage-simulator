// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import native from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { compileStageEnvironments, environmentNativeReviewed } from '../shared/arkpedia/stage-environments.js';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
const poison = { kind: 'periodic_damage', damage: 25, interval: .5 };
function instance(key, bb) {
  return { prefabKey: key, blackboard: Object.entries(bb).map(([key,value]) => ({key,value,valueStr:null})),
    overrideCameraEffect:null, passProfessionMaskFlag:false, professionMask:'NONE', playerSideMask:'ALL' };
}
function fixture(environments = [poison]) {
  const op = chessRec({id:'environment_target', stats:{atk:0}, skill:{spType:'INCREASE_WHEN_TAKEN_DAMAGE'}});
  const enemy = enemyRec({speed:0});
  const h = makeBattle({content:'generic', autoFinish:false, defs:{chess:{[op.chessId]:op}, enemies:{[enemy.key]:enemy}},
    players:[{playerId:'arkpedia',side:'L',units:[{chessId:op.chessId,row:10,col:7}]}],
    setup:b=>installStageEnvironments(b,environments)});
  h.b.start(); return {...h,u:h.allies()[0]};
}
test('original environment instances compile only reviewed native selectors and parameters', () => {
  assert.deepEqual(compileStageEnvironments([instance('periodic_damage',{damage:25,interval:.5})]),[poison]);
  assert.deepEqual(compileStageEnvironments([instance('kill_to_add_cost',{cost:3})]),[{kind:'kill_to_add_cost',cost:3}]);
  assert.deepEqual(compileStageEnvironments(null),[]);
  for (const bad of [instance('future_mode',{}),instance('periodic_damage',{damage:25,interval:0}),
    instance('kill_to_add_cost',{cost:3,other:1}), {...instance('kill_to_add_cost',{cost:3}), passProfessionMaskFlag:1}])
    assert.throws(()=>compileStageEnvironments([bad]),/environment/i);
  const changed = structuredClone(native); changed.prefabs.periodic_damage[0].data._options.targetMotion=1;
  assert.equal(environmentNativeReviewed('periodic_damage',changed),false);
  const changedDamage = structuredClone(native); changedDamage.templates.periodic_damage.eventToActions.ON_BUFF_TRIGGER[0]._ignoreForSp=false;
  assert.equal(environmentNativeReviewed('periodic_damage',changedDamage),false);
});
test('poison waits its first interval, ignores DEF/RES, grants no damage SP and continues through disable statuses', () => {
  const {b,u,run} = fixture(); const hp=u.hp;
  b.addBuff(u,{key:'armour',mods:{defFlat:10000,resFlat:100}});
  b.applyStatus(u,'stun',{duration:5});b.applyStatus(u,'silence',{duration:5});
  run(.4);assert.equal(u.hp,hp); run(.1);assert.equal(u.hp,hp-25);
  run(1);assert.equal(u.hp,hp-75);assert.equal(u.skill.sp,0);assert.deepEqual(b.errors,[]);
});
test('poison reaches flying allies and tokens, excludes enemies/devices, and respects environment protection', () => {
  const {b,u,run} = fixture();u.motion='FLY';const hp=u.hp;
  const e=b.spawnEnemy('enemy_test',{pos:[10,3]});run(.5);assert.equal(u.hp,hp-25);assert.equal(e.hp,e.s.maxHp);
  u.kind='token';run(.5);assert.equal(u.hp,hp-50);
  b.on('hit',ctx=>{if(ctx.target===u&&ctx.dmg.isEnvironment)ctx.dmg.cancel=true;});run(.5);assert.equal(u.hp,hp-50);
  const other=fixture([]);other.u.kind='device';
  delete other.b.stageEnvironments;installStageEnvironments(other.b,[poison]);other.run(1);
  assert.equal(other.u.hp,other.u.s.maxHp);assert.equal(other.u.findBuff('stage:environment:0'),null);
});
test('kill DP rewards actual enemy deaths once, including summoned enemies, but never leaks or allied deaths', () => {
  const {b,u}=fixture([{kind:'kill_to_add_cost',cost:3}]);b.getPlayer('arkpedia').dp=10;
  const killed=b.spawnEnemy('enemy_test',{pos:[10,3]});b.kill(killed);assert.equal(b.getPlayer('arkpedia').dp,13);
  b.kill(killed);assert.equal(b.getPlayer('arkpedia').dp,13);
  const child=b.spawnEnemy('enemy_test',{pos:[10,3],countInTotal:false});b.kill(child);assert.equal(b.getPlayer('arkpedia').dp,16);
  b.leak(b.spawnEnemy('enemy_test',{pos:[10,3]}));b.kill(u);assert.equal(b.getPlayer('arkpedia').dp,16);
  b.getPlayer('arkpedia').dp=99;b.kill(b.spawnEnemy('enemy_test',{pos:[10,3]}));assert.equal(b.getPlayer('arkpedia').dp,99);
  assert.deepEqual(b.errors,[]);
});
test('StandardBattle installs compiled environments and starts a fresh poison clock after redeployment', () => {
  const id='char_123_fang',stage=structuredClone(mvp.stage);stage.waves=[];stage.geometry.waves=[];stage.environment=[poison];
  const b=new StandardBattle({...mvp,stage},{operators:[defaultBuild(mvp.operators[id])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const advance=n=>{for(let i=0;i<n;i++)b.step();};
  const u=b.deployOperator(id,2,7,'RIGHT');assert.ok(u);advance(10);assert.equal(u.hp,u.s.maxHp);
  b.retreatOperator(id);b.bench[id].readyAt=0;b.addDp('arkpedia',99);
  const v=b.deployOperator(id,2,7,'RIGHT');assert.ok(v);advance(10);assert.equal(v.hp,v.s.maxHp);
  advance(5);assert.equal(v.hp,v.s.maxHp-25);assert.deepEqual(b.errors,[]);
});

test('FA-1 challenge replaces the base poison with 15 damage, without stacking both environments', async () => {
  const context = await loadContentContext();
  const plan = await planStage(context,'fa-1_challenge_mode');
  assert.deepEqual(plan.blockers,[]);
  assert.deepEqual(plan.stage.environment,[{kind:'periodic_damage',damage:15,interval:.5}]);
  assert.ok(plan.localSources.some(s=>s.path==='data/arkpedia-environment-native-source.json'));
});

test('LE-EX-2 retains its stronger connected SP recovery bonus as a stage parameter',async()=>{
 const context=await loadContentContext(),plan=await planStage(context,'le-ex-2');
 assert.deepEqual(plan.blockers,[]);
 assert.deepEqual(plan.stage.environment,[{kind:'character_in_magiccircuit_env','sp_recover_ratio':-.5,'character_in_magiccircuit[normal].sp_recover_ratio':1.5}]);
 const h=fixture([]);delete h.b.stageEnvironments;h.b.stageMagicCircuit={contains:()=>true};
 installStageEnvironments(h.b,plan.stage.environment);assert.equal(h.u.s.spRecovery,2);
});
