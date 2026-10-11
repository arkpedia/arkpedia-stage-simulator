// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit regular-stage kits, including both skills and promotion-aware talents.
export const CASTER_EXPANSION_OPERATORS = Object.freeze({
  char_328_cammou: {
    skillIds: ['skcom_atk_up[2]', 'skchr_cammou_2'],
    talentKeys: ['attack_speed'], passiveTalentKeys: ['attack_speed'], mechanic: 'click',
  },
  char_469_indigo: {
    skillIds: ['skchr_indigo_1', 'skchr_indigo_2'],
    talentKeys: ['prob', 'duration'], passiveTalentKeys: [], mechanic: 'indigo',
  },
  char_4004_pudd: {
    skillIds: ['skcom_magic_rage[2]', 'skchr_pudd_2'],
    talentKeys: ['atk'], passiveTalentKeys: ['atk'], mechanic: 'pudding',
  },
});
