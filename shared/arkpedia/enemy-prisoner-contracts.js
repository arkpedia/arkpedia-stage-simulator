// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const is = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
/** One source contract for confinement counters and warning listeners. */
export function prisonerCounterNative(n) {
  for (const key of ['enemy_confinement', 'enemy_confinement_final']) {
    const buff = n.$buff(key);
    if (!fields(buff, { buffKey: key, isSilenceable: false, lifeTimeType: 'INFINITY' })
      || !same(buff.attributes.attributeModifiers, [{ attributeType: 'ATTACK_SPEED', formulaItem: 'ADDITION',
        value: 0, loadFromBlackboard: true, fetchBaseValueFromSourceEntity: false }])) return false;
  }
  const init = n.$template('enemy_confinement')?.eventToActions.ON_BUFF_START;
  const counter = n.$template('enemy_confinement[atk_cnt]')?.eventToActions.ON_BEFORE_ATTACK;
  const warning = n.$template('enemy_liberty[warning]')?.eventToActions.ON_BUFF_TRIGGER;
  const listener = n.$template('enemy_liberty_listener[warning]')?.eventToActions.ON_BEFORE_ATTACK;
  if (init?.length !== 1 || !is(init[0], 'CreateBuffs') || !fields(init[0]._buffPair, { useBlackboard: true, count: 0 })
    || !fields(init[0]._buffPair.buff, { buffKey: 'enemy_confinement[atk_cnt]', templateKey: 'enemy_confinement[atk_cnt]',
      overrideType: 'STACK', maxStackCnt: -1, maxValidStackCnt: -1, lifeTimeType: 'INFINITY' })
    || counter?.length !== 4 || !is(counter[0], 'CheckAbnormalFlag') || !fields(counter[0], { _abnormalFlag: 'PALSY', _isUnset: true })
    || !is(counter[1], 'FinishBuff') || counter[1]._decCntIfStack !== true
    || !fields(counter[2], { _buffKey: 'enemy_confinement[atk_cnt]', _stackCount: 1, _condType: 'EQUALS' })
    || !is(counter[3], 'SwitchMode') || !fields(counter[3], { _modeIndex: 1, _restartFSM: false, _restoreDefault: false })
    || warning?.length !== 1 || !is(warning[0], 'CreateBuff')
    || warning[0]._buff.templateKey !== 'enemy_liberty_listener[warning]'
    || listener?.length !== 2 || !is(listener[0], 'FinishBuffsById')
    || !fields(listener[0], { _buffKey: 'enemy_confinement[atk_cnt]', _decCntIfStack: true })
    || !is(listener[1], 'SwitchMode') || !fields(listener[1], { _modeIndex: 2, _restartFSM: false, _restoreDefault: false })) return false;
  return true;
}
