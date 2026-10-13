// SPDX-License-Identifier: GPL-3.0-or-later
// Source selection only. No public operator registration or default kit.
import evidence from '../../../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { flattenBlackboard as flat, normalizeChess, normSpType } from '../simdata.js';

export const MARCIL_ID = 'char_4141_marcil';
const c = evidence.tables.character;
const skills = [1, 2, 3].map(n => `skchr_marcil_${n}`);
const grid = id => id ? evidence.tables.ranges[id].grids.map(g => [g.row, g.col]) : [];
const tags = [...new Set([c, c.mainPower, ...(c.subPower ?? [])].filter(Boolean)
  .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};
export function selectedMarcilBuild(build) {
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Marcille source build');
  const index = skills.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Marcille source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attrs = { COST: 'cost', ATK: 'atk', RESPAWN_TIME: 'respawnTime' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Marcille potential');
    stats[attrs[m.attributeType]] += m.value;
  }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  // Original owner preprocessor: talent 2 + selected skill init; selected skill cap.
  const mana = { initial: flat(talents.find(t => t.prefabKey === '2')?.blackboard ?? []).mana_init ?? 0,
    maximum: flat(source.blackboard).mana_max, period: marcilSourceComponent('5732173963253464043')._period,
    recovery: flat(talents.find(t => t.prefabKey === '1').blackboard).mana_add };
  mana.initial += flat(source.blackboard).mana_init;
  return { mana, build: { ...build }, index, source, bb: flat(source.blackboard), stats, talents,
    talentBb: talents.map(t => flat(t.blackboard)), tags: [...tags], rangeGrid: grid(phase.rangeId),
    skillRange: grid(source.rangeId) };
}

export function marcilSourceComponent(id) {
  for (const g of ['characters', 'skills', 'projectiles']) for (const rows of Object.values(evidence[g]))
    for (const row of rows) for (const comp of row.components) if (comp.pathId === id) return comp.data;
}

// Shared source gate for independent mana/combat and squad diagnostics. This
// validates a definition, without reserving a wallet or registering an owner.
export function validateMarcilDefinition(def) {
  if (def?.charId !== MARCIL_ID || !def.raw?.arkpedia || !def.skill)
    throw Error('Incomplete Marcille selected source');
  const r = selectedMarcilBuild({ ...def.raw.arkpedia, skillId: def.skill.id }), s = def.skill;
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (def.raw.arkpedia.skillId != null && def.raw.arkpedia.skillId !== s.id
    || !same(def.stats, normalizeChess({ stats: r.stats }).stats) || !same(def.tags, r.tags)
    || !same(def.rangeGrid, r.rangeGrid) || !same(def.talents.map(t => t.bb), r.talentBb)
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], r.skillRange)
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType) || s.spCost !== r.source.spData.spCost
    || s.initSp !== r.source.spData.initSp || s.maxCharges !== r.source.spData.maxChargeTime
    || s.duration !== r.source.duration) throw Error('Incomplete Marcille selected source');
  return r;
}
