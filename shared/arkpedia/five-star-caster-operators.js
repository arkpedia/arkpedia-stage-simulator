// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_CASTER_OPERATORS = Object.freeze({
  char_4054_malist: {
    skillIds: ['skcom_quickattack[3]', 'skchr_malist_2'],
    talentKeys: ['prob', 'atk_scale'], passiveTalentKeys: [], criticalTalent: false, mechanic: 'minimalist',
  },
  char_002_amiya: {
    skillIds: ['skcom_magic_rage[3]', 'skchr_amiya_2', 'skchr_amiya_3'],
    talentKeys: ['amiya_t_1[atk].sp', 'amiya_t_1[kill].sp'], passiveTalentKeys: [], mechanic: 'amiya',
  },
  char_166_skfire: {
    skillIds: ['skcom_atk_up[3]', 'skchr_skfire_2'],
    talentKeys: ['damage_scale'], passiveTalentKeys: [], mechanic: 'skyfire',
  },
  char_306_leizi: {
    skillIds: ['skcom_atk_up[3]', 'skchr_leizi_2'],
    talentKeys: ['atk_scale'], passiveTalentKeys: [], mechanic: 'leizi',
  },
  char_135_halo: {
    skillIds: ['skchr_halo_1', 'skchr_halo_2'],
    talentKeys: ['max_stack_cnt', 'interval', 'attack_speed'], passiveTalentKeys: [], mechanic: 'astgenne',
  },
});
