// SPDX-License-Identifier: GPL-3.0-or-later
// Exact hidden 17-16 build only. No public module/card/stage admission.
import{createHash}from'node:crypto';
import tables from '../../../data/candidates/arkpedia-stage-predefined-module-tables.json' with{type:'json'};
import native from '../../../data/candidates/arkpedia-stage-predefined-module-native.json' with{type:'json'};
import{recordFor}from'../../../shared/arkpedia/loadout.js';
const ID='char_4023_rfalcn',KEY='uniequip_002_rfalcn',digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function verifyKestrelStageModule(t=tables,n=native){
 const m=t.modules[KEY],cards=t.stages['17-16'].predefines.characterCards.filter(c=>c.inst.characterKey===ID);
 if(digest(m)!=='783df0999dbb148d0c71d4e4cb330958013958359a4bc374caec5290357c0f02'
  ||digest(n.prefabs.rfalcn_equip_1_3_p1)!=='50d632ad396f6115f1689497a88ae5eafec722c8003c252ff9d19285da4ac88b'
  ||digest(n.prefabs.rfalcn_equip_1_3_p2)!=='adfb5ce75aa72aba0eff7c3f4a6418a392646d89487060c2f32964121f14f5c1'
  ||cards.length!==1||digest(cards[0])!=='f983bae3926032b799004d93e8a6996de70f35bd34f8030b12ca4ad4e001892b')throw Error('Unreviewed predefined Kestrel module source');
 return{module:m,cost:m.phase.parts[1].addOrOverrideTalentDataBundle.candidates[0],sandbox:m.phase.parts[2].addOrOverrideTalentDataBundle.candidates[0]};
}
export function kestrelStageBuild(){verifyKestrelStageModule();return{id:ID,elite:2,level:80,potential:1,trust:100,skillId:'skchr_rfalcn_2',skillRank:7,module:KEY,moduleLevel:3,stage:'17-16'};}
function exactBuild(build){if(Object.entries(kestrelStageBuild()).some(([k,v])=>build?.[k]!==v))throw Error('Unreviewed predefined Kestrel build');}
export function kestrelStageRecord(build,data){
 exactBuild(build);const s=verifyKestrelStageModule(),base=recordFor({...build,module:null},data),stats={...base.stats};
 for(const r of s.module.phase.attributeBlackboard)stats[r.key==='max_hp'?'maxHp':r.key]+=r.value;
 const talent=r=>({...structuredClone(r),bb:Object.fromEntries(r.blackboard.map(r=>[r.key,r.value]))});
 return{...base,stats,talents:[base.talents[0],talent(s.sandbox),talent(s.cost)],arkpedia:{...base.arkpedia,...build}};
}
function verifyRuntime(b,def){
 exactBuild(def.raw.arkpedia);
 // The native p2 checker only admits sandbox_1. This exact normal-stage
 // adapter must not accidentally implement or claim the sandbox inventory
 // system, nor grant its SP effect in 17-16.
 if(def.charId!==ID||b.mapTags.includes('sandbox_1')||def.talents[1]?.bb.sp_recovery_per_sec!==.3||def.talents[2]?.bb.runtime_cost!==-4)
  throw Error('Unreviewed predefined Kestrel runtime or mode');
}
export function kestrelStageCostDelta(b,id){
 const entry=b.bench?.[id];if(id!==ID||!entry?.build.module||entry.build.module==='none')return 0;
 exactBuild(entry.build);verifyRuntime(b,b.data.getChess(id));
 if(!Number.isSafeInteger(entry.deployments)||entry.deployments<0)throw Error('Invalid Kestrel card deployment count');
 // Native runtime_cost is a card addition, not a permanent base-cost stat.
 // Existing ordinary-stage deployment accounting owns consumption/payment.
 return entry.deployments===0?verifyKestrelStageModule().cost.blackboard[0].value:0;
}
export function installKestrelStageModule(b,u,def){
 verifyRuntime(b,def);if(u.mem.kestrelStageModule)throw Error('Duplicate Kestrel module');
 u.mem.kestrelStageModule={sandboxExcluded:true};
}
