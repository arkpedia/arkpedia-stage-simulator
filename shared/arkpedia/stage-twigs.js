// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import clocks from '../../data/arkpedia-twigs-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
const fields = (v, x) => !!v && Object.entries(x).every(([k, wanted]) => same(v[k], wanted));
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export const TWIGS = 'trap_086_larva';
export function twigsNativeReviewed(n = native) {
  const rows = n.prefabs[TWIGS]?.components ?? [], skill = n.prefabs.sktok_larva?.components ?? [];
  const find = (list, name, field) => list.find(c => c.object === name && field in c.data)?.data;
  const root = find(rows, TWIGS, '_modes'), dark = find(rows, 'DarkMode', '_attack');
  const attack = find(rows, 'Attack', '_activeBuffs'), selector = find(rows, 'AoeSelector', '_postFilter');
  const area = find(rows, 'AoeSelector', 'm_Radius'), auraArea = find(skill, 'Trigger', 'm_Radius');
  if (![area, auraArea].every(c => c?.m_Radius === Math.fround(1.1) && same(c.m_Offset, { x: 0, y: 0 }))
    || clocks.durations.Attack_A !== 1 || !same(clocks.events.Attack_A, [
      { time: Math.fround(1 / 3), name: 'OnAttack', int: 0, float: 0, string: '' }])) return false;
  if (!fields(root, { _sideType: 2, _category: 1, _occupiedRemainingCharacterCnt: 0, _withdrawable: 0,
    _rewriteTileOptions: 0, _motionMode: 0, _isInfinity: 0, _customInitHpRatio: 0, _commonAbilities: [] })
    || root._modes.length !== 2 || !zero(root._traitAbility) || !zero(dark?._combat) || dark._generalAbilities.length
    || !fields(attack, { _waitForAttackEvent: 1, _selectTargetSource: 1, _selectTargetTiming: 0, _timeMode: 3,
      _allowNoTarget: 1, _animKey: 'Attack', _cooldownKey: 'duration', _affectedBySlowDown: 0, _atkScale: 0 })
    || !fields(selector, { _targetSide: 2, _targetMotion: 3, _targetCategory: 1, _limitTargetNum: 0,
      _ignoreTargetFree: 0, _forceIgnoreCamouflage: 0, _ignoreHitRange: 0 })) return false;
  const aura = find(skill, 'PollutedArea', '_buffs'), options = find(skill, 'PollutedArea', '_targetOptions')?._targetOptions;
  const pollution = aura?._buffs[0], summon = find(skill, 'Summon', '_buffs')?._buffs[0];
  const checker = find(skill, 'HpRatioChecker', '_maxHpRatio'), toggle = find(skill, 'HpRatioChecker', '_checker');
  if (!fields(aura, { _removeBuffWhenTargetLeave: 1, _removeBuffWhenAbilityDetached: 1,
    _onlyAddBuffOnceForEachTarget: 0, _passiveBuffs: [] }) || aura._buffs.length !== 1
    || !fields(options, { targetSide: 2, targetMotion: 3, targetCategory: 1, ignoreTargetFree: 0, ignoreMotionMode: 0 })
    || !fields(pollution, { buffKey: 'enemy_polluted_t', templateKey: 'polluted_area', triggerInterval: 1,
      waitFirstTriggerInterval: 1, firstTriggerInterval: 1, isSilenceable: 0, lifeTimeType: 2, blackboard: [] })
    || !emptyOutcomeAttributes(pollution.attributes)
    || !fields(summon, { templateKey: 'trap_larva_t[summon]', triggerInterval: Math.fround(.1), lifeTimeType: 2, isSilenceable: 0 })
    || !same(summon.attributes.abnormalImmunes, [0, 12, 16, 25]) || !same(summon.attributes.abnormalComboImmunes, [0])
    || !fields(checker, { _minHpRatio: 0, _maxHpRatio: .5, _useLTForMax: 1, _toggleOnce: 1, _restoreDelay: 0 })
    || toggle._unmanagedBuffsWhenToggleOn[0]?.templateKey !== 'trap_larva_t') return false;
  const wrapper = find(skill, 'sktok_larva', '_canSilenced');
  if (!fields(wrapper, { _canSilenced: 0, _attachInDummy: 1, _defaultModeIndex: -1, _rangeIdUsageType: 7 })
    || find(skill, 'sktok_larva', '_abilities')?._abilities.length !== 3) return false;
  const death = n.templates['trap_larva_t[summon]']?.eventToActions, spawn = death?.ON_OWNER_KILLED?.[0];
  const progress = death?.ON_BUFF_TRIGGER?.[0], mode = n.templates.trap_larva_t?.eventToActions.ON_BUFF_START?.[0];
  const element = n.templates.trap_larva_t_dark_damage?.eventToActions.ON_BUFF_START;
  if (!death || death.ON_OWNER_KILLED.length !== 1 || !fields(spawn, { _unharmful: false, _managedByScheduler: true,
    _alwaysCountAsKilled: false, _disableBornTweenColor: true, _summonAllRoute: false, _overrideEnemyKey: '', _defaultBranchId: '' })
    || !spawn.$type.includes('SummonEnemiesFollowBranchRoute') || spawn._buffToEnemy?.templateKey !== 'empty'
    || !fields(progress?._conditionNode, { _levelProgressKey: 'level_progress_ratio', _condType: 'GE' })
    || !progress._succeedNodes[2]?.$type.includes('InstantKill')
    || !fields(mode?._conditionNode, { _checkCurModeIndex: 0 }) || mode._succeedNodes[0]?._modeIndex !== 1
    || element?.length !== 1 || !fields(element[0], { _elementDamageType: 'DARK', _isFixedEpDamage: true,
      _fixedEpDamageKey: 'ep_dark_damage', _noSource: false, _isEnvElementDamage: false })) return false;
  const condition = n.templates.polluted_area?.eventToActions.ON_BUFF_TRIGGER?.[0];
  return condition?._conditionNode?._heightType === 'LOWLAND'
    && [condition._succeedNodes, condition._failNodes].every((actions, i) => actions?.length === 1
      && fields(actions[0], { _damageType: 'PURE', _damageKey: i ? 'polluted_damage_high' : 'polluted_damage_low',
        _ignoreForSp: true, _noSourceDamage: false, _skipModifierEvent: false, _isEnvDamage: false }));
}
export function twigsDefinition(instance) {
  if (!twigsNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || typeof instance.branchId !== 'string' || !instance.branchId
    || ['actionIndex', 'pollutionLow', 'pollutionHigh'].some(k => !Number.isSafeInteger(instance[k]) || instance[k] < 0))
    throw Error('Unsupported Twigs That Crave instance');
  const record = tables.devices[TWIGS], phase = record.phases[0], [first, last] = phase.attributesKeyFrames;
  const skill = tables.skills.sktok_larva.levels[0];
  if (phase.rangeId !== 'x-5' || !same(first.data, last.data) || first.data.maxHp !== 40000 || first.data.def !== 0
    || first.data.magicResistance !== 10 || skill.prefabId !== 'sktok_larva' || skill.skillType !== 'AUTO'
    || skill.spData.spCost !== 0 || skill.spData.initSp !== 0 || skill.rangeId !== 'x-5'
    || !same(Object.fromEntries(skill.blackboard.map(b => [b.key, b.value])), { 'attack@duration': 4, hp_ratio: .5,
      'attack@ep_dark_damage': 250, level_progress_ratio: 1, polluted_damage_high: 25, polluted_damage_low: 50 }))
    throw Error('Changed Twigs That Crave source');
  return { kind: 'twigs', hp: 40000, def: 0, res: 10, block: 0, taunt: -1, side: 'enemy',
    immune: ['stun', 'silence', 'sleep', 'frozen', 'levitate'],
    range: tables.ranges['x-5'].grids.map(p => [p.row, p.col]), radius: Math.fround(1.1), threshold: .5, interval: 4, element: 250,
    animation: { clip: 'Attack_A', release: clocks.events.Attack_A[0].time, duration: clocks.durations.Attack_A },
    branchId: instance.branchId, actionIndex: instance.actionIndex,
    pollutionLow: instance.pollutionLow, pollutionHigh: instance.pollutionHigh };
}
