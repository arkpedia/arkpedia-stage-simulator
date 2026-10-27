// SPDX-License-Identifier: GPL-3.0-or-later
// Selected default AbilityStandard.OnSpellStart. Native pointer/stack operations,
// virtual callbacks and projectile creation remain explicit receivers.
export function fearProjectileSpellStart(options){
 const {copyOwnerPointer,readIgnoreIfOwnerDead,validOwnerAndAlive,lockOwner,canSpell,finishIfNot,readContext,
  pushReference,pushSource,popReference,popSource,getBuffs,getAttachments,getActions,onEvent,isValidUnity,
  copyInputTargetPointer,lockPointer,onOwnerSpell,onlyFirstAudio,readSpellCount,emitAudio,castTargets,
  readDamageOrHeal,allowNoTarget,onOutput,onOutputEach,noTarget}=options;
 if([copyOwnerPointer,readIgnoreIfOwnerDead,validOwnerAndAlive,lockOwner,canSpell,finishIfNot,readContext,
  pushReference,pushSource,popReference,popSource,getBuffs,getAttachments,getActions,onEvent,isValidUnity,
  copyInputTargetPointer,lockPointer,onOwnerSpell,onlyFirstAudio,readSpellCount,emitAudio,castTargets,
  readDamageOrHeal,allowNoTarget,onOutput,onOutputEach,noTarget].some(fn=>typeof fn!=='function'))throw new TypeError('Fear spell start requires native owner, context, payload and cast callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear spell start dereferenced a null native object');return value;},
  bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear spell start requires native Boolean values');return value;},
  integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear spell start requires native Int32 values');return value;},
  stack=(ability,field)=>nonnull(nonnull(readContext(ability))[field]);
 return ability=>{
  nonnull(ability);const reason={value:0},ownerPointer=copyOwnerPointer(ability),ignore=bool(readIgnoreIfOwnerDead(ability));
  if(!bool(validOwnerAndAlive(ownerPointer,ignore))){finishIfNot(ability,2,false);return false;}
  const owner=nonnull(lockOwner(ability));
  if(!bool(canSpell(owner,ability,reason))){finishIfNot(ability,integer(reason.value),false);return false;}
  pushReference(stack(ability,'m_ability'),ability);
  pushSource(stack(ability,'m_source'),owner);
  const buffs=getBuffs(ability),attachments=getAttachments(ability),actions=getActions(ability,4);
  onEvent(ability,4,false);
  if(bool(isValidUnity(owner))){
   const context=nonnull(readContext(ability)),pointer=copyInputTargetPointer(ability),mainTargetStack=context.m_mainTarget,
    target=lockPointer(pointer);
   pushReference(nonnull(mainTargetStack),target);
   onOwnerSpell(owner,ability);
   popReference(stack(ability,'m_mainTarget'));
  }
  if(!bool(onlyFirstAudio(ability))||integer(readSpellCount(ability))===0)emitAudio(ability);
  const primary=bool(castTargets(ability,actions,buffs,attachments));
  if(bool(readDamageOrHeal(ability))){
   if((primary||bool(allowNoTarget(ability)))&&integer(readSpellCount(ability))===0)onOutput(ability);
   if(bool(readDamageOrHeal(ability))&&(primary||bool(allowNoTarget(ability))))onOutputEach(ability);
  }
  const result=primary?true:bool(noTarget(ability,actions,buffs,attachments));
  popSource(stack(ability,'m_source'));
  popReference(stack(ability,'m_ability'));
  return result;
 };
}
