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
