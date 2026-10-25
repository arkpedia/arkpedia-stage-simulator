// SPDX-License-Identifier: GPL-3.0-or-later
import tables from '../../../data/candidates/arkpedia-stage-predefined-module-tables.json' with {type:'json'};
import native from '../../../data/candidates/arkpedia-stage-predefined-module-native.json' with {type:'json'};
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import aliases from '../../../data/candidates/arkpedia-war-caster-event-alias-source.json' with {type:'json'};
const KEY='uniequip_002_closur',same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyClosurModuleSource(t=tables,n=native){
 const m=t.modules[KEY],phase=m.phase,parts=phase.parts;
 const components=n.prefabs.closur_equip_1_1_p1.components.filter(r=>r.componentType==='MonoBehaviour').map(r=>JSON.parse(r.originalJson));
 const one=f=>{const found=components.filter(f);if(found.length!==1)throw Error('Ambiguous Closure module component');return found[0];};
 const aura=one(c=>c._removeBuffWhenTargetLeave!==undefined),range=one(c=>c._rangeId!==undefined),root=one(c=>c._overwriteTalentKey!==undefined),validator=one(c=>c._checkIsSameHost!==undefined),selector=one(c=>c._includeSelf!==undefined);
 const trigger=n.templates.closur_e_002_tr.eventToActions._items;
 const nodes=JSON.parse(trigger.find(r=>r.key===10)?.value.SerializedState??'[]');
 const extra=parts[1].addOrOverrideTalentDataBundle.candidates;
 if(aliases.events['10']?.name!=='ON_TAKE_DAMAGE'||m.owner!=='char_4228_closur'||m.stage!=='17-14'||m.level!==3||phase.equipLevel!==3||parts.length!==3
  ||!same(phase.attributeBlackboard,[{key:'max_hp',value:180,valueStr:null},{key:'atk',value:30,valueStr:null},{key:'def',value:25,valueStr:null}])
  ||m.unlock.phase!=='PHASE_2'||m.unlock.level!==60||parts[0].target!=='DISPLAY'||parts[0].resKey!==null||parts.some(p=>p.isToken!==false||p.validInGameTag!==null||p.validInMapTag!==null)||Object.keys(phase.tokenAttributeBlackboard).length!==0
  ||parts[1].resKey!=='closur_equip_1_1_p1'||parts[1].target!=='TALENT'||parts[2].target!=='TALENT_DATA_ONLY'||extra.length!==1||extra[0].talentIndex!==-1||extra[0].prefabKey!=='10'||!same(extra[0].blackboard,[{key:'damage_scale',value:.85,valueStr:null}])
  ||root._overwriteTalentKey!=='10'||range._rangeId!=='empty_range'||validator._isOwnerEnemy!==0||validator._isTargetEnemy!==0||validator._checkIsSameHost!==0||selector._includeSelf!==0||validator._targetOptions.targetMotion!==1
  ||aura._removeBuffWhenTargetLeave!==1||aura._removeBuffWhenAbilityDetached!==1||aura._ignoreOwnerFakeDeath!==0||aura._buffs.length!==1||aura._buffs[0].buffKey!=='closur_e_002[friend]'||aura._buffs[0].templateKey!=='closur_e_002_tr'||aura._buffs[0].isDurableBuff!==0
  ||trigger.length!==1||nodes.length!==2||!nodes[0].$type.endsWith('+CheckBlocked')||nodes[0]._targetType!=='MODIFIER_SOURCE'||nodes[0]._sourceType!=='BUFF_OWNER'||nodes[0]._checkBlockedBySource!==true||nodes[0]._checkBlockedBySourceToken!==false
  ||!nodes[1].$type.endsWith('+DamageScale')||nodes[1]._filterDamageType!==false||nodes[1]._filterApplyWay!==false||nodes[1]._isStackable!==false||nodes[1]._isOneMinus!==false||nodes[1]._customKey!=='')throw Error('Unreviewed Closure stage module source');
 return m;
}
export function applyClosurStageModule(selected,build){
 const m=verifyClosurModuleSource(),pre=tables.stages['17-14'].predefines.characterInsts[0];
 if(pre.inst.characterKey!=='char_4228_closur'||pre.inst.phase!=='PHASE_2'||pre.skillIndex!==2||pre.hidden!==false||!same(pre.uniEquipIds,[{key:KEY,level:3}])
  ||build.stage!=='17-14'||build.module!==KEY||build.moduleLevel!==3||build.elite!==2||build.level!==pre.inst.level
  ||build.potential!==pre.inst.potentialRank+1||build.trust!==pre.inst.favorPoint*2||build.skillId!=='skchr_closur_3'||build.skillRank!==pre.mainSkillLvl)throw Error('Unreviewed predefined Closure module build');
 const stats={...selected.stats};for(const row of m.phase.attributeBlackboard)stats[{max_hp:'maxHp',atk:'atk',def:'def'}[row.key]]+=row.value;
 const talents=structuredClone(selected.talents),extra=sourceCandidate(m.phase.parts[1].addOrOverrideTalentDataBundle.candidates,build),upgrade=sourceCandidate(m.phase.parts[2].addOrOverrideTalentDataBundle.candidates,build);
 if(extra?.blackboard[0]?.value!==.85||extra.talentIndex!==-1||upgrade?.talentIndex!==1||!same(upgrade.blackboard,[{key:'cost',value:-5,valueStr:null},{key:'atk',value:.08,valueStr:null}]))throw Error('Unreviewed Closure module talent selection');
 talents[1]={...talents[1],...upgrade};talents.push(extra);
 return{...selected,build:{...build},stats,talents,talentBb:talents.map(t=>Object.fromEntries(t.blackboard.map(r=>[r.key,r.valueStr??r.value])))};
}
