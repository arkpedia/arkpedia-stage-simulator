// SPDX-License-Identifier: GPL-3.0-or-later
// Admitted through data/arkpedia-aphrissa-runtime-review.json; the relay is
// an owner-controlled token, so its model loads with her (summons.js).
export const APHRISSA_OPERATORS = Object.freeze({
  char_4229_aphris: Object.freeze({
    sourceChannel: 'cn', displayNameFrom: 'appellation', secondaryFactions: true,
    skillIds: Object.freeze(['skchr_aphris_1', 'skchr_aphris_2', 'skchr_aphris_3']),
    talentKeys: Object.freeze(['atk', 'cnt', 'magic_resist_penetrate_fixed']),
    passiveTalentKeys: Object.freeze([]), mechanic: 'aphrissa',
    skillIconFiles: Object.freeze({skchr_aphris_1: 'Aphrissa - Continuous Mapping.webp',
      skchr_aphris_2: 'Aphrissa - Critical Burst.webp', skchr_aphris_3: 'Aphrissa - The Essence of Chaos.webp'}),
  }),
});
