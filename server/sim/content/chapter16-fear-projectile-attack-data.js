// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileFloatToRaw,fearProjectileMultiplyRaw} from './chapter16-fear-fixed-values.js';
const nonnull=value=>{if(value==null)throw new TypeError('Fear attack data dereferenced a null native object');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear attack data requires native Int32 values');return value;};
const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear attack data requires native FP raw values');return value;};
const calls=options=>{if(Object.values(options).some(fn=>typeof fn!=='function'))throw new TypeError('Fear attack data requires native data, blackboard, list and action callers');};
export const fearProjectileAttackDataProperties=Object.freeze({readDamageType:ability=>integer(nonnull(ability)._damageType),readExtraDamageType:ability=>integer(nonnull(ability)._extraDamageType)});
export function fearProjectileMergeAttackScale(left,right){const product=fearProjectileMultiplyRaw(left,right);return product<0n?0n:product;}
export function fearProjectileCreateDamageNode({newDamageNode,writeBarrier}){
 calls({newDamageNode,writeBarrier});return(ability,type,scale)=>{
  nonnull(ability);const node=newDamageNode(ability,integer(type),raw(scale));ability.m_damageNode=node;writeBarrier(ability,'m_damageNode',node);return ability.m_damageNode;
 };
}
export function fearProjectileAlwaysNextConstructor({baseActionConstructor}){calls({baseActionConstructor});return node=>{baseActionConstructor(node);};}

// Full default AbstractBasicAttack.DoSetData orchestration. Base setup, value
// copy, blackboard lookup and collection/action effects remain explicit callers.
export function fearProjectileBasicAttackData({copyOptions,baseDoSetData,readBlackboard,readBlackboardFloat,clearList,
 readExtraDamageType,createDamageNode,addAction,allocateAlwaysNext,constructAlwaysNext,readDamageType,createElementDamageNode}){
 calls({copyOptions,baseDoSetData,readBlackboard,readBlackboardFloat,clearList,readExtraDamageType,createDamageNode,addAction,
  allocateAlwaysNext,constructAlwaysNext,readDamageType,createElementDamageNode});
 const add=(list,node)=>addAction(nonnull(list),node);
 const separator=ability=>{const list=ability.m_actions,node=nonnull(allocateAlwaysNext());constructAlwaysNext(node);add(list,node);};
 return(ability,owner,options)=>{
  nonnull(ability);const copied=copyOptions(nonnull(options));baseDoSetData(ability,owner,copied);
  ability.m_atkScale=fearProjectileFloatToRaw(ability._atkScale);ability.m_epDamageRatio=fearProjectileFloatToRaw(ability._epDamageRatio);
  if(readBlackboard(ability)!=null){
   const scale=raw(ability.m_atkScale),board=nonnull(readBlackboard(ability)),key=ability._atkScaleKey;
   ability.m_atkScale=fearProjectileMergeAttackScale(scale,fearProjectileFloatToRaw(readBlackboardFloat(board,key,1)));
   const ratio=fearProjectileFloatToRaw(readBlackboardFloat(nonnull(readBlackboard(ability)),'ep_damage_ratio',ability._epDamageRatio));
   ability.m_epDamageRatio=ratio<0n?0n:ratio;
  }
  clearList(nonnull(ability.m_actions));
  if(integer(readExtraDamageType(ability))!==0){
   const list=ability.m_actions,type=integer(readExtraDamageType(ability)),scale=raw(ability.m_atkScale);
   add(list,createDamageNode(ability,type,scale));separator(ability);
  }
  const list=ability.m_actions,type=integer(readDamageType(ability)),scale=raw(ability.m_atkScale);
  add(list,createDamageNode(ability,type,scale));
  const element=integer(ability._elementDamageType);ability.m_elementDamageType=element;
  if(element!==0&&raw(ability.m_epDamageRatio)>0n){
   separator(ability);
   const ratio=raw(ability.m_epDamageRatio),kind=integer(ability.m_elementDamageType),current=ability.m_actions;
   add(current,createElementDamageNode(ability,kind,ratio));
  }
 };
}
