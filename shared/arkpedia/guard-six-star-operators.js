// SPDX-License-Identifier: GPL-3.0-or-later
export const GUARD_SIX_STAR_OPERATORS = Object.freeze({
  char_263_skadi: { skillIds: ['skcom_quickattack[3]', 'skchr_skadi_2', 'skchr_skadi_3'],
    talentKeys: ['atk', 'respawn_time'], passiveTalentKeys: [], mechanic: 'skadi' },
  char_172_svrash: { skillIds: ['skchr_svrash_1', 'skchr_svrash_2', 'skchr_svrash_3'],
    talentKeys: ['atk', 'respawn_time'], passiveTalentKeys: ['atk'], talentCostStat: false, mechanic: 'silverash' },
  char_188_helage: { skillIds: ['skchr_helage_1', 'skchr_helage_2', 'skchr_helage_3'],
    talentKeys: ['min_attack_speed', 'min_hp_ratio', 'hp_recovery_per_sec'],
    passiveTalentKeys: [], mechanic: 'hellagur' },
});
// Thorns and Surtr remain wholly unsupported; retained original evidence records
// the unrecovered S2 counter release and S3 bleeding ramp rather than guesses.
