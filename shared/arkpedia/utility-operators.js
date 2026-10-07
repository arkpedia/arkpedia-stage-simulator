// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit regular-stage healers, defenders and zero-slot robots.
export const UTILITY_OPERATORS = Object.freeze({
  char_199_yak: { skillIds: ['skchr_yak_1', 'skchr_yak_2'], talentKeys: ['magic_resistance'], passiveTalentKeys: [], mechanic: 'matterhorn' },
  char_4130_luton: { skillIds: ['skchr_luton_1', 'skchr_luton_2'], talentKeys: ['hp_ratio'], passiveTalentKeys: [], mechanic: 'magnetic-defense' },
  char_385_finlpp: { skillIds: ['skchr_finlpp_1', 'skchr_finlpp_2'], talentKeys: ['status_resistance[limit]', 'one_minus_status_resistance'], passiveTalentKeys: [], mechanic: 'therapist' },
  char_4041_chnut: { skillIds: ['skchr_chnut_1', 'skchr_chnut_2'], talentKeys: ['ep_heal_scale'], passiveTalentKeys: [], mechanic: 'wandering-medic' },
  char_285_medic2: { skillId: null, talentKeys: ['value'], passiveTalentKeys: [], mechanic: 'lancet', deploymentSlotCost: 0 },
  char_286_cast3: { skillId: null, talentKeys: ['duration', 'atk', 'def'], passiveTalentKeys: [], mechanic: 'castle', deploymentSlotCost: 0 },
  char_376_therex: { skillId: null, talentKeys: ['interval', 'damage_by_atk_scale', 'weak[limit]', 'damage_scale'], passiveTalentKeys: [], mechanic: 'therm-ex', deploymentSlotCost: 0, noBasicAttack: true },
  char_4000_jnight: { skillId: null, talentKeys: ['duration', 'damage_scale', 'jnight_t.taunt_level'], passiveTalentKeys: [], mechanic: 'justice-knight', deploymentSlotCost: 0 },
  char_4093_frston: { skillId: null, talentKeys: ['duration', 'damage_resistance'], passiveTalentKeys: [], mechanic: 'friston', deploymentSlotCost: 0 },
  char_4188_confes: { skillId: null, talentKeys: ['cost', 'cnt', 'sleep'], passiveTalentKeys: [], mechanic: 'confess', deploymentSlotCost: 0, talentCostStat: false },
});
