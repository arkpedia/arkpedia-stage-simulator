// SPDX-License-Identifier: GPL-3.0-or-later
import { STAGE_TOKEN_UNITS } from '../../shared/arkpedia/stage-devices.js';
import { readOriginalLevel } from './original-level.mjs';
/** A hidden supply card is revealed by one ACTIVATE_PREDEFINED of its key that actually runs (TR-8's crates,
 * 5 s into wave 1): the stage then grants its stock. Any other hidden card has no reviewed controller. */
export function hiddenSupplyCardRevealed(card, level, rules = {}) {
  const actions = (level.waves ?? []).flatMap(w => (w.fragments ?? []).flatMap(f => f.actions ?? []))
    .filter(a => !(a.hiddenGroup && rules?.hiddenGroups?.[a.hiddenGroup] !== true));
  const reveal = actions.filter(a => a.key === card.unit_id);
  return reveal.length === 1 && ['ACTIVATE_PREDEFINED', 6].includes(reveal[0].actionType) && reveal[0].count === 1
    && !reveal[0].randomSpawnGroupKey;
}
export function validateStageSupplyCards(cards, level, rules = {}) {
  for (const card of cards.filter(t => STAGE_TOKEN_UNITS[t.unit_id]?.supplyCard)) {
    const matches = (level.predefines?.tokenCards ?? []).filter(p => p.inst?.characterKey === card.unit_id);
    if (matches.length !== 1) throw Error(`Missing or ambiguous original supply card: ${card.unit_id}`);
    const original = matches[0], inst = original.inst;
    const hidden = original.hidden === true && card.hidden === true && original.alias == null && hiddenSupplyCardRevealed(card, level, rules);
    if (original.hidden !== false && !hidden || original.hidden === false && card.hidden === true || original.initialCnt !== card.count || inst.level !== card.level
      || ![0, 'PHASE_0'].includes(inst.phase) || card.elite !== 0 || inst.potentialRank !== card.potential
      || inst.favorPoint !== 0 || original.skillIndex !== card.skill_index || original.mainSkillLvl !== card.skill_level
      || original.overrideSkillBlackboard != null || original.overrideTalents != null || original.uniEquipIds?.length || original.masterInfos?.length)
      throw Error(`Unimplemented original supply card override: ${card.unit_id}`);
  }
}
export async function prepareStageSupplyCards({ root, rules, geometry, compiledRules = {} }) {
  const cards = geometry?.suppliedUnits?.deployable_tokens ?? [];
  if (!cards.some(t => STAGE_TOKEN_UNITS[t.unit_id]?.supplyCard)) return [];
  const { level, source } = await readOriginalLevel(root, rules);
  validateStageSupplyCards(cards, level, compiledRules);
  return [source];
}
