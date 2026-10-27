// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile attachments dereferenced a null native object');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile attachments require native Int32 values');return value;};

// Default branches: Ability.get_options/get_familyGroup read the embedded
// Options.familyGroup. Hotfix and native value-copy effects are not admitted.
export function fearProjectileAttachmentFamilyGroup(ability){return integer(nonnull(nonnull(ability).options).familyGroup);}
export function fearProjectileAbilityAttachments({readOwner,isNullUnity,readFamilyGroup,getEntityAttachments}){
 if([readOwner,isNullUnity,readFamilyGroup,getEntityAttachments].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile attachments require native owner, options and entity callers');
 return ability=>{
  nonnull(ability);const absent=isNullUnity(readOwner(ability));if(typeof absent!=='boolean')throw new TypeError('Fear projectile attachments require a native Boolean Unity query');
  if(absent)return null;
  const owner=readOwner(ability),group=integer(readFamilyGroup(ability));
  return getEntityAttachments(nonnull(owner),group);
 };
}
export function fearProjectileEntityAttachments({readLength,readElement}){
 if([readLength,readElement].some(fn=>typeof fn!=='function'))throw new TypeError('Fear entity attachments require native array callers');
 return(entity,group)=>{
  const array=nonnull(entity).m_abilityAttachments,index=integer(group);nonnull(array);
  if((index>>>0)>=(integer(readLength(array))>>>0))throw new RangeError('Fear projectile attachments native array bounds');
  return readElement(array,index);
 };
}
