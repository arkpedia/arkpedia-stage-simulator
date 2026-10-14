// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import publicData from '../data/arkpedia-mvp.json' with { type: 'json' };
import { NECRASS_ID as ID, NECRASS_TOKENS as TOKENS, selectedNecrassBuild as select,
  necrassSourceComponent as component } from '../server/sim/content/arkpedia-necrass-source.js';
const TOKEN = TOKENS[0];
const build = (n = 1, skillRank = 10, elite = 2) => ({ elite, level: 1, potential: 1,
  trust: 0, skillId: `skchr_necras_${n}`, skillRank, module: 'none' });

test('Necrass foundation remains immutable under a separate public runtime review', () => {
  assert.ok(publicData.operators[ID]);
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(e.source.commit, publicData.sources[e.source.repository]);
  assert.equal(e.source.commit, '57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient, '26-09-23-17-49-43_b9cc4a');
  assert.equal(e.source.modelCommit, 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd');
  const count = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(g =>
    Object.values(e[g]).flatMap(rows => rows.flatMap(r => r.components))).length;
  assert.equal(count, 252); assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.templates).length, 25);
  assert.equal(Object.keys(e.originalTemplates).length, 26);
  assert.deepEqual(e.jsonTemplateGaps, ['necras_dragon[one_shot_fx]']);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.projectiles).sort(),
    ['projectile_chr_necras', 'projectile_chr_necras_s2', 'projectile_chr_necras_s3']);
  for (const k of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[k], false);
});

for (let n = 1; n <= 3; n++) for (let rank = 1; rank <= 10; rank++) {
  test(`Necrass S${n} rank ${rank} keeps owner rank and servant's single source rank separate`, () => {
    const r = select(build(n, rank)), token = r.tokenRecords[TOKEN];
    assert.equal(r.index, n - 1);
    assert.equal(r.source, e.tables.skills[`skchr_necras_${n}`].levels[rank - 1]);
    assert.equal(r.source.skillType, 'MANUAL');
    assert.equal(r.source.spData.spType, 'INCREASE_WITH_TIME');
    assert.equal(token.sourceRank, 1); assert.equal(token.skillId, `sktok_necras_skeltn_${n}`);
    assert.equal(token.skill, e.tables.tokenSkills[token.skillId].levels[0]);
    assert.equal(token.phase, e.tables.tokens[TOKEN].phases[2]);
    assert.equal(token.skill.skillType, n === 3 ? 'AUTO' : 'PASSIVE');
    assert.equal(token.binding, e.officialTokenSkeletonBindings[TOKEN]);
    assert.equal(token.models, e.tokenModels[TOKEN]);
    assert.deepEqual(token.bb, n === 3 ? { 'attack@atk_scale': 1.2, 'attack@duration': 8 } : {});
  });
}

test('selected level/trust/potential preserves redeployment reduction and original servant phases', () => {
  const original = JSON.stringify(e);
  for (const elite of [0, 1, 2]) {
    const level = e.tables.character.phases[elite].maxLevel;
    const base = select({ ...build(1, 1, elite), level });
    assert.equal(base.stats.maxHp, [1111, 1443, 1924][elite]);
    assert.equal(base.stats.atk, [424, 531, 633][elite]);
    const full = select({ ...build(1, 1, elite), level, trust: 200, potential: 6 });
    assert.equal(full.stats.atk, base.stats.atk + 45 + 27);
    assert.equal(full.stats.def, base.stats.def + 45);
    assert.equal(full.stats.cost, base.stats.cost - 2);
    assert.equal(full.stats.respawnTime, base.stats.respawnTime - 6);
    assert.deepEqual(select({ ...build(1, 1, elite), level, trust: 100, potential: 6 }).stats, full.stats);
    assert.equal(select({ ...build(1, 1, elite), level, trust: 50 }).stats.atk, base.stats.atk + 23);
    assert.equal(full.tokenRecords[TOKEN].phase, base.tokenRecords[TOKEN].phase);
    assert.equal(full.tokenRecords[TOKEN].phase, e.tables.tokens[TOKEN].phases[elite]);
  }
  assert.equal(JSON.stringify(e), original);
});

test('talent candidate thresholds retain hidden S3 source talent without claiming activation', () => {
  for (const elite of [0, 1, 2]) {
    const r = select(build(1, 1, elite)), t = r.talents.find(t => t.prefabKey === '1');
    assert.equal(t.blackboard.find(x => x.key === 'max_token_cnt').value, elite === 0 ? 2 : 3);
    assert.equal(r.talents.some(t => t.prefabKey === '2'), elite === 2);
  }
  const t2 = potential => select({ ...build(), potential }).talentBb[1];
  assert.equal(t2(2).hp_ratio, .5); assert.equal(t2(3).hp_ratio, .6);
  assert.equal(t2(3).damage_scale, 1.45);
  assert.deepEqual(component('-7091611462415665060')._checkValidBySkillIndex, [2]);
});

test('locked skills, invalid builds and unsupported modules fail closed', () => {
  for (const change of [{ elite: -1 }, { elite: 3 }, { elite: 1.5 }, { level: 0 }, { level: 91 },
    { elite: 0, level: 51, skillRank: 1 }, { level: 1.5 }, { trust: NaN }, { trust: -1 }, { trust: 201 },
    { potential: 0 }, { potential: 7 }, { potential: 1.5 }, { skillRank: 0 }, { skillRank: 11 },
    { skillRank: 1.5 }, { elite: 0, skillRank: 5 }, { elite: 1, skillRank: 8 },
    { elite: 0, skillRank: 1, skillId: 'skchr_necras_2' },
    { elite: 1, skillRank: 1, skillId: 'skchr_necras_3' }, { skillId: 'unknown' },
    { module: 'new' }, { module: false }, { module: 0 }, { module: '' }, { module: {} }])
    assert.throws(() => select({ ...build(), ...change }));
  assert.throws(() => select());
});

test('source S1/S2/S3 keep resummoning, Sleep cadence and special-servant limits', () => {
  const s1 = select(build()), s2 = select(build(2)), s3 = select(build(3));
  assert.equal(s1.source.spData.spCost, 13); assert.equal(s1.bb.atk_scale, 4.5);
  assert.equal(s1.bb.range_radius, 1.5);
  assert.equal(s2.source.spData.spCost, 20); assert.equal(s2.bb.max_target, 2);
  assert.equal(s2.bb.interval, .5); assert.equal(s2.bb.hit_duration, 12);
  assert.equal(s2.bb.additional_token_cnt, 2);
  assert.equal(s3.source.spData.spCost, 16); assert.equal(s3.bb['attack@atk_scale'], 8);
  assert.equal(s3.bb['attack@max_stack_cnt'], 6);
  assert.equal(s3.bb['attack@necras_s_3[attack_cnt].max_stack_cnt'], 3);
  assert.equal(s3.bb['attack@hp_ratio'], .2);
});

test('native summons cost no slots and retain their own distinct release events', () => {
  assert.equal(component('-8493436737972975817')._occupiedRemainingCharacterCnt, 0);
  assert.equal(component('-1344118519958587300')._projectileKey, 'projectile_chr_necras');
  assert.equal(component('8469424609932752988')._animKey, 'Skill_3_Loop');
  assert.equal(component('8469424609932752988')._projectileKey, 'projectile_chr_necras_s3');
  for (const face of ['Front', 'Back']) {
    const owner = e.models[ID][face], token = e.tokenModels[TOKEN][face];
    assert.equal(owner.sha256, e.officialSkeletonBindings[ID][face].sha256);
    assert.equal(owner.eventPayloads.Attack[0].time, .5);
    assert.equal(owner.eventPayloads.Skill_2_Begin[0].time, .6666666865348816);
    assert.equal(owner.eventPayloads.Skill_3_Loop[0].time, .5666666626930237);
    assert.equal(token.eventPayloads.Attack[0].time, .5666666626930237);
    assert.equal(token.eventPayloads.Attack_2[0].time, .5);
    assert.equal(token.eventPayloads.Skill_Loop[0].time, .06666667014360428);
  }
});

test('missing Back servant Stun clips and native-only dragon template remain visible gaps', () => {
  assert.deepEqual(e.modelAliasGaps, { [TOKEN]: { Back: ['Stun', 'Stun_2'] } });
  assert.equal(e.tokenModels[TOKEN].Back.durations.Stun, undefined);
  assert.equal(e.tokenModels[TOKEN].Back.durations.Stun_2, undefined);
  assert.equal(e.tokenModels[TOKEN].Front.durations.Stun, 1);
  assert.equal(e.models[ID].Back.eventPayloads.Skill_2_Loop[0].time, 0);
  assert.equal(e.models[ID].Front.eventPayloads.Skill_2_Loop, undefined);
  assert.ok(e.originalTemplates['necras_dragon[one_shot_fx]']);
  assert.equal(e.templates['necras_dragon[one_shot_fx]'], undefined);
});
