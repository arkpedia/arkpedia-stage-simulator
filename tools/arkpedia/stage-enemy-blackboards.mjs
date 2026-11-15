// SPDX-License-Identifier: GPL-3.0-or-later
import { readOriginalLevel } from './original-level.mjs';
import { parasiticLevelState, withoutParasiticRef } from './stage-parasitic.mjs';

const ATTRIBUTE_NAMES = Object.freeze({ maxHp: 'hp', magicResistance: 'res', moveSpeed: 'move_speed',
  baseAttackTime: 'attack_interval', attackSpeed: 'attack_speed', massLevel: 'weight', tauntLevel: 'taunt',
  epResistance: 'elemental_res', epDamageResistance: 'elemental_damage_res' });

/** Attribute values come from the same original level as talents and waves.
 * Never copy the older viewer projection: it can omit immunity values or
 * contain corrupt serialized fields. Unknown defined attributes are retained
 * so the existing compiler rejects them rather than silently discarding them. */
export function originalEnemyAttributes(refs) {
  const attributes = {};
  for (const ref of refs) {
    if (ref.useDb !== true) continue;
    if (!Number.isInteger(ref.level) || ref.level < 0) throw Error('Invalid original enemy database level');
    const data = ref.overwrittenData, overrides = {};
    for (const [key, field] of Object.entries(data?.attributes ?? {})) {
      if (typeof field?.m_defined !== 'boolean') throw Error(`Malformed original enemy attribute: ${ref.id}.${key}`);
      if (field.m_defined) overrides[ATTRIBUTE_NAMES[key] ?? key] = field.m_value;
    }
    for (const [key, mapped] of [['rangeRadius', 'range'], ['lifePointReduce', 'life_cost']]) {
      const field = data?.[key];
      if (field != null && typeof field.m_defined !== 'boolean') throw Error(`Malformed original enemy attribute: ${ref.id}.${key}`);
      if (field?.m_defined) overrides[mapped] = field.m_value;
    }
    if (Object.hasOwn(attributes, ref.id)) throw Error('Duplicate original enemy attribute definition');
    attributes[ref.id] = { level: ref.level, overrides };
  }
  return attributes;
}

/** The map export omits talent overrides. Read the same immutable original
 * level used for rules/devices; one source blob serves all stage variants. */
export async function prepareStageEnemyBlackboards({ root, rules }) {
  const { level, source } = await readOriginalLevel(root, rules);
  if (!Array.isArray(level.enemyDbRefs) || new Set(level.enemyDbRefs.map(r => r.id)).size !== level.enemyDbRefs.length)
    throw Error('Missing or duplicate original enemy definitions');
  const overrides = {};
  const parasitic = parasiticLevelState(level);
  for (const original of level.enemyDbRefs) {
    const ref = parasitic ? withoutParasiticRef(original) : original;
    if (ref.useDb !== true) continue; // Full stage-local aliases have their own compiler.
    const data = ref.overwrittenData;
    if (data?.talentBlackboard == null && !data?.skills?.length && data?.spData == null) continue;
    overrides[ref.id] = { level: ref.level, blackboard: data.talentBlackboard ?? [],
      ...(data.skills?.length ? { skills: data.skills } : {}), ...(data.spData != null ? { spData: data.spData } : {}) };
  }
  return { overrides, attributes: originalEnemyAttributes(level.enemyDbRefs), sources: [source] };
}
