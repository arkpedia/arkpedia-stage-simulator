// SPDX-License-Identifier: GPL-3.0-or-later
// Default target getters. Pointer views preserve the address of a native
// struct field when its containing record is changed during Lock callbacks.
export function fearProjectileActionTargetGetters({lockPointer}){
 if(typeof lockPointer!=='function')throw new TypeError('Fear target getters require the native ObjectPtr.Lock caller');
 const nonnull=value=>{if(value==null)throw new TypeError('Fear target getter dereferenced a null native object');return value;};
 const pointer=(record,field)=>{
  nonnull(record);return lockPointer({get obj(){return nonnull(record[field]).obj;},get cachedUid(){return nonnull(record[field]).cachedUid;}});
 };
 return Object.freeze({
  readBuffOwner:buff=>nonnull(nonnull(buff).m_container)['<owner>k__BackingField'],
  readBuffSource:buff=>pointer(buff,'m_source'),
  readModifierSource:modifier=>pointer(modifier,'m_source'),readModifierTarget:modifier=>pointer(modifier,'m_target'),
  readAbilityOwner:ability=>pointer(ability,'m_owner'),
  readProjectileSource:projectile=>pointer(projectile,'m_source'),readProjectileTraceTarget:projectile=>pointer(projectile,'m_traceTarget'),
 });
}
