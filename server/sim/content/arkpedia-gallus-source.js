// SPDX-License-Identifier: GPL-3.0-or-later
// Original passive-only inputs; no combat kit or public registration.
import e from '../../../data/arkpedia-native-operators/char_4227_gallus.json' with {type:'json'};
import {selectedCNPassiveSourceBuild} from './arkpedia-selected-cn-source.js';
export const GALLUS_ID='char_4227_gallus';
export const selectedGallusBuild=build=>selectedCNPassiveSourceBuild(e,GALLUS_ID,build);
export function gallusSourceComponent(group,key,pathId){
 const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original GALLUS² component');return c.data;
}
export function gallusNativeInputs(){
 const c=id=>gallusSourceComponent('characters',GALLUS_ID,id);
 return {root:c('7641070790203612752'),ordinary:c('-145074444227699120'),preferred:c('6850085078635388496'),
  normalMode:c('-2730423305923453360'),markedMode:c('6018605635336543824'),
  selector:c('3083082046790049360'),preferredSelector:c('-6942653288404476336'),
  talent:c('-4902288651014758832'),mark:c('1450427431489183312'),templates:e.templates};
}
