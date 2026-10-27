// SPDX-License-Identifier: GPL-3.0-or-later
const nonnull=value=>{if(value==null)throw new TypeError('Fear projectile launch dereferenced a null native object');return value;};
const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear projectile launch requires native Boolean values');return value;};
const integer=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear projectile launch requires native Int32 values');return value;};
const single=value=>{if(typeof value!=='number')throw new TypeError('Fear projectile launch requires native Single values');return Math.fround(value);};

// Selected default RangedAttack.CreateProjectile and its inlined shoot-point
// selection. BattleController creation, Unity mount points/events remain callers.
export function fearProjectileCreateProjectile({readController,getProjectileKey,readOwner,readUseMountGroup,readMountCache,safeMountCount,
 readMountIndex,writeMountIndex,readMountItem,readMountType,getMountPoint,createProjectile,readFireCreateEvent,readEventPool,emitCreateEvent}){
 if([readController,getProjectileKey,readOwner,readUseMountGroup,readMountCache,safeMountCount,readMountIndex,writeMountIndex,readMountItem,
  readMountType,getMountPoint,createProjectile,readFireCreateEvent,readEventPool,emitCreateEvent].some(fn=>typeof fn!=='function'))throw new TypeError('Fear projectile creation requires controller, owner, mount and event callers');
 return(ability,target,fakeProjectile)=>{
  nonnull(ability);const controller=readController(),key=getProjectileKey(ability),source=readOwner(ability);let mount;
  if(bool(readUseMountGroup(ability))){
   const size=integer(safeMountCount(readMountCache(ability))),index=integer(readMountIndex(ability));
   if(size>index){
    const cache=readMountCache(ability);writeMountIndex(ability,(index+1)|0);
    const type=integer(readMountItem(nonnull(cache),index)),owner=nonnull(readOwner(ability));
    mount=getMountPoint(owner,type);
   }else{
    const owner=readOwner(ability),type=integer(readMountType(ability));mount=getMountPoint(nonnull(owner),type);
   }
  }else{
   const owner=readOwner(ability),type=integer(readMountType(ability));mount=getMountPoint(nonnull(owner),type);
  }
  const projectile=createProjectile(nonnull(controller),key,source,mount,target,ability,fakeProjectile);
  if(bool(readFireCreateEvent(ability))){
   const pool=nonnull(readEventPool(nonnull(readOwner(ability))));emitCreateEvent(pool,40,projectile);
  }
  return projectile;
 };
}

// Selected default RangedAttack.OnCastOnTarget. Base action application receives
// null buffs/attachments; the projectile receives those later through its ability.
export function fearProjectileRangedTargetCast({baseCast,readDestination,readProjectiles,readInputX,readInputY,readHitMountPoint,
 readMapPosition,readRootTile,positionFromVector2,positionFromVector3,positionFromVisual,boxPosition,createProjectile,capturePointer,appendProjectile,isValidUnity}){
 if([baseCast,readDestination,readProjectiles,readInputX,readInputY,readHitMountPoint,readMapPosition,readRootTile,positionFromVector2,
  positionFromVector3,positionFromVisual,boxPosition,createProjectile,capturePointer,appendProjectile,isValidUnity].some(fn=>typeof fn!=='function'))throw new TypeError('Fear ranged target casting requires base, destination, projectile and list callers');
 return(ability,target,actions,_buffs,_attachments)=>{
  nonnull(ability);baseCast(ability,target,actions,null,null);
  const destination=integer(readDestination(ability));let list,position;
  if(destination===1){
   const y=single(readInputY(ability));list=readProjectiles(ability);const x=single(readInputX(ability));
   position=boxPosition(positionFromVector2({x,y}));
  }else if(destination===2){
   list=readProjectiles(ability);const p=nonnull(readMapPosition(nonnull(target))),vector={x:single(p.x),y:single(p.y),z:single(p.z)};
   position=boxPosition(positionFromVector3(vector));
  }else if(destination===3){
   list=readProjectiles(ability);position=boxPosition(positionFromVisual(readRootTile(nonnull(target))));
  }else if(destination===4){
   const p=nonnull(readMapPosition(nonnull(target))),vector={x:single(p.x),y:single(p.y),z:single(p.z)},
    tile=nonnull(readRootTile(target)),tilePosition=nonnull(readMapPosition(tile));
   list=readProjectiles(ability);vector.z=single(tilePosition.z);position=boxPosition(positionFromVector3(vector));
  }else{
   list=readProjectiles(ability);position=readHitMountPoint(nonnull(target));
  }
  const fake={value:null},projectile=createProjectile(ability,position,fake),pointer=capturePointer(projectile);
  appendProjectile(nonnull(list),pointer);
  if(bool(isValidUnity(fake.value))){
   const fakeValue=fake.value,nextList=readProjectiles(ability),fakePointer=capturePointer(fakeValue);
   appendProjectile(nonnull(nextList),fakePointer);
  }
 };
}
