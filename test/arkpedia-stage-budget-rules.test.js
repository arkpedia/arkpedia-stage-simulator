// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const rule = key => ({ key, difficultyMask: 'FOUR_STAR', professionMask: 1023, buildableMask: 'ALL' });
const receiptFor = async id => (await loadStageRuleReceipt(root, id)).receipt;
const sourceFor = receipt => ({ id: receipt.stageId, variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId },
  battle: { ...mvp.stage.battle } });

test('the legacy R8-10 deployment-limit rune subtracts three from the original capacity', async () => {
  const receipt = await receiptFor('r8-10_challenge_mode'), source = sourceFor(receipt);
  source.battle.unit_limit = 8;
  assert.equal(compileStageRules(source, receipt).battle.unit_limit, 5);
  const bad = structuredClone(receipt); bad.runes.find(r => r.key === 'gbuff_placable_char_num').blackboard[0].value = -9;
  assert.throws(() => compileStageRules(source, bad), /Invalid stage budget/);
});

test('4-4 accepts only the original neutral map_hp typo while applying its doubled movement', async () => {
  const receipt = await receiptFor('4-4_challenge_mode'), source = sourceFor(receipt);
  const rules = compileStageRules(source, receipt);
  assert.equal(rules.enemies.moveSpeed, 2); assert.equal(rules.enemies.maxHp, undefined);
  receipt.runes.find(r => r.key === 'ebuff_attribute').blackboard.find(p => p.key === 'map_hp').value = 2;
  assert.throws(() => compileStageRules(source, receipt), /Unsupported enemy rune attribute/);
});
function battle(config) {
  const data = { ...mvp, stage: { ...mvp.stage, battle: { ...mvp.stage.battle, ...config } } };
  return new StandardBattle(data, { operators: ['char_123_fang', 'char_240_wyvern'].map(id => defaultBuild(mvp.operators[id])) });
}

test('FA-3 Challenge reduces actual deployment capacity by one without changing ordinary difficulty', async () => {
  const receipt = await receiptFor('fa-3_challenge_mode'), source = sourceFor(receipt);
  source.battle.unit_limit = 2;
  const compiled = compileStageRules(source, receipt), b = battle(compiled.battle);
  assert.equal(b.unitLimit, 1); b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  let placed = false;
  for (let row = 0; row < b.grid.rows && !placed; row++) for (let col = 0; col < b.grid.cols && !placed; col++)
    if (!b.placementError('char_123_fang', row, col)) { b.deployOperator('char_123_fang', row, col, 'RIGHT'); placed = true; }
  assert.ok(placed); assert.equal(b.placementError('char_240_wyvern', 0, 0), 'Deployment limit reached.');
  b.retreatOperator('char_123_fang'); assert.equal(b.deployedSlots(), 0);
  const normal = { ...receipt, stageId: receipt.parentStageId }; delete normal.parentStageId;
  assert.equal(compileStageRules({ id: normal.stageId, battle: source.battle }, normal).battle.unit_limit, undefined);
  assert.equal(source.battle.unit_limit, 2); assert.deepEqual(b.errors, []);
});

test('OF-EX5 Challenge stretches the natural DP interval to three seconds without scaling direct DP grants', async () => {
  const receipt = await receiptFor('of-ex5_challenge_mode'), source = sourceFor(receipt);
  source.battle.dp_per_second = 1; source.battle.dp_recovery_interval_seconds = 1;
  const compiled = compileStageRules(source, receipt);
  assert.equal(compiled.battle.dp_per_second, 1 / 3); assert.equal(compiled.battle.dp_recovery_interval_seconds, 3);
  const b = battle(compiled.battle), before = b.dp;
  for (let i = 0; i < 90; i++) b.step();
  assert.ok(Math.abs(b.dp - before - 1) < 1e-6);
  b.addDp('arkpedia', 8); assert.ok(Math.abs(b.dp - before - 9) < 1e-6);
  assert.equal(b.dpRecoveryRateFor('arkpedia'), 1 / 3); assert.deepEqual(b.errors, []);
});

test('initial DP additions compose and reject unsupported masks, fractional counts and invalid resulting budgets', async () => {
  const receipt = await receiptFor('fa-3_challenge_mode'), source = sourceFor(receipt);
  source.battle.initial_dp = 10;
  receipt.runes = [25, -5].map(value => ({ ...rule('global_initial_cost_add'), blackboard: [{ key: 'value', value, valueStr: null }] }));
  assert.equal(battle(compileStageRules(source, receipt).battle).dp, 30);
  for (const change of [r => r.runes[0].professionMask = 1, r => r.runes[0].blackboard[0].value = .5,
    r => r.runes[0].blackboard[0].value = -50, r => r.runes[0].blackboard.push({ key: 'unknown', value: 1 })]) {
    const bad = structuredClone(receipt); change(bad);
    assert.throws(() => compileStageRules(source, bad), /Unsupported|Invalid/);
  }
});

test('0-6 Challenge adds its cbuff_initial_cost to the starting DP (8 + 3 = 11, checked in game)', async () => {
  const receipt = await receiptFor('0-6_challenge_mode'), source = sourceFor(receipt);
  source.battle.initial_dp = 8;
  const compiled = compileStageRules(source, receipt);
  assert.equal(compiled.battle.initial_dp, 11);
  assert.equal(battle(compiled.battle).dp, 11);
  for (const change of [r => r.blackboard[0].value = .5, r => r.blackboard[0].key = 'value', r => r.blackboard[0].value = 0,
    r => r.blackboard.push({ key: 'scale', value: 1, valueStr: null }), r => r.professionMask = 1]) {
    const bad = structuredClone(receipt); change(bad.runes.find(r => r.key === 'cbuff_initial_cost'));
    assert.throws(() => compileStageRules(source, bad), /Unsupported|Invalid/);
  }
});
