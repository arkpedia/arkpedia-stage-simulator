// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import evidence from '../data/arkpedia-native-operators/char_394_hadiya.json' with {type: 'json'};
import normal from '../data/arkpedia-mvp.json' with {type: 'json'};
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {HADIYA_ID as ID, HADIYA_SKILLS, selectedHadiyaBuild as select, selectedHadiyaInputs,
  hadiyaSourceComponent} from '../server/sim/content/arkpedia-hadiya-source.js';
const build = more => ({elite: 2, level: 80, potential: 1, trust: 0, skillId: 'skchr_hadiya_1',
  skillRank: 10, module: 'none', ...more});

test('Hadiya complete source graph remains held without public gameplay or art approval', async () => {
  const raw = await readFile(new URL('../data/arkpedia-native-operators/' + ID + '.json', import.meta.url));
  assert.equal(raw.length, 316545);
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'ffeebf810b1f0260d6062d57c1d9a7f00d3cab87650ae592fe175ca203aed27f');
  assert.deepEqual(evidence.enabledOperators, []); assert.deepEqual(evidence.heldOperators, [ID]);
  assert.deepEqual(evidence.nativeTemplateGaps, []); assert.deepEqual(evidence.jsonTemplateGaps, []);
  assert.equal(evidence.source.bundles.length, 5); assert.equal(Object.keys(evidence.templates).length, 6);
  assert.deepEqual(Object.keys(evidence.projectiles), []); assert.deepEqual(Object.keys(evidence.tokens ?? {}), []);
  let count = 0;
  for (const group of ['characters', 'skills', 'projectiles']) for (const rows of Object.values(evidence[group]))
    for (const row of rows) for (const c of row.components) { count++; assert.equal(typeof c.pathId, 'string'); }
  assert.equal(count, 73);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(evidence[k], false);
  assert.equal(normal.operators[ID], undefined); assert.equal(REGULAR_OPERATORS[ID], undefined);
});

for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++)
  test(`Hadiya S${skill} rank ${rank} preserves original SP, duration and DP blackboards`, () => {
    for (const potential of [1, 6]) for (const trust of [0, 200]) {
      const r = select(build({skillId: `skchr_hadiya_${skill}`, skillRank: rank, potential, trust}));
      assert.deepEqual(r.source, evidence.tables.skills[`skchr_hadiya_${skill}`].levels[rank - 1]);
      assert.equal(r.index, skill - 1); assert.equal(r.source.skillType, 'MANUAL');
      assert.equal(r.source.spData.spType, 'INCREASE_WITH_TIME');
      assert.equal(r.stats.baseAttackTime, 1.25); assert.equal(r.source.duration, skill === 1 ? 30 : 20);
      assert.equal(r.bb.retrigger_cost, skill === 1 ? 10 : 15);
      assert.equal(r.bb.cost, skill === 1 ? undefined : 10);
      assert.deepEqual(Object.keys(r.bb).sort(), r.source.blackboard.map(v => v.key).sort());
    }
  });

test('Promotion and potential select printed stats and talent stacks independently', () => {
  const low = select(build({elite: 0, level: 50, skillRank: 4}));
  const mid = select(build({elite: 1, level: 70, skillRank: 7}));
  const high = select(build()), potential = select(build({potential: 5}));
  assert.deepEqual([low.stats.maxHp, low.stats.atk, low.stats.def, low.stats.cost], [1649, 338, 260, 8]);
  assert.deepEqual([mid.stats.maxHp, mid.stats.atk, mid.stats.def, mid.stats.cost], [2171, 439, 334, 10]);
  assert.deepEqual([high.stats.maxHp, high.stats.atk, high.stats.def, high.stats.cost], [2895, 530, 393, 10]);
  assert.deepEqual(low.talentBb, []);
  assert.deepEqual(mid.talentBb, [{atk: .02, max_stack_cnt: 3, stun: 2}]);
  assert.deepEqual(high.talentBb, [{atk: .04, max_stack_cnt: 5, stun: 2}]);
  assert.deepEqual(potential.talentBb, [{atk: .05, max_stack_cnt: 5, stun: 2}]);
});

test('Locked skill, unsupported modules/builds and invented native references fail closed', () => {
  assert.deepEqual(HADIYA_SKILLS, ['skchr_hadiya_1', 'skchr_hadiya_2']);
  for (const more of [{elite: 0, level: 50, skillRank: 4, skillId: 'skchr_hadiya_2'},
    {elite: 0, level: 50, skillRank: 5}, {elite: 3}, {level: 81}, {potential: 0}, {potential: 7},
    {trust: 201}, {skillRank: 11}, {skillId: 'invented'}, {module: 'hadiya-x'}])
    assert.throws(() => select(build(more)));
  assert.throws(() => hadiyaSourceComponent('characters', ID, '0'), /Missing original/);
});

test('Selected identity rejects mutated stats, ranges, talent, blackboards and SP account', () => {
  const fresh = () => {
    const b = build(), r = select(b);
    return {rangeGrid: r.rangeGrid, def: normalizeChess({chessId: ID, charId: ID, stats: r.stats,
      rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
      skill: {...r.source, ...r.source.spData, skillId: b.skillId, rangeGrid: r.skillRangeGrid}, arkpedia: b})};
  };
  assert.equal(selectedHadiyaInputs(fresh()).index, 0);
  for (const change of [u => u.def.stats.atk++, u => u.rangeGrid = [], u => u.def.talents[0].bb.atk = 9,
    u => u.def.skill.bb.fake = 1, u => u.def.skill.spCost++, u => u.def.raw.arkpedia.skillId = 'skchr_hadiya_2']) {
    const u = fresh(); change(u); assert.throws(() => selectedHadiyaInputs(u), /Incomplete original/);
  }
});
