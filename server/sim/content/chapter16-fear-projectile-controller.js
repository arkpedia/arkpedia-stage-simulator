// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile controller dereferenced a null native object');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear projectile controller requires native Boolean values');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile controller requires native Int32 values');return value;};

// Default BattleController.CreateProjectile. Pool allocation and Projectile.Init
// remain separate source-bound receivers; failed hook births are not rolled back.
export function fearProjectileControllerCreation({isNullUnity,isValidUnity,getEffectReplacePairs,tryHook,readFactory,factoryCreate,getMountPoint,initProjectile,attachGraphic,reportHookFailure,writeBarrier}){
 if([isNullUnity,isValidUnity,getEffectReplacePairs,tryHook,readFactory,factoryCreate,getMountPoint,initProjectile,attachGraphic,reportHookFailure,writeBarrier].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile controller creation requires Unity, hook, factory and initialization callers');
 return(controller,key,source,start,target,ability,graphicOut)=>{
  nonnull(controller);const graphicKey={value:null},logicKey={value:null},muzzle={value:0},
   replacePairs=bool(isNullUnity(source))?null:getEffectReplacePairs(nonnull(source));
  if(bool(isValidUnity(source))&&bool(tryHook(nonnull(source),key,graphicKey,logicKey,muzzle))){
   const logic=factoryCreate(nonnull(readFactory(controller)),logicKey.value),graphic=factoryCreate(nonnull(readFactory(controller)),graphicKey.value);
   nonnull(graphicOut).value=graphic;writeBarrier(graphicOut,'value',graphic);
   if(bool(isValidUnity(logic))&&bool(isValidUnity(graphicOut.value))){
    const mountType=integer(muzzle.value),selectedKey=logicKey.value,mount=getMountPoint(source,mountType);
    initProjectile(nonnull(logic),selectedKey,mount,target,ability,1,key,replacePairs);
    const currentGraphic=nonnull(graphicOut.value);
    initProjectile(currentGraphic,graphicKey.value,start,target,ability,2,key,replacePairs);
    attachGraphic(logic,graphicOut.value);
   }else reportHookFailure(logicKey.value,graphicKey.value);
   return logic;
  }
  const projectile=factoryCreate(nonnull(readFactory(controller)),key);
  if(bool(isValidUnity(projectile)))initProjectile(nonnull(projectile),key,start,target,ability,0,key,replacePairs);
  nonnull(graphicOut).value=null;writeBarrier(graphicOut,'value',null);
  return projectile;
 };
}

// Default BattleFactory.CreateProjectile. Unity allocation, transforms and
// Vector3.one stay explicit; no pool lifecycle or Unity engine parity is implied.
export function fearProjectileFactoryCreation({combinePath,allocate,isNullUnity,readTransform,readFolder,setParent,readOneVector,setLocalScale}){
 if([combinePath,allocate,isNullUnity,readTransform,readFolder,setParent,readOneVector,setLocalScale].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile factory requires path, pool and transform callers');
 return(factory,key)=>{
  nonnull(factory);const path=combinePath('battle/prefabs/[uc]projectiles',key),projectile=allocate(path);
  if(bool(isNullUnity(projectile)))return null;
  const transform=nonnull(readTransform(nonnull(projectile))),folder=readFolder(factory);setParent(transform,folder);
  const nextTransform=readTransform(projectile),one=nonnull(readOneVector()),scale={};
  nonnull(nextTransform);
  for(const axis of ['x','y','z']){const value=one[axis];if(typeof value!=='number')throw new TypeError('Fear projectile factory requires native Single vector components');scale[axis]=Math.fround(value);}
  setLocalScale(nextTransform,scale);return projectile;
 };
}

export function fearProjectileAttachGraphic({writeBarrier}){
 if(typeof writeBarrier!=='function')throw new TypeError('Fear graphic attachment requires a native write barrier caller');
 return(projectile,graphic)=>{nonnull(projectile).m_graphicProjectile=graphic;writeBarrier(projectile,'m_graphicProjectile',graphic);};
}
