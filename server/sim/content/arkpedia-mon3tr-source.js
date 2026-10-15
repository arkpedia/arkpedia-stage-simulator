// SPDX-License-Identifier: GPL-3.0-or-later
// Selected native source records; public approval is recorded separately.
import evidence from '../../../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { flattenBlackboard } from '../simdata.js';

export const MON3TR_ID = 'char_4179_monstr';
export const MON3TR_SKILLS = Object.freeze([1, 2, 3].map(n => `skchr_monstr_${n}`));
export const MON3TR_TOKENS = Object.freeze(['token_10050_monstr_prosts']);
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
export const mon3trSourceComponent = id => components.find(row => row.pathId === id)?.data;

export function selectedMon3trBuild(build) {
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Mon3tr source build');
  const index = MON3TR_SKILLS.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Mon3tr source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attributes = { COST: 'cost', ATK: 'atk' };
  for (const potential of c.potentialRanks.slice(0, build.potential - 1))
    for (const modifier of potential.buff?.attributes.attributeModifiers ?? []) {
      if (!attributes[modifier.attributeType] || modifier.formulaItem !== 'ADDITION')
        throw Error('Unreviewed Mon3tr potential');
      stats[attributes[modifier.attributeType]] += modifier.value;
    }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const tokenRecords = Object.fromEntries(MON3TR_TOKENS.map(id => {
    const token = evidence.tables.tokens[id];
    const tokenSkillId = token.skills[index].skillId;
    const tokenSkill = evidence.tables.tokenSkills[tokenSkillId].levels[build.skillRank - 1];
    return [id, { source: token, phase: token.phases[build.elite], skill: tokenSkill,
      skillId: tokenSkillId, bb: flattenBlackboard(tokenSkill.blackboard),
      models: evidence.tokenModels[id], binding: evidence.officialTokenSkeletonBindings[id] }];
  }));
  return { build: { ...build }, index, source, bb: flattenBlackboard(source.blackboard), stats,
    talents, tags: [...tags], talentBb: talents.map(t => flattenBlackboard(t.blackboard)),
    rangeGrid: grid(phase.rangeId), skillRangeGrid: grid(source.rangeId), tokenRecords };
}
