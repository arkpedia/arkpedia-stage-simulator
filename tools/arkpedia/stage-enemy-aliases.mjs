// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readOriginalLevel } from './original-level.mjs';
import { parasiticLevelState, withoutParasiticRef } from './stage-parasitic.mjs';
import { compileEnemy, enemyFeatures } from '../../shared/arkpedia/enemy-records.js';
import { nativeComponents } from '../../shared/arkpedia/enemy-support.js';
import { recordFeatureIds } from '../../shared/arkpedia/enemy-features.js';
import native from '../../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import { isStageEnemyAlias, FEATURE_ALIAS_CONTRACTS } from '../../shared/arkpedia/enemy-aliases.js';

const FIELDS = new Set(['name', 'description', 'prefabKey', 'attributes', 'applyWay', 'motion', 'enemyTags',
  'lifePointReduce', 'levelType', 'rangeRadius', 'numOfExtraDrops', 'viewRadius', 'notCountInTotal',
  'talentBlackboard', 'skills', 'spData']);
const ATTRIBUTES = new Set(['maxHp', 'atk', 'def', 'magicResistance', 'blockCnt', 'moveSpeed', 'attackSpeed',
  'baseAttackTime', 'hpRecoveryPerSec', 'massLevel', 'tauntLevel', 'epResistance', 'epDamageResistance',
  'damageHitratePhysical', 'damageHitrateMagical', 'stunImmune', 'silenceImmune', 'sleepImmune',
  'frozenImmune', 'levitateImmune', 'disarmedCombatImmune', 'fearedImmune', 'palsyImmune',
  'attractImmune', 'teleportImmune', 'groundBoundImmune']);

export function compileStageEnemyAlias(ref, records, support) {
  if (ref?.useDb !== false || ref.level !== 0 || !/^enemy_[a-z0-9_]+$/i.test(ref.id ?? '')
    || Object.keys(ref).some(k => !['useDb', 'id', 'level', 'overwrittenData'].includes(k))) throw Error('Unsupported stage-local enemy reference');
  const data = ref.overwrittenData, base = data?.prefabKey?.m_defined && data.prefabKey.m_value;
  const contract = FEATURE_ALIAS_CONTRACTS[base];
  // The native default regeneration value has no consumer in these bounded
  // definitions: either an ordinary feature-free prefab, or an explicit alias
  // contract, with no skills and no SP capacity/initial charge.
  const inactiveSpValue = contract?.inactiveSpRecovery
    ?? (support.enemies[base]?.policy === 'basic-stats-and-attacks' ? 1 : null);
  const inactiveSp = inactiveSpValue != null && !data?.skills?.length
    && (data?.spData == null || data.spData.maxSp === 0 && data.spData.initSp === 0);
  if (!data || Object.keys(data).some(key => !FIELDS.has(key)) || Object.entries(data.attributes ?? {})
    .some(([key, field]) => !ATTRIBUTES.has(key) && field?.m_defined && field.m_value !== 0 && field.m_value !== false
      && !(key === 'spRecoveryPerSec' && inactiveSp && inactiveSpValue === field.m_value)))
    throw Error('Stage-local enemy has unimplemented definition fields');
  const original = records.enemies[base]?.levels[0];
  const featureAlias = !!contract && support.enemies[base]?.policy === 'stats-attacks-and-features';
  if (!original || !featureAlias && support.enemies[base]?.policy !== 'basic-stats-and-attacks')
    throw Error(`Stage-local enemy requires a reviewed prefab alias contract: ${base || ref.id}`);
  if (data.skills?.length || !featureAlias && data.talentBlackboard?.length || data.spData?.maxSp > 0 || data.spData?.initSp > 0)
    throw Error('Stage-local enemy has unimplemented skills or talents');
  if (data.numOfExtraDrops?.m_defined && data.numOfExtraDrops.m_value !== 0
    || data.viewRadius?.m_defined && ![-1, 0].includes(data.viewRadius.m_value))
    throw Error('Stage-local enemy has unsupported reward or sight overrides');
  const record = compileEnemy({ key: ref.id, rows: [{ level: 0, enemyData: data }], level: 0 });
  record.assetPrefabKey = base;
  if (featureAlias) {
    const bb = data.talentBlackboard ?? [];
    const expected = Object.keys(contract.numbers).length + Object.keys(contract.strings).length;
    if (bb.length !== expected || new Set(bb.map(p => p.key)).size !== expected) throw Error('Missing or duplicate feature alias parameters');
    // Motion lives on the native prefab when a full stage-local definition
    // omits it. HP/DEF/RES and reward parameters still come from that definition.
    if (!data.motion?.m_defined) record.stats.motion = original.stats.motion;
    record.abilities = structuredClone(original.abilities);
    if (!contract.native(record, nativeComponents(native, base))) throw Error('Unreviewed feature alias native behavior');
  }
  // Damage type belongs to the reviewed native prefab/handbook, not the
  // stage's stat definition (which has no damage-type field).
  record.stats.dmgType = original.stats.dmgType;
  record.stats.dmgTypes = [...original.stats.dmgTypes];
  if (!isStageEnemyAlias(record, base, support.enemies[base].policy)
    || record.applyWay !== original.applyWay || record.stats.motion !== original.stats.motion
    || record.stats.blockCnt !== original.stats.blockCnt)
    throw Error('Unsupported stage-local enemy behavior');
  return { base, record, entry: { handbook: false, levels: { 0: record }, features: enemyFeatures(record) },
    decision: { policy: support.enemies[base].policy, reasons: [], features: recordFeatureIds(record), spawns: [], levels: [0] } };
}

/** Original levels are cached by verified Git blob, shared by variants. No
 * global alias registration or duplicated prefab/asset is created. */
export async function prepareStageEnemyAliases({ root, rules, geometry, records, support }) {
  const ids = (geometry?.enemyConfigurations ?? []).filter(c => c.source === 'stage-local enemy; useDb false').map(c => c.enemy_id);
  const out = { aliases: {}, records: {}, support: {}, failures: [], sources: [], ids };
  if (!ids.length) return out;
  try {
    const { level, source } = await readOriginalLevel(root, rules);
    const refs = level.enemyDbRefs;
    const parasitic = parasiticLevelState(level);
    if (!Array.isArray(refs) || new Set(refs.map(r => r.id)).size !== refs.length) throw Error('Missing or duplicate original enemy definitions');
    out.sources.push(source);
    for (const id of ids) {
      try {
        const ref = refs.find(ref => ref.id === id);
        const compiled = compileStageEnemyAlias(parasitic ? withoutParasiticRef(ref) : ref, records, support);
        out.aliases[id] = compiled.base; out.records[id] = compiled.entry; out.support[id] = compiled.decision;
      } catch (error) { out.failures.push({ id, message: error.message }); }
    }
  } catch (error) { for (const id of ids) out.failures.push({ id, message: error.message }); }
  if (Object.values(out.support).some(d => d.policy === 'stats-attacks-and-features')) {
    const sources = await Promise.all(['data/arkpedia-enemy-records.json', 'data/arkpedia-enemy-support.json', 'data/arkpedia-enemy-native-abilities.json']
      .map(async path => ({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') })));
    out.sources.push(...sources);
  }
  return out;
}
