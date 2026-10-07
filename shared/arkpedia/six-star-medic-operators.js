// SPDX-License-Identifier: GPL-3.0-or-later
export const SIX_STAR_MEDIC_OPERATORS = Object.freeze({
  char_147_shining: { skillIds: ['skchr_shining_1', 'skchr_shining_2', 'skchr_shining_3'],
    talentKeys: ['def', 'attack_speed'], passiveTalentKeys: [], mechanic: 'shining' },
  char_179_cgbird: { skillIds: ['skcom_heal_up[3]', 'skchr_cgbird_2', 'skchr_cgbird_3'],
    talentKeys: ['magic_resistance', 'cnt'], passiveTalentKeys: [], mechanic: 'nightingale' },
  char_4042_lumen: { skillIds: ['skchr_lumen_1', 'skchr_lumen_2', 'skchr_lumen_3'],
    talentKeys: ['status_resistance[limit]', 'lumen_t_1[special].status_resistance[limit]',
      'one_minus_status_resistance', 'lumen_t_1[special].one_minus_status_resistance', 'hp_ratio', 'heal_scale', 'duration'],
    passiveTalentKeys: [], mechanic: 'lumen' },
});
