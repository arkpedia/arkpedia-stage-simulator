// SPDX-License-Identifier: GPL-3.0-or-later
// Original input selection only; no ammunition/attack controller or public admission.
import e from '../../../data/arkpedia-native-operators/char_4211_snhunt.json' with { type:'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { flattenBlackboard } from '../simdata.js';
export const SNHUNT_ID='char_4211_snhunt';
export const SNHUNT_SKILLS=Object.freeze(['skchr_snhunt_1','skchr_snhunt_2']);
export const selectedSnhuntBuild=build=>selectedCNSourceBuild(e,SNHUNT_ID,build);
export function selectedSnhuntTrait(build) {
 selectedSnhuntBuild(build);
 const trait=sourceCandidate(e.tables.character.trait.candidates,build);
 if(!trait)throw Error('Missing selected Snow Hunter trait');
 return {...trait,bb:flattenBlackboard(trait.blackboard)};
}
export function snhuntSourceComponent(group,key,pathId) {
 const c=e[group]?.[key]?.flatMap(row=>row.components).find(c=>c.pathId===pathId);
 if(!c)throw Error('Missing original Snow Hunter component: '+group+'/'+key+'/'+pathId);
 return c.data;
}
export function snhuntNativeInputs() {
 const c=id=>snhuntSourceComponent('characters',SNHUNT_ID,id);
 const s=(i,id)=>snhuntSourceComponent('skills',SNHUNT_SKILLS[i],id);
 const p=(key,id)=>snhuntSourceComponent('projectiles',key,id);
 return {ordinaryA:c('-556193901581213579'),ordinaryB:c('-7220216058453925771'),reload:c('-3971636660395745163'),
  s1:s(0,'-8847112588520957498'),s1Shot:s(0,'-6997571868243502650'),s2:s(1,'-6195889862599089038'),s2Shot:s(1,'9135489955668255858'),
  ordinaryProjectile:p('projectile_chr_snhunt','519866514611782453'),ordinaryMotion:p('projectile_chr_snhunt','634302329333367605'),
  s1Projectile:p('projectile_chr_snhunt_01','-5582590800503306230'),s1Motion:p('projectile_chr_snhunt_01','4998467103595431946'),
  s2Projectile:p('projectile_chr_snhunt_02','-4429634864298284301'),s2Motion:p('projectile_chr_snhunt_02','7636318235333733107'),
  beast:p('projectile_chr_snhunt_animal','-8632757690000801293'),
  templates:e.templates,mixes:e.chararts[SNHUNT_ID][0].data._mixSettings};
}
