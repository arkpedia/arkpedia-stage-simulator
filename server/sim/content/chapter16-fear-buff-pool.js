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
