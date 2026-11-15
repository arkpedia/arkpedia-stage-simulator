// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { stageCharacterMultipliers } from '../shared/arkpedia/stage-character-attributes.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const c = await loadContentContext();
const make = (stage, ids = ['char_123_fang']) => {
 const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } }, { operators: ids.map(id => defaultBuild(c.mvp.operators[id])) });
 b.setViewport('fullscreen-workspace'); return b;
};
test('legacy character penalties share selectors and live stat modifiers across seven challenge stages', async () => {
 for (const [id,field,mask,position] of [['0-2','atk',1023,'ALL'],['0-8','maxHp',1023,'ALL'],['0-10','def',1023,'ALL'],
  ['3-5','atk',12,'ALL'],['4-2','def',1023,'ALL'],['4-5','maxHp',1023,'MELEE'],['5-1','atk',1023,'MELEE']]) {
  const p = await planStage(c,id+'_challenge_mode'); assert.deepEqual(p.blockers,[],id);
  assert.deepEqual(p.stage.rules.characterAttributes,[{professionMask:mask,buildableMask:position==='ALL'?3:1,multipliers:{[field]:.5}}]);
  const profession=mask===12?'MEDIC':'PIONEER';
  assert.deepEqual(stageCharacterMultipliers(p.stage.rules,{profession,position:'MELEE'}),{[field]:.5});
  if(mask===12) assert.deepEqual(stageCharacterMultipliers(p.stage.rules,{profession:'TANK',position:'MELEE'}),{},'source mask 12 means Medic + Supporter, despite translated description');
  if(position==='MELEE') assert.deepEqual(stageCharacterMultipliers(p.stage.rules,{profession,position:'RANGED'}),{});
  const op=Object.values(c.mvp.operators).find(o=>o.profession===profession);
  const b=make(p.stage,[op.id]); b.addDp('arkpedia',99);
  let tile;
  for(let r=b.rect.r0;r<=b.rect.r1&&!tile;r++)for(let col=b.rect.c0;col<=b.rect.c1;col++)
   if(!b.placementError(op.id,r,col)){tile=[r,col];break;}
  assert.ok(tile,id);const unit=b.deployOperator(op.id,...tile,'RIGHT');
  const reduced=unit.s[field]; assert.ok(unit.hp<=unit.s.maxHp);
  b.removeBuff(unit,'stage:characterAttributes');assert.equal(reduced,unit.s[field]*.5,id);
  assert.deepEqual(b.errors,[]);
 }
});
test('recovery multipliers change natural interval, not skill DP', async () => {
 for(const[id,scale]of [['9-13_challenge_mode',99999],['fd-1_challenge_mode',2],['sv-ex-2_challenge_mode',2]]){
  const p=await planStage(c,id);assert.deepEqual(p.blockers,[],id);
  assert.equal(p.stage.battle.dp_per_second,1/scale);assert.equal(p.stage.battle.dp_recovery_interval_seconds,scale);
  const b=make(p.stage),before=b.dp;for(let i=0;i<30;i++)b.step();
  assert.ok(Math.abs(b.dp-before-1/scale)<1e-8,id);
  const natural=b.dp;b.addDp('arkpedia',5);assert.equal(b.dp,natural+5,'skill DP is unaffected');
 }
});
test('legacy enemy weight additions use actual runtime weight without changing source stats',async()=>{
 for(const[id,weight]of [['2-8',2],['3-3',1]]){
  const normal=await planStage(c,id),p=await planStage(c,id+'_challenge_mode');assert.deepEqual(p.blockers,[],id);
  const b=make(p.stage);
  for(const[key,record]of Object.entries(normal.stage.enemies))assert.equal(b.spawnEnemy(key,{pos:[0,0]}).weight,record.stats.massLevel+weight);
 }
});
test('legacy declarations reject malformed values and keep unknown stats blocked',()=>{
 const compile=(key,blackboard,professionMask=1023)=>compileStageRules({id:'fixture',battle:{dp_per_second:1,dp_recovery_interval_seconds:1}},
  {schemaVersion:1,stageId:'fixture',source:{commit:'a'.repeat(40),sha256:'b'.repeat(64)},runes:[{key,blackboard,professionMask,buildableMask:'ALL',difficultyMask:'ALL'}]});
 for(const[key,bb]of [['cbuff_attribute',[{key:'attack_speed',value:.5}]],['cbuff_initial_cost',[{key:'cost',value:1.5}]],
  ['global_cost_recovery_mul',[{key:'scale',value:0}]],['ebuff_weight',[{key:'value',value:1.5}]]])assert.throws(()=>compile(key,bb),/Unsupported|Invalid/);
});
