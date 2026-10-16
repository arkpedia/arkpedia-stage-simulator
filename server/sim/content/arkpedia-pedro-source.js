// SPDX-License-Identifier: GPL-3.0-or-later
// Original inputs only; combat, artwork and public admission remain separate gates.
import e from '../../../data/arkpedia-native-operators/char_4234_pedro.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
export const PEDRO_ID='char_4234_pedro';
export const PEDRO_SKILLS=Object.freeze(['skchr_pedro_1','skchr_pedro_2']);
export const selectedPedroBuild=build=>selectedCNSourceBuild(e,PEDRO_ID,build);
export function pedroSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Pedro component');return c.data;
}
export function pedroNativeInputs(){
 const c=id=>pedroSourceComponent('characters',PEDRO_ID,id),s=(index,id)=>pedroSourceComponent('skills',PEDRO_SKILLS[index],id);
 return {ordinary:c('177400086474101841'),ordinarySelector:c('-4733707387711548335'),ordinaryTrigger:c('1039032244418483281'),
  s1:s(0,'-3957099847754155535'),s1Attack:s(0,'-746179348678346255'),s1Selector:s(0,'-8066781148306507279'),
  s2:s(1,'3108507744809906717'),s2Heal:s(1,'-4521262665825979875'),s2Selector:s(1,'3622386680448872989'),
  talent:c('-8348015278364388271'),talentAura:c('-5325823641211268015'),talentValidator:c('-6700608952954416047'),
  templates:e.templates,mixes:e.chararts[PEDRO_ID][0].data._mixSettings};
}
