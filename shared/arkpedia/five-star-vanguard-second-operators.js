// SPDX-License-Identifier: GPL-3.0-or-later
// The original Fang investigation is retained as historical source evidence.
// Her complete reviewed adapter is in fang-fire-sharpened-operators.js.
export const FIVE_STAR_VANGUARD_SECOND_OPERATORS = Object.freeze({
  char_220_grani: { skillIds: ['skcom_def_up[3]', 'skchr_grani_2'],
    talentKeys: ['prob'], passiveTalentKeys: [], mechanic: 'charger' },
  char_401_elysm: { skillIds: ['skcom_assist_cost[3]', 'skchr_elysm_2'],
    talentKeys: ['value', 'attack_speed'], talentCostStat: false, passiveTalentKeys: [], mechanic: 'elysium' },
  char_496_wildmn: { skillIds: ['skchr_wildmn_1', 'skchr_wildmn_2'],
    talentKeys: ['flag', 'value', 'max_stack_cnt'], passiveTalentKeys: [], mechanic: 'charger' },
  char_4023_rfalcn: { skillIds: ['skcom_charge_cost[3]', 'skchr_rfalcn_2'],
    talentKeys: ['prob', 'atk_scale'], criticalTalent: false, talentCostStat: false,
    passiveTalentKeys: [], mechanic: 'kestrel' },
});
