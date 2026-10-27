// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileAbsRaw,fearProjectileMultiplyRaw,fearProjectileRoundRawToInt} from './chapter16-fear-fixed-values.js';

export function fearProjectileBuffPriority({buff,readData,getFpOrDefault,isActive}){
 if(!buff||[readData,getFpOrDefault,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear priority requires native buff, data, blackboard and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear priority requires native Int32 values');return value;};
 const raw=value=>{if(typeof value!=='bigint'||value<-(1n<<63n)||value>(1n<<63n)-1n)throw new TypeError('Fear priority requires signed Q32.32 values');return value;};
 const check=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear priority requires Boolean lifecycle validity');if(!value)throw cancelled;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();const data=readData();check();
    if(int(data.priority)>=0)return int(data.priority);
    let total=0n;
    if(data.priorityBBKeys==null||data.priorityBBKeys.length===0){
     for(let index=0;index<38;index++){
      let subtotal=0n;
      for(const name of ['m_attributeAdditions','m_attributeMultipliers','m_attributeFinalAdditions']){
       const values=buff[name];if(!Array.isArray(values)||index>=values.length)throw new RangeError('Fear priority requires38 native attribute entries');
       subtotal=BigInt.asIntN(64,subtotal+raw(values[index]));
      }
      total=BigInt.asIntN(64,total+subtotal);check();
     }
    }else for(let index=0;;index++){
     const keys=data.priorityBBKeys;
     if(!Array.isArray(keys))throw new TypeError('Fear priority requires a native key-array projection');
     if(index>=keys.length)break;
     const value=getFpOrDefault(keys[index],0n,true);check();
     total=BigInt.asIntN(64,total+fearProjectileAbsRaw(raw(value)));
    }
    return fearProjectileRoundRawToInt(fearProjectileMultiplyRaw(total,1000n<<32n));
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}

export function fearProjectileUpdateBuffStack({buff,loadAttributes,readOwner,readOwnerAttributes,markAttributesDirty,isActive}){
 if(!buff||[loadAttributes,readOwner,readOwnerAttributes,markAttributesDirty,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear stack update requires native attribute, owner and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const check=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear stack update requires Boolean lifecycle validity');if(!value)throw cancelled;};
 const int=value=>{if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear stack update requires native Int32 counts');return value;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();const cap=int(buff.m_maxValidStackCnt),stack=int(buff.m_stackCnt);
    if(cap>=0&&stack>cap)return;
    if(buff.m_data==null)throw new TypeError('Fear stack update requires nonnull buff data');
    loadAttributes(buff.m_data.attributes,int(buff.m_stackCnt));check();
    const owner=readOwner();check();if(owner==null)throw new TypeError('Fear stack update requires a nonnull owner');
    const attributes=readOwnerAttributes(owner);check();
    const mask=buff.attributeMask;
    if(attributes==null)throw new TypeError('Fear stack update requires nonnull owner attributes');
    markAttributesDirty(attributes,mask);check();
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
