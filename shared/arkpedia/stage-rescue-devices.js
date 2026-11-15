// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import { emptyOutcomeAttributes, passiveOutcomeBuff, nativeKillLog, sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const node = (name, fields = {}) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });
const fullHp = node('FilterByTargetHpRatio', { _targetType: 'BUFF_OWNER', _condType: 'GE', _value: 1,
  _useSourceHpRatio: false, _sourceType: 'SOURCE', _blackboardPrefix: null });
const finish = node('FinishBuffsById', { _buffKey: 'trap_skhbox[undeadable]', _loadFromBlackboard: false,
  _decCntIfStack: false, _updateOverrideMap: true, _targetType: 'BUFF_OWNER', _checkBuffSource: false,
  _sourceType: 'BUFF_SOURCE', _alsoClearNullSource: false, _finishHostBuff: false, _decCntKey: null, _decCnt: 1 });
const kill = node('InstantKill', { _targetType: 'BUFF_OWNER', _killSource: false, _noSource: false,
  _withdrawIfRallyPoint: false, _resultIfInRallyPointMode: false, _skipReborn: false, _noReason: false,
  _markReachExit: false, _switchState: false });

export function rescueDeviceNativeReviewed(id, n = native) {
  if (id !== 'trap_759_skzwyx') return false;
  const parts = n.prefabs[id]?.components ?? [], by = new Map(parts.map(c => [c.pathId, c.data]));
  const get = ref => ref?.m_FileID === 0 ? by.get(ref.m_PathID) : null;
  const root = parts.find(c => c.object === id)?.data, mode = get(root?._modes?.[0]);
  const helper = get(root?._commonAbilities?.[0]), [init, protection] = helper?._buffs ?? [];
  if (root?._sideType !== 1 || root._category !== 1 || root._occupiedRemainingCharacterCnt !== 0
    || root._withdrawable !== 0 || root._rewriteTileOptions !== 0 || root._modes.length !== 1
    || root._commonAbilities.length !== 1 || root._traitAbility.m_PathID !== '0'
    || root._customInitHpRatio !== 0 || root._isInfinity !== 0 || mode?._generalAbilities.length !== 0
    || mode._combat.m_PathID !== '0' || get(mode._attack)?.m_Script.m_PathID !== '4865767822664548221'
    || get(mode._attackTrigger)?.m_Script.m_PathID !== '248012603862317511'
    || helper?._selector.m_PathID !== '0' || helper.m_Script.m_PathID !== '3800760148018415462' || helper._buffs.length !== 2
    || init?.lifeTimeType !== 0 || !passiveOutcomeBuff({ ...init, lifeTimeType: 2 })
    || init.templateKey !== 'trap_skzwyx[init]' || !same(init.blackboard, [{ key: 'hp_ratio', value: 1, valueStr: '' }, { key: 'key', value: 0, valueStr: id }])
    || protection?.templateKey !== 'empty' || protection.buffKey !== 'trap_skzwyx[undeadable]'
    || !same(protection.attributes, { abnormalFlags: [6, 2], abnormalImmunes: [0], abnormalAntis: [], abnormalCombos: [], abnormalComboImmunes: [],
      attributeModifiers: [{ attributeType: 20, formulaItem: 0, value: -1, loadFromBlackboard: 0, fetchBaseValueFromSourceEntity: 0 }] })
    || !passiveOutcomeBuff({ ...protection, attributes: init.attributes })) return false;
  const initial = n.templates['trap_skzwyx[init]']?.eventToActions;
  const start = initial?.ON_BUFF_START, create = start?.[1], buff = create?._buff;
  const hurt = n.templates['trap_skzwyx[hurt]']?.eventToActions;
  const check = hurt?.ON_BUFF_TRIGGER?.[0], success = check?._succeedNodes;
  return Object.keys(initial ?? {}).join() === 'ON_BUFF_START' && start.length === 2
    && same(start[0], node('IfElse', { _conditionNode: fullHp, _succeedNodes: [node('DamageViaMaxHpRatio', {
      _targetType: 'BUFF_OWNER', _getMaxHpFromTarget: false, _damageType: 'PURE', _applyWay: 'NONE', _ignoreForSp: false,
      _isUndeadable: true, _attackType: 'NORMAL', _skipModifierEvent: true, _multiplyByKey: false, _multiplierKey: 'cnt', _noSourceDamage: false })], _failNodes: null }))
    && create?.$type === node('CreateBuff').$type && create._buffOwner === 'BUFF_OWNER' && !create._useSpecialBuffSource && !create._isDerivedBuff
    && emptyOutcomeAttributes(buff?.attributes) && buff.templateKey === 'trap_skzwyx[hurt]' && buff.buffKey === 'trap_skzwyx[hurt]'
    && buff.lifeTimeType === 'INFINITY' && buff.triggerLifeType === 'INFINITY' && buff.triggerInterval === Math.fround(.1)
    && buff.waitFirstTriggerInterval === true && !buff.isSilenceable && !buff.isStunnable && !buff.isFreezable && buff.blackboard.length === 0
    && Object.keys(hurt ?? {}).sort().join() === 'ON_APPLIED_MODIFIER,ON_BUFF_TRIGGER'
    && hurt.ON_BUFF_TRIGGER.length === 1 && same(hurt.ON_APPLIED_MODIFIER, hurt.ON_BUFF_TRIGGER)
    && check.$type === node('IfElse').$type && same(check._conditionNode, fullHp) && check._failNodes === null
    && success?.length === 3 && same(success[0], finish) && same(success[2], kill)
    && nativeKillLog({ $template: () => ({ eventToActions: { ON_OWNER_KILLED: [success[1]] } }) });
}
