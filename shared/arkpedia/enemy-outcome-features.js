// SPDX-License-Identifier: GPL-3.0-or-later
import { passiveOutcomeBuff, nativeKillLog, nativeTheftLog } from './enemy-outcome-contracts.js';
import { lostHovercraftNative } from './enemy-hover-features.js';
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const match = (row, fields) => !!row && Object.entries(fields).every(([key, value]) => row[key] === value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function lostContraptionNative(record, native) {
  if (record.prefabKey !== 'enemy_2069_skzbox' || record.applyWay !== 'MELEE' || record.stats.dmgType !== 'phys'
    || record.skills.length || Object.keys(record.talents.groups).length) return false;
  const root = native[record.prefabKey]?.[0], mode = native.Default?.[0], combat = native.Combat?.[0], logger = native.LogKilled?.[0];
  if (root?._modes.length !== 1 || native.$ref(root._modes[0]) !== mode || root._commonAbilities.length !== 1
    || native.$ref(root._commonAbilities[0]) !== logger || mode?._generalAbilities.length || !zero(mode._attack)
    || !zero(mode._attackTrigger) || native.$ref(mode._combat) !== combat
    || !match(combat, { _attackType: 1, _damageType: 1, _atkScale: 1, _epDamageRatio: 0, _extraDamageType: 0,
      _timeMode: 0, _waitForAttackEvent: 1, _selectTargetSource: 2, _allowNoTarget: 0, _alwaysIncludeTarget: 1 })
    || combat._activeBuffs.length || !zero(combat._selector)
    || logger?.m_Script?.m_PathID !== '3800760148018415462' || !zero(logger._selector)
    || !match(logger, { _forceAsDmgOrHealAbility: 0, _ignoreIfOwnerDead: 0, _attachPassiveBuffsOnDummy: 1 })
    || logger._buffs?.length !== 3 || !logger._buffs.every(passiveOutcomeBuff)) return false;
  const [kill, visual, exit] = logger._buffs;
  return kill.templateKey === 'log_killed' && same(kill.blackboard, [{ key: 'key', value: 0, valueStr: 'trap_758_skzmbx' }])
    && visual.templateKey === 'empty' && visual.blackboard.length === 0
    && exit.templateKey === 'log_thief_reach_exit' && exit.blackboard.length === 0
    && same(native.$template('empty')?.eventToActions, {})
    && nativeKillLog(native) && nativeTheftLog(native);
}
export function windowNative(record, native) {
  if (record.prefabKey !== 'enemy_2091_skzgds' || record.applyWay !== 'RANGED' || record.stats.dmgType !== 'arts'
    || record.skills.length || Object.keys(record.talents.groups).join() !== '1'
    || record.talents.groups['1'].join() !== 'effect_duration' || record.talents.bb['1.effect_duration'] !== 10) return false;
  const root = native[record.prefabKey]?.[0], mode = native.Default?.[0], logger = native.Ability0?.[0];
  if (root?._modes.length !== 1 || native.$ref(root._modes[0]) !== mode || root._commonAbilities.length !== 1
    || native.$ref(root._commonAbilities[0]) !== logger || mode?._generalAbilities.length
    || native.$ref(mode._attack) !== native.Attack?.[0] || native.$ref(mode._combat) !== native.Combat?.[0]
    || !match(native.$ref(mode._attackTrigger), { _minTargetNum: 1, _keepTarget: 0, _overrideSearchTargetTick: -1 })
    || logger?.m_Script?.m_PathID !== '3800760148018415462' || !zero(logger._selector)
    || !match(logger, { _forceAsDmgOrHealAbility: 0, _ignoreIfOwnerDead: 0, _attachPassiveBuffsOnDummy: 1 })
    || logger._buffs?.length !== 2) return false;
  for (const cast of [native.Attack[0], native.Combat[0]]) if (!match(cast, {
    _attackType: 1, _damageType: 2, _atkScale: 1, _epDamageRatio: 0, _extraDamageType: 0,
    _timeMode: 0, _waitForAttackEvent: 1, _selectTargetSource: 2, _allowNoTarget: 0, _alwaysIncludeTarget: 1,
    _projectileKey: 'projectile_enemy_skzgds', _projectileDestination: 0, _useCachedAtkOnly: 0,
    _useDynamicAttackType: 0, _waitForProjectileInvalid: 0, _preDelay: 0,
  }) || !zero(cast._selector) || cast._activeBuffs.length || cast._extraProjectileKeys.length) return false;
  const rows = native.$projectile('projectile_enemy_skzgds'), life = rows.find(c => '_lifeTime' in c),
    motion = rows.find(c => '_immediatelyReach' in c), effects = rows.find(c => '_effectsWhenHit' in c);
  if (rows.length !== 3 || !effects || !match(life, { _lifeTime: 10, _maxHitNum: 1, _stopAfterMaxHit: 1,
    _canHitSameTargetMultipleTimes: 0, _alwaysHitTraceTargetWhenReached: 1, _alwaysHitTraceTargetInTheEnd: 1,
    _stopWhenSourceInvalid: 0, _hitNumType: 1 }) || life._actionController._extraBuffsInTheEnd.length
    || !match(motion, { _immediatelyReach: 1, _delayTime: 0, _extraDelayTime: 0, _delayToStart: 0,
      _checkReached: 1, _stopIfTargetDead: 0, _stopIfTargetDisappeared: 0 })) return false;
  const [kill, visual] = logger._buffs;
  return passiveOutcomeBuff(kill) && kill.blackboard.length === 0 && kill.templateKey === 'log_killed'
    && passiveOutcomeBuff({ ...visual, lifeTime: 0, lifeTimeType: 2 }) && match(visual, { lifeTime: 10, lifeTimeType: 1,
      durationKey: 'effect_duration_pre', templateKey: 'empty' }) && visual.blackboard.length === 0
    && same(native.$template('empty')?.eventToActions, {})
    && nativeKillLog(native);
}
export const OUTCOME_ENEMY_FEATURES = Object.freeze({
  "ability:Upon defeating the 'Window', the player will enter Prosperity": {
    covers: windowNative, nativeClaim: () => ({ active: 1 }),
    ability: { kind: 'stageOutcomeCounter', params: () => ({ killedKey: 'killed', immediateAttackType: 'arts' }) },
    note: 'Native immediate-hit Arts projectile and kill-result counter, with enemy identity retained in the event. Entering Prosperity belongs to run progression. The ten-second empty birth effect is visual, not a combat timer.',
  },
  'ability:Steals Originium Ingots upon entering the Objective.': {
    covers: (r, n) => lostContraptionNative(r, n) || lostHovercraftNative(r, n), nativeClaim: () => ({ active: 1 }),
    ability: { kind: 'stageOutcomeCounter', params: r => ({ killedKey: r.prefabKey === 'enemy_2070_skzfbx' ? 'killed' : 'trap_758_skzmbx',
      exitKey: 'rogue_thief_reach_exit', exitTile: 'tile_end' }) },
    note: 'Lost Contraption records the native kill counter or objective-entry theft counter. Individual-stage results expose these events; ingot balances and run rewards belong to the caller. Native VFX/toast timing is not reproduced.',
  },
});
