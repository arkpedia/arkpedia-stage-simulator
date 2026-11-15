// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same,emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const action=(v,type)=>v?.$type===`Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
const isBejeweled=r=>['enemy_10019_sgmum','enemy_10019_sgmum_2'].includes(r.prefabKey);
const visuals=new Set(['IfElse','FilterDamageModifer','CreateEffect','AlwaysNext','CreateBuff',
  'FilterByBuffStackCount','CheckContainsDerviedBuff','FinishDerivedBuffById']);
function visualTree(v){
  if(Array.isArray(v))return v.every(visualTree);
  if(!v||typeof v!=='object')return true;
  if(v.$type){
    const name=v.$type.split('+')[1]?.split(',')[0];if(!visuals.has(name))return false;
    if(name==='CreateBuff'&&(!empty(v._buff?.attributes)||v._buff.templateKey!=='empty'
      ||!/^enemy_sgmum\[(?:ad|ap)_[12]\]$/.test(v._buff.buffKey)))return false;
    if(name==='FinishDerivedBuffById'&&!/^enemy_sgmum\[(?:ad|ap)_[12]\]$/.test(v._buffKey))return false;
  }
  return Object.values(v).every(visualTree);
}
function damageChannel(n,group,mask,stat,suffix){
  const passive=n[group]?.find(x=>'_buffs'in x),buff=passive?._buffs[0];
  if(!fields(passive,{_interruptAbilityOnDetach:1,_selector:{m_FileID:0,m_PathID:'0'}})||passive._buffs.length!==1
    ||!fields(buff,{buffKey:`enemy_sgmum[${group}]`,templateKey:`enemy_sgmum[${group}]`,lifeTimeType:2,isSilenceable:0,loadFromDB:0}))return false;
  if(group==='hit_ad'){
    if(!same(buff.attributes.attributeModifiers,[{attributeType:20,formulaItem:0,value:0,loadFromBlackboard:1,fetchBaseValueFromSourceEntity:0}]))return false;
  }else if(!empty(buff.attributes))return false;
  const events=n.$template(buff.templateKey)?.eventToActions,tree=events?.ON_TAKE_DAMAGE,outer=tree?.[0],nodes=outer?._succeedNodes;
  return same(Object.keys(events??{}),['ON_TAKE_DAMAGE'])&&tree.length===1&&action(outer,'IfElse')&&outer._failNodes===null
    &&action(outer._conditionNode,'FilterDamageModifer')&&fields(outer._conditionNode,{_filterAttackType:false,_filterDamageType:true,
      _damageMask:mask,_filterModifierCancelled:false})&&nodes?.length===5
    &&action(nodes[0],'CreateEffect')&&action(nodes[1],'AlwaysNext')&&action(nodes[2],'CreateBuff')
    &&fields(nodes[2],{_buffOwner:'BUFF_OWNER',_isDerivedBuff:true,_finishDerivedBuffIfParentFinish:true})
    &&fields(nodes[2]._buff,{buffKey:`enemy_sgmum[${suffix}]`,overrideType:'STACK',lifeTimeType:'INFINITY'})
    &&action(nodes[3],'AttributeModifierWithCertainBuffCount')&&fields(nodes[3],{_attributeType:stat,_formulaType:'ADDITION',
      _maxCnt:40,_buffKey:`enemy_sgmum[${suffix}]`,_useOneAsMinCnt:false,_writeModifyValueToBB:false})
    &&action(nodes[4],'IfElse')&&action(nodes[4]._conditionNode,'FilterByBuffStackCount')
    &&fields(nodes[4]._conditionNode,{_buffKey:`enemy_sgmum[${suffix}]`,_stackCountKey:'max_stack_cnt',_condType:'GE'})&&visualTree(nodes[4]);
}
export function bejeweledNative(r,n){
  const root=n[r.prefabKey]?.[0];if(!isBejeweled(r)||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.skills.length
    ||!same(r.talents.bb,{'hit_ad.taunt_level':1,'hit_ad.magic_resistance':80,'hit_ad.max_stack_cnt':30,'hit_ad.mid':15,
      'hit_ap.def':2000,'hit_ap.max_stack_cnt':30,'hit_ap.mid':15})||root?._modes.length!==1||root._commonAbilities.length)return false;
  const mode=n.$ref(root._modes[0]),combat=n.$ref(mode?._combat);
  return mode?._generalAbilities.length===0&&fields(combat,{_animKey:'Attack',_damageType:1,_atkScale:1,_activeBuffs:[],_timeMode:0,_waitForAttackEvent:1})
    &&damageChannel(n,'hit_ad','MAGICAL','MAGIC_RESISTANCE','ad')&&damageChannel(n,'hit_ap','PHYSICAL','DEF','ap');
}
const feature={matchesRecord:isBejeweled,covers:bejeweledNative};
export const BEJEWELED_FEATURES={
  'talent:hit_ad':{...feature,ability:{kind:'damageAdaptation',params:r=>({taunt:r.talents.bb['hit_ad.taunt_level'],channels:[
    {type:'phys',attribute:'defFlat',amount:r.talents.bb['hit_ap.def'],cap:r.talents.bb['hit_ap.max_stack_cnt']},
    {type:'arts',attribute:'resFlat',amount:r.talents.bb['hit_ad.magic_resistance'],cap:r.talents.bb['hit_ad.max_stack_cnt']},
  ]})}},
  'talent:hit_ap':feature,
  'ability:Starts with low DEF and RES, but permanently gains DEF when taking Physical damage and RES when taking Arts damage, up to a maximum.':feature,
};
