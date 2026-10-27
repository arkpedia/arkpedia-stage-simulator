// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile action provider dereferenced a null native object');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear projectile action provider requires native Boolean values');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile action provider requires native Int32 values');return value;};
const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear projectile action provider requires native FP raw values');return value;};

// Default branches only: hotfix dispatch, collection/interface implementations
// and owner validity remain explicit. Preprocessing mutates shared action nodes.
export function fearProjectileRangedActions({preprocess}){
 if(typeof preprocess!=='function')throw new TypeError('Fear ranged actions require the virtual preprocessor');
 return(ability,event,_projectile)=>{
  nonnull(ability);if(integer(event)!==0)return null;
  const captured=ability.m_actions;preprocess(ability,captured);return ability.m_actions;
 };
}
export function fearProjectileActiveBuffs(ability){return nonnull(ability)._activeBuffs;}

export function fearProjectilePreprocessActions({readOwner,isValidUnity,safeCount,readElement,castDamageNode,preprocessNode}){
 if([readOwner,isValidUnity,safeCount,readElement,castDamageNode,preprocessNode].some(fn=>typeof fn!=='function'))throw new TypeError('Fear action preprocessing requires owner, collection and interface callers');
 return(ability,actions)=>{
  const owner=readOwner(nonnull(ability));if(!bool(isValidUnity(owner)))return;
  const count=integer(safeCount(actions));
  for(let index=0;index<count;index++){
   const first=readElement(nonnull(actions),index);
   if(castDamageNode(first)!=null){
    const current=readElement(actions,index);nonnull(castDamageNode(current));
    const selected=castDamageNode(current);preprocessNode(selected,owner);
   }
  }
 };
}
export function fearProjectilePreprocessDamage({isValidUnity,readAtkRaw}){
 if([isValidUnity,readAtkRaw].some(fn=>typeof fn!=='function'))throw new TypeError('Fear damage preprocessing requires native owner and ATK callers');
 return(node,owner)=>{
  const cached=bool(isValidUnity(owner))?raw(readAtkRaw(nonnull(owner))):-(1n<<32n);
  nonnull(node).m_cachedAtk=cached;
 };
}
