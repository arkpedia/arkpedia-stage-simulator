// SPDX-License-Identifier: GPL-3.0-or-later
// Selected CN records; extraction does not imply public kit approval.
import e from '../../../data/arkpedia-akkord-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { flattenBlackboard } from '../simdata.js';
export const AKKORD_ID = 'char_4051_akkord';
export const AKKORD_SKILLS = Object.freeze(['skchr_akkord_1', 'skchr_akkord_2']);
const c = e.tables.character;
const parts = [...Object.values(e.characters), ...Object.values(e.skills)].flatMap(rows => rows.flatMap(r => r.components));
export const akkordComponent = id => parts.find(p => p.pathId === id)?.data;
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), ratio = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, x]) => typeof x === 'number')
    .map(([key, value]) => [key, value + (hi.data[key] - value) * ratio]));
};
export function selectedAkkordBuild(build) {
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Akkord source build');
  const index = AKKORD_SKILLS.indexOf(build.skillId);
  if (index < 0 || index === 1 && build.elite === 0) throw Error('Locked Akkord source skill');
  const phase = c.phases[build.elite], source = e.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attributes = { COST: 'cost', ATK: 'atk', RESPAWN_TIME: 'respawnTime' };
  for (const potential of c.potentialRanks.slice(0, build.potential - 1))
    for (const mod of potential.buff?.attributes.attributeModifiers ?? []) {
      if (!attributes[mod.attributeType] || mod.formulaItem !== 'ADDITION') throw Error('Unreviewed Akkord potential');
      stats[attributes[mod.attributeType]] += mod.value;
    }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const tags = [...new Set([c, c.mainPower, ...(c.subPower ?? [])].filter(Boolean)
    .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
  return { build: { ...build }, index, stats, talents, tags, source, bb: flattenBlackboard(source.blackboard),
    talentBb: talents.map(t => flattenBlackboard(t.blackboard)),
    rangeGrid: e.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]), skillRangeGrid: [] };
}
