// SPDX-License-Identifier: GPL-3.0-or-later
// Original ProfessionMask bits (distinct from handbook class order).
export const PROFESSION_BITS = Object.freeze({ CASTER: 1, SNIPER: 2, MEDIC: 4, SUPPORT: 8,
  WARRIOR: 16, TANK: 32, SPECIAL: 64, TOKEN: 128, TRAP: 256, PIONEER: 512 });
export const BUILDABLE_BITS = Object.freeze({ NONE: 0, MELEE: 1, RANGED: 2, ALL: 3 });
export function cardRuleMask(value, bits, maximum) {
  const mask = typeof value === 'string' ? bits[value] : value;
  return Number.isSafeInteger(mask) && mask > 0 && mask <= maximum ? mask : null;
}
// Deployment bans retain the squad card: its squad-wide talents still apply.
// Only operator professions with ALL buildable targeting are admitted so far.
export function stageCardDeploymentBlocked(rules, record) {
  const profession = PROFESSION_BITS[record.profession ?? record.raw?.profession];
  return ((rules?.deploymentExcludedProfessionMask ?? 0) & profession) !== 0;
}
export function stageCardMultiplier(rules, record, attribute) {
  const profession = PROFESSION_BITS[record.profession ?? record.raw?.profession];
  const position = BUILDABLE_BITS[record.position ?? record.raw?.position];
  return (rules?.allyCards ?? []).reduce((scale, rule) => rule.attribute === attribute && rule.add == null
    && (rule.professionMask & profession) !== 0 && (rule.buildableMask === 3 || (rule.buildableMask & position) !== 0) ? scale * rule.scale : scale, 1);
}
/** Additive card rules (char_respawntime_add): seconds added after the multipliers. */
export function stageCardAddition(rules, record, attribute) {
  const profession = PROFESSION_BITS[record.profession ?? record.raw?.profession];
  const position = BUILDABLE_BITS[record.position ?? record.raw?.position];
  return (rules?.allyCards ?? []).reduce((sum, rule) => rule.attribute === attribute && rule.add != null
    && (rule.professionMask & profession) !== 0 && (rule.buildableMask === 3 || (rule.buildableMask & position) !== 0) ? sum + rule.add : sum, 0);
}
