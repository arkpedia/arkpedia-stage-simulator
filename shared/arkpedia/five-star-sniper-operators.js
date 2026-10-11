// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_SNIPER_OPERATORS = Object.freeze({
  char_129_bluep: { skillIds: ['skchr_bluep_1', 'skchr_bluep_2'],
    talentKeys: ['duration', 'poison_damage'], passiveTalentKeys: [], mechanic: 'blue-poison' },
  char_204_platnm: { skillIds: ['skcom_atk_up[3]', 'skchr_platnm_2'],
    talentKeys: ['attack@min_delta', 'attack@max_delta', 'attack@min_atk_scale', 'attack@max_atk_scale'],
    passiveTalentKeys: [], mechanic: 'platinum' },
  char_219_meteo: { skillIds: ['skchr_meteo_1', 'skchr_meteo_2'],
    talentKeys: ['atk', 'prob'], passiveTalentKeys: [], criticalTalent: false, mechanic: 'meteorite' },
  char_145_prove: { skillIds: ['skchr_prove_1', 'skchr_prove_2'],
    talentKeys: ['prob', 'prob2', 'atk_scale'], passiveTalentKeys: [], criticalTalent: false, mechanic: 'provence' },
  char_218_cuttle: { skillIds: ['skcom_atk_up[3]', 'skchr_cuttle_2'],
    talentKeys: ['attack_speed'], passiveTalentKeys: [], mechanic: 'andreana' },
});
