// SPDX-License-Identifier: GPL-3.0-or-later
// Original CN input selection only; this does not install a public combat kit.
import e from '../../../data/arkpedia-native-operators/char_4166_varkis.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const VARKIS_ID = 'char_4166_varkis';
export const VARKIS_SKILLS = Object.freeze(['skchr_varkis_1', 'skchr_varkis_2']);
export const selectedVarkisBuild = build => selectedCNSourceBuild(e, VARKIS_ID, build);
export function varkisNativeInputs() {
  const part = (group, key, id) => {
    const p = e[group][key].flatMap(r => r.components).find(p => p.pathId === id);
    if (!p) throw Error('Missing original Varkáris component: ' + id);
    return p.data;
  };
  return {
    ordinary: part('characters', VARKIS_ID, '8064781630525712362'),
    ordinarySelector: part('characters', VARKIS_ID, '-795265374427830294'),
    modeAttack: part('characters', VARKIS_ID, '1582788794243327978'),
    modeSelector: part('characters', VARKIS_ID, '-85910754964166678'),
    attackHeal: part('characters', VARKIS_ID, '-6634173019674400790'),
    talent: part('characters', VARKIS_ID, '-6335369794609043478'),
    talentValidator: part('characters', VARKIS_ID, '2406885294765746154'),
    s1: part('skills', VARKIS_SKILLS[0], '5459067292042517433'),
    burst: part('skills', VARKIS_SKILLS[0], '-5661766566541075527'),
    burstSelector: part('skills', VARKIS_SKILLS[0], '2294733288804178873'),
    s2: part('skills', VARKIS_SKILLS[1], '6358811051311865391'),
    s2Passive: part('skills', VARKIS_SKILLS[1], '-8974553262420746705'),
    switchMode: part('skills', VARKIS_SKILLS[1], '6856692714232454703'),
    templates: e.templates,
    mixes: e.chararts[VARKIS_ID][0].data._mixSettings,
  };
}
