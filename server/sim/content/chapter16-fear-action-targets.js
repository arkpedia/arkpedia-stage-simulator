// SPDX-License-Identifier: GPL-3.0-or-later
// Nodes.GetActionTarget's eleven-case switch. SnapshotRef is mutable native
// storage; Unity-qualified paths reread its field after validity callbacks.
export function fearProjectileActionTargets({readBuffSource,readBuffOwner,readModifierTarget,readModifierSource,isValidUnity,readProjectileSource,readProjectileTraceTarget,readAbilityOwner}){
 if([readBuffSource,readBuffOwner,readModifierTarget,readModifierSource,isValidUnity,readProjectileSource,readProjectileTraceTarget,readAbilityOwner].some(fn=>typeof fn!=='function'))throw new TypeError('Fear action targets require native owner, pointer and Unity callers');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear action target dereferenced a null native object');return value;};
 return Object.freeze({getEntity(ref,selector){
  if(!Number.isInteger(selector)||selector<-(2**31)||selector>=2**31)throw new TypeError('Fear action target requires native Int32 selector');
  if(selector<0||selector>10)return null;
  const snapshot=()=>nonnull(nonnull(ref).value);
  if(selector===0)return snapshot().target;
  if(selector===1)return snapshot().source;
  if(selector===6)return snapshot().mainTarget;
  if(selector===2||selector===3||selector===7){const buff=snapshot()[selector===7?'mainBuff':'buff'];return buff==null?null:(selector===3?readBuffOwner:readBuffSource)(buff);}
  if(selector===4||selector===5)return(selector===4?readModifierTarget:readModifierSource)(nonnull(snapshot().modifier));
  const field=selector===10?'ability':'projectile',valid=isValidUnity(snapshot()[field]);
  if(typeof valid!=='boolean')throw new TypeError('Fear action target requires native Boolean Unity validity');
  if(!valid)return null;
  return(selector===10?readAbilityOwner:selector===8?readProjectileSource:readProjectileTraceTarget)(nonnull(snapshot()[field]));
 }});
}
