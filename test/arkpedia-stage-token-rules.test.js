// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import normal from '../data/arkpedia-stage-of-ex6.json' with { type: 'json' };
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import tokenData from '../data/arkpedia-deployable-tokens.json' with { type: 'json' };
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { compileStage } from '../tools/arkpedia/build-stage.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const receipt = (await loadStageRuleReceipt(new URL('../', import.meta.url).pathname, 'of-ex6_challenge_mode')).receipt;
const source = { id: receipt.stageId, code: normal.code, name: normal.name, stage_type: 'activity', battle: normal.battle,
  variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } };
const compile = (rules = receipt, geometry = normal.geometry) => compileStage({ source, geometry, rules, mvp, records, support, tokenData });

test('OF-EX6 Challenge starts with six roadblocks, and consumes exactly those six without changing the normal stage', () => {
  const before = structuredClone(normal.geometry), stage = compile();
  assert.equal(stage.tokens[0].count, 6); assert.equal(stage.geometry.suppliedUnits.deployable_tokens[0].count, 6);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  assert.ok(b.bench.char_123_fang); assert.equal(b.mvpStageTokens.get('trap_001_crate'), 6);
  b.addDp('arkpedia', 99); b.autoFinish = false; b.life = 1e6;
  let placed = 0;
  for (let row = 0; row < b.grid.rows && placed < 6; row++) for (let col = 0; col < b.grid.cols && placed < 6; col++) {
    if (b.tokenPlacementError('trap_001_crate', row, col)) continue;
    b.deployToken('trap_001_crate', row, col); placed++;
    for (let i = 0; i < 155; i++) b.step();
  }
  assert.equal(placed, 6); assert.equal(b.mvpStageTokens.get('trap_001_crate'), 0);
  assert.throws(() => b.deployToken('trap_001_crate', 0, 0), /No tokens remaining|deployable ground/);
  assert.deepEqual(normal.geometry, before); assert.deepEqual(b.errors, []);
});

test('token count rules reject missing targets, invalid counts and unsupported operator selectors', () => {
  for (const [key, value] of [['value', -13], ['value', .5], ['char', 'char_123_fang'], ['char', 'trap_unknown']]) {
    const rules = structuredClone(receipt), bb = rules.runes.find(r => r.key === 'cbuff_token_initial_cnt').blackboard;
    if (key === 'value') bb[1].value = value; else bb[0].valueStr = value;
    assert.throws(() => compile(rules), /Invalid|Missing/);
  }
  const geometry = structuredClone(normal.geometry); geometry.suppliedUnits.deployable_tokens.push({ ...geometry.suppliedUnits.deployable_tokens[0] });
  assert.throws(() => compile(receipt, geometry), /ambiguous/);
  const zero = structuredClone(receipt); zero.runes.find(r => r.key === 'cbuff_token_initial_cnt').blackboard[1].value = -12;
  assert.equal(compile(zero).tokens[0].count, 0, 'retain a disabled card so later supply deliveries have an account');
});

test('the original class-wide 1-6 Challenge rune reduces Roadblock stock from five to one', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const context = await loadContentContext(), plan = await planStage(context, '1-6_challenge_mode');
  assert.deepEqual(plan.blockers, []); assert.equal(plan.stage.tokens[0].count, 1);
  assert.deepEqual(plan.stage.rules.tokenCountAdd, { '*': -4 });
  const rules = (await loadStageRuleReceipt(context.root, '1-6_challenge_mode')).receipt;
  const invalid = structuredClone(rules); invalid.runes.find(r => r.key === 'cbuff_token_initial_cnt').professionMask = 'PIONEER';
  const { compileStageRules } = await import('../shared/arkpedia/stage-rules.js');
  assert.throws(() => compileStageRules({ id: rules.stageId, battle: plan.stage.battle,
    variant: { kind: 'challenge_mode', of_stage_id: rules.parentStageId } }, invalid), /Invalid stage token/);
});


test('FA-5 Challenge removes its six Employee cards without changing the normal stage', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const { compileStageRules } = await import('../shared/arkpedia/stage-rules.js');
  const c = await loadContentContext(), normal = await planStage(c, 'fa-5'), challenge = await planStage(c, 'fa-5_challenge_mode');
  assert.deepEqual(challenge.blockers, []);
  assert.equal(normal.stage.tokens.find(t => t.unitId === 'trap_016_peon').count, 6);
  const card = challenge.stage.tokens.find(t => t.unitId === 'trap_016_peon'); assert.equal(card.count, 0);
  const b = new StandardBattle({ ...mvp, stage: challenge.stage, enemies: { ...mvp.enemies, ...challenge.stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  assert.equal(b.mvpStageTokens.get(card.unitId), 0);
  const { receipt } = await loadStageRuleReceipt(c.root, 'fa-5_challenge_mode');
  for (const mutate of [
    r => r.blackboard.find(x => x.key === 'value').value = -.5,
    r => r.blackboard.find(x => x.key === 'char').valueStr = 'char_123_fang',
    r => r.blackboard.splice(r.blackboard.findIndex(x => x.key === 'char'), 1),
  ]) {
    const changed = structuredClone(receipt); mutate(changed.runes.find(r => r.key === 'global_token_cnt_add'));
    assert.throws(() => compileStageRules({ id: receipt.stageId, variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } }, changed), /Invalid stage token/);
  }
});
