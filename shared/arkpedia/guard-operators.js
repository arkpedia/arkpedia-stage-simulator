// SPDX-License-Identifier: GPL-3.0-or-later
// Exact regular-stage skill allowlist. Modules are excluded until separately verified.
export const GUARD_OPERATORS = Object.freeze({
  char_289_gyuki: {
    skillIds: ['skcom_heal_self[2]', 'skchr_gyuki_2'],
    talentKeys: ['def', 'max_hp'], mechanic: 'matoimaru',
  },
  char_127_estell: {
    skillIds: ['skcom_atk_up[2]', 'skchr_estell_2'],
    talentKeys: ['hp_ratio'], mechanic: 'estelle',
  },
  char_130_doberm: {
    skillIds: ['skchr_doberm_1', 'skchr_doberm_2'],
    talentKeys: ['atk'], passiveTalentKeys: [], mechanic: 'dobermann',
  },
  char_185_frncat: {
    skillIds: ['skchr_frncat_1', 'skchr_frncat_2'],
    talentKeys: ['prob'], mechanic: 'mousse',
  },
  char_193_frostl: {
    skillIds: ['skchr_frostl_1', 'skchr_frostl_2'],
    talentKeys: ['base_attack_time'], mechanic: 'frostleaf',
  },
});
