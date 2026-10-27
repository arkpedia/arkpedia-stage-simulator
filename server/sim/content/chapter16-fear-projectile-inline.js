// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear inner Init dereferenced a null native object');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear inner Init requires native Boolean values');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear inner Init requires native Int32 values');return value;};
const single=value=>{if(typeof value!=='number')throw new TypeError('Fear inner Init requires native Single values');return Math.fround(value);};
const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear inner Init requires signed Q32.32 values');return value;};

// Selected default _InitInline/reset and _DelayToBorn. Native dictionary/array,
// behavior, random, Unity and scheduler effects remain explicit receivers.
export function fearProjectileInlineInit({clearAlreadyHit,readLength,readElement,storeReference,getLifeTime,floatToRaw,getMaxHitNum,getKeepAlreadyHitTime,
 isNullUnity,readTransform,writeBarrier,setTraceTarget,initBehaviour,initOuterSettings,isDeterministic,readRandomImp,readRandomTrivial,
 isZero,randomRange,greaterThan,readGameObject,setActive,createBornAction,invokeFixedDelay,onBorn}){
 if([clearAlreadyHit,readLength,readElement,storeReference,getLifeTime,floatToRaw,getMaxHitNum,getKeepAlreadyHitTime,
  isNullUnity,readTransform,writeBarrier,setTraceTarget,initBehaviour,initOuterSettings,isDeterministic,readRandomImp,readRandomTrivial,
  isZero,randomRange,greaterThan,readGameObject,setActive,createBornAction,invokeFixedDelay,onBorn].some(fn=>typeof fn!=='function'))throw new TypeError('Fear inner Init requires reset, behavior, random and birth callers');
 const length=array=>{const value=integer(readLength(array));if(value<0)throw new TypeError('Fear inner Init requires native array lengths');return value;};
 const delayedBorn=projectile=>{const object=nonnull(readGameObject(projectile));setActive(object,true);onBorn(projectile);};
 return(projectile,target,start)=>{
  nonnull(projectile);projectile.currentTime=0n;projectile.m_currentHitNum=0;projectile.m_isEliminated=false;projectile.m_hasReached=false;projectile.m_isStopped=false;projectile.m_hasHitTraceTarget=false;
  clearAlreadyHit(nonnull(projectile.m_targetsAlreadyHit));
  let array=nonnull(projectile.m_eventCallbacks);
  for(let index=0;index<length(array);index++){
   storeReference(nonnull(projectile.m_eventCallbacks),index,null);
   array=nonnull(projectile.m_eventCallbacks);
  }
  projectile.m_lifeTime=raw(floatToRaw(single(getLifeTime(projectile))));projectile.m_maxHitNum=integer(getMaxHitNum(projectile));
  const keepAlreadyHitTime=raw(getKeepAlreadyHitTime(projectile)),transform=projectile._bodyTransform;
  projectile.m_keepAlreadyHitTime=keepAlreadyHitTime;
  projectile._bodyTransform=bool(isNullUnity(transform))?readTransform(projectile):projectile._bodyTransform;
  writeBarrier(projectile,'_bodyTransform',projectile._bodyTransform);setTraceTarget(projectile,target);
  array=nonnull(projectile.m_behaviours);
  for(let index=0;index<length(array);index++){
   const behaviour=nonnull(readElement(nonnull(projectile.m_behaviours),index));initBehaviour(behaviour,start,target,projectile);
   array=nonnull(projectile.m_behaviours);
  }
  projectile.m_behavioursInited=true;initOuterSettings(projectile);
  const random=bool(isDeterministic())?readRandomImp():readRandomTrivial(),sample=single(projectile._randomDelayToBorn);
  let delay=0;if(!bool(isZero(sample))){const maximum=single(projectile._randomDelayToBorn);delay=single(randomRange(nonnull(random),0,maximum));}
  if(!bool(greaterThan(delay,0))){onBorn(projectile);return;}
  setActive(nonnull(readGameObject(projectile)),false);
  const action=nonnull(createBornAction(projectile,()=>delayedBorn(projectile)));invokeFixedDelay(action,delay);
 };
}
