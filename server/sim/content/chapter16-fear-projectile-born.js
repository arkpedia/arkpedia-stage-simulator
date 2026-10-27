// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile birth dereferenced a null native object');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile birth requires native Int32 values');return value;};
const single=value=>{if(typeof value!=='number')throw new TypeError('Fear projectile birth requires native Single values');return Math.fround(value);};

// Default SetTraceTarget. Casts, ObjectPtr operations and Nullable<Vector2>
// construction/copy are explicit; this is not an inferred native struct layout.
export function fearProjectileSetTraceTarget({castEntity,castMountPoint,castTile,readMountOwner,lockPointer,wrapEntity,copyPointer,writeBarrier,
 readMapPosition,readLocatablePosition,somePosition,nonePosition,copyNullable}){
 if([castEntity,castMountPoint,castTile,readMountOwner,lockPointer,wrapEntity,copyPointer,writeBarrier,readMapPosition,readLocatablePosition,somePosition,nonePosition,copyNullable].some(fn=>typeof fn!=='function'))throw new TypeError('Fear trace setup requires native cast, mount, pointer and nullable callers');
 return(projectile,target)=>{
  nonnull(projectile);const publish=value=>{projectile.m_traceTarget=copyPointer(wrapEntity(value));writeBarrier(projectile,'m_traceTarget',projectile.m_traceTarget);};let position;
  if(target!=null&&castEntity(target)!=null){
   const entity=castEntity(target);publish(entity);position=readMapPosition(nonnull(entity));
  }else if(target!=null&&castMountPoint(target)!=null){
   nonnull(castMountPoint(target));const mount=castMountPoint(target),owner=lockPointer(readMountOwner(nonnull(mount)));
   publish(owner);position=readMapPosition(nonnull(lockPointer(projectile.m_traceTarget)));
  }else{
   const tile=castTile(target);publish(null);
   if(tile==null){projectile.m_traceTargetMapPos=copyNullable(nonePosition());return;}
   position=readLocatablePosition(nonnull(target));
  }
  nonnull(position);const value={x:single(position.x),y:single(position.y)};
  projectile.m_traceTargetMapPos=copyNullable(somePosition(value));
 };
}

// Default OnProjectileBorn. Effect creation precedes action/behavior callbacks,
// BObject.Born and the non-graphic logging/audio path.
export function fearProjectileBorn({createMainEffect,actionBorn,readLength,readElement,behaviourBorn,baseBorn,readController,readLogger,logAddCount,
 readAudioSignal,readWorldPosition,readSource,playAudio}){
 if([createMainEffect,actionBorn,readLength,readElement,behaviourBorn,baseBorn,readController,readLogger,logAddCount,readAudioSignal,readWorldPosition,readSource,playAudio].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile birth requires effect, behavior, base, log and audio callers');
 return projectile=>{
  nonnull(projectile);createMainEffect(projectile,projectile._mainEffect);actionBorn(nonnull(projectile._actionController));
  let array=nonnull(projectile.m_behaviours);
  for(let index=0;index<integer(readLength(array));index++){
   behaviourBorn(nonnull(readElement(array,index)));array=nonnull(projectile.m_behaviours);
  }
  baseBorn(projectile);if(integer(projectile.m_type)===2)return;
  const logger=nonnull(readLogger(nonnull(readController())));logAddCount(logger,2,projectile.m_ExtraLogIds);
  const signal=readAudioSignal(projectile),position=nonnull(readWorldPosition(projectile)),world={x:single(position.x),y:single(position.y),z:single(position.z)},source=readSource(projectile);
  playAudio('ON_PROJECTILE_BORN',signal,world,source);
 };
}
