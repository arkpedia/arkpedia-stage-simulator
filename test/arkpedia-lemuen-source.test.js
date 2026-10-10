// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_4193_lemuen';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const all = group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components));
const component = (group, id) => all(group).find(c => c.pathId === id).data;
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
function nodes(value, predicate, found = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    let decoded; try { decoded = JSON.parse(value); } catch { return found; }
    nodes(decoded, predicate, found);
  } else if (value && typeof value === 'object') {
    if (!Array.isArray(value) && predicate(value)) found.push(value);
    for (const child of Object.values(value)) nodes(child, predicate, found);
  }
  return found;
}
const type = name => n => n.$type?.split(',')[0].endsWith(`+${name}`);

test('the complete source foundation stays held until the full controller and public path are reviewed', () => {
  assert.deepEqual(e.enabledOperators, []); assert.deepEqual(e.heldOperators, [ID]);
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.equal(e.source.bundles.length, 5); assert.deepEqual(e.nativeTemplateGaps, []);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.equal(Object.keys(e.templates).length, 15); assert.equal(Object.keys(e.projectiles).length, 6);
  assert.equal(all('characters').length + all('skills').length + all('projectiles').length, 190);
  assert.equal(e.frameParity, false); assert.equal(e.moduleSupport, false); assert.equal(e.nativeParticleSupport, false);
  assert.equal(e.impactContracts.length, 3); assert.ok(e.impactContracts.some(c => /unverified/.test(c)));
});
test('all thirty source ranks retain ammunition, recovery and selected aim/bombardment parameters', () => {
  for (const [id, skill] of Object.entries(e.tables.skills)) {
    assert.equal(skill.levels.length, 10);
    for (const level of skill.levels) {
      assert.equal(level.duration, -1);
      assert.equal(level.spData.spType, id.endsWith('_1') ? 'INCREASE_WHEN_ATTACK' : 'INCREASE_WITH_TIME');
      const bb = flat(level.blackboard); assert.ok(bb['attack@trigger_time'] > 0);
      if (id.endsWith('_2')) {
        near(bb['attack@main_atk_scale'] + bb['attack@ex_atk_scale'] * bb['attack@trig_cnt'], bb['attack@fin_atk_scale']);
        near(bb['attack@interval'] * bb['attack@trig_cnt'], bb['attack@aim_duration']);
      }
      if (id.endsWith('_3')) {
        assert.ok(bb['attack@dist_1'] < bb['attack@dist_2']);
        assert.equal(bb['attack@limited_hit_time'], 1);
      }
    }
  }
});
test('S2 aim checks lethal damage before increasing its coefficient and snapshots ATK on finish', () => {
  const actions = e.templates.lemuen_s2_aim_attack.eventToActions;
  const init = actions.ON_BUFF_START[0]; assert.equal(init._copyFromKey, 'main_atk_scale');
  const check = actions.ON_BUFF_TRIGGER[0]; assert.ok(type('CheckAbilityDamageDeadly')(check._conditionNode));
  assert.ok(type('FinishBuff')(check._succeedNodes[0]));
  assert.equal(check._failNodes[0]._additionKey, 'ex_atk_scale');
  const snapshot = actions.ON_BUFF_FINISH[0];
  assert.ok(type('AssignAttributeToBB')(snapshot)); assert.equal(snapshot._attributeType, 'ATK');
  assert.equal(snapshot._scaleVar, 'curr_atk_scale'); assert.equal(snapshot._blackboardKey, 'current_value');
  const damage = nodes(e.projectiles.projectile_chr_lemuen_s2, type('FixedValueDamage'))[0];
  assert.equal(damage._damageKey, 'current_value'); assert.equal(damage._damageType, 'PHYSICAL');
  assert.equal(damage._ignoreCancelReasonMask, 'NONE,MISS'); assert.equal(damage._skipModifierEvent, false);
});
test('S3 retains the original managed parent/child chain and per-mark interval fields', () => {
  const actions = e.templates.lemuen_s3_end.eventToActions.ON_BUFF_START;
  assert.equal(actions[0]._blackboardKey, 'cached_atk');
  assert.ok(type('EmitProjectileFromManagedProjectiles')(actions[1]));
  assert.equal(actions[1]._projectileKey, 'projectile_chr_lemuen_s3');
  assert.equal(actions[1]._copyBb, true); assert.equal(actions[1]._useProjectileAsSource, true);
  assert.equal(actions[1]._addBbKeyForEachProjectile, 'hit_interval');
  near(actions[1]._addBbDefaultValue, .1); near(actions[1]._addBbValue, .3);
  assert.ok(type('FinishManagedProjectiles')(actions[2]));
  const collider = component('projectiles', '2797357216171257936');
  assert.equal(collider._intervalBbKey, 'hit_interval');
  assert.equal(collider._limitedHitTimesBbKey, 'limited_hit_time');
  assert.equal(collider._stopWhenLimitedHitTimesUsedUp, 1);
  const emitter = component('projectiles', '9133739682859741264');
  assert.equal(emitter._ev, 2);
  const child = nodes(emitter, type('EmitProjectileFromProjectile'))[0];
  assert.equal(child._projectileKey, 'projectile_chr_lemuen_s3_attack');
  assert.equal(child._emitOffsetBbKey, 'emit_offset');
  near(component('projectiles', '-2502470814032737163')._lifeTime, .25);
});
test('both S3 damage rings retain cached Physical splash instead of impact-time ATK', () => {
  const condition = e.templates.lemuen_s3_attack.eventToActions.ON_BUFF_START[0];
  assert.equal(condition._conditionNode._distBbKey, 'dist_1');
  assert.equal(condition._conditionNode._condType, 'LE');
  const damage = nodes(condition, type('FixedValueDamage'));
  assert.deepEqual(damage.map(n => n._multiplierKey), ['proj_atk_scale_1', 'proj_atk_scale_2']);
  for (const n of damage) {
    assert.equal(n._damageKey, 'cached_atk'); assert.equal(n._damageType, 'PHYSICAL');
    assert.equal(n._attackType, 'SPLASH'); assert.equal(n._skipModifierEvent, false);
  }
});
test('Wanted uses Laterano damage-source tags and derived marks, without an invented attack-only filter', () => {
  const damage = e.templates.char_lemuen_range_aim.eventToActions.ON_TAKE_DAMAGE;
  assert.ok(type('CheckCharacterGroupTag')(damage[0]));
  assert.equal(damage[0]._targetType, 'MODIFIER_SOURCE'); assert.equal(damage[0]._groupTag, 'laterano');
  assert.ok(type('DamageScale')(damage[1])); assert.equal(damage[1]._filterApplyWay, false);
  assert.equal(damage[1]._filterDamageType, false);
  const ticks = nodes(e.templates.char_lemuen_laterano_range, n => n._buff?.templateKey === 'char_lemuen_laterano_range[tick]');
  assert.equal(ticks.length, 2); assert.equal(ticks[0]._buff.overrideType, 'STACK');
  assert.equal(ticks[1]._buff.disableOverride, true);
  assert.equal(e.tables.character.talents[0].candidates.at(-1).blackboard[0].value, 6);
});
test('delayed Talent2 changes maximum ammunition without silently restoring the current count', () => {
  const candidate = e.tables.character.talents[1].candidates[0];
  assert.deepEqual(flat(candidate.blackboard), { interval: 20, atk: .1, add_count: 1, ex_add_count: 0 });
  const changes = nodes(e.templates.lemuen_t_2, type('AmmoSkillCountModifier'));
  assert.equal(changes.length, 1); assert.equal(changes[0]._modifyMaxCount, true);
  assert.equal(changes[0]._addCountBBKey, 'add_count'); assert.equal(changes[0]._recoverEventCount, false);
});
test('original facing clips and events stay distinct from generic attack intervals', () => {
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    near(model.durations.Attack_Begin, .267); near(model.durations.Attack_Loop, 2.7);
    near(model.durations.Skill_1_Begin, .2); near(model.hits.Attack_Loop[0], .167);
    assert.deepEqual(model.hits.Skill_2_End, [0]); assert.deepEqual(model.hits.Skill_3_End, [0]);
    assert.equal(model.sha256, e.officialSkeletonBindings[ID][face].sha256);
  }
  assert.ok(e.models[ID].Front.durations.Skill_Down_1_Loop);
});

test('aim trigger and managed projectile lifetimes remain native fields rather than generic skill durations', () => {
  const aiming = component('characters', '-6940815333245527525')._buffs[0];
  assert.equal(aiming.waitFirstTriggerInterval, 0); assert.equal(aiming.lifeTimeType, 1);
  assert.equal(aiming.durationKey, 'aim_duration');
  const parent = component('projectiles', '-2682328012059873200');
  assert.equal(parent._lifeTime, 10); assert.equal(parent._lifeTimeType, 1);
  assert.equal(parent._managedBySource, 0); assert.equal(parent._stopAfterFirstHit, 1);
  assert.equal(parent._stopWhenSourceInvalid, 0);
  const child = component('projectiles', '-2502470814032737163');
  assert.equal(child._lifeTime, .25); assert.equal(child._alwaysReachInTheEnd, 1);
  assert.equal(child._stopWhenSourceInvalid, 0);
});
test('Wanted selectors do not restrict marks to their own source', () => {
  for (const id of ['5150534373900409371', '4206040012710402587']) {
    const selector = component('characters', id);
    assert.equal(selector._buffKey, 'char_lemuen_range_aim'); assert.equal(selector._filterBuffSource, 0);
  }
  const s3 = component('characters', '1495319038171142683');
  assert.deepEqual(s3._buffs, ['lemuen_s3_range', 'char_lemuen_range_aim']); assert.equal(s3._filterBuffSource, 0);
});

test('mode/selector and progress records preserve S1 grouping and S2 ordinary fallback', () => {
  const s1 = component('characters', '7801039473947105819');
  assert.equal(s1._maxNum, 2); assert.equal(s1._sortAsSelectorOrder, 0);
  assert.equal(s1._onlyResizeWhenFilter, 1);
  const progress = component('characters', '-994602773985109477');
  assert.equal(progress._expendPerTrigger, 1); assert.equal(progress._countEvent, 4);
  assert.equal(progress._resetWhenAttackFinished, 1); assert.equal(progress._resetImmediatelyWhenProgressEnd, 0);
  const fallback = component('characters', '2370178821216852507');
  assert.deepEqual(fallback._abilities.map(p => p.m_PathID), ['-3206290821302134245', '7634395930177755675']);
  assert.equal(fallback._coolDownAbilityIndex, 1);
  const animation = component('characters', '795574543030671899');
  assert.deepEqual(animation._default, { beginAnim: 'Skill_2_Begin', loopAnim: 'Skill_2_Idle', endAnim: 'Skill_2_End' });
  assert.equal(animation._waitForAttachFinishEvent, 1);
});
test('original ammunition skills retain deactivation and distinct activation-animation choices', () => {
  const ids = ['-8869155622810923566', '-7874779650039904576'];
  for (const id of ids) {
    const s = component('skills', id);
    assert.equal(s._canDiscardRemainingCount, 1); assert.equal(s._finishSkillWithProgress, 1);
    assert.equal(s._allowSpRecoveryWhenAffecting, 0); assert.equal(s._uninterruptibleOnAbilityPredelay, 1);
  }
  const first = component('skills', ids[0]), second = component('skills', ids[1]);
  assert.equal(first._playSkillBeginAnim, 1); assert.equal(first._beginAnim, 'Skill_1_Begin');
  assert.equal(second._playSkillBeginAnim, 0); assert.equal(second._beginAnim, '');
  const mark = component('characters', '-3762993244653430245');
  near(mark._preDelay, .10000000149011612); assert.equal(mark._cooldownKey, 'aim_interval');
  assert.equal(mark._selectTargetTiming, 1); assert.equal(mark._waitForAttackEvent, 0);
});
