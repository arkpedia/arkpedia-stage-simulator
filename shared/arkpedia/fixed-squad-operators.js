// SPDX-License-Identifier: GPL-3.0-or-later
// Fixed-squad-only operators whose records are imported from the public game
// tables into data/arkpedia-support-operators.json. The regular-stage gate uses
// this list so a stage can carry them without exposing them in the normal roster.
export const FIXED_SQUAD_OPERATORS = Object.freeze({
  char_508_aguard: Object.freeze({ skillIds: Object.freeze(['skchr_aguard_1']), talentKeys: Object.freeze(['atk', 'prob']) }),
  char_509_acast: Object.freeze({ skillIds: Object.freeze(['skchr_acast_1']), talentKeys: Object.freeze(['magic_resist_penetrate_fixed']) }),
  char_510_amedic: Object.freeze({ skillIds: Object.freeze(['skchr_amedic_1']), talentKeys: Object.freeze(['sp']) }),
  char_511_asnipe: Object.freeze({ skillIds: Object.freeze(['skchr_asnipe_1']), talentKeys: Object.freeze(['atk_scale', 'prob']) }),
  char_614_acsupo: Object.freeze({ skillIds: Object.freeze(['skchr_acsupo_1', 'skchr_acsupo_2', 'skchr_acsupo_3']),
    talentKeys: Object.freeze(['attack_speed', 'acsupo_t_1[ally].attack_speed', 'damage_hitrate_physical', 'damage_hitrate_magical']) }),
});
