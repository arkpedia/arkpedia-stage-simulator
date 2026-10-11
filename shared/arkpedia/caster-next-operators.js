// SPDX-License-Identifier: GPL-3.0-or-later
// Aroma and the first source-reviewed six-star caster kits. Eyjafjalla remains
// deferred in the companion source record until her S3 dispatch is resolved.
export const CASTERS_NEXT_OPERATORS = Object.freeze({
  char_446_aroma: { skillIds: ['skchr_aroma_1', 'skchr_aroma_2'],
    talentKeys: ['levitate_duration', 'damage_scale'], passiveTalentKeys: [], mechanic: 'aroma' },
  char_134_ifrit: { skillIds: ['skchr_ifrit_1', 'skchr_ifrit_2', 'skchr_ifrit_3'],
    talentKeys: ['magic_resistance', 'sp', 'interval'], passiveTalentKeys: [], mechanic: 'ifrit' },
  char_213_mostma: { skillIds: ['skcom_atk_up[3]', 'skchr_mostma_2', 'skchr_mostma_3'],
    talentKeys: ['sp_recovery_per_sec', 'move_speed'], passiveTalentKeys: [], mechanic: 'mostima' },
  char_2013_cerber: { skillIds: ['skchr_cerber_1', 'skchr_cerber_2', 'skchr_cerber_3'],
    talentKeys: ['atk_scale', 'atk', 'attack_speed'], passiveTalentKeys: [], mechanic: 'ceobe' },
});
