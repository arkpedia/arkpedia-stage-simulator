// SPDX-License-Identifier: GPL-3.0-or-later
// Exact internal 17-16 build only; no public module/card/stage admission.
import tables from '../../../data/candidates/arkpedia-stage-predefined-module-tables.json' with {type:'json'};
import native from '../../../data/candidates/arkpedia-stage-predefined-module-native.json' with {type:'json'};
import {recordFor} from '../../../shared/arkpedia/loadout.js';
import {absoluteRangeKeys} from '../targeting.js';
import {bodyInKeys} from '../body.js';
const ID='char_128_plosis',KEY='uniequip_002_plosis',same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const range=[[1,-1],[1,0],[1,1],[1,2],[0,-1],[0,0],[0,1],[0,2],[0,3],[-1,-1],[-1,0],[-1,1],[-1,2]];
export function verifyPtilopsisStageModule(t=tables,n=native){
 const m=t.modules[KEY],p=m.phase.parts,fail=()=>{throw Error('Unreviewed predefined Ptilopsis module source');};
 const card=t.stages['17-16'].predefines.characterCards.filter(c=>c.inst.characterKey===ID);
 if(m.owner!==ID||m.stage!=='17-16'||m.level!==3||m.phase.equipLevel!==3||m.unlock.phase!=='PHASE_2'||m.unlock.level!==50||p.length!==3
  ||!same(m.phase.attributeBlackboard,[{key:'max_hp',value:100,valueStr:null},{key:'atk',value:47,valueStr:null}])
  ||Object.keys(m.phase.tokenAttributeBlackboard).length||p.some(c=>c.isToken!==false||c.validInGameTag!==null||c.validInMapTag!==null)
  ||p[0].target!=='DISPLAY'||p[0].resKey!==null||p[1].target!=='TALENT'||p[1].resKey!=='plosis_equip_1_3_p1'||p[2].target!=='TALENT'||p[2].resKey!=='plosis_equip_1_3_p2'
  ||card.length!==1||card[0].hidden!==true||card[0].alias!==ID+'#1'||!same(card[0].uniEquipIds,[{key:KEY,level:3}])
  ||!same(card[0].inst,{characterKey:ID,level:80,phase:'PHASE_2',favorPoint:50,potentialRank:0})||card[0].skillIndex!==1||card[0].mainSkillLvl!==7
  ||card[0].overrideSkillBlackboard!==null||card[0].overrideTalents!==null||t.ranges['y-3']?.direction!==1||!same(t.ranges['y-3'].grids.map(g=>[g.row,g.col]),range))fail();
 const global=p[1].addOrOverrideTalentDataBundle.candidates,local=p[2].addOrOverrideTalentDataBundle.candidates;
 if(global.length!==1||local.length!==1||global[0].talentIndex!==-1||global[0].prefabKey!=='10'||global[0].rangeId!=='y-3'
  ||local[0].talentIndex!==0||local[0].prefabKey!=='11'||local[0].rangeId!==null
  ||!same(global[0].blackboard,[{key:'sp_recovery_per_sec',value:.3,valueStr:null}])||!same(local[0].blackboard,[{key:'sp_recovery_per_sec',value:.35,valueStr:null}]))fail();
 for(const [key,index]of [['plosis_equip_1_3_p1',0],['plosis_equip_1_3_p2',1]]){
  const rows=n.prefabs[key].components.filter(c=>c.componentType==='MonoBehaviour').map(c=>JSON.parse(c.originalJson));
  const one=f=>{const a=rows.filter(f);if(a.length!==1)fail();return a[0];};
  const root=one(c=>c._overwriteTalentKey!==undefined),aura=one(c=>Array.isArray(c._buffs)),validator=one(c=>c._targetOptions),buff=aura._buffs[0],o=validator._targetOptions;
  if(root._overwriteTalentKey!==(index?'11':'10')||root._overrideDefaultRangeId!==(index?0:1)||root._applyTalentRange!==0
   ||aura._removeBuffWhenAbilityDetached!==1||aura._buffs.length!==1||buff.buffKey!=='spRecover'||buff.maxStackCnt!==1||buff.overrideType!==0
   ||!same(buff.attributes.attributeModifiers,[{attributeType:14,fetchBaseValueFromSourceEntity:0,formulaItem:0,loadFromBlackboard:1,value:0}])
   ||o.professionMask!==895||o.targetSide!==1||o.targetMotion!==3||o.targetCategory!==1||o.ignoreHealFree!==1||o.ignoreTargetFree!==1)fail();
  if(index){const r=one(c=>c._extendable!==undefined);if(aura._removeBuffWhenTargetLeave!==1||aura._ignoreOwnerFakeDeath!==0||r._extendable!==0||r._useBlackboardRangeId!==0)fail();}
  else if(aura._clearBuffsWhenDisappear!==0||aura._excludeReborningEntity!==0)fail();
 }
 return{module:m,global:global[0],local:local[0],range:structuredClone(range)};
}
export function ptilopsisStageBuild(){verifyPtilopsisStageModule();return{id:ID,elite:2,level:80,potential:1,trust:100,skillId:'skchr_plosis_2',skillRank:7,module:KEY,moduleLevel:3,stage:'17-16'};}
function exactBuild(build){const expected=ptilopsisStageBuild();if(Object.keys(expected).some(k=>build?.[k]!==expected[k]))throw Error('Unreviewed predefined Ptilopsis build');}
export function ptilopsisStageRecord(build,data){
 exactBuild(build);const source=verifyPtilopsisStageModule(),base=recordFor({...build,module:null},data),stats={...base.stats};
 for(const r of source.module.phase.attributeBlackboard)stats[r.key==='max_hp'?'maxHp':r.key]+=r.value;
 const withBb=t=>({...structuredClone(t),bb:Object.fromEntries(t.blackboard.map(r=>[r.key,r.value]))});
 return{...base,stats,rangeGrid:source.range,talents:[withBb(source.local),withBb(source.global)],arkpedia:{...base.arkpedia,...build}};
}
export function installPtilopsisStageModule(b,u,def,register){
 exactBuild(def.raw.arkpedia);const source=verifyPtilopsisStageModule();
 if(def.charId!==ID||!same(def.raw.rangeGrid,source.range)||!same(def.talents.map(t=>t.bb),[{sp_recovery_per_sec:.35},{sp_recovery_per_sec:.3}])||u.mem.ptilopsisStageModule)
  throw Error('Unreviewed predefined Ptilopsis runtime');
 let life=u.deploySeq||null;
 const current=()=>{if(life===null&&u.alive&&u.deployed)life=u.deploySeq;return u.deploySeq===life;};
 const controller={stopped:false,handles:[]};
 // _extendable=0 maps to the current main grid, excluding temporary distance
 // extensions and externally inherited extra keys. Native collider/FSM parity
 // is not claimed by this explicit regular-stage range/category mapping.
 const local=ally=>{
  const grid=u.skill.active&&u.skill.spec.targeting?.rangeGrid||u.rangeGrid;
  return !u.hidden&&bodyInKeys(ally,new Set(absoluteRangeKeys(grid,u.tileR,u.tileC,u.dir)));
 };
 const eligible=ally=>!controller.stopped&&current()&&ally.kind==='op';
 const global=register(b,u,.3,eligible,{key:`${u.id}:ptilopsis:global`}),inRange=register(b,u,.35,ally=>eligible(ally)&&local(ally),{key:`${u.id}:ptilopsis:range`});
 controller.sync=()=>{global();inRange();};controller.stop=()=>{if(controller.stopped)return;controller.stopped=true;global.stop();inRange.stop();for(const h of controller.handles)b.off(h);controller.handles=[];};
 controller.handles.push(b.on('death',({unit})=>{if(unit===u)controller.stop();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)controller.stop();},{owner:u}),
  b.on('battleEnd',controller.stop,{owner:u}),b.on('tick',()=>{if(life!==null&&u.deploySeq!==life)controller.stop();},{owner:u}));
 u.mem.ptilopsisStageModule=controller;return controller;
}
