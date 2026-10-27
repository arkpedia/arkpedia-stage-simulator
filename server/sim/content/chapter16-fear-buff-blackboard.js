// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileBuffDurationKey} from './chapter16-fear-buff-timing.js';

// Selected Buff.Reset blackboard preparation. Concrete Blackboard operations
// remain native receivers, including virtual Equals and copy construction.
export function fearProjectileResetBuffBlackboard({first,second,readBlackboard,equals,copyBlackboard,resetLifecycle,
 readDurationKey,readData,readBuffKey,clear,assign,assignByPrefix,assignValueStrByPrefix,containsKey,tryGetFP,assignFP,isActive}){
 if([readBlackboard,equals,copyBlackboard,resetLifecycle,readDurationKey,readData,readBuffKey,clear,assign,assignByPrefix,
  assignValueStrByPrefix,containsKey,tryGetFP,assignFP,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear blackboard reset requires native equality, copy, assignment and lifecycle callers');
 const cancelled=Symbol('cancelled');let running=false;
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear blackboard reset requires native Boolean results');return value;};
 const active=()=>boolean(isActive());
 const invoke=(fn,...args)=>{const result=fn(...args);if(!active())throw cancelled;return result;};
 const target=()=>{const result=invoke(readBlackboard);if(result==null)throw new TypeError('Fear blackboard reset requires a nonnull destination');return result;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    if(!active())return null;
    let a=first,b=second;
    if(a!=null&&boolean(invoke(equals,a,target()))){a=invoke(copyBlackboard,a);if(a==null)throw new TypeError('Fear blackboard copy cannot be null');}
    if(b!=null&&boolean(invoke(equals,b,target()))){b=invoke(copyBlackboard,b);if(b==null)throw new TypeError('Fear blackboard copy cannot be null');}
    invoke(resetLifecycle);
    const durationKey=fearProjectileBuffDurationKey(invoke(readDurationKey));
    const data=invoke(readData);let prefix=null;
    if(boolean(data.stripBlackboardParamsWithBuffKey)){
     const key=invoke(readBuffKey);
     if(key!=null&&key!==''){
      if(typeof key!=='string')throw new TypeError('Fear blackboard prefix requires a native string key');
      const actual=invoke(readBuffKey);
      if(actual!=null&&typeof actual!=='string')throw new TypeError('Fear blackboard prefix requires a native string key');
      prefix=(actual??'')+'.';
     }
    }
    invoke(clear,target());
    for(const input of [a,b])if(input!=null){
     if(prefix==null)invoke(assign,target(),input);
     else{
      invoke(assignByPrefix,target(),input,prefix);
      invoke(assignValueStrByPrefix,target(),input,prefix);
     }
    }
    const current=invoke(readData);invoke(assign,target(),current.blackboard);
    if(prefix!=null&&!boolean(invoke(containsKey,target(),durationKey))){
     let found=false,value=-(1n<<32n);
     for(const input of [a,b])if(input!=null){
      const result=invoke(tryGetFP,input,durationKey);
      if(!result||typeof result.found!=='boolean'||typeof result.valueRaw!=='bigint'||result.valueRaw<-(1n<<63n)||result.valueRaw>(1n<<63n)-1n)
       throw new TypeError('Fear blackboard duration lookup requires native found/out FP results');
      value=result.valueRaw;found=result.found||found;
     }
     if(found)invoke(assignFP,target(),durationKey,value);
    }
    return Object.freeze({durationKey});
   }catch(error){if(error===cancelled)return null;throw error;}
   finally{running=false;}
  },
 });
}
