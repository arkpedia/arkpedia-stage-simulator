// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_GUARD_EXPANSION_OPERATORS = Object.freeze({
  char_230_savage: { skillIds: ['skchr_savage_1', 'skchr_savage_2'],
    talentKeys: ['cnt', 'atk', 'def'], passiveTalentKeys: [], mechanic: 'savage' },
  char_155_tiger: { skillIds: ['skchr_tiger_1', 'skchr_tiger_2'],
    talentKeys: ['tiger_t_1[evade].prob', 'charge_on_evade.atk'], passiveTalentKeys: [], mechanic: 'indra' },
  char_333_sidero: { skillIds: ['skcom_heal_self[3]', 'skchr_sidero_2'],
    talentKeys: ['times', 'attack_speed', 'one_minus_status_resistance'], passiveTalentKeys: [], mechanic: 'sideroca' },
  char_415_flint: { skillIds: ['skchr_flint_1', 'skchr_flint_2'],
    talentKeys: ['damage_scale'], passiveTalentKeys: [], mechanic: 'flint' },
  char_475_akafyu: { skillIds: ['skchr_akafyu_1', 'skchr_akafyu_2'],
    talentKeys: ['min_attack_speed', 'min_hp_ratio'], passiveTalentKeys: [], mechanic: 'akafuyu' },
});
