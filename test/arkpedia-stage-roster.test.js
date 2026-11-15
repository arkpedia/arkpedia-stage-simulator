// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import receipt from '../data/stage-rules/of-6.json' with { type: 'json' };
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { excludedStageOperators, stageSquadLimit } from '../shared/arkpedia/stage-roster.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor } from '../shared/arkpedia/loadout.js';
import { maxedSupport } from '../shared/arkpedia/squad.js';
const rules = compileStageRules({ id: receipt.stageId }, receipt);
const data = { ...mvp, stage: { ...mvp.stage, battle: { ...mvp.stage.battle, ...rules.battle } } };
test('OF-6 excludes Schwarz from ordinary squads and support, while permitting other operators', () => {
  const allowed = defaultBuild(mvp.operators.char_123_fang), denied = defaultBuild(mvp.operators.char_340_shwaz);
  assert.deepEqual([...excludedStageOperators(data.stage)], ['char_340_shwaz']);
  assert.throws(() => new StandardBattle(data, { operators: [denied] }), /excludes Schwarz/);
  const support = maxedSupport({ id: 'char_340_shwaz', skillId: denied.skillId }, catalogueFor(data));
  assert.throws(() => new StandardBattle(data, { operators: [allowed], support }), /excludes Schwarz/);
  const b = new StandardBattle(data, { operators: [allowed] });
  assert.ok(b.bench.char_123_fang); assert.deepEqual(b.errors, []);
  assert.equal(excludedStageOperators(mvp.stage).size, 0);
});
test('NORMAL rules apply only to normal difficulty, and malformed exclusions cannot enter runtime', () => {
  const variant = { ...receipt, stageId: receipt.stageId + '#f#', parentStageId: receipt.stageId };
  assert.equal(compileStageRules({ id: variant.stageId,
    variant: { kind: 'challenge_mode', of_stage_id: receipt.stageId } }, variant).battle.excluded_operator_ids, undefined);
  for (const value of [null, 'char_.*', 'char_340_shwaz|', 'char_340_shwaz|char_340_shwaz']) {
    const r = structuredClone(receipt); r.runes[0].blackboard[0].valueStr = value;
    assert.throws(() => compileStageRules({ id: r.stageId }, r), /exclusion/);
  }
  for (const ids of ['char_340_shwaz', [], ['enemy_x'], ['char_x', 'char_x']])
    assert.throws(() => excludedStageOperators({ battle: { excluded_operator_ids: ids } }), /Invalid/);
});
test('profession restrictions apply to both ordinary and support cards through the same roster contract', () => {
  const d = { ...mvp, stage: { ...mvp.stage, battle: { ...mvp.stage.battle, excluded_profession_mask: 33 } } };
  const excluded = excludedStageOperators(d.stage, d.operators);
  for (const op of Object.values(d.operators)) assert.equal(excluded.has(op.id), ['CASTER', 'TANK'].includes(op.profession));
  const caster = Object.values(d.operators).find(o => o.profession === 'CASTER'), denied = defaultBuild(caster);
  const allowed = defaultBuild(d.operators.char_123_fang);
  assert.throws(() => new StandardBattle(d, { operators: [denied] }), /excludes/);
  assert.throws(() => new StandardBattle(d, { operators: [allowed], support: denied }), /excludes/);
  assert.doesNotThrow(() => new StandardBattle(d, { operators: [allowed] }));
});
test('stage squad caps include support and are checked before battle initialization', () => {
  const d = { ...mvp, stage: { ...mvp.stage, battle: { ...mvp.stage.battle, squad_limit: 10 } } };
  const builds = Object.values(d.operators).slice(0, 11).map(defaultBuild);
  assert.equal(stageSquadLimit(d.stage), 10); assert.equal(stageSquadLimit(mvp.stage), 13);
  assert.throws(() => new StandardBattle(d, { operators: builds }), /at most 10/);
  assert.throws(() => new StandardBattle(d, { operators: builds.slice(0, 10), support: builds[10] }), /including support/);
  const b = new StandardBattle(d, { operators: builds.slice(0, 9), support: builds[9] });
  assert.equal(Object.keys(b.bench).length, 10); assert.deepEqual(b.errors, []);
  for (const value of [0, 14, 2.5]) assert.throws(() => stageSquadLimit({ battle: { squad_limit: value } }), /Invalid/);
});
