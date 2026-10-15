// SPDX-License-Identifier: GPL-3.0-or-later
// Original input selection only; combat, artwork and public admission are separate gates.
import e from '../../../data/arkpedia-native-operators/char_4203_kichi.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {flattenBlackboard} from '../simdata.js';
export const KICHI_ID='char_4203_kichi';
export const KICHI_SKILLS=Object.freeze(['skchr_kichi_1','skchr_kichi_2']);
export const selectedKichiBuild=build=>selectedCNSourceBuild(e,KICHI_ID,build);
export function selectedKichiTrait(build){
 selectedKichiBuild(build);const trait=sourceCandidate(e.tables.character.trait.candidates,build);
 if(!trait||!e.tables.ranges[trait.rangeId])throw Error('Missing original Kichisei front-row trait');
 return {...trait,bb:flattenBlackboard(trait.blackboard),rangeGrid:e.tables.ranges[trait.rangeId].grids.map(p=>[p.row,p.col])};
}
export function kichiSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Kichisei component');return c.data;
}
export function kichiNativeInputs(){
 const c=id=>kichiSourceComponent('characters',KICHI_ID,id);
 return {ordinary:c('-7079204325034877700'),s1Attack:c('2215588875750022396'),s2Attack:c('3092502933765889276'),
  s1:kichiSourceComponent('skills',KICHI_SKILLS[0],'2716675905424689064'),s2:kichiSourceComponent('skills',KICHI_SKILLS[1],'6254544397731505566'),
  templates:e.templates,mixes:e.chararts[KICHI_ID][0].data._mixSettings};
}
