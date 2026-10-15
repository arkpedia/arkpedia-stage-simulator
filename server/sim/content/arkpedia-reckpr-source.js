// SPDX-License-Identifier: GPL-3.0-or-later
// Frozen source selection only; public admission requires its own runtime review.
import e from '../../../data/arkpedia-native-operators/char_4196_reckpr.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const RECKPR_ID = 'char_4196_reckpr';
export const RECKPR_SKILLS = Object.freeze(['skchr_reckpr_1', 'skchr_reckpr_2']);
export const selectedReckprBuild = build => selectedCNSourceBuild(e, RECKPR_ID, build);
export function reckprNativeInputs() {
  const part = (group, key, id) => e[group][key].flatMap(r => r.components).find(p => p.pathId === id).data;
  return { ordinary: part('characters', RECKPR_ID, '5154401760541922189'),
    s1: part('skills', RECKPR_SKILLS[0], '5853928193618227411'),
    s1Root: part('skills', RECKPR_SKILLS[0], '1613409408436416723'),
    s2: part('characters', RECKPR_ID, '-5286434015572077683'),
    s2Root: part('skills', RECKPR_SKILLS[1], '-5087997577516199293'),
    talent: part('characters', RECKPR_ID, '5562145717869269901'),
    shots: Object.entries(e.projectiles).map(([key, rows]) => {
      const parts = rows.flatMap(r => r.components).map(c => c.data);
      return { key, projectile: parts.find(v => '_stopWhenSourceInvalid' in v), motion: parts.find(v => '_speed' in v) };
    }),
    talentActions: e.templates['reckpr_t_1[listener]'].eventToActions.ON_SKILL_START,
    reactiveActions: e.templates['reckpr_02[listener]'].eventToActions.ON_TAKE_DAMAGE };
}
