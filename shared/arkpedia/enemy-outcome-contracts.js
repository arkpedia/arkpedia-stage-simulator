// SPDX-License-Identifier: GPL-3.0-or-later
const match = (row, fields) => !!row && Object.entries(fields).every(([key, value]) => row[key] === value);
const same = (a, b) => a === b || !!a && !!b && typeof a === 'object' && typeof b === 'object'
  && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
export const sameOutcomeValue = same;
const action = (name, fields) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });
const log = key => action('LogExtraBattleInfo', { _logType: 'SIMPLE', _key: key, _loadKeyFromBlackBoard: true,
  _countInHostIfToken: false, _additionValue: 1, _attributeType: 'NONE', _target: 'BUFF_OWNER' });
export const emptyOutcomeAttributes = attributes => attributes && Object.keys(attributes).sort().join() ===
  'abnormalAntis,abnormalComboImmunes,abnormalCombos,abnormalFlags,abnormalImmunes,attributeModifiers'
  && Object.values(attributes).every(v => Array.isArray(v) && !v.length);
export const passiveOutcomeBuff = buff => emptyOutcomeAttributes(buff?.attributes) && match(buff, { loadFromDB: 0, lifeTimeType: 2,
  lifeTime: 0, maxStackCnt: 1, isSilenceable: 0, isStunnable: 0, isFreezable: 0, isDurableBuff: 0,
  isGroundBoundable: 0, isLevitatable: 0, triggerCnt: 0, overrideKey: '' });
export const nativeKillLog = native => {
  const events = native.$template('log_killed')?.eventToActions;
  return same(events, { ON_OWNER_KILLED: [log('killed')] })
    || same(events, { ON_OWNER_KILLED: [{ ...log('killed'), _additionValueKey: '' }] });
};
export const nativeTheftLog = native => same(native.$template('log_thief_reach_exit')?.eventToActions, { ON_OWNER_FINISH: [
  action('FilterDeathReason', { _source: 'BUFF_OWNER', _finishReason: 'REACH_EXIT' }),
  action('CheckCurrentTileKey', { _targetType: 'BUFF_OWNER', _tileKey: ['tile_end'], _isExclude: false }),
  log('rogue_thief_reach_exit'),
  action('RoguelikeShowToastRL04', { _toastTypeRL04: 'GOLD_STEAL', _lastTime: 3 }),
] });
