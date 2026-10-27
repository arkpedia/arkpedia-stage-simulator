// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear damage node construction dereferenced a null native object');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear damage node construction requires native Int32 values');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear damage node construction requires native Boolean values');return value;};
const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear damage node construction requires native FP raw values');return value;};
const calls=options=>{if(Object.values(options).some(fn=>typeof fn!=='function'))throw new TypeError('Fear damage node construction requires native allocation, constructor and property callers');};
export const fearProjectileDamageNodeProperties=Object.freeze({readApplyWay:()=>2,
 readAttackType:ability=>integer(nonnull(ability)._attackType),readUseDynamic:ability=>bool(nonnull(ability)._useDynamicAttackType)});

// Default constructor branches only. Object allocation/zeroing, string static
// initialization, barriers and Object's empty constructor remain receivers.
export function fearProjectileActionNodeConstructor({objectConstructor}){
 calls({objectConstructor});return node=>{objectConstructor(node);};
}
export function fearProjectileDamageNodeConstructors({readEmptyString,writeBarrier,baseActionConstructor}){
 calls({readEmptyString,writeBarrier,baseActionConstructor});
 const initialize=node=>{
  nonnull(node);node._damageType=1;node._attackType=1;node._modifierKey=readEmptyString();writeBarrier(node,'_modifierKey',node._modifierKey);
  node.m_cachedAtk=-(1n<<32n);baseActionConstructor(node);
 };
 return Object.freeze({
  damage:(node,damageType,applyWay,atkScale,attackType,useDynamic,modifierKey)=>{
   integer(damageType);integer(applyWay);raw(atkScale);integer(attackType);bool(useDynamic);initialize(node);
   node._damageType=damageType;node.m_atkScale=atkScale;node._applyWay=applyWay;node._attackType=attackType;node._useDynamicAttackType=useDynamic;
   node._modifierKey=modifierKey;writeBarrier(node,'_modifierKey',modifierKey);
  },
  cached:(node,damageType,applyWay,atkScale,attackType,useDynamic,transferSource)=>{
   integer(damageType);integer(applyWay);raw(atkScale);integer(attackType);bool(useDynamic);bool(transferSource);
   const key=readEmptyString();initialize(node);
   node._useDynamicAttackType=useDynamic;node._damageType=damageType;node.m_atkScale=atkScale;node._applyWay=applyWay;node._attackType=attackType;
   node._modifierKey=key;writeBarrier(node,'_modifierKey',key);node._transferSource=transferSource;
  }
 });
}
export function fearProjectileNewDamageNode({readApplyWay,readAttackType,readUseDynamic,readEmptyString,allocateDamage,constructDamage}){
 calls({readApplyWay,readAttackType,readUseDynamic,readEmptyString,allocateDamage,constructDamage});
 return(ability,damageType,atkScale)=>{
  nonnull(ability);integer(damageType);raw(atkScale);
  const way=integer(readApplyWay(ability)),attack=integer(readAttackType(ability)),dynamic=bool(readUseDynamic(ability)),key=readEmptyString(),node=nonnull(allocateDamage());
  constructDamage(node,damageType,way,atkScale,attack,dynamic,key);return node;
 };
}
export function fearProjectileRangedDamageNode({baseNewDamageNode,readApplyWay,readAttackType,readUseDynamic,allocateCachedDamage,constructCachedDamage}){
 calls({baseNewDamageNode,readApplyWay,readAttackType,readUseDynamic,allocateCachedDamage,constructCachedDamage});
 return(ability,damageType,atkScale)=>{
  nonnull(ability);integer(damageType);raw(atkScale);if(!bool(ability._useCachedAtkOnly))return baseNewDamageNode(ability,damageType,atkScale);
  const way=integer(readApplyWay(ability)),attack=integer(readAttackType(ability)),dynamic=bool(readUseDynamic(ability)),transfer=bool(ability._transferSource),node=nonnull(allocateCachedDamage());
  constructCachedDamage(node,damageType,way,atkScale,attack,dynamic,transfer);return node;
 };
}
