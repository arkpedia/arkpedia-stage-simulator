// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
import {loadStageRuleReceipt} from '../tools/arkpedia/stage-rule-storage.mjs';
import {compileStageRules} from '../shared/arkpedia/stage-rules.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import normal from '../data/arkpedia-stage-bh-4.json' with {type:'json'};
test('BH-4 Challenge scopes Crownslayer weight and Skullshatterer HP on top of the global challenge modifiers',async()=>{
 const c=await loadContentContext(),p=await planStage(c,'bh-4_challenge_mode');assert.deepEqual(p.blockers,[]);
 const s=p.stage,b=new StandardBattle({...c.mvp,stage:s,enemies:{...c.mvp.enemies,...s.enemies}},
  {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
 assert.equal(b.life,1);assert.deepEqual(s.rules.enemyScopedAdd,{enemy_1502_crowns:{massLevel:4}});
 for(const [id,record]of Object.entries(s.enemies)){
  const unit=b.spawnEnemy(id,{pos:[0,0]});assert.equal(unit.weight,normal.enemies[id].stats.massLevel+(id==='enemy_1502_crowns'?4:0),id);
  assert.ok(Math.abs(record.stats.maxHp-normal.enemies[id].stats.maxHp*1.1*(id==='enemy_1500_skulsr'?2:1))<1e-6,id);
 }
 assert.deepEqual(b.errors,[]);
});
test('global and scoped weight additions compose while malformed selectors remain blocked',async()=>{
 const {receipt}=await loadStageRuleReceipt(new URL('../',import.meta.url).pathname,'bh-4_challenge_mode');
 const source={id:receipt.stageId,variant:{kind:'challenge_mode',of_stage_id:receipt.parentStageId}};
 const r=structuredClone(receipt),weight=r.runes.find(r=>r.key==='enemy_weight_add');
 r.runes.push({...weight,blackboard:[{key:'value',value:2,valueStr:null}]});
 const compiled=compileStageRules(source,r);assert.equal(compiled.enemyAdd.massLevel,2);assert.deepEqual(compiled.enemyScopedAdd,{enemy_1502_crowns:{massLevel:4}});
 for(const selector of ['enemy_.*','enemy_1502_crowns|enemy_1502_crowns','']){
  const bad=structuredClone(r);bad.runes.find(r=>r.key==='enemy_weight_add').blackboard.find(x=>x.key==='enemy').valueStr=selector;
  assert.throws(()=>compileStageRules(source,bad),/enemy targeting/);
 }
 const fractional=structuredClone(r);fractional.runes.find(r=>r.key==='enemy_weight_add').blackboard.find(x=>x.key==='value').value=1.5;
 assert.throws(()=>compileStageRules(source,fractional),/Unsupported stage rune/);
});
