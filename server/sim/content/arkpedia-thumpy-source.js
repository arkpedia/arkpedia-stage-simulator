// SPDX-License-Identifier: GPL-3.0-or-later
// Original inputs only; combat, artwork and public admission remain separate.
import e from '../../../data/arkpedia-native-operators/char_4235_thumpy.json' with {type:'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
export const THUMPY_ID='char_4235_thumpy';
export const THUMPY_SKILLS=Object.freeze(['skchr_thumpy_1','skchr_thumpy_2','skchr_thumpy_3']);
export const selectedThumpyBuild=build=>selectedCNSourceBuild(e,THUMPY_ID,build);
export function thumpySourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Thumpy component');return c.data;
}
export function thumpyNativeInputs(){
 const c=id=>thumpySourceComponent('characters',THUMPY_ID,id),s=(i,id)=>thumpySourceComponent('skills',THUMPY_SKILLS[i],id);
 return {talent1:c('-3045388504718096767'),talent2:c('3409687003757758081'),transfer:c('-4949177627196701055'),
  glue:c('2178085198454802049'),conveyor:c('84567990561097345'),glueSelector:c('5625076296405894785'),
  glueValidator:c('7351294642090493569'),conveyorImmunity:c('3767441559305275009'),conveyorMass:c('6790175863515465345'),s1Buff:s(0,'-8288747995031525830'),s2Buff:s(1,'-3361177735884366166'),
  s3Buff:s(2,'7640544926271961971'),templates:e.templates};
}
