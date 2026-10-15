// SPDX-License-Identifier: GPL-3.0-or-later
// Original source selection only; this module cannot enable a playable kit.
import e from '../../../data/arkpedia-native-operators/char_4031_liesel.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const LIESEL_ID = 'char_4031_liesel';
export const LIESEL_SKILLS = Object.freeze(['skchr_liesel_1', 'skchr_liesel_2']);
export const selectedLieselBuild = build => selectedCNSourceBuild(e, LIESEL_ID, build);
const parts = ['characters', 'skills', 'projectiles'].flatMap(group => Object.values(e[group]).flatMap(rows => rows.flatMap(r => r.components)));
export const lieselComponent = id => parts.find(p => p.pathId === id)?.data;

// Keep serialized source values literal. Their ordering/aliases still need a
// separately reviewed combat contract; a source receipt is not runtime approval.
export function lieselNativeInputs() {
  const c = lieselComponent;
  const shots = [
    ['projectile_chr_liesel_s2_1', '-1185581884307194052', '497364550198443836'],
    ['projectile_chr_liesel_s2_2', '998569573623222128', '-1691147920635900048'],
    ['projectile_chr_liesel_s2_3', '5954552715821066168', '1450172953942173624'],
  ].map(([key, projectile, motion]) => ({ key, projectile: c(projectile), motion: c(motion) }));
  return {
    ordinaryRadius: c('-5538323521279903581').m_Radius,
    enhancedRadius: c('8222079298152480672').m_Radius,
    ordinary: c('4075976438463379619'), s1: c('36852439117053856'), s2: c('-10516944060683030'),
    exclusion: c('4663967247546379498')._buffs[0],
    projectileActions: JSON.parse(c('4085564423561363260')._actions.SerializedState),
    shots,
  };
}
