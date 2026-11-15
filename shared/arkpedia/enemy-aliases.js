// SPDX-License-Identifier: GPL-3.0-or-later
import { sponsorNative } from './enemy-supply-features.js';
import { cheeringDrone, CHEERING_DESCRIPTION } from './enemy-drone-features.js';
const finiteStats = r => r?.stats && ['maxHp', 'atk', 'def', 'res', 'moveSpeed', 'bat', 'aspd', 'rangeRadius', 'blockCnt', 'massLevel', 'lpr']
  .every(k => Number.isFinite(r.stats[k])) && r.stats.maxHp > 0 && r.stats.bat > 0 && r.stats.moveSpeed >= 0;
const identity = (r, base) => /^enemy_[a-z0-9_]+$/i.test(base ?? '') && r?.prefabKey === base && r.assetPrefabKey === base
  && Array.isArray(r.skills) && r.skills.length === 0 && (!r.sp || r.sp.maxSp === 0 && r.sp.initSp === 0) && finiteStats(r);

/** Ordinary aliases cannot hide features or a different original prefab. */
export function isBasicEnemyAlias(record, base, policy) {
  return policy === 'basic-stats-and-attacks' && identity(record, base)
    && Array.isArray(record.abilities) && record.abilities.length === 0
    && record.talents && ['bb', 'bbStr', 'groups'].every(k => record.talents[k] && Object.keys(record.talents[k]).length === 0)
    && ['MELEE', 'RANGED', 'NONE'].includes(record.applyWay) && ['WALK', 'FLY'].includes(record.stats.motion);
}
const prefix = ['Flying unit.', 'Does not count towards the defeated enemies counter'];
const supply = reward => ({ abilities: [...prefix, reward], native: sponsorNative,
  numbers: { 'loot.cnt': n => Number.isSafeInteger(n) && n > 0 },
  strings: { 'loot.token_key': s => typeof s === 'string' && /^trap_[a-z0-9_]+$/.test(s) },
  groups: { loot: 'cnt,token_key' } });
/** Each new feature-backed alias is one bounded contract, not arbitrary
 * inheritance. Parameter values and native predicate must both be reviewed. */
export const FEATURE_ALIAS_CONTRACTS = Object.freeze({
  enemy_1105_tyokai: supply('When destroyed, grants a deployable unit'),
  enemy_1105_tyokai_2: supply('When destroyed, grants a large number of deployable units'),
  enemy_1106_byokai: { abilities: [...prefix, CHEERING_DESCRIPTION], native: cheeringDrone,
    numbers: { 'buff.duration': n => [20, 60].includes(n), 'buff.attack_speed': n => n === 100, 'buff.def': n => n === .5 },
    strings: {}, groups: { buff: 'attack_speed,def,duration' }, inactiveSpRecovery: 1, validate: r => r.stats.immunities?.silence === true },
});
const keysMatch = (actual, expected) => actual && Object.keys(actual).sort().join() === Object.keys(expected).sort().join();
export function isFeatureEnemyAlias(r, base, policy) {
  const contract = FEATURE_ALIAS_CONTRACTS[base];
  return !!contract && policy === 'stats-attacks-and-features' && identity(r, base)
    && (!contract.validate || contract.validate(r))
    && r.applyWay === 'NONE' && r.stats.motion === 'FLY' && r.stats.blockCnt === 1
    && Array.isArray(r.abilities) && r.abilities.map(a => a.text).join('|') === contract.abilities.join('|')
    && keysMatch(r.talents?.bb, contract.numbers) && Object.entries(contract.numbers).every(([key, valid]) => valid(r.talents.bb[key]))
    && keysMatch(r.talents?.bbStr, contract.strings) && Object.entries(contract.strings).every(([key, valid]) => valid(r.talents.bbStr[key]))
    && keysMatch(r.talents?.groups, contract.groups) && Object.entries(contract.groups).every(([key, signature]) => Array.isArray(r.talents.groups[key]) && [...r.talents.groups[key]].sort().join() === signature);
}
export function isStageEnemyAlias(record, base, policy) {
  return isBasicEnemyAlias(record, base, policy) || isFeatureEnemyAlias(record, base, policy);
}
