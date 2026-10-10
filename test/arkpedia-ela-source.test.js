// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_4123_ela', TOKEN = 'token_10033_ela_grzmot';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);
const all = group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components));
const component = (group, id) => {
  const c = all(group).find(c => c.pathId === id);
  assert.ok(c, `missing ${group} native component ${id}`); return c.data;
};
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const type = (node, name) => assert.ok(node.$type?.split(',')[0].endsWith(`+${name}`));

test('Ela ordinary kit is registered with explicit fidelity limits and intact source foundation', () => {
  assert.deepEqual(e.enabledOperators, [ID]); assert.deepEqual(e.heldOperators, []);
  assert.ok(REGULAR_OPERATORS[ID]); assert.ok(data.operators[ID]);
  assert.equal(e.runtimeMapping[ID], 'ela'); assert.equal(e.holdReasons.length, 0);
  assert.equal(e.historicalHoldReasons.length, 3); assert.equal(e.runtimeContracts.length, 7);
  assert.equal(e.source.bundles.length, 6); assert.equal(Object.keys(e.templates).length, 9);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(['characters', 'tokens', 'skills', 'projectiles'].map(g => all(g).length), [61, 35, 81, 57]);
  for (const key of ['frameParity', 'moduleSupport', 'nativeParticleSupport']) assert.equal(e[key], false);
});

test('all thirty owner and thirty mine ranks retain paired selected blackboards', () => {
  for (let n = 1; n <= 3; n++) {
    const owner = e.tables.skills[`skchr_ela_${n}`].levels;
    const token = e.tables.tokenSkills[`sktok_ela_${n}`].levels;
    assert.equal(owner.length, 10); assert.equal(token.length, 10);
    for (let rank = 0; rank < 10; rank++) {
      assert.deepEqual(token[rank].blackboard, owner[rank].blackboard);
      assert.equal(owner[rank].skillType, n === 1 ? 'AUTO' : 'MANUAL');
      assert.equal(owner[rank].spData.spType, n === 2 ? 'INCREASE_WHEN_ATTACK' : 'INCREASE_WITH_TIME');
      assert.equal(owner[rank].durationType, n === 3 ? 'AMMO' : 'NONE');
      const bb = flat(owner[rank].blackboard);
      assert.equal(bb.projectile_range, 1.7);
      if (n === 1) assert.equal(bb.damage_hitrate_physical, bb.damage_hitrate_magical);
      if (n === 2) assert.equal(owner[rank].duration, 20);
      if (n === 3) { assert.equal(bb['attack@trigger_time'], 40); assert.equal(bb.cnt, 2); }
    }
  }
  assert.deepEqual(Object.values(e.tables.skills).map(s => [s.levels.at(-1).spData.initSp, s.levels.at(-1).spData.spCost]), [[0, 18], [12, 16], [16, 34]]);
});

test('GRZMOT placement, trigger and effect area are separate source rules', () => {
  const root = component('tokens', '5242867256987310095');
  assert.equal(root._buildCondition._excludeOccupiedByWalkEnemy, 1);
  assert.equal(root._buildCondition.needSpecifyDirection, 0);
  assert.equal(root._buildCondition.limitByHostAttackRange, 0);
  assert.equal(root._useRealBornTimeFromAnim, 1);
  const trigger = component('skills', '2098100097939029315');
  assert.equal(trigger._targetMotion, 1); assert.equal(trigger._limitTargetNum, 1);
  assert.equal(trigger._forceIgnoreCamouflage, 0);
  near(component('skills', '-3427533867086758589').m_Radius, 1.35);
  near(component('skills', '6352912699480227139').m_Radius, 1.7);
  assert.deepEqual(e.tables.token.phases.map(p => {
    const s = p.attributesKeyFrames[0].data; return [s.maxDeployCount, s.maxDeckStackCnt];
  }), [[2, 1], [3, 2], [4, 3]]);
  assert.deepEqual(e.tables.character.talents[0].candidates.map(t => flat(t.blackboard).cnt), [1, 2, 2, 3, 3, 4]);
});

test('mine statuses and influence marker do not turn into generic direct damage', () => {
  const ids = ['506547561090465091', '-6526606968748946324', '-593922384919159651'];
  const keys = [['sluggish', 'ela_token_influence'], ['stun', 'ela_token_influence'], ['sluggish', 'ela_token_influence', 'weak[limit]']];
  for (let n = 0; n < 3; n++) {
    const ability = component('skills', ids[n]);
    assert.deepEqual(ability._activeBuffs.map(b => b.buffKey), keys[n]);
    assert.equal(ability._waitForAttackEvent, 1); assert.equal(ability._animKey, 'Attack');
    assert.equal(ability._allowNoTarget, 1);
  }
  const hitRate = component('skills', ids[0])._activeBuffs[1].attributes.attributeModifiers;
  assert.deepEqual(hitRate.map(m => [m.attributeType, m.formulaItem]), [[33, 3], [34, 3]]);
  const models = e.tokenModels[TOKEN];
  near(models.front.eventPayloads.Attack[0].time, 1 / 6);
  near(models.front.durations.Start, .3);
  assert.deepEqual(models.front, models.back);
});

test('Bullseye checks any mine influence and preserves cached damage as a distinct hook', () => {
  const nodes = e.templates.ela_t_2.eventToActions;
  for (const key of ['ON_CALCULATE_DAMAGE', 'ON_CALCULATE_CACHED_PROJECTILE_DAMAGE']) {
    assert.equal(nodes[key].length, 1); type(nodes[key][0], 'IfElse');
    const check = nodes[key][0]._conditionNode;
    type(check, 'CheckContainsBuff'); assert.deepEqual(check._buffKeys, ['ela_token_influence']);
    assert.equal(check._checkBuffSource, false); assert.equal(check._checkSourceHost, false);
    type(nodes[key][0]._succeedNodes[0], 'AtkScaleUp');
    type(nodes[key][0]._failNodes[0], 'Dice');
  }
  assert.deepEqual(e.tables.character.talents[1].candidates.map(t => flat(t.blackboard)), [{ atk_scale: 1.5, prob: .3 }, { atk_scale: 1.6, prob: .3 }]);
  assert.equal(component('characters', '5400400117896966950')._useCachedAtkOnly, 1);
  assert.equal(component('characters', '-7345763969213795546')._useCachedAtkOnly, 0);
});

test('death and withdrawal cannot trigger the same native finish output twice', () => {
  const events = e.templates['ela_t_1[dead]'].eventToActions;
  type(events.ON_OWNER_KILLED[0], 'AssignValueToBB');
  assert.equal(events.ON_OWNER_KILLED[0]._blackboardKey, 'Boomed');
  assert.equal(events.ON_OWNER_KILLED[1]._abilityName, 'DeadBoom');
  type(events.ON_OWNER_FINISH[0], 'IsBlackboardZero');
  assert.equal(events.ON_OWNER_FINISH[0]._var, 'Boomed');
  assert.equal(events.ON_OWNER_FINISH[1]._abilityName, 'WithdrawBoom');
  type(e.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0], 'KillTokens');
  for (const [name, rows] of Object.entries(e.projectiles)) {
    if (!/_(dead|withdraw)_/.test(name)) continue;
    const d = rows.flatMap(r => r.components).map(c => c.data);
    const death = name.includes('_dead_');
    near(d.find(x => '_delayToStart' in x)._delayToStart, death ? .8 : 0);
    near(d.find(x => '_lifeTime' in x)._lifeTime, death ? .9 : .1);
    assert.equal(d.find(x => '_onlyCheckHitWhenStop' in x)._onlyCheckHitWhenStop, 1);
  }
});

test('S3 owns the forty-round resource and manual remaining-count disposal', () => {
  const skill = component('skills', '8398027317812480393');
  assert.equal(skill._showSpAsBulletMode, 1); assert.equal(skill._fetchFromMainAttack, 1);
  assert.equal(skill._fromMainRawAttack, 1); assert.equal(skill._modeIndex, 2);
  assert.equal(skill._finishSkillWithProgress, 1); assert.equal(skill._canDiscardRemainingCount, 1);
  assert.equal(component('characters', '5777273068161856294')._expendPerTrigger, 1);
  assert.equal(component('skills', '8203374918865026260')._stopSpWhenTokenIsFull, 1);
  type(e.templates.ela_s_2and3.eventToActions.ON_BUFF_FINISH[1], 'RechargeToken');
});

test('owner facings and original base mine have distinct verified model provenance', () => {
  for (const face of ['Front', 'Back']) {
    assert.equal(e.officialSkeletonBindings[ID][face].sha256, e.models[ID][face].sha256);
    assert.equal(e.models[ID][face].hits.Attack_Loop[0], 0);
    assert.equal(e.models[ID][face].hits.Skill_3_Loop[0], 0);
  }
  const art = e.tokenArtwork;
  assert.equal(art.sourceBundle.path, 'pkgrps/btl_pfb_tokens_0.ab');
  const a = art.models[TOKEN].facings;
  assert.deepEqual(a.front.files, a.back.files);
  assert.equal(a.front.originalPathIds.alphaTexturePathId, '0');
  assert.equal(a.front.originalPathIds.skeletonAnimationPathId, a.back.originalPathIds.skeletonAnimationPathId);
  assert.equal(a.front.animationRoles.die, null);
  assert.match(e.recoveredFacts[7], /not the alternate skin/);
});
