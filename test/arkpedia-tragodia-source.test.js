// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-tragodia-prefabs.json' with { type: 'json' };
import publicData from '../data/arkpedia-mvp.json' with { type: 'json' };
import { TRAGODIA_ID as ID, TRAGODIA_TOKENS as TOKENS,
  selectedTragodiaBuild as select, tragodiaSourceComponent as component }
  from '../server/sim/content/arkpedia-tragodia-source.js';
const build = (n = 1, rank = 10, elite = 2) => ({ elite, level: 1, potential: 1,
  trust: 0, skillId: `skchr_phatm2_${n}`, skillRank: rank, module: 'none' });
const actions = (key, event) => e.templates[key].eventToActions[event];
const type = n => n.$type.split('+').at(-1).split(',')[0];

test('native foundation preserves the public source pins and stays unregistered', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(publicData.operators[ID], undefined);
  assert.equal(e.source.commit, publicData.sources[e.source.repository]);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.bundles.length, 6); assert.equal(Object.keys(e.templates).length, 25);
  assert.equal(Object.keys(e.projectiles).length, 1);
  const records = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(g =>
    Object.values(e[g]).flatMap(rows => rows.flatMap(row => row.components)));
  assert.equal(records.length, 213);
  assert.deepEqual(e.nativeTemplateGaps, []);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
});

for (let n = 1; n <= 3; n++) for (let rank = 1; rank <= 10; rank++) {
  test(`S${n} rank ${rank} selects the original owner and both independent token tables`, () => {
    const s = select(build(n, rank));
    assert.equal(s.source, e.tables.skills[`skchr_phatm2_${n}`].levels[rank - 1]);
    assert.equal(s.index, n - 1);
    assert.equal(s.source.skillType, n === 3 ? 'MANUAL' : 'AUTO');
    assert.equal(s.source.spData.spType, n === 1 ? 'INCREASE_WHEN_ATTACK' : 'INCREASE_WITH_TIME');
    if (n === 2) assert.equal(s.bb['attack@projectile_range'], 'x-1');
    for (const id of TOKENS) {
      const t = s.tokenRecords[id];
      assert.equal(t.phase, e.tables.tokens[id].phases[2]);
      assert.equal(t.skill, e.tables.tokenSkills[t.skillId].levels[rank - 1]);
      assert.equal(t.skill.skillType, 'PASSIVE'); assert.equal(t.skill.spData.spCost, 0);
    }
  });
}

test('promotion and potential select both talents at their original thresholds', () => {
  for (const elite of [0, 1, 2]) {
    const base = select(build(1, 1, elite));
    assert.equal(base.talentBb[0]['attack@ep_damage_ratio'], [.2, .25, .3][elite]);
    assert.equal(base.talentBb[0].ep_damage_ratio, [.1, .15, .2][elite]);
    assert.equal(base.talents.length, elite === 2 ? 2 : 1);
    const upgraded = select({ ...build(1, 1, elite), potential: 3 });
    assert.equal(upgraded.talentBb[0]['attack@ep_damage_ratio'], [.23, .28, .33][elite]);
    assert.equal(upgraded.talentBb[0].ep_damage_ratio, [.13, .18, .23][elite]);
  }
  assert.equal(select({ ...build(), potential: 4 }).talentBb[1].attack_speed, -12);
  assert.equal(select({ ...build(), potential: 5 }).talentBb[1].attack_speed, -16);
  assert.equal(select(build()).talentBb[1].value, 70);
});

test('selected level, trust and potential stats do not leak into source token phases', () => {
  for (const elite of [0, 1, 2]) {
    const level = e.tables.character.phases[elite].maxLevel;
    const base = select({ ...build(1, 1, elite), level });
    assert.equal(base.stats.maxHp, [702, 936, 1200][elite]);
    assert.equal(base.stats.atk, [324, 411, 490][elite]);
    const full = select({ ...build(1, 1, elite), level, trust: 200, potential: 6 });
    assert.equal(full.stats.maxHp, base.stats.maxHp + 300);
    assert.equal(full.stats.atk, base.stats.atk + 40 + 23);
    assert.equal(full.stats.cost, base.stats.cost - 2);
    assert.equal(select({ ...build(1, 1, elite), level, trust: 50 }).stats.atk, base.stats.atk + 20);
    assert.equal(select({ ...build(1, 1, elite), level, trust: 100 }).stats.maxHp, full.stats.maxHp);
    for (const id of TOKENS) assert.equal(full.tokenRecords[id].phase, base.tokenRecords[id].phase);
  }
});

test('invalid builds, locked skills and unreviewed modules fail closed', () => {
  for (const override of [{ elite: -1 }, { elite: 3 }, { elite: 1.5 }, { level: 0 },
    { level: 91 }, { elite: 0, level: 51, skillRank: 1 }, { level: 1.5 },
    { trust: -1 }, { trust: 201 }, { trust: NaN }, { potential: 0 }, { potential: 7 },
    { skillRank: 0 }, { skillRank: 11 }, { skillRank: 1.5 },
    { elite: 0, skillRank: 5 }, { elite: 1, skillRank: 8 },
    { elite: 0, skillId: 'skchr_phatm2_2', skillRank: 1 },
    { elite: 1, skillId: 'skchr_phatm2_3', skillRank: 1 },
    { skillId: 'unknown' }, { module: 'unreviewed' }])
    assert.throws(() => select({ ...build(), ...override }));
  assert.throws(() => select());
});

test('M3 source preserves Bind, unlimited S2 and S3 burst refresh parameters', () => {
  const s1 = select(build(1)), s2 = select(build(2)), s3 = select(build(3));
  assert.equal(s1.bb.atk_scale, 1.5); assert.equal(s1.bb.times, 2);
  assert.equal(s1.bb.unmove, 3); assert.equal(s1.bb.ep_damage_scale, 1.8);
  assert.equal(s1.source.spData.spCost, 2);
  assert.equal(s2.source.duration, -1); assert.equal(s2.source.spData.spCost, 25);
  assert.equal(s2.bb.attack_speed, 35); assert.equal(s2.bb.max_target, 4);
  assert.equal(s2.bb.interval_damage, .5); assert.equal(s2.bb.ep_damage_ratio_token, .25);
  assert.equal(s3.source.duration, 30); assert.equal(s3.source.spData.spCost, 40);
  assert.equal(s3.source.spData.initSp, 30); assert.equal(s3.bb.atk, 1.25);
  assert.equal(s3.bb['phatm2_s_3[token_cooldown].interval'], 30);
  assert.equal(s3.bb['talent@ep_break_recover_speed'], .5);
});

test('owner native releases retain distinct ordinary, S2 and S3 clocks', () => {
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    assert.equal(model.sha256, e.officialSkeletonBindings[ID][face].sha256);
    for (const key of ['Attack_1', 'Attack_2', 'Skill_1']) assert.equal(model.eventPayloads[key][0].time, .5);
    for (const key of ['Skill_2_Loop_1', 'Skill_2_Loop_2'])
      assert.equal(model.eventPayloads[key][0].time, .8999999761581421);
    assert.equal(model.eventPayloads.Skill_3_Loop[0].time, 0);
    assert.equal(model.durations.Skill_3_Loop, 10);
  }
  assert.equal(component('-8049361450338600694')._waitForAttackEvent, 1);
  assert.equal(component('-8049361450338600694')._damageType, 2);
  assert.equal(component('1442620349020702503')._additionalTimes, 1);
  assert.equal(component('1442620349020702503')._triggerDelta, .4000000059604645);
});

test('lure original End carries On_Attack despite having no standard OnAttack hit', () => {
  const lure = e.tokenModels[TOKENS[0]].Single;
  assert.deepEqual(lure.hits, {});
  assert.equal(lure.durations.End, 1.5);
  assert.equal(lure.eventPayloads.End[0].name, 'On_Attack');
  assert.equal(lure.eventPayloads.End[0].time, 1.4333332777023315);
  assert.equal(e.officialTokenSkeletonBindings[TOKENS[0]].animationAliases.find(a => a.animKey === 'Born').animName, 'Start');
  const selector = component('-7319848684153398234');
  assert.equal(selector._checkReachableToOwner, 1); assert.equal(selector._avoidObstacleLike, 1);
  assert.equal(selector._filterAbnormalImmune, 1); assert.equal(selector._abnormalFlagImmune, 41);
  assert.equal(component('9056605678497710654')._occupiedRemainingCharacterCnt, 0);
});

test('Cage keeps an effects-only animator and its missing named skill prefab is explicit', () => {
  const cage = e.officialTokenSkeletonBindings[TOKENS[1]];
  assert.equal(cage.renderingKind, 'effect-only'); assert.deepEqual(cage.facings, {});
  assert.deepEqual(e.tokenModels[TOKENS[1]], {}); assert.deepEqual(cage.animationAliases, []);
  assert.equal(cage.animatorData._spine, undefined); assert.equal(cage.animatorData._skeleton, undefined);
  assert.deepEqual(e.nativeSkillPrefabGaps, ['sktok_phatm2_mndclv_3']);
  assert.equal(e.skills.sktok_phatm2_mndclv_3, undefined);
  assert.equal(e.tables.tokenSkills.sktok_phatm2_mndclv_3.levels.length, 10);
  assert.equal(component('6352044219529720151')._occupiedRemainingCharacterCnt, 0);
});

test('native Nervous splash excludes main target and bound scaling filters SANITY', () => {
  const splash = actions('phatm2_t_1', 'ON_BUFF_START').find(a => type(a) === 'CreateBuffInCircleRange');
  assert.equal(splash._excludeTarget, true);
  const scale = actions('phatm2_s_1[unmove]', 'ON_TAKE_EP_DAMAGE')[0];
  assert.equal(type(scale), 'EpDamageScale'); assert.equal(scale._filterElementType, true);
  assert.equal(scale._elementType, 'SANITY');
  assert.equal(scale._isOneMinus, false); assert.equal(scale._isStackable, false);
});
