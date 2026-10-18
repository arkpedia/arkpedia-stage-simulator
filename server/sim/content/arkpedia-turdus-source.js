// SPDX-License-Identifier: GPL-3.0-or-later
// Exact source selection only; no public registration or fallback skill kit.
import e from '../../../data/arkpedia-native-operators/char_4224_turdus.json' with {type:'json'};
import {normalizeChess,normSpType} from '../simdata.js';
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
export const TURDUS_ID='char_4224_turdus',TURDUS_SKILLS=Object.freeze(['skchr_turdus_1','skchr_turdus_2']);
export const selectedTurdusBuild=build=>selectedCNSourceBuild(e,TURDUS_ID,build);
export function turdusSourceComponent(group,key,pathId){const c=e[group]?.[key]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);if(!c)throw Error('Missing original Ukusik component');return c.data;}
export function turdusNativeInputs(){const c=id=>turdusSourceComponent('characters',TURDUS_ID,id),s=(i,id)=>turdusSourceComponent('skills',TURDUS_SKILLS[i],id),p=(key,id)=>turdusSourceComponent('projectiles',key,id);
 return{root:c('6376797894977530792'),ordinary:c('2502661310594362280'),s1Attack:c('-391704151884223576'),ordinarySelector:c('2423698341853997992'),s1Selector:c('8056774903098125224'),talentBuffs:[c('3277177644709260200'),c('3018107800042154920')],
  s1:s(0,'-5273338410427359661'),s1Buffs:s(0,'-6852599244893921709'),s2:s(1,'3279361430658986098'),s2Heal:s(1,'6701300086302158962'),s2Selector:s(1,'5396064924380344434'),s2Self:s(1,'-8079309302161035150'),
  chain:p('projectile_chr_turdus','1835661483141513508'),chainSelector:p('projectile_chr_turdus','7509065347446423844'),s2Chain:p('projectile_chr_turdus_s2','1084759151177976314'),s2ChainSelector:p('projectile_chr_turdus_s2','-2770162121418061318'),
  templates:e.templates,projectiles:e.projectiles,mixes:e.chararts[TURDUS_ID][0].data._mixSettings,animator:e.chararts[TURDUS_ID][0].data};
}

export function selectedTurdusInputs(u){
 const s=u.def.skill;if(!s)throw Error('Incomplete original selected Ukusik inputs');
 const r=selectedTurdusBuild({...u.def.raw.arkpedia,skillId:s.id}),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||u.def.charId!==TURDUS_ID||s.id!==r.build.skillId||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)||!same(s.bb,r.bb)
  ||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration||s.maxCharges!==r.source.spData.maxChargeTime
  ||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete original selected Ukusik inputs');
 return r;
}
