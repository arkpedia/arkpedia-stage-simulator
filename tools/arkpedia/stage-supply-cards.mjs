// SPDX-License-Identifier: GPL-3.0-or-later
import { STAGE_TOKEN_UNITS } from '../../shared/arkpedia/stage-devices.js';
import { readOriginalLevel } from './original-level.mjs';
export function validateStageSupplyCards(cards, level) {
  for (const card of cards.filter(t => STAGE_TOKEN_UNITS[t.unit_id]?.supplyCard)) {
    const matches = (level.predefines?.tokenCards ?? []).filter(p => p.inst?.characterKey === card.unit_id);
    if (matches.length !== 1) throw Error(`Missing or ambiguous original supply card: ${card.unit_id}`);
    const original = matches[0], inst = original.inst;
    if (original.hidden !== false || original.initialCnt !== card.count || inst.level !== card.level
      || ![0, 'PHASE_0'].includes(inst.phase) || card.elite !== 0 || inst.potentialRank !== card.potential
      || inst.favorPoint !== 0 || original.skillIndex !== card.skill_index || original.mainSkillLvl !== card.skill_level
      || original.overrideSkillBlackboard != null || original.overrideTalents != null || original.uniEquipIds?.length || original.masterInfos?.length)
      throw Error(`Unimplemented original supply card override: ${card.unit_id}`);
  }
}
export async function prepareStageSupplyCards({ root, rules, geometry }) {
  const cards = geometry?.suppliedUnits?.deployable_tokens ?? [];
  if (!cards.some(t => STAGE_TOKEN_UNITS[t.unit_id]?.supplyCard)) return [];
  const { level, source } = await readOriginalLevel(root, rules);
  validateStageSupplyCards(cards, level);
  return [source];
}
