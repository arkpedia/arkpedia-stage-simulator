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
