// SPDX-License-Identifier: GPL-3.0-or-later
// Exact hidden S2 card only; no public module/card or stage admission.
import{createHash}from'node:crypto';
import tables from '../../../data/candidates/arkpedia-stage-predefined-module-tables.json' with{type:'json'};
import native from '../../../data/candidates/arkpedia-stage-predefined-module-native.json' with{type:'json'};
import{recordFor}from'../../../shared/arkpedia/loadout.js';
const ID='char_473_mberry',KEY='uniequip_002_mberry',digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function verifyMulberryStageModule(t=tables,n=native){
 const m=t.modules[KEY],cards=t.stages['17-16'].predefines.characterCards.filter(c=>c.inst.characterKey===ID);
 // Full-record receipts include the native S1-only modifier. It cannot be
 // silently flattened into all skills: only the exact canonical S2 is admitted.
 if(digest(m)!=='03b3fb45ba1e7787e0746d8f822a6eec3399110954635d40c5f5f19ec96e80ab'
  ||digest(n.prefabs.mberry_equip_1_3_p1)!=='dba0ff906aca21cae52dc51caafb9e23d82266d4f6041f576a5fb08b5021eab9'
  ||digest(n.templates.mberry_e_002_t_10)!=='ba0ec6da4d140382ace50525266dd2fd2fc561615a927984a3930e582f0dc14d'
  ||cards.length!==1||digest(cards[0])!=='55dab910fe88e807f3c421db798e20564b8833d0c24f4a9899ade57adb823d2d')throw Error('Unreviewed predefined Mulberry module source');
 return{module:m,trait:m.phase.parts[0].overrideTraitDataBundle.candidates[0],hidden:m.phase.parts[1].addOrOverrideTalentDataBundle.candidates[0],talent:m.phase.parts[2].addOrOverrideTalentDataBundle.candidates[0]};
}
export function mulberryStageBuild(){verifyMulberryStageModule();return{id:ID,elite:2,level:80,potential:1,trust:100,skillId:'skchr_mberry_2',skillRank:7,module:KEY,moduleLevel:3,stage:'17-16'};}
function exactBuild(build){if(Object.entries(mulberryStageBuild()).some(([k,v])=>build?.[k]!==v))throw Error('Unreviewed predefined Mulberry build');}
export function mulberryStageRecord(build,data){
 exactBuild(build);const s=verifyMulberryStageModule(),base=recordFor({...build,module:null},data),stats={...base.stats},bb=r=>Object.fromEntries(r.blackboard.map(r=>[r.key,r.value]));
 for(const r of s.module.phase.attributeBlackboard)stats[r.key==='max_hp'?'maxHp':r.key]+=r.value;
 const trait={...base.trait,...structuredClone(s.trait),bb:bb(s.trait)};
 return{...base,stats,trait,talents:[s.talent,s.hidden].map(r=>({...structuredClone(r),bb:bb(r)})),arkpedia:{...base.arkpedia,...build}};
}
export function installMulberryStageModule(b,u,def){
 exactBuild(def.raw.arkpedia);verifyMulberryStageModule();
 if(def.charId!==ID||def.skill.id!=='skchr_mberry_2'||def.traitBb.ep_heal_ratio!==.6||def.talents[0]?.bb.atk!==.15||def.talents[1]?.bb.ep_heal_ratio!==.6||u.mem.mulberryStageModule)
  throw Error('Unreviewed predefined Mulberry runtime');
 u.mem.mulberryStageModule={skillIndex:1,elementHealRatio:.6};
}
