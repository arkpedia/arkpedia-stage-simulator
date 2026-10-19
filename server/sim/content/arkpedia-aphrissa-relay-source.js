// SPDX-License-Identifier: GPL-3.0-or-later
// Literal selected relay data; no invented skill for its empty promotion slots.
import evidence from '../../../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {flattenBlackboard} from '../simdata.js';
import {APHRISSA_RELAY_ID as ID, selectedAphrissaBuild, aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';

export function selectedAphrissaRelay(build) {
  const owner = selectedAphrissaBuild(build), source = evidence.tables.tokens[ID];
  if (!owner.talents.some(t => t.tokenKey === ID)) throw Error('Missing original selected Aphrissa relay talent');
  const phase = source.phases[build.elite], slots = source.skills;
  if (slots.length !== 3 || slots.some(slot => slot.skillId !== null
    || slot.overridePrefabKey !== null || slot.overrideTokenKey !== null)
    || Object.keys(evidence.tables.tokenSkills).length || Object.keys(evidence.tokenSkillBindings[ID]).length
    || Object.keys(evidence.tokenSkillPrefabOverrides[ID]).length || evidence.tokenModeSkills[ID].length)
    throw Error('Changed original Aphrissa null token skill slots');
  const lo = phase.attributesKeyFrames[0], hi = phase.attributesKeyFrames.at(-1);
  const ratio = hi.level === lo.level ? 0 : (build.level - lo.level) / (hi.level - lo.level);
  const stats = Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([key, value]) => [key, value + (hi.data[key] - value) * ratio]));
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key]);
  const talents = source.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const talentBb = talents.map(t => flattenBlackboard(t.blackboard));
  const duration = talentBb.find(t => 'duration' in t)?.duration;
  const native = aphrissaNativeInputs().relayRoot;
  if (!Number.isFinite(duration) || duration <= 0 || native._occupiedRemainingCharacterCnt !== 0
    || native._buildCondition.needSpecifyDirection !== 1 || native._buildCondition.limitByHostAttackRange !== 0)
    throw Error('Changed original Aphrissa relay deployment inputs');
  return {build: {...build}, owner, source, phase, stats, talents, talentBb, duration,
    skillId: null, skill: null,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    sourceBinding: evidence.tokenSources[ID], skeletonBinding: evidence.officialSkeletonBindings[ID], native,
    deployment: {slotCost: native._occupiedRemainingCharacterCnt, refundRatio: native._withdrawCostRecoverRatio,
      chooseFacing: !!native._buildCondition.needSpecifyDirection,
      limitByHostAttackRange: !!native._buildCondition.limitByHostAttackRange},
  };
}
