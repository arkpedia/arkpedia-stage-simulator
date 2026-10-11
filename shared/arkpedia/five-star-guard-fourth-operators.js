// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_GUARD_FOURTH_OPERATORS = Object.freeze({
  char_4106_bryota: { skillIds: ['skchr_bryota_1', 'skchr_bryota_2'],
    talentKeys: ['bryota_t_ally.def', 'bryota_t_self.def'], passiveTalentKeys: [], mechanic: 'bryophyta' },
  char_154_morgan: { skillIds: ['skchr_morgan_1', 'skchr_morgan_2'],
    talentKeys: ['min_atk', 'min_hp_ratio'], passiveTalentKeys: [], mechanic: 'morgan',
    deploymentSlotExemptTags: ['main_12'], deploymentSlotExemptMinElite: 2 },
  char_157_dagda: { skillIds: ['skchr_dagda_1', 'skchr_dagda_2'],
    talentKeys: ['prob', 'atk_scale', 'atk_up_max_value', 'atk_up_each_time', 'max_hp', 'heal_scale'],
    passiveTalentKeys: [], criticalTalent: false, mechanic: 'dagda' },
  char_194_leto: { skillIds: ['skcom_quickattack[3]', 'skchr_leto_2'],
    talentKeys: ['attack_speed'], passiveTalentKeys: [], mechanic: 'leto' },
  char_4083_chimes: { skillIds: ['skcom_atk_up[3]', 'skchr_chimes_2'],
    talentKeys: ['max_hp', 'atk'], passiveTalentKeys: ['max_hp'], mechanic: 'wind-chimes' },
});
