// SPDX-License-Identifier: GPL-3.0-or-later
import { PROFESSION_BITS, BUILDABLE_BITS } from './stage-card-rules.js';

/** Character rules use the character's own class/placement, including traps;
 * tokens do not inherit their owner's selector. Values stay out of shared data. */
export function stageCharacterMultipliers(rules, { id, profession, position }) {
  return characterValues(rules, { id, profession, position }, 'multipliers', 1, (a, b) => a * b);
}
export function stageCharacterAdditions(rules, { id, profession, position }) {
  return characterValues(rules, { id, profession, position }, 'additions', 0, (a, b) => a + b);
}
function characterValues(rules, { id, profession, position }, field, initial, combine) {
  const result = {};
  for (const rule of rules?.characterAttributes ?? []) {
    if (rule.ids && !rule.ids.includes(id)) continue;
    if (!(rule.professionMask & PROFESSION_BITS[profession])
      || (rule.buildableMask !== 3 && !(rule.buildableMask & BUILDABLE_BITS[position]))) continue;
    for (const [key, value] of Object.entries(rule[field] ?? {})) result[key] = combine(result[key] ?? initial, value);
  }
  return result;
}
export function stageDeviceAttributes(rules, id, stats, position = 'NONE') {
  const result = { ...stats };
  for (const [key, value] of Object.entries(stageCharacterMultipliers(rules, { id, profession: 'TRAP', position }))) {
    const field = key === 'maxHp' ? 'hp' : key;
    result[field] = (result[field] ?? 0) * value;
  }
  for (const [key, value] of Object.entries(stageCharacterAdditions(rules, { id, profession: 'TRAP', position }))) {
    const field = key === 'blockCnt' ? 'block' : key;
    result[field] = Math.max(0, (result[field] ?? 0) + value);
  }
  return result;
}
