// SPDX-License-Identifier: GPL-3.0-or-later
export const FIVE_STAR_GUARD_SIXTH_OPERATORS = Object.freeze({
  char_1030_noirc2: { skillIds: ['skchr_noirc2_1', 'skchr_noirc2_2'],
    talentKeys: ['min_attack_speed', 'min_hp_ratio', 'min_def', 'atk', 'hit_num', 'attack@clear_attackcount_time'],
    passiveTalentKeys: [], mechanic: 'rathalos-noir-corne' },
  char_4125_rdoc: { skillIds: ['skchr_rdoc_1', 'skchr_rdoc_2'],
    talentKeys: ['max_hp', 'def_penetrate_fixed', 'dec_rate', 'scale'],
    passiveTalentKeys: ['max_hp'], mechanic: 'doc' },
  char_4142_laios: { skillIds: ['skchr_laios_1', 'skchr_laios_2'],
    talentKeys: ['def_penetrate'], passiveTalentKeys: [], mechanic: 'laios' },
  char_459_tachak: { skillIds: ['skchr_tachak_1', 'skchr_tachak_2'],
    talentKeys: ['def', 'respawn_time', 'ability_range_forward_extend'],
    passiveTalentKeys: ['def'], mechanic: 'tachanka' },
});
// Fuze's native five-pellet dispersion has source offset=.25/beginOffset=0,
// but its position dispatcher is unrecovered. Both skills stay unsupported.
