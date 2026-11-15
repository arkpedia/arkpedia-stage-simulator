// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { applyStageEnemySkillRadius } from '../shared/arkpedia/stage-enemy-talents.js';
import receipt from '../data/stage-rules/6-15_challenge_mode.json' with { type: 'json' };
const id = 'enemy_1070_iced';
const source = { id: receipt.stageId, variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } };
test('6-15 Challenge scopes the original skill-radius rule independently of attack radius and enemy stats', () => {
  const rules = compileStageRules(source, receipt);
  assert.deepEqual(rules.enemySkillRadiusScoped, { [id]: .9 });
  assert.deepEqual(rules.enemyScoped[id], { maxHp: 2, def: 2 });
  assert.equal(rules.enemies.rangeRadius, undefined);
  const original = ENEMY_RECORDS.enemies[id].levels[0], record = applyStageEnemySkillRadius(original, .9);
  assert.equal(record.stats.rangeRadius, 2.5); assert.equal(original.stageSkillRadiusScale, undefined);
  assert.throws(() => applyStageEnemySkillRadius(ENEMY_RECORDS.enemies.enemy_1040_bombd.levels[0], .9), /Unsupported/);
  for (const scale of [0, -1, Infinity, 11]) assert.throws(() => applyStageEnemySkillRadius(original, scale), /Unsupported/);
});
test('Oneiros requires a target within the scaled 2.25 range but retains the 3x3 impact and Cold', () => {
  const record = structuredClone(applyStageEnemySkillRadius(ENEMY_RECORDS.enemies[id].levels[0], .9)); record.stats.moveSpeed = 0;
  const guard = chessRec({ id: 'radius_target', stats: {maxHp:100000,atk:0,res:0}, skill:null });
  const h = makeBattle({ content:'none', autoFinish:false, timeLimit:30,
    defs:{chess:{[guard.chessId]:guard},enemies:{[id]:record}},
    units:[6,7].map(col=>({chessId:guard.chessId,row:9,col})), setup:installEnemyFeatures });
  const b=h.b; b.start(); const [target, side]=b.allyUnits;
  for(const u of b.allyUnits)b.addBuff(u,{key:'stationary',flags:{noMove:true,disarm:true}});
  const e=b.spawnEnemy(id,{pos:[9,5]}); target.x=7.4; side.x=8.2;
  const cast=e.mem.ab.list.find(a=>a.fire),hits=[];b.on('damaged',c=>{if(c.source===e)hits.push(c)});
  h.run(5.2);assert.equal(cast.casts??0,0);assert.equal(e.base.rangeRadius,2.5);
  target.x=7.2;h.run(2);
  assert.equal(cast.casts,1);assert.deepEqual(new Set(hits.map(c=>c.target)),new Set([target,side]));
  assert.ok(hits.every(c=>c.dmg.type==='arts'));assert.ok(target.s.flags.cold);assert.ok(side.s.flags.cold);assert.deepEqual(b.errors,[]);
});
