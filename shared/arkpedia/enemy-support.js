// SPDX-License-Identifier: GPL-3.0-or-later
// Derived enemy support: an enemy is supported when everything it uses has an
// approved implementation. Today that is the stat-only tier, enemies with no
// skills, no talents and no handbook abilities at any level whose original
// prefab has no native ability wrappers or active general/common abilities
// (data/arkpedia-enemy-clock-source.json), plus every feature the registry
// (shared/arkpedia/enemy-features.js) approves for the enemy's records.
import { enemyFeature, recordFeatureIds } from './enemy-features.js';

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
  const levels = Object.values(entry.levels), reasons = [], features = [], deps = new Set();
  // A feature is cleared only when it is registered and covers every level that uses it.
  for (const id of [...new Set(levels.flatMap(recordFeatureIds))]) {
    const f = enemyFeature(id), using = levels.filter(r => recordFeatureIds(r).includes(id));
    // A handbook line with no feature of its own is explained by a cleared talent feature of the same record.
    const explained = !f && id.startsWith('ability:') && using.every(r => recordFeatureIds(r).some(t => {
      const tf = t.startsWith('talent:') && enemyFeature(t);
      return tf?.explains?.test(id.slice('ability:'.length)) && tf.covers(r);
    }));
    if ((f && using.every(r => f.covers(r))) || explained) features.push(id); else reasons.push(id);
    if (f?.dependsOn) for (const r of using) for (const key of f.dependsOn(r)) deps.add(key);
  }
  const native = {};
  for (const key of new Set(levels.map(r => r.prefabKey))) {
    const p = prefabs[prefabPath(key)];
    if (!p) { reasons.push(`prefab-missing:${key}`); continue; }
    const counts = prefabAbilityCounts(p); native[key] = { hierarchySha256: p.hierarchySha256, ...counts };
    if (counts.enemyAbilityWrappers) reasons.push(`native-ability-wrappers:${key}`);
    if (counts.activeGeneralOrCommonAbilities) reasons.push(`native-abilities:${key}`);
  }
  return { policy: reasons.length ? null : features.length ? 'stats-attacks-and-features' : 'basic-stats-and-attacks', reasons, features, spawns: [...deps].sort(), native, levels: levels.map(r => r.level) };
}

/** Decide every enemy; an enemy that spawns an unsupported (or unknown) enemy is unsupported too. */
export function deriveEnemySupport(records, prefabs) {
  const out = {};
  for (const [key, entry] of Object.entries(records)) out[key] = enemySupport(entry, prefabs);
  for (let changed = true; changed;) {
    changed = false;
    for (const e of Object.values(out)) for (const key of e.spawns) if (e.policy && !out[key]?.policy) {
      e.policy = null; e.reasons.push(`spawns:${key}`); changed = true;
    }
  }
  return out;
}
