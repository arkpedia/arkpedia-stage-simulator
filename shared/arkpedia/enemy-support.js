// SPDX-License-Identifier: GPL-3.0-or-later
// Derived enemy support: an enemy is supported when everything it uses has an
// approved implementation. Today that is the stat-only tier, enemies with no
// skills, no talents and no handbook abilities at any level whose original
// prefab has no native ability wrappers or active general/common abilities
// (data/arkpedia-enemy-clock-source.json), plus every feature the registry
// (shared/arkpedia/enemy-features.js) approves for the enemy's records.
import { ENEMY_FEATURES, recordFeatureIds } from './enemy-features.js';

/** Native ability counts of one original prefab entry of the timing index. */
export function prefabAbilityCounts(prefab) {
  const wrappers = prefab.clockComponents.filter(c => '_familyMask' in c.fields && '_trigger' in c.fields).length;
  const active = prefab.clockComponents.flatMap(c => ['_commonAbilities', '_generalAbilities']
    .flatMap(k => (c.fields[k] ?? []).filter(ref => ref.m_FileID !== 0 || ref.m_PathID !== '0'))).length;
  return { enemyAbilityWrappers: wrappers, activeGeneralOrCommonAbilities: active };
}
export const prefabPath = prefabKey => `dyn/battle/prefabs/enemies/${prefabKey}.prefab`;

/** Support decision for one catalogue entry; `reasons` names everything still missing. */
export function enemySupport(entry, prefabs) {
  const levels = Object.values(entry.levels), reasons = [], features = [];
  // A feature is cleared only when it is registered and covers every level that uses it.
  for (const id of [...new Set(levels.flatMap(recordFeatureIds))]) {
    const f = ENEMY_FEATURES[id], using = levels.filter(r => recordFeatureIds(r).includes(id));
    if (f && using.every(r => f.covers(r))) features.push(id); else reasons.push(id);
  }
  const native = {};
  for (const key of new Set(levels.map(r => r.prefabKey))) {
    const p = prefabs[prefabPath(key)];
    if (!p) { reasons.push(`prefab-missing:${key}`); continue; }
    const counts = prefabAbilityCounts(p); native[key] = { hierarchySha256: p.hierarchySha256, ...counts };
    if (counts.enemyAbilityWrappers) reasons.push(`native-ability-wrappers:${key}`);
    if (counts.activeGeneralOrCommonAbilities) reasons.push(`native-abilities:${key}`);
  }
  return { policy: reasons.length ? null : features.length ? 'stats-attacks-and-features' : 'basic-stats-and-attacks', reasons, features, native, levels: levels.map(r => r.level) };
}
