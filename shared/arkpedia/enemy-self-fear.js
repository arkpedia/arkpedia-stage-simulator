// SPDX-License-Identifier: GPL-3.0-or-later
import { emptyOutcomeAttributes, passiveOutcomeBuff, sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const match = (value, fields) => value && Object.entries(fields).every(([key, wanted]) => value[key] === wanted);
export const isSelfFearEnemy = r => /^enemy_1008[3-6]_(hlbird|hlegle|hllevi|hltigr)(?:_2)?$/.test(r.prefabKey);

/** One inclusive, irreversible HP checker. Its independent speed buff must
 * survive rejected or shortened Fear without granting control immunity. */
export function selfFearNative(r, n) {
  if (!isSelfFearEnemy(r) || r.talents.groups.SelfFear?.slice().sort().join() !== 'fear,move_speed,speed_duration'
    || !['fear', 'move_speed', 'speed_duration'].every(k => Number.isFinite(r.talents.bb[`SelfFear.${k}`]) && r.talents.bb[`SelfFear.${k}`] > 0)) return false;
  const family = r.prefabKey.split('_')[2], helper = n.SelfFear?.find(c => '_checker' in c), checker = n.$ref(helper?._checker);
  const initial = helper?._unmanagedBuffsWhenToggleOn?.[0], key = `${family}_t[self_fear]`;
  if (!match(helper, { _isInverseToggle: 0, _setToggleFalseOnDetached: 1, _forceAsDmgOrHealAbility: 0 })
    || helper.m_Script.m_PathID !== '5578302910068743633' || helper._selector.m_PathID !== '0'
    || helper._buffs.length || helper._buffsWhenToggleOff.length || helper._unmanagedBuffsWhenToggleOn.length !== 1
    || !match(checker, { _minHpRatio: 0, _maxHpRatio: .5, _useLTForMax: 0, _toggleOnce: 1,
      _loadMinHpRatioFromBlackboard: 0, _restoreDelay: 0, _setInitialToggle: 0, _initialToggle: 1 })
    || checker.m_Script.m_PathID !== '2776920899325723445'
    || !match(initial, { templateKey: key, buffKey: key, lifeTimeType: 0 })
    || initial.blackboard.length || !passiveOutcomeBuff({ ...initial, lifeTimeType: 2 })) return false;
  const events = n.$template(key)?.eventToActions, actions = events?.ON_BUFF_START;
  if (Object.keys(events ?? {}).join() !== 'ON_BUFF_START' || actions?.length !== 2) return false;
  for (const action of actions) {
    if (!match(action, { $type: 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp', _buffOwner: 'BUFF_OWNER',
      _isDerivedBuff: false, _finishDerivedBuffIfParentFinish: false })) return false;
    if (!match(action._buff, { isDurableBuff: false, isDamageMissable: false, isSilenceable: false,
      isStunnable: false, isFreezable: false, isLevitatable: false, statusResistable: 'AUTOMATIC',
      lifeTimeType: 'LIMITED', lifeTime: 0, maxStackCnt: 1, templateKey: 'empty', disableOverride: false })
      || action._buff.blackboard.length) return false;
  }
  const [speed, fear] = actions.map(action => action._buff);
  return match(speed, { buffKey: `${family}_t[self_speed_up]`, loadFromDB: false, durationKey: 'speed_duration' })
    && emptyOutcomeAttributes({ ...speed.attributes, attributeModifiers: [] })
    && same(speed.attributes.attributeModifiers, [{ attributeType: 'MOVE_SPEED', formulaItem: 'FINAL_SCALER',
      value: 0, loadFromBlackboard: true, fetchBaseValueFromSourceEntity: false }])
    && match(fear, { buffKey: 'fear', loadFromDB: true, durationKey: null }) && emptyOutcomeAttributes(fear.attributes)
    && match(n.$buff('fear'), { buffKey: 'fear', templateKey: 'fear_buff', durationKey: 'fear', lifeTimeType: 'LIMITED',
      statusResistable: 'YES', isSilenceable: false, isStunnable: false, isFreezable: false })
    && same(n.$buff('fear').attributes, { abnormalFlags: ['FEARED'], abnormalImmunes: null, abnormalAntis: null,
      abnormalCombos: null, abnormalComboImmunes: null, attributeModifiers: null })
    && same(n.$template('fear_buff')?.eventToActions, {
      ON_BUFF_START: [{ $type: 'Torappu.Battle.Action.Nodes+AddFearTargetTiles, Assembly-CSharp',
        _sourceType: 'BUFF_SOURCE', _targetType: 'BUFF_OWNER', _rangeRadius: 10, _maxDegree: 45 }],
      ON_BUFF_FINISH: [{ $type: 'Torappu.Battle.Action.Nodes+RemoveFearTargetTiles, Assembly-CSharp', _targetType: 'BUFF_OWNER' }],
    });
}
