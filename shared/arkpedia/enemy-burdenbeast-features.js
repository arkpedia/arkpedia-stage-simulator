// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-burdenbeast-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
export const isBurdenbeastSupplier = r => ['enemy_4007_murino', 'enemy_4007_murino_2'].includes(r.prefabKey);
const type = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const action = (name, values) => ({ $type: type(name), ...values });
const effect = key => action('CreateEffect', { _targetType: 'BUFF_OWNER', _sourceType: 'BUFF_OWNER', _effectKey: key,
  _useSourceFaceVactor: false, _useSourceToTargetDirection: false, _useAttackPlaybackSpeed: false });
const selector = {
  targetSide: 'ENEMY', targetMotion: 'ALL', targetCategory: 'DEFAULT', enableAdvancedOptions: true,
  ignoreTargetFree: true, ignoreAllyTargetFree: false, ignoreHealFree: false, ignoreTargetSide: false,
  excludeSomeAbnormalFlags: false, excludeAbnormalFlag: 'STUNNED', purposeMask: 'NONE',
  professionMask: 'WARRIOR, SNIPER, TANK, MEDIC, SUPPORT, CASTER, SPECIAL, PIONEER',
  onlyIgnoreSomeOfTargetFreeCase: false, abnormalFlag: 'STUNNED', abnormalCombo: 'SLEEPING',
};
export function burdenbeastSupplierNative(r, n) {
  if (!isBurdenbeastSupplier(r) || r.key !== r.prefabKey || r.applyWay !== 'MELEE' || r.stats.motion !== 'WALK'
    || r.stats.dmgType !== 'phys' || r.skills.length || !same(r.sp, { type: 'INCREASE_WHEN_ATTACK', maxSp: 2, initSp: 0, increment: 1 })
    || !same(r.talents, { bb: { 'Weakness.damage_resistance': r.prefabKey.endsWith('_2') ? .95 : .85 },
      bbStr: {}, groups: { Weakness: ['damage_resistance'] } })) return false;
  const bonusKey = 'cooperate_die_to_trigger_bonus' + (r.prefabKey.endsWith('_2') ? '_2' : '');
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), combat = n.$ref(mode?._combat);
  const clock = clocks.enemies[r.prefabKey], graphic = n.$ref(root?._animator);
  if (!clock || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId
    || clock.durations.Attack !== 1.5 || !same(clock.events.Attack, [{ time: Math.fround(.4), name: 'OnAttack', int: 0, float: 0, string: '' }])) return false;
  const weakness = n.Weakness?.[0], direction = n.Direction?.[0], bonus = n.TriggerBonus?.[0];
  if (root?._modes?.length !== 1 || root._commonAbilities.length !== 2
    || n.$ref(root._commonAbilities[0]) !== direction || n.$ref(root._commonAbilities[1]) !== bonus
    || root._useMoveDirAsFaceDir !== 0 || root._blockVolume !== 1 || root._delayToBorn !== 0
    || mode?._generalAbilities.length || !zero(mode._attack) || !zero(mode._attackTrigger)
    || combat?.m_Script.m_PathID !== '4381884627089348317' || combat._damageType !== 1 || combat._attackType !== 1
    || combat._atkScale !== 1 || combat._activeBuffs.length || !zero(combat._selector)
    || combat._selectTargetSource !== 2 || combat._selectTargetTiming !== 0 || combat._timeMode !== 0
    || combat._waitForAttackEvent !== 1 || combat._animKey !== 'Attack' || combat._affectedBySlowDown !== 1
    || combat._preDelay !== 0 || combat._epDamageRatio !== 0 || combat._faceToTarget !== 1) return false;
  for (const [component, key] of [[weakness, 'enemy_murino_t'], [direction, 'enemy_murino_direction_listener'], [bonus, bonusKey]]) {
    const buff = component?._buffs?.[0];
    if (component?._buffs?.length !== 1 || !zero(component._selector) || !passiveOutcomeBuff(buff)
      || buff.templateKey !== key || buff.blackboard.length) return false;
  }
  const poll = direction._buffs[0], checker = n.$ref(direction._checker);
  if (direction.m_Script.m_PathID !== '5578302910068743633' || direction._isInverseToggle !== 0
    || direction._buffsWhenToggleOff.length || direction._unmanagedBuffsWhenToggleOn.length
    || poll.triggerInterval !== Math.fround(.3) || poll.triggerLifeType !== 2 || poll.waitFirstTriggerInterval !== 1
    || checker?.m_Script.m_PathID !== '-6339019266161532961' || checker._isInitToggled !== 1
    || checker._restoreDelay !== 0 || checker._disableWhenBlocked !== 1
    || Object.keys(checker).some(key => key.startsWith('_disable') && key !== '_disableWhenBlocked' && checker[key] !== 0)) return false;
  return same(n.$template('enemy_murino_t')?.eventToActions, { ON_TAKE_DAMAGE: [
    action('CheckIfSourceGridPosFaceTargetGridPos', { _source: 'BUFF_OWNER', _target: 'MODIFIER_SOURCE', _faceType: 'FRONT',
      _targetColOffset: 0, _faceIfSameCol: 'NONE' }),
    action('DamageScale', { _filterDamageType: true, _damageMask: 'PHYSICAL_AND_MAGICAL', _filterApplyWay: false,
      _applyWayFilter: 'NONE', _isOneMinus: true, _isStackable: false, _isValidStackCnt: false, _cachedDeltaValueToBBKey: '', _customKey: '' }),
    effect('enemy_murino_attack_hit_front_01'), action('AlwaysNext', {}),
    action('PlayAudio', { _target: 'BUFF_OWNER', _audioSignal: 'enemu_mhrhcr_block' }),
  ] }) && same(n.$template('enemy_murino_direction_listener')?.eventToActions, {
    ON_BUFF_START: [action('DisableEnemySwitchFaceByMove', { _targetType: 'BUFF_OWNER', _disabled: true })],
    ON_BUFF_TRIGGER: [action('FaceToLOrRViaMoreTargets', { _ownerType: 'BUFF_OWNER', _targetOptions: selector })],
    ON_BUFF_FINISH: [action('DisableEnemySwitchFaceByMove', { _targetType: 'BUFF_OWNER', _disabled: false })],
  }) && same(n.$template(bonusKey)?.eventToActions, { ON_OWNER_FINISH: [
    action('FilterDeathReason', { _source: 'BUFF_OWNER', _finishReason: 'REACH_EXIT' }), action('IfNot', {}),
    action('FilterDeathReason', { _source: 'BUFF_OWNER', _finishReason: 'OTHER' }), action('IfNot', {}),
    { ...effect('enemy_muvltr_die_start_ground_0' + (r.prefabKey.endsWith('_2') ? 2 : 1)), _targetType: 'TARGET', _sourceType: 'SOURCE' },
    action('TriggerEnvSystem', { _envKey: 'env_010_cooperate', _target: 'BUFF_OWNER', _triggerWithEvent: false, _eventName: null }),
  ] });
}

export function burdenbeastSupplierParameters(r) {
  const clock = clocks.enemies[r.prefabKey];
  return { supplier: true, reduction: r.talents.bb['Weakness.damage_resistance'], poll: Math.fround(.3),
    attackAnim: { dur: clock.durations.Attack, hit: clock.events.Attack[0].time } };
}
