// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContentContext,planStage} from '../tools/arkpedia/content-inventory.mjs';
import {loadStageRuleReceipt} from '../tools/arkpedia/stage-rule-storage.mjs';
import {compileStageRules} from '../shared/arkpedia/stage-rules.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import normal from '../data/arkpedia-stage-le-ex-5.json' with {type:'json'};
import { fileURLToPath } from 'node:url';

test('LE-EX-5 Challenge adds exactly 1.3 ASPD points to scheduled and summoned enemies',async()=>{
 const c=await loadContentContext(),p=await planStage(c,'le-ex-5_challenge_mode');assert.deepEqual(p.blockers,[]);
 const s=p.stage,original=structuredClone(normal);
 assert.equal(s.rules.enemyAdd.aspd,1.3);assert.equal(s.rules.enemies.aspd,undefined);
 const battle=stage=>new StandardBattle({...c.mvp,stage,enemies:{...c.mvp.enemies,...stage.enemies}},
  {operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
 const b=battle(s),ordinary=battle(normal);
 for(const [id,r] of Object.entries(s.enemies)){
  assert.equal(r.stats.aspd,normal.enemies[id].stats.aspd+1.3,id);
  const e=b.spawnEnemy(id,{pos:[0,0]}),base=ordinary.spawnEnemy(id,{pos:[0,0]});
  assert.equal(e.s.aspd,base.s.aspd+1.3);assert.equal(e.s.bat,base.s.bat);
  assert.ok(Math.abs(e.s.interval-base.s.interval*base.s.aspd/(base.s.aspd+1.3))<1e-9);
 }
 assert.ok(s.enemies.enemy_1245_ltseal,'unscheduled child inherits the same global addition');
 assert.deepEqual(normal,original);assert.deepEqual(b.errors,[]);assert.deepEqual(ordinary.errors,[]);
});

test('additive ASPD preserves scope, signed fractions, and strict parameter validation',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const {receipt}=await loadStageRuleReceipt(root,'le-ex-5_challenge_mode');
 const source={id:receipt.stageId,variant:{kind:'challenge_mode',of_stage_id:receipt.parentStageId}};
 const r=structuredClone(receipt),rune=r.runes.find(r=>r.key==='enemy_attribute_add');
 rune.blackboard=[{key:'attack_speed',value:-2.5,valueStr:null},{key:'enemy',value:0,valueStr:'enemy_1244_ltmus_2'}];
 const compiled=compileStageRules(source,r);
 assert.deepEqual(compiled.enemyAdd,{});assert.deepEqual(compiled.enemyScopedAdd,{'enemy_1244_ltmus_2':{aspd:-2.5}});
 for(const value of [NaN,Infinity,'1.3']){
  const bad=structuredClone(r);bad.runes.find(r=>r.key==='enemy_attribute_add').blackboard[0].value=value;
  assert.throws(()=>compileStageRules(source,bad),/Invalid/);
 }
 const unknown=structuredClone(r);unknown.runes.find(r=>r.key==='enemy_attribute_add').blackboard[0].key='unreviewed_stat';
 assert.throws(()=>compileStageRules(source,unknown),/Unsupported additive/);
});
