// SPDX-License-Identifier: GPL-3.0-or-later
// Immutable selected inputs only; no combat, artwork or public admission.
import e from '../../../data/arkpedia-native-operators/char_4236_tmslot.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {flattenBlackboard} from '../simdata.js';
export const TMSLOT_ID='char_4236_tmslot';
export const TMSLOT_SKILLS=Object.freeze(['skcom_atk_up[3]','skchr_tmslot_2']);
export function selectedTimeslotBuild(build){
 const r=selectedCNSourceBuild(e,TMSLOT_ID,build),trait=sourceCandidate(e.tables.character.trait.candidates,build);
 return {...r,traitBb:flattenBlackboard(trait.blackboard)};
}
export function timeslotSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Timeslot component');return c.data;
}
export function timeslotNativeInputs(){
 const c=id=>timeslotSourceComponent('characters',TMSLOT_ID,id),s=(key,id)=>timeslotSourceComponent('skills',key,id);
 return {ordinary:c('-9077838665887695667'),s2Attack:c('3907710977921072333'),funnel:c('1280406624761822413'),
  s2Funnels:[c('-1575601179404714803'),c('1681321537420803277')],
  modeAttacks:[c('6863073908809219277'),c('8376458367413861581')],
  s1:s('skcom_atk_up','-2253778771189300242'),s1Buff:s('skcom_atk_up','-8149467065939786770'),
  s2:s('skchr_tmslot_2','-5477622918887714528'),modeBuff:s('skchr_tmslot_2','9033387255040037152'),
  overloadBuff:s('skchr_tmslot_2','644400246947434784'),talent:c('-2794230579661030195'),traitOverride:c('-939361322091791155'),
  templates:e.templates,mixes:e.chararts[TMSLOT_ID][0].data._mixSettings};
}
