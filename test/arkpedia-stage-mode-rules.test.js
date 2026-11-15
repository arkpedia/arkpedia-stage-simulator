// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStageModeRules, validateStageModeRules } from '../shared/arkpedia/stage-mode-rules.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const context = await loadContentContext();
const id = 'isw-df_level_obt_roguelike_ro1_level_rogue1_b-3';
const plan = await planStage(context, id, { waves: true });
const data = { ...context.mvp, stage: plan.stage, enemies: { ...context.mvp.enemies, ...plan.stage?.enemies } };

test('an individual IS stage is compiled through shared capability checks', () => {
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(plan.stage.mode, { kind: 'integrated_strategies', scope: 'individual-stage' });
  assert.ok(plan.stage.waveProgram);
});

test('mode values validate atomically; unknown relics, nonfinite values and invalid budgets are refused', () => {
  for (const rules of [{ relicId: 'invented' }, { life: 0 }, { deploymentLimit: 2.5 }, { initialDp: 1000 },
    { dpRate: NaN }, { enemyHp: -1 }, { enemyDef: Infinity }, { life: '20' }])
    assert.throws(() => validateStageModeRules(plan.stage, rules), /mode rule|DP capacity/);
  assert.throws(() => applyStageModeRules({ ...data, stage: { ...plan.stage, mode: undefined } }, { life: 5 }), /does not support/);
});

test('mode configuration leaves cached stage graphs and enemy definitions untouched across battles', () => {
  const enemy = Object.keys(plan.stage.enemies)[0], before = structuredClone(data.enemies[enemy]);
  const a = applyStageModeRules(data, { life: 7, initialDp: 30, deploymentLimit: 9, dpRate: 0, enemyHp: 2, enemyAtk: 1.5, enemyDef: 0 });
  assert.equal(a.stage.battle.max_life, 7); assert.equal(a.stage.battle.initial_dp, 30);
  assert.equal(a.enemies[enemy].stats.maxHp, before.stats.maxHp * 2);
  assert.equal(a.enemies[enemy].stats.atk, before.stats.atk * 1.5); assert.equal(a.enemies[enemy].stats.def, 0);
  assert.deepEqual(data.enemies[enemy], before); assert.equal(data.stage.battle.max_life, 100);
  const b = applyStageModeRules(data, {}); assert.deepEqual(b.enemies[enemy], before); assert.equal(b.stage.battle.max_life, 100);
});

test('a real mode battle applies chosen budgets, DP rate and enemy stats without changing its source program', () => {
  const options = { life: 9, initialDp: 23, deploymentLimit: 4, dpRate: 0, enemyHp: 2, enemyAtk: 1.5, enemyDef: 0.5 };
  const b = new StandardBattle(data, { operators: [defaultBuild(data.operators.char_123_fang)], modeRules: options });
  b.setViewport('fullscreen-workspace'); let first;
  b.on('enemySpawn', ({ enemy }) => { first ??= enemy; });
  for (let i = 0; i < 900 && !first && !b.finished; i++) b.step();
  assert.ok(first); assert.equal(b.dp, 23); assert.equal(b.unitLimit, 4); assert.equal(b.life, 9);
  assert.equal(first.base.maxHp, data.enemies[first.defId].stats.maxHp * 2);
  assert.equal(first.base.atk, data.enemies[first.defId].stats.atk * 1.5);
  assert.equal(first.base.def, data.enemies[first.defId].stats.def * 0.5);
  assert.equal(b.modeRules.dpRate, 0); assert.deepEqual(b.errors, []);
  assert.equal(data.stage.battle.initial_dp, 10);
});
