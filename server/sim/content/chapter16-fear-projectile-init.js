// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile Init dereferenced a null native object');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear projectile Init requires native Boolean values');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile Init requires native Int32 values');return value;};
const single=value=>{if(typeof value!=='number')throw new TypeError('Fear projectile Init requires native Single values');return Math.fround(value);};
const vector=value=>{nonnull(value);return{x:single(value.x),y:single(value.y)};};

// Selected default Projectile.Init, including default key/miss setters. BObject,
// action controller, inner projectile setup and log/managed-list effects remain
// explicit receivers. Errors retain writes and callbacks already performed.
export function fearProjectileInit(options){
 const {writeBarrier,readAbilityOwner,wrapEntity,wrapAbility,copyPointer,isValidPointer,lockPointer,readMapPosition,readVector2Zero,
  readDamageMissFlag,initActionController,readStartPosition,readSource,readSide,readPlayerSide,readStartHeight,initBObject,initInline,
  readLogger,readEntityId,castCharacter,readCharacterMode,modeToString,readEmptyString,isValidUnity,readAbilityExtraData,fetchLoggerIds,
  readManagedProjectiles,captureProjectilePointer,appendManagedProjectile}=options;
 if([writeBarrier,readAbilityOwner,wrapEntity,wrapAbility,copyPointer,isValidPointer,lockPointer,readMapPosition,readVector2Zero,
  readDamageMissFlag,initActionController,readStartPosition,readSource,readSide,readPlayerSide,readStartHeight,initBObject,initInline,
  readLogger,readEntityId,castCharacter,readCharacterMode,modeToString,readEmptyString,isValidUnity,readAbilityExtraData,fetchLoggerIds,
  readManagedProjectiles,captureProjectilePointer,appendManagedProjectile].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile Init requires native pointer, position, action, inner setup and log callers');
 return(projectile,key,start,target,ability,type,originalKey,effectReplacePairs)=>{
  nonnull(projectile);projectile.key=key;writeBarrier(projectile,'key',key);
  projectile.originalKey=originalKey;writeBarrier(projectile,'originalKey',originalKey);
  const owner=readAbilityOwner(nonnull(ability));projectile.m_source=copyPointer(wrapEntity(owner));writeBarrier(projectile,'m_source',projectile.m_source);
  projectile.m_sourceMapPos=bool(isValidPointer(projectile.m_source))?vector(readMapPosition(nonnull(lockPointer(projectile.m_source)))):vector(readVector2Zero());
  projectile.m_ability=copyPointer(wrapAbility(ability));writeBarrier(projectile,'m_ability',projectile.m_ability);
  projectile.damageMissFlag=bool(isValidPointer(projectile.m_ability))?bool(readDamageMissFlag(nonnull(lockPointer(projectile.m_ability)))):false;
  projectile.m_effectReplacePairs=effectReplacePairs;projectile.m_type=integer(type);writeBarrier(projectile,'m_effectReplacePairs',effectReplacePairs);
  initActionController(nonnull(projectile._actionController),ability,projectile);
  projectile.m_startMapPos=vector(readStartPosition(nonnull(start)));
  const side=integer(readSide(nonnull(readSource(projectile)))),playerSide=integer(readPlayerSide(nonnull(readSource(projectile)))),
   position=vector(readStartPosition(start)),height=single(readStartHeight(start));
  initBObject(projectile,side,playerSide,position,height);initInline(projectile,target,start);
  const logger=readLogger(),ids=projectile.m_ExtraLogIds,source=readSource(projectile);
  const sourceId=bool(isValidUnity(source))?readEntityId(nonnull(lockPointer(projectile.m_source))):readEmptyString();
  const character=castCharacter(readSource(projectile));let mode;
  if(bool(isValidUnity(character))){
   const raw=nonnull(lockPointer(projectile.m_source));nonnull(castCharacter(raw));const selected=castCharacter(raw);
   mode=modeToString(integer(readCharacterMode(selected)));
  }else mode=readEmptyString();
  const abilityName=bool(isValidUnity(ability))?readAbilityExtraData(ability):readEmptyString();
  fetchLoggerIds(nonnull(logger),ids,2,sourceId,mode,originalKey,abilityName);
  if(bool(projectile._managedBySource)&&bool(isValidPointer(projectile.m_source))){
   const list=readManagedProjectiles(nonnull(readSource(projectile))),pointer=captureProjectilePointer(projectile);
   appendManagedProjectile(nonnull(list),pointer);
  }
 };
}
