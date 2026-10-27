// SPDX-License-Identifier: GPL-3.0-or-later
import {fearProjectileBuffDurationKey} from './chapter16-fear-buff-timing.js';

// Selected Blackboard.Assign(float/string) on its List<DataPair> projection.
// Culture-sensitive System.String operations are supplied without substituting
// JavaScript's different casing/collation rules.
export function fearProjectileBuffBlackboardWrites({entries,toLower,compareIgnoreCase,isActive}){
 if(!Array.isArray(entries)||[toLower,compareIgnoreCase,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear blackboard writes require native list, casing, comparison and lifecycle callers');
 let running=false;
 const active=()=>{const value=isActive();if(typeof value!=='boolean')throw new TypeError('Fear blackboard writes require Boolean lifecycle validity');return value;};
 function write(key,value,stringValue){
  if(running)return null;running=true;
  try{
   if(!active())return null;
   if(typeof key!=='string')throw new TypeError('Fear blackboard write requires a nonnull native string key');
   if(stringValue){if(value!=null&&typeof value!=='string')throw new TypeError('Fear blackboard string write requires a nullable native string');}
   else if(typeof value!=='number')throw new TypeError('Fear blackboard numeric write requires a native float');
   const lowered=toLower(key);if(!active())return null;
   if(typeof lowered!=='string')throw new TypeError('Fear blackboard casing requires a nonnull native string result');
   const pair={key:lowered,value:stringValue?0:Math.fround(value),valueStr:stringValue?(value??null):null};
   for(let index=0;index<entries.length;index++){
    const existing=entries[index]?.key;if(!active())return null;
    const compared=compareIgnoreCase(existing,key,true);if(!active())return null;
    if(!Number.isInteger(compared)||compared<-(2**31)||compared>=2**31)throw new TypeError('Fear blackboard comparison requires a native Int32 result');
    if(compared===0){
     if(index>=entries.length)throw new RangeError('Fear blackboard replacement index is outside the native list');
     entries[index]=pair;return active()?undefined:null;
    }
   }
   entries.push(pair);if(!active())return null;
  }finally{running=false;}
 }
 return Object.freeze({assignNumeric:(key,value)=>write(key,value,false),assignString:(key,value)=>write(key,value,true)});
}

// Selected IReadOnlyList<DataPair> array projection. The native ordinal-ignore-
// case comparison stays explicit; destination numeric/string writes are separate.
export function fearProjectileBuffPrefixAssignments({startsWith,assignNumeric,assignString,isActive}){
 if([startsWith,assignNumeric,assignString,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear prefix assignment requires native string comparison, writes and lifecycle callers');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear prefix assignment requires native Boolean results');return value;};
 let running=false;
 function run(source,prefix,stringValues){
  if(running)return null;running=true;
  try{
   if(!boolean(isActive()))return null;
   if(source==null)return;
   if(!Array.isArray(source))throw new TypeError('Fear prefix assignment requires a native DataPair list projection');
   for(let index=0;index<source.length;index++){
    const key=source[index]?.key;
    if(!boolean(isActive()))return null;
    if(typeof key!=='string')throw new TypeError('Fear prefix assignment requires nonnull native string keys');
    const matched=startsWith(key,prefix,5);if(!boolean(isActive()))return null;
    if(!boolean(matched))continue;
    if(typeof prefix!=='string')throw new TypeError('Fear prefix assignment requires a native string prefix');
    const stripped=key.slice(prefix.length);
    if(stringValues){
     const probe=source[index]?.valueStr;if(!boolean(isActive()))return null;
     if(probe==null||probe==='')continue;
     if(typeof probe!=='string')throw new TypeError('Fear prefix assignment requires native nullable string values');
     const value=source[index]?.valueStr;if(!boolean(isActive()))return null;
     if(value!=null&&typeof value!=='string')throw new TypeError('Fear prefix assignment requires native nullable string values');
     assignString(stripped,value);if(!boolean(isActive()))return null;
    }else{
     const value=source[index]?.value;if(!boolean(isActive()))return null;
     if(typeof value!=='number')throw new TypeError('Fear prefix assignment requires native float values');
     assignNumeric(stripped,Math.fround(value));if(!boolean(isActive()))return null;
    }
   }
  }finally{running=false;}
 }
 return Object.freeze({assignByPrefix:(source,prefix)=>run(source,prefix,false),assignValueStrByPrefix:(source,prefix)=>run(source,prefix,true)});
}

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
