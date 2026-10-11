// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-sand-reckoner-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_4140_lasher', TOKEN = 'token_10036_lasher_mcbird';
const rows = (g, id) => e[g][id].flatMap(r => r.components.map(c => c.data));
const bb = xs => Object.fromEntries(xs.map(x => [x.key, x.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('full two-skill source kit and original summon are enabled together with explicit limits', () => {
  const ids = ['skchr_lasher_1', 'skchr_lasher_2'];
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.deepEqual(e.runtimeMapping.skillIds, ids); assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, ids);
  assert.deepEqual(data.operators[ID].skills.map(s => s.id), ids); assert.ok(data.tokens[TOKEN]);
  assert.equal(e.source.bundles.length, 6); assert.equal(Object.keys(e.templates).length, 6);
  assert.deepEqual(Object.keys(e.templates), Object.keys(e.originalTemplates)); assert.deepEqual(e.nativeTemplateGaps, []);
  assert.equal(Object.values(e.characters).concat(Object.values(e.skills), Object.values(e.tokens),
    Object.values(e.projectiles)).flatMap(rs => rs.flatMap(r => r.components)).length, 126);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false); assert.equal(e.nativeParticleSupport, false);
  assert.ok(e.verificationLimits.some(s => s.includes('deck counter ordering')));
  for (const bundle of e.source.bundles) { assert.match(bundle.sha256, /^[a-f0-9]{64}$/); assert.match(bundle.md5, /^[a-f0-9]{32}$/); }
  for (const skill of data.operators[ID].skills) {
    assert.equal(skill.levels.length, 10);
    assert.deepEqual(skill.levels.map(({ rangeGrid, ...rank }) => rank), e.tables.skills[skill.id].levels);
  }
});
test('normal owner uses native direct Arts while source skill and token attacks emit speed10 projectiles', () => {
  const owner = rows('characters', ID).filter(d => '_damageType' in d);
  assert.equal(owner.length, 3);
  assert.equal(owner.find(d => d._animKey === 'Attack')._projectileKey, undefined);
  assert.deepEqual(owner.filter(d => d._projectileKey).map(d => d._projectileKey).sort(),
    ['projectile_chr_lasher_s1', 'projectile_chr_lasher_s2']);
  const token = rows('tokens', TOKEN).filter(d => '_damageType' in d); assert.equal(token.length, 2);
  for (const attack of [...owner, ...token]) {
    assert.equal(attack._damageType, 2); assert.equal(attack._waitForAttackEvent, 1);
    assert.equal(attack._maxAnimScale, 1); assert.equal(attack._selectTargetTiming, 0);
  }
  assert.deepEqual(Object.keys(e.projectiles).sort(), ['projectile_chr_lasher_mcbird', 'projectile_chr_lasher_s1', 'projectile_chr_lasher_s2']);
  for (const id of Object.keys(e.projectiles)) assert.equal(rows('projectiles', id).find(d => '_speed' in d)._speed, 10);
});
test('native AUTO S1 and MANUAL S2 preserve all selected rank blackboards and activation fields', () => {
  const one = e.tables.skills.skchr_lasher_1.levels, two = e.tables.skills.skchr_lasher_2.levels;
  assert.ok(one.every(s => s.skillType === 'AUTO' && Object.keys(bb(s.blackboard)).join() === 'attack_speed'));
  assert.ok(two.every(s => s.skillType === 'MANUAL' && bb(s.blackboard).cnt === 1 && bb(s.blackboard).sluggish === 1));
  assert.equal(one.at(-1).duration, 10); assert.equal(one.at(-1).spData.spCost, 30); assert.equal(one.at(-1).spData.initSp, 20);
  assert.equal(bb(one.at(-1).blackboard).attack_speed, 60);
  assert.equal(two.at(-1).duration, 20); assert.equal(two.at(-1).spData.spCost, 40); assert.equal(two.at(-1).spData.initSp, 20);
  assert.equal(bb(two.at(-1).blackboard).atk, .4);
  for (const [id, attr, formula] of [['skchr_lasher_1', 7, 0], ['skchr_lasher_2', 1, 1]]) {
    const remote = rows('skills', id).find(d => d._buffs?.some(b => b.buffKey.endsWith('[token]')));
    const buff = remote._buffs.find(b => b.buffKey.endsWith('[token]'));
    assert.deepEqual(buff.attributes.attributeModifiers.map(a => [a.attributeType, a.formulaItem, a.loadFromBlackboard]), [[attr, formula, 1]]);
    assert.equal(buff.isSilenceable, 0); assert.equal(buff.isStunnable, 0); assert.equal(buff.isFreezable, 0);
  }
});
test('S2 native restartFSM, heavy priority and projectile Sluggish dependency are retained', () => {
  assert.equal(e.templates.switch_mode_restart_fsm.eventToActions.ON_BUFF_START[0]._restartFSM, true);
  assert.equal(e.templates.switch_mode_restart_fsm.eventToActions.ON_BUFF_FINISH[0]._restartFSM, true);
  const selectors = rows('tokens', TOKEN).filter(d => '_postFilter' in d);
  assert.deepEqual(selectors.map(d => d._postFilter).sort((a, b) => a - b), [4, 27]);
  assert.ok(selectors.every(d => d._targetMotion === 3 && d._maxNum === 1 && d._ignoreTargetFree === 0));
  const attack = rows('tokens', TOKEN).find(d => d._animKey === 'Skill');
  assert.equal(attack._activeBuffs.length, 1); assert.equal(attack._activeBuffs[0].buffKey, 'sluggish');
  assert.equal(attack._activeBuffs[0].loadFromDB, 1); assert.ok(e.buffDatabase.sluggish);
});
test('Machine output modifier retains damage category filters and selected source talent coefficients', () => {
  const nodes = e.templates['filter_tag[damage_scale]'].eventToActions.ON_OUTPUT_DAMAGE;
  assert.equal(nodes[0]._targetType, 'MODIFIER_TARGET'); assert.equal(nodes[0]._filterTag, 'machine');
  assert.equal(nodes[1]._damageMask, 'PHYSICAL_AND_MAGICAL'); assert.equal(nodes[1]._filterApplyWay, false);
  assert.equal(nodes[1]._isStackable, false);
  const talents = e.tables.character.talents[0].candidates;
  assert.deepEqual(talents.map(t => bb(t.blackboard).cnt), [3, 4, 5]);
  assert.deepEqual(talents.map(t => bb(t.blackboard).damage_scale), [1.1, 1.2, 1.2]);
  assert.ok(e.tables.tokens[TOKEN].talents[0].candidates.every(t => t.blackboard.length === 0));
});
test('native high-ground token spends8DP and one slot with four stacked cards plus ready card', () => {
  const root = rows('tokens', TOKEN).find(d => '_buildCondition' in d);
  assert.equal(root._buildCondition.buildableType, 2); assert.equal(root._buildCondition.needSpecifyDirection, 1);
  assert.equal(root._occupiedRemainingCharacterCnt, 1); assert.equal(root._withdrawCostRecoverRatio, .5);
  assert.equal(e.tables.tokens[TOKEN].position, 'RANGED');
  for (const phase of e.tables.tokens[TOKEN].phases) {
    const stats = phase.attributesKeyFrames.at(-1).data;
    assert.equal(stats.cost, 8); assert.equal(stats.respawnTime, 10);
    assert.equal(stats.maxDeckStackCnt, 4); assert.equal(stats.maxDeployCount, 5); near(stats.baseAttackTime, 1.6);
  }
  assert.equal(e.templates['charge_token[born]'].eventToActions.ON_OWNER_BORN[0]._refreshRemainingCnt, false);
  assert.equal(e.templates['lasher_s_2[gain_token]'].eventToActions.ON_BUFF_START[0]._rechargeTiming, 'NORMAL');
});
test('three original skeletons retain native single-skeleton token FaceSwitcher and RGBA texture bindings', () => {
  const front = e.officialSkeletonBindings[TOKEN].Front, back = e.officialSkeletonBindings[TOKEN].Back;
  assert.equal(front.sha256, back.sha256); assert.equal(front.skeletonAnimationPathId, back.skeletonAnimationPathId);
  assert.equal(front.faceSwitcherPathId, '-4195710545332664459'); assert.equal(front.alphaTexturePathId, '0');
  assert.notEqual(e.models[ID].Front.sha256, e.models[ID].Back.sha256);
  for (const face of ['Front', 'Back']) {
    assert.equal(data.sd.models[`operator/${TOKEN}/default/${face.toLowerCase()}`].skeleton.sha256, e.models[TOKEN][face].sha256);
    near(e.models[ID][face].hits.Attack[0], .533); near(e.models[ID][face].hits.Skill_1_Loop[0], .1);
    near(e.models[TOKEN][face].hits.Attack[0], .567); near(e.models[TOKEN][face].hits.Skill[0], .533);
    assert.ok(e.models[TOKEN][face].eventPayloads.Attack.some(v => v.name === 'OnAttack'));
  }
});
