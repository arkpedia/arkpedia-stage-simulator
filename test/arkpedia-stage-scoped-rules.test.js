// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../data/stage-rules/iw-ex-2_challenge_mode.json' with { type: 'json' };
import normal from '../data/arkpedia-stage-iw-ex-2.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { compileStage } from '../tools/arkpedia/build-stage.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const source = { id: receipt.stageId, code: normal.code, name: normal.name, stage_type: 'activity', battle: normal.battle,
  variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } };
const compile = rules => compileStage({ source, geometry: normal.geometry, rules, mvp, records, support, tokenData: { tokens: {} } });

test('IW-EX-2 Challenge strengthens only the four listed parents, preserving their death-spawned fragments', () => {
  const before = structuredClone(normal), stage = compile(receipt);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  assert.equal(b.life, 1);
  const targets = Object.keys(stage.rules.enemyScoped); assert.equal(targets.length, 4);
  for (const [id, record] of Object.entries(stage.enemies)) {
    const changed = targets.includes(id);
    for (const [key, multiplier] of Object.entries({ maxHp: 1.5, atk: 1.1, def: 1.1 }))
      assert.ok(Math.abs(record.stats[key] - normal.enemies[id].stats[key] * (changed ? multiplier : 1)) < 1e-6, `${id}.${key}`);
  }
  const parent = b.spawnEnemy('enemy_1199_sfjin_2', { pos: [2, 5] });
  assert.equal(parent.s.maxHp, normal.enemies.enemy_1199_sfjin_2.stats.maxHp * 1.5);
  b.kill(parent, null);
  const child = b.enemies.find(e => e.defId === 'enemy_1200_msfjin_2');
  assert.ok(child); assert.equal(child.s.maxHp, normal.enemies.enemy_1200_msfjin_2.stats.maxHp);
  assert.deepEqual(b.errors, []); assert.deepEqual(normal, before);
});

test('global and scoped multipliers compose without affecting another identity', () => {
  const r = structuredClone(receipt);
  r.runes.push({ ...r.runes[1], blackboard: [{ key: 'max_hp', value: 2, valueStr: null }] });
  const s = compile(r);
  assert.equal(s.enemies.enemy_1199_sfjin_2.stats.maxHp, normal.enemies.enemy_1199_sfjin_2.stats.maxHp * 3);
  assert.equal(s.enemies.enemy_1200_msfjin_2.stats.maxHp, normal.enemies.enemy_1200_msfjin_2.stats.maxHp * 2);
});

test('enemy selectors reject patterns, duplicates, malformed values and unknown source records', () => {
  for (const valueStr of ['enemy_.*', 'enemy_1199_sfjin_2|', 'enemy_1199_sfjin_2|enemy_1199_sfjin_2', '', null]) {
    const r = structuredClone(receipt); r.runes[1].blackboard.at(-1).valueStr = valueStr;
    assert.throws(() => compileStageRules(source, r), /enemy targeting/);
  }
  const wrong = structuredClone(receipt); wrong.runes[1].blackboard.at(-1).value = 1;
  assert.throws(() => compileStageRules(source, wrong), /enemy targeting/);
  const unknown = structuredClone(receipt); unknown.runes[1].blackboard.at(-1).valueStr = 'enemy_unknown_fixture';
  assert.throws(() => compile(unknown), /Unknown enemy in stage rule/);
});

test('OF-EX3 Challenge doubles actual enemy ASPD without changing base attack time or ordinary difficulty', async () => {
  const { loadStageRuleReceipt } = await import('../tools/arkpedia/stage-rule-storage.mjs');
  const { default: base } = await import('../data/arkpedia-stage-of-ex3.json', { with: { type: 'json' } });
  const rules = (await loadStageRuleReceipt(new URL('../', import.meta.url).pathname, 'of-ex3_challenge_mode')).receipt;
  const variant = { id: rules.stageId, code: base.code, name: base.name, stage_type: 'activity', battle: base.battle,
    variant: { kind: 'challenge_mode', of_stage_id: rules.parentStageId } };
  const stage = compileStage({ source: variant, geometry: base.geometry, rules, mvp, records, support, tokenData: { tokens: {} } });
  const battle = data => new StandardBattle({ ...mvp, stage: data, enemies: { ...mvp.enemies, ...data.enemies } },
    { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  const b = battle(stage), ordinary = battle(base);
  for (const id of Object.keys(stage.enemies)) {
    const unit = b.spawnEnemy(id, { pos: [0, 0] }), baseline = ordinary.spawnEnemy(id, { pos: [0, 0] });
    assert.equal(unit.s.aspd, baseline.s.aspd * 2); assert.equal(unit.s.bat, baseline.s.bat);
    assert.equal(unit.s.interval, baseline.s.interval / 2);
  }
  assert.deepEqual(b.errors, []); assert.deepEqual(ordinary.errors, []);
});
