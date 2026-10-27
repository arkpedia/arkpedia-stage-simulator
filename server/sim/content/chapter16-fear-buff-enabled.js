// SPDX-License-Identifier: GPL-3.0-or-later
// Default enabled setter/update branches. Native modifier storage and action
// execution remain explicit; each nested update retains its own owner sample.
export function fearProjectileBuffEnabled({buff,readOwner,isDestroyedOrNull,isSilenced,isStunned,isFrozen,isLevitate,
 readAttributes,addModifier,removeModifier,runActions,isActive}){
 if(!buff||[readOwner,isDestroyedOrNull,isSilenced,isStunned,isFrozen,isLevitate,readAttributes,addModifier,removeModifier,runActions,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear enabled update requires native buff, owner, modifier, action and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear enabled update requires native Boolean fields and results');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear enabled update dereferenced a null native object');return value;};
 const cancelled=Symbol('cancelled'),check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 const update=()=>{
  let enabled=boolean(buff.m_isManuallyEnabled);
  const owner=invoke(readOwner,buff);
  for(const [field,query]of [['m_isSilenceable',isSilenced],['m_isStunnable',isStunned],['m_isFreezable',isFrozen],['m_isLevitatable',isLevitate]]){
   if(boolean(buff[field])&&!boolean(invoke(isDestroyedOrNull,owner))&&boolean(invoke(query,nonnull(owner)))){enabled=false;break;}
  }
  if(boolean(buff.m_isActuallyEnabled)===enabled)return;
  buff.m_isActuallyEnabled=enabled;
  if(enabled)buff.m_isLateEnabled=true;
  check();
  const current=nonnull(invoke(readOwner,buff)),attributes=nonnull(invoke(readAttributes,current));
  invoke(enabled?addModifier:removeModifier,attributes,buff);
  invoke(runActions,buff,enabled?24:25,true);
 };
 return Object.freeze({
  set(value){
   try{
    check();boolean(value);
    if(boolean(buff.m_isFinished)&&value)return;
    buff.m_isManuallyEnabled=value;check();update();
   }catch(error){if(error===cancelled)return null;throw error;}
  },
  update(){try{check();update();}catch(error){if(error===cancelled)return null;throw error;}},
 });
}
