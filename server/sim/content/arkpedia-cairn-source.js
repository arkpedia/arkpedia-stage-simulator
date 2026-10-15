// SPDX-License-Identifier: GPL-3.0-or-later
// Source selection only; combat, artwork and public admission are separate gates.
import e from '../../../data/arkpedia-native-operators/char_4214_cairn.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
export const CAIRN_ID='char_4214_cairn';
export const CAIRN_SKILLS=Object.freeze(['skchr_cairn_1','skchr_cairn_2']);
export const selectedCairnBuild=build=>selectedCNSourceBuild(e,CAIRN_ID,build);
export function cairnSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Cairn component');return c.data;
}
export function cairnNativeInputs(){
 const c=id=>cairnSourceComponent('characters',CAIRN_ID,id),s=(index,id)=>cairnSourceComponent('skills',CAIRN_SKILLS[index],id);
 return {ordinary:c('2713160359361132565'),s1Attack:c('-2277643991264577515'),
  ordinarySelector:c('-487710063576336363'),s1Selector:c('-5082443486977902571'),
  s1:s(0,'-933083532728440438'),s1Buff:s(0,'-90880628881200758'),
  s2:s(1,'5351570898262114183'),s2Attack:s(1,'4953579350423322503'),s2Selector:s(1,'6209498103699947399'),
  s2Shield:s(1,'7972576054795452295'),talent:c('-8656540581640128491'),
  templates:e.templates,mixes:e.chararts[CAIRN_ID][0].data._mixSettings};
}
