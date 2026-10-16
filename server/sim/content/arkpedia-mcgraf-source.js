// SPDX-License-Identifier: GPL-3.0-or-later
// Original selected token inputs only. No summon registration or combat fallback.
import e from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {flattenBlackboard} from '../simdata.js';
import {MCGRAF_ID as ID,selectedMechanistBuild,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
export function selectedMcGrafBuild(build){
 const owner=selectedMechanistBuild(build),source=e.tables.tokens[ID];
 if(!owner.talents.some(t=>t.tokenKey===ID))throw Error('McGraf is locked before Mechanist E1');
 const phase=source.phases[build.elite],entry=source.skills[owner.index];
 const skillId=entry.skillId,levels=e.tables.tokenSkills[skillId].levels;
 const skill=levels.length===1?levels[0]:levels[build.skillRank-1];
 if(!skill||e.tokenSkillBindings[ID][skillId]?.length!==1||e.tokenSkillBindings[ID][skillId][0]!=='sktok_mcgraf'
  ||Object.keys(e.tokenSkillPrefabOverrides[ID]).length||e.tokenModeSkills[ID].length)throw Error('Unreviewed original McGraf skill binding');
 const lo=phase.attributesKeyFrames[0],hi=phase.attributesKeyFrames.at(-1),ratio=hi.level===lo.level?0:(build.level-lo.level)/(hi.level-lo.level);
 const stats=Object.fromEntries(Object.entries(lo.data).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v+(hi.data[k]-v)*ratio]));
 for(const k of['maxHp','atk','def'])stats[k]=Math.round(stats[k]);
 const talents=source.talents.map(t=>sourceCandidate(t.candidates,build)).filter(Boolean),talentBb=talents.map(t=>flattenBlackboard(t.blackboard));
 const lifetime=talentBb.find(t=>'skill@duration'in t)?.['skill@duration'];
 const transfer=mechanistSourceComponent('tokens',ID,'7654622978917549363');
 const native=mechanistSourceComponent('tokens',ID,'1311138106172917043');
 if(!Number.isFinite(lifetime)||lifetime<=0||transfer._influenceSkillBlackboard!==1||transfer._fromRawDataToSkill!==1
  ||native._occupiedRemainingCharacterCnt!==0||native._withdrawCostRecoverRatio!==0||native._buildCondition.needSpecifyDirection!==1
  ||native._buildCondition.limitByHostAttackRange!==0||native._isFixedRotation!==0)throw Error('Changed original McGraf deployment inputs');
 return{build:{...build},ownerIndex:owner.index,source,phase,stats,talents,talentBb,skillId,skill,bb:flattenBlackboard(skill.blackboard),
  // The raw table row is retained separately: talent 1 transfers skill@duration
  // through its original _fromRawDataToSkill/_influenceSkillBlackboard flags.
  skillOverlay:{duration:lifetime},rangeGrid:e.tables.ranges[phase.rangeId].grids.map(g=>[g.row,g.col]),
  sourceBinding:e.tokenSources[ID],skeletonBinding:e.officialSkeletonBindings[ID],native,
  deployment:{slotCost:native._occupiedRemainingCharacterCnt,refundRatio:native._withdrawCostRecoverRatio,chooseFacing:!!native._buildCondition.needSpecifyDirection,limitByHostAttackRange:!!native._buildCondition.limitByHostAttackRange},
  limits:'Selected tables and native input bindings only; stock, timeout, summon construction, S3 mark/charge, attacks, effects and public admission require runtime review.'};
}
