// SPDX-License-Identifier: GPL-3.0-or-later
// Exact hidden 17-16 card only; public module and stage admission stay closed.
import {jsonSourceDigest as digest} from '../../../shared/arkpedia/source-digest.js';
import tables from '../../../data/candidates/arkpedia-stage-predefined-module-tables.json' with {type:'json'};
import native from '../../../data/candidates/arkpedia-stage-predefined-module-native.json' with {type:'json'};
import aliases from '../../../data/candidates/arkpedia-blockee-event-alias-source.json' with {type:'json'};
import {recordFor} from '../../../shared/arkpedia/loadout.js';
const ID='char_488_buildr',KEY='uniequip_002_buildr';
export function verifyPoncirusStageModule(t=tables,n=native,a=aliases){
 const m=t.modules[KEY],cards=t.stages['17-16'].predefines.characterCards.filter(c=>c.inst.characterKey===ID);
 // Whole retained records bind all flags, recipients, derived-buff ownership,
 // enum values and ignored fields as well as the parameters used below.
 if(a.events['37']?.name!=='ON_OWNER_BLOCKEE_CHANGED'||a.events['37'].witnesses.length!==3
  ||digest(m)!=='f3732054d3d6ddb2e427b187bb8372d37d58ed88cdf9fdc3369f13e119e21f2f'
  ||digest(n.prefabs.buildr_equip_1_3_p1)!=='7e2a1cff2bbf6da302a84071ac3d59ada2334fefdfd1ac236920d8c2b155ce3d'
  ||digest(n.templates['buildr_trait[e_002]'])!=='5187b5eaffec425f85408ca425ebaba38d0db396d6dad9407b7febf459fe0c91'
  ||cards.length!==1||digest(cards[0])!=='52a35ceae24dedf8e2e0009536b9aaa6efa73a35a0da90b93f9a88f2fb7c7dae')throw Error('Unreviewed predefined Poncirus module source');
 const trait=m.phase.parts[0].overrideTraitDataBundle.candidates[0],talent=m.phase.parts[1].addOrOverrideTalentDataBundle.candidates[0];
 return{module:m,trait,talent};
}
export function poncirusStageBuild(){verifyPoncirusStageModule();return{id:ID,elite:2,level:80,potential:1,trust:100,skillId:'skchr_buildr_2',skillRank:7,module:KEY,moduleLevel:3,stage:'17-16'};}
function exactBuild(build){if(Object.entries(poncirusStageBuild()).some(([k,v])=>build?.[k]!==v))throw Error('Unreviewed predefined Poncirus build');}
export function poncirusStageRecord(build,data){
 exactBuild(build);const source=verifyPoncirusStageModule(),base=recordFor({...build,module:null},data),stats={...base.stats},talent=structuredClone(source.talent);
 for(const r of source.module.phase.attributeBlackboard)stats[r.key==='max_hp'?'maxHp':r.key]+=r.value;
 talent.bb=Object.fromEntries(talent.blackboard.map(r=>[r.key,r.value]));
 return{...base,stats,talents:[talent],arkpedia:{...base.arkpedia,...build}};
}
export function installPoncirusStageModule(b,u,def){
 exactBuild(def.raw.arkpedia);const source=verifyPoncirusStageModule(),bb=Object.fromEntries(source.trait.blackboard.map(r=>[r.key,r.value]));
 if(def.charId!==ID||def.talents[0]?.bb.interval!==30||def.talents[0]?.bb.max_hp!==.2||u.mem.poncirusStageModule)throw Error('Unreviewed predefined Poncirus runtime');
 const key='buildr_trait[e_002_blocked]',handles=[];let life=null,owned=null,stopped=false;
 const current=()=>!stopped&&!b.finished&&u.alive&&u.deployed&&!u._removing&&u.deploySeq===life;
 // Corroborated event 37 (ON_OWNER_BLOCKEE_CHANGED) / CheckBlocked uses block change
 // notifications plus a tick reconciliation. No compiled event/FSM parity is
 // claimed by this adapter. A stale one-sided relation never grants the buff.
 const blocking=()=>current()&&u.blocking.some(e=>e.alive&&e.deployed&&e.blockedBy===u);
 const clear=()=>{const old=owned;owned=null;if(old)b.removeBuff(u,old);};
 const sync=()=>{
  if(!blocking()){clear();return;}
  if(owned&&u.buffs.includes(owned))return;
  owned=b.addBuff(u,{key,source:u,mods:{atkPct:bb.atk,defPct:bb.def},admit:blocking});
 };
 const controller={sync,stop(){if(stopped)return;stopped=true;clear();for(const h of handles)b.off(h);}};
 handles.push(b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(life!==null&&life!==u.deploySeq){controller.stop();return;}life=u.deploySeq;sync();},{owner:u}),
  b.on('blocked',({blocker})=>{if(blocker===u)sync();},{owner:u}),b.on('unblocked',({blocker})=>{if(blocker===u)sync();},{owner:u}),
  b.on('tick',()=>{if(life!==null&&!current())controller.stop();else sync();},{owner:u}),
  b.on('death',({unit})=>{if(unit===u)controller.stop();else sync();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)controller.stop();},{owner:u}),
  b.on('battleEnd',()=>controller.stop(),{owner:u}));
 u.mem.poncirusStageModule=controller;return controller;
}
