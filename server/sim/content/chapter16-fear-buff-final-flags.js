// SPDX-License-Identifier: GPL-3.0-or-later
// Final selected Buff.Reset flags. Native database enumeration, BlockDamage
// casts and getters are supplied; no shield action is executed during setup.
export function fearProjectileInitBuffFinalFlags({buff,openBreakIterator,readBreakKeys,readBuffKey,readActions,
 asBlockDamage,readShowShieldUI,readDamageMask,isActive}){
 if(!buff||[openBreakIterator,readBreakKeys,readBuffKey,readActions,asBlockDamage,readShowShieldUI,readDamageMask,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear final flags require native break-database, action and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const bool=value=>{if(typeof value!=='boolean')throw new TypeError('Fear final flags require native Boolean results');return value;};
 const check=()=>{if(!bool(isActive()))throw cancelled;};
 const call=(fn,...args)=>{const value=fn(...args);check();return value;};
 function elementalBreak(){
  const iterator=openBreakIterator();
  let found=false;
  try{
   check();if(!iterator||typeof iterator.dispose!=='function')throw new TypeError('Fear elemental-break scan requires a disposable native iterator');
   if(typeof iterator.moveNext!=='function'||typeof iterator.current!=='function')throw new TypeError('Fear elemental-break scan requires native iterator moveNext/current');
   while(bool(call(()=>iterator.moveNext()))){
    const pair=call(()=>iterator.current());
    if(pair?.value==null)throw new TypeError('Fear elemental-break database record cannot be null');
    const keys=call(readBreakKeys,pair.value),key=call(readBuffKey);
    if(!Array.isArray(keys))throw new TypeError('Fear elemental-break record requires a nonnull native key list');
    if(key!=null&&typeof key!=='string')throw new TypeError('Fear elemental-break membership requires a nullable native key');
    if(keys.some(value=>value===(key??null))){found=true;break;}
   }
  }finally{if(iterator&&typeof iterator.dispose==='function')iterator.dispose();}
  check();return found;
 }
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();buff.m_isEpBreakBuff=elementalBreak();check();
    buff.hasShield=false;check();
    const actions=call(readActions);
    if(!Array.isArray(actions))throw new TypeError('Fear shield setup requires a native action-table projection');
    if(actions.length<=10)throw new RangeError('Fear shield event index is outside the native action array');
    const nodes=actions[10];if(nodes==null)return;
    if(!Array.isArray(nodes))throw new TypeError('Fear shield setup requires a native action-node array projection');
    for(let index=0;index<nodes.length;index++){
     const action=nodes[index];check();if(action==null)continue;
     const node=call(asBlockDamage,action);if(node==null)continue;
     if(!bool(call(readShowShieldUI,node)))continue;
     buff.hasShield=true;check();
     const mask=call(readDamageMask,node);
     if(!Number.isInteger(mask)||mask<-(2**31)||mask>=2**31)throw new TypeError('Fear shield mask requires a native Int32 value');
     buff.m_shieldMask=mask;check();break;
    }
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
