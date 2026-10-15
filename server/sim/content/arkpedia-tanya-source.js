// SPDX-License-Identifier: GPL-3.0-or-later
// Original inputs only; combat, artwork and public admission are separate gates.
import e from '../../../data/arkpedia-native-operators/char_4225_tanya.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
export const TANYA_ID='char_4225_tanya';
export const TANYA_SKILLS=Object.freeze(['skchr_tanya_1','skchr_tanya_2']);
export const selectedTanyaBuild=build=>selectedCNSourceBuild(e,TANYA_ID,build);
export function tanyaSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Crackborne component');return c.data;
}
export function tanyaNativeInputs(){
 const c=id=>tanyaSourceComponent('characters',TANYA_ID,id),s=(index,id)=>tanyaSourceComponent('skills',TANYA_SKILLS[index],id);
 return {ordinaryOne:c('6791374229816730892'),ordinaryTwo:c('-1801412996564982516'),choice:c('-3261013816749136628'),
  s1Attack:c('7430027078427600140'),ordinarySelector:c('3359383370378372364'),s1Selector:c('5400647688906073356'),
  s1:s(0,'-8578399732396500926'),s1Buff:s(0,'3408021884534216770'),
  s2:s(1,'3186674694067493113'),s2Attack:s(1,'-312214920522589959'),s2Passive:s(1,'-4412853080655095559'),
  talent:c('1448460573837419788'),templates:e.templates,mixes:e.chararts[TANYA_ID][0].data._mixSettings};
}
