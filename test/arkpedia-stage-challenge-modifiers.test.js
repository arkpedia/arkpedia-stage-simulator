// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { compileStageRules, stageEnemyKey } from '../shared/arkpedia/stage-rules.js';
import { excludedStageOperators, stageSquadLimit } from '../shared/arkpedia/stage-roster.js';
import { stageAdapter } from '../server/sim/arkpedia.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
const context = await loadContentContext();
test('6-12, 7-17 and SA-6 challenge receipts compile their device, profession and total-squad rules', async () => {
  const plans = await Promise.all(['6-12_challenge_mode', '7-17_challenge_mode', 'sa-6_challenge_mode'].map(id => planStage(context, id)));
  for (const p of plans) { assert.deepEqual(p.blockers, []); assert.equal(p.stage.battle.max_life, 1); }
  assert.deepEqual(plans[0].stage.rules.deviceSkillCost, { trap_010_frosts: .5 });
  assert.equal(plans[1].stage.battle.excluded_profession_mask, 33);
  for (const id of excludedStageOperators(plans[1].stage, context.mvp.operators))
    assert.ok(['CASTER', 'TANK'].includes(context.mvp.operators[id].profession));
  assert.equal(stageSquadLimit(plans[2].stage), 10);
});
test('BW-3 challenge replaces wave enemies without rewriting shared geometry, routes or timings', async () => {
  const normal = await planStage(context, 'bw-3'), challenge = await planStage(context, 'bw-3_challenge_mode');
  assert.deepEqual(challenge.blockers, []);
  const from = 'enemy_1075_dmgswd_2', to = 'enemy_1074_dbskar';
  assert.deepEqual(challenge.stage.rules.enemyReplacements, { [from]: to });
  const original = stageAdapter(normal.stage).spawns, changed = stageAdapter(challenge.stage).spawns;
  assert.ok(original.some(s => s.enemyKey === from));
  assert.deepEqual(changed, original.map(s => ({ ...s, enemyKey: s.enemyKey === from ? to : s.enemyKey })));
  assert.equal(challenge.stage.enemies[from], undefined); assert.ok(challenge.stage.enemies[to]);
  assert.deepEqual(challenge.stage.geometry.waves, normal.stage.geometry.waves);
  assert.equal(challenge.dependencies.enemies.includes(from), false);
  assert.doesNotThrow(() => assertRegularEnemies({ stage: challenge.stage, enemies: challenge.stage.enemies }));
  const missing = structuredClone(challenge.stage); delete missing.enemies[to];
  assert.throws(() => assertRegularEnemies({ stage: missing, enemies: missing.enemies }), /Missing supported/);
  assert.equal(stageEnemyKey({ enemyReplacements: { a: 'b', b: 'c' } }, 'a'), 'b', 'one replacement, not a chain');
});
test('new modifier declarations reject unknown device mechanics, malformed replacement and invalid masks/caps', () => {
  const rune = (key, blackboard, professionMask = 1023) => ({ key, difficultyMask: 'ALL', professionMask, buildableMask: 'ALL', blackboard });
  const compile = rule => compileStageRules({ id: 'fixture' }, { schemaVersion: 1, stageId: 'fixture',
    source: { commit: 'a'.repeat(40), sha256: 'b'.repeat(64) }, runes: [rule] });
  for (const rule of [rune('char_skill_cd_mul', [{ key: 'char', value: 0, valueStr: 'trap_unknown' }, { key: 'scale', value: .5 }]),
    rune('char_exclude', [], 0), rune('global_squad_num_limit', [{ key: 'value', value: 0 }]),
    rune('level_enemy_replace', [{ key: 'key', value: 0, valueStr: 'enemy_a' }, { key: 'value', value: 0, valueStr: 'enemy_a' }])])
    assert.throws(() => compile(rule), /Unsupported|Invalid/);
});
