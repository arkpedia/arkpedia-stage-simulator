// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {applyStageEnemyTalentMultipliers,applyStageEnemySkillMultipliers} from '../shared/arkpedia/stage-enemy-talents.js';
import {rotEaterNative} from '../shared/arkpedia/enemy-rot-eater-features.js';
import {witherTankNative} from '../shared/arkpedia/enemy-wither-tank-features.js';
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {SkillRuntime} from '../server/sim/skills.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
const rot='enemy_1266_nhapos',tank='enemy_1272_nhtank';
const original=id=>records.enemies[id].levels[0];
const scaled=id=>id===rot?applyStageEnemyTalentMultipliers(original(id),{
 'PollutedArea.Polluted_damage_low':2,'PollutedArea.Polluted_damage_high':2,
}):applyStageEnemySkillMultipliers(original(id),{PollutedRangedAtk:{polluted_damage_low:2,polluted_damage_high:2}});
function fixture(id,compiled){
 const record=scaled(id);record.stats.moveSpeed=0;
 const op=chessRec({id:'scaled_corruption_target',stats:{atk:0,maxHp:1e6,def:0,blockCnt:0},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(record):record},chess:{[op.chessId]:op}},
  units:[{chessId:op.chessId,row:9,col:7},{chessId:op.chessId,row:10,col:7}],setup:installEnemyFeatures,
  kits:{[op.chessId]:()=>({trait:{noAttack:true}})}});
 h.b.start();const low=h.b.allyUnits[0],high=h.b.allyUnits[1];
 h.b.grid.setTile(10,7,{...h.b.grid.tile(10,7),height:'HIGH'});
 low.skill=new SkillRuntime(h.b,low,null,{spType:'hurt',spCost:10,trigger:'NEVER'});
 const hits=[];h.b.on('damaged',c=>{if(c.dmg.tags?.includes('corruption'))hits.push({target:c.target,amount:c.hpLoss,noSp:c.dmg.noSp});});
 const source=h.b.spawnEnemy(id,{pos:[9,id===rot?7:6]});if(id===rot)source.profile.noAttack=true;
 return{...h,low,high,source,hits};
}
for(const id of[rot,tank])test(`${id}: stage-scaled fixed damage reaches both root tile heights through raw and compiled plans`,()=>{
 const before=structuredClone(original(id));
 for(const compiled of[false,true]){
  const f=fixture(id,compiled);f.run(id===rot?1.1:1.7);
  assert.deepEqual(f.hits.filter(h=>h.target===f.low).map(h=>h.amount),[100]);
  assert.deepEqual(f.hits.filter(h=>h.target===f.high).map(h=>h.amount),[50]);
  assert.ok(f.hits.every(h=>h.noSp));
  if(id===rot)assert.equal(f.low.skill.sp,0);
  assert.deepEqual(f.b.errors,[]);
 }
 assert.deepEqual(original(id),before);
});
test('pollution remains fixed damage over low ground for an airborne recipient and stops with its aura owner',()=>{
 const f=fixture(rot,true);f.low.motion='FLY';f.source.base.atk=123456;f.source.markDirty();f.low.base.magicResistance=99;f.low.markDirty();
 f.run(1.1);assert.equal(f.hits.find(h=>h.target===f.low).amount,100);
 f.b.kill(f.source);const count=f.hits.length;f.run(2);assert.equal(f.hits.length,count);
 assert.deepEqual(f.b.errors,[]);
});
test('only the reviewed pollution damage slots can scale; shapes, clocks, stat floors and spawn identities stay guarded',()=>{
 for(const key of['PollutedArea.range_Radius','PollutedArea.max_percentage','PollutedArea.guaranteed_percentage','unknown'])
  assert.throws(()=>applyStageEnemyTalentMultipliers(original(rot),{[key]:2}),/Unsupported enemy talent multiplier/);
 for(const key of['projectile_life_time','projectile_delay_time','range_radius','unknown'])
  assert.throws(()=>applyStageEnemySkillMultipliers(original(tank),{PollutedRangedAtk:{[key]:2}}),/Unsupported enemy skill multiplier/);
 for(const value of[-1,NaN,Infinity]){
  assert.throws(()=>applyStageEnemyTalentMultipliers(original(rot),{'PollutedArea.Polluted_damage_low':value}));
  assert.throws(()=>applyStageEnemySkillMultipliers(original(tank),{PollutedRangedAtk:{polluted_damage_low:value}}));
 }
});
test('both families reject changed native root-height selection, damage type, SP credit or extra template actions',()=>{
 for(const edit of[
  branch=>branch._conditionNode._heightType='HIGHLAND',
  branch=>branch._succeedNodes[0]._damageType='MAGICAL',
  branch=>branch._failNodes[0]._ignoreForSp=false,
  branch=>branch._failNodes.push(structuredClone(branch._failNodes[0])),
 ]){
  const changed=structuredClone(evidence);edit(changed.templates.polluted_area.eventToActions.ON_BUFF_TRIGGER[0]);
  assert.equal(rotEaterNative(scaled(rot),nativeComponents(changed,rot)),false);
  assert.equal(witherTankNative(scaled(tank),nativeComponents(changed,tank)),false);
 }
});
test('all six original adverse levels compile their own doubled pollution without mutating the normal catalogue',async()=>{
 const context=await loadContentContext(),before=structuredClone(context.records.enemies[rot]);
 for(const id of['11-7_adverse_environment','11-8_adverse_environment','11-12_adverse_environment','11-15_adverse_environment',
  'h11-1_adverse_environment','h11-3_adverse_environment']){
  const row=await planStage(context,id,{waves:true});assert.deepEqual(row.blockers,[],id);assert.ok(row.stage,id);
  const source=Object.values(row.stage.enemies).find(r=>r.prefabKey.startsWith(id.startsWith('h')?tank:rot));assert.ok(source,id);
  if(id.startsWith('h'))assert.deepEqual([source.skills[0].bb.polluted_damage_low,source.skills[0].bb.polluted_damage_high],[100,50]);
  else assert.deepEqual([source.talents.bb['PollutedArea.Polluted_damage_low'],source.talents.bb['PollutedArea.Polluted_damage_high']],[100,50]);
 }
 assert.deepEqual(context.records.enemies[rot],before);
});
