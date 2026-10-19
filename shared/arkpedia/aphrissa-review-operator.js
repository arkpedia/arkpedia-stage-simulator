// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit local review support only. This is deliberately absent from REGULAR_OPERATORS.
export const APHRISSA_REVIEW_ID = 'char_4229_aphris';
export const APHRISSA_REVIEW_OPERATOR = Object.freeze({
  sourceChannel: 'cn', displayNameFrom: 'appellation', secondaryFactions: true,
  skillIds: Object.freeze(['skchr_aphris_1', 'skchr_aphris_2', 'skchr_aphris_3']),
  talentKeys: Object.freeze(['atk', 'cnt', 'magic_resist_penetrate_fixed']),
  passiveTalentKeys: Object.freeze([]), mechanic: 'held-aphrissa',
  skillIconFiles: Object.freeze({skchr_aphris_1: 'Aphrissa - Continuous Mapping.webp',
    skchr_aphris_2: 'Aphrissa - Critical Burst.webp', skchr_aphris_3: 'Aphrissa - The Essence of Chaos.webp'}),
});
export function aphrissaReviewSupport(id, candidates) {
  return id === APHRISSA_REVIEW_ID && Array.isArray(candidates)
    && candidates.length === 1 && candidates[0] === id ? APHRISSA_REVIEW_OPERATOR : undefined;
}
