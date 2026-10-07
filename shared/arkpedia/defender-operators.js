// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage kits verified from the pinned Global tables and client prefabs.
// Modules are excluded until their behavior is independently verified.
export const DEFENDER_OPERATORS = Object.freeze({
  char_150_snakek: {
    skillIds: ['skcom_def_up[2]', 'skchr_snakek_2'],
    talentKeys: ['def'], mechanic: 'cuora',
  },
  char_381_bubble: {
    skillIds: ['skcom_def_up[2]', 'skchr_bubble_2'],
    talentKeys: ['atk', 'duration'], passiveTalentKeys: [], mechanic: 'bubble',
  },
  char_260_durnar: {
    skillIds: ['skcom_atk_up[2]', 'skchr_durnar_2'],
    talentKeys: ['atk', 'def'], mechanic: 'dur-nar',
  },
  char_196_sunbr: {
    skillIds: ['skchr_sunbr_1', 'skchr_sunbr_2'],
    talentKeys: ['prob', 'atk_scale', 'stun'], criticalTalent: false, mechanic: 'gummy',
  },
});
