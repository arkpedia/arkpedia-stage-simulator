// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { CLOSUR_ID as ID, CLOSUR_TOKEN_ID as TOKEN, CLOSUR_SKILLS as SKILLS, selectedClosurBuild as select }
  from '../server/sim/content/arkpedia-closur-source.js';
import { near } from './helpers/mon3tr-fixture.js';
const build = (elite = 2, skill = 0, rank = [4, 7, 10][elite], potential = 1, trust = 0) => ({
  elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
  skillId: SKILLS[skill], skillRank: rank, module: 'none',
});
const part = (group, key, id) => {
  const found = e[group][key].flatMap(row => row.components).find(p => p.pathId === id);
  assert.ok(found, `Missing original ${group}/${key} component ${id}`);
  return found.data;
};
test('the immutable Closure/command-center source receipt does not itself approve a public runtime', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.equal(e.source.nativeClient, '26-09-22-07-47-20_6c71fa');
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[flag], false);
  assert.deepEqual(e.nativeTemplateGaps, []); assert.deepEqual(e.jsonTemplateGaps, []);
  assert.equal(Object.keys(e.templates).length, 26); assert.equal(Object.keys(e.projectiles).length, 3);
  assert.equal(e.source.bundles.length, 6); assert.equal(Object.keys(e.source.tableGitBlobs).length, 6);
  assert.deepEqual(Object.keys(e.tokens), [TOKEN]);
  assert.equal(e.tables.character.talents[0].candidates[0].tokenKey, TOKEN);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`Closure E${elite}/P${potential} source stats and trust`, () => {
  const r = select(build(elite, 0, [4, 7, 10][elite], potential, 200));
  near(r.stats.maxHp, [1126, 1444, 1762][elite]);
  near(r.stats.atk, [298, 393, 480][elite] + 60 + (potential === 6 ? 25 : 0));
  near(r.stats.def, [77, 110, 131][elite] + 20);
  near(r.stats.cost, [13, 15, 15][elite] - (potential === 6 ? 2 : 0));
  near(r.stats.attackSpeed, potential === 6 ? 108 : 100); near(r.stats.baseAttackTime, 1);
  near(r.talentBb[0].cnt, 1);
  if (elite === 2) { near(r.talentBb[1].cost, potential === 6 ? -4 : -3); near(r.talentBb[1].atk, .04); }
  else assert.equal(r.talentBb.length, 1);
});
for (let rank = 1; rank <= 10; rank++) test(`all three Closure skills preserve rank ${rank} costs and separate mechanics`, () => {
  const a = select(build(2, 0, rank)), b = select(build(2, 1, rank)), c = select(build(2, 2, rank));
  near(a.source.spData.spCost, 18 - rank); near(a.source.spData.initSp, rank < 8 ? 0 : 1);
  near(a.source.duration, 8); near(a.bb.cost, 3); near(a.bb.shield_cnt, 1);
  near(a.bb.cost_add_max, rank < 4 ? 5 : rank < 7 ? 6 : 7);
  near(b.source.spData.spCost, rank === 10 ? 40 : 51 - rank);
  near(b.source.spData.initSp, rank === 10 ? 34 : 24 + rank);
  near(b.bb.block_cnt, 1); near(b.bb['attack@max_target'], 2); near(b.bb.cost_return, .4);
  near(b.bb.cost_period, 15); near(b.bb['closur_s_2[add_cost_period].interval'], 2);
  near(c.source.spData.spCost, [42, 41, 40, 39, 38, 37, 36, 34, 32, 30][rank - 1]);
  near(c.source.spData.initSp, [12, 13, 14, 15, 16, 17, 18, 19, 21, 23][rank - 1]);
  near(c.bb['attack@atk_scale'], [1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.9, 2.1, 2.3, 2.5][rank - 1]);
  near(c.bb.base_attack_time, -.5); near(c.bb.attack_trigger_cnt, 9); near(c.bb.max_trigger_cnt, 6);
  near(c.bb['attack@max_stack_cnt'], 10); near(c.bb['attack@slow_down_time'], 3);
  near(c.bb.cost_period, 18); near(c.bb['closur_s_3[add_cost_period].interval'], 1.66);
  for (const r of [a, b, c]) assert.equal(r.source.spData.spType, 'INCREASE_WITH_TIME');
  near(b.source.duration, 30); near(c.source.duration, 30);
});
test('invalid, locked and unsupported Closure selections fail before any combat registration', () => {
  for (const patch of [{ elite: -1 }, { elite: 3 }, { level: 0 }, { level: 91 },
    { potential: 0 }, { potential: 7 }, { trust: -1 }, { trust: 201 }, { skillRank: 0 }, { skillRank: 11 },
    { skillId: 'other' }, { module: 'mod-x' }, { module: '' }, { module: false },
    { elite: 0, level: 50, skillRank: 4, skillId: SKILLS[1] },
    { elite: 1, level: 80, skillRank: 7, skillId: SKILLS[2] },
    { elite: 0, level: 50, skillRank: 5 }, { elite: 1, level: 80, skillRank: 8 }])
    assert.throws(() => select({ ...build(), ...patch }));
});
test('token table stats and passive range skills remain distinct from the owner rank tables', () => {
  const t = e.tables.tokens[TOKEN]; assert.equal(t.profession, 'TOKEN'); assert.equal(t.position, 'ALL');
  for (const [i, phase] of t.phases.entries()) {
    const stats = phase.attributesKeyFrames.at(-1).data;
    near(stats.maxHp, [1938, 2489, 3275][i]); near(stats.def, [265, 343, 432][i]);
    near(stats.atk, 0); near(stats.cost, 0); near(stats.blockCnt, 2);
  }
  assert.deepEqual(e.tokenModeSkills[TOKEN], []); assert.deepEqual(e.tokenSkillPrefabOverrides[TOKEN], {});
  for (let i = 0; i < 3; i++) {
    const id = `sktok_closur_ourbase${i + 1}`, skill = e.tables.tokenSkills[id];
    assert.deepEqual(e.tokenSkillBindings[TOKEN][id], [id]); assert.ok(e.skills[id]);
    assert.equal(skill.levels.length, 1); const r = skill.levels[0];
    assert.equal(r.skillType, 'PASSIVE'); near(r.spData.spCost, 0);
    assert.equal(r.rangeId, ['x-5', 'x-4', 'x-6'][i]); assert.ok(e.tables.ranges[r.rangeId].grids.length);
  }
});
test('token source resolves an exact embedded animator instead of reusing owner artwork', () => {
  assert.deepEqual(e.tokenSources[TOKEN], {
    bundle: 'pkgrps/btl_pfb_tokens_4.ab',
    container: 'dyn/battle/prefabs/[uc]tokens/token_10066_closur_ourbase.prefab',
    rootPathId: '-5788352084631041927', animatorPathId: '-4151407806632834951',
  });
  assert.equal(e.source.bundles.at(-1).sha256, 'af23c7f497862f38be2cdca0cd4079d44753bde8d61b97398e5a2777a54281e4');
  const root = part('tokens', TOKEN, '9056934687418337401');
  assert.equal(root._occupiedRemainingCharacterCnt, 0); assert.equal(root._isFixedRotation, 1);
  assert.equal(root._buildCondition.limitByHostAttackRange, 1); assert.equal(root._buildCondition.needSpecifyDirection, 0);
  assert.equal(root._animator.m_PathID, e.tokenSources[TOKEN].animatorPathId);
  assert.deepEqual(e.tokenArtworkControllers[TOKEN][0].data,
    part('tokens', TOKEN, e.tokenSources[TOKEN].animatorPathId));
  for (const group of ['characters', 'artworkHierarchy', 'tokens', 'skills', 'projectiles']) {
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      for (const [key, v] of Object.entries(value)) {
        if (key === 'm_PathID') assert.equal(typeof v, 'string', '64-bit pointer must not round through JS numbers');
        else visit(v);
      }
    };
    visit(e[group]);
  }
});
test('owner animation evidence preserves continuous fire, down variants and exact hit events', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face]; assert.equal(m.sha256, e.officialSkeletonBindings[ID][face].sha256);
    near(m.durations.Attack_Begin, .2); near(m.durations.Attack_Loop, 1);
    near(m.eventPayloads.Attack_Loop[0].time, .4000000059604645);
    near(m.eventPayloads.Skill_2_Loop[0].time, .4000000059604645);
    near(m.eventPayloads.Skill_3_Loop[0].time, .13333334028720856);
    assert.equal(m.durations.Attack, undefined); near(m.durations.Skill_3_Loop, .5);
  }
  assert.ok(e.models[ID].Front.durations.Attack_Down_Loop);
  assert.equal(e.models[ID].Back.durations.Attack_Down_Loop, undefined);
});
test('token artwork has no invented attack, and native recharge and death hook mappings remain literal', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[TOKEN][face]; assert.equal(m.sha256, e.officialSkeletonBindings[TOKEN][face].sha256);
    assert.equal(m.durations.Attack, undefined); assert.deepEqual(m.hits, {});
    near(m.eventPayloads.Start[0].time, .4000000059604645); assert.equal(m.eventPayloads.Start[0].name, 'OnStart');
    assert.notEqual(m.sha256, e.models[ID][face].sha256);
  }
  assert.equal(e.models[TOKEN].Back.durations.Die, undefined); near(e.models[TOKEN].Front.durations.Die, 1);
  const recharge = part('tokens', TOKEN, '-6687692260338251655');
  assert.deepEqual(recharge._excludeAnimKeys, ['Born', 'Idle']);
  assert.deepEqual(part('tokens', TOKEN, '-2294886251452053383')._replaceAnimPairs, [{ fromAnimKey: 'Die', toAnimKey: 'Stun' }]);
  // Stun is a literal native hook value even though neither skeleton has that track.
  for (const face of ['Front', 'Back']) assert.equal(e.models[TOKEN][face].durations.Stun, undefined);
});
