// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-coldshot-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';

const ID = 'char_4104_coldst';
const rows = Object.values(e.characters).flatMap(rs => rs.flatMap(r => r.components));
const component = id => rows.find(c => c.pathId === id).data;
const bb = values => Object.fromEntries(values.map(v => [v.key, v.value]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function nodes(value, predicate, out = []) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try { nodes(JSON.parse(value), predicate, out); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  } else if (value && typeof value === 'object') {
    if (!Array.isArray(value) && predicate(value)) out.push(value);
    for (const child of Object.values(value)) nodes(child, predicate, out);
  }
  return out;
}
const type = name => n => n.$type?.split(',')[0].endsWith(`+${name}`);

test('Coldshot complete ordinary kit retains native evidence and separates local execution contracts', () => {
  assert.deepEqual(e.enabledOperators, [ID]);
  assert.deepEqual(e.heldOperators, []);
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'coldshot');
  assert.deepEqual(data.operators[ID].skills.map(s => s.id), ['skcom_atk_up[3]', 'skchr_coldst_2']);
  assert.match(e.reviewStatus, /explicit local execution contracts/);
  assert.equal(e.runtimeContracts.length, 7);
  assert.ok(e.historicalHoldReasons.some(r => /ReloadAttack/.test(r)));
  assert.equal(e.frameParity, false);
  assert.equal(e.moduleSupport, false);
  assert.equal(e.nativeParticleSupport, false);
  assert.deepEqual(e.nativeTemplateGaps, []);
  assert.equal(e.source.bundles.length, 5);
  assert.deepEqual(Object.keys(e.originalTemplates), Object.keys(e.templates));
  assert.ok(e.templates.empty);
  assert.ok(e.templates.switch_mode_restart_fsm);
  assert.ok(e.buffDatabase.sluggish);
});

test('ammo capacity and multiplier come from the selected elite trait', () => {
  const candidates = e.tables.character.trait.candidates;
  assert.deepEqual(candidates.map(c => c.unlockCondition.phase), ['PHASE_0', 'PHASE_1', 'PHASE_2']);
  assert.deepEqual(candidates.map(c => bb(c.blackboard).value), [4, 6, 8]);
  for (const c of candidates) near(bb(c.blackboard).atk_scale, 1.2);
  assert.deepEqual(e.tables.character.phases.map(p => p.rangeId), ['3-12', '4-9', '4-9']);
  const writes = nodes(e.templates.coldst_tr, type('ModifyAbilityBlackboard'));
  assert.deepEqual(writes.slice(0, 2).map(n => [n._blackboardKeys, n._fromBlackboardKeys]),
    [['max_cnt', 'value'], ['cnt', 'value']]);
  assert.equal(writes[2]._blackboardKeys, 'display_hunter_bullet_flag');
  assert.equal(writes[2]._value, 1);
});

test('both composite modes retain normal fire, reload-break fire and reload branches', () => {
  for (const [id, abilities] of [
    ['1926503580086732505', ['2439826047398807257', '-6650477657556678951', '2711397879937533657']],
    ['4316055058026563289', ['-4813715019863324967', '7204898962701125337', '3213086470549767897']],
  ]) {
    const composite = component(id);
    assert.equal(composite._category, 4);
    assert.equal(composite._selectAbilitySequentially, 0);
    assert.equal(composite._firstAttackIfAbilityChanged, 1);
    assert.equal(composite._updateCooldownBySubAbilityCooldownDuringCasting, 1);
    assert.deepEqual(composite._abilityConfigs.map(c => c._ability.m_PathID), abilities);
    const triggers = composite._abilityConfigs.map(c => component(c._trigger.m_PathID));
    assert.deepEqual(triggers.slice(0, 2).map(t => [t._checkReloadFlag, t._reloadFlag]), [[1, 0], [1, 1]]);
    for (const t of triggers.slice(0, 2)) assert.deepEqual(t._triggerValidType.toSorted(), [0, 1]);
    assert.deepEqual(triggers[2]._triggerValidType.toSorted(), [1, 2]);
    assert.equal(triggers[2]._checkReloadFlag, 0);
  }
});

test('returning targets have explicit reload-break animations in both modes', () => {
  for (const [id, begin, loop] of [
    ['-6518740036063951143', 'Reload_Break', 'Attack_Loop'],
    ['1918141978749470425', 'Skill_2_Reload_Break', 'Skill_2_Loop'],
  ]) {
    const controller = component(id);
    assert.equal(controller._beginAnim, begin);
    assert.equal(controller._oneshotAnim, loop);
    assert.equal(controller._onlyPlayBeginAnimWhenFirstAttack, 1);
    assert.equal(controller._overrideDownAnimation, 1);
    assert.equal(controller._minAnimScale, -1);
    assert.equal(controller._maxAnimScale, -1);
  }
  for (const id of ['2711397879937533657', '3213086470549767897']) {
    const reload = component(id);
    assert.equal(reload._allowNoTarget, 1);
    assert.equal(reload._timeMode, 1);
    assert.equal(reload._waitForAttackEvent, 1);
  }
});

test('original reload events differ from fire events and retain their exact payloads', () => {
  for (const face of ['Front', 'Back']) {
    const model = e.models[ID][face];
    for (const [clip, duration, event] of [
      ['Attack_Loop', 1.6, .06666667014360428], ['Reload_Loop', 1.6, 1],
      ['Skill_2_Loop', 2.4, .06666667014360428], ['Skill_2_Reload_Loop', 2.4, 1.5],
    ]) {
      near(model.durations[clip], duration);
      assert.deepEqual(model.eventPayloads[clip], [{ time: event, name: 'OnAttack', int: 0, float: 0, string: '' }]);
    }
    near(model.durations.Reload_Break, .167);
    near(model.durations.Skill_2_Reload_Break, .167);
    const binding = e.officialSkeletonBindings[ID][face];
    assert.equal(binding.sha256, model.sha256);
    assert.equal(binding.byteLength, model.bytes);
    for (const key of ['animatorPathId', 'skeletonAnimationPathId', 'skeletonDataAssetPathId', 'textAssetPathId'])
      assert.match(binding[key], /^-?\d+$/);
  }
});

test('ammo controllers preserve numerical callbacks without inventing OnAttack equivalence', () => {
  const hooks = rows.map(r => r.data).filter(d => d._startEvent != null &&
    d._buffs?.some(b => ['coldst_tr_sub', 'coldst_tr_add'].includes(b.buffKey)));
  assert.equal(hooks.length, 6); // four fire variants and two reload variants
  for (const hook of hooks) {
    assert.equal(hook._startEvent, 5);
    assert.equal(hook._endEvent, 3);
    assert.equal(hook._forceFinishBuffOnCastEnd, 0);
    const buff = hook._buffs[0];
    assert.equal(buff.lifeTimeType, 0);
    assert.equal(bb(buff.blackboard).dynamic, buff.buffKey === 'coldst_tr_sub' ? -1 : 1);
  }
  const add = nodes(e.templates.coldst_tr_add, type('CalculateTraitAbilityBlackboard'));
  assert.equal(add[0]._addBlackboardKey, 'extra_add');
  assert.equal(add[0]._useTraitBBToAdd, true);
  // The graph supports module-added extra ammo, but the ordinary trait does
  // not supply that key. Its absence must not be mistaken for a two-round load.
  for (const c of e.tables.character.trait.candidates) assert.equal(bb(c.blackboard).extra_add, undefined);
  assert.ok(e.historicalHoldReasons.some(r => /event5/.test(r)));
});

test('reload flag cleanup is delayed and conditional on leaving the attack state', () => {
  for (const id of ['-3293066471068629287', '3969377027310847705']) {
    const buffs = component(id)._buffs;
    near(buffs[0].lifeTime, .2);
    assert.equal(buffs[0].buffKey, 'coldst_attack[flag_reset]');
  }
  const graph = e.templates['coldst_attack[flag_reset]'].eventToActions.ON_BUFF_FINISH;
  const condition = nodes(graph, type('CheckUnitInAttackState'))[0];
  assert.equal(condition._isUnset, true);
  const write = nodes(graph, type('AssignValueToTraitBB'))[0];
  assert.equal(write._blackboardKey, 'RELOAD_FLAG');
  assert.equal(write._value, 0);
});

test('both skill tables retain all ranks and S2 changes reload interval additively', () => {
  assert.deepEqual(Object.keys(e.tables.skills), ['skcom_atk_up[3]', 'skchr_coldst_2']);
  assert.deepEqual(Object.keys(e.skills), ['skcom_atk_up', 'skchr_coldst_2']);
  const s1 = e.tables.skills['skcom_atk_up[3]'].levels;
  const s2 = e.tables.skills.skchr_coldst_2.levels;
  assert.equal(s1.length, 10); assert.equal(s2.length, 10);
  assert.deepEqual(s1.map(l => bb(l.blackboard).atk), [.3, .35, .4, .45, .5, .55, .6, .75, .9, 1]);
  assert.ok(s1.every(l => l.duration === 30));
  assert.deepEqual(s2.map(l => l.duration), [20, 23, 26, 30, 33, 36, 40, 40, 40, 40]);
  for (const level of s2) {
    near(bb(level.blackboard).reload_interval, .8);
    near(bb(level.blackboard)['attack@sluggish'], 1);
  }
  const graph = e.templates['coldst_s_2[reload]'].eventToActions;
  for (const [event, subtract] of [['ON_BUFF_START', false], ['ON_BUFF_FINISH', true]]) {
    const n = nodes(graph[event], type('CalculateTraitAbilityBlackboard'))[0];
    assert.equal(n._isSub, subtract);
    assert.equal(n._addBlackboardKey, 'reload_interval');
    assert.equal(n._fromBlackboardKey, 'reload_interval');
    assert.equal(n._targetBlackboardKey, 'reload_interval');
  }
});

test('talent gates include the initial delay, attack-invalid state and selected potential', () => {
  const candidates = e.tables.character.talents[0].candidates;
  assert.deepEqual(candidates.map(c => bb(c.blackboard).atk_scale), [1.2, 1.23, 1.3, 1.33]);
  assert.deepEqual(candidates.map(c => c.requiredPotentialRank), [0, 4, 0, 4]);
  assert.ok(candidates.every(c => bb(c.blackboard)['attack@delay'] === 2));
  const talent = rows.map(c => c.data).find(d => d._buffs?.some?.(b => b.buffKey === 'coldst_t'))._buffs[0];
  near(talent.triggerInterval, .02); assert.equal(talent.waitFirstTriggerInterval, 1);
  const initial = nodes(e.templates.coldst_t.eventToActions.ON_BUFF_START, type('CreateBuff'))[0]._buff;
  assert.equal(initial.buffKey, 'coldst_t[not_valid_delay]');
  assert.equal(initial.durationKey, 'attack@delay');
  const guards = rows.map(c => c.data).filter(d => d._buffs?.includes?.('coldst_t[not_valid]'));
  assert.equal(guards.length, 4);
  for (const guard of guards) {
    assert.equal(guard._excludeKey, 1);
    assert.deepEqual(guard._buffs, ['coldst_t[not_valid]', 'coldst_t[not_valid_delay]']);
  }
});
