// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import evidence from '../data/arkpedia-native-operators/char_4221_ju.json' with {type: 'json'};
import {JU_ID as ID, selectedJuBuild as select, juNativeInputs, juSourceComponent}
  from '../server/sim/content/arkpedia-ju-source.js';

const build = (more = {}) => ({elite: 2, level: 80, potential: 1, trust: 0,
  skillId: 'skchr_ju_1', skillRank: 10, module: 'none', ...more});

test('Ju retains exact held source bytes and complete native dependency closure', async () => {
  const raw = await readFile(new URL('../data/arkpedia-native-operators/char_4221_ju.json', import.meta.url));
  assert.equal(raw.length, 299728);
  assert.equal(createHash('sha256').update(raw).digest('hex'), '1a17ccfc1b76330814f9e7a660303ce4061df6c8afe50290ddc88a0e53a32011');
  assert.equal(evidence.source.commit, 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');
  assert.equal(evidence.source.bundles.length, 5);
  assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]);
  assert.deepEqual(evidence.nativeTemplateGaps, []);
  assert.deepEqual(evidence.jsonTemplateGaps, []);
  assert.equal(Object.keys(evidence.templates).length, 8);
  assert.equal(Object.keys(evidence.projectiles).length, 3);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(evidence[flag], false);
  assert.equal(evidence.tokens, undefined);
  for (const group of ['characters', 'artworkHierarchy', 'skills', 'projectiles'])
    for (const rows of Object.values(evidence[group]))
      for (const row of rows) for (const part of row.components) assert.equal(typeof part.pathId, 'string');
});

for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++)
  test(`Ju S${skill} rank ${rank} selects its exact original SP/skill row`, () => {
    for (const potential of [1, 6]) for (const trust of [0, 200]) {
      const selected = select(build({skillId: `skchr_ju_${skill}`, skillRank: rank, potential, trust}));
      assert.equal(selected.index, skill - 1);
      assert.deepEqual(selected.source, evidence.tables.skills[`skchr_ju_${skill}`].levels[rank - 1]);
      assert.equal(selected.stats.baseAttackTime, 2.4);
      assert.equal(selected.source.spData.spType, 'INCREASE_WITH_TIME');
      assert.equal(selected.source.skillType, skill === 1 ? 'AUTO' : 'MANUAL');
      assert.equal(selected.source.spData.maxChargeTime, skill === 1 ? 2 : 1);
      assert.deepEqual(Object.keys(selected.bb).sort(), selected.source.blackboard.map(v => v.key).sort());
    }
  });

test('Ju promotions, trust, potentials and talent SP remain independent original inputs', () => {
  const low = select(build({elite: 0, level: 50, skillRank: 4}));
  assert.deepEqual([low.stats.maxHp, low.stats.atk, low.stats.def, low.stats.cost], [1024, 616, 78, 23]);
  assert.equal(low.talentBb[0].sp, 1);
  assert.equal(select(build({elite: 1, level: 70, skillRank: 7})).talentBb[0].sp, 1);
  const high = select(build({potential: 6, trust: 200}));
  assert.deepEqual([high.stats.maxHp, high.stats.atk, high.stats.def, high.stats.cost, high.stats.respawnTime],
    [1750, 1094, 120, 22, 70]);
  assert.equal(high.talentBb[0].sp, 2);
  assert.equal(high.talentBb[0].interval, 10);
  assert.equal(high.talentBb[0].move_speed, -.8);
});

test('Ju rejects unavailable skill/rank/promotion and unsupported modules', () => {
  for (const more of [{elite: 3}, {level: 81}, {potential: 0}, {potential: 7}, {trust: 201},
    {skillId: 'invented'}, {skillRank: 0}, {skillRank: 11}, {elite: 0, level: 50, skillRank: 5},
    {elite: 0, level: 50, skillRank: 4, skillId: 'skchr_ju_2'}, {module: 'ju-x'}])
    assert.throws(() => select(build(more)));
  assert.throws(() => juSourceComponent('characters', ID, '0'), /Missing original/);
});

test('Ju native selectors, exact ability keys and skill-mode controls are retained without enum guesses', () => {
  const n = juNativeInputs();
  assert.equal(n.root._modes.length, 2);
  assert.equal(n.ordinary._projectileKey, 'projectile_chr_ju');
  assert.equal(n.s1Attack._projectileKey, 'projectile_chr_ju_s1');
  assert.equal(n.s2Attack._projectileKey, 'projectile_chr_ju_s2');
  assert.equal(n.ordinary._selector.m_PathID, '3300171949473116447');
  assert.equal(n.s1Attack._selector.m_PathID, '2473391087346932474');
  assert.equal(n.s2Attack._selector.m_PathID, '-6893981573928799969');
  for (const ability of [n.ordinary, n.s1Attack, n.s2Attack]) {
    assert.equal(ability._maxAnimScale, 1);
    assert.equal(ability._affectedBySlowDown, 0);
  }
  assert.equal(n.s1Selector._filerMaxHp, 1);
  assert.equal(n.s1Selector._maxHpRatio, .5);
  assert.equal(n.s1Selector._maxHpExcludeEqual, 0);
  assert.equal(n.s1._earlySkillFinishAtAttackFinished, 1);
  assert.equal(n.s1._playSkillBeginAnim, 0);
  assert.equal(n.s2._attackBlackboardModeIndex, 1);
  assert.equal(n.s2._beginAnim, 'Skill_2_Begin');
  assert.equal(n.s2._playSkillBeginAnim, 1);
  for (const selector of [n.ordinarySelector, n.s1Selector, n.s2Selector]) {
    assert.equal(selector._postFilter, 27);
    assert.equal(selector._abnormalFlag, 44);
  }
});

test('Ju normal/S1 travel and short S2 projectile keep distinct original movement and lifetime flags', () => {
  const n = juNativeInputs();
  assert.equal(n.ordinaryMovement._speed, 10);
  assert.equal(n.s1Movement._speed, 15);
  assert.equal(n.ordinaryProjectile._lifeTime, 10);
  assert.equal(n.s1Projectile._lifeTime, 10);
  assert.equal(n.s2Projectile._lifeTime, .16699999570846558);
  for (const projectile of [n.ordinaryProjectile, n.s1Projectile, n.s2Projectile]) {
    assert.equal(projectile._managedBySource, 0);
    assert.equal(projectile._stopWhenSourceInvalid, 0);
    assert.equal(projectile._alwaysHitTraceTargetInTheEnd, 1);
  }
});
