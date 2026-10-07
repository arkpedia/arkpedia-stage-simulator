// SPDX-License-Identifier: GPL-3.0-or-later
// Exact regular-stage skills, without unverified modules.
export const SPECIALIST_OPERATORS = Object.freeze({
  char_237_gravel: {
    skillIds: ['skchr_gravel_1', 'skchr_gravel_2'],
    talentKeys: ['cost', 'def', 'cond.cost'], passiveTalentKeys: [], mechanic: 'gravel',
  },
  char_355_ethan: {
    skillIds: ['skchr_ethan_1', 'skchr_ethan_2'],
    talentKeys: ['prob', 'frozen_duration'], mechanic: 'ethan',
  },
  char_277_sqrrel: {
    skillIds: ['skchr_sqrrel_1', 'skchr_sqrrel_2'],
    talentKeys: ['magic_resistance'], deployOnRanged: true, mechanic: 'shaw',
  },
  char_236_rope: {
    skillIds: ['skchr_rope_1', 'skchr_rope_2'],
    talentKeys: ['prob'], deployOnRanged: true, mechanic: 'rope',
  },
});
