// SPDX-License-Identifier: GPL-3.0-or-later
export const NECRASS_OPERATORS = Object.freeze({
  char_450_necras: {
    skillIds: ['skchr_necras_1', 'skchr_necras_2', 'skchr_necras_3'],
    talentKeys: ['max_token_cnt', 'max_hp', 'atk', 'block_cnt', 'def', 'hp_ratio', 'damage_scale',
      'magic_resistance', 'base_attack_time'],
    passiveTalentKeys: [], talentCostStat: false, criticalTalent: false,
    secondaryFactions: true, mechanic: 'necrass',
  },
});
