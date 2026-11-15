// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
import {CART_STOPPER_PREFABS} from './enemy-cart-interactions.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
export const isSurfingInstructor=r=>CART_STOPPER_PREFABS.includes(r.prefabKey);
export function surfingInstructorNative(r,n){
  if(!isSurfingInstructor(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'
    ||!r.stats.immunities.silence||r.skills.length||r.sp||!same(r.talents.groups,{Resist:['damage_resistance']})
    ||!same(r.talents.bb,{'Resist.damage_resistance':r.prefabKey.endsWith('_2') ? .75 : .5})||Object.keys(r.talents.bbStr).length)return false;
  const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),combat=n.$ref(mode?._combat);
  if(!root||root._modes.length!==1||root._commonAbilities.length||root._blockVolume!==1||root._delayToBorn!==0
    ||mode?._generalAbilities.length||!zero(mode._attack)||!zero(mode._attackTrigger))return false;
  if(!fields(combat,{m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},_animKey:'Attack',_damageType:2,
    _atkScale:1,_activeBuffs:[],_elementDamageType:0,_epDamageRatio:0,_extraDamageType:0,_timeMode:0,_waitForAttackEvent:1}))return false;
  const resist=n.Resist?.find(c=>'_checker'in c),checker=n.$ref(resist?._checker),buff=resist?._buffs?.[0];
  const binding=resist&&n.$siblings(resist).find(c=>'_isSilenceable'in c);
  if(!fields(resist,{_isInverseToggle:0,_unmanagedBuffsWhenToggleOn:[],_buffsWhenToggleOff:[]})||resist._buffs.length!==1
    ||!fields(checker,{m_Script:{m_FileID:1,m_PathID:'-4412927117579039591'},_blockMinCnt:-1,_blockMaxCnt:0,_useBlockAsMin:1,_buffsToBlockee:[]})
    ||!fields(binding,{_isSilenceable:1,_applyTalentScale:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_scaleCertainKeyFlag:0})
    ||!fields(buff,{buffKey:'enemy_durplc_t',templateKey:'damage_resistance',loadFromDB:0,lifeTimeType:2,isSilenceable:0,
      isStunnable:0,isFreezable:0,isLevitatable:0,blackboard:[],maxStackCnt:1})||!empty(buff.attributes))return false;
  const scale={$type:'Torappu.Battle.Action.Nodes+DamageScale, Assembly-CSharp',_filterDamageType:true,_damageMask:'PHYSICAL_AND_MAGICAL',
    _filterApplyWay:false,_applyWayFilter:'NONE',_isOneMinus:true,_isStackable:false,_isValidStackCnt:false,_cachedDeltaValueToBBKey:'',_customKey:''};
  const cart=n.$template('enemy_durcar_hit_blocker')?.eventToActions.ON_BUFF_START?.[0]?._conditionNode;
  return same(n.$template('damage_resistance')?.eventToActions,{ON_TAKE_DAMAGE:[scale]})
    &&same(cart,{$type:'Torappu.Battle.Action.Nodes+CheckEnemyId, Assembly-CSharp',_targetType:'BUFF_OWNER',
      _filterIds:CART_STOPPER_PREFABS,_isUnset:false,_loadIdFromBb:false});
}
const feature={matchesRecord:isSurfingInstructor,covers:surfingInstructorNative};
export const SURFING_INSTRUCTOR_FEATURES={
  'ability:Can stop <Self-Driving Carts>':feature,
  'talent:Resist':{...feature,explains:/^When not blocked, Physical and Arts damage taken is significantly reduced$/,ability:{kind:'unblockedSanctuary',params:r=>({reduction:r.talents.bb['Resist.damage_resistance'],
    key:'enemy_durplc_t',suppressedBy:null,silenceable:true})}},
};
