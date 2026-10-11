// SPDX-License-Identifier: GPL-3.0-or-later
export const FARTOOTH_OPERATORS = Object.freeze({
  char_430_fartth: {
    // The first native prefab is an override of this exact shared table skill.
    skillIds: ['skcom_quickattack[3]', 'skchr_fartth_2', 'skchr_fartth_3'],
    talentKeys: ['atk', 'delay', 'taunt_level'], passiveTalentKeys: [],
    mechanic: 'fartooth',
  },
});
