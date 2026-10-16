// SPDX-License-Identifier: GPL-3.0-or-later
// Shared table selection, never a fallback combat kit or public registration.
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { flattenBlackboard } from '../simdata.js';
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), ratio = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => [key, value + (hi.data[key] - value) * ratio]));
};
export function selectedCNSourceBuild(e, id, build) {
  return selectedSourceBuild(e, id, build, false);
}
// Operators with no original active skills still have source stats and talents.
// This does not invent a skill row or register a passive gameplay kit.
export function selectedCNPassiveSourceBuild(e, id, build) {
  return selectedSourceBuild(e, id, build, true);
}
function selectedSourceBuild(e, id, build, passiveOnly) {
  const c = e.tables.character;
  if (e.schemaVersion !== 2 || e.operatorId !== id || !e.heldOperators.includes(id)
    || !build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module != null && build.module !== 'none') throw Error('Invalid selected CN source build');
  const index = c.skills.findIndex(s => s.skillId === build.skillId), unlock = c.skills[index]?.unlockCond;
  if (passiveOnly) {
    if (c.skills.length || Object.keys(e.tables.skills).length || Object.keys(e.skills).length
      || build.skillId != null || build.skillRank !== 1) throw Error('Expected an original skillless CN source build');
  } else if (index < 0 || !unlock || build.elite < Number(unlock.phase.replace('PHASE_', ''))
    || build.elite === Number(unlock.phase.replace('PHASE_', '')) && build.level < unlock.level)
    throw Error('Locked selected CN source skill');
  const phase = c.phases[build.elite], source = passiveOnly ? null : e.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attributes = { COST: 'cost', ATK: 'atk', DEF: 'def', MAX_HP: 'maxHp', ATTACK_SPEED: 'attackSpeed',
    RESPAWN_TIME: 'respawnTime', MAGIC_RESISTANCE: 'magicResistance' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1))
    for (const m of p.buff?.attributes.attributeModifiers ?? []) {
      if (!attributes[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed CN source potential');
      stats[attributes[m.attributeType]] += m.value;
    }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const tags = [...new Set([c, c.mainPower, ...(c.subPower ?? [])].filter(Boolean)
    .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
  const grid = key => key ? e.tables.ranges[key].grids.map(g => [g.row, g.col]) : [];
  return { build: { ...build }, index, stats, talents, tags, source, bb: flattenBlackboard(source?.blackboard),
    talentBb: talents.map(t => flattenBlackboard(t.blackboard)), rangeGrid: grid(phase.rangeId), skillRangeGrid: grid(source?.rangeId) };
}
