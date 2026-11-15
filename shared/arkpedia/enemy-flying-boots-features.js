// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const action=(v,type)=>v?.$type===`Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
export const isFlyingBoots=r=>['enemy_1410_mmelee','enemy_1410_mmelee_2'].includes(r.prefabKey);
export function flyingBootsNative(r,n){
  const root=n[r.prefabKey]?.[0],passive=n.PhysicalEvade?.find(x=>'_buffs'in x);
  if(!isFlyingBoots(r)||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.skills.length
    ||!same(r.talents.bb,{'PhysicalEvade.prob':.4})||root?._modes.length!==1||root._commonAbilities.length
    ||!fields(passive,{_interruptAbilityOnDetach:1,_selector:{m_FileID:0,m_PathID:'0'}})||passive._buffs.length!==2)return false;
  const mode=n.$ref(root._modes[0]),combat=n.$ref(mode?._combat);
  if(mode?._generalAbilities.length||!fields(combat,{_animKey:'Attack',_damageType:1,_atkScale:1,_activeBuffs:[],
    _waitForAttackEvent:1,_timeMode:0}))return false;
  for(const[i,b]of passive._buffs.entries())if(!fields(b,{buffKey:i?'enemy_rope_trigger_buff[continues]':'enemy_mmelee_physical_evade',
    templateKey:i?'enemy_mmelee_touched_rope[continues]':'enemy_mmelee_physical_evade',loadFromDB:0,lifeTimeType:2,isSilenceable:0,
    isStunnable:0,isFreezable:0,maxStackCnt:1})||!empty(b.attributes))return false;
  const evade=n.$template('enemy_mmelee_physical_evade')?.eventToActions;
  const touch=n.$template('enemy_mmelee_touched_rope[continues]')?.eventToActions;
  if(!same(Object.keys(evade??{}).sort(),['ON_BUFF_START','ON_TAKE_DAMAGE'])||evade.ON_TAKE_DAMAGE?.length!==1
    ||!action(evade.ON_TAKE_DAMAGE[0],'Evade')||!fields(evade.ON_TAKE_DAMAGE[0],{_damageMask:'PHYSICAL',_applyWayFilter:'ALL'})
    ||evade.ON_BUFF_START?.length!==1||!action(evade.ON_BUFF_START[0],'CreateBuff')
    ||!fields(evade.ON_BUFF_START[0],{_isDerivedBuff:true,_finishDerivedBuffIfParentFinish:true})
    ||!fields(evade.ON_BUFF_START[0]._buff,{buffKey:'enemy_mmelee_evade_effect',templateKey:'empty',lifeTimeType:'INFINITY'})
    ||!empty(evade.ON_BUFF_START[0]._buff.attributes)||!same(Object.keys(touch??{}),['ON_BUFF_TRIGGER'])
    ||touch.ON_BUFF_TRIGGER?.length!==1||!action(touch.ON_BUFF_TRIGGER[0],'FinishBuffsById')
    ||!fields(touch.ON_BUFF_TRIGGER[0],{_buffKey:'enemy_mmelee_physical_evade',_targetType:'BUFF_OWNER',_decCntIfStack:false}))return false;
  return true;
}
export const FLYING_BOOTS_FEATURE={matchesRecord:isFlyingBoots,covers:flyingBootsNative,
  ability:{kind:'ropeBreakableDodge',params:r=>({prob:r.talents.bb['PhysicalEvade.prob']})},
  explains:/^Capable of evading physical attacks\. Loses Physical Dodge against a Stabilizer Chain\.$/};
