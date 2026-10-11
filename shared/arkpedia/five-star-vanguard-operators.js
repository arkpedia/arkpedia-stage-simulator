// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_VANGUARD_OPERATORS = Object.freeze({
  char_115_headbr: { skillIds: ['skcom_charge_cost[3]', 'skchr_headbr_2'],
    talentKeys: ['cost'], passiveTalentKeys: [], mechanic: 'zima' },
  char_102_texas: { skillIds: ['skcom_charge_cost[3]', 'skchr_texas_2'],
    talentKeys: ['cost'], talentCostStat: false, passiveTalentKeys: [], mechanic: 'texas' },
  char_349_chiave: { skillIds: ['skcom_charge_cost[3]', 'skchr_chiave_2'],
    talentKeys: ['respawn_time', 'atk', 'def'], talentCostStat: false,
    passiveTalentKeys: [], mechanic: 'chiave' },
  char_488_buildr: { skillIds: ['skcom_charge_cost[3]', 'skchr_buildr_2'],
    talentKeys: ['max_hp', 'interval'], passiveTalentKeys: [], mechanic: 'poncirus' },
  char_261_sddrag: { skillIds: ['skcom_quickattack[3]', 'skchr_sddrag_2'],
    talentKeys: ['magic_resistance'], passiveTalentKeys: [], mechanic: 'charger' },
});
