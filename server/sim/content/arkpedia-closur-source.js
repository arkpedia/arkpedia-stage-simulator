// SPDX-License-Identifier: GPL-3.0-or-later
// Source selection only. No combat installer or public registration is implied.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
export const CLOSUR_ID = 'char_4228_closur';
export const CLOSUR_TOKEN_ID = 'token_10066_closur_ourbase';
export const CLOSUR_SKILLS = Object.freeze(['skchr_closur_1', 'skchr_closur_2', 'skchr_closur_3']);
export const selectedClosurBuild = build => selectedCNSourceBuild(e, CLOSUR_ID, build);
export function selectedClosurToken(build) {
  const owner = selectedClosurBuild(build), c = e.tables.tokens[CLOSUR_TOKEN_ID], phase = c.phases[build.elite];
  const low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = high.level === low.level ? 0 : (build.level - low.level) / (high.level - low.level);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, v]) => typeof v === 'number')
    .map(([key, value]) => [key, value + (high.data[key] - value) * ratio]));
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key]);
  const skillId = c.skills[owner.index].skillId, levels = e.tables.tokenSkills[skillId].levels;
  if (levels.length !== 1 || levels[0].skillType !== 'PASSIVE' || levels[0].spData.spCost !== 0)
    throw Error('Unreviewed Closure passive token skill');
  return { id: CLOSUR_TOKEN_ID, name: c.name, position: c.position, profession: 'TOKEN', stats,
    rangeGrid: e.tables.ranges[levels[0].rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skillId, source: levels[0], owner };
}
