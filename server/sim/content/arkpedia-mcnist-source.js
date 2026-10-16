// SPDX-License-Identifier: GPL-3.0-or-later
// Original inputs only. Combat, summon runtime and public admission remain separate gates.
import e from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
export const MCNIST_ID='char_4230_mcnist',MCGRAF_ID='token_10069_mcnist_mcgraf';
export const MCNIST_SKILLS=Object.freeze(['skchr_mcnist_1','skchr_mcnist_2','skchr_mcnist_3']);
export const selectedMechanistBuild=build=>selectedCNSourceBuild(e,MCNIST_ID,build);
export function mechanistSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Mechanist/McGraf component');return c.data;
}
export function mechanistNativeInputs(){
 const c=id=>mechanistSourceComponent('characters',MCNIST_ID,id),s=(index,id)=>mechanistSourceComponent('skills',MCNIST_SKILLS[index],id);
 return{ordinary:c('-3510892620856028712'),combat:c('-7466117495050399272'),s1Attack:c('1535291279051133400'),
  s2Attack:c('6581031838564487640'),s2Combat:c('6752024641494127064'),s2DownAttack:c('8850455790856507864'),s2DownCombat:c('-6203440929037872680'),
  s3Attack:c('1124555361615548888'),s3Combat:c('-4641918396699962920'),
  s1:s(0,'-4988607340102715664'),s2:s(1,'-8697401210061218710'),s3:s(2,'-3835222770495581816'),
  tokenAttacks:['5771278916701865267','-2346001782203398861'].map(id=>mechanistSourceComponent('tokens',MCGRAF_ID,id)),
  tokenSkill:mechanistSourceComponent('skills','sktok_mcgraf','-1594402853045730782'),templates:e.templates,mixes:e.chararts[MCNIST_ID][0].data._mixSettings};
}
