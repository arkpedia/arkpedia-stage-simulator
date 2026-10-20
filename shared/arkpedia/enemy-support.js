// SPDX-License-Identifier: GPL-3.0-or-later
// Derived enemy support: an enemy is supported when everything it uses has an
// approved implementation. Today that is the stat-only tier, enemies with no
// skills, no talents and no handbook abilities at any level whose original
// prefab has no native ability wrappers or active general/common abilities
// (data/arkpedia-enemy-clock-source.json). The feature registry adds the rest.

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
  const levels = Object.values(entry.levels), reasons = [];
  if (levels.some(r => r.skills.length)) reasons.push(...new Set(levels.flatMap(r => r.skills.map(s => `skill:${s.prefabKey}`))));
  if (levels.some(r => Object.keys(r.talents.bb).length || Object.keys(r.talents.bbStr).length))
    reasons.push(...new Set(levels.flatMap(r => Object.keys(r.talents.groups).map(g => `talent:${g}`))));
  if (levels.some(r => r.abilities.length)) reasons.push('handbook-abilities');
  const native = {};
  for (const key of new Set(levels.map(r => r.prefabKey))) {
    const p = prefabs[prefabPath(key)];
    if (!p) { reasons.push(`prefab-missing:${key}`); continue; }
    const counts = prefabAbilityCounts(p); native[key] = { hierarchySha256: p.hierarchySha256, ...counts };
    if (counts.enemyAbilityWrappers) reasons.push(`native-ability-wrappers:${key}`);
    if (counts.activeGeneralOrCommonAbilities) reasons.push(`native-abilities:${key}`);
  }
  return { policy: reasons.length ? null : 'basic-stats-and-attacks', reasons, native, levels: levels.map(r => r.level) };
}
