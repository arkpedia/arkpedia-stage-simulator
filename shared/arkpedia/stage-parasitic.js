// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, emptyOutcomeAttributes, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
export const PARASITIC_ENVIRONMENT = 'rogue_4_parasitic_buff';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const action = (name, fields = {}) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });
const has = key => action('CheckEnemyTalentContainsKey', { _source: 'BUFF_OWNER', _key: key });
const isParasite = action('CheckEnemyId', { _targetType: 'TARGET', _filterIds: ['enemy_2065_skzjs'], _isUnset: false, _loadIdFromBb: false });
const summon = action('SummonEnemiesFollowMyRoute', { _source: 'BUFF_OWNER', _enemyKey: '', _summonCount: 1,
  _delayTime: Math.fround(.95), _managedByScheduler: true, _dontBlockWave: true,
  _trySummonOutsideWhenInObstacle: false, _randomOffsetBound: 0, _passableMask: 'NONE', _onlySummonOneInTheSamePlace: false,
  _useOffsetInBB: false, _offsetXKey: null, _offsetYKey: null, _offset: { x: 0, y: 0 }, _useLocalUnharmfulFlag: false,
  _unharmful: false, _useMapPosition: false, _spawnOnHostRootTile: false, _useTargetPosition: false, _targetType: 'TARGET',
  _spawnOnMyRouteWithDistance: false, _useRandomDelay: false, _randomDelayRange: .5, _stopSummonIfHostDead: false,
  _useOffsetForEach: false, _addBuffToEnemy: false, _buffToEnemy: null, _checkMotionMode: 'ALL', _skipCheckPoint: false });
export function parasiticNativeReviewed(evidence) {
  const rows = evidence.prefabs?.[PARASITIC_ENVIRONMENT], c = rows?.[0]?.data, buff = c?._buffs?.[0];
  if (rows?.length !== 1 || !fields(c, { m_Enabled: 1, _key: '', _sourceType: 0, _blackboard: undefined,
    _overrideCameraEffect: '', _deckBuffs: [] }) || c.m_Script.m_PathID !== '-6296718861144211397'
    || c._buffs.length !== 1 || !passiveOutcomeBuff(buff) || !fields(buff, { templateKey: PARASITIC_ENVIRONMENT,
      buffKey: '[g]rogue_4_parasitic_buff', disableOverride: 1, blackboard: [], triggerLifeType: 0 })) return false;
  if (!same(c._options, { targetSide: 7, targetMotion: 3, targetCategory: 1, enableAdvancedOptions: 1,
    ignoreTargetFree: 1, ignoreAllyTargetFree: 1, ignoreHealFree: 1, ignoreMotionMode: 0, ignoreTargetSide: 0,
    excludeSomeAbnormalFlags: 0, containSomeAbnormalFlags: 0, excludeAbnormalFlag: 0, containAbnormalFlag: 0,
    purposeMask: 0, professionMask: 0, checkUnitType: 0, unitTypeMask: 0, onlyIgnoreSomeOfTargetFreeCase: 0, abnormalFlag: 0, abnormalCombo: 0 })) return false;
  const events = evidence.templates?.[PARASITIC_ENVIRONMENT]?.eventToActions;
  const death = events?.ON_OWNER_KILLED?.[0], born = events?.ON_BUFF_START?.[0];
  const tail = [action('FilterDeathReason', { _source: 'BUFF_OWNER', _finishReason: 'FALLDOWN' }), action('IfNot'), summon];
  if (!same(events && Object.keys(events).sort(), ['ON_BUFF_START', 'ON_OWNER_KILLED'])
    || events.ON_OWNER_KILLED.length !== 1 || events.ON_BUFF_START.length !== 1
    || !same(death, action('IfElse', { _conditionNode: isParasite,
      _succeedNodes: [has('parasitic'), has('force_parasitic'), ...tail], _failNodes: [has('parasitic'), ...tail] }))
    || !fields(born, { $type: action('IfElse').$type, _conditionNode: isParasite })
    || born._succeedNodes.length !== 3 || born._failNodes.length !== 2
    || !same(born._succeedNodes.slice(0, 2), [has('parasitic'), has('force_parasitic')])
    || !same(born._failNodes[0], has('parasitic')) || !same(born._succeedNodes[2], born._failNodes[1])) return false;
  const visual = born._failNodes[1];
  return fields(visual, { $type: action('CreateBuff').$type, _buffOwner: 'BUFF_OWNER', _isDerivedBuff: false,
    _finishDerivedBuffIfParentFinish: false, _useSpecialBuffSource: false })
    && fields(visual._buff, { buffKey: 'skzjs_hit[effect]', templateKey: 'empty', lifeTimeType: 'INFINITY',
      loadFromDB: false, isDurableBuff: false, isSilenceable: false, isStunnable: false, isFreezable: false,
      isLevitatable: false, triggerCnt: 0, blackboard: [] }) && emptyOutcomeAttributes(visual._buff.attributes);
}
export function compileParasiticEnvironment(rows) {
  if (!Array.isArray(rows) || rows.length !== 1 || !fields(rows[0], { key: 'enemy_key', value: 0, valueStr: 'enemy_2065_skzjs' })
    || Object.keys(rows[0]).sort().join() !== 'key,value,valueStr') throw Error('Unsupported parasitic environment parameters');
  return { kind: PARASITIC_ENVIRONMENT, enemy: rows[0].valueStr, delay: Math.fround(.95), hosts: [], forced: [] };
}
/** Native CheckEnemyTalentContainsKey tests presence, not a Boolean value. The
 * original levels even contain two literal "truee" values; both still qualify. */
export function parasiticHostParameters(refs) {
  if (!Array.isArray(refs)) throw Error('Missing original parasite host definitions');
  const hosts = [], forced = [];
  for (const ref of refs) {
    const seen = new Set();
    for (const p of ref.overwrittenData?.talentBlackboard ?? []) {
      if (!['parasitic', 'force_parasitic'].includes(p?.key)) continue;
      if (seen.has(p.key) || !Number.isFinite(p.value) || p.valueStr != null && typeof p.valueStr !== 'string')
        throw Error('Malformed parasite host parameter');
      seen.add(p.key);
    }
    if (seen.has('parasitic')) hosts.push(ref.id);
    if (seen.has('force_parasitic')) forced.push(ref.id);
  }
  return { hosts: [...new Set(hosts)].sort(), forced: [...new Set(forced)].sort() };
}
export const withoutParasiticParameters = rows => rows?.filter(p => !['parasitic', 'force_parasitic'].includes(p.key));
