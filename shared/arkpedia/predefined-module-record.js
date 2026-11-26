// SPDX-License-Identifier: GPL-3.0-or-later
// Applies a preset operator's compiled module (tools/arkpedia/stage-predefined-operators.mjs stores the definition that
// shared/arkpedia/predefined-modules.js reviewed) to its operator record. No source data is imported here.
const finite = (...values) => values.every(v => typeof v === 'number' && Number.isFinite(v));

/** An operator record (loadout.js `recordFor`) wearing `module`. The input record is not changed. */
export function withPredefinedModule(record, module) {
  const talent = module?.talent, old = record?.talents?.[talent?.index];
  if (!module || record.charId !== module.operator || !old || !finite(module.stats?.maxHp, module.stats?.atk, module.epDamageRatio)
    || module.stats.maxHp < 0 || module.stats.atk < 0 || module.epDamageRatio < 0 || module.epDamageRatio > 1
    || module.element !== 'apoptosis' || !talent.bb || !Object.values(talent.bb).every(v => finite(v)))
    throw Error(`Invalid predefined operator module: ${module?.id}`);
  const talents = record.talents.map((t, i) => i === talent.index
    ? { ...t, name: talent.name, description: talent.description, blackboard: talent.blackboard, bb: { ...talent.bb } } : t);
  return { ...record, talents,
    stats: { ...record.stats, maxHp: record.stats.maxHp + module.stats.maxHp, atk: record.stats.atk + module.stats.atk },
    module: { id: module.id, stage: module.stage, name: module.name, epDamageRatio: module.epDamageRatio, element: module.element,
      trait: module.trait } };
}
