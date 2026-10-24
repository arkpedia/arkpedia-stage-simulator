// SPDX-License-Identifier: GPL-3.0-or-later
// Derived enemy support: an enemy is supported when everything it uses has an
// approved implementation. Today that is the stat-only tier, enemies with no
// skills, no talents and no handbook abilities at any level whose original
// prefab has no native ability wrappers or active general/common abilities
// (data/arkpedia-enemy-clock-source.json), plus every feature the registry
// (shared/arkpedia/enemy-features.js) approves for the enemy's records. Features
// that read original component content get it from the retained native ability
// evidence (data/arkpedia-enemy-native-abilities.json), keyed like the index.
import { enemyFeature, recordFeatureIds } from './enemy-features.js';

/** Native ability counts of one original prefab entry of the timing index. */
export function prefabAbilityCounts(prefab) {
  const wrappers = prefab.clockComponents.filter(c => '_familyMask' in c.fields && '_trigger' in c.fields).length;
  const active = prefab.clockComponents.flatMap(c => ['_commonAbilities', '_generalAbilities']
    .flatMap(k => (c.fields[k] ?? []).filter(ref => ref.m_FileID !== 0 || ref.m_PathID !== '0'))).length;
  return { enemyAbilityWrappers: wrappers, activeGeneralOrCommonAbilities: active };
}
export const prefabPath = prefabKey => `dyn/battle/prefabs/enemies/${prefabKey}.prefab`;

/** The retained original components of one prefab: indexed components parsed and grouped by object name, plus
 * `$ref(pathId)` for any retained component (referenced ones included) and `$template(key)` for retained buff templates. */
export function nativeComponents(evidence, prefabKey) {
  const out = {}, byId = new Map();
  for (const c of evidence?.prefabs?.[prefabPath(prefabKey)] ?? []) {
    const data = JSON.parse(c.originalJson);
    byId.set(c.pathId, data);
    if (!c.referenced) (out[c.objectName] ??= []).push(data);
  }
  Object.defineProperty(out, '$ref', { value: ref => byId.get(String(ref?.m_PathID ?? ref)) ?? null });
  Object.defineProperty(out, '$template', { value: key => evidence?.templates?.[key] ?? null });
  Object.defineProperty(out, '$actions', { value: () => evidence?.actions ?? null });
  Object.defineProperty(out, '$retained', { value: () => (evidence?.prefabs?.[prefabPath(prefabKey)] ?? []).map(c => c.originalJson) });
  return out;
}

/** Support decision for one catalogue entry; `reasons` names everything still missing. */
// One reviewed native claim that is not expressible from the shared flying feature: the
// targeteer's single active component is the flying controller itself.
const RECORD_NATIVE_CLAIMS = Object.freeze({ enemy_1112_emppnt: Object.freeze({ active: 1 }), enemy_1161_tidmag: Object.freeze({ active: 1 }), enemy_1160_hvyslr: Object.freeze({ active: 1 }) });

export function enemySupport(entry, prefabs, evidence = {}) {
  const levels = Object.values(entry.levels), reasons = [], features = [], deps = new Set();
  const covers = (f, r) => f.covers(r, nativeComponents(evidence, r.prefabKey));
  // A feature is cleared only when it is registered and covers every level that uses it.
  for (const id of [...new Set(levels.flatMap(recordFeatureIds))]) {
    const f = enemyFeature(id), using = levels.filter(r => recordFeatureIds(r).includes(id));
    // A handbook line with no feature of its own is explained by a cleared talent feature of the same record.
    const explained = !f && id.startsWith('ability:') && using.every(r => recordFeatureIds(r).some(t => {
      const tf = enemyFeature(t), explains = tf?.explains, text = id.slice('ability:'.length);
      return explains && (typeof explains === 'function' ? explains(text, r) : explains.test(text)) && covers(tf, r);
    }));
    if ((f && using.every(r => covers(f, r))) || explained) features.push(id); else reasons.push(id);
    if (f?.dependsOn) for (const r of using) for (const key of f.dependsOn(r)) deps.add(key);
  }
  const native = {};
  for (const key of new Set(levels.map(r => r.prefabKey))) {
    const p = prefabs[prefabPath(key)];
    if (!p) { reasons.push(`prefab-missing:${key}`); continue; }
    const counts = prefabAbilityCounts(p), nat = nativeComponents(evidence, key);
    // A reviewed feature may claim the exact native wrapper/ability component(s) it implements.
    let claimedWrappers = 0, claimedActive = 0;
    for (const id of features) {
      const claim = enemyFeature(id)?.nativeClaim?.(p, nat);
      claimedWrappers += claim?.wrappers ?? 0; claimedActive += claim?.active ?? 0;
    }
    claimedActive += RECORD_NATIVE_CLAIMS[key]?.active ?? 0;
    claimedWrappers += RECORD_NATIVE_CLAIMS[key]?.wrappers ?? 0;
    native[key] = { hierarchySha256: p.hierarchySha256, ...counts, claimedWrappers, claimedActive };
    if (counts.enemyAbilityWrappers > claimedWrappers) reasons.push(`native-ability-wrappers:${key}`);
    if (counts.activeGeneralOrCommonAbilities > claimedActive) reasons.push(`native-abilities:${key}`);
  }
  return { policy: reasons.length ? null : features.length ? 'stats-attacks-and-features' : 'basic-stats-and-attacks', reasons, features, spawns: [...deps].sort(), native, levels: levels.map(r => r.level) };
}

/** Decide every enemy; an enemy that spawns an unsupported (or unknown) enemy is unsupported too. */
export function deriveEnemySupport(records, prefabs, evidence = {}) {
  const out = {};
  for (const [key, entry] of Object.entries(records)) out[key] = enemySupport(entry, prefabs, evidence);
  for (let changed = true; changed;) {
    changed = false;
    for (const e of Object.values(out)) for (const key of e.spawns) if (e.policy && !out[key]?.policy) {
      e.policy = null; e.reasons.push(`spawns:${key}`); changed = true;
    }
  }
  return out;
}
