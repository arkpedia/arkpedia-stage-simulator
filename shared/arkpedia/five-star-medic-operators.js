// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_MEDIC_OPERATORS = Object.freeze({
  char_128_plosis: { skillIds: ['skcom_heal_up[3]', 'skchr_plosis_2'],
    talentKeys: ['sp_recovery_per_sec'], passiveTalentKeys: [], mechanic: 'ptilopsis' },
  char_275_breeze: { skillIds: ['skchr_breeze_1', 'skchr_breeze_2'],
    talentKeys: ['one_minus_status_resistance', 'max_hp'], passiveTalentKeys: [], mechanic: 'breeze' },
  char_171_bldsk: { skillIds: ['skchr_bldsk_1', 'skchr_bldsk_2'],
    talentKeys: ['bldsk_t_1[self].sp', 'bldsk_t_1[rand].sp'], passiveTalentKeys: [], mechanic: 'warfarin' },
  char_345_folnic: { skillIds: ['skchr_folnic_1', 'skchr_folnic_2'],
    talentKeys: ['one_minus_status_resistance', 'damage_scale'], passiveTalentKeys: [], mechanic: 'folinic' },
  char_436_whispr: { skillIds: ['skchr_whispr_1', 'skchr_whispr_2'],
    talentKeys: ['atk_to_hp_recovery_ratio'], passiveTalentKeys: [], mechanic: 'whisperain' },
});
