// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-jessica-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID = 'char_1034_jesca2', TOKEN = 'token_10032_jesca2_jckshd';
const rows = (group, id) => e[group][id].flatMap(r => r.components.map(c => c.data));
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function nodes(value, match, result = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try { nodes(JSON.parse(value), match, result); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  } else if (value && typeof value === 'object') {
    if (!Array.isArray(value) && match(value)) result.push(value);
    for (const child of Object.values(value)) nodes(child, match, result);
  }
  return result;
}
const type = name => n => n.$type?.split(',')[0].endsWith(`+${name}`);

test('Jessica enables all three source skills and the complete shield dependency together', () => {
  assert.deepEqual(e.enabledOperators, [ID]);
  const skillIds = ['skchr_jesca2_1', 'skchr_jesca2_2', 'skchr_jesca2_3'];
  assert.deepEqual(e.runtimeMapping.skillIds, skillIds);
  assert.match(e.reviewStatus, /bounded regular-stage combat adapter/);
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, skillIds);
  assert.deepEqual(data.operators[ID].skills.map(s => s.id), skillIds);
  assert.ok(data.tokens[TOKEN]);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.source.bundles.length, 6);
  assert.equal(Object.keys(e.tables.skills).length, 3);
  assert.equal(Object.keys(e.templates).length, 17);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.deepEqual(e.nativeTemplateGaps, []);
  for (const skill of Object.values(e.tables.skills)) assert.equal(skill.levels.length, 10);
  for (const bundle of e.source.bundles) {
    assert.match(bundle.md5, /^[a-f0-9]{32}$/); assert.match(bundle.sha256, /^[a-f0-9]{64}$/);
    assert.ok(bundle.size > 0);
  }
  assert.equal(Object.values(e.characters).concat(Object.values(e.skills), Object.values(e.tokens),
    Object.values(e.projectiles)).flatMap(r => r.flatMap(v => v.components)).length, 225);
});

test('serialized S3 shell actions retain the sixth explosion dependency and two distinct event branches', () => {
  assert.deepEqual(Object.keys(e.projectiles).sort(), ['projectile_chr_jesca2', 'projectile_chr_jesca2_s1',
    'projectile_chr_jesca2_s2', 'projectile_chr_jesca2_s3', 'projectile_chr_jesca2_s3_bomb',
    'projectile_chr_jesca2_s3_explosion']);
  const shell = rows('projectiles', 'projectile_chr_jesca2_s3_bomb');
  const actions = shell.filter(d => d._actions?.SerializedState);
  assert.deepEqual(actions.map(d => d._ev).sort(), [0, 1]);
  for (const action of actions) {
    assert.equal(typeof action._actions.SerializedState, 'string');
    const emitted = nodes(action, type('EmitProjectile'));
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]._projectileKey, 'projectile_chr_jesca2_s3_explosion');
    assert.equal(emitted[0]._useProjectileAsTarget, true);
    assert.equal(emitted[0]._overwriteActions, true); assert.equal(emitted[0]._overwriteBuffs, false);
    const hit = emitted[0]._actions[0];
    assert.equal(hit._damageType, 'PHYSICAL'); assert.equal(hit._applyWay, 'RANGED');
    assert.equal(hit._atkScaleVar, 'atk_scale'); assert.equal(hit._forceUseProjectileCachedAtk, false);
  }
});

test('S3 shell collides with passersby, then creates a separate immediate wall-crossing splash', () => {
  const shell = rows('projectiles', 'projectile_chr_jesca2_s3_bomb');
  near(shell.find(d => d._speed != null)._speed, 5);
  const selector = shell.find(d => d._hitPasserby != null);
  assert.equal(selector._hitPasserby, 1); assert.equal(selector._onlyCheckHitWhenStop, 0);
  near(selector._interval, .03); near(shell.find(d => d.m_Radius != null).m_Radius, .5);
  const body = shell.find(d => d._lifeTime != null);
  assert.equal(body._stopAfterFirstHit, 1); assert.equal(body._alwaysHitTraceTargetInTheEnd, 0);
  assert.equal(body._stopWhenSourceInvalid, 0); assert.equal(body._actionController._dontAddBuffs, 1);
  const explosion = rows('projectiles', 'projectile_chr_jesca2_s3_explosion');
  near(explosion.find(d => d.m_Radius != null).m_Radius, 1.7);
  assert.equal(explosion.find(d => d._immediatelyReach != null)._immediatelyReach, 1);
  const area = explosion.find(d => d._goThroughWall != null);
  assert.equal(area._goThroughWall, 1); assert.equal(area._onlyCheckHitWhenReachTarget, 1);
  assert.equal(area._targetOptions.targetMotion, 3); assert.equal(area._ignoreCamouflage, 1);
  assert.equal(explosion.find(d => d._lifeTime != null)._actionController._dontAddBuffs, 0);
});

test('shield changes body direction immediately but waits for free idle facing, then restores the saved direction', () => {
  const source = e.templates.jesca2_jckshd_dir_set;
  const save = nodes(source, type('AssignDirectionToBB'))[0];
  assert.equal(save._blackboardKey, 'old_direction'); assert.equal(save._targetType, 'BUFF_OWNER');
  const relative = nodes(source, type('AssignRelativeDirectionToBB'))[0];
  assert.equal(relative._sourceType, 'BUFF_OWNER'); assert.equal(relative._targetType, 'BUFF_SOURCE');
  const shieldFace = nodes(source, type('SetBodyDirection'))[0];
  assert.equal(shieldFace._targetType, 'BUFF_SOURCE'); assert.equal(shieldFace._includeFace, true);
  const wait = nodes(source, n => n._buff?.buffKey === 'jesca2_jckshd_dir_set[wait]')[0]._buff;
  near(wait.triggerInterval, .1); assert.equal(wait.waitFirstTriggerInterval, false);
  for (const [key, direction] of [['jesca2_jckshd_dir_set[wait]', 'direction'],
    ['jesca2_jckshd_dir_ctrl[reset]', 'old_direction']]) {
    const template = e.templates[key];
    const body = nodes(template, type('SetBodyDirection'))[0];
    assert.equal(body._directionKey, direction); assert.equal(body._includeFace, false);
    assert.deepEqual(nodes(template, type('CheckAbnormalFlags'))[0]._abnormalFlags, ['STUNNED', 'FROZEN']);
    assert.equal(nodes(template, type('CheckAbnormalCombo'))[0]._abnormalCombo, 'SLEEPING');
    assert.equal(nodes(template, type('CheckBlocked')).length, 1);
    assert.equal(nodes(template, type('TryResetCharacterFaceIdleDirection')).length, 1);
  }
  const reset = nodes(e.templates['jesca2_jckshd_dir_ctrl[self]'],
    n => n._buffData?.buffKey === 'jesca2_jckshd_dir_ctrl[reset]')[0];
  assert.ok(reset); near(reset._buffData.triggerInterval, .1);
});

test('shield placement retains cardinal host range, zero deployment slots and recharge on finish', () => {
  const root = rows('tokens', TOKEN).find(d => d._occupiedRemainingCharacterCnt != null);
  assert.equal(root._occupiedRemainingCharacterCnt, 0);
  assert.equal(root._buildCondition.buildableType, 1);
  assert.equal(root._buildCondition.needSpecifyDirection, 0);
  assert.equal(root._buildCondition.limitByHostAbilityRange, 1);
  assert.equal(root._buildCondition.abilityName, 'TokenRange');
  assert.equal(root._withdrawCostRecoverRatio, .5);
  assert.deepEqual(e.tables.ranges['x-5'].grids.map(({row, col}) => Math.abs(row) + Math.abs(col)).sort(), [0, 1, 1, 1, 1]);
  assert.deepEqual(e.tables.ranges['b-1'].grids, [{ row: 0, col: -1 }, { row: 0, col: 0 }]);
  const token = e.tables.tokens[TOKEN];
  for (const phase of token.phases) {
    const stats = phase.attributesKeyFrames.at(-1).data;
    assert.equal(stats.blockCnt, 2); assert.equal(stats.cost, 5);
    assert.equal(stats.respawnTime, 30); assert.equal(stats.maxDeployCount, 1);
  }
  assert.equal(e.templates['charge_token[finish]'].eventToActions.ON_OWNER_FINISH[0]._rechargeTiming, 'ON_FINISH');
  assert.equal(e.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0]._checkContainsBuff, false);
  const suicide = e.templates['jesca2_jckshd_t[suicide]'];
  assert.equal(suicide.eventToActions.ON_BUFF_START[0]._isSkillCountDown, false);
  assert.equal(suicide.eventToActions.ON_BUFF_FINISH[0]._force, true);
});

test('shield damage SP retains source probability, potential gates and ordinary SP restrictions', () => {
  const talents = e.tables.character.talents;
  const shieldTalent = e.tables.tokens[TOKEN].talents[0].candidates;
  assert.deepEqual(shieldTalent.map(t => bb(t.blackboard).duration), [20, 35, 50]);
  assert.ok(shieldTalent.every(t => bb(t.blackboard).taunt_level === 1));
  assert.deepEqual(talents[0].candidates.filter(t => t.requiredPotentialRank === 0).map(t => bb(t.blackboard).def), [.05, .1, .15]);
  assert.deepEqual(talents[1].candidates.map(t => t.requiredPotentialRank), [0, 4]);
  assert.deepEqual(talents[1].candidates.map(t => bb(t.blackboard).prob), [.5, .55]);
  assert.ok(talents[1].candidates.every(t => t.unlockCondition.phase === 'PHASE_2' && bb(t.blackboard).sp === 1));
  const actions = e.templates['jesca2_t_2[sp]'].eventToActions.ON_TAKE_DAMAGE;
  assert.equal(actions[0]._probKey, 'prob'); assert.equal(actions[1]._targetType, 'BUFF_SOURCE');
  assert.equal(actions[1]._spString, 'sp'); assert.equal(actions[1]._forceFlag, false);
  assert.equal(actions[1]._dontCheckSpType, false);
});

test('S1 is permanent auto activation; S2 and S3 BAT modifiers are flat additions', () => {
  const s1 = e.tables.skills.skchr_jesca2_1.levels.at(-1);
  assert.equal(s1.skillType, 'AUTO'); assert.equal(s1.duration, -1);
  assert.equal(s1.spData.spCost, 70); assert.deepEqual(bb(s1.blackboard), {def: .7, atk: .7, duration: 30});
  for (const id of ['skchr_jesca2_2', 'skchr_jesca2_3']) {
    const buff = rows('skills', id).find(d => d._buffs?.some(b => b.buffKey.endsWith('[switch]')));
    const bat = buff._buffs.flatMap(b => b.attributes.attributeModifiers).find(a => a.attributeType === 8);
    assert.equal(bat.formulaItem, 0); assert.equal(bat.loadFromBlackboard, 1);
  }
  const s2 = e.tables.skills.skchr_jesca2_2.levels.at(-1);
  near(bb(s2.blackboard).base_attack_time, -.9); assert.equal(bb(s2.blackboard).prob, .75);
  assert.equal(s2.duration, 15); assert.equal(s2.rangeId, '2-5');
  assert.equal(e.templates.evade.eventToActions.ON_TAKE_DAMAGE[0]._damageMask, 'PHYSICAL_AND_MAGICAL');
});

test('S3 retains twenty rounds, composite main/extra progress, down mode and interruption cleanup', () => {
  const root = rows('skills', 'skchr_jesca2_3').find(d => d._fetchFromMainAttack != null);
  assert.equal(root._showSpAsBulletMode, 1); assert.equal(root._fetchFromMainAttack, 1);
  assert.equal(root._fromMainRawAttack, 0); assert.deepEqual(root._extraModeIndex, [4]);
  assert.equal(root._useExtraModeProgress, 1); assert.equal(root._finishSkillWithProgress, 1);
  assert.equal(root._canDiscardRemainingCount, 1);
  const rank = e.tables.skills.skchr_jesca2_3.levels.at(-1), values = bb(rank.blackboard);
  assert.equal(rank.durationType, 'AMMO'); assert.equal(values['attack@trigger_time'], 20);
  assert.equal(values['attack@extrabomb.atk_scale'], 2.5); assert.equal(values['attack@extrabomb.stun'], 6);
  const original = e.characters[ID].flatMap(r => r.components.map(c => ({ object: r.object, ...c })));
  const byId = new Map(original.map(c => [c.pathId, c]));
  const composites = original.filter(c => c.data._abilityConfigs);
  assert.equal(composites.length, 2);
  for (const composite of composites) {
    assert.equal(composite.data._category, 4);
    assert.deepEqual(composite.data._abilityConfigs.map(a => byId.get(a._ability.m_PathID).object),
      ['ExtraBomb', 'S3Attack']);
  }
  const counters = original.filter(c => c.data._triggerTimeCount != null);
  assert.equal(counters.length, 2);
  for (const counter of counters) {
    assert.equal(counter.object, 'S3Attack'); assert.equal(counter.data._countEvent, 4);
    assert.equal(counter.data._expendPerTrigger, 1); assert.equal(counter.data._resetAfterEnd, 1);
  }
  const switchGraph = e.templates['jesca2_s_3[switch]'];
  assert.ok(switchGraph.eventToActions.ON_DIRECTION_CHANGED);
  assert.equal(nodes(switchGraph, type('CheckCharacterDefaultDirection'))[0]._direction, 'DOWN');
  const cleanup = nodes(switchGraph.eventToActions.ON_BUFF_FINISH, type('FinishBuffsById'))[0];
  assert.equal(cleanup._buffKey, 'jesca2_s_3_trigger[extra_bomb]');
  const bomb = e.templates['jesca2_s_3[bomb]'];
  const interrupt = nodes(bomb, type('InterruptCharacterAttack'))[0];
  assert.equal(interrupt._resetAndClearCD, true); assert.equal(interrupt._forceUseCharacterAttack, true);
  assert.ok(e.buffDatabase.stun);
});

test('original operator events and both default shield material chains retain exact pointer identities', () => {
  for (const face of ['Front', 'Back']) {
    const m = e.models[ID][face];
    assert.equal(m.sha256, e.officialSkeletonBindings[ID][face].sha256);
    assert.deepEqual(m.hits.Skill_1_Loop, [.067]); assert.deepEqual(m.hits.Skill_2_Loop, [.033]);
    assert.deepEqual(m.hits.Skill_3_Skill, [.033]);
    const shield = e.originalShieldModels.models[TOKEN].facings[face.toLowerCase()];
    assert.deepEqual(shield.animationRoles, { idle: 'Idle', deploy: 'Start', die: 'Die', attack: null });
    assert.deepEqual(shield.hits, {});
    assert.equal(shield.files[`${TOKEN}.skel`].sha256, e.officialSkeletonBindings[TOKEN][face].sha256);
  }
  const f = e.officialSkeletonBindings[TOKEN].Front, b = e.officialSkeletonBindings[TOKEN].Back;
  for (const key of ['skeletonAnimationPathId','textAssetPathId','atlasTextAssetPathId',
    'materialPathId','rgbTexturePathId','alphaTexturePathId']) assert.notEqual(f[key], b[key]);
  assert.notEqual(f.sha256, b.sha256);
  const walk = (v, key = '') => {
    if (key === 'm_PathID') assert.equal(typeof v, 'string');
    if (typeof v === 'number') assert.ok(Number.isFinite(v));
    else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) walk(child, k);
  };
  walk(e);
});
