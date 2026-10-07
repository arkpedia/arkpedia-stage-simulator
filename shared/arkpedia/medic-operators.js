// SPDX-License-Identifier: GPL-3.0-or-later
export const MEDIC_OPERATORS = Object.freeze({
  char_117_myrrh: { skillIds: ['skchr_myrrh_1', 'skchr_myrrh_2'], talentKeys: ['heal_scale'], mechanic: 'dual-heal', passiveTalentKeys: [] },
  char_187_ccheal: { skillIds: ['skchr_ccheal_1', 'skchr_ccheal_2'], talentKeys: ['atk', 'def', 'duration'], mechanic: 'heal-over-time', passiveTalentKeys: [] },
  char_181_flower: { skillIds: ['skcom_heal_up[2]', 'skchr_flower_2'], talentKeys: ['atk_to_hp_recovery_ratio'], mechanic: 'global-regen', passiveTalentKeys: [] },
  char_298_susuro: { skillIds: ['skcom_heal_up[2]', 'skchr_susuro_2'], talentKeys: ['cost', 'heal_scale'], mechanic: 'squad-healing', passiveTalentKeys: [], talentCostStat: false },
});
