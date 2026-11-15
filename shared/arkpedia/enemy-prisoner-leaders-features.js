// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-prisoner-leaders-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
import { prisonerCounterNative } from './enemy-prisoner-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const action = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
export const isPrisonerLeader = r => Object.hasOwn(clocks.enemies, r.prefabKey);
const caster = r => r.prefabKey.startsWith('enemy_1120_vofwiz');
const stat = (attributeType, formulaItem = 0) => ({ attributeType, formulaItem, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 });
export function prisonerLeaderNative(r, n) {
  const c = clocks.enemies[r.prefabKey], root = n[r.prefabKey]?.[0], ranged = caster(r);
  if (!c || r.skills.length || r.applyWay !== (ranged ? 'NONE' : 'MELEE') || r.stats.dmgType !== (ranged ? 'none' : 'phys')
    || !same(r.talents.bb, { 'liberty.atk': .5, 'confinement.times': 4, 'confinement.attack_speed': -50,
      'confinement.def': 300, 'confinement.max_stack_cnt': -1, 'confinement.max_valid_stack_cnt': -1,
      ...(ranged ? { 'liberty.attack@max_target': 2, 'atkspeedup.attack_speed': r.prefabKey.endsWith('_2') ? 50 : 30 } : {}) })
    || !same(Object.keys(r.talents.groups).sort(), ranged ? ['atkspeedup','confinement','liberty'] : ['confinement','liberty'])
    || root?._modes.length !== 3 || root._commonAbilities.length || !prisonerCounterNative(n)) return false;
  for (const [i, ref] of root._modes.entries()) {
    const m = n.$ref(ref), combat = n.$ref(m?._combat);
    if (!m || m._generalAbilities.length !== (!ranged && i === 2 ? 1 : 0)
      || !fields(combat, { _interruptAbilityOnDetach: 0, _activeBuffs: [], _affectedBySlowDown: 1,
        _waitForAttackEvent: 1, _timeMode: 0, _atkScale: 1, _damageType: ranged ? 2 : 1, _attackType: 1,
        _animKey: ranged && i < 2 ? '' : 'Attack' })) return false;
    if (ranged && i === 2) {
      if (n.$ref(m._attack) !== combat || !fields(combat, { _projectileKey: 'projectile_enemy_vofwiz', _useCachedAtkOnly: 0,
        _selectTargetSource: 1, _selectTargetTiming: 0, _maxAnimScale: 1 })) return false;
      const s = n.$siblings(n.$ref(combat._selector)).find(x => '_targetSide' in x);
      if (!fields(s, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _postFilter: 4, _secondaryFilter: 2,
        _filterTag: 'prison', _sortByTauntAtLast: 1, _ignoreTargetFree: 0, _forceIgnoreCamouflage: 0,
        _limitTargetNum: 1, _maxTargetKey: 'max_target', _maxNum: 1 })) return false;
    } else if (!ranged && !fields(combat, { _selectTargetSource: 2, _maxAnimScale: Math.fround(1.1) })) return false;
    if (i) {
      const hook = n.$siblings(n.$ref(m._animatorHooker)).find(x => '_replaceAnimPairs' in x);
      const suffix = ranged ? `${i + 1}` : ['','_orange','_red'][i];
      if (!same(hook?._replaceAnimPairs, (ranged ? ['Default','Idle','Move','Die'] : ['Default','Idle','Attack','Move','Die'])
        .map(fromAnimKey => ({ fromAnimKey, toAnimKey: `${fromAnimKey}${suffix}` })))) return false;
    }
  }
  const prefix = ranged ? r.prefabKey.endsWith('_2') ? 'vofwiz_2' : 'vofwiz' : 'lifbos';
  const lists = n.Confinement?.filter(x => '_buffs' in x).map(x => x._buffs).sort((a,b) => a.length - b.length);
  if (lists?.length !== 2) return false;
  for (const [i, list] of lists.entries()) {
    if (list.length !== i + 2 || !fields(list[0], { buffKey: i ? 'enemy_confinement_final' : 'enemy_confinement', loadFromDB: 1 })
      || !fields(list[1], { buffKey: `${prefix}_confinement`, templateKey: 'empty', lifeTimeType: 2, isSilenceable: 0 })
      || !same(list[1].attributes.attributeModifiers, [stat(2)])
      || !same(list[1].attributes.abnormalFlags, ranged ? [11] : [])) return false;
    if (i && !fields(list[2], { templateKey: 'enemy_liberty[warning]', triggerLifeType: 1, triggerCnt: 1,
      triggerInterval: Math.fround(.05), waitFirstTriggerInterval: 1, firstTriggerInterval: -1, isSilenceable: 0 })) return false;
  }
  const liberty = n.Liberty?.find(x => '_buffs' in x)?._buffs;
  if (liberty?.length !== (ranged ? 2 : 3)
    || !fields(liberty[0], { buffKey: `${prefix}_liberty`, templateKey: 'empty', lifeTimeType: 2, isSilenceable: 0 })
    || !same(liberty[0].attributes.attributeModifiers, [stat(1, 1)])
    || liberty[1].buffKey !== 'enemy_liberty[state]' || !empty(liberty[1].attributes)) return false;
  if (ranged) {
    const aura = n.AtkSpeedUp?.find(x => '_targetValidator' in x), parts = n.$siblings(aura);
    const buff = aura?._buffs[0], validator = n.$ref(aura?._targetValidator);
    if (!fields(aura, { _selfOption: 0, _removeBuffWhenAbilityDetached: 1, _onlyDetactTargetWhenStarted: 0,
      _onlyDetectCurrentMapLayer: 0, _clearBuffsWhenDisappear: 0, _interval: 0, _passiveBuffs: [] })
      || aura._buffs.length !== 1 || !fields(buff, { buffKey: 'enemy_atkspeedup[aura]', templateKey: 'empty',
        isSilenceable: 1, independentCharacterSource: 0, maxStackCnt: 1, overrideType: 0, disableOverride: 0 })
      || !same(buff.attributes.attributeModifiers, [stat(7)])
      || !fields(validator?._targetOptions, { targetSide: 1, targetMotion: 3, targetCategory: 1,
        ignoreTargetFree: 0, ignoreAllyTargetFree: 0, enableAdvancedOptions: 0 })
      || !parts.some(x => x._isSilenceable === 1)) return false;
    const transport = n.$projectile('projectile_enemy_vofwiz');
    if (!transport.some(x => x._speed === 10 && x._useSourceDirection === 0)
      || !transport.some(x => x._lifeTime === 10 && x._stopWhenSourceInvalid === 0 && x._stopAfterMaxHit === 1)) return false;
  } else {
    const a = n.$ref(n.$ref(root._modes[2])._generalAbilities[0]);
    const s = n.$siblings(n.$ref(a?._selector));
    if (!fields(liberty[2], { buffKey: 'lifbos_trigger_ability_once', templateKey: 'lifbos_trigger_ability_once', lifeTimeType: 0 })
      || !same(liberty[2].blackboard, [{ key: 'ability_name', value: 0, valueStr: 'libertyothers' }])
      || !fields(a, { _metadata: { blackboardPrefix: '', namedAsAlias: 'libertyothers' }, _waitForAttackEvent: 0,
        _selectTargetSource: 1, _timeMode: 2, _cooldown: 0, _preDelay: 0, _allowNoTarget: 1, _affectedBySlowDown: 0 })
      || a._activeBuffs.length !== 1 || a._activeBuffs[0].templateKey !== 'enemy_liberty_force'
      || !s.some(x => x.m_Script.m_PathID === '6275044311115013764')
      || !s.some(x => fields(x, { _targetSide: 1, _targetMotion: 3, _targetCategory: 1, _excludeOwner: 1,
        _limitTargetNum: 0, _ignoreTargetFree: 0, _ignoreAllyTargetFree: 0 }))) return false;
    const once = n.$template('lifbos_trigger_ability_once')?.eventToActions.ON_BUFF_START;
    const trigger = n.$template('lifbos_trigger_ability')?.eventToActions.ON_BUFF_START;
    const force = n.$template('enemy_liberty_force')?.eventToActions.ON_BUFF_START;
    if (once?.length !== 3 || !action(once[0], 'CheckContainsBuff') || !same(once[0]._buffKeys, ['lifbos_trigger_ability'])
      || !action(once[1], 'IfNot') || !action(once[2], 'CreateBuff') || once[2]._buff.templateKey !== 'lifbos_trigger_ability'
      || once[2]._buff.lifeTimeType !== 'INFINITY' || once[2]._finishDerivedBuffIfParentFinish !== false
      || trigger?.length !== 1 || !action(trigger[0], 'TriggerAbility') || trigger[0]._checkCanUseAblityFlag !== false
      || force?.length !== 3 || !same(force[0]._buffKeys, ['enemy_confinement','enemy_confinement_final'])
      || !action(force[2], 'SwitchMode') || !fields(force[2], { _modeIndex: 2, _restartFSM: true })) return false;
  }
  const clips = ranged ? ['Attack'] : ['Attack_grey','Attack_orange','Attack_red'];
  return n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID === c.source.skeletonDataPathId
    && clips.every(clip => same(c.events[clip], [{ time: ranged ? Math.fround(17 / 30) : 1, name: 'OnAttack', int: 0, float: 0, string: '' }]));
}
export const PRISONER_LEADER_ABILITY = { kind: 'nativePrisoner', params: r => {
  const c = clocks.enemies[r.prefabKey], ranged = caster(r), suffixes = ranged ? ['', '2', '3'] : ['_grey','_orange','_red'];
  return { times: 4, atk: .5, aspd: -50, def: 300, warningDelay: Math.fround(.05), confinedDisarm: ranged,
    maxTargets: ranged ? 2 : 1, melee: !ranged, freeAll: !ranged, speed: 10, lifetime: 10,
    forms: suffixes.map(suffix => ({ idle: `Idle${suffix}`, move: `Move${suffix}`, die: `Die${suffix}` })),
    animations: suffixes.map(suffix => { const clip = ranged ? 'Attack' : `Attack${suffix}`;
      return { clip, type: ranged ? 'arts' : 'phys', duration: c.durations[clip], releases: c.events[clip].map(x => x.time) }; }) };
} };
export const PRISONER_SPEED_AURA = { kind: 'prisonerAttackSpeedAura', params: r => ({ aspd: r.talents.bb['atkspeedup.attack_speed'] }) };
