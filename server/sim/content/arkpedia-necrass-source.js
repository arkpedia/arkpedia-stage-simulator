// SPDX-License-Identifier: GPL-3.0-or-later
// Selected native source records only; no public registration or combat adapter.
import evidence from '../../../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { flattenBlackboard } from '../simdata.js';

export const NECRASS_ID = 'char_450_necras';
export const NECRASS_SKILLS = Object.freeze([1, 2, 3].map(n => `skchr_necras_${n}`));
export const NECRASS_TOKENS = Object.freeze(['token_10043_necras_skeltn']);
const c = evidence.tables.character;
const tags = [...new Set([c, c.mainPower, ...(c.subPower ?? [])].filter(Boolean)
  .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k]))
  .filter(v => typeof v === 'string' && v))];
const grid = id => id ? evidence.tables.ranges[id].grids.map(v => [v.row, v.col]) : [];
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1);
  const scale = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => [key, value + (hi.data[key] - value) * scale]));
};
const components = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(group =>
  Object.values(evidence[group]).flatMap(rows => rows.flatMap(row => row.components)));
export const necrassSourceComponent = id => components.find(row => row.pathId === id)?.data;

export function selectedNecrassBuild(build) {
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module != null && build.module !== 'none') throw Error('Invalid Necrass source build');
  const index = NECRASS_SKILLS.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Necrass source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attributes = { COST: 'cost', ATK: 'atk', RESPAWN_TIME: 'respawnTime' };
  for (const potential of c.potentialRanks.slice(0, build.potential - 1))
    for (const modifier of potential.buff?.attributes.attributeModifiers ?? []) {
      if (!attributes[modifier.attributeType] || modifier.formulaItem !== 'ADDITION')
        throw Error('Unreviewed Necrass potential');
      stats[attributes[modifier.attributeType]] += modifier.value;
    }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const tokenRecords = Object.fromEntries(NECRASS_TOKENS.map(id => {
    const token = evidence.tables.tokens[id];
    const tokenSkillId = token.skills[index].skillId;
    const tokenSkill = evidence.tables.tokenSkills[tokenSkillId].levels[0];
    if (evidence.tables.tokenSkills[tokenSkillId].levels.length !== 1)
      throw Error('Unreviewed Necrass servant rank mapping');
    return [id, { source: token, phase: token.phases[build.elite], skill: tokenSkill,
      skillId: tokenSkillId, sourceRank: 1, bb: flattenBlackboard(tokenSkill.blackboard),
      models: evidence.tokenModels[id], binding: evidence.officialTokenSkeletonBindings[id] }];
  }));
  return { build: { ...build }, index, source, bb: flattenBlackboard(source.blackboard), stats,
    talents, tags: [...tags], talentBb: talents.map(t => flattenBlackboard(t.blackboard)),
    rangeGrid: grid(phase.rangeId), skillRangeGrid: grid(source.rangeId), tokenRecords };
}
