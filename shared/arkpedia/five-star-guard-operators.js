// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_GUARD_OPERATORS = Object.freeze({
  char_106_franka: { skillIds: ['skcom_quickattack[3]', 'skchr_franka_2'],
    talentKeys: ['prob'], passiveTalentKeys: [], mechanic: 'franka' },
  char_143_ghost: { skillIds: ['skcom_atk_up[3]', 'skchr_ghost_2'],
    talentKeys: ['max_hp', 'hp_recovery_per_sec_by_max_hp_ratio'], passiveTalentKeys: [], mechanic: 'specter' },
  char_356_broca: { skillIds: ['skchr_broca_1', 'skchr_broca_2'],
    talentKeys: ['atk', 'def', 'cnt'], passiveTalentKeys: [], mechanic: 'broca' },
  char_274_astesi: { skillIds: ['skchr_astesi_1', 'skchr_astesi_2'],
    talentKeys: ['max_stack_cnt', 'interval', 'attack_speed'], passiveTalentKeys: [], mechanic: 'astesia' },
  char_131_flameb: { skillIds: ['skchr_flameb_1', 'skchr_flameb_2'],
    talentKeys: ['max_hp', 'max_stack_cnt'], passiveTalentKeys: [], mechanic: 'flamebringer' },
});
