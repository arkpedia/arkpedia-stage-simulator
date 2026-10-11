// SPDX-License-Identifier: GPL-3.0-or-later
// Both source skills and conditional talents are implemented in regular stages.
export const VANGUARD_OPERATORS = Object.freeze({
  char_198_blackd: {
    skillIds: ['skcom_charge_cost[2]', 'skchr_blackd_2'],
    talentKeys: ['cnt', 'def'], passiveTalentKeys: [], mechanic: 'courier',
  },
  char_149_scave: {
    skillIds: ['skcom_charge_cost[2]', 'skchr_scave_2'],
    talentKeys: ['atk', 'def'], passiveTalentKeys: [], mechanic: 'scavenger',
  },
  char_290_vigna: {
    skillIds: ['skchr_vigna_1', 'skchr_vigna_2'],
    talentKeys: ['atk', 'prob1', 'prob2'], passiveTalentKeys: [],
    // Charger grants kill DP and refunds the original DP cost on manual retreat.
    mechanic: 'charger',
  },
  char_151_myrtle: {
    skillIds: ['skcom_assist_cost[2]', 'skchr_myrtle_2'],
    talentKeys: ['hp_recovery_per_sec'], passiveTalentKeys: [], mechanic: 'myrtle',
  },
});
