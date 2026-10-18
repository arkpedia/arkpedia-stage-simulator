// SPDX-License-Identifier: GPL-3.0-or-later
// Independent original companion inputs, never an owner-stat combat fallback.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {flattenBlackboard} from '../simdata.js';
import {PALAMUTE_ID as ID,selectedReconBuild,reconNativeInputs,reconSourceComponent} from './arkpedia-recon-source.js';
export function selectedPalamuteBuild(build){
 const owner=selectedReconBuild(build),source=e.tables.tokens[ID],phase=source.phases[build.elite];
 if(!owner.talents.some(t=>t.tokenKey===ID)||source.skills.length||Object.keys(e.tables.tokenSkills).length||Object.keys(e.tokenSkillBindings[ID]).length)throw Error('Unreviewed original Palamute input');
 const[lo,hi]=[phase.attributesKeyFrames[0],phase.attributesKeyFrames.at(-1)],ratio=hi.level===lo.level?0:(build.level-lo.level)/(hi.level-lo.level);
 const stats=Object.fromEntries(Object.entries(lo.data).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v+(hi.data[k]-v)*ratio]));for(const k of['maxHp','atk','def'])stats[k]=Math.round(stats[k]);
 const talents=source.talents.map(t=>sourceCandidate(t.candidates,build)).filter(Boolean),talentBb=talents.map(t=>flattenBlackboard(t.blackboard)),native=reconNativeInputs().tokenRoot;
 const interval=talentBb[0].interval,duration=talentBb[1].duration,trigger=reconSourceComponent('tokens',ID,'1944044737233383932')._buffs[0];
 if(interval!==60||duration!==60||trigger.triggerLifeType!==1||trigger.triggerCnt!==1||trigger.waitFirstTriggerInterval!==1
  ||native._occupiedRemainingCharacterCnt!==0||native._withdrawCostRecoverRatio!==0||native._buildCondition.needSpecifyDirection!==0||native._buildCondition.limitByHostAttackRange!==1)throw Error('Changed original Palamute placement/recovery input');
 return{build:{...build},source,stats,talents,talentBb,rangeGrid:e.tables.ranges[phase.rangeId].grids.map(g=>[g.row,g.col]),native,interval,duration,skillId:null,skillRank:null,
  deployment:{slotCost:0,chooseFacing:false,refundRatio:0,limitByHostAttackRange:true},
  limits:'Original tables and native placement/recovery inputs only. Stock, native mode/FSM life, attacks/birth, artwork and public summon admission require their separate controllers.'};
}
