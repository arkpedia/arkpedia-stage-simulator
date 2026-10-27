// SPDX-License-Identifier: GPL-3.0-or-later
// Selected ObjectPool<Buff>.Recycle path. Callers supply the native pool's
// current using/unused projections; allocation and force-reuse policy are not
// inferred here. Default Buff equality is object identity.
export function fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle}){
 if(!(usingBuffs instanceof Set)||!Array.isArray(unusedBuffs)||typeof onRecycle!=='function')
  throw new TypeError('Fear buff recycle pool requires native using/unused projections and a recycle receiver');
 return Object.freeze({
  recycle(buff){
   if(buff==null||!usingBuffs.delete(buff))return false;
   // _RecycleInternal pushes before _SendNotification(OnRecycle). These
   // mutations remain committed if the receiver throws, as in native code.
   unusedBuffs.push(buff);
   onRecycle(buff);
   return true;
  },
 });
}

// BattleController's selected buff-pool options: preload100, prepared unlimited
// signed capacity and no auto reuse. Construction does not allocate identities.
export function fearProjectileDefaultBuffPool({createBuff,onAllocate,onRecycle}){
 if([createBuff,onAllocate,onRecycle].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear default buff pool requires native construction and allocation/recycle receivers');
 const usingBuffs=new Set(),unusedBuffs=[],maxCapacity=0x7fffffff;
 for(let index=0;index<100;index++){
  const buff=createBuff();if(buff!=null)unusedBuffs.push(buff);
 }
 const recycling=fearProjectileBuffRecyclePool({usingBuffs,unusedBuffs,onRecycle});
 return Object.freeze({
  allocate(){
   let buff;
   if(unusedBuffs.length)buff=unusedBuffs.pop();
   else if(usingBuffs.size+unusedBuffs.length<maxCapacity)buff=createBuff();
   else return null;
   if(buff==null)return null;
   // Native HashSet.Add's result is ignored. Do not invent an alias rejection
   // if a nonstandard factory returned a body that is already being used.
   usingBuffs.add(buff);
   onAllocate(buff);
   return buff;
  },
  recycle:recycling.recycle,
  get availableUnusedCount(){return unusedBuffs.length;},
  get allLoadedCount(){return usingBuffs.size+unusedBuffs.length;},
  get usingCount(){return usingBuffs.size;},
 });
}
