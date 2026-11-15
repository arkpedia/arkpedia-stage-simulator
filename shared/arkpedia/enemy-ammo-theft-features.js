// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, emptyOutcomeAttributes, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
const ids = ['enemy_10084_hlegle', 'enemy_10084_hlegle_2'];
const fields = (value, expected) => !!value && Object.entries(expected).every(([k, v]) => same(value[k], v));
const node = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const damage = {
  $type: node('AdvancedApplyDamage'), _targetType: 'TARGET', _damageType: 'PHYSICAL',
  _atkScaleVar: 'atk_scale', _defaultAtkScale: 1, _applyWay: 'RANGED', _baseOnHostAtk: false,
  _emitSourceOnCalculateDamage: false, _attackType: 'NORMAL', _forceUseProjectileCachedAtk: false,
  _ignoreForSp: false, _ignoreMissFlag: 'NONE', _ignoreCancelReasonMask: 'NONE', _modifierKey: '',
  _assignRealDamageToBB: false, _skipModifierEvent: false,
};
function payload(n) {
  const template = n.$template('hlegle_a[steal]'), events = template?.eventToActions, root = events?.ON_BUFF_START?.[0];
  if (template?.effectKey !== '' || Object.keys(events ?? {}).join() !== 'ON_BUFF_START' || events.ON_BUFF_START.length !== 1
    || !fields(root, { $type: node('IfElse'), _conditionNode: { $type: node('AssignAmmoSkillRemainingCountToBB'),
      _targetType: 'BUFF_OWNER', _blackboardKey: 'rest_bullet' }, _failNodes: [damage] })
    || root._succeedNodes.length !== 1) return false;
  const choice = root._succeedNodes[0];
  if (!fields(choice, { $type: node('IfElse'), _conditionNode: { $type: node('IsBlackboardZero'),
    _var: 'rest_bullet', _noVarShowWarning: true }, _succeedNodes: [damage] }) || choice._failNodes.length !== 3) return false;
  const [consume, audio, visual] = choice._failNodes;
  return same(consume, { $type: node('AmmoSkillCountModifier'), _targetType: 'BUFF_OWNER',
    _modifyMaxCount: false, _restoreMaxCount: false, _addCountBBKey: null, _addCount: 0,
    _recoverEventCount: false, _recoverCountBBKey: null, _recoverCount: 0,
    _consumeEventCount: true, _consumeCountBBKey: 'minus_bullet', _consumeCount: 0,
    _discardRemainingCount: false, _discardSoft: false, _triggerConsumeEvent: false, _useEvtRetAsReturnValue: false })
    && same(audio, { $type: node('PlayAudio'), _target: 'BUFF_OWNER', _audioSignal: 'hlegle_steal_bullet_audio' })
    && fields(visual, { $type: node('CreateBuff'), _buffOwner: 'BUFF_OWNER', _isDerivedBuff: false, _finishDerivedBuffIfParentFinish: false })
    && fields(visual._buff, { buffKey: 'hlegle_t[steal_effect]', templateKey: 'empty', loadFromDB: false,
      lifeTimeType: 'LIMITED', lifeTime: 2, durationKey: 'fixed_duration', blackboard: [],
      isDurableBuff: false, isDamageMissable: false, isSilenceable: false, isStunnable: false,
      isFreezable: false, isLevitatable: false, maxStackCnt: 1, triggerCnt: 0 })
    && emptyOutcomeAttributes(visual._buff.attributes);
}
export function ammoTheftNative(r, n) {
  if (!ids.includes(r.prefabKey) || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'phys' || r.stats.motion !== 'FLY'
    || r.skills.length || r.sp || r.talents.bb['DamageOrBullet.attack@minus_bullet'] !== 1
    || !same(r.talents.groups.DamageOrBullet, ['attack@minus_bullet']) || !payload(n)) return false;
  const root = n[r.prefabKey]?.[0], mode = n.Default?.[0], attack = n.Attack?.[0];
  if (root?._modes.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities.length
    || n.$ref(mode?._attack) !== attack || n.$ref(mode?._combat) !== attack
    || !fields(attack, { _projectileKey: 'projectile_enemy_hlegle', _atkScale: 0, _damageType: 1, _attackType: 1,
      _elementDamageType: 0, _extraProjectileKeys: [], _useCachedAtkOnly: 0, _transferSource: 0,
      _selectTargetSource: 2, _selectTargetTiming: 0, _waitForAttackEvent: 1, _timeMode: 0, _animKey: 'Attack',
      _endAnimKey: 'Idle', _affectedBySlowDown: 1, _preDelay: 0, _maxAnimScale: 1, _allowNoTarget: 0,
      _waitForProjectileInvalid: 0, _useDynamicAttackType: 0 }) || !zero(attack._selector)
    || attack._activeBuffs.length !== 1) return false;
  const buff = attack._activeBuffs[0], passive = n.DamageOrBullet?.[0];
  if (!fields(buff, { buffKey: 'hlegle_a[steal]', templateKey: 'hlegle_a[steal]', loadFromDB: 0,
    lifeTimeType: 0, lifeTime: 0, durationKey: '', isDamageMissable: 0, isSilenceable: 0,
    isStunnable: 0, isFreezable: 0, isLevitatable: 0, isDurableBuff: 0, blackboard: [], triggerCnt: 0 })
    || !emptyOutcomeAttributes(buff.attributes) || passive?._buffs.length !== 1 || !zero(passive._selector)
    || !passiveOutcomeBuff(passive._buffs[0]) || passive._buffs[0].templateKey !== 'empty'
    || !same(passive._buffs[0].blackboard, [])) return false;
  const trigger = n.$ref(mode._attackTrigger), siblings = n.$siblings(mode._attackTrigger);
  const selector = siblings.find(c => '_targetSide' in c), range = siblings.find(c => '_scaleble' in c);
  if (!fields(trigger, { _minTargetNum: 1, _keepTarget: 0, _overrideSearchTargetTick: -1 })
    || !fields(selector, { _targetSide: 2, _targetMotion: 1, _targetCategory: 1, _limitTargetNum: 1, _maxNum: 1,
      _ignoreHitRange: 0, _ignoreMotionMode: 0, _forceIgnoreCamouflage: 0, _ignoreTargetFree: 0,
      _excludeSomeAbnormalFlags: 0, _onlyIgnoreSomeOfTargetFreeCase: 0, _postFilter: 4, _checkUnitType: 0, _needProfessionMask: 0 })
    || !fields(range, { _extendable: 0, _scaleble: 1, _useBlackboardRangeId: 0 })) return false;
  const projectile = n.$projectile('projectile_enemy_hlegle'), motion = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  return fields(motion, { _speed: 10, _moveType: 1, _delayToStart: 0, _flyToTargetLocationOnly: 0,
    _forceReachedWhenTimeup: 1, _deltaSpeedPerSec: 0, _comeBack: 0, _onlyReachedInTime: 0 })
    && fields(life, { _lifeTime: 10, _maxHitNum: 1, _hitNumType: 1, _stopAfterMaxHit: 1,
      _stopWhenSourceInvalid: 0, _alwaysHitTraceTargetInTheEnd: 1, _canHitSameTargetMultipleTimes: 0 })
    && fields(life._actionController, { _dontAddBuffs: 0, _extraBuffsInTheEnd: [], _addExtraBuffsWhenReached: 0 });
}
export const AMMO_THEFT_FEATURE = {
  matchesRecord: r => ids.includes(r.prefabKey), covers: ammoTheftNative,
  explains: /^Attempts to steal 1 Ammo from the target when attacking, and deals heavy Physical damage if attempt is unsuccessful$/,
  ability: { kind: 'ammoTheftAttack', params: r => ({ count: r.talents.bb['DamageOrBullet.attack@minus_bullet'], speed: 10, lifetime: 10 }) },
  note: 'Original single-target projectile resolves active AmmoSkill consumption at impact, without consumption events; unsuccessful theft deals ordinary Physical attack damage.',
};
