// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const node = (a, name) => a?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export const EBLANA_REBIRTH_TEXT = '[Rebirth] While on the field, some enemies will turn into <Embers> upon defeat and continue fighting';
export const EBLANA_AURA_EXCLUSIONS = Object.freeze(['enemy_1288_duskls', 'enemy_1288_duskls_2',
  'enemy_1292_duskld', 'enemy_1292_duskld_2', 'enemy_1294_duchns']);

/** Partial boss coverage: this approves the independent Aura talent only.
 * Phases, attacks and skills still require their own source contracts. */
export function eblanaAuraNative(r, n) {
  if (r.key !== 'enemy_1536_ncrmcr' || r.prefabKey !== r.key || ![0, 1].includes(r.level)
    || !same(r.talents.groups.Aura, ['enemy_key'])
    || r.talents.bbStr['Aura.enemy_key'] !== (r.level ? 'enemy_1288_duskls_2' : 'enemy_1288_duskls')) return false;
  const aura = n.Aura?.[0], validator = n.$ref(aura?._targetValidator), binding = aura?._buffs?.[0];
  if (aura?.m_Script.m_PathID !== '-5793748974791823428' || aura._selfOption !== 2 || !zero(aura._selector)
    || aura._interval || aura._forceTick || aura._onlyDetactTargetWhenStarted || aura._excludeReborningEntity
    || aura._removeBuffWhenAbilityDetached !== 1 || aura._passiveBuffs.length || aura._buffs.length !== 1
    || binding?.buffKey !== 'enemy_ncrmcr_aura' || binding.templateKey !== binding.buffKey || binding.loadFromDB
    || binding.isSilenceable || binding.isStunnable || binding.isDamageMissable || binding.isFreezable
    || binding.lifeTimeType !== 2 || binding.maxStackCnt !== 1 || binding.blackboard.length
    || validator?._isAnd !== 1 || validator._invertedValidators.length || validator._validators.length !== 2) return false;
  const options = validator._targetOptions, filters = validator._validators.map(n.$ref);
  if (options.targetSide !== 1 || options.targetCategory !== 0 || options.targetMotion !== 3 || options.ignoreTargetFree !== 1
    || filters.some(f => f?._targetOptions.targetSide !== 1 || f._targetOptions.targetCategory !== 1 || f._targetOptions.targetMotion !== 3 || f._targetOptions.ignoreTargetFree !== 1)) return false;
  const [marks, tags] = filters;
  if (marks._excludeKey !== 1 || marks._filterBuffSource || marks._hostAsTarget
    || !same(marks._buffs, ['enemy_duskls_mark', 'enemy_duskld_mark', 'enemy_duchns_mark'])
    || tags._isAnd || tags._isUnset !== 1 || !same(tags._tags, ['machine'])) return false;
  const events = n.$template(binding.templateKey)?.eventToActions, actions = events?.ON_OWNER_KILLED;
  if (!same(Object.keys(events ?? {}), ['ON_OWNER_KILLED']) || actions?.length !== 4
    || !node(actions[0], 'FilterDeathReason') || actions[0]._source !== 'TARGET' || actions[0]._finishReason !== 'FALLDOWN'
    || !node(actions[1], 'IfNot') || !node(actions[2], 'CreateBuff') || actions[2]._buff.templateKey !== 'empty'
    || !node(actions[3], 'SummonEnemiesFollowMyRoute')) return false;
  const summon = actions[3], mode = summon._buffToEnemy;
  if (summon._source !== 'BUFF_OWNER' || summon._enemyKey !== null || summon._summonCount !== 1 || summon._delayTime !== .5
    || !summon._managedByScheduler || summon._dontBlockWave || summon._stopSummonIfHostDead || summon._skipCheckPoint
    || summon._useRandomDelay || summon._randomOffsetBound || summon._useOffsetInBB || summon._offset.x || summon._offset.y
    || summon._useTargetPosition || summon._useMapPosition || summon._spawnOnHostRootTile || summon._useLocalUnharmfulFlag
    || summon._checkMotionMode !== 'ALL' || !summon._addBuffToEnemy || mode?.templateKey !== 'switch_mode_no_restore'
    || mode.lifeTimeType !== 'IMMEDIATELY' || !same(mode.blackboard, [{ key: 'mode', value: 1, valueStr: '' }])) return false;
  return same(n.$template(mode.templateKey)?.eventToActions, { ON_BUFF_START: [{
    $type: 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp', _modeIndex: 0,
    _loadModeFromBlackboard: true, _restoreDefault: false, _restartFSM: true, _targetType: 'TARGET',
  }] });
}
export const EBLANA_AURA_FEATURE = {
  matchesRecord: r => r.key === 'enemy_1536_ncrmcr',
  covers: eblanaAuraNative,
  explains: text => text === EBLANA_REBIRTH_TEXT,
  dependsOn: r => r.key === 'enemy_1536_ncrmcr' ? [r.talents.bbStr['Aura.enemy_key']] : [],
  ability: r => r.key === 'enemy_1536_ncrmcr' ? { kind: 'deathConversionAura', params: r => ({ child: r.talents.bbStr['Aura.enemy_key'], delay: .5,
    excludedPrefabs: EBLANA_AURA_EXCLUSIONS, excludedTags: ['machine'], buffKey: 'enemy_ncrmcr_aura' }) } : null,
  note: 'Independent global conversion aura; the remaining boss phase and skill contracts are still blocked.',
};
