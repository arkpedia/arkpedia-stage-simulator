// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
export const isDerisiveAudience=r=>r.prefabKey==='enemy_2009_csaudc';
/** Ordinary melee Combat, with its elemental ratio supplied by the passive
 * blackboard converter. The unused database SP row does not attach a skill. */
export function derisiveAudienceNative(r,n){
  if(!isDerisiveAudience(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'
    ||r.skills.length||!same(r.talents.groups,{combat:['attack@ep_damage_ratio']})
    ||!same(r.talents.bb,{'combat.attack@ep_damage_ratio':.2})||Object.keys(r.talents.bbStr).length
    ||!same(r.sp,{type:'INCREASE_WHEN_ATTACK',maxSp:3,initSp:0,increment:1}))return false;
  const root=n[r.prefabKey]?.find(c=>'_modes'in c);
  if(!root||root._modes.length!==1||root._commonAbilities.length||root._sideTypeIndex!==1||root._blockVolume!==1
    ||root._canNotExit!==0||root._specialBlockCondition._type!==0)return false;
  const mode=n.$ref(root._modes[0]),combat=n.$ref(mode?._combat);
  const binding=n.Combat?.flatMap(c=>n.$siblings(c)).find(c=>'_overwriteTalentKey'in c);
  return mode?._generalAbilities.length===0&&zero(mode._attack)&&zero(mode._attackTrigger)
    &&fields(combat,{m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},_selector:{m_FileID:0,m_PathID:'0'},
      _activeBuffs:[],_animKey:'Attack',_waitForAttackEvent:1,_timeMode:0,_affectedBySlowDown:1,
      _atkScale:1,_damageType:1,_attackType:1,_extraDamageType:0,_elementDamageType:1,_epDamageRatio:0,
      _useDynamicAttackType:0,_allowNoTarget:0,_alwaysIncludeTarget:1})
    &&fields(binding,{m_Script:{m_FileID:1,m_PathID:'-2726233351382997147'},_overwriteTalentKey:'',
      _overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,
      _attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_overrideDefaultRangeId:0,
      _applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyTalentRange:0,
      _applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_writeRangeIdToProjectileBlackboard:0,
      _affectWhenNotRootTalent:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleCertainMode:0,_scaleModeIndices:[]});
}
