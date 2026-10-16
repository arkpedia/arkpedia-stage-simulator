// SPDX-License-Identifier: GPL-3.0-or-later
// Original passive-only inputs; no combat or public admission.
import e from '../../../data/arkpedia-native-operators/char_4220_kormr.json' with {type:'json'};
import {selectedCNPassiveSourceBuild} from './arkpedia-selected-cn-source.js';
export const KOROMARU_ID='char_4220_kormr';
export const selectedKoromaruBuild=build=>selectedCNPassiveSourceBuild(e,KOROMARU_ID,build);
export function koromaruSourceComponent(group,key,pathId){const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);if(!c)throw Error('Missing original Koromaru component');return c.data;}
export function koromaruNativeInputs(){const c=id=>koromaruSourceComponent('characters',KOROMARU_ID,id);return{root:c('-8928710853070831864'),ordinary:c('-296667948295864568'),talentAttack:c('4410603132675407624'),talent:c('209431751956283144'),start:c('-8040428613128700152'),selector:c('4693778200645910280'),otherSelector:c('2921724756990148360'),templates:e.templates};}
