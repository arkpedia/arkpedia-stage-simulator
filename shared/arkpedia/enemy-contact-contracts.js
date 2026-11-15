// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const node = (name, fields = {}) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });
/** Source-owned conditional effects share this exact create/cleanup graph. */
export function conditionalContactBuff(n, template, contactKey, effectKey) {
  const events = n.$template(template)?.eventToActions, buff = events?.ON_BUFF_TRIGGER?.[0]?._succeedNodes?.[2]?._buff;
  if (!buff || buff.buffKey !== effectKey || buff.templateKey !== 'empty' || buff.lifeTimeType !== 'INFINITY'
    || buff.overrideType !== 'DEFAULT' || buff.disableOverride || buff.loadFromDB || buff.isDurableBuff
    || buff.isSilenceable || buff.isStunnable || buff.isFreezable || buff.isLevitatable || buff.isGroundBoundable
    || buff.maxStackCnt !== 1 || buff.blackboard.length) return null;
  return same(events, { ON_BUFF_TRIGGER: [node('IfElse', {
    _conditionNode: node('CheckContainsBuff', { _targetType: 'BUFF_OWNER', _buffKeys: [contactKey], isAND: true,
      _loadFromBlackboard: false, _checkBuffSource: false, _buffSourceType: 'BUFF_SOURCE', _checkSourceHost: false }),
    _succeedNodes: [node('CheckContainsDerviedBuff', { _derviedBuffKey: effectKey }), node('IfNot'),
      node('CreateBuff', { _buff: buff, _buffOwner: 'BUFF_OWNER', _isDerivedBuff: true, _finishDerivedBuffIfParentFinish: true })],
    _failNodes: [node('FinishDerivedBuff', { _updateOverrideMap: true })],
  })] }) ? buff : null;
}
